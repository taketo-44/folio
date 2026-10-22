// Local UI preview with the same bounded citation lookup as the hosted app.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createMetadataServer } from './metadata.mjs';

const port=Number(process.env.PORT || 4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid preview port.');
const origin='http://127.0.0.1:'+port;
const metadata=createMetadataServer(undefined,origin);
const types={'index.html':'text/html','app.js':'text/javascript','starter-papers.js':'text/javascript','venue-ranks.js':'text/javascript','importance.js':'text/javascript','config.js':'text/javascript','style.css':'text/css'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const url=new URL(req.url,origin);
  if(req.headers.host!=='127.0.0.1:'+port){res.writeHead(403);res.end('Use '+origin);return}
  if(['/api/eprint','/api/arxiv'].includes(url.pathname)){metadata.emit('request',req,res);return}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!Object.hasOwn(types,name)){res.writeHead(404,{'Content-Type':'application/json'});res.end('{"error":"Not found."}');return}
  try{
    const data=await readFile(new URL('../dist/'+name,import.meta.url));
    res.writeHead(200,{'Content-Type':types[name]+'; charset=utf-8'});res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(500);res.end('Preview file unavailable.')}
});
server.listen(port,'127.0.0.1',()=>console.log('Folio preview: '+origin));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>metadata.close()));
