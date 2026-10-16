import assert from 'node:assert/strict';
import {parseCitation,fetchArticle,createMetadataServer} from '../server/metadata.mjs';

// Representative scholarly tags and embedded metadata formats; no PDF fetches.
const html=`<meta name="citation_title" content="IEEE &amp; citation lookup"><meta name="citation_author" content="Alice Example"><meta name="citation_conference_title" content="2024 IEEE Symposium on Security and Privacy"><meta name="citation_publication_date" content="2024/05/20"><meta name="citation_doi" content="10.1109/EXAMPLE.2024.123">`;
const parsed=parseCitation(html,'1234567','ieee');
assert.equal(parsed.title,'IEEE & citation lookup');assert.equal(parsed.type,'proceedings-article');assert.equal(parsed.venue,'2024 IEEE Symposium on Security and Privacy');assert.equal(parsed.year,2024);assert.equal(parsed.url,'https://ieeexplore.ieee.org/document/1234567');
const embedded='xplGlobal.document.metadata = '+JSON.stringify({title:'Journal paper',authors:[{name:'A. Author'},{name:'B. Author'}],publicationTitle:'IEEE Transactions on Information Forensics and Security',publicationDate:'2021',doi:'10.1109/TIFS.2020.3045904',contentType:'Journals'})+';';
const journal=parseCitation(embedded,'7654321','ieee');assert.equal(journal.authors,'A. Author; B. Author');assert.equal(journal.year,2021);assert.equal(journal.type,'journal-article');
assert.throws(()=>parseCitation('<html>Please enable JavaScript</html>','1234567','ieee'),/IEEE Xplore did not return/);
assert.throws(()=>parseCitation('xplGlobal.document.metadata = {notJSON: true};','1234567','ieee'),/did not return/);
for(const id of ['../123','https://127.0.0.1','0','123?url=evil','123\n'])await assert.rejects(fetchArticle(id,'ieee'),/Invalid/);
let calls=0;
const server=createMetadataServer(async(id,source)=>{calls++;assert.equal(source,'ieee');return id==='7654321'?embedded:html});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{
 assert.deepEqual(await (await fetch(origin+'/api/ieee?id=1234567')).json(),parsed);
 assert.equal((await fetch(origin+'/api/ieee?id=1234567')).status,200);assert.equal(calls,1);
 assert.equal((await fetch(origin+'/api/ieee?id=7654321')).status,200);
 for(const query of ['id=0','id=../123','id=https://evil.test','id=123&id=456','id=123&url=https://evil.test'])assert.equal((await fetch(origin+'/api/ieee?'+query)).status,400);
 assert.equal((await fetch(origin+'/api/ieee?id=1234567',{headers:{Origin:'https://evil.test'}})).status,403);
 assert.equal((await fetch(origin+'/api/ieee?id=1234567',{method:'POST'})).status,405);
 console.log('Passed: IEEE scholarly/embedded metadata, conference types, fixed-host input, caching and request guards.');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
