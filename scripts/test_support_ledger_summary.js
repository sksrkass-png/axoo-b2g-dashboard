"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {summarize,plain}=require("../support_ledger_summary.js");
const make=(benefit,applicants="")=>({benefit,applicants});
let s=summarize(make(
 "지원내용 ㅇ 후반작업 전반 종합지원 - CG, VFX, 뷰티, DI, 고난이도 에셋 제작 등 ㅇ 지원규모 : 최대 7.5억 원 / 1개 내외 ㅇ 지원요건 : 공고문 참조 공고기간 : 2026. 10. 13. ~ 2026. 10. 29.",
 "지원대상 - 방송영상독립제작사(국내 법인, 개인 사업자) - 독립제작사-후반작업기업 컨소시엄 ※ 주관기관은 독립제작사"
));
assert.match(s.scale,/7\.5억/);
assert.match(s.content,/후반작업/);
assert(!s.content.includes("7.5억"),"Content must not absorb an adjacent scale field");
assert.match(s.eligibility,/방송영상독립제작사/);
s=summarize(make("건당 최소 2천만원, 희망 시 아르코미술관 연계전시","작가·기획자·비평가"));
assert.match(s.scale,/건당 최소 2천만원/);
assert.match(s.content,/아르코미술관/);
assert.equal(s.eligibility,"작가·기획자·비평가");
s=summarize(make("예산 13.5억, 77건 접수","지원대상 전체"));
assert.match(s.scale,/예산 13.5억/);
assert.equal(s.content,"상세내용 확인 필요");
assert.equal(s.eligibility,"신청자격 미확인");
s=summarize(make("창작공간 운영 지원","시각예술 공간"));
assert.equal(s.scale,"지원금액 미확인");
assert.equal(s.content,"창작공간 운영 지원");
assert.equal(s.eligibility,"시각예술 공간");
s=summarize(make("지원규모 확인하여 최소 상주 근무인력에 맞게 입주 희망유형 기입","지원대상 전체"));
assert.equal(s.scale,"지원금액 미확인","Do not misidentify administrative guidance as a grant amount");
s=summarize(make("지원규모 : 2개사 이내 / 입주 가능 인원", "국내 게임기업"));
assert.match(s.scale,/2개사/);
assert.equal(s.content,"상세내용 확인 필요","Scale-only notices are not verified service benefits");
s=summarize(make("지원내용 : ① 참여 작가비 1인 1,000만 원 정액 지원 ② 코엑스 작품 송출", "신청자격 : 인천 거주자 또는 인천 내 등록 단체 전형절차 서류 심의 행정심의"));
assert.match(s.scale,/1,000만 원/);
assert.match(s.content,/참여 작가비/);
assert.match(s.eligibility,/인천 거주자/);
assert(!s.eligibility.includes("서류 심의"),"Eligibility should stop at the next labeled section");
assert.equal(plain("A &middot; B &bull; C"),"A · B · C");
assert(s.content.length<=130,"Summary should stay compact");
const ledger=fs.readFileSync("support_ledger.js","utf8");
const index=fs.readFileSync("index.html","utf8");
assert(ledger.includes("✦ 지원규모")&&ledger.includes("✦ 지원내용")&&ledger.includes("✦ 신청자격"));
assert(ledger.includes("배점 보기")&&ledger.includes("scoreBreakdown"));
assert(index.includes('src="support_ledger_summary.js?v='));
assert(index.indexOf("support_ledger_summary.js")<index.indexOf("support_ledger.js"));
// Dangling connectors must never be presented as grant size, benefit, or eligibility.
for (const stub of ["및","또는","혹은","그리고","지원대상 전체","원문 확인","공고문 참조","지원규모 확인 필요"]){
 const check=summarize({benefit:stub,applicants:stub});
 assert.equal(check.scale,"지원금액 미확인",stub+" not a scale");
 assert.equal(check.content,"상세내용 확인 필요",stub+" not support content");
 assert.equal(check.eligibility,"신청자격 미확인",stub+" not eligibility");
}
for(const fragment of ["사업자 및","법인 또는","또는 단체"]){
 assert.equal(summarize({applicants:fragment}).eligibility,"신청자격 미확인");
}
const noteDoc={
 benefit:"",
 applicants:"지원대상 전체",
 documents:{status:"parsed",files:[{url:"https://official.example/notice.pdf",status:"parsed"}],
 snippets:[
  {label:"지원 규모 문구",sourceUrl:"https://official.example/notice.pdf",quote:"지원규모 : 최대 1,000만원, 8건 내외"},
  {label:"지원 내용 문구",sourceUrl:"https://official.example/notice.pdf",quote:"지원내용 : 문화예술교육 단체와 수요처 매칭 프로그램 운영 및 제작"},
  {label:"지원 자격 문구",sourceUrl:"https://official.example/notice.pdf",quote:"지원대상 : 경기도 소재 사업자등록증 보유 문화예술교육단체"}
 ]}
};
const recovered=summarize(noteDoc);
assert.match(recovered.scale,/1,000만원/);
assert.match(recovered.content,/문화예술교육/);
assert.match(recovered.eligibility,/경기도 소재/);
const unsafe=JSON.parse(JSON.stringify(noteDoc));
unsafe.documents.files[0].status="failed";
assert.equal(summarize(unsafe).content,"상세내용 확인 필요","Do not promote unverified attachment snippets");
const wrongFile=JSON.parse(JSON.stringify(noteDoc));
wrongFile.documents.snippets[1].sourceUrl="https://random.example/unrelated.pdf";
assert.equal(summarize(wrongFile).content,"상세내용 확인 필요","Snippets must belong to a successfully parsed document");
const priority=JSON.parse(fs.readFileSync("data/priority_projects.json","utf8")).filter(x=>x.priorityCategory==="arts_content_support");
assert(priority.length>0);
for(const item of priority){
 const summary=summarize({benefit:item.supportDetails||item.detailSummary||"",applicants:item.eligibility||"",documents:item.documentReview||null});
 assert(summary.scale&&summary.content&&summary.eligibility);
 assert(summary.scale.length<=110&&summary.content.length<=140&&summary.eligibility.length<=140,
  "Output too long: "+item.id);
}
const ref=JSON.parse(fs.readFileSync("data/support_ledger_reference.json","utf8"));
assert.equal(ref.rows.length,73);
const allSummaries=[
 ...priority.map(item=>summarize({benefit:item.supportDetails||item.detailSummary||"",applicants:item.eligibility||"",documents:item.documentReview||null})),
 ...ref.rows.map(item=>summarize({benefit:item.benefit||"",applicants:item.applicants||""}))
];
const bare=/^(?:및|또는|혹은|그리고|and|or|·)$/i;
for(const result of allSummaries){
 for(const k of ["scale","content","eligibility"]){
  assert(!bare.test(result[k].trim()),k+" is a connector-only result");
  assert(!result[k].startsWith("또는 ")&&!result[k].endsWith(" 및"),"Incomplete summary "+k+": "+result[k]);
  assert(result[k]!=="공고문 확인 필요","Legacy catch-all must be field-specific");
 }
}
const stats=Object.fromEntries(["scale","content","eligibility"].map(k=>
 [k,{verifiedSummary:allSummaries.filter(x=>x[k]!==require("../support_ledger_summary.js").UNKNOWN[k]).length,
 unknown:allSummaries.filter(x=>x[k]===require("../support_ledger_summary.js").UNKNOWN[k]).length}]));
console.log("Support grant field summary QA passed: "+priority.length+" live + "+ref.rows.length+
 " references; "+JSON.stringify(stats));
