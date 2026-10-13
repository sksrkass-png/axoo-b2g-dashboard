const assert = require("assert");

const {
  getArtItemKey,
  buildArtDisplayItems,
  getArtSourceValue
} = require("../app");


const current = {
  id: "live-1",
  title: "현재 공고",
  sourceUrl: "https://example.com/notices/1/",
  deadline: "2026-11-01",
  detailFetchStatus: "ok"
};

const archivedCopy = {
  id: "archive-1",
  title: "현재 공고 (보관본)",
  sourceUrl: "https://example.com/notices/1",
  archiveFirstSeenAt: "2026-10-01"
};

const past = {
  id: "archive-2",
  title: "지난 공고",
  sourceUrl: "https://example.com/notices/2",
  deadline: "2026-09-30",
  isExpired: true
};

assert.strictEqual(
  getArtItemKey(current),
  getArtItemKey(archivedCopy),
  "같은 URL의 LIVE/ARCHIVE 항목은 하나의 공고로 인식해야 합니다."
);

const display = buildArtDisplayItems(
  [current],
  [archivedCopy, past, past]
);

assert.strictEqual(display.length, 2, "LIVE/ARCHIVE 중복은 제거해야 합니다.");

const currentDisplay = display.find(item => item._artLifecycle === "current");
const pastDisplay = display.find(item => item._artLifecycle === "past");

assert(currentDisplay, "진행 공고가 표시 데이터에 있어야 합니다.");
assert(pastDisplay, "지난 공고가 표시 데이터에 있어야 합니다.");
assert.strictEqual(currentDisplay.title, "현재 공고", "LIVE 데이터가 보관본보다 우선해야 합니다.");
assert.strictEqual(
  currentDisplay.archiveFirstSeenAt,
  "2026-10-01",
  "보관본의 보조 메타데이터는 유지해야 합니다."
);
assert.strictEqual(pastDisplay.title, "지난 공고");

const nationwideG2b = {
  source: "나라장터 건축물 미술작품",
  region: "충북",
  sourceRegion: "전국",
  agency: "청주시"
};

assert(getArtSourceValue(nationwideG2b).includes("충북"));
assert(getArtSourceValue(nationwideG2b).includes("전국"));
assert(getArtSourceValue(nationwideG2b).includes("나라장터"));

console.log("✅ art dashboard archive tests passed");
