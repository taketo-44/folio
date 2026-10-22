import assert from 'node:assert/strict';
import {securityVenues,securityVenueRank,journalVenues,technicalVenues,presetVenueRank} from '../dist/venue-ranks.js';

for(const venue of securityVenues){
 for(const alias of venue.aliases){
  const result=securityVenueRank(alias);
  assert.equal(result?.name,venue.name,alias);
  assert.equal(result?.rank,venue.rank,alias);
  assert.equal(result?.year,venue.year,alias);
  assert.equal(result?.tier,undefined);
 }
}
for(const [input,name,tier] of [
 ['  acm ccs 2026  ','CCS',1],
 ['Proceedings of the 31st ACM SIGSAC Conference on Computer and Communications Security','CCS',1],
 ['Proceedings of the 2025 ACM Conference on Computer & Communications Security (CCS)','CCS',1],
 ['CHES','CHES / TCHES',2],['TCHES','CHES / TCHES',2],
 ['IACR Transactions on Cryptographic Hardware and Embedded Systems, 2025(2)','CHES / TCHES',2],
 ['Transaction of Cryptographic Hardware and Embedded Systems','CHES / TCHES',2],
 ['Transactions of Cryptographic Hardware & Embedded Systems','CHES / TCHES',2],
 ['IEEE Symposium on Security & Privacy (S&P), 2025','S&P',1],
 ['IEEE European Symposium on Security and Privacy (EuroS&P), 2025','EuroS&P',2],
 ['EUROCRYPT 2025','EUROCRYPT',1],['ASIACRYPT 2025','ASIACRYPT',2],
 ['Annual Computer Security Applications Conference','ACSAC',2],
 ['IFIP WG 11.9','IFIP WG 11.9',3],['SecDev','SecDev',null]
]){
 const result=securityVenueRank(input);
 assert.equal(result?.name,name,input);assert.equal(result?.tier,undefined,input);
}
for(const input of ['',null,'arXiv','Cryptology ePrint Archive','IEEE TIFS',
 'A cryptographic host system','CCS unrelated conference','SACMAT workshop',
 'Selected Areas in Cryptography','ACM Conference','Transactions on Something Else']){
 assert.equal(securityVenueRank(input),null,String(input));
}
console.log('Security venue rankings: all presets, full names, aliases, citation wrappers and unknown venues passed.');

for(const venue of technicalVenues){
 for(const alias of venue.aliases){
  const result=presetVenueRank(alias);
  assert.equal(result?.name,venue.name,alias);
  assert.equal(result?.rank,venue.rank,alias);
  assert.equal(result?.year,2026);
  assert.equal(result?.metricType,'ICORE rank');
  assert.equal(result?.source,venue.source);
  assert.equal(result?.tier,undefined);
 }
}
for(const [input,name,rank] of [
 ['DATE 2026','DATE','A'],
 ['Design, Automation & Test in Europe Conference & Exhibition (DATE)','DATE','A'],
 ['2025 IEEE International Symposium on Circuits and Systems (ISCAS)','ISCAS','C'],
 ['IEEE ISCAS 2026','ISCAS','C'],
 ['Proceedings of the 63rd ACM/IEEE Design Automation Conference (DAC)','DAC','A*'],
 ['2026 IEEE/ACM International Conference on Computer-Aided Design (ICCAD)','ICCAD','A'],
 ['ASP-DAC 2026','ASP-DAC','B'],['ASPDAC','ASP-DAC','B'],
 ['2026 ACM International Symposium on Field-Programmable Gate Arrays (FPGA)','FPGA','A'],
 ['IEEE/ACM International Symposium on Low-Power Electronics and Design','ISLPED','A'],
 ['CODES/ISSS','CODES+ISSS','Journal Published'],
 ['IEEE International Symposium on High-Performance Computer Architecture','HPCA','A*'],
 ['IEEE FCCM','FCCM','National/Regional']
]){
 const result=presetVenueRank(input);
 assert.equal(result?.name,name,input);assert.equal(result?.rank,rank,input);
}
for(const input of ['Update date','Micro systems journal','ISCA unrelated event','ISCASS','IEEE Transactions on Circuits and Systems'])assert.equal(presetVenueRank(input),null,input);
assert.equal(presetVenueRank('ISCAS').name,'ISCAS');
assert.equal(presetVenueRank('ISCA').name,'ISCA');
assert.equal(presetVenueRank('ISC').name,'ISC');
assert.equal(presetVenueRank('CCS').rank,'A*');
assert.equal(presetVenueRank('TCHES').rank,'A');
console.log('Technical venue presets: all aliases, ICORE ranks/categories, editions, citation names and acronym boundaries passed.');

for(const venue of journalVenues)for(const alias of venue.aliases){const result=presetVenueRank(alias);assert.equal(result.name,venue.name,alias);assert.equal(result.rank,venue.rank,alias);assert.equal(result.year,venue.year,alias)}
for(const alias of ['TIFS','IEEE TIFS','T-IFS','Transaction of Information Forensics & Security']){const metric=presetVenueRank(alias);assert.equal(metric.rank,'8.0');assert.equal(metric.year,2024);assert.equal(metric.metricType,'Journal impact factor')}
for(const alias of ['CiC','IACR CiC','Communications in Cryptology','IACR Communications in Cryptology']){const venue=presetVenueRank(alias);assert.equal(venue.name,'IACR CiC');assert.equal(venue.rank,undefined);assert.equal(venue.year,undefined)}
console.log('Journal aliases, dated IEEE impact factors and CiC without invented metrics passed.');

for(const alias of ['CC','IACR CC'])assert.equal(presetVenueRank(alias),null,alias);
