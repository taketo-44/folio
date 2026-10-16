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
const context=vm.createContext({document,window:{addEventListener(){}},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},location:{hash:'',origin:'http://localhost'},crypto:webcrypto,URL,URLSearchParams,Blob,AbortSignal,structuredClone,setTimeout,clearTimeout,console,indexedDB:{open(){return {}}}});
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

assert.equal(run("getDoi('https://doi.org/10.1007%2F978-3-540-74735-2_31?x=1')"),'10.1007/978-3-540-74735-2_31');

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
assert.equal(run('papers[0].drivePdfId'),undefined);
run("mergeBackup({version:1,papers:[{id:'a',title:'Newer remote',updated:300,tags:[]}]})");
assert.equal(run('papers[0].title'),'Newer remote');
assert.equal(run('papers[0].pdfId'),undefined);


// DOI lookup fills citations and abstracts and protects against duplicates.
const requests=[];
const chapter={DOI:'10.1007/978-3-540-74735-2_31',title:['PRESENT: An Ultra-Lightweight Block Cipher'],author:[{given:'A.',family:'Bogdanov'}],published:{'date-parts':[[2007]]},'container-title':['CHES 2007'],type:'book-chapter',abstract:'<p>A lightweight block cipher.</p>'};
context.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>({message:chapter})}};
run("view='library'; addMode='url'");
node('#paper-url').value='https://doi.org/'+chapter.DOI;
await run('lookupMetadata()');
assert.equal(node('#paper-title').value,chapter.title[0]);assert.equal(node('#paper-year').value,2007);assert.equal(node('#paper-abstract').value,'A lightweight block cipher.');
node('#paper-status').value='unread';node('#paper-priority').value='normal';node('#paper-tags').value='';
await run('submitAdd({preventDefault(){}})');
assert.equal(run('papers[0].doi'),chapter.DOI);assert.equal(run('papers[0].url'),node('#paper-url').value);assert.equal(run('papers[0].type'),'book-chapter');
assert.match(requests[0],/^https:\/\/api.crossref.org\/works\/10\.1007%2F/);
const beforeDuplicate=run('papers.length');await run('submitAdd({preventDefault(){}})');assert.equal(run('papers.length'),beforeDuplicate);assert.match(node('#add-error').textContent,/already in your library/);
// Editing the URL after lookup must not attach the old article's DOI.
node('#paper-url').value='https://example.com/different-paper';node('#paper-title').value='Different paper';await run('submitAdd({preventDefault(){}})');assert.equal(run('papers[0].doi'),'');assert.equal(run('papers[0].metadataSource'),'');

// An old response must not overwrite fields when the URL changes during lookup.
let resolveRequest;
context.fetch=()=>new Promise(resolve=>{resolveRequest=resolve});
node('#paper-url').value='https://doi.org/'+chapter.DOI;
node('#paper-title').value='Keep this title';
const pendingLookup=run('lookupMetadata()');
node('#paper-url').value='https://example.com/new-link';
resolveRequest({ok:true,json:async()=>({message:chapter})});
await pendingLookup;
assert.equal(node('#paper-title').value,'Keep this title');
assert.equal(run('lookedUpMetadata'),null);
context.fetch=async()=>({ok:false,status:502});
node('#paper-url').value='10.46586/tches.v2021.i3.60-96';
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
assert.equal(phone('filtered().length'),1);
assert.deepEqual(Array.from(phone('activeCollections()')),['Foundations','Lattices']);
phone("collectionMatch='all'");assert.equal(phone('filtered().length'),0);phone("collectionMatch='any'");
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

// DOI metadata still supplies concise venue names for ACM and IEEE papers.
assert.equal(run("crossrefVenue({'container-title':['Some Other Journal']})"),'Some Other Journal');
assert.equal(run("crossrefVenue({'container-title':['ACM Conference on Computer Supported Cooperative Work']})"),'ACM Conference on Computer Supported Cooperative Work');
run("papers=[];addPaper()");
const acmRequests=[];
for(const [name,doi,venue] of [['ccs','10.1145/3658644.3690339','ACM CCS'],['tifs','10.1109/TIFS.2020.3045904','IEEE TIFS']]){
 const record=JSON.parse(fs.readFileSync(new URL(`fixtures/acm-${name}.json`,import.meta.url),'utf8'));
 context.fetch=async url=>{acmRequests.push(url);return {ok:true,json:async()=>({message:record})}};
 node('#paper-url').value=doi;
 await run('lookupMetadata()');
 assert.equal(node('#paper-title').value,record.title[0]);
 assert.equal(node('#paper-venue').value,venue);
 node('#paper-tags').value='';node('#paper-status').value='unread';node('#paper-priority').value='normal';
 await run('submitAdd({preventDefault(){}})');
 assert.equal(run('papers[0].venue'),venue);
 assert.equal(run('papers[0].doi').toLowerCase(),doi.toLowerCase());
 assert.equal(run('papers[0].url'),'https://doi.org/'+doi);
 assert.equal(acmRequests.at(-1),'https://api.crossref.org/works/'+encodeURIComponent(doi));
 assert.match(run("citation(papers[0],'bibtex')"),name==='ccs'?/@inproceedings/:/@article/);
 const count=run('papers.length');
 node('#paper-url').value='https://doi.org/'+doi;
 await run('submitAdd({preventDefault(){}})');
 assert.equal(run('papers.length'),count);
 assert.match(node('#add-error').textContent,/already in your library/);
}
console.log('DOI lookup, Crossref venue fixtures, save/cite, and duplicate protection passed.');

// Manage collections: rename every use, merge without duplicate tags, and remove only the tag.
run("papers=[{id:'a',title:'A',authors:'',venue:'',notes:'Keep notes',pdfId:'keep-pdf',tags:['Crypto','Lattices'],status:'unread',importance:'normal',updated:1},{id:'b',title:'B',authors:'',venue:'',tags:['Crypto','Cryptography'],status:'read',importance:'high',updated:1}];settings={clientId:'keep-client',collections:['Crypto','Cryptography','Empty']};collection='Crypto';view='library'");
run('manageCollections()');
assert.match(node('#modal-content').innerHTML,/data-rename-tag="Crypto"/);
assert.match(node('#modal-content').innerHTML,/data-remove-tag="Empty"/);
await run("changeCollection('Crypto','Cryptography')");
assert.deepEqual(Array.from(run('papers[0].tags')),['Cryptography','Lattices']);
assert.deepEqual(Array.from(run('papers[1].tags')),['Cryptography']);
assert.deepEqual(Array.from(run('settings.collections')),['Cryptography','Empty']);
assert.equal(run('collection'),'Cryptography');
assert.equal(run('location.hash'),'collection=Cryptography');
assert.equal(JSON.parse(memory.get('folio-settings')).collections[0],'Cryptography');
assert.deepEqual(JSON.parse(memory.get('folio-library-v1'))[1].tags,['Cryptography']);
await run("changeCollection('Cryptography','cryptography')");
assert.equal(run('papers[0].tags[0]'),'cryptography');
await assert.rejects(run("changeCollection('cryptography','bad,name')"),/without commas/);
await assert.rejects(run("changeCollection('cryptography','   ')"),/collection name/);
assert.equal(run('papers[0].tags[0]'),'cryptography');
await run("changeCollection('cryptography',null)");
assert.equal(run('papers.length'),2);
assert.deepEqual(Array.from(run('papers[0].tags')),['Lattices']);
assert.equal(run('papers[0].notes'),'Keep notes');
assert.equal(run('papers[0].pdfId'),undefined);
assert.equal(run('settings.clientId'),undefined);
assert.equal(run('collection'),'');
await run("changeCollection('Empty','Empty renamed')");
assert.ok(run("settings.collections.includes('Empty renamed')"));
assert.match(run('desktopTagFilters()'),/data-manage-collections/);
run('renderPhoneLibrary()');assert.match(node('#main').innerHTML,/data-manage-collections/);
run("view='settings';renderSettings()");assert.match(node('#main').innerHTML,/Manage collections/);
console.log('Collection manager: rename, merge, delete, empty collections, filters, and local persistence passed.');

// Citation-only behavior: imports drop attachment state, URLs still work, and no PDF storage is opened.
assert.equal(run('typeof pdfStore'),'undefined');
assert.equal(run('typeof readPdf'),'undefined');
assert.equal(run('typeof connectDrive'),'undefined');
const legacyBackup=run("validateBackup({version:1,papers:[{id:'legacy-pdf',title:'Keep citation',url:'https://eprint.iacr.org/2006/139.pdf',notes:'Keep notes',tags:['Crypto'],pdfId:'old-cache',drivePdfId:'old-drive',pdfName:'old.pdf'}]})");
assert.equal(legacyBackup[0].url,'https://eprint.iacr.org/2006/139.pdf');
assert.equal(legacyBackup[0].notes,'Keep notes');
for(const field of ['pdfId','drivePdfId','pdfName'])assert.equal(legacyBackup[0][field],undefined);
run("papers=[{id:'edit-link',title:'Link paper',authors:'',venue:'',year:2026,tags:[],status:'unread',importance:'normal',notes:'',url:'https://example.com/old'}];details('edit-link')");
assert.match(node('#modal-content').innerHTML,/Paper source link/);
assert.doesNotMatch(node('#modal-content').innerHTML,/Read PDF|Attach PDF|iframe/);
node('#detail-title').value='Link paper';node('#detail-url').value='https://example.com/new';node('#detail-tags').value='';node('#metric-value').value='';
await node('#detail-form').onsubmit({preventDefault(){}});
assert.equal(run('papers[0].url'),'https://example.com/new');
run('renderSettings()');assert.doesNotMatch(node('#main').innerHTML,/Google|Drive|PDF|OAuth/);
console.log('Citation-only imports, editable source links, and removal of PDF/Drive controls passed.');

// A collection path supplies implicit parent nodes and parent filtering includes descendants.
run("papers=[{id:'dsa',title:'DSA paper',authors:'',venue:'',tags:['PQC/ML-DSA'],status:'unread',importance:'normal',notes:''},{id:'kem',title:'KEM paper',authors:'',venue:'',tags:['PQC/ML-KEM'],status:'read',importance:'normal',notes:''},{id:'other',title:'Other paper',authors:'',venue:'',tags:['Other'],status:'unread',importance:'normal',notes:''}];settings={collections:['PQC/ML-DSA','PQC/ML-KEM']};view='library';collection='PQC';query='';statusFilter='all';priorityFilter='all'");
assert.equal(run('filtered().length'),2);
assert.deepEqual(Array.from(run('collectionTree().filter(t=>t.path.startsWith("PQC")).map(t=>t.path)')),['PQC','PQC/ML-DSA','PQC/ML-KEM']);
assert.equal(run('collectionCount("PQC")'),2);assert.equal(run('collectionTree().find(t=>t.path==="PQC/ML-DSA").depth'),1);
assert.match(run('desktopTagFilters()'),/--collection-depth:1/);
run("collection='PQC/ML-DSA'");assert.equal(run('filtered().length'),1);
await run("changeCollection('PQC','Post-quantum')");assert.equal(run('collection'),'Post-quantum/ML-DSA');assert.equal(run('papers[0].tags[0]'),'Post-quantum/ML-DSA');
await assert.rejects(run("changeCollection('Post-quantum','Post-quantum/Child')"),/own branch/);
await run("changeCollection('Post-quantum',null)");assert.equal(run('papers.length'),3);assert.deepEqual(Array.from(run('papers[0].tags')),[]);assert.equal(run('papers[2].tags[0]'),'Other');assert.equal(run('collection'),'');
assert.equal(run("abstractText('<jats:p>ML-DSA &amp; ML-KEM</jats:p>')"),'ML-DSA & ML-KEM');
assert.equal(run("crossrefPaper({abstract:'<jats:p>Abstract text</jats:p>'}).abstract"),'Abstract text');
assert.equal(run("validateBackup({version:1,papers:[{id:'abs',title:'Abstract paper',abstract:'Keep abstract'}]})[0].abstract"),'Keep abstract');
console.log('Layered collections, subtree filtering/rename/removal, and abstract metadata passed.');

// Retired publisher lookup paths never fetch metadata; their URLs remain saveable as links.
let publisherFetches=0;context.fetch=async()=>{publisherFetches++;throw new Error('Unexpected publisher request')};
for(const url of ['https://link.springer.com/chapter/10.1007/example','https://ieeexplore.ieee.org/document/1234567','https://dl.acm.org/doi/10.1145/example','https://tches.iacr.org/index.php/TCHES/article/view/8968']){
 context.publisherUrl=url;assert.equal(run('getDoi(publisherUrl)'),'');await assert.rejects(run('lookupPaper(publisherUrl)'),/DOI/);
 run("addPaper()");node('#paper-url').value=url;node('#paper-title').value='Manually saved publisher citation';node('#paper-tags').value='';node('#paper-abstract').value='';
 const previousCount=run('papers.length');await run('submitAdd({preventDefault(){}})');assert.equal(run('papers.length'),previousCount+1);assert.equal(run('papers[0].url'),url);assert.equal(run('papers[0].doi'),'');
}
assert.equal(publisherFetches,0);
assert.equal(run("getDoi('doi:10.1145/3658644.3690339')"),'10.1145/3658644.3690339');
assert.equal(run("getDoi('https://dx.doi.org/10.1109/TIFS.2020.3045904')"),'10.1109/TIFS.2020.3045904');
console.log('Publisher-specific lookup removed; DOI/ePrint lookup and manual publisher links retained.');

// Preprint repositories remain supported, including arXiv papers with no DOI.
for(const url of ['https://arxiv.org/abs/1706.03762','arxiv.org/pdf/1706.03762.pdf','https://arxiv.org/html/1706.03762','https://export.arxiv.org/abs/1706.03762']){context.arxivUrl=url;assert.equal(run('getArxivId(arxivUrl)'),'1706.03762');}
assert.equal(run("getArxivId('https://arxiv.org/abs/hep-th/9901001v2')"),'hep-th/9901001v2');
for(const url of ['https://arxiv.org.evil.test/abs/1706.03762','https://user@arxiv.org/abs/1706.03762','https://arxiv.org:8443/abs/1706.03762','https://arxiv.org/abs/1713.00001','https://arxiv.org/abs/1706.03762/extra']){context.arxivUrl=url;assert.equal(run('getArxivId(arxivUrl)'),'');}
const arxivPaper={title:'A preprint without DOI',authors:'Alice Example',year:2017,venue:'arXiv',abstract:'An abstract for collection classification.',doi:'',type:'posted-content',metadataSource:'arXiv',url:'https://arxiv.org/abs/1706.03762'};
const arxivCalls=[];context.fetch=async url=>{arxivCalls.push(url);return {ok:true,json:async()=>arxivPaper}};
run('papers=[];addPaper()');node('#paper-url').value=arxivPaper.url;await run('lookupMetadata()');assert.equal(node('#paper-title').value,arxivPaper.title);assert.equal(node('#paper-abstract').value,arxivPaper.abstract);node('#paper-tags').value='';await run('submitAdd({preventDefault(){}})');assert.equal(run('papers.length'),1);assert.equal(run('papers[0].doi'),'');assert.equal(run('papers[0].metadataSource'),'arXiv');assert.match(run("citation(papers[0],'bibtex')"),/^@misc/);assert.deepEqual(arxivCalls,['/api/arxiv?id=1706.03762']);
node('#paper-url').value='https://arxiv.org/pdf/1706.03762v2.pdf';await run('submitAdd({preventDefault(){}})');assert.equal(run('papers.length'),1);assert.match(node('#add-error').textContent,/already in your library/);
console.log('arXiv URL lookup, DOI-free citation save, abstract capture, BibTeX and version duplicate protection passed.');

// Multi-selection supports unions/intersections, keeps other search filters, and round-trips in URLs.
run("papers=[{id:'one',title:'Signature',authors:'',venue:'',tags:['PQC/ML-DSA','Lattices'],status:'unread',importance:'high',notes:'Keep note'},{id:'two',title:'Encryption',authors:'',venue:'',tags:['PQC/ML-KEM'],status:'read',importance:'normal',notes:''},{id:'three',title:'Lattices',authors:'',venue:'',tags:['Lattices'],status:'unread',importance:'high',notes:''}];settings={collections:['PQC','Lattices']};navigate('library');toggleCollection('PQC');toggleCollection('Lattices')");
assert.equal(run('filtered().length'),3);assert.deepEqual(Array.from(run('activeCollections()')),['PQC','Lattices']);
run("collectionMatch='all';query='Signature';statusFilter='unread';priorityFilter='high';render()");assert.equal(run('filtered().length'),1);
assert.match(node('#main').innerHTML,/2 collections/);assert.match(node('#main').innerHTML,/All selected collections/);
const multiHash=run('collectionHash()');context.multiHash=multiHash;
assert.deepEqual(Array.from(run('parseCollectionHash(multiHash).tags')),['PQC','Lattices']);assert.equal(run('parseCollectionHash(multiHash).match'),'all');
assert.equal(run('restoreCollectionHash(multiHash)'),false);assert.equal(run('query'),'Signature');
run("toggleCollection('')");assert.deepEqual(Array.from(run('activeCollections()')),[]);assert.equal(run('query'),'Signature');assert.equal(run('statusFilter'),'unread');assert.equal(run('priorityFilter'),'high');assert.equal(run('restoreCollectionHash(collectionHash())'),false);
assert.equal(run("restoreCollectionHash('collection=PQC%2FML-DSA')"),true);assert.equal(run('collection'),'PQC/ML-DSA');
assert.deepEqual(Array.from(run("parseCollectionHash('collections=not-json').tags")),[]);
run("navigate('queue');toggleCollection('PQC');toggleCollection('Lattices')");assert.equal(run('filtered().length'),2);assert.equal(run('parseCollectionHash(collectionHash()).view'),'queue');
run("renderPhoneLibrary()");assert.match(node('#main').innerHTML,/id="collection-match"/);assert.match(node('#main').innerHTML,/aria-pressed="true"/);
// Move a branch to a new parent and then back to the top level; selected paths follow the move.
run("view='library';query='';statusFilter='all';priorityFilter='all';settings={collections:['PQC','Signatures','Other']};papers=[{id:'root',title:'Root',authors:'',venue:'',tags:['PQC/ML-DSA'],status:'unread',importance:'normal',notes:'Keep note'},{id:'child',title:'Child',authors:'',venue:'',tags:['PQC/ML-DSA/Implementations','Other'],status:'unread',importance:'normal',notes:''}];setCollectionFilters(['PQC/ML-DSA','Other'])");
await run("moveCollection('PQC/ML-DSA','Signatures')");assert.equal(run('papers[1].tags[0]'),'Signatures/ML-DSA/Implementations');assert.deepEqual(Array.from(run('activeCollections()')),['Signatures/ML-DSA','Other']);assert.equal(run('papers[0].notes'),'Keep note');
await assert.rejects(run("moveCollection('Signatures','Signatures/ML-DSA')"),/own branch/);
await assert.rejects(run("moveCollection('Signatures/ML-DSA','Does not exist')"),/destination/);
await run("moveCollection('Signatures/ML-DSA','')");assert.equal(run('papers[0].tags[0]'),'ML-DSA');assert.equal(run('papers[1].tags[0]'),'ML-DSA/Implementations');
run("settings.collections.push('PQC/ML-DSA');manageCollections()");assert.match(node('#modal-content').innerHTML,/data-move-tag="ML-DSA"/);
run("moveCollectionDialog('ML-DSA')");assert.match(node('#modal-content').innerHTML,/Top level/);assert.doesNotMatch(node('#modal-content').innerHTML,/<option value="ML-DSA\/Implementations"/);
node('#move-collection-parent').value='PQC';node('#move-collection-parent').onchange();assert.equal(node('#move-merge-warning').hidden,false);
await node('#move-collection-form').onsubmit({preventDefault(){}});assert.match(node('#move-collection-error').textContent,/Confirm the merge/);assert.equal(run('papers[0].tags[0]'),'ML-DSA');
node('#move-merge-confirm').checked=true;await node('#move-collection-form').onsubmit({preventDefault(){}});assert.equal(run('papers[0].tags[0]'),'PQC/ML-DSA');assert.equal(run('papers[1].tags[0]'),'PQC/ML-DSA/Implementations');assert.deepEqual(Array.from(run('activeCollections()')),['PQC/ML-DSA','Other']);
assert.equal(JSON.parse(memory.get('folio-library-v1'))[0].tags[0],'PQC/ML-DSA');
console.log('Multiple collection filters, any/all matching, hash links, branch moves, cycle guards, merge confirmation, and persistence passed.');

// Native drag/drop and touch gestures use the same branch move operation and merge confirmation.
run("papers=[{id:'drag-a',title:'Drag A',authors:'',venue:'',tags:['ML-DSA'],status:'unread',importance:'normal',notes:'Keep note'},{id:'drag-b',title:'Drag B',authors:'',venue:'',tags:['ML-DSA/Implementations'],status:'unread',importance:'normal',notes:''}];settings={collections:['ML-DSA','PQC']};view='library';setCollectionFilters(['ML-DSA']);manageCollections()");
assert.match(node('#modal-content').innerHTML,/draggable="true"/);assert.match(node('#modal-content').innerHTML,/data-drop-parent=""/);
const dragManager=node('#collection-manager');
const dragZones=new Set();
function dragZone(path){const z={dataset:{dropParent:path},classList:{add(){},remove(){}},closest(){return z}};dragZones.add(z);return z}
function dragGrip(path){const z=dragZone(path);const g={dataset:{dragCollection:path},closest(selector){return selector==='[data-drag-collection]'?g:z},capture:null,setPointerCapture(id){this.capture=id},hasPointerCapture(id){return this.capture===id},releasePointerCapture(){this.capture=null}};dragZones.add(g);return g}
dragManager.contains=element=>dragZones.has(element);
const dt={setData(type,value){this[type]=value}};
const pqcZone=dragZone('PQC'),rootZone=dragZone('');
const nativeStart=grip=>dragManager.ondragstart({target:grip,dataTransfer:dt,preventDefault(){}});
const nativeDrop=target=>dragManager.ondrop({target,dataTransfer:dt,preventDefault(){}});
nativeStart(dragGrip('ML-DSA'));assert.equal(dt.effectAllowed,'move');assert.equal(dt['text/plain'],'ML-DSA');
let acceptedInvalid=false;dragManager.ondragover({target:dragZone('ML-DSA/Implementations'),dataTransfer:dt,preventDefault(){acceptedInvalid=true}});assert.equal(acceptedInvalid,false);assert.equal(dt.dropEffect,'none');
await nativeDrop(dragZone('ML-DSA/Implementations'));assert.equal(run('papers[0].tags[0]'),'ML-DSA');
nativeStart(dragGrip('ML-DSA'));let acceptedDrop=false;dragManager.ondragover({target:pqcZone,dataTransfer:dt,preventDefault(){acceptedDrop=true}});assert.equal(acceptedDrop,true);assert.match(node('#collection-drag-status').textContent,/under PQC/);
await nativeDrop(pqcZone);assert.equal(run('papers[0].tags[0]'),'PQC/ML-DSA');assert.equal(run('papers[1].tags[0]'),'PQC/ML-DSA/Implementations');assert.equal(run('collection'),'PQC/ML-DSA');
nativeStart(dragGrip('PQC/ML-DSA'));await nativeDrop(rootZone);assert.equal(run('papers[0].tags[0]'),'ML-DSA');assert.equal(run('papers[0].notes'),'Keep note');
// External drops cannot supply an arbitrary source collection through text/plain.
await nativeDrop(pqcZone);assert.equal(run('papers[0].tags[0]'),'ML-DSA');
// Touch threshold, capture and release, plus dropping onto the same destination.
const touchGrip=dragGrip('ML-DSA');document.elementFromPoint=()=>pqcZone;node('#modal').getBoundingClientRect=()=>({top:0,bottom:600});
dragManager.onpointerdown({target:touchGrip,pointerType:'touch',pointerId:7,clientX:10,clientY:100,preventDefault(){}});
dragManager.onpointermove({pointerId:7,clientX:12,clientY:101,preventDefault(){}});assert.equal(run('papers[0].tags[0]'),'ML-DSA');
dragManager.onpointermove({pointerId:7,clientX:30,clientY:110,preventDefault(){}});await dragManager.onpointerup({pointerId:7,clientX:30,clientY:110});assert.equal(touchGrip.capture,null);assert.equal(run('papers[0].tags[0]'),'PQC/ML-DSA');
// Canceling a drag keeps its saved hierarchy.
nativeStart(dragGrip('PQC/ML-DSA'));dragManager.onkeydown({key:'Escape',preventDefault(){},stopPropagation(){}});await nativeDrop(rootZone);assert.equal(run('papers[0].tags[0]'),'PQC/ML-DSA');
// Collision drops open the preselected Move dialog instead of silently merging.
run("papers.push({id:'collision',title:'Collision',authors:'',venue:'',tags:['ML-DSA'],status:'unread',importance:'normal',notes:''});settings.collections.push('ML-DSA');manageCollections()");
nativeStart(dragGrip('ML-DSA'));await nativeDrop(pqcZone);assert.match(node('#modal-content').innerHTML,/Move collection/);assert.equal(node('#move-collection-parent').value,'PQC');assert.equal(node('#move-merge-warning').hidden,false);assert.equal(run('papers[2].tags[0]'),'ML-DSA');
node('#move-merge-confirm').checked=true;await node('#move-collection-form').onsubmit({preventDefault(){}});assert.equal(run('papers[2].tags[0]'),'PQC/ML-DSA');
console.log('Collection drag/drop: native and touch moves, root drops, descendant guards, cancellation, external drops, and merge confirmation passed.');
