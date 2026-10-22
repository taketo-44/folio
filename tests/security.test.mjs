// Local adversarial tests. Every instance binds loopback and uses a disposable database.
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createApp,passwordHash} from '../server/app.mjs';
import {resetPassword} from '../server/reset-password.mjs';
import {securityHeaders} from '../server/http-security.mjs';

const password='temporary security test password';
const replacement='replacement security test password';
const memberPassword='private member security password';
async function withApp(options,run){
 const dir=mkdtempSync(join(tmpdir(),'folio-security-')),dbPath=join(dir,'test.sqlite');
 const probe=net.createServer().listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
 const origin='http://127.0.0.1:'+port;
 const server=createApp({origin,hash:passwordHash(password),dbPath,allowHttp:true,...options});server.listen(port,'127.0.0.1');await once(server,'listening');
 const request=(path,{method='GET',data,auth={},headers={}}={})=>fetch(origin+path,{method,headers:{Connection:'close',Origin:origin,'Content-Type':'application/json',...auth,...headers},...(data===undefined?{}:{body:JSON.stringify(data)})});
 const login=async(username='owner',secret=password,headers={})=>{const res=await request('/api/login',{method:'POST',data:{username,password:secret},headers});assert.equal(res.status,200);const data=await res.json();return {Cookie:res.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':data.csrf}};
 const slow=async(path,data,auth={},method='POST')=>{
  const body=Buffer.from(JSON.stringify(data));let resolveSeen;const seen=new Promise(r=>resolveSeen=r);
  const watch=req=>{if(req.url===path){server.off('request',watch);resolveSeen()}};server.on('request',watch);
  let resolveResult;const result=new Promise(r=>resolveResult=r);
  const req=http.request(origin+path,{method,headers:{Connection:'close',Origin:origin,'Content-Type':'application/json','Content-Length':body.length,...auth}},res=>{const chunks=[];res.on('data',d=>chunks.push(d));res.on('end',()=>resolveResult({status:res.statusCode,body:Buffer.concat(chunks).toString()}))});
  req.on('error',()=>resolveResult({status:'aborted'}));req.write(body.subarray(0,-1));await seen;
  return {req,result,finish(){req.end(body.subarray(-1));return result}};
 };
 try{await run({request,login,slow,dbPath,server,origin})}finally{server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true})}
}

await withApp({},async({request,login,slow,dbPath})=>{
 const pending=await slow('/api/login',{username:'owner',password});
 const auth=await login();pending.req.destroy();await pending.result;
 const before=await(await request('/api/library',{auth})).json();
 const writing=await slow('/api/library',{revision:before.revision,papers:[],settings:{}},auth,'PUT');
 assert.equal((await request('/api/logout',{method:'POST',data:{},auth})).status,200);
 assert.equal((await writing.finish()).status,401,'logout must cancel previously authorized uploads');
 const fresh=await login();const after=await(await request('/api/library',{auth:fresh})).json();assert.equal(after.revision,before.revision);assert.deepEqual(after.papers,before.papers);
 const pendingPassword=await slow('/api/password',{currentPassword:password,password:'attacker chosen replacement password'},fresh);
 resetPassword(dbPath,'owner',replacement);
 assert.equal((await pendingPassword.finish()).status,401,'recovery must block a delayed password rollback');
 await login('owner',replacement);
 console.log('Security: incomplete-login denial and writes/password changes after revocation are blocked.');
});

await withApp({},async({request,login,slow,dbPath})=>{
 const owner=await login();const invite=await(await request('/api/admin/invitations',{method:'POST',data:{},auth:owner})).json();
 const reg=await request('/api/register',{method:'POST',data:{username:'member',password:memberPassword,invitation:new URL(invite.url).hash.slice(8)}});assert.equal(reg.status,201);
 const memberData=await reg.json();const member={Cookie:reg.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':memberData.csrf};
 const library=await(await request('/api/library',{auth:member})).json();
 const writing=await slow('/api/library',{revision:library.revision,papers:[],settings:{}},member,'PUT');
 assert.equal((await request('/api/admin/users/'+memberData.user.id,{method:'PATCH',data:{enabled:false},auth:owner})).status,200);
 assert.equal((await writing.finish()).status,401,'disabled accounts must not complete outstanding writes');
 const db=new DatabaseSync(dbPath);assert.equal(db.prepare('SELECT revision FROM user_libraries WHERE user_id=?').get(memberData.user.id).revision,library.revision);db.close();
 const admin=await slow('/api/admin/users/'+memberData.user.id,{enabled:true},owner,'PATCH');
 resetPassword(dbPath,'owner',replacement);
 assert.equal((await admin.finish()).status,401,'revoked owner sessions must not complete administrator actions');
 const fresh=await login('owner',replacement);const users=await(await request('/api/admin/users',{auth:fresh})).json();assert.equal(users.users.find(u=>u.id===memberData.user.id).enabled,0);
 console.log('Security: disabled members and revoked administrators cannot complete buffered actions.');
});

let classifications=0;
const classifier=Object.assign(async()=>{classifications++;return []},{enabled:true});
await withApp({classifier},async({request,login,slow})=>{
 const auth=await login();const library=await(await request('/api/library',{auth})).json();
 const updated=await(await request('/api/library',{method:'PUT',data:{...library,settings:{autoCollections:true}},auth})).json();
 const classify=await slow('/api/classify',{title:'Test',abstract:'Temporary local test abstract',revision:updated.revision},auth);
 await request('/api/logout',{method:'POST',data:{},auth});
 assert.equal((await classify.finish()).status,401);assert.equal(classifications,0,'revoked uploads must not consume paid provider calls');
 console.log('Security: revoked classification uploads cannot start provider requests.');
});

await withApp({},async({request,login,dbPath})=>{
 const owner=await login();const invitation=await(await request('/api/admin/invitations',{method:'POST',data:{},auth:owner})).json();
 assert.equal((await request('/api/register',{method:'POST',data:{username:'member',password:memberPassword,invitation:new URL(invitation.url).hash.slice(8)}})).status,201);
 for(let i=0;i<10;i++){
  const failed=await request('/api/login',{method:'POST',data:{username:'owner',password:'wrong'},headers:{'X-Forwarded-For':'192.0.2.'+(i+1),'X-Folio-Client-IP':'192.0.2.'+(i+1)}});assert.equal(failed.status,401);
  await login('member',memberPassword); // Resetting the IP bucket must not reset the victim's counter.
 }
 assert.equal((await request('/api/login',{method:'POST',data:{username:'owner',password:'wrong'}})).status,429);
 // Successful logins remain bounded in storage, and guessed/new cookies never grant access.
 for(let i=0;i<24;i++)await login('member',memberPassword);
 const db=new DatabaseSync(dbPath);assert.equal(db.prepare("SELECT count(*) n FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE u.username='member'").get().n,20);db.close();
 assert.equal((await request('/api/library',{headers:{Cookie:'folio_session='+'a'.repeat(64)}})).status,401);
 console.log('Security: a member cannot reset another account’s guessing limit; session growth is capped.');
});

await withApp({trustedProxy:true},async({request,login})=>{
 for(let i=0;i<10;i++)assert.equal((await request('/api/login',{method:'POST',data:{username:'missing-'+i,password:'wrong'},headers:{'X-Folio-Client-IP':'192.0.2.1'}})).status,401);
 assert.equal((await request('/api/login',{method:'POST',data:{username:'missing-again',password:'wrong'},headers:{'X-Folio-Client-IP':'192.0.2.1'}})).status,429);
 await login('owner',password,{'X-Folio-Client-IP':'192.0.2.2'});
 console.log('Security: trusted proxy clients have independent IP limits.');
});
await withApp({},async({request,login})=>{
 for(let i=0;i<10;i++)assert.equal((await request('/api/login',{method:'POST',data:{username:'missing-'+i,password:'wrong'},headers:{'X-Folio-Client-IP':'192.0.2.'+(i+1)}})).status,401);
 assert.equal((await request('/api/login',{method:'POST',data:{username:'missing-again',password:'wrong'},headers:{'X-Folio-Client-IP':'192.0.2.123'}})).status,429,'untrusted forwarding headers must not bypass IP limits');
 console.log('Security: public clients cannot spoof their rate-limit address.');
});

await withApp({},async({request,login})=>{
 const auth=await login();
 for(const path of ['/api/library','/api/password','/api/admin/users/2'])for(const data of [null,[],false])assert.equal((await request(path,{method:path==='/api/library'?'PUT':path.includes('/users/')?'PATCH':'POST',data,auth})).status,400);
 const before=await(await request('/api/library',{auth})).json();
 const invalid=await request('/api/library',{method:'PUT',data:{...before,papers:[{id:'attack',title:'Payload',status:'unread',importance:3,tags:[],url:'javascript:alert(1)'}]},auth});assert.equal(invalid.status,400);
 for(const headers of [{Origin:'https://attacker.invalid'},{'X-CSRF-Token':'guessed'},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await request('/api/library',{method:'PUT',data:{...before,papers:[]},auth,headers})).status,403);
 for(const path of ['/.env','/.git/config','/server/app.mjs','/.runtime/folio.sqlite','/%2e%2e/.env'])assert.equal((await request(path)).status,404);
 const page=await request('/');const csp=page.headers.get('content-security-policy');assert.match(csp,/script-src 'self'/);assert.doesNotMatch(csp,/script-src[^;]*unsafe-inline/);assert.match(csp,/base-uri 'none'/);assert.match(csp,/frame-ancestors 'none'/);
 assert.match(csp,/connect-src 'self' https:\/\/api.crossref.org/);
 assert.equal((await(await request('/api/library',{auth})).json()).revision,before.revision);
 console.log('Security: malformed bodies, script URLs, CSRF and private-file probes are rejected; CSP blocks injected scripts.');
});
const httpsHeaders=new Map();securityHeaders({setHeader:(name,value)=>httpsHeaders.set(name,value)},true);
assert.equal(httpsHeaders.get('Strict-Transport-Security'),'max-age=31536000');
