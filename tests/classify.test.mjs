import assert from 'node:assert/strict';
import {createClassifier,normalizeSuggestions} from '../server/classify.mjs';
import {createApp,passwordHash} from '../server/app.mjs';
import {once} from 'node:events';
import net from 'node:net';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

assert.deepEqual(normalizeSuggestions(['pqc / ML-DSA','PQC/ML-DSA'],['PQC']),['PQC/ML-DSA']);
assert.deepEqual(normalizeSuggestions(['PQC/ML-DSA','PQC'],['PQC'],{allowNew:false}),['PQC']);
for(const bad of [['PQC//DSA'],['..'],['a/b/c/d/e/f'],['bad,tag'],['<script>'],['a','b','c','d']])assert.throws(()=>normalizeSuggestions(bad,[]),/Invalid/);
let mode='ok',sent;
const transport=async(url,options)=>{
 assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer unit-test-not-a-real-key');sent=JSON.parse(options.body);
 if(mode==='http')return new Response('secret upstream message',{status:401});
 const content=mode==='refusal'?[{type:'refusal',refusal:'No'}]:[{type:'output_text',text:mode==='invalid'?'not json':JSON.stringify({tags:['PQC/ML-DSA']})}];
 return new Response(JSON.stringify({status:'completed',output:[{type:'message',content}]}));
};
const realAdapter=createClassifier({apiKey:'unit-test-not-a-real-key',fetchImpl:transport});
assert.equal(realAdapter.enabled,true);
assert.deepEqual(await realAdapter({title:'ML-DSA signatures',abstract:'A signature paper.',collections:['PQC']}),['PQC/ML-DSA']);
assert.equal(sent.store,false);assert.equal(sent.text.format.type,'json_schema');assert.equal(sent.text.format.strict,true);assert.equal(sent.max_output_tokens,500);assert.equal(JSON.parse(sent.input).abstract,'A signature paper.');
for(const failure of ['http','refusal','invalid']){mode=failure;await assert.rejects(realAdapter({title:'Title',abstract:'Abstract',collections:[]}));}
const dir=mkdtempSync(join(tmpdir(),'folio-classifier-'));let server,origin;
const hash=passwordHash('owner test password at least sixteen');
let providerCalls=[],providerMode='ok',release,started;
const classifier=async data=>{providerCalls.push(data);if(providerMode==='error')throw new Error('Do not expose a secret provider message');if(providerMode==='wait'){started();await new Promise(r=>release=r)}return data.collections.includes('Private member topic')?['Private member topic']:['PQC/ML-DSA']};classifier.enabled=true;
async function open(port=0){const probe=net.createServer();probe.listen(port,'127.0.0.1');await once(probe,'listening');port=probe.address().port;await new Promise(r=>probe.close(r));origin='http://127.0.0.1:'+port;server=createApp({origin,hash,dbPath:join(dir,'data.sqlite'),allowHttp:true,classifier,aiUserDailyLimit:3,aiDailyLimit:5});server.listen(port,'127.0.0.1');await once(server,'listening');return port}
const close=()=>new Promise(r=>server.close(r));
async function request(client,path,method='GET',data,headers={}){return fetch(origin+path,{method,headers:{Connection:'close',Origin:origin,'Content-Type':'application/json',...(client.cookie?{Cookie:client.cookie}:{}),...(client.csrf?{'X-CSRF-Token':client.csrf}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})})}
const owner={},member={};
async function signIn(client,path,data){const r=await request({},path,'POST',data);assert.ok(r.ok);client.cookie=r.headers.get('set-cookie').split(';')[0];client.csrf=(await r.json()).csrf;}
async function library(client){return (await request(client,'/api/library')).json()}
async function save(client,settings){const current=await library(client);const r=await request(client,'/api/library','PUT',{...current,settings});assert.equal(r.status,200);return r.json()}
try{
 const port=await open();await signIn(owner,'/api/login',{username:'owner',password:'owner test password at least sixteen'});
 assert.equal((await request({},'/api/classify','POST',{})).status,401);
 assert.equal((await request(owner,'/api/ai')).status,200);
 const info=await (await request(owner,'/api/ai')).json();assert.equal(info.configured,true);assert.ok(!JSON.stringify(info).includes('key'));
 const initial={title:'Research',abstract:'A paper about ML-DSA.',revision:0};
 assert.equal((await request(owner,'/api/classify','POST',initial)).status,403);assert.equal(providerCalls.length,0);
 let state=await save(owner,{collections:['PQC'],autoCollections:true,autoCreateCollections:true,collectionInstructions:'Use PQC as a parent.'});
 let input={...initial,revision:state.revision};
 assert.equal((await request(owner,'/api/classify','POST',input,{'X-CSRF-Token':'bad'})).status,403);
 assert.equal((await request(owner,'/api/classify','POST',{...input,abstract:''})).status,400);
 assert.equal((await request(owner,'/api/classify','POST',{...input,revision:0})).status,409);
 const result=await request(owner,'/api/classify','POST',input);assert.equal(result.status,200);assert.deepEqual((await result.json()).tags,['PQC/ML-DSA']);
 assert.equal(providerCalls[0].instructions,'Use PQC as a parent.');assert.deepEqual((await library(owner)).papers,[],'suggestions wait for a paper save');
 providerMode='error';const failed=await request(owner,'/api/classify','POST',input);assert.equal(failed.status,502);assert.ok(!(await failed.text()).includes('secret'));
 providerMode='wait';const waiting=new Promise(r=>started=r);const ongoing=request(owner,'/api/classify','POST',input);await waiting;
 assert.equal((await request(owner,'/api/classify','POST',input)).status,429);
 state=await save(owner,{collections:['PQC'],autoCollections:true});release();assert.equal((await ongoing).status,409,'a stale AI result cannot overwrite a newer library');
 assert.equal((await request(owner,'/api/classify','POST',{...input,revision:state.revision})).status,429);
 const invite=await (await request(owner,'/api/admin/invitations','POST',{})).json();await signIn(member,'/api/register',{username:'member',password:'member password at least sixteen',invitation:new URL(invite.url).hash.slice(8)});
 const memberState=await save(member,{collections:['Private member topic'],autoCollections:true,autoCreateCollections:false});providerMode='ok';
 const memberResult=await request(member,'/api/classify','POST',{...initial,revision:memberState.revision});assert.equal(memberResult.status,200);assert.deepEqual((await memberResult.json()).tags,['Private member topic']);assert.deepEqual(providerCalls.at(-1).collections,['Private member topic']);assert.equal(providerCalls.at(-1).allowNew,false);
 await close();await open(port);assert.equal((await request(owner,'/api/classify','POST',{...input,revision:state.revision})).status,429,'daily usage persists across restarts');
 classifier.enabled=false;assert.equal((await request(owner,'/api/classify','POST',input)).status,503);
 console.log('Passed: structured OpenAI requests, validated paths, consent, private context, persistent quotas, concurrency, stale results, and no-key behavior.');
}finally{if(server?.listening)await close();rmSync(dir,{recursive:true,force:true})}
