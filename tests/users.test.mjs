import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import net from 'node:net';
import {resetPassword} from '../server/reset-password.mjs';
import {createApp,passwordHash} from '../server/app.mjs';

const dir=mkdtempSync(join(tmpdir(),'folio-users-')),dbPath=join(dir,'library.sqlite');
const password='original owner password sixteen',memberPassword='private member password sixteen';
const hash=passwordHash(password);
const seed=new DatabaseSync(dbPath);
seed.exec('CREATE TABLE library(id INTEGER PRIMARY KEY,revision INTEGER,data TEXT);CREATE TABLE sessions(id TEXT PRIMARY KEY,csrf TEXT,expires INTEGER);');
const paper={id:'same-id',title:'Owner private paper',tags:['Owner tag'],status:'unread',importance:'normal',notes:'Owner notes',drivePdfId:'owner-drive'};
seed.prepare('INSERT INTO library VALUES (1,7,?)').run(JSON.stringify({papers:[paper],settings:{collections:['Owner tag'],clientId:'123.apps.googleusercontent.com'}}));
seed.prepare('INSERT INTO sessions VALUES (?,?,?)').run('a'.repeat(64),'legacy-token',Date.now()+86400000);seed.close();
let server,origin;
async function open(port=0,bootHash=hash){const probe=net.createServer();probe.listen(port,'127.0.0.1');await once(probe,'listening');port=probe.address().port;await new Promise(r=>probe.close(r));origin='http://127.0.0.1:'+port;server=createApp({origin,hash:bootHash,dbPath,allowHttp:true});server.listen(port,'127.0.0.1');await once(server,'listening');return port}
const close=()=>new Promise(r=>server.close(r));
const owner={},member={},other={};
async function request(client,path,method='GET',data,headers={}){return fetch(origin+path,{method,headers:{Connection:'close',Origin:origin,'Content-Type':'application/json',...(client.cookie?{Cookie:client.cookie}:{}),...(client.csrf?{'X-CSRF-Token':client.csrf}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})})}
async function login(client,username,password){const r=await request({},'/api/login','POST',{username,password});if(r.ok){client.cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();client.csrf=data.csrf;client.user=data.user}return r.status}
async function invite(){const r=await request(owner,'/api/admin/invitations','POST',{});assert.equal(r.status,201);const data=await r.json();return {...data,secret:new URL(data.url).hash.slice(8)}}
async function register(client,invitation,username,password=memberPassword){const r=await request({},'/api/register','POST',{invitation,username,password});if(r.ok){client.cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();client.csrf=data.csrf;client.user=data.user}return r.status}
async function library(client){const r=await request(client,'/api/library');assert.equal(r.status,200);return r.json()}
try{
 const port=await open();
 assert.equal(await login(owner,'OWNER',password),200);
 const migrated=await library(owner);assert.equal(migrated.revision,8);assert.equal(migrated.papers[0].notes,'Owner notes');assert.deepEqual(migrated.settings.collections,['Owner tag']);assert.equal(migrated.user.role,'owner');
 const inspection=new DatabaseSync(dbPath);assert.equal(inspection.prepare('SELECT count(*) n FROM sessions').get().n,0);assert.equal(inspection.prepare('PRAGMA user_version').get().user_version,3);
 assert.equal((await request({},'/api/admin/invitations','POST',{})).status,401);
 assert.equal((await request(owner,'/api/admin/invitations','POST',{}, {'X-CSRF-Token':'bad'})).status,403);
 assert.equal((await request(owner,'/api/admin/invitations','POST',{}, {Origin:'https://elsewhere.example'})).status,403);
 assert.equal(await register({},'b'.repeat(64),'alice'),400);
 const first=await invite();
 assert.equal(inspection.prepare('SELECT count(*) n FROM invitations WHERE token_hash=?').get(first.secret).n,0,'raw invite secret is not stored');
 assert.equal(await register({},first.secret,'alice','short'),400);
 assert.equal(await register(member,first.secret,'Alice'),201);
 assert.equal(member.user.username,'alice');assert.equal(member.user.role,'member');
 const reused={};assert.equal(await register(reused,first.secret,'repeat-user'),201,'one invitation supports multiple sign-ups');assert.deepEqual((await library(reused)).papers,[]);
 assert.equal((await request(owner,'/api/admin/invitations/'+first.id,'DELETE',{})).status,200);assert.equal(await register({},first.secret,'repeat-again'),400,'revocation stops future sign-ups');assert.equal((await request(reused,'/api/library')).status,200,'revocation preserves accounts already created');
 const empty=await library(member);assert.deepEqual(empty.papers,[]);assert.deepEqual(empty.settings,{});assert.equal(empty.revision,0);
 for(const path of ['/api/admin/users','/api/admin/invitations'])assert.equal((await request(member,path)).status,403);
 assert.equal((await request(member,'/api/admin/invitations','POST',{})).status,403);
 assert.equal((await request(owner,'/api/admin/users/'+owner.user.id,'PATCH',{enabled:false})).status,400);
 const second=await invite();assert.equal(await register({},second.secret,'alice'),409);assert.equal(await register(other,second.secret,'bob'),201);
 const memberPaper={...paper,title:'Alice private paper',tags:['Alice tag'],notes:'Alice notes',drivePdfId:'alice-drive'};
 const save=await request(member,'/api/library','PUT',{...empty,user_id:owner.user.id,papers:[memberPaper],settings:{collections:['Alice tag']}});assert.equal(save.status,200);
 assert.equal((await library(owner)).papers[0].notes,'Owner notes');assert.deepEqual((await library(other)).papers,[]);
 assert.equal((await library(member)).papers[0].drivePdfId,undefined);
 assert.equal((await request(member,'/api/library?user_id='+owner.user.id)).status,200);assert.equal((await (await request(member,'/api/library?user_id='+owner.user.id)).json()).papers[0].title,'Alice private paper');
 const stale=await request(member,'/api/library','PUT',{revision:0,papers:[],settings:{}});assert.equal(stale.status,409);const staleData=await stale.json();assert.equal(staleData.library.user.id,member.user.id);assert.equal(staleData.library.papers[0].notes,'Alice notes');
 const mismatch=await request(member,'/api/library','GET',undefined,{'X-Folio-User':String(owner.user.id)});assert.equal(mismatch.status,409);assert.equal((await mismatch.json()).accountChanged,true);
 // Independent optimistic revisions: an owner edit doesn't conflict with Alice's edit.
 assert.equal((await request(owner,'/api/library','PUT',{revision:8,papers:[paper],settings:migrated.settings})).status,200);
 assert.equal((await request(member,'/api/library','PUT',{revision:1,papers:[memberPaper],settings:{collections:['Alice tag']}})).status,200);
 const revoke=await invite();assert.equal((await request(owner,'/api/admin/invitations/'+revoke.id,'DELETE',{})).status,200);assert.equal(await register({},revoke.secret,'carol'),400);
 const expired=await invite();inspection.prepare('UPDATE invitations SET expires=? WHERE id=?').run(Date.now()-1,expired.id);assert.equal(await register({},expired.secret,'carol'),400);
 const pending=await invite();const listed=await (await request(owner,'/api/admin/invitations')).json();assert.ok(listed.invitations.some(i=>i.id===pending.id));assert.ok(!JSON.stringify(listed).includes(pending.secret));
 const users=await (await request(owner,'/api/admin/users')).json();assert.equal(users.users.length,4);assert.ok(!JSON.stringify(users).includes('password_hash'));
 assert.equal((await request(owner,'/api/admin/users/'+member.user.id,'PATCH',{enabled:false})).status,200);
 assert.equal((await request(member,'/api/library')).status,401);assert.equal(await login({},'alice',memberPassword),401);
 assert.equal((await request(owner,'/api/admin/users/'+member.user.id,'PATCH',{enabled:true})).status,200);assert.equal(await login(member,'alice',memberPassword),200);
 const oldSession={...member};const freshPassword='new private alice password sixteen';
 assert.equal((await request(member,'/api/password','POST',{currentPassword:'bad',password:freshPassword})).status,401);
 assert.equal((await request(member,'/api/password','POST',{currentPassword:memberPassword,password:'short'})).status,400);
 const changed=await request(member,'/api/password','POST',{currentPassword:memberPassword,password:freshPassword});assert.equal(changed.status,200);member.cookie=changed.headers.get('set-cookie').split(';')[0];member.csrf=(await changed.json()).csrf;
 assert.equal((await request(oldSession,'/api/library')).status,401);assert.equal(await login({},'alice',memberPassword),401);assert.equal(await login(member,'alice',freshPassword),200);
 inspection.prepare('UPDATE user_libraries SET data=? WHERE user_id=?').run(JSON.stringify({papers:[{...paper,url:'https://example.com/paper',drivePdfId:'retired-drive',pdfName:'retired.pdf'}],settings:{collections:['Owner tag'],clientId:'123.apps.googleusercontent.com',lastBackup:1}}),other.user.id);
 inspection.exec('PRAGMA user_version=2');
 inspection.close();await close();await open(port,passwordHash('different bootstrap password sixteen'));
 const citationOnly=await library(other);assert.equal(citationOnly.papers[0].url,'https://example.com/paper');assert.equal(citationOnly.papers[0].notes,'Owner notes');assert.equal(citationOnly.papers[0].drivePdfId,undefined);assert.equal(citationOnly.papers[0].pdfName,undefined);assert.deepEqual(citationOnly.settings,{collections:['Owner tag']});assert.equal(citationOnly.revision,1);
 
 assert.equal((await library(owner)).papers[0].notes,'Owner notes');assert.equal((await library(member)).papers[0].notes,'Alice notes');assert.equal(await login({},'owner',password),200,'bootstrap environment must not reset existing passwords');
 assert.equal(await register({},pending.secret,'carol'),201,'invitation survives restart');
 assert.throws(()=>resetPassword(dbPath,'owner','short'),/16/);
 resetPassword(dbPath,'owner','recovered owner password sixteen');
 assert.equal((await request(owner,'/api/library')).status,401);
 assert.equal(await login(owner,'owner','recovered owner password sixteen'),200);
 assert.equal((await library(owner)).papers[0].notes,'Owner notes');
 console.log('Passed: legacy migration, reusable owner invitations, private libraries/revisions, no cross-account access, revocation/expiry, disabling accounts, password rotation, and restart persistence.');
}finally{if(server?.listening)await close();rmSync(dir,{recursive:true,force:true})}
