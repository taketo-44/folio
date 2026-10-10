import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';

const nodes = new Map();
function node(selector) {
  if (!nodes.has(selector)) nodes.set(selector, {value:'',innerHTML:'',textContent:'',dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},showModal(){this.open=true},close(){this.open=false},getBoundingClientRect(){return {left:0,right:100,top:0,bottom:100}}});
  return nodes.get(selector);
}
const memory = new Map();
const document={querySelector:node,querySelectorAll:()=>[],addEventListener(type,fn){this[type]=fn}};
const context=vm.createContext({document,window:{addEventListener(){}},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},location:{hash:'',origin:'http://localhost'},crypto:webcrypto,URL,Blob,AbortSignal,structuredClone,setTimeout,clearTimeout,console,indexedDB:{open(){return {}}}});
vm.runInContext(fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),context);
const run=s=>vm.runInContext(s,context);

assert.equal(run('papers.length'),8);
assert.equal(run('filtered().length'),8);
assert.equal(run("statusFilter='unread'; filtered().length"),5);
assert.equal(run("query='plonk'; filtered().length"),1);
run("query=''; statusFilter='all'; view='favorites'");
assert.equal(run('filtered().length'),5);
assert.equal(run("safeUrl('javascript:alert(1)')"),'');
assert.equal(run("getDoi('https://doi.org/10.1137/0218012')"),'10.1137/0218012');
assert.match(run("citation(papers[3],'bibtex')"),/@inproceedings/);
assert.match(run("citation(papers[3],'bibtex')"),/booktitle =/);
assert.match(run("citation(papers[1],'ris')"),/AU  - Shafi Goldwasser/);
assert.equal(run('papers[3].rank'),'A*');
assert.throws(()=>run("validateBackup({version:2,papers:[]})"),/supported/);
assert.throws(()=>run("validateBackup({version:1,papers:[{id:'bad'}]})"),/Invalid/);
run("papers=[{id:'a',title:'Newer local',updated:200,added:100,tags:[],authors:'',venue:'',status:'unread',importance:'normal',pdfId:'local-pdf'}]");
run("mergeBackup({version:1,papers:[{id:'a',title:'Older remote',updated:100,tags:[],drivePdfId:'drive-pdf'},{id:'b',title:'New paper',updated:10,tags:[]}]})");
assert.equal(run('papers.length'),2);
assert.equal(run('papers[0].title'),'Newer local');
assert.equal(run('papers[0].drivePdfId'),'drive-pdf');
run("mergeBackup({version:1,papers:[{id:'a',title:'Newer remote',updated:300,tags:[]}]})");
assert.equal(run('papers[0].title'),'Newer remote');
assert.equal(run('papers[0].pdfId'),'local-pdf');

// Exercise the real remove-paper click and confirmation callbacks in isolation.
await run("document.click({target:{closest:()=>({dataset:{delete:'b'},id:'',hasAttribute:()=>false})}})");
await node('#confirm-action').onclick();
assert.equal(run('papers.length'),1);
assert.equal(run('papers[0].id'),'a');
assert.equal(JSON.parse(memory.get('folio-library-v1')).length,1);
console.log('Passed: filtering, citations, URL safety, backup validation, merge conflict preservation, and single-paper deletion.');
