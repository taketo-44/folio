import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import http from 'node:http';
import { createApp, passwordHash } from '../server/app.mjs';
import { createMetadataServer } from '../server/metadata.mjs';

const dir=mkdtempSync(join(tmpdir(),'folio-server-test-'));
const hash=passwordHash('test password at least sixteen');
let server,origin,cookie,csrf;
async function open(port=0){
  // Obtain an ephemeral port without changing the production origin validation.
  const net=await import('node:net');const probe=net.createServer();probe.listen(port,'127.0.0.1');await once(probe,'listening');port=probe.address().port;await new Promise(r=>probe.close(r));
  origin='http://127.0.0.1:'+port;
  server=createApp({origin,hash,dbPath:join(dir,'data.sqlite'),allowHttp:true,metadata:createMetadataServer(async()=>'<meta name="citation_title" content="Test article">',origin)});
  server.listen(port,'127.0.0.1');await once(server,'listening');return port;
}
const close=()=>new Promise(resolve=>server.close(resolve));
const request=(path,options={})=>fetch(origin+path,{...options,headers:{Connection:'close',Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...options.headers}});
try{
  const port=await open();
  assert.equal((await request('/api/library')).status,401);
  assert.equal((await request('/api/eprint?id=2006/139')).status,401);
  assert.equal((await request('/api/login',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'})).status,403);
  assert.equal((await request('/api/login',{method:'POST',body:JSON.stringify({password:'wrong'})})).status,401);
  const login=await request('/api/login',{method:'POST',body:JSON.stringify({password:'test password at least sixteen'})});
  assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  cookie=login.headers.get('set-cookie').split(';')[0];csrf=(await login.json()).csrf;
  const initial=await (await request('/api/library')).json();assert.deepEqual(initial.papers,[]);
  const paper={id:'p1',title:'A paper',authors:'An Author',tags:['Cryptography'],status:'unread',importance:'high',notes:'My notes',drivePdfId:'drive-file-1',pdfId:'device-cache',added:1,updated:1};
  const payload={revision:0,papers:[paper],settings:{collections:['Cryptography'],clientId:'123.apps.googleusercontent.com'}};
  assert.equal((await request('/api/library',{method:'PUT',headers:{'X-CSRF-Token':'bad'},body:JSON.stringify(payload)})).status,403);
  const saved=await request('/api/library',{method:'PUT',body:JSON.stringify(payload)});assert.equal(saved.status,200);
  const data=await saved.json();assert.equal(data.revision,1);assert.equal(data.papers[0].drivePdfId,'drive-file-1');assert.equal(data.papers[0].pdfId,undefined);
  const conflict=await request('/api/library',{method:'PUT',body:JSON.stringify({...payload,papers:[]})});assert.equal(conflict.status,409);assert.equal((await conflict.json()).library.papers.length,1);
  assert.equal((await request('/api/library',{method:'PUT',body:JSON.stringify({...payload,revision:1,papers:[{...paper,title:''}]})})).status,400);
  assert.equal((await request('/api/library',{method:'PUT',body:JSON.stringify({...payload,revision:1,papers:[{...paper,url:'javascript:alert(1)'}]})})).status,400);
  assert.equal((await request('/api/library',{method:'PUT',body:JSON.stringify({...payload,revision:1,papers:[paper,paper]})})).status,400);
  assert.equal((await request('/api/tches?id=12')).status,200);
  assert.equal((await request('/api/eprint?id=2006/139')).status,200);
  assert.equal((await request('/api/eprint?id=../139')).status,400);
  assert.match(await (await request('/config.js')).text(),/FOLIO_REMOTE = true/);
  for(const path of ['/.env','/server/app.mjs','/.runtime/folio.sqlite','/README.md'])assert.equal((await request(path)).status,404);
  const badHost=await new Promise((resolve,reject)=>{const r=http.get(origin+'/',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode)});r.on('error',reject)});assert.equal(badHost,403);
  await close();await open(port);
  const restored=await(await request('/api/library')).json();assert.equal(restored.papers[0].notes,'My notes');assert.equal(restored.revision,1);
  assert.equal((await request('/api/logout',{method:'POST',body:'{}'})).status,200);
  assert.equal((await request('/api/library')).status,401);
  for(let i=0;i<10;i++)assert.equal((await request('/api/login',{method:'POST',body:'{"password":"bad"}'})).status,401);
  assert.equal((await request('/api/login',{method:'POST',body:'{"password":"bad"}'})).status,429);
  console.log('Passed: authentication, CSRF/origin guards, persistence, conflict rejection, validation, logout, and login limits.');
}finally{if(server?.listening)await close();rmSync(dir,{recursive:true,force:true})}
