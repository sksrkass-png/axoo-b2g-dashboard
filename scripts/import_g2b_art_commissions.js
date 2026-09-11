const fs = require("fs");
const path = require("path");

const {
  inferTargetArtRegionFromValues,
  getTargetArtRegionById
} = require("./art_region_scope");


/* =========================================================
   G2B → ARCHITECTURAL ART COMMISSION IMPORT

   나라장터의 일반 시각예술 사업은 이 목록에 넣지 않는다.
   "건축물 미술작품"/"미술장식품" 또는 제작·설치 목적이
   명확한 미술작품 공고만 별도 보조 소스로 합친다.
========================================================= */

const DATA_FILE = path.join(process.cwd(), "data", "art_commissions.json");
const ARCHIVE_FILE = path.join(process.cwd(), "data", "art_commissions_archive.json");
const G2B_FILE = path.join(process.cwd(), "data", "b2g_opportunities.json");
const HEALTH_FILE = path.join(process.cwd(), "data", "art_commission_collection_health.json");

const SOURCE_ID = "g2b_architectural_art";
const SOURCE_NAME = "나라장터 건축물 미술작품";
const COLLECTION_VERSION = "1.0.0";

const EXCLUDE_KEYWORDS = [
  "심사결과",
  "심사 결과",
  "선정결과",
  "선정 결과",
  "낙찰자 선정",
  "계약 결과"
];

// 나라장터 기관명에는 광역시·도명이 빠지고 시·군명만 오는 경우가 많다.
// 불확실한 광주시 등은 넣지 않고, 광역권이 단일하게 결정되는 대표 지명만 보완한다.
const MUNICIPALITY_REGION_HINTS = {
  chungbuk: ["청주시", "충주시", "제천시", "보은군", "옥천군", "영동군", "증평군", "진천군", "괴산군", "음성군", "단양군"],
  chungnam: ["천안시", "공주시", "보령시", "아산시", "서산시", "논산시", "계룡시", "당진시", "금산군", "부여군", "서천군", "청양군", "홍성군", "예산군", "태안군"],
  jeonbuk: ["전주시", "군산시", "익산시", "정읍시", "남원시", "김제시", "완주군", "진안군", "무주군", "장수군", "임실군", "순창군", "고창군", "부안군"],
  jeonnam: ["목포시", "여수시", "순천시", "나주시", "광양시", "담양군", "곡성군", "구례군", "고흥군", "보성군", "화순군", "장흥군", "강진군", "해남군", "영암군", "무안군", "함평군", "영광군", "장성군", "완도군", "진도군", "신안군"],
  gyeongbuk: ["포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시", "상주시", "문경시", "경산시", "의성군", "청송군", "영양군", "영덕군", "청도군", "고령군", "성주군", "칠곡군", "예천군", "봉화군", "울진군", "울릉군"],
  gyeongnam: ["창원시", "진주시", "통영시", "사천시", "김해시", "밀양시", "거제시", "양산시", "의령군", "함안군", "창녕군", "고성군", "남해군", "하동군", "산청군", "함양군", "거창군", "합천군"],
  gangwon: ["춘천시", "원주시", "강릉시", "동해시", "태백시", "속초시", "삼척시", "홍천군", "횡성군", "영월군", "평창군", "정선군", "철원군", "화천군", "양구군", "인제군", "고성군", "양양군"],
  jeju: ["제주시", "서귀포시"]
};


function readArray(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(path.basename(filePath) + " 은 배열 형식이어야 합니다.");
  }

  return parsed;
}


function readObject(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return {};

  const parsed = JSON.parse(raw);
  return parsed && !Array.isArray(parsed) && typeof parsed === "object" ? parsed : {};
}


function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}


function text(value) {
  return String(value == null ? "" : value)
    .replace(/\s+/g, " ")
    .trim();
}


function todayKst() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));

  return [values.year, values.month, values.day].join("-");
}


function itemUrl(item) {
  return text(item && (item.sourceUrl || item.originalUrl || item.url));
}


function sourceText(item) {
  return [
    item && (item.title || item.bidNtceNm),
    item && item.ntceSpecFileNm1,
    item && item.ntceSpecFileNm2,
    item && item.ntceSpecFileNm3,
    item && item.ntceSpecFileNm4,
    item && item.ntceSpecFileNm5
  ].map(text).join(" ");
}


function isArchitecturalArtCommission(item) {
  const value = sourceText(item);

  if (!value || EXCLUDE_KEYWORDS.some(keyword => value.includes(keyword))) {
    return false;
  }

  const explicitBuildingArt = /건축물\s*미술작품|건축물미술작품|미술장식품|미술장식/.test(value);
  const artInstallation = /미술\s*작품|미술작품/.test(value) && /제작|설치|공모|구매|조형물/.test(value);

  return explicitBuildingArt || artInstallation;
}


function normalizeDate(value) {
  const match = text(value).match(/(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/);
  if (!match) return "";

  return [match[1], match[2].padStart(2, "0"), match[3].padStart(2, "0")].join("-");
}


function inferRegion(values) {
  const direct = inferTargetArtRegionFromValues(values);
  if (direct) return direct;

  const joined = values.map(text).join(" ");
  for (const [regionId, names] of Object.entries(MUNICIPALITY_REGION_HINTS)) {
    if (names.some(name => joined.includes(name))) {
      return getTargetArtRegionById(regionId);
    }
  }

  return null;
}


function buildItem(raw, today) {
  const title = text(raw.title || raw.bidNtceNm);
  const sourceUrl = text(raw.sourceUrl || raw.bidNtceUrl || raw.bidNtceDtlUrl);
  const agency = text(raw.agency || raw.noticeAgency || raw.ntceInsttNm);
  const organization = text(raw.demandAgency || raw.dminsttNm || agency);
  const regionInfo = inferRegion([
    raw.region,
    raw.location,
    organization,
    agency,
    title
  ]);
  const region = regionInfo ? regionInfo.name : "전국";

  return {
    id: "g2b-art-" + text(raw.bidNtceNo || raw.noticeNo || sourceUrl),
    source: SOURCE_NAME,
    sourceName: SOURCE_NAME,
    sourceType: "national_procurement",
    title,
    agency,
    organization,
    region,
    regionId: regionInfo ? regionInfo.id : "",
    regionFullName: regionInfo ? regionInfo.fullName : "",
    sourceRegion: "전국",
    sourceRegionId: "national",
    regionInferred: Boolean(regionInfo),
    regionInferenceSource: regionInfo ? "g2b_agency_or_title" : "",
    regionInferenceStatus: regionInfo ? "resolved" : "unresolved",
    category: "미술작품 공모",
    categoryLabel: "건축물 미술작품",
    status: "공모중",
    publishedDate: normalizeDate(raw.publishedDate || raw.postedDate || raw.bidNtceDt),
    postedDate: normalizeDate(raw.postedDate || raw.publishedDate || raw.bidNtceDt),
    deadline: normalizeDate(raw.deadline || raw.deadlineDate || raw.bidClseDt || raw.opengDt),
    endDate: normalizeDate(raw.deadline || raw.deadlineDate || raw.bidClseDt || raw.opengDt),
    amount: text(raw.budgetAmount || raw.asignBdgtAmt),
    amountNumeric: Number(raw.budgetAmount || raw.asignBdgtAmt || 0) || null,
    budget: text(raw.budgetAmount || raw.asignBdgtAmt),
    location: text(raw.location),
    installationLocation: text(raw.location),
    eligibility: "",
    keywords: ["건축물 미술작품", "나라장터", "제작", "설치"],
    recommendedAction: "공고 원문·과업지시서에서 설치 대상, 접수 방식, 참가 자격을 확인",
    sourceUrl,
    originalUrl: sourceUrl,
    bidNtceNo: text(raw.bidNtceNo || raw.noticeNo),
    score: 80,
    grade: "A",
    isExpired: false,
    isStaleCandidate: false,
    collectionSourceId: SOURCE_ID,
    collectionVersion: COLLECTION_VERSION,
    collectionTransport: "g2b_dataset_import",
    detailFetchStatus: "not_requested",
    detailFetchError: "",
    rawText: sourceText(raw),
    collectedAt: today,
    updatedAt: today
  };
}


function mergeByUrl(existing, incoming, today, isArchive) {
  const byUrl = new Map();
  const withoutUrl = [];

  existing.forEach(item => {
    const url = itemUrl(item);
    if (url) byUrl.set(url, item);
    else withoutUrl.push(item);
  });

  incoming.forEach(item => {
    const url = itemUrl(item);
    if (!url) return;

    const previous = byUrl.get(url);
    const merged = {
      ...(previous || {}),
      ...item,
      archiveFirstSeenAt: isArchive ? ((previous && previous.archiveFirstSeenAt) || today) : undefined,
      archiveLastSeenAt: isArchive ? today : undefined,
      archiveIsCurrent: isArchive ? true : undefined
    };

    if (!isArchive) {
      delete merged.archiveFirstSeenAt;
      delete merged.archiveLastSeenAt;
      delete merged.archiveIsCurrent;
    }

    byUrl.set(url, merged);
  });

  return Array.from(byUrl.values()).concat(withoutUrl);
}


function importG2bArtCommissions(options = {}) {
  const today = options.today || todayKst();
  const g2b = options.g2b || readArray(G2B_FILE);
  const live = options.live || readArray(DATA_FILE);
  const archive = options.archive || readArray(ARCHIVE_FILE);
  const matches = g2b.filter(isArchitecturalArtCommission);
  const imported = matches.map(item => buildItem(item, today)).filter(item => item.sourceUrl);
  const nextLive = mergeByUrl(live, imported, today, false);
  const nextArchive = mergeByUrl(archive, imported, today, true);

  if (!options.dryRun) {
    writeJson(DATA_FILE, nextLive);
    writeJson(ARCHIVE_FILE, nextArchive);
    writeJson(HEALTH_FILE, {
      ...readObject(HEALTH_FILE),
      updatedAt: today,
      g2bArchitecturalArt: {
        sourceId: SOURCE_ID,
        checked: g2b.length,
        matched: imported.length,
        status: "ok"
      }
    });
  }

  return { checked: g2b.length, matched: imported.length, imported, nextLive, nextArchive };
}


if (require.main === module) {
  try {
    const result = importG2bArtCommissions();
    console.log("G2B 건축물 미술작품 후보 검사:", result.checked);
    console.log("G2B 건축물 미술작품 반영:", result.matched);
  } catch (error) {
    console.error("[AXOO G2B ART IMPORT]", error);
    process.exitCode = 1;
  }
}


module.exports = {
  isArchitecturalArtCommission,
  buildItem,
  mergeByUrl,
  importG2bArtCommissions
};
