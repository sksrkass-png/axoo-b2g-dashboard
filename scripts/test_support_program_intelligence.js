"use strict";

const assert = require("assert");
const {
  analyzeSupportProgram,
  extractSupportDetail,
  parseMoneyAmount
} = require("./support_program_intelligence");

const html = `
  <main>
    <h1>미디어아트 전시 콘텐츠 제작지원</h1>
    <section>지원대상: 문화예술 분야 법인 및 사업자, 기업 컨소시엄</section>
    <section>지원내용: 실감콘텐츠 기획·제작·설치 및 사업화 지원, 최대 5천만원</section>
    <section>신청방법: 온라인 접수 후 사업계획서 제출</section>
  </main>
`;

const detail = extractSupportDetail(html);

assert.match(detail.eligibility, /법인/);
assert.match(detail.supportDetails, /실감콘텐츠/);
assert.match(detail.application, /온라인 접수/);
assert.strictEqual(detail.supportAmount, 50000000);
assert.strictEqual(parseMoneyAmount("총 2억원, 기업당 최대 8천만원"), 200000000);

const fit = analyzeSupportProgram({
  title: "미디어아트 전시 콘텐츠 제작지원",
  ...detail,
  sourceCode: "KOCCA"
});

assert.ok(["digital_media", "content_brand"].includes(fit.businessArea));
assert.ok(fit.businessAreas.some(area => area.code === "digital_media"));
assert.ok(fit.businessAreas.some(area => area.code === "exhibition_space"));
assert.ok(fit.score >= 70);
assert.ok(["S", "A"].includes(fit.grade));
assert.strictEqual(fit.companyEligible, true);
assert.strictEqual(fit.isExcluded, false);
assert.strictEqual(fit.scoreBreakdown.length, 6);

const lowFit = analyzeSupportProgram({
  title: "문학 창작지원 공모",
  detailText: "지원대상 개인 예술가. 문학 작품 창작을 지원합니다.",
  eligibility: "개인 예술가",
  supportDetails: "문학 작품 창작 지원"
});

assert.strictEqual(lowFit.grade, "C");
assert.strictEqual(lowFit.isExcluded, false, "낮은 적합도 공고도 숨기지 않아야 함");

const excluded = analyzeSupportProgram({
  title: "2026년 지원사업 선정 결과 발표"
});

assert.strictEqual(excluded.isExcluded, true);
assert.ok(excluded.score <= 35);


// AXOO_EVIDENCE_QA_V1: generic navigation is not program eligibility.
const noisyHtml = \`
<html>
  <head><title>공지사항</title></head>
  <body>
    <nav>기업지원 사업화 프로젝트 콘텐츠 미디어아트</nav>
    <main>
      <h1>문화예술 참여 안내</h1>
      <div>지원대상 전체 지역 전국 신청기간 2026-10-01 ~ 2026-11-01 사업유형 창작</div>
      <div>온라인신청 첨부파일 확인</div>
    </main>
    <footer>사업자 법인 컨소시엄 지원내용 1억원</footer>
  </body>
</html>\`;
const noisyDetails = extractSupportDetail(noisyHtml);
assert.strictEqual(noisyDetails.eligibility, "지원대상 전체");
assert.strictEqual(noisyDetails.supportDetails, "");
assert.strictEqual(noisyDetails.supportAmount, 0);
assert.ok(!noisyDetails.detailText.includes("기업지원 사업화"));

const uncertainFit = analyzeSupportProgram({
  title: "문화예술 참여 안내",
  ...noisyDetails
});
assert.strictEqual(uncertainFit.companyEligible, false);
assert.strictEqual(uncertainFit.analysisConfidence, "low");
assert.ok(uncertainFit.score <= 69);
assert.strictEqual(uncertainFit.isExcluded, false);

const englishWord = analyzeSupportProgram({ title: "Art Residency Program" });
assert.strictEqual(englishWord.businessArea, "other");

const explicitEligibility = analyzeSupportProgram({
  title: "공공미술 디자인 전시 설치 사업",
  detailText: "문화예술 법인 및 사업자 등이 공공미술 사업에 신청할 수 있으며, 지역별 공간 설치 지원을 포함합니다. 지원자는 계획을 제안해야 합니다.",
  eligibility: "지원대상: 문화예술 법인 및 사업자",
  supportDetails: "지원내용: 공공미술 디자인 기획·제작·설치 및 전시 운영 사업화 지원"
});
assert.strictEqual(explicitEligibility.companyEligible, true);
assert.ok(explicitEligibility.score > uncertainFit.score);
assert.strictEqual(explicitEligibility.analysisConfidence, "high");
assert.ok(explicitEligibility.scoreBreakdown.reduce((n, v) => n + v.score, 0) === explicitEligibility.score);

console.log("support program intelligence tests passed");
