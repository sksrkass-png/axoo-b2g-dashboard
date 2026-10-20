"use strict";
const assert=require("node:assert/strict");
const {analyzeSupportProgram,BUSINESS_AREAS,FIT_SCORING_VERSION}=require("./support_program_intelligence");
const {scoreRecord}=require("./regrade_support_programs");
const sample=(fields={})=>analyzeSupportProgram({title:"문화예술 신규 공고",...fields});
const get=(fit,key)=>fit.scoreBreakdown.find(x=>x.code===key)?.score;
const maxima={relevance:40,eligibility:20,execution:20,business:15,evidence:5};
assert.deepEqual(BUSINESS_AREAS.map(x=>x.label),
 ["전시·공간","공공미술·디자인","미디어아트·기술","콘텐츠 제작·브랜딩","사업화·유통","협업·해외진출"]);
for(const [category,terms] of [
 ["전시·공간",["작가","아트페어","전시"]],
 ["공공미술·디자인",["공예","조형물","벽화"]],
 ["미디어아트·기술",["인터렉티브","인터랙티브","XR"]],
 ["콘텐츠 제작·브랜딩",["IP","시각콘텐츠","영상 미술"]],
 ["사업화·유통",["예술경영","예술마케팅","확장"]],
 ["협업·해외진출",["글로벌 미술시장","작가 육성","콜라보레이션"]]
]) {
 const group=BUSINESS_AREAS.find(x=>x.label===category);
 for(const term of terms)assert(group.keywords.includes(term),term+" missing from "+category);
}
const empty=sample();
assert.equal(get(empty,"relevance"),8);
assert.equal(get(empty,"eligibility"),10);
assert.equal(get(empty,"execution"),0);
assert.equal(get(empty,"business"),0);
assert.equal(get(empty,"evidence"),0);
const match=sample({title:"전시 작가 갤러리 팝업 박람회 아트페어 기획"});
assert.equal(get(match,"relevance"),40);
assert.equal(get(match,"execution"),4);
assert.equal(get(sample({eligibility:"지원대상: 개인 창작자"}),"eligibility"),20);
assert.equal(get(sample({eligibility:"신청자격: 공고문 참조"}),"eligibility"),10);
assert.equal(get(sample({eligibility:"모집대상 전체"}),"eligibility"),10);
assert.equal(get(sample({eligibility:"지원대상: 기업·법인·단체"}),"eligibility"),20);
const ex=sample({title:"기획 제작 설치 운영 시각예술 에이전시 디자인 프로젝트 예산 글로벌"});
assert.equal(get(ex,"execution"),20);
const business=sample({supportDetails:"지원금 사업화 유통 판로 투자 프로젝트 해외진출 마케팅 프로모션 지원 육성"});
assert.equal(get(business,"business"),15);
const negOne=sample({title:"공연 예술 지원"});
assert.equal(get(negOne,"penalty"),-25);
const negTwo=sample({title:"연극과 무용 공모"});
assert.equal(get(negTwo,"penalty"),-50);
const negThree=sample({title:"웹툰 문학 축제 대회 유튜브 출판 온라인 방송"});
assert.equal(get(negThree,"penalty"),-50);
assert.equal(get(sample({title:"영화 게임 음악 방송 콘텐츠"}),"penalty"),0,
 "Do not penalize genres removed from user's list");
const detailText="전시공간 미디어아트 신규지원 안내와 분야별 예술가 창작 및 전시 공간 협력 사업 정보를 제공하여 시민 체험과 창작 활동의 범위를 넓힙니다. 신청 주체는 등록 법인과 협력단체이며 공간 내 작품 전시를 위해 기획 제작 설치 운영 및 홍보 결과를 기록합니다.";
const rich=sample({title:"공공미술 전시기획",detailText,eligibility:"지원대상 등록 법인 문화예술 단체 지원 가능",supportDetails:"지원내용 공공미술 전시 기획과 제작 설치 운영 및 시각예술 지원 제공"});
assert.equal(get(rich,"evidence"),5);
const attachment=sample({title:"전시공모",documentReview:{status:"parsed",files:[{url:"https://example.com/notice.pdf",status:"parsed"}]}});
assert.equal(get(attachment,"evidence"),2);
assert.equal(get(sample({title:"전시공모",documentReview:{status:"no_attachment_detected",files:[]}}),"evidence"),0);
const cached=scoreRecord({id:"sample",title:"공공미술 전시기획",eligibility:"등록 법인 예술단체",supportDetails:"공공미술 전시 기획과 제작 설치 운영",analysisConfidence:"high",analysisBasis:"상세 공고문",documentReview:{status:"parsed",files:[{status:"parsed",url:"https://example.com/notice.pdf"}]},score:7,sourceCode:"ARKO",status:"마감",owner:"직원",applicationReview:{decisionNote:"별도 자격 검토"}});
assert.equal(cached.scoringVersion,FIT_SCORING_VERSION);
assert.equal(cached.status,"마감");
assert.equal(cached.owner,"직원");
assert.deepEqual(cached.applicationReview,{decisionNote:"별도 자격 검토"});
assert.notEqual(cached.score,7);
assert.equal(cached.scoreBreakdown.find(x=>x.code==="evidence").score,5);
assert.equal(cached.score,cached.scoreBreakdown.reduce((n,x)=>n+x.score,0));
for(const item of [empty,match,ex,business,negOne,negTwo,negThree,rich,attachment]){
 assert(item.score>=0&&item.score<=100);
 for(const [category,max] of Object.entries(maxima)){
  const v=get(item,category);
  assert(v>=0&&v<=max,category+" out of range");
 }
 assert(get(item,"penalty")>=-50);
 assert.equal(item.score,item.scoreBreakdown.reduce((n,x)=>n+x.score,0));
 assert.equal(item.scoringVersion,FIT_SCORING_VERSION);
}
console.log("AXOO FIT v2 keyword, caps, evidence and cached-record scoring tests passed");
