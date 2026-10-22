// Venue coverage originally based on Guofei Gu's security venue list.
// Metrics below use independently verified, dated sources; no personal tiers.
export const securityVenues=[
 ['S&P','IEEE Symposium on Security and Privacy','S&P','IEEE S&P','Oakland','IEEE SP'],
 ['CCS','ACM Conference on Computer and Communications Security','CCS','ACM CCS'],
 ['USENIX Security','USENIX Security Symposium','USENIX Security','Security'],
 ['NDSS','Network and Distributed System Security Symposium','NDSS','Network and Distributed Systems Security Symposium'],
 ['CRYPTO','International Cryptology Conference','CRYPTO','Advances in Cryptology CRYPTO'],
 ['EUROCRYPT','European Cryptology Conference','EUROCRYPT','Advances in Cryptology EUROCRYPT'],
 ['ESORICS','European Symposium on Research in Computer Security','ESORICS'],
 ['RAID','International Symposium on Recent Advances in Intrusion Detection','RAID','International Symposium on Research in Attacks Intrusions and Defenses'],
 ['ACSAC','Annual Computer Security Applications Conference','ACSAC'],
 ['DSN','International Conference on Dependable Systems and Networks','DSN'],
 ['IMC','Internet Measurement Conference','IMC'],
 ['ASIACCS','ACM Symposium on Information Computer and Communications Security','ASIACCS','Asia CCS','AsiaCCS'],
 ['PETS','Privacy Enhancing Technologies Symposium','PETS','PoPETs','Proceedings on Privacy Enhancing Technologies'],
 ['EuroS&P','IEEE European Symposium on Security and Privacy','EuroS&P','Euro S&P','EuroSP','IEEE Euro SP'],
 ['CSF','IEEE Computer Security Foundations Symposium','CSF','CSFW','Computer Security Foundations Workshop'],
 ['SOUPS','Symposium on Usable Privacy and Security','SOUPS'],
 ['ASIACRYPT','International Conference on the Theory and Application of Cryptology and Information Security','ASIACRYPT','Advances in Cryptology ASIACRYPT'],
 ['TCC','Theory of Cryptography Conference','TCC'],
 ['CHES / TCHES','Conference on Cryptographic Hardware and Embedded Systems','CHES','TCHES','CHES TCHES','Cryptographic Hardware and Embedded Systems','IACR Transactions on Cryptographic Hardware and Embedded Systems','Transactions on CHES'],
 ['FC','International Conference on Financial Cryptography and Data Security','FC','Financial Cryptography and Data Security','Financial Cryptography'],
 ['SecureComm','International Conference on Security and Privacy in Communication Networks','SecureComm','Security and Privacy in Communication Networks'],
 ['CNS','IEEE Conference on Communications and Network Security','CNS'],
 ['DIMVA','Detection of Intrusions and Malware and Vulnerability Assessment','DIMVA'],
 ['ACNS','International Conference on Applied Cryptography and Network Security','ACNS','Applied Cryptography and Network Security'],
 ['SAC','ACM Symposium on Applied Computing','SAC'],
 ['ACISP','Australasia Conference on Information Security and Privacy','ACISP','Australasian Conference on Information Security and Privacy'],
 ['ICICS','International Conference on Information and Communications Security','ICICS'],
 ['ISC','Information Security Conference','ISC'],
 ['ICISC','International Conference on Information Security and Cryptology','ICISC'],
 ['SACMAT','ACM Symposium on Access Control Models and Technologies','SACMAT'],
 ['IFIP SEC','IFIP International Information Security Conference','IFIP SEC'],
 ['WiSec','ACM Conference on Wireless Network Security','WiSec','WiSe','SASN','ACM Workshop on Wireless Security','ACM Workshop on Security of Ad Hoc and Sensor Networks','ACM Conference on Security and Privacy in Wireless and Mobile Networks'],
 ['IFIP WG 11.9','IFIP WG 11.9 International Conference on Digital Forensics','IFIP WG 11.9'],
 ['DFRWS','Digital Forensic Research Conference','DFRWS','Digital Forensics Research Conference','Digital Forensic Research Workshop'],
 ['CODASPY','ACM Conference on Data and Application Security and Privacy','CODASPY'],
 ['CANS','Cryptology and Network Security Conference','CANS','Cryptology and Network Security'],
 ['PST','International Conference on Privacy Security and Trust','PST'],
 ['FSE','Conference on Fast Software Encryption','FSE','Fast Software Encryption'],
 ['PKC','International Conference on Practice and Theory in Public Key Cryptography','PKC','Public Key Cryptography'],
 ['CT-RSA','RSA Conference Cryptographers Track','CT-RSA','CT RSA','Cryptographers Track at the RSA Conference'],
 ['HOST','IEEE International Symposium on Hardware Oriented Security and Trust','HOST'],
 ['HotSec','USENIX Summit on Hot Topics in Security','HotSec','USENIX Workshop on Hot Topics in Security'],
 ['NSPW','New Security Paradigms Workshop','NSPW'],
 ['IH&MMSec','Workshop on Information Hiding and Multimedia Security','IH&MMSec','IH MMSec'],
 ['IWIA','IEEE International Information Assurance Workshop','IWIA'],
 ['SecDev','IEEE Secure Development Conference','SecDev'],
 ['ISPEC','Information Security Practice and Experience Conference','ISPEC','Information Security Practice and Experience'],
 ['NordSec','Nordic Conference on Secure IT Systems','NordSec'],
 ['ICITS','International Conference on Information Theoretic Security','ICITS'],
 ['MALCON','International Conference on Malicious and Unwanted Software','MALCON']
].map(([name,...aliases])=>({name,aliases}));

// Hardware, circuits, EDA and architecture presets from the ICORE 2026 portal.
// Retain publication categories exactly as recorded by ICORE.
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

// Verified against the ICORE 2026 portal, retrieved 2026-10-22.
const securityMetrics={
 'S&P':'A*',CCS:'A*','USENIX Security':'A*',NDSS:'A*',CRYPTO:'A*',EUROCRYPT:'A*',
 ESORICS:'A',RAID:'A',ACSAC:'A',DSN:'A',IMC:'A',ASIACCS:'A',PETS:'A','EuroS&P':'A',CSF:'A',SOUPS:'A',
 ASIACRYPT:'A',TCC:'B','CHES / TCHES':'A',FC:'A',SecureComm:'C',DIMVA:'B',ACNS:'B',
 SAC:'Multiconference',ACISP:'Australasian B',ICICS:'C',ISC:'C',ICISC:'National: Korea',SACMAT:'C',
 'IFIP SEC':'B',WiSec:'B',CANS:'B',PST:'C',FSE:'B',PKC:'B','CT-RSA':'B',NSPW:'C','IH&MMSec':'C',ISPEC:'C'
};
const coreAcronyms={'S&P':'SP','USENIX Security':'USENIX-Security','CHES / TCHES':'CHES',WiSec:'ACM_WiSec'};
for(const venue of securityVenues){
 if(!securityMetrics[venue.name])continue;
 Object.assign(venue,{rank:securityMetrics[venue.name],metricType:'ICORE rank',year:2026,
  source:`https://portal.core.edu.au/conf-ranks/?by=acronym&search=${encodeURIComponent(coreAcronyms[venue.name]||venue.name)}&source=ICORE2026`});
}
// 2024 JIF values from IEEE's January 2026 title list (2025 JCR release).
const ieeeJournalSource='https://open.ieee.org/wp-content/uploads/IEEE-Title-List-January-2026.pdf';
export const journalVenues=[
 ['8.0','IEEE TIFS','TIFS','T-IFS','IEEE Transactions on Information Forensics and Security','IEEE Trans. Inf. Forensics Security','IEEE Trans. Inf. Forensics Secur.'],
 ['7.5','IEEE TDSC','TDSC','T-DSC','IEEE Transactions on Dependable and Secure Computing'],
 ['2.9','IEEE TCAD','TCAD','T-CAD','IEEE Transactions on Computer Aided Design of Integrated Circuits and Systems'],
 ['3.8','IEEE TC','TC','T-C','IEEE Transactions on Computers'],
 ['2.9','IEEE TIT','TIT','T-IT','IEEE Transactions on Information Theory'],
 ['8.3','IEEE TCOM','TCOM','TCOMM','T-COMM','IEEE Transactions on Communications','IEEE Transactions on Communications TCOM','IEEE Transactions on Communications TCOMM','IEEE Trans. Commun.'],
 ['10.7','IEEE TWC','TWC','T-WC','IEEE Transactions on Wireless Communications','IEEE Trans. Wireless Commun.'],
 ['17.2','IEEE JSAC','JSAC','J-SAC','IEEE Journal on Selected Areas in Communications','IEEE J. Sel. Areas Commun.'],
 ['46.7','IEEE COMST','COMST','IEEE Communications Surveys and Tutorials','IEEE Commun. Surveys Tuts.'],
 ['4.4','IEEE Communications Letters','COMML','L-COMM','IEEE Commun. Lett.'],
 ['5.5','IEEE WCL','WCL','L-WC','IEEE Wireless Communications Letters','IEEE Wireless Commun. Lett.'],
 ['6.1','IEEE OJCOMS','OJCOMS','IEEE Open Journal of the Communications Society','IEEE Open J. Commun. Soc.'],
 ['7.0','IEEE TCCN','TCCN','T-CCN','IEEE Transactions on Cognitive Communications and Networking','IEEE Trans. Cogn. Commun. Netw.'],
 ['6.7','IEEE TGCN','TGCN','T-GCN','IEEE Transactions on Green Communications and Networking','IEEE Trans. Green Commun. Netw.'],
 ['7.1','IEEE TVT','TVT','T-VT','IEEE Transactions on Vehicular Technology','IEEE Trans. Veh. Technol.'],
 ['3.6','IEEE TON','TON','T-ON','IEEE Transactions on Networking','IEEE ACM Transactions on Networking','IEEE Trans. Netw.','IEEE ACM Trans. Netw.','IEEE Transactions on Networking TON','IEEE ACM Transactions on Networking TON'],
 ['5.4','IEEE TNSM','TNSM','T-NSM','IEEE Transactions on Network and Service Management','IEEE Trans. Netw. Serv. Manag.'],
 ['7.9','IEEE TNSE','TNSE','T-NSE','IEEE Transactions on Network Science and Engineering','IEEE Trans. Netw. Sci. Eng.'],
 ['8.9','IEEE IoTJ','IoTJ','IoT-J','J-IOT','IEEE Internet of Things Journal','IEEE Internet Things J.']
].map(([rank,name,...aliases])=>({name,rank,metricType:'Journal impact factor',year:2024,source:ieeeJournalSource,aliases:[name,...aliases]}));
// Recognized journal; no verified dated metric is available in these sources.
journalVenues.push({name:'IACR CiC',aliases:['CiC','IACR CiC','Communications in Cryptology','IACR Communications in Cryptology'],source:'https://cic.iacr.org/'});

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
const technicalAliases=[...technicalVenues,...journalVenues].flatMap(venue=>venue.aliases.map(alias=>({venue,alias:citationName(alias)})))
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
 if(!match)return null;const {aliases,...metric}=match;return metric;
}
export function presetVenueRank(value){
 const match=matchVenue(value,technicalAliases);
 if(match){const {aliases,...metric}=match;return metric}
 return securityVenueRank(value);
}
