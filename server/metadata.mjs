import http from 'node:http';
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

export function parseCitation(html, id) {
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
  const title = first('citation_title').slice(0,500);
  if (!title) throw new Error('TCHES did not return citation details. Enter them manually or use the DOI.');
  const doi = first('citation_doi');
  return {
    title, authors:(fields.get('citation_author') || []).slice(0,100).join('; ').slice(0,5000),
    year:Number((first('citation_date') || first('citation_publication_date')).match(/\b\d{4}\b/)?.[0]) || '',
    venue:first('citation_journal_title').slice(0,1000),
    doi:/^10\.\d{4,9}\/\S{1,2000}$/i.test(doi) ? doi : '',
    url:'https://tches.iacr.org/index.php/TCHES/article/view/'+id,
    metadataSource:'TCHES', type:'journal-article'
  };
}

export function fetchArticle(id) {
  return new Promise((resolve,reject) => {
    // The only upstream is this fixed HTTPS publisher path. Never follow redirects.
    const req = https.get('https://tches.iacr.org/index.php/TCHES/article/view/'+id, {
      signal:AbortSignal.timeout(15000),
      headers:{'User-Agent':'Folio/1.0 (personal citation lookup)', Accept:'text/html', 'Accept-Encoding':'identity'}
    }, res => {
      if (res.statusCode !== 200 || !/^text\/html\b/i.test(res.headers['content-type'] || '')) {
        res.resume();
        reject(new Error('TCHES is unavailable. Try again or enter the citation manually.'));
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

export function createMetadataServer(loadArticle = fetchArticle) {
  const cache = new Map(), pending = new Map();
  let windowStart = Date.now(), lookups = 0;
  const reply = (res, status, data) => {
    res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff', ...(status===429 ? {'Retry-After':'60'} : {})});
    res.end(JSON.stringify(data));
  };
  const server = http.createServer({maxHeaderSize:8192,requestTimeout:20000,headersTimeout:10000,keepAliveTimeout:3000}, async (req,res) => {
    try {
      if (req.method !== 'GET') { res.setHeader('Connection','close'); reply(res,405,{error:'Use GET.'}); return; }
      if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== 'https://'+req.headers.host)) {
        reply(res,403,{error:'Use the lookup from Folio.'}); return;
      }
      const url = new URL(req.url,'http://localhost');
      if (url.pathname === '/api/health' && !url.search) { reply(res,200,{service:'folio-metadata'}); return; }
      const id = url.searchParams.get('id');
      if (url.pathname !== '/api/tches') { reply(res,404,{error:'Not found.'}); return; }
      if (!/^[1-9]\d{0,9}$/.test(id || '') || [...url.searchParams.keys()].some(k=>k!=='id') || url.searchParams.getAll('id').length!==1) {
        reply(res,400,{error:'Enter a valid TCHES article link.'}); return;
      }
      const cached = cache.get(id);
      if (cached && cached.expires > Date.now()) { reply(res,200,cached.data); return; }
      if (!pending.has(id)) {
        if (Date.now()-windowStart >= 60000) { windowStart=Date.now(); lookups=0; }
        if (lookups>=20 || pending.size>=2) { reply(res,429,{error:'Too many lookups. Try again shortly.'}); return; }
        lookups++;
        const work = (async () => {
          const data = parseCitation(await loadArticle(id),id);
          if (cache.size>=128) cache.delete(cache.keys().next().value);
          cache.set(id,{data,expires:Date.now()+6*60*60*1000});
          return data;
        })();
        pending.set(id,work);
      }
      const work = pending.get(id);
      try { reply(res,200,await work); }
      finally { if (pending.get(id)===work) pending.delete(id); }
    } catch {
      reply(res,502,{error:'TCHES lookup failed. Try again, paste the DOI, or enter details manually.'});
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
