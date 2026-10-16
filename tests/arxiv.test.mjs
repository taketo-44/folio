import assert from 'node:assert/strict';
import {parseArxiv,isArxivId} from '../server/arxiv.mjs';
import {parseCitation,fetchArticle,createMetadataServer} from '../server/metadata.mjs';
const atom=`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom"><title>Feed title must not become paper title</title><entry><id>http://arxiv.org/abs/1706.03762v2</id><title>A synthetic
 preprint &amp; its analysis</title><published>2017-06-12T00:00:00Z</published><updated>2024-01-01T00:00:00Z</updated><summary>An abstract about ML-DSA &amp; ML-KEM.</summary><author><name>Alice Example</name></author><author><name>Bob Example</name></author></entry></feed>`;
const paper=parseArxiv(atom,'1706.03762');
assert.equal(paper.title,'A synthetic preprint & its analysis');assert.equal(paper.authors,'Alice Example; Bob Example');assert.equal(paper.year,2017);assert.equal(paper.abstract,'An abstract about ML-DSA & ML-KEM.');assert.equal(paper.doi,'');assert.equal(paper.type,'posted-content');assert.equal(paper.venue,'arXiv');assert.equal(paper.url,'https://arxiv.org/abs/1706.03762');
assert.deepEqual(parseCitation(atom,'1706.03762','arxiv'),paper);
assert.equal(parseArxiv(atom.replace('</entry>','<arxiv:doi>10.1000/example</arxiv:doi></entry>'),'1706.03762').doi,'10.1000/example');
assert.equal(parseArxiv(atom,'1706.03762v2').url,'https://arxiv.org/abs/1706.03762v2');
assert.throws(()=>parseArxiv(atom,'1706.03762v3'),/did not return/);
assert.throws(()=>parseArxiv(atom,'1706.00001'),/did not return/);
assert.throws(()=>parseArxiv('<feed><entry><id>http://arxiv.org/api/errors</id><title>Error</title></entry></feed>','1706.03762'),/did not return/);
assert.throws(()=>parseArxiv('<!DOCTYPE feed>'+atom,'1706.03762'),/Invalid/);
for(const id of ['1706.03762','2501.12345v12','hep-th/9901001','math.GT/0309136v2'])assert.equal(isArxivId(id),true);
for(const id of ['1700.12345','1713.12345','../123','1706.03762v0','1706.03762\n']){assert.equal(isArxivId(id),false);await assert.rejects(fetchArticle(id,'arxiv'),/Invalid/);}
let calls=0;const server=createMetadataServer(async(id,source)=>{calls++;assert.equal(source,'arxiv');assert.equal(id,'1706.03762');return atom});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{
 const response=await fetch(origin+'/api/arxiv?id=1706.03762');assert.equal(response.status,200);assert.deepEqual(await response.json(),paper);
 assert.equal((await fetch(origin+'/api/arxiv?id=1706.03762')).status,200);assert.equal(calls,1);
 for(const query of ['id=https://evil.test','id=../123','id=1706.03762&id=1706.00001','id=1706.03762&url=https://evil.test','id=1706.03762%0A'])assert.equal((await fetch(origin+'/api/arxiv?'+query)).status,400);
 assert.equal((await fetch(origin+'/api/arxiv?id=1706.03762',{headers:{Origin:'https://evil.test'}})).status,403);
 assert.equal((await fetch(origin+'/api/arxiv?id=1706.03762',{method:'POST'})).status,405);
 const limited=await fetch(origin+'/api/arxiv?id=1706.00001');assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'3');assert.equal(calls,1);
 console.log('Passed: arXiv Atom metadata without DOI, abstracts, versions, legacy IDs, fixed-host input, cache and request spacing.');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
