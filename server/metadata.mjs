import http from 'node:http';
import {isArxivId,parseArxiv} from './arxiv.mjs';
import https from 'node:https';
import { pathToFileURL } from 'node:url';

function decodeEntities(value) {
  const named = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'\u2013',mdash:'\u2014'};
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|ndash|mdash);/gi, (original, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? original;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2),16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : original;
  });
}

export function parseCitation(html, id, source = 'eprint') {
  if(source==='arxiv')return parseArxiv(html,id);
  if(source!=='eprint')throw new Error('Unsupported citation source. Use the paper DOI instead.');
  const fields = new Map();
  for (const tag of html.match(/<meta\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi) || []) {
    const attrs = {};
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3]);
    }
    const name = (attrs.name || '').toLowerCase();
    if (name.startsWith('citation_') && attrs.content) {
      if (!fields.has(name)) fields.set(name, []);
      fields.get(name).push(attrs.content.trim());
    }
  }
  const first = name => fields.get(name)?.[0] || '';
  const venue=first('citation_journal_title')||first('citation_conference_title');
  const title = first('citation_title').slice(0,500);
  if (!title) throw new Error('IACR ePrint'+' did not return citation details. Enter them manually or use the DOI.');
  const doi = first('citation_doi');
  return {
    title, authors:(fields.get('citation_author') || []).slice(0,100).join('; ').slice(0,5000),
    year:Number((first('citation_date') || first('citation_publication_date')).match(/\b\d{4}\b/)?.[0]) || '',
    venue:venue.slice(0,1000),
    abstract:decodeEntities((first('citation_abstract')||html.match(/<h[1-6][^>]*>\s*Abstract\s*<\/h[1-6]>\s*<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim().slice(0,20000),
    doi:/^10\.\d{4,9}\/\S{1,2000}$/i.test(doi) ? doi : '',
    url:'https://eprint.iacr.org/'+id,
    metadataSource:'IACR ePrint', type:'posted-content'
  };
}

export function fetchArticle(id, source = 'eprint') {
  const valid=source==='arxiv'?isArxivId(id):source==='eprint'&&/^(?:19|20)\d{2}\/(?!0+$)\d{1,10}$/.test(id);
  if(!valid)return Promise.reject(new Error('Invalid publisher paper identifier.'));
  const url=source==='arxiv'?'https://export.arxiv.org/api/query?id_list='+encodeURIComponent(id):'https://eprint.iacr.org/'+id;
  return new Promise((resolve,reject) => {
    // The only upstream is this fixed HTTPS publisher path. Never follow redirects.
    const req = https.get(url, {
      signal:AbortSignal.timeout(15000),
      headers:{'User-Agent':'Folio/1.0 (personal citation lookup)', Accept:source==='arxiv'?'application/atom+xml':'text/html', 'Accept-Encoding':'identity'}
    }, res => {
      if (res.statusCode !== 200 || !(source==='arxiv'?/^(?:application\/(?:atom\+xml|xml)|text\/xml)\b/i:/^text\/html\b/i).test(res.headers['content-type'] || '')) {
        res.resume();
        reject(new Error('Publisher is unavailable. Try again or enter the citation manually.'));
        return;
      }
      const chunks = [];
      let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > 512*1024) req.destroy(new Error('Publisher response is too large.'));
        else chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

export function createMetadataServer(loadArticle = fetchArticle, allowedOrigin) {
  const cache = new Map(), pending = new Map();
  let windowStart = Date.now(), lookups = 0, lastArxiv=0;
  const reply = (res, status, data, retryAfter=60) => {
    res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff', ...(status===429 ? {'Retry-After':String(retryAfter)} : {})});
    res.end(JSON.stringify(data));
  };
  const server = http.createServer({maxHeaderSize:8192,requestTimeout:20000,headersTimeout:10000,keepAliveTimeout:3000}, async (req,res) => {
    try {
      if (req.method !== 'GET') { res.setHeader('Connection','close'); reply(res,405,{error:'Use GET.'}); return; }
      if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== (allowedOrigin || 'https://'+req.headers.host))) {
        reply(res,403,{error:'Use the lookup from Folio.'}); return;
      }
      const url = new URL(req.url,'http://localhost');
      if (url.pathname === '/api/health' && !url.search) { reply(res,200,{service:'folio-metadata'}); return; }
      const id = url.searchParams.get('id');
      if (!['/api/eprint','/api/arxiv'].includes(url.pathname)) { reply(res,404,{error:'Not found.'}); return; }
      const source=url.pathname==='/api/arxiv'?'arxiv':'eprint';
      const valid=source==='arxiv'?isArxivId(id):/^(?:19|20)\d{2}\/(?!0+$)\d{1,10}$/.test(id || '');
      if (!valid || [...url.searchParams.keys()].some(k=>k!=='id') || url.searchParams.getAll('id').length!==1) {
        reply(res,400,{error:'Enter a valid '+(source==='arxiv'?'arXiv':'IACR ePrint')+' paper link.'}); return;
      }
      const cacheKey=source+':'+id;
      const cached = cache.get(cacheKey);
      if (cached && cached.expires > Date.now()) { reply(res,200,cached.data); return; }
      if (!pending.has(cacheKey)) {
        if(source==='arxiv'&&Date.now()-lastArxiv<3000){reply(res,429,{error:'Please wait three seconds between new arXiv lookups.'},3);return;}
        if (Date.now()-windowStart >= 60000) { windowStart=Date.now(); lookups=0; }
        if (lookups>=20 || pending.size>=2) { reply(res,429,{error:'Too many lookups. Try again shortly.'}); return; }
        lookups++;if(source==='arxiv')lastArxiv=Date.now();
        const work = (async () => {
          const data = parseCitation(await loadArticle(id,source),id,source);
          if (cache.size>=128) cache.delete(cache.keys().next().value);
          cache.set(cacheKey,{data,expires:Date.now()+6*60*60*1000});
          return data;
        })();
        pending.set(cacheKey,work);
      }
      const work = pending.get(cacheKey);
      try { reply(res,200,await work); }
      finally { if (pending.get(cacheKey)===work) pending.delete(cacheKey); }
    } catch {
      reply(res,502,{error:'Publisher lookup failed. Try again, paste the DOI, or enter details manually.'});
    }
  });
  server.maxConnections=16;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2] || 4174);
  if (!Number.isInteger(port) || port<1024 || port>65535) throw new Error('Invalid port.');
  createMetadataServer().listen(port,'127.0.0.1',()=>console.log('Folio metadata: 127.0.0.1:'+port));
}
