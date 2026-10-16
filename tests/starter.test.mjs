import {normalizeImportance} from '../dist/importance.js';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createStarterLibrary} from '../dist/starter-papers.js';

const first=createStarterLibrary(10000),second=createStarterLibrary(20000);
assert.equal(first.papers.length,5);
assert.deepEqual(first.papers.map(p=>p.url),[
 'https://doi.org/10.48550/arXiv.2607.22094',
 'https://doi.org/10.46586/tches.v2026.i2.325-346',
 'https://eprint.iacr.org/2026/1458',
 'https://doi.org/10.1145/3548606.3560579',
 'https://eprint.iacr.org/2021/849'
]);
assert.equal(new Set(first.papers.map(p=>p.id)).size,5);
assert.ok(first.papers.every(p=>p.sample&&p.title&&p.authors&&p.tags.length&&p.status==='unread'&&p.importance===3));
assert.equal(first.papers.filter(p=>p.abstract).length,2);
for(const paper of first.papers.filter(p=>p.abstract)){
 assert.ok(paper.abstract.length>500);assert.match(paper.notes,/CC BY 4.0/);assert.match(paper.notes,/https:\/\//);
}
assert.ok(first.papers[1].tags.includes('PQC/QR-UOV'));assert.ok(first.papers[2].tags.includes('PQC/QR-UOV'));
first.papers[0].tags.push('Private');first.papers[0].notes='Private';first.papers.pop();
assert.equal(second.papers.length,5);assert.ok(!second.papers[0].tags.includes('Private'));assert.equal(second.papers[0].notes,'');
assert.equal(second.papers[0].added,20000);assert.equal(second.papers[0].updated,20000);

// Exercise the actual browser bootstrap with the production starter factory and an existing empty library.
function bootstrap(stored=null){
 const nodes=new Map(),document={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{value:'',innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){}});return nodes.get(selector)},querySelectorAll(){return []},addEventListener(){}};
 const context=vm.createContext({normalizeImportance,createStarterLibrary,document,window:{addEventListener(){}},localStorage:{getItem(k){return k==='folio-library-v1'?stored:null}},location:{hash:''},setTimeout,clearTimeout,console});
 vm.runInContext(readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''),context);
 return {run:s=>vm.runInContext(s,context),nodes};
}
const fresh=bootstrap();assert.equal(fresh.run('papers.length'),5);assert.equal(fresh.run('existingTags().includes("PQC/QR-UOV")'),true);
assert.match(fresh.nodes.get('#main').innerHTML,/Remove sample papers/);
const empty=bootstrap('[]');assert.equal(empty.run('papers.length'),0,'an existing empty local library stays empty');
const existing=bootstrap(JSON.stringify([{id:'mine',title:'My saved paper',authors:'',venue:'',tags:[],status:'unread',importance:'normal'}]));assert.equal(existing.run('papers[0].id'),'mine');assert.equal(existing.run('papers.length'),1);
console.log('Five requested starter papers, tagged examples, licensed abstracts, independent copies, and local bootstrap preservation passed.');
