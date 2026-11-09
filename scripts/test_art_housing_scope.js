const assert = require("assert");
const scope = require("./art_housing_scope");

const yes = [
  { title: "양평 오빈1지구 공동주택 신축공사 미술작품 공모" },
  { title: "분당 정자동 느티마을 4단지 건축물 미술작품 제작 및 설치 공모" },
  { title: "부천대장 A-7BL, A-8BL 미술작품 설치 공모" },
  { title: "남양주진접 서한이다음 건축물 미술작품 설치 공모" },
  { title: "2026년 하반기 서울지역본부 미술작품 공모", collectionSourceId: "lh_notice" },
  { title: "LH 공공주택건설사업지구 건축물미술작품 제작·설치 공모" },
  { title: "의정부동 424 주상복합 미술작품 공모" }
];
const no = [
  { title: "지역농특산물 조형물설치(조합추천)", categoryLabel: "건축물 미술작품" },
  { title: "함평읍 도시재생사업(한우테마거리조성) 미디어 조형물 제작 설치" },
  { title: "우주항공테마공원 안내 조형물 설치공사" },
  { title: "배곧서울대학교병원 건립 건축물 미술작품 제작·설치 공모" },
  { title: "인천지방국세청 신청사 건축물 미술작품 제작 설치 공모" },
  { title: "모란민속5일장 조형물 제작 설치" },
  { title: "청주시 농수산물도매시장 건축물 미술작품 제작 및 설치 공모" },
  { title: "지역 조형물 제작 설치", keywords: ["건축물 미술작품", "아파트"] },
  { title: "미술작품 공모 공고", detailTextSample: "이전글 ○○아파트 미술작품 공모", collectionSourceId: "gyeonggi_public_art" }
];
yes.forEach(x => assert(scope.isHousingArtCommission(x), "must allow: " + x.title));
no.forEach(x => assert(!scope.isHousingArtCommission(x), "must exclude: " + x.title));
const sample = { id:"abc", title:"○○아파트 미술작품 공모", sourceUrl:"https://example.com/a/", bidNtceNo:"R26ABC" };
const keys = scope.getExclusionKeys(sample);
assert(scope.isExcluded(sample, { excluded:[{ keys:[keys[1]], title:sample.title }] }));
assert.strictEqual(scope.filterItems([sample], { excluded:[{ keys, title:sample.title }] }).length, 0);
assert.strictEqual(scope.filterItems([sample], { excluded:[] }).length, 1);
console.log("✅ housing-only building artwork scope / exclusions tests passed");
