"use strict";
const assert=require("node:assert/strict");
const { SOURCES, anchors, dateRange, parseDate, status, isCandidate, mapCandidate }=require("./collect_regional_support");
assert.equal(SOURCES.length,5);
assert.equal(new Set(SOURCES.map(x=>x.code)).size,5);
assert.equal(parseDate("2026.10.19"),"2026-10-19");
assert.equal(parseDate("2026년 11월 5일"),"2026-11-05");
assert.equal(parseDate("2026.13.40"),"");
const dates=dateRange("사업기간 2026.01.01~2026.12.31 접수기간 2026.10.19~2026.11.05 사업내용 전시");
assert.deepEqual(dates,{startDate:"2026-10-19",deadline:"2026-11-05",basis:"접수기간"});
assert.equal(status("2020-01-01","2020-01-02"),"마감");
assert.equal(status("",""),"확인 필요");
assert.ok(!isCandidate("공모 지원사업 선정 결과 발표"));
assert.ok(!isCandidate("전시 공간 구축 입찰 용역"));
assert.ok(isCandidate("2027 시각예술 기획전 지원사업"));
const html='<a href="/biz/detail/514"><strong>2027 시각예술 기획전 지원사업</strong></a>'+
  '<a href="/biz/detail/515">2027 통합공모 최종 선정 결과 발표</a>';
const found=anchors(html,"https://www.scas.kr/biz/list");
assert.equal(found.length,2);
assert.equal(found[0].url,"https://www.scas.kr/biz/detail/514");
const record=mapCandidate({
 source:SOURCES[0],
 title:"2027 시각예술 기획전 지원사업",
 detailUrl:"https://www.scas.kr/biz/detail/514",
 verifiedAt:"2026-10-19T08:00:00Z",
 html:'<html><body><main><h3>2027 시각예술 기획전 지원사업</h3>'+
  '<p>신청대상 예술단체 및 시각예술 기획자</p>'+
  '<p>접수기간 2026.10.19 ~ 2026.11.05</p>'+
  '<p>지원내용 전시 기획 프로젝트 작품 제작 설치 지원 2000만원</p>'+
  '<p>신청방법 온라인 시스템 접수</p></main></body></html>'
});
assert.ok(record);
assert.equal(record.sourceCode,"SCAS");
assert.equal(record.region,"서울");
assert.equal(record.startDate,"2026-10-19");
assert.equal(record.deadline,"2026-11-05");
assert.equal(record.verificationStatus,"date_extracted");
assert.equal(record.category,"arts_content_support");
assert.ok(record.sourceDetailVerified);
assert.ok(Array.isArray(record.scoreBreakdown));
assert.equal(record.status,"기간상 접수 가능");
console.log("Regional official support tests passed");
