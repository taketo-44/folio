const idPattern=/^(?:\d{2}(?:0[1-9]|1[0-2])\.\d{4,5}|[a-z-]+(?:\.[a-z]{2})?\/\d{2}(?:0[1-9]|1[0-2])\d{3})(?:v[1-9]\d{0,3})?$/i;
export const isArxivId=id=>typeof id==='string'&&idPattern.test(id);
export function parseArxiv(xml,id){
 if(!isArxivId(id)||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Invalid arXiv citation response.');
 const decode=value=>value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(original,entity)=>{
  const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(entity[0]!=='#')return named[entity.toLowerCase()]||original;
  const code=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));return code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):original;
 });
 const text=value=>decode(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
 const read=(body,name)=>text(body.match(new RegExp('<(?:[\\w-]+:)?'+name+'\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?'+name+'\\s*>','i'))?.[1]||'');
 const entries=xml.match(/<(?:[\w-]+:)?entry\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?entry\s*>/gi)||[];
 const entry=entries.find(body=>{try{const url=new URL(read(body,'id'));if(!['arxiv.org','export.arxiv.org'].includes(url.hostname)||!/^https?:$/.test(url.protocol))return false;const returned=url.pathname.replace(/^\/abs\//,'');if(!isArxivId(returned))return false;return /v\d+$/i.test(id)?returned.toLowerCase()===id.toLowerCase():returned.replace(/v\d+$/i,'').toLowerCase()===id.toLowerCase()}catch{return false}});
 if(!entry||!read(entry,'title'))throw new Error('arXiv did not return this paper. Check the identifier or enter citation details manually.');
 const doi=read(entry,'doi');
 return {title:read(entry,'title').slice(0,500),authors:(entry.match(/<(?:[\w-]+:)?author\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?author\s*>/gi)||[]).slice(0,100).map(author=>read(author,'name')).filter(Boolean).join('; ').slice(0,5000),year:Number(read(entry,'published').match(/^\d{4}/)?.[0])||'',abstract:read(entry,'summary').slice(0,20000),venue:'arXiv',doi:/^10\.\d{4,9}\/\S{1,2000}$/i.test(doi)?doi:'',url:'https://arxiv.org/abs/'+id,metadataSource:'arXiv',type:'posted-content'};
}
