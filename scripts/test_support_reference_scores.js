"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {generate,ASSESSMENT,SOURCE,TARGET}=require("./score_support_reference");
const {FIT_SCORING_VERSION}=require("./support_program_intelligence");
const source=JSON.parse(fs.readFileSync(SOURCE,"utf8"));
const current=generate(source);
assert.equal(current.rows.length,73,"All 73 user-supplied references must be provisionally scored");
assert.equal(current.scoringVersion,FIT_SCORING_VERSION);
assert.equal(current.assessment,ASSESSMENT);
assert.equal(current.sourceReferenceAsOf,source.referenceAsOf);
assert.equal(new Set(current.rows.map(x=>x.id)).size,73);
assert.deepEqual(current.rows.map(x=>x.id),source.rows.map(x=>x.id),"Source order and identities are preserved");
for(let i=0;i<current.rows.length;i++){
 const r=current.rows[i];
 assert(r.score>=0&&r.score<=69,"Unverified references cannot receive high grades: "+r.id);
 assert(["B","C"].includes(r.grade),"Unverified references cannot be S/A: "+r.id);
 assert.equal(r.evaluationStatus,"provisional_reference_only");
 assert.equal(r.analysisConfidence,"reference");
 assert.equal(r.verified,false);
 assert(r.analysisBasis.includes("원문 미확인"));
 assert(Array.isArray(r.scoreBreakdown)&&r.scoreBreakdown.length>=6);
 assert.equal(r.score,r.scoreBreakdown.reduce((n,x)=>n+x.score,0),"Breakdown error: "+r.id);
 assert.equal(r.scoreBreakdown.find(x=>x.code==="evidence").score,0,
  "No official detailed text or attached verified documents in reference source: "+r.id);
}
if(process.argv.includes("--require-current-file")){
 assert(fs.existsSync(TARGET),"Derived reference score data must be committed");
 const stored=JSON.parse(fs.readFileSync(TARGET,"utf8"));
 assert.deepEqual(stored,current,"Derived scores must reflect original source and current scoring engine");
}
console.log("73 unverified reference opportunities provisionally scored under "+FIT_SCORING_VERSION);
