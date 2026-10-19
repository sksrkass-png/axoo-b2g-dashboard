"use strict";
/**
 * AXOO P2.1 candidate-only Airtable mirror.
 * Intended for GitHub Actions with AIRTABLE_PAT in encrypted repo secrets.
 * Human-edited pipeline records, statuses, owners and review-selection flags
 * are NEVER overwritten by this importer.
 */
const fs=require("node:fs");
const BASE="app59It3ijZvl0szJ",TABLE="tblsWgVeEHJB1Tbtb";
const API="https://api.airtable.com/v0/"+BASE+"/"+TABLE;
const KEYS={
title:"fldiCBkIAl1hNXb8g",id:"fldVj9VooEtVzFaU7",url:"fld9RQNIGOv04uMsD",
org:"fld3PTOKLYNFUanRk",status:"fld7ThoMU1V4HV9IP",
deadline:"fld9ybp0z05kEi4ya",mode:"fldonkOJBOPmpQ3pa",
score:"fldZycGG3GsunqXu1",category:"fldLziXPPclkyE6iW",
region:"fldnBIqSjSp87HRNQ",basis:"fld9rrPOAs3AVHm69",
collected:"fldVasuvcu8Aejajw",registered:"fldTo44rlhm7Pr6Oe"
};
const CODES=new Set(["법인 직접 신청 검토","작가·예술단체 협업 검토","컨소시엄 참여 검토","개인 신청 중심","법인 신청 제한 단서","자격 확인 필요"]);
const STATES=new Set(["기간상 접수 가능","접수 예정","마감","일정 확인","원문 재확인"]);
const ymd=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||""))?String(x):undefined;
const clean=(v,n=2000)=>String(v??"").replace(/\s+/g," ").trim().slice(0,n);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
function status(x){
 const t=today();
 if(x.verificationStatus==="source_unavailable"||x.verificationStatus==="stale_previous_run")return"원문 재확인";
 if(x.status==="마감"||(x.deadline&&x.deadline<t))return"마감";
 if(x.startDate&&x.startDate>t)return"접수 예정";
 if(x.deadline&&x.deadline>=t)return"기간상 접수 가능";
 return"일정 확인";
}
function fields(x){
 const o={};
 const put=(key,val)=>{if(val!==undefined&&val!==null&&val!=="")o[KEYS[key]]=val};
 put("title",clean(x.title,300));
 put("id","live-"+clean(x.id,190));
 put("url",/^https:\/\/[^\s]+$/i.test(x.sourceUrl||"")?x.sourceUrl:undefined);
 put("org",clean(x.organization||x.agency||x.source,180));
 put("status",status(x));
 put("deadline",ymd(x.deadline));
 const mode=x.participationLabel||x.applicationReview?.participationLabel;
 put("mode",CODES.has(mode)?mode:"자격 확인 필요");
 if(Number.isFinite(Number(x.score)))put("score",Number(x.score));
 put("category",clean(x.businessAreaLabel||x.field,100));
 put("region",clean(x.region||"전국",40));
 put("basis",clean((x.applicationReview?.evidence||[]).map(y=>y.quote||"").join("\n"),1500));
 put("collected",ymd(String(x.collectionVerifiedAt||x.collectedAt||"").slice(0,10)));
 return o;
}
async function request(method,url,token,body){
 for(let attempt=0;attempt<5;attempt++){
  let response;
  try{response=await fetch(url,{method,headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json","Accept":"application/json"},body:body?JSON.stringify(body):undefined})}
  catch(e){if(attempt===4)throw e;await delay(500*Math.pow(2,attempt));continue}
  if(response.status===429||response.status>=500){if(attempt===4)throw Error("Airtable "+response.status);await delay(600*Math.pow(2,attempt));continue}
  if(!response.ok){const message=(await response.text()).slice(0,220);throw Error("Airtable "+response.status+" "+message)}
  return response.json();
 }
 throw Error("Airtable request exceeded retries");
}
async function existing(token){
 const index=new Map();let offset="";
 const sourceKeys=Object.entries(KEYS).filter(([name])=>name!=="registered").map(([,id])=>id);
 for(let n=0;n<30;n++){
  const url=new URL(API);
  url.searchParams.set("pageSize","100");
  url.searchParams.set("returnFieldsByFieldId","true");
  for(const id of sourceKeys)url.searchParams.append("fields[]",id);
  if(offset)url.searchParams.set("offset",offset);
  const page=await request("GET",url.toString(),token);
  for(const record of page.records||[]){
   const id=record.fields?.[KEYS.id]||record.fields?.["Research ID"];
   if(id)index.set(id,{id:record.id,fields:record.fields||{}});
  }
  if(!page.offset)return index;
  offset=page.offset;
  await delay(260);
 }
 throw Error("Airtable pagination max 3000 records reached");
}
function changed(previous,current){
 // Only compare official source columns. Staff checkboxes/links are not fetched or written.
 return Object.entries(current).some(([field,value])=>
  String(previous?.[field]??"")!==String(value??""));
}
async function main(){
 const token=process.env.AIRTABLE_PAT;
 if(!token){console.warn("[AXOO P2.1] AIRTABLE_PAT secret missing; candidate sync SKIPPED. Existing Airtable records remain unchanged.");return}
 const all=JSON.parse(fs.readFileSync("data/priority_projects.json","utf8"));
 if(!Array.isArray(all))throw Error("priority data invalid");
 const candidates=all.filter(x=>x.priorityCategory==="arts_content_support"&&x.id&&x.title);
 const ids=new Set(candidates.map(x=>x.id));
 if(ids.size!==candidates.length)throw Error("Duplicate candidate IDs in priority data");
 const old=await existing(token);
 const creates=[],updates=[];
 for(const item of candidates){
  const row=fields(item),id=row[KEYS.id],previous=old.get(id);
  if(previous){if(changed(previous.fields,row))updates.push({id:previous.id,fields:row});}
  else creates.push({fields:{...row,[KEYS.registered]:"미등록"}});
 }
 let created=0,updated=0;
 for(let i=0;i<creates.length;i+=10){
  const result=await request("POST",API,token,{records:creates.slice(i,i+10),typecast:false});
  created+=(result.records||[]).length;await delay(300);
 }
 for(let i=0;i<updates.length;i+=10){
  const result=await request("PATCH",API,token,{records:updates.slice(i,i+10),typecast:false});
  updated+=(result.records||[]).length;await delay(300);
 }
 console.log("[AXOO P2.1] Airtable candidate mirror updated",{total:candidates.length,created,updated,unchanged:candidates.length-created-updated,previousCount:old.size});
 console.log("[AXOO P2.1] Human fields and support-management records were not touched");
}
if(require.main===module)main().catch(e=>{console.error("[AXOO P2.1]",e.message);process.exitCode=1});
module.exports={fields,status,changed};
