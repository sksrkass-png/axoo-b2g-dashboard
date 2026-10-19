"use strict";
/**
 * P0+P1 official evidence enrichment.
 * Runs after both collectors and before priority builder.
 * Caches document reads separately, so source recrawls do not lose audit results.
 * Downloads only HTTPS documents from the same official institution host.
 */
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const {extractApplicationReview}=require("./support_application_review");
const {htmlToText}=require("./support_program_intelligence");
const ROOT=process.cwd(),CACHE=path.join(ROOT,"data/support_enrichment_cache.json");
const FILES=["data/support_programs.json","data/support_regional_programs.json"];
const LIMIT=12,MAX_FILE=10*1024*1024,CACHE_HOURS=72;
const NOW=new Date().toISOString();
const read=(f,def)=>{try{return JSON.parse(fs.readFileSync(f,"utf8"))}catch{return def}};
const write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+"\n");
const esc=s=>String(s||"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const trim=s=>String(s||"").replace(/\s+/g," ").trim();
const urlOk=(input,original)=>{
  try{
    const x=new URL(input,original),a=new URL(original);
    return x.protocol==="https:"&&x.hostname.toLowerCase()===a.hostname.toLowerCase()&&x.username===""&&x.password===""?x.toString():"";
  }catch{return""}
};
function discover(html,source){
  const items=[],seen=new Set();
  const re=/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  let m;
  while((m=re.exec(String(html||"")))){
    const href=m[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]||"";
    const label=trim(htmlToText(m[2]).slice(0,180));
    if(!href||href.startsWith("#")||/^javascript:/i.test(href))continue;
    const u=urlOk(esc(href),source);
    if(!u||seen.has(u))continue;
    const relevant=/\.pdf(?:[?#]|$)|\.hwpx?(?:[?#]|$)|\.docx?(?:[?#]|$)|\b(?:download|filedown|fileDownload|attach|fileSeq|atcFile|fileId)\b/i.test(u)||
      /(?:공고문|첨부파일|제출서식|지원신청서|사업계획서|자료집|신청양식|다운로드|PDF|HWPX|HWP)/i.test(label);
    // Anchor text alone is insufficient if the link merely points to navigation.
    if(!relevant)continue;
    seen.add(u);
    items.push({url:u,label:label.slice(0,95)});
  }
  return items.slice(0,8);
}
async function getPage(url){
  const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),13000);
  try{
    const resp=await fetch(url,{redirect:"manual",signal:ctl.signal,headers:{"Accept":"text/html","Accept-Language":"ko-KR,ko;q=0.9","User-Agent":"Mozilla/5.0"}});
    if(resp.status>=300&&resp.status<400)throw Error("redirect_not_reviewed");
    if(!resp.ok)throw Error("HTTP_"+resp.status);
    if(!/html|text/.test(resp.headers.get("content-type")||"text/html"))throw Error("not_html");
    const html=await resp.text();
    if(html.length>1500000)throw Error("html_too_large");
    return html;
  }finally{clearTimeout(timer)}
}
function identify(url,headers,bytes){
  const name=headers.get("content-disposition")||"";
  const contentType=(headers.get("content-type")||"").toLowerCase();
  const text=decodeURIComponent((url+" "+name).replace(/%(?![0-9a-f]{2})/gi,"%25"));
  if(/\.hwpx\b/i.test(text))return"hwpx";
  if(/\.docx\b/i.test(text))return"docx";
  if(/\.hwp\b/i.test(text))return"hwp";
  if(/\.pdf\b/i.test(text)||contentType.includes("application/pdf")||bytes.slice(0,5).toString()==="%PDF-")return"pdf";
  if(contentType.includes("text/html"))return"html";
  if(bytes.slice(0,2).toString()==="PK")return"archive_unknown";
  return"unknown";
}
async function getBytes(url,sourceUrl){
  let current=url;
  for(let redirects=0;redirects<3;redirects++){
    if(!urlOk(current,sourceUrl))throw Error("external_redirect_denied");
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),16000);
    try{
      const r=await fetch(current,{signal:controller.signal,redirect:"manual",headers:{"User-Agent":"Mozilla/5.0","Accept":"application/pdf,application/octet-stream,*/*"}});
      if(r.status>=300&&r.status<400){
        const next=urlOk(r.headers.get("location")||"",sourceUrl);
        if(!next)throw Error("external_redirect_denied");current=next;continue;
      }
      if(!r.ok)throw Error("HTTP_"+r.status);
      if(Number(r.headers.get("content-length")||0)>MAX_FILE)throw Error("file_too_large");
      const reader=r.body?.getReader();if(!reader)throw Error("empty_response");
      const parts=[];let count=0;
      for(;;){
        const {done,value}=await reader.read();if(done)break;
        count+=value.byteLength;
        if(count>MAX_FILE){await reader.cancel();throw Error("file_too_large");}
        parts.push(Buffer.from(value));
      }
      return {bytes:Buffer.concat(parts),headers:r.headers,finalUrl:current};
    }finally{clearTimeout(timer)}
  }
  throw Error("redirect_limit");
}
function extractFile(format,bytes){
  const python=process.env.EVIDENCE_PYTHON||"python3";
  const proc=cp.spawnSync(python,["scripts/extract_support_attachment.py",format],{
    input:bytes,timeout:22000,encoding:"utf8",maxBuffer:600000,windowsHide:true
  });
  if(proc.error||proc.status!==0)return {status:"failed",text:"",reason:trim(proc.stderr||proc.error?.message||"parser failed").slice(0,120)};
  try{return JSON.parse(proc.stdout)}catch{return {status:"failed",text:"",reason:"invalid extractor response"}}
}
// Persist short, explicitly provisional document snippets, never entire downloaded PDFs.
function extractDocumentSnippets(text,url){
  const source=String(text||"");
  const keys=[["지원 자격 문구",/(지원대상|신청자격|공모대상|응모자격)/],
              ["지원 규모 문구",/(지원규모|지원금액|지원금|총\s*사업비)/],
              ["제출서류 문구",/(제출서류|필수\s*서류|사업계획서)/],
              ["부담·제한 문구",/(자부담|대응자금|소재지|업력)/]];
  const found=[];
  for(const [label,pattern] of keys){
    const m=pattern.exec(source);
    if(!m)continue;
    const start=Math.max(0,m.index-35),end=Math.min(source.length,m.index+195);
    found.push({label,quote:trim(source.slice(start,end)).slice(0,225),sourceUrl:url||""});
  }
  return found;
}

async function auditOne(row){
  const source=row.sourceUrl||row.originalUrl||"";
  const result={status:"not_scanned",reviewedAt:NOW,documentUrl:"",files:[],snippets:[]};
  if(!/^https:\/\//.test(source)){result.status="no_official_url";return result}
  let html;
  try{html=await getPage(source)}catch(e){result.status="source_unavailable";result.reason=String(e.message).slice(0,90);return result}
  const candidateLinks=discover(html,source);
  if(!candidateLinks.length){result.status="no_attachment_detected";return result}
  let supportedCount=0;
  for(const candidate of candidateLinks.slice(0,3)){
    const file={url:candidate.url,label:candidate.label,format:"unknown",status:"not_parsed"};
    try{
      const data=await getBytes(candidate.url,source);
      const format=identify(data.finalUrl,data.headers,data.bytes);
      file.format=format;
      if(!["pdf","hwpx","docx","hwp"].includes(format)){
        file.status="unsupported";file.reason=format==="archive_unknown"?"Zip document with unrecognized format":"Not a supported attachment format";
      }else if(format==="hwp"){
        file.status="unsupported";file.reason="Binary HWP requires manual conversion";
      }else{
        const parsed=extractFile(format,data.bytes);
        file.status=parsed.status;file.reason=parsed.reason||"";
        file.characters=(parsed.text||"").length;
        file.pages=parsed.pages||0;
        if(parsed.status==="parsed"){
          supportedCount++;result.snippets.push(...extractDocumentSnippets(parsed.text||"",data.finalUrl));
          if(!result.documentUrl)result.documentUrl=data.finalUrl;
        }
      }
    }catch(e){file.status="failed";file.reason=String(e.message).slice(0,110)}
    result.files.push(file);
  }
  result.snippets=result.snippets.slice(0,7);
  result.status=supportedCount?"parsed":result.files.some(x=>x.status==="unsupported")?"manual_review_required":"attachment_not_readable";
  return result;
}
function docFromCache(row,cache){
  const key=row.id+"|"+(row.sourceUrl||"");
  const entry=cache[key];
  return {key,entry};
}
async function main(){
  const store=read(CACHE,{version:1,items:{}});store.items=store.items||{};
  const data=FILES.map(file=>({file,rows:read(file,[])}));
  if(data.some(x=>!Array.isArray(x.rows)))throw Error("Source grant JSON must be an array");
  const all=data.flatMap(x=>x.rows);
  let attempted=0,parsed=0;
  // Prioritize reviewable notices with upcoming deadlines; postpone expired/unavailable sources.
  const candidates=all.slice().sort((a,b)=>{
    const aa=a.deadline&&a.deadline>=NOW.slice(0,10)?0:1,bb=b.deadline&&b.deadline>=NOW.slice(0,10)?0:1;
    return aa-bb||String(a.deadline||"9999").localeCompare(String(b.deadline||"9999"));
  });
  for(const row of candidates){
    const {key,entry}=docFromCache(row,store.items);
    const timestamp=Date.parse(entry?.reviewedAt||"");
    const fresh=Number.isFinite(timestamp)&&Date.now()-timestamp<CACHE_HOURS*3600000;
    if(!fresh&&attempted<LIMIT&&row.verificationStatus!=="source_unavailable"&&row.verificationStatus!=="stale_previous_run"){
      const scan=await auditOne(row);
      store.items[key]=scan;
      attempted++;if(scan.status==="parsed")parsed++;
      console.log("P1",row.sourceCode,row.id,scan.status,"files",scan.files.length);
    }
  }
  for(const row of all){
    const {entry}=docFromCache(row,store.items);
    const audit=entry||{status:"pending_review",files:[],snippets:[]};
    // Migrate older cache: remove verbatim extracted PDF text from public JSON.
    if(typeof audit.extractedText==="string"){
      if(!Array.isArray(audit.snippets)||!audit.snippets.length)
        audit.snippets=extractDocumentSnippets(audit.extractedText,audit.documentUrl||row.sourceUrl);
      delete audit.extractedText;
    }
    row.documentReview=audit;
    const review=extractApplicationReview(row);
    row.applicationReview=review;
    if(!row.documentUrl&&audit.documentUrl)row.documentUrl=audit.documentUrl;
    row.participationCode=review.participationCode;
    row.participationLabel=review.participationLabel;
  }
  for(const part of data)write(part.file,part.rows);
  // Cache only items still used in the current source catalogs.
  const keys=new Set(all.map(x=>x.id+"|"+(x.sourceUrl||"")));
  store.items=Object.fromEntries(Object.entries(store.items).filter(([key])=>keys.has(key)));
  store.updatedAt=NOW;write(CACHE,store);
  console.log("P0 grant eligibility classified",all.length,"P1 attachment scans",attempted,"parsed",parsed,
              "document cache items",Object.keys(store.items).length);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={discover,identify,extractFile,auditOne};
