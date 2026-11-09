const assert = require("assert");
const fs = require("fs");
const housing = require("./art_housing_scope");
const { isArchitecturalArtCommission, isGenericSculptureNotice,
  mergeActiveSculptureCandidates } = require("./import_g2b_art_commissions");

const samples = [
  { bidNtceNo: "R1", title: "지역농특산물 조형물설치(조합추천)", deadline: "2026-11-20" },
  { bidNtceNo: "R2", title: "우주항공테마공원 안내 조형물 설치공사", deadline: "2026-11-20" },
  { bidNtceNo: "R3", title: "함평 한우테마거리 미디어 조형물 제작 설치", deadline: "2026-11-20" }
];
samples.forEach(item => {
  assert(!isArchitecturalArtCommission(item), "general sculpture cannot enter tab 01: " + item.title);
  assert(isGenericSculptureNotice(item), "general sculpture belongs in tab 02: " + item.title);
});
const estate = { bidNtceNo: "R4", title: "고양창릉 S-5BL 공동주택 미술작품 제작·설치 공모",
  deadline: "2026-11-20" };
assert(isArchitecturalArtCommission(estate), "housing art should enter tab 01");
assert(!isGenericSculptureNotice(estate), "housing art should not enter tab 02");

const merged = mergeActiveSculptureCandidates(samples, [samples[1], estate], "2026-11-09");
assert.strictEqual(merged.length, 3, "sculpture feed should deduplicate and exclude housing art");

for (const file of ["data/art_commissions.json", "data/art_commissions_archive.json"]) {
  const items = JSON.parse(fs.readFileSync(file, "utf8"));
  items.forEach(item => assert(housing.isHousingArtCommission(item),
    "tab 01 must have housing-only notices: " + item.title));
}
const priority = JSON.parse(fs.readFileSync("data/priority_projects.json", "utf8"));
priority.filter(item => /조형물|벽화/.test(item.title || "") &&
  /나라장터|g2b/.test([item.sourceType, item.collectionSourceId].join(" "))).forEach(item => {
  assert.strictEqual(item.priorityCategory, "mural_sculpture",
    "general sculpture must be tab 02 only: " + item.title);
});
console.log("✅ G2B housing artwork vs general sculpture routing PASS");
