"use strict";
const assert=require("node:assert/strict");
const {extractApplicationReview}=require("./support_application_review");
const {discover,identify}=require("./enrich_support_documents");
const base={title:"시각예술 프로젝트 지원",sourceUrl:"https://example.org/notice/1",eligibility:"",application:"",supportDetails:""};
const check=(eligibility,extra={})=>extractApplicationReview({...base,eligibility,...extra});
assert.equal(check("지원대상 전체").participationCode,"needs_review");
const manual={status:"parsed",documentUrl:"https://example.org/common-user-guide.pdf",extractedText:"기업회원 등록 시 법인등록증 사업자등록증이 필요합니다. 기업은 법인사업자 인증을 받습니다."};
assert.equal(check("지원대상: 예술가 또는 예술단체",{documentReview:manual}).participationCode,"artist_collab_review");
assert.equal(check("지원대상 전체",{documentReview:manual}).participationCode,"needs_review");

assert.equal(check("지원대상 : 국내 법인 및 개인사업자").participationCode,"corporate_review");
assert.equal(check("지원대상 : 문화예술법인, 컨소시엄 공동신청 가능").participationCode,"consortium_review");
assert.equal(check("지원대상 : 시각예술 작가, 문화예술단체").participationCode,"artist_collab_review");
assert.equal(check("지원자격 : 개인 작가만 신청 가능").participationCode,"individual_only");
assert.equal(check("지원대상 : 기업 신청 불가 / 개인 작가 대상").participationCode,"not_eligible");
const uncertain=check("사업유형 전국 사업자", {supportDetails:"법인 협업 또는 신청 가능"});assert.equal(uncertain.participationCode,"needs_review");
const risk=check("지원대상 : 국내 법인 사업자",{
 application:"제출서류 사업자등록증 및 사업계획서 필요. 자부담 20% 운영. 서울 소재 사업자에 한함."
});
assert.deepEqual(risk.restrictions.map(x=>x.code).sort(),["contribution","credentials","residency"]);
assert.ok(risk.submissionDocuments.includes("사업계획서"));
assert.ok(risk.evidence[0].quote.includes("법인"));
assert.match(risk.decisionNote,/확정이 아닙니다/);
const files=discover('<a href="/download/grant.pdf">공고문 PDF</a><a href="https://evil.invalid/steal.pdf">지원서</a><a href="javascript:alert(1)">다운로드</a><a href="/other-page">다른 사업</a>',
 "https://example.org/notice/1");
assert.equal(files.length,1);
assert.equal(files[0].url,"https://example.org/download/grant.pdf");
assert.equal(identify("https://example.org/x.pdf",new Headers(),Buffer.from("%PDF-xxxx")),"pdf");
assert.equal(identify("https://example.org/x.hwp",new Headers(),Buffer.from("HWP")),"hwp");
console.log("P0/P1 evidence parser regression tests passed");
