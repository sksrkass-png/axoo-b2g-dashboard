const fs = require("fs");
const path = require("path");

const OUTPUT_FILE = path.join(
  process.cwd(),
  "data",
  "support_programs.json"
);

const KAMS_BASE = "https://www.gokams.or.kr";

const KAMS_LIST =
  "https://www.gokams.or.kr/02_apply/introduction.aspx";

const COLLECTOR_VERSION = "support_programs_kams_v1.0";


/* =========================================================
   BASIC
========================================================= */

function text(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function readJson(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) return fallback;

  const raw = fs.readFileSync(filePath, "utf8");

  if (!raw.trim()) return fallback;

  return JSON.parse(raw);
}

function writeJson(filePath, value) {
  fs.writeFileSync(
    filePath,
    JSON.stringify(value, null, 2) + "\n",
    "utf8"
  );
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(Number(code))
    );
}

function stripTags(value) {
  return text(
    decodeEntities(
      String(value ?? "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

function normalizeDate(value) {
  const raw = text(value);

  const match = raw.match(
    /(20\d{2})[-.](\d{1,2})[-.](\d{1,2})/
  );

  if (!match) return "";

  const [, year, month, day] = match;

  return [
    year,
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0")
  ].join("-");
}

function getKstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}


/* =========================================================
   HTTP
========================================================= */

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AXOO-B2G-Research/1.0)",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} : ${url}`
    );
  }

  return await response.text();
}


/* =========================================================
   AXOO FIT
========================================================= */

const STRONG_KEYWORDS = [
  "시각예술",
  "미술",
  "전시",
  "미디어아트",
  "미디어 아트",
  "미디어파사드",
  "미디어 파사드",
  "공공미술",
  "공공예술",
  "조형",
  "설치",
  "공간",
  "아트코리아랩",
  "예술기술",
  "아트페어",
  "화랑",
  "갤러리",
  "디자인",
  "실감콘텐츠",
  "실감 콘텐츠"
];

const SUPPORT_KEYWORDS = [
  "예술기업",
  "예술산업",
  "콘텐츠",
  "융합",
  "창작",
  "유통",
  "해외진출",
  "글로벌",
  "IP",
  "브랜딩",
  "팝업",
  "지역문화",
  "문화예술"
];

const NEGATIVE_KEYWORDS = [
  "공연",
  "연극",
  "뮤지컬",
  "무용",
  "국악",
  "음악",
  "문학",
  "교육생",
  "아카데미",
  "채용",
  "선정결과",
  "결과발표"
];

function analyzeAxooFit(title) {
  const source = text(title).toLowerCase();

  const strongMatches =
    STRONG_KEYWORDS.filter(keyword =>
      source.includes(keyword.toLowerCase())
    );

  const supportMatches =
    SUPPORT_KEYWORDS.filter(keyword =>
      source.includes(keyword.toLowerCase())
    );

  const negativeMatches =
    NEGATIVE_KEYWORDS.filter(keyword =>
      source.includes(keyword.toLowerCase())
    );

  let score = 45;

  score += Math.min(
    strongMatches.length * 12,
    48
  );

  score += Math.min(
    supportMatches.length * 6,
    24
  );

  score -= Math.min(
    negativeMatches.length * 25,
    60
  );

  score = Math.max(
    0,
    Math.min(100, score)
  );

  let grade = "C";

  if (score >= 85) {
    grade = "S";
  } else if (score >= 70) {
    grade = "A";
  } else if (score >= 50) {
    grade = "B";
  }

  const matchedKeywords = [
    ...new Set([
      ...strongMatches,
      ...supportMatches
    ])
  ];

  let reason =
    "문화예술 지원사업으로 확인되며 AXOO 사업 연계 가능성을 검토합니다.";

  if (strongMatches.length) {
    reason =
      `AXOO 핵심 영역인 ${strongMatches
        .slice(0, 4)
        .join(", ")} 관련성이 확인됩니다.`;
  } else if (supportMatches.length) {
    reason =
      `${supportMatches
        .slice(0, 4)
        .join(", ")} 키워드가 있어 사업 연계 가능성을 검토할 가치가 있습니다.`;
  }

  if (negativeMatches.length) {
    reason +=
      ` 다만 ${negativeMatches.join(", ")} 성격이 포함되어 우선순위를 낮췄습니다.`;
  }

  return {
    score,
    grade,
    matchedKeywords,
    negativeMatches,
    reason,
    isExcluded: score < 50
  };
}


/* =========================================================
   KAMS
========================================================= */

function findKamsRows(html) {
  return [
    ...String(html).matchAll(
      /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
    )
  ].map(match => match[1]);
}

function getKamsDetailLink(row) {
  const match = row.match(
    /href\s*=\s*["']([^"']*introduction_view\.aspx\?[^"']*Idx=\d+[^"']*)["']/i
  );

  if (!match) return "";

  return new URL(
    decodeEntities(match[1]),
    KAMS_BASE
  ).href;
}

function getKamsTitle(row) {
  const match = row.match(
    /<a\b[^>]*href\s*=\s*["'][^"']*introduction_view\.aspx\?[^"']*Idx=\d+[^"']*["'][^>]*>([\s\S]*?)<\/a>/i
  );

  if (!match) return "";

  return stripTags(match[1]);
}

function getKamsId(url) {
  try {
    return new URL(url).searchParams.get("Idx") || "";
  } catch {
    return "";
  }
}

function getKamsDeadline(row) {
  const plain = stripTags(row);

  const matches = [
    ...plain.matchAll(
      /(20\d{2}[-.]\d{1,2}[-.]\d{1,2})(?:\s+\d{1,2}:\d{2})?/g
    )
  ];

  if (!matches.length) return "";

  return normalizeDate(
    matches[matches.length - 1][1]
  );
}

async function getKamsPostedDate(detailUrl) {
  try {
    const html = await fetchHtml(detailUrl);
    const plain = stripTags(html);

    const match = plain.match(
      /작성일\s*(20\d{2}[-.]\d{1,2}[-.]\d{1,2})/
    );

    return match
      ? normalizeDate(match[1])
      : "";
  } catch (error) {
    console.warn(
      "KAMS detail date failed:",
      detailUrl,
      error.message
    );

    return "";
  }
}

async function collectKams() {
  console.log("");
  console.log("====================================");
  console.log("KAMS SUPPORT PROGRAM COLLECTOR");
  console.log("====================================");

  const candidates = [];
  let detailLinkCount = 0;

  // 최근 페이지 3개 확인
  for (let page = 1; page <= 3; page += 1) {
    const url =
      `${KAMS_LIST}?page=${page}` +
      "&ddlKeyfield=45&txtKeyword=";

    console.log(`KAMS page ${page} fetch`);

    const html = await fetchHtml(url);
    const rows = findKamsRows(html);

    for (const row of rows) {
      const detailUrl =
        getKamsDetailLink(row);

      if (!detailUrl) continue;

      detailLinkCount += 1;

      // 접수중만 수집
      if (!stripTags(row).includes("접수중")) {
        continue;
      }

      const title = getKamsTitle(row);

      if (!title) continue;

      const id = getKamsId(detailUrl);
      const deadline = getKamsDeadline(row);

      candidates.push({
        id,
        title,
        detailUrl,
        deadline
      });
    }
  }

  // 사이트 구조 변경 감지
  if (detailLinkCount === 0) {
    throw new Error(
      "KAMS 공모 링크를 하나도 찾지 못했습니다. 사이트 구조 변경 가능성이 있습니다."
    );
  }

  const uniqueCandidates = [
    ...new Map(
      candidates.map(item => [
        item.id || item.detailUrl,
        item
      ])
    ).values()
  ];

  const results = [];

  for (const item of uniqueCandidates) {
    const fit = analyzeAxooFit(item.title);

    const postedDate =
      await getKamsPostedDate(
        item.detailUrl
      );

    results.push({
      id: `kams-${item.id}`,

      category: "arts_content_support",
      categoryLabel: "예술·콘텐츠 지원사업",

      priorityCategory:
        "arts_content_support",

      priorityCategoryLabel:
        "예술·콘텐츠 지원사업",

      source: "예술경영지원센터",
      sourceCode: "KAMS",
      sourceType: "지원사업",

      title: item.title,

      organization:
        "예술경영지원센터",

      agency:
        "예술경영지원센터",

      status: "진행중",

      postedDate:
        postedDate,

      publishedDate:
        postedDate,

      startDate: "",

      endDate:
        item.deadline,

      deadline:
        item.deadline,

      budget: null,
      supportAmount: null,

      originalUrl:
        item.detailUrl,

      sourceUrl:
        item.detailUrl,

      documentUrl: "",

      field:
        fit.matchedKeywords.join(" / "),

      matchedKeywords:
        fit.matchedKeywords,

      matchedPriorityKeywords:
        fit.matchedKeywords,

      axooFitScore:
        fit.score,

      score:
        fit.score,

      grade:
        fit.grade,

      axooFitReason:
        fit.reason,

      gradeReason:
        fit.reason,

      recommendedAction:
        fit.grade === "S" ||
        fit.grade === "A"
          ? "공고문과 지원자격을 우선 확인"
          : "AXOO 참여 가능성과 지원조건 검토",

      nextAction:
        fit.grade === "S" ||
        fit.grade === "A"
          ? "공고문과 지원자격을 우선 확인"
          : "AXOO 참여 가능성과 지원조건 검토",

      isPriority:
        !fit.isExcluded,

      isExcludedFromPriority:
        fit.isExcluded,

      exclusionReason:
        fit.isExcluded
          ? "AXOO 시각예술·공간·콘텐츠 사업과의 직접 적합도가 낮음"
          : "",

      collectedAt:
        getKstToday(),

      updatedAt:
        getKstToday(),

      collectionVersion:
        COLLECTOR_VERSION
    });
  }

  console.log(
    `KAMS 접수중 공모: ${results.length}건`
  );

  console.log(
    `대시보드 노출 대상: ${
      results.filter(
        item =>
          !item.isExcludedFromPriority
      ).length
    }건`
  );

  return results;
}


/* =========================================================
   MAIN
========================================================= */

async function main() {
  const existing =
    readJson(
      OUTPUT_FILE,
      []
    );

  if (!Array.isArray(existing)) {
    throw new Error(
      "data/support_programs.json 은 배열이어야 합니다."
    );
  }

  // 향후 ARKO / KOCCA / KCDF 데이터는 보존
  const preserved =
    existing.filter(item =>
      item.sourceCode !== "KAMS"
    );

  const kams =
    await collectKams();

  const output = [
    ...preserved,
    ...kams
  ];

  writeJson(
    OUTPUT_FILE,
    output
  );

  console.log("");
  console.log("------------------------------------");
  console.log(
    `support_programs.json 총 ${output.length}건`
  );
  console.log(
    "✅ KAMS 수집 완료"
  );
  console.log("------------------------------------");
}


main().catch(error => {
  console.error("");
  console.error("❌ SUPPORT PROGRAM COLLECT FAILED");
  console.error(error);
  process.exit(1);
});
