const assert = require("assert");

const {
  isArchitecturalArtCommission,
  mergeActiveG2bArtCandidates,
  combineG2bSources,
  importG2bArtCommissions
} = require("./import_g2b_art_commissions");


const BUILDING_ART_NOTICE = {
  bidNtceNo: "R26BK00000001",
  bidNtceNm: "청주시 농수산물도매시장 건축물 미술작품 제작 및 설치 공모",
  ntceInsttNm: "청주시",
  dminsttNm: "청주시",
  bidNtceDt: "2026-09-10 09:00:00",
  bidClseDt: "2026-09-25 18:00:00",
  asignBdgtAmt: "278000000",
  bidNtceUrl: "https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo=R26BK00000001"
};

const NON_BUILDING_ART_NOTICE = {
  bidNtceNo: "R26BK00000002",
  bidNtceNm: "지역 축제 전시연출 용역",
  ntceInsttNm: "충청북도",
  bidNtceUrl: "https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo=R26BK00000002"
};

const RESULT_NOTICE = {
  bidNtceNo: "R26BK00000003",
  bidNtceNm: "건축물 미술작품 제작 설치 공모 심사결과",
  bidNtceUrl: "https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo=R26BK00000003"
};

const LOW_BUDGET_GOODS_NOTICE = {
  bidNtceNo: "R26BK00000004",
  bidNtceNm: "공공청사 조형물 제작 및 설치",
  ntceInsttNm: "제주특별자치도",
  bidNtceDt: "2026-09-11 09:00:00",
  bidClseDt: "2026-09-29 18:00:00",
  asignBdgtAmt: "30000000",
  g2bNoticeType: "goods",
  bidNtceUrl: "https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo=R26BK00000004"
};


assert.strictEqual(isArchitecturalArtCommission(BUILDING_ART_NOTICE), true);
assert.strictEqual(isArchitecturalArtCommission(NON_BUILDING_ART_NOTICE), false);
assert.strictEqual(isArchitecturalArtCommission(RESULT_NOTICE), false);
assert.strictEqual(isArchitecturalArtCommission(LOW_BUDGET_GOODS_NOTICE), true);

const rawCandidates = mergeActiveG2bArtCandidates(
  [BUILDING_ART_NOTICE],
  [BUILDING_ART_NOTICE, LOW_BUDGET_GOODS_NOTICE, NON_BUILDING_ART_NOTICE],
  "2026-09-11"
);

assert.strictEqual(rawCandidates.length, 2, "일반 대시보드 필터와 무관하게 미술 공고 원본을 보존해야 합니다.");
assert.strictEqual(
  combineG2bSources([BUILDING_ART_NOTICE], rawCandidates).length,
  2,
  "일반/미술 전용 G2B 데이터는 공고번호 기준으로 합쳐야 합니다."
);

const result = importG2bArtCommissions({
  dryRun: true,
  today: "2026-09-11",
  g2b: [BUILDING_ART_NOTICE, NON_BUILDING_ART_NOTICE, RESULT_NOTICE],
  live: [],
  archive: []
});

assert.strictEqual(result.checked, 3);
assert.strictEqual(result.matched, 1);
assert.strictEqual(result.nextLive.length, 1);
assert.strictEqual(result.nextArchive.length, 1);
assert.strictEqual(result.nextLive[0].region, "충북");
assert.strictEqual(result.nextLive[0].amountNumeric, 278000000);
assert.strictEqual(result.nextArchive[0].archiveIsCurrent, true);

console.log("✅ G2B 건축물 미술작품 import tests passed");
