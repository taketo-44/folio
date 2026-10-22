import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';

const probe=net.createServer().listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
const child=fork(new URL('../server/preview.mjs',import.meta.url),[],{silent:true,execArgv:[],env:{...process.env,PORT:String(port)}});
let errors='';child.stderr.on('data',d=>errors+=d);
const request=path=>new Promise((resolve,reject)=>{const req=http.get({hostname:'127.0.0.1',port,path,headers:{Connection:'close'}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,headers:res.headers}))});req.on('error',reject)});
try{
 await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw new Error('Preview failed: '+errors)})]);
 assert.equal((await request('http://[')).status,400,'malformed URLs must not terminate the preview process');
 const page=await request('/');assert.equal(page.status,200);assert.match(page.headers['content-security-policy'],/script-src 'self'/);
 assert.equal((await request('/.env')).status,404);assert.equal((await request('/server/app.mjs')).status,404);
 assert.equal(child.exitCode,null);console.log('Security: malformed URLs return 400 and the preview remains available.');
}finally{if(child.exitCode===null){child.kill();await once(child,'close')}}
