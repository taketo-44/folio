import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import net from 'node:net';
import {createApp,passwordHash} from '../server/app.mjs';

const dir=mkdtempSync(join(tmpdir(),'folio-activity-')),dbPath=join(dir,'data.sqlite');
const password='activity owner password sixteen',memberPassword='activity member password sixteen',hash=passwordHash(password);
let server,origin,providerFails=false,providerCalls=0;
const classifier=Object.assign(async()=>{providerCalls++;if(providerFails)throw new Error('Private provider secret');return []},{enabled:true});
async function open(port=0){const probe=net.createServer().listen(port,'127.0.0.1');await once(probe,'listening');port=probe.address().port;await new Promise(r=>probe.close(r));origin='http://127.0.0.1:'+port;server=createApp({origin,hash,dbPath,allowHttp:true,classifier,aiUserDailyLimit:3});server.listen(port,'127.0.0.1');await once(server,'listening');return port}
const close=()=>new Promise(r=>server.close(r));
const owner={},member={},second={};
const request=(client,path,method='GET',data)=>fetch(origin+path,{method,headers:{Connection:'close',Origin:origin,'Content-Type':'application/json',...(client.cookie?{Cookie:client.cookie,'X-CSRF-Token':client.csrf}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
async function signIn(client,path,data){const response=await request({},path,'POST',data);assert.ok(response.ok);client.cookie=response.headers.get('set-cookie').split(';')[0];const body=await response.json();client.csrf=body.csrf;client.id=body.user.id}
const library=async client=>(await request(client,'/api/library')).json();
const activity=async(days='30')=>{const response=await request(owner,'/api/admin/activity?days='+days);assert.equal(response.status,200);return response.json()};
const account=(data,client)=>data.accounts.find(user=>user.id===client.id);
const paper={id:'private-paper',title:'DO NOT EXPOSE PRIVATE PAPER TITLE',authors:'PRIVATE AUTHOR',notes:'DO NOT EXPOSE PRIVATE NOTES',tags:['PRIVATE TOPIC'],status:'unread',importance:3,added:1};
async function save(client,papers,settings={autoCollections:true}){const before=await library(client);const response=await request(client,'/api/library','PUT',{...before,papers,settings});assert.equal(response.status,200);return response.json()}
try{
 let port=await open();await close();
 // Simulate an existing deployment: current libraries and retained AI counters predate tracking.
 const seed=new DatabaseSync(dbPath);seed.prepare('UPDATE user_libraries SET data=?').run(JSON.stringify({papers:[{...paper,id:'legacy-paper'}],settings:{}}));
 seed.exec('DROP TABLE paper_activity;DROP TABLE activity_metadata;PRAGMA user_version=4');
 const day=new Date().toISOString().slice(0,10),yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10),oldDay=new Date(Date.now()-91*86400000).toISOString().slice(0,10);
 seed.prepare('INSERT INTO ai_usage VALUES (1,?,?)').run(yesterday,2);seed.prepare('INSERT INTO ai_usage VALUES (1,?,?)').run(oldDay,99);seed.close();
 await open(port);await signIn(owner,'/api/login',{username:'owner',password});
 let report=await activity();assert.equal(report.totalAccounts,1);assert.equal(report.enabledAccounts,1);assert.equal(report.timezone,'UTC');assert.equal(report.days,30);assert.equal(report.to,day);assert.equal(report.trackingStartedAt.slice(0,10),day);
 assert.equal(account(report,owner).paperCount,1);assert.equal(account(report,owner).daily.reduce((n,d)=>n+d.papersAdded,0),0,'do not invent history from old/client-supplied added dates');
 assert.equal(account(report,owner).daily.find(d=>d.day===yesterday).aiRequests,2);
 assert.equal((await request({},'/api/admin/activity')).status,401);
 for(const query of ['days=0','days=91','days=abc','days=7&days=30','days=30&user_id=1'])assert.equal((await request(owner,'/api/admin/activity?'+query)).status,400);
 for(const days of ['7','30','90'])assert.equal((await activity(days)).days,Number(days));
 const invite=await(await request(owner,'/api/admin/invitations','POST',{})).json();const invitation=new URL(invite.url).hash.slice(8);
 await signIn(member,'/api/register',{username:'alice',password:memberPassword,invitation});await signIn(second,'/api/register',{username:'bob',password:memberPassword,invitation});
 assert.equal((await request(member,'/api/admin/activity')).status,403);
 report=await activity();assert.equal(report.totalAccounts,3);assert.equal(account(report,member).paperCount,0,'starter examples are excluded');assert.deepEqual(account(report,member).daily,[]);
 let state=await save(member,[paper]);report=await activity();assert.equal(account(report,member).paperCount,1);assert.deepEqual(account(report,member).daily,[{day,papersAdded:1,aiRequests:0}]);
 const stale=state;state=await save(member,[{...paper,notes:'Changed private notes'}]);
 assert.equal((await request(member,'/api/library','PUT',{...stale,papers:[paper,{...paper,id:'stale-paper'}]})).status,409);
 assert.equal(account(await activity(),member).daily[0].papersAdded,1,'edits and conflicts are not additions');
 state=await save(member,[]);assert.equal(account(await activity(),member).paperCount,0);assert.equal(account(await activity(),member).daily[0].papersAdded,1,'deletion preserves history');
 state=await save(member,[paper,{...paper,id:'imported-paper'}]);assert.equal(account(await activity(),member).daily[0].papersAdded,3,'re-adds and imports count once each');
 // Caller timestamps do not choose the accounting day; replays cannot double count.
 assert.equal(account(await activity(),member).daily[0].day,day);
 const classification={title:'PRIVATE CLASSIFICATION TITLE',abstract:'PRIVATE CLASSIFICATION ABSTRACT',revision:state.revision};
 assert.equal((await request(member,'/api/classify','POST',{...classification,abstract:''})).status,400);assert.equal(providerCalls,0);
 assert.equal((await request(member,'/api/classify','POST',classification)).status,200);providerFails=true;assert.equal((await request(member,'/api/classify','POST',classification)).status,502);providerFails=false;
 assert.equal((await request(member,'/api/classify','POST',classification)).status,200);assert.equal((await request(member,'/api/classify','POST',classification)).status,429);
 report=await activity();assert.equal(account(report,member).daily[0].aiRequests,3,'AI attempts include provider failures but not rejected requests');
 assert.equal((await request(owner,'/api/admin/users/'+second.id,'PATCH',{enabled:false})).status,200);
 report=await activity();assert.equal(report.totalAccounts,3);assert.equal(report.enabledAccounts,2);assert.equal(account(report,second).enabled,0);
 for(const user of report.accounts){assert.deepEqual(Object.keys(user).sort(),['id','username','role','enabled','paperCount','daily'].sort());for(const row of user.daily)assert.deepEqual(Object.keys(row).sort(),['day','papersAdded','aiRequests'].sort())}
 const text=JSON.stringify(report);for(const secret of [password,memberPassword,'password_hash',hash,'DO NOT EXPOSE','PRIVATE AUTHOR','PRIVATE TOPIC','PRIVATE CLASSIFICATION',invitation,member.cookie,member.csrf])assert.ok(!text.includes(secret),secret);
 const inspection=new DatabaseSync(dbPath);assert.equal(inspection.prepare('PRAGMA user_version').get().user_version,5);inspection.prepare('INSERT INTO paper_activity VALUES (?,?,?)').run(member.id,oldDay,100);
 // A new addition and new AI attempt prune old counters while preserving yesterday.
 state=await save(owner,[{...paper,id:'owner-new'}]);assert.equal((await request(owner,'/api/classify','POST',{...classification,revision:state.revision})).status,200);
 assert.equal(inspection.prepare('SELECT count(*) n FROM paper_activity WHERE day=?').get(oldDay).n,0);assert.equal(inspection.prepare('SELECT count(*) n FROM ai_usage WHERE day=?').get(oldDay).n,0);assert.equal(inspection.prepare('SELECT count FROM ai_usage WHERE day=? AND user_id=1').get(yesterday).count,2);inspection.close();
 const startedAt=report.trackingStartedAt;await close();await open(port);
 report=await activity();assert.equal(report.trackingStartedAt,startedAt);assert.equal(account(report,member).daily[0].papersAdded,3);assert.equal(account(report,member).daily[0].aiRequests,3);assert.equal(account(report,member).paperCount,2);
 assert.equal((await request(second,'/api/admin/activity')).status,401);
 console.log('Owner activity: migration, aggregate privacy, access controls, successful additions, AI history/limits, period validation and restart persistence passed.');
}finally{if(server?.listening)await close();rmSync(dir,{recursive:true,force:true})}
