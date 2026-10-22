// Guofei Gu's personal ranking, retrieved 2026-10-22. No ranking year is published.
export const securityRankSource='https://people.engr.tamu.edu/guofei/sec_conf_stat.htm';
// Aliases identify venue families; TCHES uses the CHES conference tier.
export const securityVenues=[
 [1,'S&P','IEEE Symposium on Security and Privacy','S&P','IEEE S&P','Oakland','IEEE SP'],
 [1,'CCS','ACM Conference on Computer and Communications Security','CCS','ACM CCS'],
 [1,'USENIX Security','USENIX Security Symposium','USENIX Security','Security'],
 [1,'NDSS','Network and Distributed System Security Symposium','NDSS','Network and Distributed Systems Security Symposium'],
 [1,'CRYPTO','International Cryptology Conference','CRYPTO','Advances in Cryptology CRYPTO'],
 [1,'EUROCRYPT','European Cryptology Conference','EUROCRYPT','Advances in Cryptology EUROCRYPT'],
 [2,'ESORICS','European Symposium on Research in Computer Security','ESORICS'],
 [2,'RAID','International Symposium on Recent Advances in Intrusion Detection','RAID','International Symposium on Research in Attacks Intrusions and Defenses'],
 [2,'ACSAC','Annual Computer Security Applications Conference','ACSAC'],
 [2,'DSN','International Conference on Dependable Systems and Networks','DSN'],
 [2,'IMC','Internet Measurement Conference','IMC'],
 [2,'ASIACCS','ACM Symposium on Information Computer and Communications Security','ASIACCS','Asia CCS','AsiaCCS'],
 [2,'PETS','Privacy Enhancing Technologies Symposium','PETS','PoPETs','Proceedings on Privacy Enhancing Technologies'],
 [2,'EuroS&P','IEEE European Symposium on Security and Privacy','EuroS&P','Euro S&P','EuroSP','IEEE Euro SP'],
 [2,'CSF','IEEE Computer Security Foundations Symposium','CSF','CSFW','Computer Security Foundations Workshop'],
 [2,'SOUPS','Symposium on Usable Privacy and Security','SOUPS'],
 [2,'ASIACRYPT','International Conference on the Theory and Application of Cryptology and Information Security','ASIACRYPT','Advances in Cryptology ASIACRYPT'],
 [2,'TCC','Theory of Cryptography Conference','TCC'],
 [2,'CHES / TCHES','Conference on Cryptographic Hardware and Embedded Systems','CHES','TCHES','CHES TCHES','Cryptographic Hardware and Embedded Systems','IACR Transactions on Cryptographic Hardware and Embedded Systems','Transactions on CHES'],
 [2,'FC','International Conference on Financial Cryptography and Data Security','FC','Financial Cryptography and Data Security','Financial Cryptography'],
 [3,'SecureComm','International Conference on Security and Privacy in Communication Networks','SecureComm','Security and Privacy in Communication Networks'],
 [3,'CNS','IEEE Conference on Communications and Network Security','CNS'],
 [3,'DIMVA','Detection of Intrusions and Malware and Vulnerability Assessment','DIMVA'],
 [3,'ACNS','International Conference on Applied Cryptography and Network Security','ACNS','Applied Cryptography and Network Security'],
 [3,'SAC','ACM Symposium on Applied Computing','SAC'],
 [3,'ACISP','Australasia Conference on Information Security and Privacy','ACISP','Australasian Conference on Information Security and Privacy'],
 [3,'ICICS','International Conference on Information and Communications Security','ICICS'],
 [3,'ISC','Information Security Conference','ISC'],
 [3,'ICISC','International Conference on Information Security and Cryptology','ICISC'],
 [3,'SACMAT','ACM Symposium on Access Control Models and Technologies','SACMAT'],
 [3,'IFIP SEC','IFIP International Information Security Conference','IFIP SEC'],
 [3,'WiSec','ACM Conference on Wireless Network Security','WiSec','WiSe','SASN','ACM Workshop on Wireless Security','ACM Workshop on Security of Ad Hoc and Sensor Networks','ACM Conference on Security and Privacy in Wireless and Mobile Networks'],
 [3,'IFIP WG 11.9','IFIP WG 11.9 International Conference on Digital Forensics','IFIP WG 11.9'],
 [3,'DFRWS','Digital Forensic Research Conference','DFRWS','Digital Forensics Research Conference','Digital Forensic Research Workshop'],
 [3,'CODASPY','ACM Conference on Data and Application Security and Privacy','CODASPY'],
 [3,'CANS','Cryptology and Network Security Conference','CANS','Cryptology and Network Security'],
 [3,'PST','International Conference on Privacy Security and Trust','PST'],
 [3,'FSE','Conference on Fast Software Encryption','FSE','Fast Software Encryption'],
 [3,'PKC','International Conference on Practice and Theory in Public Key Cryptography','PKC','Public Key Cryptography'],
 [3,'CT-RSA','RSA Conference Cryptographers Track','CT-RSA','CT RSA','Cryptographers Track at the RSA Conference'],
 [3,'HOST','IEEE International Symposium on Hardware Oriented Security and Trust','HOST'],
 [3,'HotSec','USENIX Summit on Hot Topics in Security','HotSec','USENIX Workshop on Hot Topics in Security'],
 [3,'NSPW','New Security Paradigms Workshop','NSPW'],
 [3,'IH&MMSec','Workshop on Information Hiding and Multimedia Security','IH&MMSec','IH MMSec'],
 [3,'IWIA','IEEE International Information Assurance Workshop','IWIA'],
 [null,'SecDev','IEEE Secure Development Conference','SecDev'],
 [null,'ISPEC','Information Security Practice and Experience Conference','ISPEC','Information Security Practice and Experience'],
 [null,'NordSec','Nordic Conference on Secure IT Systems','NordSec'],
 [null,'ICITS','International Conference on Information Theoretic Security','ICITS'],
 [null,'MALCON','International Conference on Malicious and Unwanted Software','MALCON']
].map(([tier,name,...aliases])=>({tier,name,aliases}));

// Hardware, circuits, EDA and architecture presets from the ICORE 2026 portal.
// Keep its letter ranks and publication categories separate from security tiers.
export const technicalVenues=[
 ['A','DATE','Design Automation and Test in Europe','Design Automation and Test in Europe Conference','Design Automation and Test in Europe Conference and Exhibition'],
 ['C','ISCAS','IEEE International Symposium on Circuits and Systems'],
 ['A*','DAC','Design Automation Conference','Design Automation Conf','Design Automation Conference DAC'],
 ['A','ICCAD','IEEE ACM International Conference on Computer Aided Design'],
 ['B','ASP-DAC','ASPDAC','ASP DAC','Asia and South Pacific Design Automation Conference'],
 ['A','FPGA','ACM International Symposium on Field Programmable Gate Arrays',"ACM Int'l Symposium on Field Programmable Gate Arrays"],
 ['B','FPL','Field Programmable Logic and Applications','International Conference on Field Programmable Logic and Applications'],
 ['National/Regional','FCCM','IEEE Symposium on Field Programmable Custom Computing Machines','IEEE International Symposium on Field Programmable Custom Computing Machines'],
 ['C','ICCD','IEEE International Conference on Computer Design'],
 ['A','ISLPED','IEEE ACM International Symposium on Low Power Electronics and Design'],
 ['A','ITC','IEEE International Test Conference'],
 ['B','ETS','IEEE European Test Symposium'],
 ['National/Regional','VTS','IEEE VLSI Test Symposium'],
 ['C','VLSI-SoC','VLSI SOC','IEEE IFIP International Conference on Very Large Scale Integration of System on Chip'],
 ['Journal Published','EMSOFT','International Conference on Embedded Software'],
 ['Journal Published','CODES+ISSS','CODES ISSS','CODESISSS','International Conference on Hardware Software Codesign and System Synthesis','International Conference on Hardware Software Co Design and System Synthesis'],
 ['A*','ISCA','ACM International Symposium on Computer Architecture'],
 ['A*','MICRO','International Symposium on Microarchitecture'],
 ['A*','HPCA','IEEE International Symposium on High Performance Computer Architecture']
].map(([rank,name,...aliases])=>({name,rank,metricType:'ICORE rank',year:2026,
 source:`https://portal.core.edu.au/conf-ranks/?by=acronym&search=${encodeURIComponent(name==='ASP-DAC'?'ASPDAC':name)}&source=ICORE2026`,
 aliases:[name,...aliases]}));

function normalizeVenue(value){
 return String(value||'').normalize('NFKC').toLowerCase()
  .replace(/\btransactions?\s+(?:of|on)\b/g,'transactions on')
  .replace(/&/g,' and ').replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
// Strip citation wrappers, publishers, years and edition numbers, not arbitrary words.
function citationName(value){
 return normalizeVenue(value).replace(/\b(?:19|20)\d{2}\b/g,' ')
  .replace(/\b\d+(?:st|nd|rd|th)\b/g,' ')
  .replace(/\b(?:proceedings of|proceedings|the|ieee|acm|sigsac|iacr|isoc|eai)\b/g,' ')
  .replace(/\s+/g,' ').trim();
}
const venueAliases=securityVenues.flatMap(venue=>venue.aliases.map(alias=>({venue,alias:citationName(alias)})))
 .sort((a,b)=>b.alias.length-a.alias.length);
const technicalAliases=technicalVenues.flatMap(venue=>venue.aliases.map(alias=>({venue,alias:citationName(alias)})))
 .sort((a,b)=>b.alias.length-a.alias.length);
function matchVenue(value,aliases){
 const name=citationName(value);
 if(!name)return null;
 // Short acronyms only match complete names, so HOST never matches a word in a title.
 return aliases.find(({alias})=>name===alias||
  (alias.split(' ').length>=4&&` ${name} `.includes(` ${alias} `)))?.venue||null;
}
export function securityVenueRank(value){
 const match=matchVenue(value,venueAliases);
 return match?{name:match.name,tier:match.tier,source:securityRankSource}:null;
}
export function presetVenueRank(value){
 const match=matchVenue(value,technicalAliases);
 if(match){const {aliases,...metric}=match;return metric}
 return securityVenueRank(value);
}
