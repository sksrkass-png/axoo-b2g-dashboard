"use strict";
/**
 * Re-evaluate all retained official-source grants using exactly the same
 * current AXOO FIT engine as newly scraped grants.
 * Preserve official evidence, human review annotations, source status and IDs.
 */
const fs = require("node:fs");
const {analyzeSupportProgram,FIT_SCORING_VERSION} = require("./support_program_intelligence");
const SOURCE_FILES = ["data/support_programs.json","data/support_regional_programs.json"];
function scoreRecord(row){
 const fit=analyzeSupportProgram({
  title:row.title||"",
  detailText:row.detailText||"",
  eligibility:row.eligibility||"",
  supportDetails:row.supportDetails||"",
  sourceCode:row.sourceCode||"",
  documentReview:row.documentReview||null,
  analysisBasis:row.analysisBasis||"",
  analysisConfidence:row.analysisConfidence||""
 });
 return {
  ...row,
  scoringVersion:FIT_SCORING_VERSION,
  score:fit.score,axooFitScore:fit.score,grade:fit.grade,
  fitVerdict:fit.fitVerdict,gradeReason:fit.reason,axooFitReason:fit.reason,
  businessArea:fit.businessArea,businessAreaLabel:fit.businessAreaLabel,
  businessAreas:fit.businessAreas,field:fit.businessAreaLabel,
  matchedKeywords:fit.matchedKeywords,matchedPriorityKeywords:fit.matchedKeywords,
  scoreBreakdown:fit.scoreBreakdown,scoreReasons:fit.scoreReasons,
  // Keep original evidence source marker even if the underlying HTML is no longer cached.
  analysisBasis:fit.analysisBasis,analysisConfidence:fit.analysisConfidence,
  companyEligible:fit.companyEligible,
  isExcludedFromPriority:row.isExcludedFromPriority===true||fit.isExcluded,
  exclusionReason:fit.isExcluded?"결과·채용·교육 등 비지원 공고":(row.exclusionReason||"")
 };
}
function main(){
 const totals={};
 for(const file of SOURCE_FILES){
  const old=JSON.parse(fs.readFileSync(file,"utf8"));
  if(!Array.isArray(old))throw Error("Expected array in "+file);
  const rows=old.map(scoreRecord);
  if(rows.some(x=>x.scoreBreakdown.length!==6||x.scoringVersion!==FIT_SCORING_VERSION))throw Error("Scoring invalid "+file);
  const before=fs.readFileSync(file,"utf8"),after=JSON.stringify(rows,null,2)+"\n";
  if(before!==after)fs.writeFileSync(file,after,"utf8");
  totals[file]={count:rows.length,changed:rows.filter((x,i)=>x.score!==old[i].score||x.scoringVersion!==old[i].scoringVersion).length,
   breakdown:rows.reduce((n,x)=>(n[x.grade]=(n[x.grade]||0)+1,n),{})};
 }
 console.log("AXOO FIT "+FIT_SCORING_VERSION+" recalculated:",JSON.stringify(totals));
}
if(require.main===module)main();
module.exports={scoreRecord,SOURCE_FILES};
