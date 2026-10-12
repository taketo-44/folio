import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';

const nodes=new Map();
function node(s){if(!nodes.has(s))nodes.set(s,{value:'',innerHTML:'',textContent:'',dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},showModal(){this.open=true},close(){this.open=false}});return nodes.get(s)}
let library={revision:0,papers:[],settings:{}},pdfUploads=0,localWrites=0,conflict=false,failSave=false;
const requests=[];
const fetch=async(path,options={})=>{
  requests.push({path,options});
  if(path==='/api/session')return new Response(JSON.stringify({csrf:'test-token'}));
  if(path==='/api/library'){
    if(options.method==='PUT'){
      if(failSave)return new Response('{"error":"Server unavailable"}',{status:503});
      if(conflict)return new Response(JSON.stringify({error:'Changed on another device',library}),{status:409});
      const data=JSON.parse(options.body);assert.equal(data.revision,library.revision);assert.equal(options.headers['X-CSRF-Token'],'test-token');library={...data,revision:data.revision+1};
    }
    return new Response(JSON.stringify(library));
  }
  if(path.startsWith('https://www.googleapis.com/drive/v3/files?q='))return new Response('{"files":[{"id":"folder-id","name":"Folio Library"}]}');
  if(path.startsWith('https://www.googleapis.com/upload/'))return new Response('{}',{headers:{Location:'https://www.googleapis.com/upload-session'}});
  if(path==='https://www.googleapis.com/upload-session'){pdfUploads++;assert.equal(await options.body.slice(0,5).text(),'%PDF-');return new Response('{"id":"drive-pdf"}');}
  if(path.includes('drive-pdf?alt=media'))return new Response('%PDF-1.7 mock contents',{headers:{'Content-Type':'application/pdf'}});
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
// PDF upload fails before saving if the optional Drive connection is absent.
const pdf=new Blob(['%PDF-1.7 mock contents'],{type:'application/pdf'});pdf.name='paper.pdf';context.testPdf=pdf;
fill();run("addMode='pdf';selectedFile=testPdf");await run('submitAdd({preventDefault(){}})');assert.match(node('#add-error').textContent,/Connect Google Drive/);assert.equal(library.papers.length,1);
run("driveToken='drive-token';tokenExpiry=Date.now()+60000");await run('submitAdd({preventDefault(){}})');assert.equal(pdfUploads,1);assert.equal(library.papers.length,2);assert.equal(library.papers[0].drivePdfId,'drive-pdf');assert.equal(library.papers[0].pdfId,undefined);
await run('readPdf(papers[0].id)');assert.equal(localWrites,0);assert.ok(node('#modal-content').innerHTML.includes('PDF reader'));
// A different tab/device updates the server. Our stale save must load its state.
library={...library,revision:library.revision+1,papers:[{...library.papers[0],title:'Edited elsewhere'}]};conflict=true;
run("papers[0].title='Stale title'");await assert.rejects(run('save()'),/Changed on another device/);assert.equal(run('papers[0].title'),'Edited elsewhere');assert.equal(run('revision'),library.revision);
conflict=false;failSave=true;run("papers[0].notes='Unconfirmed edit'");await assert.rejects(run('save()'),/Server unavailable/);assert.equal(run('papers[0].notes'),'');
console.log('Passed: shared server library, optional Drive, direct PDF upload/read, no browser persistence, and failed/conflicting save recovery.');

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
assert.equal(library.papers[0].drivePdfId,'drive-pdf');
assert.equal(run('collection'),'');
run('renderRemoteSettings()');assert.match(node('#main').innerHTML,/Manage collections/);
assert.equal(localWrites,0);
console.log('Collection edits: atomic remote persistence and failed-save recovery passed.');
