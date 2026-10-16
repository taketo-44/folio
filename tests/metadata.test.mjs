import assert from 'node:assert/strict';
import {parseCitation,createMetadataServer} from '../server/metadata.mjs';

const fixture=`<meta content='A &amp; B &#x2013; &#233;' name='citation_title'>
<meta NAME="citation_author" CONTENT="Alice &quot;A&quot; Example">
<meta name="citation_author" content="Bob Example">
<meta content="2021/07/09" name="citation_date">
<meta name="citation_journal_title" content="TCHES">
<meta name="citation_doi" content="10.46586/tches.v2021.i3.60-96">`;
const paper=parseCitation(fixture,'2006/139');
assert.equal(paper.title,'A & B \u2013 \u00e9');
assert.equal(paper.authors,'Alice "A" Example; Bob Example');
assert.equal(paper.year,2021);
assert.equal(paper.doi,'10.46586/tches.v2021.i3.60-96');
assert.equal(paper.url,'https://eprint.iacr.org/2006/139');
assert.throws(()=>parseCitation('<html>blocked</html>','2006/139'),/citation details/);

let calls=0;
const server=createMetadataServer(async id=>{calls++;assert.match(id,/^2006\/[1-9]\d*$/);return fixture});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
try {
  assert.equal((await fetch(origin+'/api/eprint?id=2006/139')).status,200);
  assert.equal((await fetch(origin+'/api/eprint?id=2006/139')).status,200);
  assert.equal(calls,1,'repeat lookup is cached');
  for (const query of ['id=https://127.0.0.1','id=1&url=https://evil.test','id=1&id=2','id=../1','id=0','id=1%0A']) {
    assert.equal((await fetch(origin+'/api/eprint?'+query)).status,400);
  }
  assert.equal((await fetch(origin+'/api/eprint?id=2006/139',{method:'POST'})).status,405);
  assert.equal((await fetch(origin+'/api/eprint?id=2006/139',{headers:{Origin:'https://evil.test'}})).status,403);
  assert.equal((await fetch(origin+'/api/eprint?id=2006/139',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  assert.equal((await fetch(origin+'/not-found')).status,404);
  for(let id=1;id<20;id++) assert.equal((await fetch(origin+'/api/eprint?id=2006/'+id)).status,200);
  assert.equal((await fetch(origin+'/api/eprint?id=2006/20')).status,429);
  assert.equal(calls,20,'invalid, cross-site and cached requests do not fetch the publisher');
} finally {
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
const failed=createMetadataServer(async()=>{throw new Error('network unavailable')});
await new Promise(resolve=>failed.listen(0,'127.0.0.1',resolve));
try {
  const response=await fetch('http://127.0.0.1:'+failed.address().port+'/api/eprint?id=2006/139');
  assert.equal(response.status,502);
  assert.match((await response.json()).error,/manually/);
} finally {
  failed.closeAllConnections();
  await new Promise(resolve=>failed.close(resolve));
}
console.log('Passed: citation parsing, bounded lookup, cache, publisher-only input, cross-site rejection and error fallback.');
