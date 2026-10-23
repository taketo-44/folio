import http from 'node:http';
import {isIP} from 'node:net';
import {securityHeaders} from './http-security.mjs';
import {normalizeImportance} from '../dist/importance.js';
import {createStarterLibrary} from '../dist/starter-papers.js';
import {createClassifier,normalizeSuggestions} from './classify.mjs';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMetadataServer } from './metadata.mjs';

const token = () => randomBytes(32).toString('hex');
const digest = value => createHash('sha256').update(value).digest('hex');
export function passwordHash(password) {
  if (typeof password !== 'string' || password.length < 16 || password.length > 1024) throw new Error('Use a password with 16–1024 characters.');
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
    if (!['read','reading','unread'].includes(p.status) || (!(Number.isInteger(p.importance)&&p.importance>=0&&p.importance<=5)&&!['high','normal','low'].includes(p.importance)) || !Array.isArray(p.tags) || p.tags.length > 50 || p.tags.some(t => typeof t !== 'string' || t.length > 200)) fail(400, 'Invalid paper flags or tags.');
    p.importance=normalizeImportance(p.importance);
    for (const [field,max] of Object.entries({authors:5000,venue:1000,notes:100000,doi:2000,url:4000,rank:100,metricType:100,metricSource:4000,type:100,metadataSource:100,abstract:20000})) {
      if (p[field] !== undefined && (typeof p[field] !== 'string' || p[field].length > max)) fail(400, 'Invalid '+field+'.');
    }
    for (const field of ['url','metricSource']) if (p[field]) {
      try { if (!['http:','https:'].includes(new URL(p[field]).protocol)) fail(400, 'Invalid URL.'); } catch { fail(400, 'Invalid URL.'); }
    }
    for (const field of ['added','updated']) if (p[field] !== undefined && (!Number.isSafeInteger(p[field]) || p[field]<0)) fail(400, 'Invalid timestamp.');
    if (p.year !== undefined && p.year !== '' && (!Number.isInteger(p.year) || p.year<1400 || p.year>2100)) fail(400, 'Invalid publication year.');
    if (p.metricPreset !== undefined && typeof p.metricPreset !== 'boolean') fail(400, 'Invalid metric preset flag.');
    if (p.metricYear !== undefined && typeof p.metricYear !== 'string' && typeof p.metricYear !== 'number') fail(400, 'Invalid metric year.');
    if (p.sample !== undefined && typeof p.sample !== 'boolean') fail(400, 'Invalid sample flag.');
    // Only persist citation metadata, flags, links, and notes.
    const allowed = new Set(['id','title','authors','venue','notes','doi','url','rank','metricType','metricSource','abstract','type','metadataSource','status','importance','tags','year','metricYear','added','updated','sample','metricPreset']);
    for (const field of Object.keys(p)) if (!allowed.has(field)) delete p[field];
  }
  const s = data.settings;
  if (s.collections !== undefined && (!Array.isArray(s.collections) || s.collections.length > 1000 || s.collections.some(t => typeof t !== 'string' || t.length > 200))) fail(400, 'Invalid collections.');
  if(s.autoCollections!==undefined&&typeof s.autoCollections!=='boolean')fail(400,'Invalid automatic collections setting.');
  if(s.autoCreateCollections!==undefined&&typeof s.autoCreateCollections!=='boolean')fail(400,'Invalid collection creation setting.');
  if(s.collectionInstructions!==undefined&&(typeof s.collectionInstructions!=='string'||s.collectionInstructions.length>1000))fail(400,'Collection instructions must be at most 1000 characters.');
  data.settings = {collections:s.collections || [],...(s.autoCollections!==undefined?{autoCollections:s.autoCollections}:{}),...(s.autoCreateCollections!==undefined?{autoCreateCollections:s.autoCreateCollections}:{}),...(s.collectionInstructions!==undefined?{collectionInstructions:s.collectionInstructions}:{})};
  return data;
}

export function createApp({origin, hash, dbPath, ownerName = 'owner', allowHttp = false, trustedProxy = false, classifier=createClassifier(), aiDailyLimit=100, aiUserDailyLimit=20, metadata = createMetadataServer(undefined, origin)} = {}) {
  if(!Number.isSafeInteger(aiDailyLimit)||aiDailyLimit<1||!Number.isSafeInteger(aiUserDailyLimit)||aiUserDailyLimit<1)throw new Error('AI daily limits must be positive integers.');
  const aiPending=new Set();
  const publicURL = new URL(origin);
  if (publicURL.origin !== origin || (publicURL.protocol !== 'https:' && !(allowHttp && ['localhost','127.0.0.1'].includes(publicURL.hostname) && publicURL.protocol === 'http:'))) throw new Error('APP_ORIGIN must be an exact HTTPS origin (or loopback HTTP for development).');
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash || '')) throw new Error('Set FOLIO_PASSWORD_HASH using server/password.mjs.');
  mkdirSync(dirname(dbPath), {recursive:true, mode:0o700});
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
  if (db.prepare('PRAGMA user_version').get().user_version>5) {db.close();throw new Error('This database requires a newer Folio version.');}
  const username = value => {
    if(typeof value!=='string')fail(400,'Enter a username.');
    const name=value.trim().toLowerCase();
    if(!/^[a-z0-9][a-z0-9_.-]{2,39}$/.test(name))fail(400,'Use a username of 3–40 letters, numbers, dots, underscores, or hyphens.');
    return name;
  };
  ownerName=username(ownerName);
  const transaction = action => {db.exec('BEGIN IMMEDIATE');try{const result=action();db.exec('COMMIT');return result}catch(err){db.exec('ROLLBACK');throw err}};
  try {transaction(()=>{
    db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','member')), enabled INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS user_libraries (user_id INTEGER PRIMARY KEY REFERENCES users(id), revision INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS user_sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_by_user ON user_sessions(user_id);
      CREATE TABLE IF NOT EXISTS ai_usage (user_id INTEGER NOT NULL REFERENCES users(id), day TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(user_id,day));
      CREATE TABLE IF NOT EXISTS paper_activity (user_id INTEGER NOT NULL REFERENCES users(id), day TEXT NOT NULL, papers_added INTEGER NOT NULL, PRIMARY KEY(user_id,day));
      CREATE TABLE IF NOT EXISTS activity_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS invitations (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, created_by INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL, created INTEGER NOT NULL);`);
    if(!db.prepare('SELECT id FROM users LIMIT 1').get()){
      const legacy=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='library'").get()?db.prepare('SELECT revision,data FROM library WHERE id=1').get():null;
      const owner=db.prepare("INSERT INTO users(username,password_hash,role,created) VALUES (?,?,'owner',?)").run(username(ownerName),hash,Date.now());
      db.prepare('INSERT INTO user_libraries VALUES (?,?,?)').run(owner.lastInsertRowid,legacy?.revision||0,legacy?.data||JSON.stringify(createStarterLibrary()));
      if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get())db.exec('DELETE FROM sessions');
    }
    if(db.prepare('PRAGMA user_version').get().user_version<4){
      for(const row of db.prepare('SELECT user_id,data FROM user_libraries').all()){
        const data=JSON.parse(row.data);let changed=false;
        for(const paper of data.papers){const rating=normalizeImportance(paper.importance);if(paper.importance!==rating){paper.importance=rating;changed=true}}
        for(const paper of data.papers)for(const field of ['pdfId','drivePdfId','pdfName','hasPdf','needsPdfUpload'])if(Object.hasOwn(paper,field)){delete paper[field];changed=true}
        for(const field of ['clientId','lastBackup'])if(Object.hasOwn(data.settings,field)){delete data.settings[field];changed=true}
        if(changed)db.prepare('UPDATE user_libraries SET data=?,revision=revision+1 WHERE user_id=?').run(JSON.stringify(data),row.user_id);
      }
    }
    db.prepare('INSERT OR IGNORE INTO activity_metadata VALUES (?,?)').run('started_at',new Date().toISOString());
    db.exec('PRAGMA user_version=5');
  })}catch(err){db.close();throw err}
  const publicUser = user => ({id:user.id,username:user.username,role:user.role});
  const snapshot = user => { const row = db.prepare('SELECT revision,data FROM user_libraries WHERE user_id=?').get(user.id); return {...JSON.parse(row.data),revision:row.revision,user:publicUser(user)}; };
  const assets = new Map(['index.html','app.js','style.css','starter-papers.js','importance.js','venue-ranks.js'].map(name => [name, readFileSync(new URL('../dist/'+name, import.meta.url))]));
  const attempts = new Map();
  const attemptLimit=(key,now)=>{
    for(const [entry,value] of attempts)if(value.until<now)attempts.delete(entry);
    if(!attempts.has(key)&&attempts.size>=10000)fail(429,'Too many sign-in attempts. Try again later.');
    const limit=attempts.get(key)||{count:0,until:now+15*60*1000};
    if(limit.count>=10)fail(429,'Too many sign-in attempts. Try again in 15 minutes.');
    limit.count++;attempts.set(key,limit);
  };
  const reply = (res,status,data) => { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data)); };
  const readJSON = async (req, maxSize=16384) => {
    if (!/^application\/json\b/.test(req.headers['content-type'] || '')) fail(415,'Use JSON.');
    let size=0;const parts=[];
    for await (const part of req) { size+=part.length; if (size>maxSize) fail(413,'Request exceeds the size limit.');parts.push(part); }
    let data;try { data=JSON.parse(Buffer.concat(parts)); } catch { fail(400,'Invalid JSON.'); }
    if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Use a JSON object.');
    return data;
  };
  const cookie = (value, age) => `folio_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}`+(publicURL.protocol==='https:'?'; Secure':'');
  const server = http.createServer({requestTimeout:30000,headersTimeout:10000,maxHeaderSize:8192}, async (req,res) => {
    securityHeaders(res,publicURL.protocol==='https:');
    try {
      if (req.headers.host !== publicURL.host) fail(403,'Invalid host.');
      const url = new URL(req.url,origin);
      const mutating = !['GET','HEAD'].includes(req.method);
      if (mutating && req.headers.origin !== origin) fail(403,'Invalid origin.');
      if (req.headers['sec-fetch-site'] === 'cross-site') fail(403,'Use Folio directly.');
      const issueSession = user => {
        const id=token(),csrf=token(),now=Date.now();
        db.prepare('DELETE FROM user_sessions WHERE expires < ?').run(now);
        // Bound authenticated session growth while retaining normal multi-device use.
        db.prepare('DELETE FROM user_sessions WHERE user_id=? AND id NOT IN (SELECT id FROM user_sessions WHERE user_id=? ORDER BY expires DESC,rowid DESC LIMIT 19)').run(user.id,user.id);
        db.prepare('INSERT INTO user_sessions VALUES (?,?,?,?)').run(digest(id),user.id,csrf,now+7*86400000);
        res.setHeader('Set-Cookie',cookie(id,7*86400));return {csrf,user:publicUser(user),aiConfigured:classifier.enabled===true};
      };
      if (['/api/login','/api/register'].includes(url.pathname) && req.method === 'POST') {
        const now=Date.now();
        // Forwarded addresses are accepted only in explicit, private-proxy mode.
        // Caddy overwrites this dedicated header with its actual connecting client.
        const forwarded=req.headers['x-folio-client-ip'];
        const address=trustedProxy&&typeof forwarded==='string'&&isIP(forwarded)?forwarded:req.socket.remoteAddress;
        const key='ip:'+address;
        attemptLimit(key,now);
        // Never hold a global login lock while waiting for an untrusted upload.
        const data=await readJSON(req);
        if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Invalid account details.');
        const name=typeof data.username==='string'?data.username.trim().toLowerCase():ownerName;
        const accountKey='account:'+digest(name);
        if(url.pathname==='/api/login')attemptLimit(accountKey,Date.now());
        if (url.pathname==='/api/register'){
          const name=username(data.username);
          if(typeof data.invitation!=='string'||! /^[a-f0-9]{64}$/.test(data.invitation))fail(400,'A valid invitation is required.');
          const invite=db.prepare('SELECT * FROM invitations WHERE token_hash=? AND expires>?').get(digest(data.invitation),now);
          if(!invite)fail(400,'This invitation is invalid, expired, or revoked.');
          if(db.prepare('SELECT id FROM users WHERE username=?').get(name))fail(409,'This username is already taken.');
          if(db.prepare('SELECT count(*) AS n FROM users').get().n>=1000)fail(409,'The server account limit has been reached.');
          let newHash;try{newHash=passwordHash(data.password)}catch(err){fail(400,err.message)}
          const user=transaction(()=>{
            if(!db.prepare('SELECT id FROM invitations WHERE id=? AND expires>?').get(invite.id,Date.now()))fail(400,'This invitation is no longer valid.');
            const result=db.prepare("INSERT INTO users(username,password_hash,role,created) VALUES (?,?,'member',?)").run(name,newHash,now);
            db.prepare('INSERT INTO user_libraries VALUES (?,0,?)').run(result.lastInsertRowid,JSON.stringify(createStarterLibrary()));
            return db.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid);
          });
          attempts.delete(key);reply(res,201,issueSession(user));return;
        }
        const user=db.prepare('SELECT * FROM users WHERE username=? AND enabled=1').get(name);
        // Dummy check keeps an unknown username on the same password-check path.
        const correct=typeof data.password==='string'&&data.password.length<=1024&&checkPassword(data.password,user?.password_hash||hash);
        if(!user||!correct)fail(401,'Incorrect username or password.');
        attempts.delete(key);attempts.delete(accountKey);reply(res,200,issueSession(user));
        return;
      }
      const raw=req.headers.cookie?.match(/(?:^|;\s*)folio_session=([a-f0-9]{64})(?:;|$)/)?.[1];
      const session=raw ? db.prepare('SELECT s.* FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires>? AND u.enabled=1').get(digest(raw),Date.now()) : null;
      if (url.pathname.startsWith('/api/')) {
        if (!session) fail(401,'Sign in to your library.');
        const user=db.prepare('SELECT * FROM users WHERE id=?').get(session.user_id);
        if(req.headers['x-folio-user']&&req.headers['x-folio-user']!==String(user.id)){reply(res,409,{error:'The signed-in account changed. Sign in again to continue.',accountChanged:true});return;}
        if (mutating && req.headers['x-csrf-token'] !== session.csrf) fail(403,'Invalid session token.');
        const requireCurrentSession=()=>{
          if(!db.prepare('SELECT s.id FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.user_id=? AND s.expires>? AND u.enabled=1').get(session.id,user.id,Date.now()))fail(401,'Sign in to your library.');
        };
        const readAuthenticatedJSON=async(maxSize)=>{const data=await readJSON(req,maxSize);requireCurrentSession();return data};
        if (url.pathname === '/api/session' && req.method === 'GET') { reply(res,200,{csrf:session.csrf,user:publicUser(user),aiConfigured:classifier.enabled===true});return; }
        if (url.pathname === '/api/logout' && req.method === 'POST') { db.prepare('DELETE FROM user_sessions WHERE id=?').run(session.id);res.setHeader('Set-Cookie',cookie('',0));reply(res,200,{ok:true});return; }
        if (url.pathname === '/api/library' && req.method === 'GET') { reply(res,200,snapshot(user));return; }
        if (url.pathname === '/api/library' && req.method === 'PUT') {
          const data=validate(await readAuthenticatedJSON(10*1024*1024));
          if (!Number.isSafeInteger(data.revision) || data.revision<0) fail(400,'Invalid revision.');
          const changed=transaction(()=>{
            const previous=db.prepare('SELECT revision,data FROM user_libraries WHERE user_id=?').get(user.id);
            if(previous.revision!==data.revision)return false;
            const ids=new Set(JSON.parse(previous.data).papers.map(p=>p.id));
            const added=data.papers.filter(p=>!ids.has(p.id)&&p.sample!==true).length;
            db.prepare('UPDATE user_libraries SET data=?,revision=revision+1 WHERE user_id=? AND revision=?').run(JSON.stringify({papers:data.papers,settings:data.settings}),user.id,data.revision);
            if(added){
              const day=new Date().toISOString().slice(0,10),cutoff=new Date(Date.now()-89*86400000).toISOString().slice(0,10);
              db.prepare('DELETE FROM paper_activity WHERE day<?').run(cutoff);
              db.prepare('INSERT INTO paper_activity VALUES (?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET papers_added=papers_added+excluded.papers_added').run(user.id,day,added);
            }
            return true;
          });
          if (!changed) { reply(res,409,{error:'Your library changed on another device. The latest library was loaded; review and retry your edit.',library:snapshot(user)});return; }
          reply(res,200,snapshot(user));return;
        }
        if(url.pathname==='/api/ai'&&req.method==='GET'){reply(res,200,{configured:classifier.enabled===true,dailyLimit:aiUserDailyLimit});return;}
        if(url.pathname==='/api/classify'&&req.method==='POST'){
          if(!classifier.enabled)fail(503,'The owner must configure an OpenAI API key on the server first.');
          const data=await readAuthenticatedJSON(100000),library=snapshot(user);
          if(!library.settings.autoCollections)fail(403,'Enable automatic collections in Settings first.');
          if(typeof data?.title!=='string'||data.title.length>500||typeof data.abstract!=='string'||!data.abstract.trim()||data.abstract.length>20000)fail(400,'Add an abstract of at most 20,000 characters first.');
          if(data.revision!==library.revision){reply(res,409,{error:'Your library changed. Review the latest library and try again.',library});return;}
          if(aiPending.has(user.id)||aiPending.size>=2)fail(429,'A classification is already running. Try again shortly.');
          const collections=[...new Set([...(library.settings.collections||[]),...library.papers.flatMap(p=>p.tags||[])])];
          if(collections.length>1000)fail(400,'Too many collection names for automatic tagging.');
          const day=new Date().toISOString().slice(0,10);
          transaction(()=>{
            const used=db.prepare('SELECT count FROM ai_usage WHERE user_id=? AND day=?').get(user.id,day)?.count||0;
            const total=db.prepare('SELECT coalesce(sum(count),0) n FROM ai_usage WHERE day=?').get(day).n;
            if(used>=aiUserDailyLimit||total>=aiDailyLimit)fail(429,'The daily automatic collection limit has been reached.');
            db.prepare('DELETE FROM ai_usage WHERE day<?').run(new Date(Date.now()-89*86400000).toISOString().slice(0,10));
            db.prepare('INSERT INTO ai_usage VALUES (?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET count=count+1').run(user.id,day);
          });
          aiPending.add(user.id);
          try{
            const allowNew=library.settings.autoCreateCollections!==false;
            let tags;try{tags=normalizeSuggestions(await classifier({title:data.title,abstract:data.abstract,collections,instructions:library.settings.collectionInstructions||'',allowNew}),collections,{allowNew})}catch{fail(502,'Automatic tagging failed. You can save the paper and choose tags manually.');}
            if(!db.prepare('SELECT id FROM user_sessions WHERE id=? AND expires>?').get(session.id,Date.now())||!db.prepare('SELECT enabled FROM users WHERE id=?').get(user.id)?.enabled)fail(401,'Sign in to your library.');
            const latest=snapshot(user);if(latest.revision!==library.revision){reply(res,409,{error:'Your library changed during classification. Review and try again.',library:latest});return;}
            reply(res,200,{tags});return;
          }finally{aiPending.delete(user.id)}
        }
        if(url.pathname==='/api/password'&&req.method==='POST'){
          const now=Date.now(),key='password:'+user.id;
          const limit=attempts.get(key)||{count:0,until:now+15*60*1000};
          if(limit.until<now){limit.count=0;limit.until=now+15*60*1000}
          if(limit.count>=10)fail(429,'Too many password attempts. Try again in 15 minutes.');
          limit.count++;attempts.set(key,limit);
          const data=await readAuthenticatedJSON();
          if(!data||typeof data!=='object')fail(400,'Invalid password details.');
          if(typeof data.currentPassword!=='string'||data.currentPassword.length>1024||!checkPassword(data.currentPassword,user.password_hash))fail(401,'Incorrect current password.');
          let newHash;try{newHash=passwordHash(data.password)}catch(err){fail(400,err.message)}
          transaction(()=>{db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(newHash,user.id);db.prepare('DELETE FROM user_sessions WHERE user_id=?').run(user.id)});
          attempts.delete(key);reply(res,200,issueSession(user));return;
        }
        if(url.pathname.startsWith('/api/admin/')){
          if(user.role!=='owner')fail(403,'Only the owner can manage accounts.');
          if(url.pathname==='/api/admin/activity'&&req.method==='GET'){
            const period=url.searchParams.get('days')||'30';
            if(!['7','30','90'].includes(period)||url.searchParams.getAll('days').length>1||[...url.searchParams.keys()].some(key=>key!=='days'))fail(400,'Choose a 7, 30 or 90 day activity period.');
            const days=Number(period),now=Date.now(),to=new Date(now).toISOString().slice(0,10),from=new Date(now-(days-1)*86400000).toISOString().slice(0,10);
            // Only aggregate counts are selected; libraries and credentials never enter this response.
            const accounts=db.prepare(`SELECT u.id,u.username,u.role,u.enabled,
              (SELECT count(*) FROM json_each(l.data,'$.papers') p WHERE coalesce(json_extract(p.value,'$.sample'),0)!=1) AS paperCount
              FROM users u JOIN user_libraries l ON l.user_id=u.id ORDER BY u.id`).all();
            const daily=new Map(accounts.map(account=>[account.id,new Map()]));
            for(const row of db.prepare('SELECT user_id,day,papers_added FROM paper_activity WHERE day>=? AND day<=?').all(from,to)){
              daily.get(row.user_id)?.set(row.day,{day:row.day,papersAdded:row.papers_added,aiRequests:0});
            }
            for(const row of db.prepare('SELECT user_id,day,count FROM ai_usage WHERE day>=? AND day<=?').all(from,to)){
              const entries=daily.get(row.user_id);if(!entries)continue;
              const entry=entries.get(row.day)||{day:row.day,papersAdded:0,aiRequests:0};entry.aiRequests=row.count;entries.set(row.day,entry);
            }
            reply(res,200,{totalAccounts:accounts.length,enabledAccounts:accounts.filter(account=>account.enabled).length,timezone:'UTC',days,from,to,
              trackingStartedAt:db.prepare('SELECT value FROM activity_metadata WHERE key=?').get('started_at').value,
              accounts:accounts.map(account=>({...account,daily:[...daily.get(account.id).values()].sort((a,b)=>a.day.localeCompare(b.day))}))});return;
          }
          if(url.pathname==='/api/admin/users'&&req.method==='GET'){
            reply(res,200,{users:db.prepare('SELECT id,username,role,enabled,created FROM users ORDER BY id').all()});return;
          }
          if(url.pathname==='/api/admin/invitations'&&req.method==='GET'){
            reply(res,200,{invitations:db.prepare('SELECT id,created,expires FROM invitations WHERE expires>? ORDER BY created DESC').all(Date.now())});return;
          }
          if(url.pathname==='/api/admin/invitations'&&req.method==='POST'){
            const now=Date.now();db.prepare('DELETE FROM invitations WHERE expires<=?').run(now);
            if(db.prepare('SELECT count(*) AS n FROM invitations').get().n>=50)fail(409,'Revoke an invitation before creating another.');
            const secret=token(),id=token(),expires=now+7*86400000;
            db.prepare('INSERT INTO invitations VALUES (?,?,?,?,?)').run(id,digest(secret),user.id,expires,now);
            reply(res,201,{id,expires,url:origin+'/#invite='+secret});return;
          }
          const inviteID=url.pathname.match(/^\/api\/admin\/invitations\/([a-f0-9]{64})$/)?.[1];
          if(inviteID&&req.method==='DELETE') {db.prepare('DELETE FROM invitations WHERE id=?').run(inviteID);reply(res,200,{ok:true});return;}
          const accountID=url.pathname.match(/^\/api\/admin\/users\/([1-9]\d*)$/)?.[1];
          if(accountID&&req.method==='PATCH'){
            const data=await readAuthenticatedJSON();if(typeof data.enabled!=='boolean')fail(400,'Specify whether the account is enabled.');
            const target=db.prepare('SELECT * FROM users WHERE id=?').get(accountID);
            if(!target)fail(404,'Account not found.');if(target.role==='owner')fail(400,'The owner account cannot be disabled.');
            transaction(()=>{db.prepare('UPDATE users SET enabled=? WHERE id=?').run(Number(data.enabled),target.id);db.prepare('DELETE FROM user_sessions WHERE user_id=?').run(target.id)});
            reply(res,200,{ok:true});return;
          }
          fail(404,'Not found.');
        }
        if (['/api/eprint','/api/arxiv'].includes(url.pathname) && req.method === 'GET') {
          // Reuse the constrained publisher lookup without starting another listener.
          metadata.emit('request',req,res);return;
        }
        fail(404,'Not found.');
      }
      if (!['GET','HEAD'].includes(req.method)) fail(405,'Use GET.');
      if (url.pathname === '/config.js') { res.writeHead(200,{'Content-Type':'text/javascript'});res.end('window.FOLIO_REMOTE = true;');return; }
      const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
      if (!assets.has(name)) fail(404,'Not found.');
      res.setHeader('Content-Type',{'index.html':'text/html; charset=utf-8','app.js':'text/javascript; charset=utf-8','starter-papers.js':'text/javascript; charset=utf-8','venue-ranks.js':'text/javascript; charset=utf-8','importance.js':'text/javascript; charset=utf-8','style.css':'text/css; charset=utf-8'}[name]);
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
  const server=createApp({origin:process.env.APP_ORIGIN,hash:process.env.FOLIO_PASSWORD_HASH,ownerName:process.env.FOLIO_OWNER_USERNAME || 'owner',trustedProxy:process.env.TRUST_FOLIO_PROXY==='1',classifier:createClassifier({apiKey:process.env.OPENAI_API_KEY||'',model:process.env.OPENAI_MODEL||'gpt-4.1-mini'}),aiDailyLimit:Number(process.env.AI_DAILY_LIMIT||100),aiUserDailyLimit:Number(process.env.AI_USER_DAILY_LIMIT||20),dbPath:process.env.DB_PATH || './.runtime/folio.sqlite',allowHttp:process.env.ALLOW_LOCAL_HTTP==='1'});
  server.listen(Number(process.env.PORT || 3000),process.env.BIND || '127.0.0.1',()=>console.log('Folio server ready.'));
  for (const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>server.close());
}
