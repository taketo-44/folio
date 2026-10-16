import assert from 'node:assert/strict';
import {parseCitation,fetchArticle,createMetadataServer} from '../server/metadata.mjs';

// Citation meta tags from https://eprint.iacr.org/2006/139 (no abstract or PDF).
const fixture=`<meta name="citation_title" content="A Unified Framework for the Analysis of Side-Channel Key Recovery Attacks (extended version)">
<meta name="citation_author" content="Francois-Xavier Standaert">
<meta name="citation_author" content="Tal G.  Malkin">
<meta name="citation_author" content="Moti Yung">
<meta name="citation_journal_title" content="Cryptology ePrint Archive">
<meta name="citation_publication_date" content="2006">
<h5>Abstract</h5><p>A synthetic abstract about &amp; side channels.</p>
<meta name="citation_pdf_url" content="https://eprint.iacr.org/2006/139.pdf">`;
const paper=parseCitation(fixture,'2006/139','eprint');
assert.equal(paper.title,'A Unified Framework for the Analysis of Side-Channel Key Recovery Attacks (extended version)');
assert.equal(paper.authors,'Francois-Xavier Standaert; Tal G.  Malkin; Moti Yung');
assert.equal(paper.year,2006);
assert.equal(paper.venue,'Cryptology ePrint Archive');
assert.equal(paper.type,'posted-content');
assert.equal(paper.metadataSource,'IACR ePrint');
assert.equal(paper.url,'https://eprint.iacr.org/2006/139');
assert.equal(paper.doi,'');assert.equal(paper.abstract,'A synthetic abstract about & side channels.');
await assert.rejects(fetchArticle('../139','eprint'),/Invalid/);
await assert.rejects(fetchArticle('https://127.0.0.1','eprint'),/Invalid/);
await assert.rejects(fetchArticle('2006/139','unknown'),/Invalid/);
let calls=0;
const server=createMetadataServer(async(id,source)=>{calls++;assert.equal(source,'eprint');assert.equal(id,'2006/139');return fixture});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
try{
  const response=await fetch(origin+'/api/eprint?id=2006%2F139');
  assert.equal(response.status,200);assert.deepEqual(await response.json(),paper);
  assert.equal((await fetch(origin+'/api/eprint?id=2006%2F139')).status,200);assert.equal(calls,1);
  for(const query of ['id=139','id=2006/0','id=2006/139.pdf','id=2006/../139','id=2006/139&url=https://evil.test','id=2006/139&id=2020/1','id=https://127.0.0.1','id=2006/139%0A'])assert.equal((await fetch(origin+'/api/eprint?'+query)).status,400);
  assert.equal((await fetch(origin+'/api/eprint?id=2006/139',{headers:{Origin:'https://evil.test'}})).status,403);
  assert.equal((await fetch(origin+'/api/eprint?id=2006/139',{method:'POST'})).status,405);
  assert.equal(calls,1);
  console.log('Passed: ePrint 2006/139 metadata, publisher-only requests, cache, and invalid/cross-origin input rejection.');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
