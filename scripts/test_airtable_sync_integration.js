"use strict";
/**
 * Live integration smoke test for AXOO P2.1.
 * Exercises the real GitHub Actions Airtable mirror with an isolated, temporary
 * candidate. Verifies CREATE -> repeat no-op -> staff memo preserved -> DELETE.
 * It never checks any "검토 대상으로 선택" box, so the Airtable approval
 * automation cannot create a team work item.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const cp=require("node:child_process");
const BASE="applM2n5kScusEfYr";
const CANDIDATE="tblwuEYAPKkA5BEVs",MANAGEMENT="tblh8ArxjYKf46Tv0",TASKS="tblHAcJHCgEfJKVcV";
const ID="flddGu8HySNRqIoyJ",MEMO="fldjSeEUUWePQuGT5";
const STAFF=["fldOGZ0bZVCV1hNnQ","fldKNS0du4E4Pl68X","fld1cpoKVjtRkq7Z2",MEMO];
const API="https://api.airtable.com/v0/"+BASE;
const token=process.env.AIRTABLE_PAT;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(method,url,body){
 for(let attempt=0;attempt<5;attempt++){
  const r=await fetch(url,{method,headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
   body:body?JSON.stringify(body):undefined});
  if([429,500,502,503,504].includes(r.status)){
   if(attempt===4)throw Error("Airtable "+r.status);
   await delay(550*(2**attempt));continue;
  }
  if(!r.ok)throw Error("Airtable "+r.status+" "+(await r.text()).slice(0,150));
  return r.json();
 }
 throw Error("Airtable retry limit");
}
async function list(table,fields=[]){
 const records=[];let offset="";
 for(let n=0;n<30;n++){
  const u=new URL(API+"/"+table);u.searchParams.set("pageSize","100");
  u.searchParams.set("returnFieldsByFieldId","true");
  for(const f of fields)u.searchParams.append("fields[]",f);
  if(offset)u.searchParams.set("offset",offset);
  const v=await request("GET",u.toString());
  records.push(...v.records);
  if(!v.offset)return records;
  offset=v.offset;await delay(250);
 }
 throw Error("Too many Airtable pages");
}
function staff(records){
 return new Map(records.map(x=>[x.id,JSON.stringify(STAFF.map(f=>x.fields?.[f]??null))]));
}
function verifyStaff(baseline,current){
 const present=new Map(current.map(x=>[x.id,x]));
 for(const [id,original] of baseline){
  assert(present.has(id),"Original candidate deleted unexpectedly "+id);
  assert.equal(JSON.stringify(STAFF.map(f=>present.get(id).fields?.[f]??null)),original,
    "Manual review field overwritten by source sync for record "+id);
 }
}
function runSync(file){
 const stdout=cp.execFileSync(process.execPath,["scripts/sync_airtable_support_candidates.js"],{
  env:{...process.env,AXOO_SUPPORT_SYNC_SOURCE_FILE:file},
  encoding:"utf8",timeout:90000,maxBuffer:250000
 });
 const m=stdout.match(/Airtable candidate mirror updated \{[^}]*\}/);
 if(!m)throw Error("No mirror success summary: "+stdout.slice(-350));
 console.log("[SMOKE] "+m[0]);
 return m[0];
}
async function main(){
 assert(token,"AIRTABLE_PAT missing; cannot run live integration smoke test");
 const run=String(process.env.GITHUB_RUN_ID||"local")+"-"+String(process.env.GITHUB_RUN_ATTEMPT||"1");
 const smokeId="live-axoo-p21-smoke-"+run;
 const fileDir=fs.mkdtempSync(path.join(os.tmpdir(),"axoo-p21-"));
 const dataFile=path.join(fileDir,"fixture.json");
 const baseline=await list(CANDIDATE,[ID,...STAFF]);
 const baselineIds=baseline.map(x=>x.fields?.[ID]);
 assert.equal(new Set(baselineIds).size,baseline.length,"Duplicate Research ID before integration");
 const originalStaff=staff(baseline);
 const managementBefore=(await list(MANAGEMENT,["fldMfwJOVjh81GFr0"])).map(x=>x.id).sort();
 const tasksBefore=(await list(TASKS,["fldCgcf7uAXLRvnou"])).map(x=>x.id).sort();
 const fixture=[{
  id:smokeId.slice(5),
  priorityCategory:"arts_content_support",
  title:"[자동 삭제 예정 / P2.1 통합검증] 신규 공고 생성 테스트",
  organization:"AXOO 자동화 검증",
  sourceUrl:"https://example.org/axoo-p21-test-only",
  score:0,
  status:"마감",
  deadline:"2025-01-01",
  startDate:"2025-01-01",
  participationLabel:"자격 확인 필요",
  businessAreaLabel:"테스트 (실제 공고 아님)",
  region:"전국",
  collectionVerifiedAt:"2026-10-20T00:00:00Z",
  applicationReview:{evidence:[]}
 }];
 fs.writeFileSync(dataFile,JSON.stringify(fixture));
 let created=null;
 let error;
 try{
  assert(!baselineIds.includes(smokeId),"Test id already exists");
  const first=runSync(dataFile);
  assert.match(first,/created:\s*1\b/);
  assert.match(first,/updated:\s*0\b/);
  let mid=await list(CANDIDATE,[ID,...STAFF]);
  assert.equal(mid.length,baseline.length+1,"Expected exactly one temporary candidate");
  created=mid.find(x=>x.fields?.[ID]===smokeId);
  assert(created,"New candidate Research ID not written");
  assert.equal(mid.filter(x=>x.fields?.[ID]===smokeId).length,1,"Duplicate newly created candidate");
  verifyStaff(originalStaff,mid);

  // Add a human-owned memo: source synchronizer must not overwrite it.
  const message="Temporary manual staff memo — protect during integration test";
  await request("PATCH",API+"/"+CANDIDATE+"/"+created.id,{fields:{[MEMO]:message}});
  const second=runSync(dataFile);
  assert.match(second,/created:\s*0\b/);
  assert.match(second,/updated:\s*0\b/);
  assert.match(second,/unchanged:\s*1\b/);
  mid=await list(CANDIDATE,[ID,...STAFF]);
  assert.equal(mid.filter(x=>x.fields?.[ID]===smokeId).length,1,"Second sync duplicated test record");
  assert.equal(mid.find(x=>x.id===created.id)?.fields?.[MEMO],message,"Human memo overwritten on second sync");
  verifyStaff(originalStaff,mid);
  assert.deepEqual((await list(MANAGEMENT,["fldMfwJOVjh81GFr0"])).map(x=>x.id).sort(),managementBefore);
  assert.deepEqual((await list(TASKS,["fldCgcf7uAXLRvnou"])).map(x=>x.id).sort(),tasksBefore);
  console.log("[SMOKE] CREATE / IDEMPOTENCY / STAFF FIELDS / UNRELATED TABLES PASS");
 }catch(e){error=e}
 finally{
  try{
   if(!created){
    const possible=(await list(CANDIDATE,[ID])).find(x=>x.fields?.[ID]===smokeId);
    if(possible)created=possible;
   }
   if(created){
    const response=await request("DELETE",API+"/"+CANDIDATE+"/"+created.id);
    assert.equal(response.deleted,true,"Could not delete temporary record");
   }
   const remaining=await list(CANDIDATE,[ID,...STAFF]);
   assert.equal(remaining.length,baseline.length,"Candidate count was not fully restored");
   assert.equal(remaining.filter(x=>x.fields?.[ID]===smokeId).length,0,"Test record not cleaned");
   verifyStaff(originalStaff,remaining);
   console.log("[SMOKE] CLEANUP PASS: original "+baseline.length+" candidate records preserved");
  }catch(cleanupError){
   error=new AggregateError([...(error?[error]:[]),cleanupError],
     "Integration smoke cleanup failed — inspect candidate "+smokeId);
  }
  fs.rmSync(fileDir,{recursive:true,force:true});
 }
 if(error)throw error;
}
main().catch(e=>{console.error(e);process.exitCode=1});
