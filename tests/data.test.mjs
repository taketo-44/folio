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

assert.equal(run("getDoi('https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31?from=search#cite')"),'10.1007/978-3-540-74735-2_31');
assert.equal(run("getDoi('link.springer.com/chapter/10.1007%2F978-3-540-74735-2_31')"),'10.1007/978-3-540-74735-2_31');
assert.equal(run("getDoi('https://link.springernature.com/chapter/10.1007/978-3-540-74735-2_31')"),'10.1007/978-3-540-74735-2_31');
assert.equal(run("getDoi('https://doi.org/10.1007%2F978-3-540-74735-2_31?x=1')"),'10.1007/978-3-540-74735-2_31');
assert.equal(run("getDoi('https://link.springer.com/chapter/10.1007%ZZ/test')"),'');
assert.equal(run("getDoi('https://link.springer.com.evil.test/chapter/10.1007/test')"),'');
assert.equal(run("getDoi('https://user@link.springer.com/chapter/10.1007/test')"),'');
assert.equal(run("getTchesArticleId('https://tches.iacr.org/index.php/TCHES/article/view/8968?x=1#cite')"),'8968');
assert.equal(run("getTchesArticleId('tches.iacr.org/index.php/TCHES/article/download/8968/8575')"),'8968');
assert.equal(run("getTchesArticleId('https://tches.iacr.org/index.php/TCHES/article/view/8968/8575')"),'8968');
assert.equal(run("getTchesArticleId('https://tches.iacr.org.evil.test/index.php/TCHES/article/view/8968')"),'');
assert.equal(run("getTchesArticleId('https://tches.iacr.org:8443/index.php/TCHES/article/view/8968')"),'');

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


// Real lookup/save flow: preserve publisher links and resolved DOI, and reject duplicates.
const requests=[];
const chapter={DOI:'10.1007/978-3-540-74735-2_31',title:['PRESENT: An Ultra-Lightweight Block Cipher'],author:[{given:'A.',family:'Bogdanov'}],published:{'date-parts':[[2007]]},'container-title':['CHES 2007'],type:'book-chapter'};
const tches={doi:'10.46586/tches.v2021.i3.60-96',title:'Ensemble Models',authors:'Gabriel Zaid; Lilian Bossuet',year:2021,venue:'TCHES',metadataSource:'TCHES',type:'journal-article'};
context.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>url.startsWith('/api/tches')?tches:{message:chapter}}};
run("view='library'; addMode='url'");
node('#paper-url').value='https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31';
await run('lookupMetadata()');
assert.equal(node('#paper-title').value,chapter.title[0]);
assert.equal(node('#paper-year').value,2007);
node('#paper-status').value='unread';
node('#paper-priority').value='normal';
node('#paper-tags').value='';
await run('submitAdd({preventDefault(){}})');
assert.equal(run('papers[0].doi'),chapter.DOI);
assert.equal(run('papers[0].url'),node('#paper-url').value);
assert.equal(run('papers[0].type'),'book-chapter');
assert.match(requests[0],/^https:\/\/api.crossref.org\/works\/10\.1007%2F/);
const beforeTches=run('papers.length');
node('#paper-url').value='https://tches.iacr.org/index.php/TCHES/article/view/8968/8575?download=1';
await run('lookupMetadata()');
await run('submitAdd({preventDefault(){}})');
assert.equal(run('papers.length'),beforeTches+1);
assert.equal(run('papers[0].doi'),tches.doi);
assert.equal(run('papers[0].url'),node('#paper-url').value);
assert.equal(requests.at(-1),'/api/tches?id=8968');
await run('submitAdd({preventDefault(){}})');
assert.equal(run('papers.length'),beforeTches+1);
assert.match(node('#add-error').textContent,/already in your library/);

// Editing the URL after lookup must not attach the old article's DOI.
node('#paper-url').value='https://example.com/different-paper';
node('#paper-title').value='Different paper';
await run('submitAdd({preventDefault(){}})');
assert.equal(run('papers[0].doi'),'');
assert.equal(run('papers[0].metadataSource'),'');

// An old response must not overwrite fields when the URL changes during lookup.
let resolveRequest;
context.fetch=()=>new Promise(resolve=>{resolveRequest=resolve});
node('#paper-url').value='https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31';
node('#paper-title').value='Keep this title';
const pendingLookup=run('lookupMetadata()');
node('#paper-url').value='https://example.com/new-link';
resolveRequest({ok:true,json:async()=>({message:chapter})});
await pendingLookup;
assert.equal(node('#paper-title').value,'Keep this title');
assert.equal(run('lookedUpMetadata'),null);
context.fetch=async()=>({ok:false,status:502});
node('#paper-url').value='https://tches.iacr.org/index.php/TCHES/article/view/8968';
await run('lookupMetadata()');
assert.match(node('#add-error').textContent,/manually/);
assert.equal(node('#lookup').disabled,false);
// Restore the deletion fixture used below.
run("papers=[{id:'a',title:'Newer remote',updated:300,added:100,tags:[],authors:'',venue:'',status:'unread',importance:'normal'},{id:'b',title:'New paper',updated:10,tags:[],authors:'',venue:'',status:'unread',importance:'normal'}]");

// Exercise the real remove-paper click and confirmation callbacks in isolation.
await run("document.click({target:{closest:()=>({dataset:{delete:'b'},id:'',hasAttribute:()=>false})}})");
await node('#confirm-action').onclick();
assert.equal(run('papers.length'),1);
assert.equal(run('papers[0].id'),'a');
assert.equal(JSON.parse(memory.get('folio-library-v1')).length,1);
console.log('Passed: filtering, citations, URL safety, backup validation, merge conflict preservation, and single-paper deletion.');
