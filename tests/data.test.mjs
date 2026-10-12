import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';

const nodes = new Map();
function node(selector) {
  if (!nodes.has(selector)) nodes.set(selector, {value:'',innerHTML:'',textContent:'',dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},scrollIntoView(){},showModal(){this.open=true},close(){this.open=false},getBoundingClientRect(){return {left:0,right:100,top:0,bottom:100}}});
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

// The phone screen uses the same paper filters and switches back on wider screens.
let viewportChanged;
const media={matches:true,addEventListener(type,fn){viewportChanged=fn}};
const phoneContext=vm.createContext({...context,window:{matchMedia:()=>media,addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},location:{hash:'',origin:'http://localhost'}});
vm.runInContext(fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),phoneContext);
const phone=s=>vm.runInContext(s,phoneContext);
assert.match(node('#main').innerHTML,/Your reading shelf/);
assert.equal(phone('filtered().length'),8);
phone("navigate('queue')");
assert.equal(phone('filtered().length'),5);
assert.match(node('#main').innerHTML,/Important first/);
node('#search').value='plonk';node('#search').oninput({target:node('#search')});
assert.equal(phone('filtered().length'),1);
assert.match(node('#paper-results').innerHTML,/PLONK/);
phone("navigate('library','Lattices')");
assert.equal(phone('filtered().length'),2);
media.matches=false;viewportChanged();
assert.match(node('#main').innerHTML,/heading-actions/);
assert.equal(phone('collection'),'Lattices');
assert.equal(phone('filtered().length'),2);
console.log('Passed: phone library, unread navigation, search, collections, and viewport switching.');

// Desktop tag clicks preserve other filters and can clear the collection.
phone("navigate('library');statusFilter='unread';priorityFilter='high';query='goldreich';render()");
assert.match(node('#main').innerHTML,/Collections & tags/);
const tagClick=tag=>phone(`document.click({target:{closest:()=>({dataset:{filterTag:${JSON.stringify(tag)}},id:'',hasAttribute:name=>name==='data-filter-tag'})}})`);
await tagClick('Foundations');
assert.equal(phone('collection'),'Foundations');
assert.equal(phone('statusFilter'),'unread');
assert.equal(phone('priorityFilter'),'high');
assert.equal(phone('query'),'goldreich');
assert.equal(phone('filtered().length'),1);
assert.match(node('#paper-results').innerHTML,/Goldreich/);
assert.equal(node('#result-count').textContent,'1 paper');
await tagClick('Lattices');
assert.equal(phone('filtered().length'),0);
await tagClick('');
assert.equal(phone('collection'),'');
assert.equal(phone('filtered().length'),1);
console.log('Passed: desktop collection selection, combined filters, and clear collection.');

// ePrint URL recognition and the actual lookup/save flow.
assert.equal(run("getEprintId('https://eprint.iacr.org/2006/139')"),'2006/139');
assert.equal(run("getEprintId('eprint.iacr.org/2006/139.pdf')"),'2006/139');
assert.equal(run("getEprintId('https://ia.cr/2006/139?from=search')"),'2006/139');
for(const url of ['https://eprint.iacr.org.evil.test/2006/139','https://user@eprint.iacr.org/2006/139','https://eprint.iacr.org/2006/0','https://eprint.iacr.org/2006/139/extra'])assert.equal(run('getEprintId('+JSON.stringify(url)+')'),'');
const eprint={title:'A Unified Framework for the Analysis of Side-Channel Key Recovery Attacks (extended version)',authors:'Francois-Xavier Standaert; Tal G. Malkin; Moti Yung',year:2006,venue:'Cryptology ePrint Archive',doi:'',url:'https://eprint.iacr.org/2006/139',type:'posted-content',metadataSource:'IACR ePrint'};
context.fetch=async url=>{assert.equal(url,'/api/eprint?id=2006%2F139');return {ok:true,json:async()=>eprint}};
run("papers=[];selectedFile=null;addMode='url'");
node('#paper-url').value='https://eprint.iacr.org/2006/139';
await run('lookupMetadata()');
assert.equal(node('#paper-title').value,eprint.title);
assert.equal(node('#paper-year').value,2006);
node('#paper-status').value='unread';node('#paper-priority').value='normal';node('#paper-tags').value='Side channels';
await run('submitAdd({preventDefault(){}})');
assert.equal(run('papers.length'),1);
assert.equal(run('papers[0].metadataSource'),'IACR ePrint');
assert.match(run("citation(papers[0],'bibtex')"),/^@misc/);
assert.match(run("citation(papers[0],'bibtex')"),/howpublished = \{Cryptology ePrint Archive\}/);
node('#paper-url').value='https://ia.cr/2006/139';
await run('submitAdd({preventDefault(){}})');
assert.equal(run('papers.length'),1);assert.match(node('#add-error').textContent,/already in your library/);
console.log('Passed: ePrint page/PDF/short URLs, metadata lookup/save, preprint BibTeX, and duplicate protection.');

// Collection suggestions work with multiple comma-separated tags and keyboard selection.
run("papers=[{tags:['Cryptography','Zero knowledge','<script>']}];settings.collections=['Crypto protocols','Empty collection','cryptography']");
assert.deepEqual(Array.from(run("parseTags('CRYPTOGRAPHY, cryptography, New topic, new topic')")),['cryptography','New topic']);
run("addMode='manual';renderAdd()");
assert.match(node('#modal-content').innerHTML,/role="combobox"/);
const tagInput=node('#paper-tags'),suggestions=node('#paper-tags-suggestions');
tagInput.setAttribute=function(k,v){this[k]=v};
tagInput.removeAttribute=function(k){delete this[k]};
tagInput.focus=()=>{};
tagInput.setSelectionRange=function(a,b){this.selectionStart=a;this.selectionEnd=b};
tagInput.value='cr';tagInput.selectionStart=2;tagInput.oninput();
assert.match(suggestions.innerHTML,/cryptography/);
assert.match(suggestions.innerHTML,/Crypto protocols/);
assert.doesNotMatch(suggestions.innerHTML,/Zero knowledge/);
let prevented=false;
tagInput.onkeydown({key:'ArrowDown',preventDefault(){prevented=true}});
assert.equal(prevented,true);
tagInput.onkeydown({key:'Enter',preventDefault(){}});
assert.equal(tagInput.value,'Crypto protocols, ');
assert.equal(suggestions.hidden,true);
tagInput.value='cryptography, ze';tagInput.selectionStart=tagInput.value.length;tagInput.oninput();
assert.match(suggestions.innerHTML,/Zero knowledge/);
assert.doesNotMatch(suggestions.innerHTML,/cryptography/);
suggestions.onclick({target:{closest(){return {dataset:{tagIndex:'0'}}}}});
assert.equal(tagInput.value,'cryptography, Zero knowledge, ');
// Editing an earlier token preserves later tags.
tagInput.value='cr, Zero knowledge';tagInput.selectionStart=2;tagInput.oninput();
tagInput.onkeydown({key:'Enter',preventDefault(){}});
assert.equal(tagInput.value,'Crypto protocols, Zero knowledge');
tagInput.value='';tagInput.selectionStart=0;tagInput.onfocus();
assert.match(suggestions.innerHTML,/Empty collection/);
assert.match(suggestions.innerHTML,/&lt;script&gt;/);
tagInput.onkeydown({key:'Escape',preventDefault(){},stopPropagation(){}});
assert.equal(suggestions.hidden,true);
tagInput.value='Brand new topic';tagInput.selectionStart=tagInput.value.length;tagInput.oninput();
assert.equal(suggestions.hidden,true);
assert.deepEqual(Array.from(run("parseTags('Brand new topic')")),['Brand new topic']);
console.log('Collection tag suggestions passed.');

// Editing a saved paper uses the same chooser and saves normalized tags.
run("papers=[{id:'edit-tags',title:'Tagged paper',authors:'',venue:'',year:2026,tags:['Cryptography'],status:'unread',importance:'normal',notes:''}];settings.collections=['Zero knowledge'];details('edit-tags')");
assert.match(node('#modal-content').innerHTML,/id="detail-tags"/);
const editTags=node('#detail-tags');
editTags.setAttribute=tagInput.setAttribute;
editTags.removeAttribute=tagInput.removeAttribute;
editTags.focus=()=>{};
editTags.setSelectionRange=tagInput.setSelectionRange;
editTags.value='cr';editTags.selectionStart=2;editTags.oninput();
assert.match(node('#detail-tags-suggestions').innerHTML,/Cryptography/);
editTags.onkeydown({key:'Enter',preventDefault(){}});
assert.equal(editTags.value,'Cryptography, ');
node('#detail-title').value='Tagged paper';node('#detail-authors').value='';node('#detail-year').value='2026';node('#detail-venue').value='';node('#metric-value').value='';node('#detail-notes').value='';
await node('#detail-form').onsubmit({preventDefault(){}});
assert.deepEqual(Array.from(run('papers[0].tags')),['Cryptography']);
console.log('Collection tag editing and persistence passed.');

// ACM URLs resolve their DOI, including IEEE articles indexed in ACM's library.
for(const path of ['doi/','doi/abs/','doi/full/','doi/pdf/','doi/epdf/']){
 assert.equal(run(`getDoi('https://dl.acm.org/${path}10.1145/3658644.3690339?download=1#cite')`),'10.1145/3658644.3690339');
}
assert.equal(run("getDoi('dl.acm.org/doi/10.1109/TIFS.2020.3045904')"),'10.1109/TIFS.2020.3045904');
assert.equal(run("getDoi('https://dl.acm.org/doi/10.1145%2F3658644.3690339')"),''); // DOI path must include the standard slash.
assert.equal(run("getDoi('https://dl.acm.org/doi/10.1145/3658644.3690339/')"),'10.1145/3658644.3690339');
for(const url of ['https://dl.acm.org.evil.test/doi/10.1145/3658644.3690339','https://user@dl.acm.org/doi/10.1145/3658644.3690339','https://dl.acm.org:8443/doi/10.1145/3658644.3690339','https://dl.acm.org/action/10.1145/3658644.3690339','https://dl.acm.org/doi/10.1145/%ZZ']){
 context.acmUrl=url;assert.equal(run('getDoi(acmUrl)'),'');
}
assert.equal(run("crossrefVenue({'container-title':['Some Other Journal']})"),'Some Other Journal');
assert.equal(run("crossrefVenue({'container-title':['ACM Conference on Computer Supported Cooperative Work']})"),'ACM Conference on Computer Supported Cooperative Work');
run("papers=[];addPaper()");
const acmRequests=[];
for(const [name,doi,venue] of [['ccs','10.1145/3658644.3690339','ACM CCS'],['tifs','10.1109/TIFS.2020.3045904','IEEE TIFS']]){
 const record=JSON.parse(fs.readFileSync(new URL(`fixtures/acm-${name}.json`,import.meta.url),'utf8'));
 context.fetch=async url=>{acmRequests.push(url);return {ok:true,json:async()=>({message:record})}};
 node('#paper-url').value='https://dl.acm.org/doi/'+doi;
 await run('lookupMetadata()');
 assert.equal(node('#paper-title').value,record.title[0]);
 assert.equal(node('#paper-venue').value,venue);
 node('#paper-tags').value='';node('#paper-status').value='unread';node('#paper-priority').value='normal';
 await run('submitAdd({preventDefault(){}})');
 assert.equal(run('papers[0].venue'),venue);
 assert.equal(run('papers[0].doi').toLowerCase(),doi.toLowerCase());
 assert.equal(run('papers[0].url'),node('#paper-url').value);
 assert.equal(acmRequests.at(-1),'https://api.crossref.org/works/'+encodeURIComponent(doi));
 assert.match(run("citation(papers[0],'bibtex')"),name==='ccs'?/@inproceedings/:/@article/);
 const count=run('papers.length');
 node('#paper-url').value='https://doi.org/'+doi;
 await run('submitAdd({preventDefault(){}})');
 assert.equal(run('papers.length'),count);
 assert.match(node('#add-error').textContent,/already in your library/);
}
console.log('ACM links, real Crossref venue fixtures, save/cite, and DOI duplicate protection passed.');
