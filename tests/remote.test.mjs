import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';

const nodes=new Map();
function node(s){if(!nodes.has(s))nodes.set(s,{value:'',innerHTML:'',textContent:'',dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},showModal(){this.open=true},close(){this.open=false}});return nodes.get(s)}
const account={id:1,username:'owner',role:'owner'};
let library={revision:0,papers:[],settings:{}},localWrites=0,conflict=false,failSave=false;
const requests=[];
const fetch=async(path,options={})=>{
  requests.push({path,options});
  if(path==='/api/session')return new Response(JSON.stringify({csrf:'test-token',user:account}));
  if(path==='/api/library'){
    if(options.method==='PUT'){
      if(failSave)return new Response('{"error":"Server unavailable"}',{status:503});
      if(conflict)return new Response(JSON.stringify({error:'Changed on another device',library}),{status:409});
      const data=JSON.parse(options.body);assert.equal(data.revision,library.revision);assert.equal(options.headers['X-CSRF-Token'],'test-token');library={...data,revision:data.revision+1};
    }
    return new Response(JSON.stringify({...library,user:account}));
  }
  throw new Error('Unexpected request: '+path);
};
const timers=[];
const context=vm.createContext({document:{querySelector:node,querySelectorAll:()=>[],addEventListener(type,fn){this[type]=fn}},window:{FOLIO_REMOTE:true,addEventListener(){}},localStorage:{getItem(){return null},setItem(){localWrites++}},indexedDB:{open(){throw new Error('Remote mode must not open a local PDF database')}},location:{hash:'',origin:'https://papers.example.com'},crypto:webcrypto,URL,Blob,Response,AbortSignal,structuredClone,fetch,setTimeout(fn){timers.push(fn);return timers.length},clearTimeout(){},console});
vm.runInContext(fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),context);
const run=s=>vm.runInContext(s,context);
await run('startRemote()');
assert.equal(run('papers.length'),0);
function fill(){for(const [s,v] of Object.entries({'#paper-title':'My remote paper','#paper-authors':'An Author','#paper-year':'2026','#paper-venue':'TCHES','#paper-tags':'Crypto','#paper-status':'unread','#paper-priority':'high'}))node(s).value=v}
fill();run("addMode='manual'");await run('submitAdd({preventDefault(){}})');assert.equal(library.papers.length,1);assert.equal(library.papers[0].title,'My remote paper');assert.equal(localWrites,0);
// Store another citation directly from its link, without file storage or Google.
fill();node('#paper-url').value='https://eprint.iacr.org/2026/123';
run("addMode='url'");await run('submitAdd({preventDefault(){}})');assert.equal(library.papers.length,2);
assert.equal(library.papers[0].url,'https://eprint.iacr.org/2026/123');
assert.ok(requests.every(r=>r.path.startsWith('/api/')));
run('addPaper()');assert.doesNotMatch(node('#modal-content').innerHTML,/Upload PDF|type="file"|Google Drive/);
run('details(papers[0].id)');assert.match(node('#modal-content').innerHTML,/Open paper/);assert.doesNotMatch(node('#modal-content').innerHTML,/Attach PDF|Read PDF|iframe/);
// A different tab/device updates the server. Our stale save must load its state.
library={...library,revision:library.revision+1,papers:[{...library.papers[0],title:'Edited elsewhere'}]};conflict=true;
run("papers[0].title='Stale title'");await assert.rejects(run('save()'),/Changed on another device/);assert.equal(run('papers[0].title'),'Edited elsewhere');assert.equal(run('revision'),library.revision);
conflict=false;failSave=true;run("papers[0].notes='Unconfirmed edit'");await assert.rejects(run('save()'),/Server unavailable/);assert.equal(run('papers[0].notes'),'');
console.log('Passed: private server citations/links, no PDF or Google features, no browser persistence, and failed/conflicting save recovery.');

// Collection edits save papers and settings together in one server revision.
failSave=false;
run("settings.collections=['Crypto','Target'];collection='Crypto';view='library'");
await run('save()');
const putCount=()=>requests.filter(r=>r.path==='/api/library'&&r.options.method==='PUT').length;
const beforeRename=putCount();
await run("changeCollection('Crypto','Target')");
assert.equal(putCount(),beforeRename+1);
assert.deepEqual(library.papers[0].tags,['Target']);
assert.deepEqual(library.settings.collections,['Target']);
assert.equal(run('collection'),'Target');
failSave=true;
await assert.rejects(run("changeCollection('Target','Failed rename')"),/Server unavailable/);
assert.equal(run('papers[0].tags[0]'),'Target');
assert.equal(run('settings.collections[0]'),'Target');
assert.equal(run('collection'),'Target');
failSave=false;
await run("changeCollection('Target',null)");
assert.equal(library.papers.length,1);
assert.deepEqual(library.papers[0].tags,[]);
assert.deepEqual(library.settings.collections,[]);
assert.equal(library.papers[0].drivePdfId,undefined);
assert.equal(run('collection'),'');
run('renderRemoteSettings()');assert.match(node('#main').innerHTML,/Manage collections/);
assert.equal(localWrites,0);
console.log('Collection edits: atomic remote persistence and failed-save recovery passed.');

// Account UI supports invitation registration, owner management, and password updates.
assert.equal(run('currentUser.username'),'owner');
run('renderRemoteSettings()');assert.match(node('#main').innerHTML,/id="manage-users"/);
let nextUser={id:2,username:'alice',role:'member'},registration;
context.fetch=async(path,options={})=>{
 if(path==='/api/admin/users')return new Response(JSON.stringify({users:[{...account,enabled:1},{...nextUser,enabled:1}]}));
 if(path==='/api/admin/invitations')return new Response(JSON.stringify(options.method==='POST'?{url:'https://papers.example.com/#invite='+'a'.repeat(64)}:{invitations:[]}));
 if(path==='/api/register'){registration=JSON.parse(options.body);return new Response(JSON.stringify({csrf:'alice-csrf',user:nextUser}),{status:201})}
 if(path==='/api/library')return new Response(JSON.stringify({papers:[],settings:{},revision:0,user:nextUser}));
 if(path==='/api/password'){const body=JSON.parse(options.body);if(body.currentPassword==='bad')return new Response('{"error":"Incorrect current password."}',{status:401});return new Response('{"csrf":"rotated-csrf"}');}
 throw new Error('Unexpected UI request '+path);
};
await run('manageUsers()');assert.match(node('#modal-content').innerHTML,/alice/);
await node('#create-invitation').onclick();assert.match(node('#new-invitation').value,/#invite=/);
run("location.hash='#invite='+ 'a'.repeat(64);recommendations=[{title:'Owner recommendation'}];showLogin()");
assert.equal(run('recommendations.length'),0);assert.equal(run('currentUser'),null);
assert.match(node('#main').innerHTML,/Create account/);
node('#login-username').value='alice';node('#login-password').value='sixteen or more characters';node('#register-confirm').value='does not match';
await node('#login-form').onsubmit({preventDefault(){}});assert.equal(registration,undefined);assert.match(node('#login-error').textContent,/do not match/);
node('#register-confirm').value=node('#login-password').value;
await node('#login-form').onsubmit({preventDefault(){}});
assert.equal(registration.username,'alice');assert.equal(registration.invitation,'a'.repeat(64));assert.equal(run('currentUser.username'),'alice');assert.equal(run('csrf'),'alice-csrf');assert.equal(run('location.hash'),'library');
run('renderRemoteSettings()');assert.doesNotMatch(node('#main').innerHTML,/id="manage-users"/);
node('#current-password').value='bad';node('#new-password').value='new sixteen character password';node('#confirm-password').value=node('#new-password').value;
await node('#password-form').onsubmit({preventDefault(){}});
assert.equal(run('currentUser.username'),'alice','incorrect current password must not sign out');assert.match(node('#password-error').textContent,/Incorrect/);
node('#current-password').value='good';await node('#password-form').onsubmit({preventDefault(){}});assert.equal(run('csrf'),'rotated-csrf');assert.equal(node('#new-password').value,'');
// A late response from another account must never populate the new account's library.
let deliver;
context.fetch=()=>new Promise(resolve=>{deliver=resolve});
const pendingLoad=run('loadRemote()');run('showLogin()');deliver(new Response(JSON.stringify({papers:[{title:'Old private paper'}],settings:{},revision:0,user:account})));
await assert.rejects(pendingLoad,/account changed/);assert.equal(run('papers.length'),0);assert.equal(run('currentUser'),null);
console.log('Multi-user UI: owner invitations, registration, password change, and stale response isolation passed.');
