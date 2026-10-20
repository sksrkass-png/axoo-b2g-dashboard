"use strict";
/**
 * Compute transparent, PROVISIONAL AXOO FIT grades for manually supplied reference opportunities.
 * This is NOT an official-site verification or applicant eligibility determination.
 * Keep the original 73-row source reference JSON immutable.
 */
const fs=require("node:fs");
const {analyzeSupportProgram,FIT_SCORING_VERSION}=require("./support_program_intelligence");
const SOURCE="data/support_ledger_reference.json";
const TARGET="data/support_ledger_reference_scores.json";
const ASSESSMENT="provisional_reference_only";
const BASIS="참고자료 사업명·지원규모/내용·신청대상 요약만 사용 · 공식 원문 미확인";
function scoreOne(row){
  const fit=analyzeSupportProgram({
    title:row.title||"",
    eligibility:row.applicants||"",
    supportDetails:row.benefit||"",
    detailText:"", // No verified official detail text is present in this manual source.
    documentReview:null
  });
  if(fit.score>69)throw Error("Unverified reference cannot exceed low-evidence score cap: "+row.id);
  if(fit.scoreBreakdown.reduce((n,x)=>n+x.score,0)!==fit.score)throw Error("Score breakdown mismatch: "+row.id);
  return {
    id:row.id,
    score:fit.score,
    grade:fit.grade,
    scoreBreakdown:fit.scoreBreakdown,
    scoreReasons:fit.scoreReasons,
    businessAreaLabel:fit.businessAreaLabel,
    matchedKeywords:fit.matchedKeywords,
    scoringVersion:FIT_SCORING_VERSION,
    evaluationStatus:ASSESSMENT,
    analysisBasis:BASIS,
    analysisConfidence:"reference",
    verified:false
  };
}
function generate(source){
 if(!source||!Array.isArray(source.rows))throw Error("Invalid reference records");
 const rows=source.rows.map(scoreOne);
 if(new Set(rows.map(x=>x.id)).size!==rows.length)throw Error("Duplicate reference IDs");
 return {
   version:1,
   scoringVersion:FIT_SCORING_VERSION,
   assessment:ASSESSMENT,
   sourceReferenceAsOf:source.referenceAsOf,
   note:"임시 점수. 사용자 제공 참고자료만 분석했으며 공고 원문/신청 자격은 검증되지 않았습니다.",
   rows
 };
}
function main(){
 const source=JSON.parse(fs.readFileSync(SOURCE,"utf8"));
 const output=generate(source);
 const bytes=JSON.stringify(output,null,2)+"\n";
 if(!fs.existsSync(TARGET)||fs.readFileSync(TARGET,"utf8")!==bytes){
   fs.writeFileSync(TARGET,bytes,"utf8");
 }
 console.log("[AXOO FIT reference] "+output.rows.length+" provisional scores generated; no source records changed. "+output.scoringVersion);
}
if(require.main===module)main();
module.exports={scoreOne,generate,ASSESSMENT,SOURCE,TARGET};
