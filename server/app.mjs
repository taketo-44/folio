import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMetadataServer } from './metadata.mjs';

const token = () => randomBytes(32).toString('hex');
const digest = value => createHash('sha256').update(value).digest('hex');
export function passwordHash(password) {
  if (password.length < 16) throw new Error('Use a password with at least 16 characters.');
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
function checkPassword(password, hash) {
  const [salt, expected] = hash.split(':');
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(expected, 'hex'));
}
function fail(status, message) { throw Object.assign(new Error(message), {status}); }
function validate(data) {
  if (!Array.isArray(data.papers) || data.papers.length > 10000 || !data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) fail(400, 'Invalid library.');
  const ids = new Set();
  for (const p of data.papers) {
    if (!p || typeof p.id !== 'string' || !/^[\w-]{1,100}$/.test(p.id) || ids.has(p.id) || typeof p.title !== 'string' || !p.title.trim() || p.title.length > 500) fail(400, 'Invalid paper ID or title.');
    ids.add(p.id);
    if (!['read','reading','unread'].includes(p.status) || !['high','normal','low'].includes(p.importance) || !Array.isArray(p.tags) || p.tags.length > 50 || p.tags.some(t => typeof t !== 'string' || t.length > 200)) fail(400, 'Invalid paper flags or tags.');
    for (const [field,max] of Object.entries({authors:5000,venue:1000,notes:100000,doi:2000,url:4000,rank:100,metricType:100,metricSource:4000,pdfName:500,type:100,metadataSource:100})) {
      if (p[field] !== undefined && (typeof p[field] !== 'string' || p[field].length > max)) fail(400, 'Invalid '+field+'.');
    }
    for (const field of ['url','metricSource']) if (p[field]) {
      try { if (!['http:','https:'].includes(new URL(p[field]).protocol)) fail(400, 'Invalid URL.'); } catch { fail(400, 'Invalid URL.'); }
    }
    if (p.drivePdfId !== undefined && !/^[\w-]{1,200}$/.test(p.drivePdfId)) fail(400, 'Invalid Drive reference.');
    for (const field of ['added','updated']) if (p[field] !== undefined && (!Number.isSafeInteger(p[field]) || p[field]<0)) fail(400, 'Invalid timestamp.');
    if (p.year !== undefined && p.year !== '' && (!Number.isInteger(p.year) || p.year<1400 || p.year>2100)) fail(400, 'Invalid publication year.');
    if (p.metricYear !== undefined && typeof p.metricYear !== 'string' && typeof p.metricYear !== 'number') fail(400, 'Invalid metric year.');
    if (p.sample !== undefined && typeof p.sample !== 'boolean') fail(400, 'Invalid sample flag.');
    // Never persist device PDF caches or arbitrary binary properties.
    const allowed = new Set(['id','title','authors','venue','notes','doi','url','rank','metricType','metricSource','pdfName','type','metadataSource','status','importance','tags','year','metricYear','added','updated','sample','drivePdfId']);
    for (const field of Object.keys(p)) if (!allowed.has(field)) delete p[field];
  }
  const s = data.settings;
  if (s.clientId !== undefined && (typeof s.clientId !== 'string' || !/^[\w.-]{1,250}\.apps\.googleusercontent\.com$/.test(s.clientId))) fail(400, 'Invalid Google client ID.');
  if (s.collections !== undefined && (!Array.isArray(s.collections) || s.collections.length > 1000 || s.collections.some(t => typeof t !== 'string' || t.length > 200))) fail(400, 'Invalid collections.');
  data.settings = {collections:s.collections || [], ...(s.clientId ? {clientId:s.clientId} : {}), ...(Number.isFinite(s.lastBackup) ? {lastBackup:s.lastBackup} : {})};
  return data;
}

export function createApp({origin, hash, dbPath, allowHttp = false, metadata = createMetadataServer(undefined, origin)} = {}) {
  const publicURL = new URL(origin);
  if (publicURL.origin !== origin || (publicURL.protocol !== 'https:' && !(allowHttp && ['localhost','127.0.0.1'].includes(publicURL.hostname) && publicURL.protocol === 'http:'))) throw new Error('APP_ORIGIN must be an exact HTTPS origin (or loopback HTTP for development).');
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash || '')) throw new Error('Set FOLIO_PASSWORD_HASH using server/password.mjs.');
  mkdirSync(dirname(dbPath), {recursive:true, mode:0o700});
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS library (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL);`);
  db.prepare('INSERT OR IGNORE INTO library VALUES (1,0,?)').run(JSON.stringify({papers:[],settings:{}}));
  const snapshot = () => { const row = db.prepare('SELECT revision,data FROM library WHERE id=1').get(); return {...JSON.parse(row.data),revision:row.revision}; };
  const assets = new Map(['index.html','app.js','style.css'].map(name => [name, readFileSync(new URL('../dist/'+name, import.meta.url))]));
  const attempts = new Map();
  let loginBusy = false;
  const reply = (res,status,data) => { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data)); };
  const readJSON = async req => {
    if (!/^application\/json\b/.test(req.headers['content-type'] || '')) fail(415,'Use JSON.');
    let size=0;const parts=[];
    for await (const part of req) { size+=part.length; if (size>10*1024*1024) fail(413,'Library exceeds 10 MB.');parts.push(part); }
    try { return JSON.parse(Buffer.concat(parts)); } catch { fail(400,'Invalid JSON.'); }
  };
  const cookie = (value, age) => `folio_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}`+(publicURL.protocol==='https:'?'; Secure':'');
  const server = http.createServer({requestTimeout:30000,headersTimeout:10000,maxHeaderSize:8192}, async (req,res) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('X-Frame-Options','DENY');
    try {
      if (req.headers.host !== publicURL.host) fail(403,'Invalid host.');
      const url = new URL(req.url,origin);
      const mutating = !['GET','HEAD'].includes(req.method);
      if (mutating && req.headers.origin !== origin) fail(403,'Invalid origin.');
      if (req.headers['sec-fetch-site'] === 'cross-site') fail(403,'Use Folio directly.');
      if (url.pathname === '/api/login' && req.method === 'POST') {
        const now=Date.now();
        // Key by actual socket, never untrusted X-Forwarded-For. Behind Caddy this is a conservative shared limit.
        for (const [key,v] of attempts) if (v.until<now) attempts.delete(key);
        const key=req.socket.remoteAddress;
        const limit=attempts.get(key) || {count:0,until:now+15*60*1000};
        if (loginBusy || limit.count>=10) fail(429,'Too many login attempts. Try again in 15 minutes.');
        limit.count++;attempts.set(key,limit);
        loginBusy=true;
        try {
          const data=await readJSON(req);
          if (typeof data.password !== 'string' || data.password.length>1024 || !checkPassword(data.password,hash)) fail(401,'Incorrect password.');
          const id=token(),csrf=token(),expires=now+7*86400000;
          db.prepare('DELETE FROM sessions WHERE expires < ?').run(now);
          db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(id),csrf,expires);
          attempts.delete(key);
          res.setHeader('Set-Cookie',cookie(id,7*86400));reply(res,200,{csrf});
        } finally { loginBusy=false; }
        return;
      }
      const raw=req.headers.cookie?.match(/(?:^|;\s*)folio_session=([a-f0-9]{64})(?:;|$)/)?.[1];
      const session=raw ? db.prepare('SELECT * FROM sessions WHERE id=? AND expires>?').get(digest(raw),Date.now()) : null;
      if (url.pathname.startsWith('/api/')) {
        if (!session) fail(401,'Sign in to your library.');
        if (mutating && req.headers['x-csrf-token'] !== session.csrf) fail(403,'Invalid session token.');
        if (url.pathname === '/api/session' && req.method === 'GET') { reply(res,200,{csrf:session.csrf});return; }
        if (url.pathname === '/api/logout' && req.method === 'POST') { db.prepare('DELETE FROM sessions WHERE id=?').run(session.id);res.setHeader('Set-Cookie',cookie('',0));reply(res,200,{ok:true});return; }
        if (url.pathname === '/api/library' && req.method === 'GET') { reply(res,200,snapshot());return; }
        if (url.pathname === '/api/library' && req.method === 'PUT') {
          const data=validate(await readJSON(req));
          if (!Number.isSafeInteger(data.revision) || data.revision<0) fail(400,'Invalid revision.');
          const result=db.prepare('UPDATE library SET data=?,revision=revision+1 WHERE id=1 AND revision=?').run(JSON.stringify({papers:data.papers,settings:data.settings}),data.revision);
          if (!result.changes) { reply(res,409,{error:'Your library changed on another device. The latest library was loaded; review and retry your edit.',library:snapshot()});return; }
          reply(res,200,snapshot());return;
        }
        if (['/api/tches','/api/eprint'].includes(url.pathname) && req.method === 'GET') {
          // Reuse the constrained publisher lookup without starting another listener.
          metadata.emit('request',req,res);return;
        }
        fail(404,'Not found.');
      }
      if (!['GET','HEAD'].includes(req.method)) fail(405,'Use GET.');
      if (url.pathname === '/config.js') { res.writeHead(200,{'Content-Type':'text/javascript'});res.end('window.FOLIO_REMOTE = true;');return; }
      const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
      if (!assets.has(name)) fail(404,'Not found.');
      res.setHeader('Content-Type',{'index.html':'text/html; charset=utf-8','app.js':'text/javascript; charset=utf-8','style.css':'text/css; charset=utf-8'}[name]);
      res.end(req.method==='HEAD'?undefined:assets.get(name));
    } catch (err) {
      if (!res.headersSent) reply(res,err.status || 500,{error:err.status?err.message:'Server error. Please try again.'});
      else res.end();
    }
  });
  server.on('close',()=>{db.close();metadata.close();});
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.umask(0o077);
  const server=createApp({origin:process.env.APP_ORIGIN,hash:process.env.FOLIO_PASSWORD_HASH,dbPath:process.env.DB_PATH || './.runtime/folio.sqlite',allowHttp:process.env.ALLOW_LOCAL_HTTP==='1'});
  server.listen(Number(process.env.PORT || 3000),process.env.BIND || '127.0.0.1',()=>console.log('Folio server ready.'));
  for (const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>server.close());
}
