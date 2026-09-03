const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const OUTPUT_FILE = path.join(process.cwd(), "data", "support_programs.json");

const KAMS_BASE = "https://www.gokams.or.kr/02_apply/";
const KAMS_LIST = "https://www.gokams.or.kr/02_apply/introduction.aspx";

const ARKO_BASE = "https://www.arko.or.kr/";
const ARKO_LIST =
  "https://www.arko.or.kr/board/list/4013?bid=463&sf_icon_category=cw00000019";

const COLLECTOR_VERSION =
  "support_programs_kams_arko_v2.0";


/* =========================================================
   BASIC
========================================================= */

function text(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}


function readJson(
  filePath,
  fallback = []
) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const raw =
    fs.readFileSync(
      filePath,
      "utf8"
    );

  if (!raw.trim()) {
    return fallback;
  }

  return JSON.parse(raw);
}


function writeJson(
  filePath,
  value
) {
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      value,
      null,
      2
    ) + "\n",
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
    .replace(
      /&#(\d+);/g,
      (_, code) =>
        String.fromCharCode(
          Number(code)
        )
    );
}


function stripTags(value) {
  return text(
    decodeEntities(
      String(value ?? "")
        .replace(
          /<script[\s\S]*?<\/script>/gi,
          " "
        )
        .replace(
          /<style[\s\S]*?<\/style>/gi,
          " "
        )
        .replace(
          /<[^>]+>/g,
          " "
        )
    )
  );
}


function normalizeDate(value) {
  const match =
    text(value).match(
      /(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/
    );

  if (!match) {
    return "";
  }

  const [
    ,
    year,
    month,
    day
  ] = match;

  return [
    year,
    String(month).padStart(
      2,
      "0"
    ),
    String(day).padStart(
      2,
      "0"
    )
  ].join("-");
}


function extractDates(value) {
  return [
    ...stripTags(value)
      .matchAll(
        /(20\d{2}[-./]\d{1,2}[-./]\d{1,2})(?:\s+\d{1,2}:\d{2})?/g
      )
  ]
    .map(
      match =>
        normalizeDate(
          match[1]
        )
    )
    .filter(Boolean);
}


function getKstToday() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Asia/Seoul",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit"
    }
  ).format(
    new Date()
  );
}


function stableId(value) {
  return crypto
    .createHash("sha1")
    .update(
      text(value)
    )
    .digest("hex")
    .slice(
      0,
      12
    );
}


function uniqueBy(
  items,
  keyFn
) {
  return [
    ...new Map(
      items.map(
        item => [
          keyFn(item),
          item
        ]
      )
    ).values()
  ];
}


function absoluteUrl(
  href,
  base
) {
  try {
    return new URL(
      decodeEntities(href),
      base
    ).href;
  }

  catch {
    return "";
  }
}


/* =========================================================
   HTTP
========================================================= */

async function fetchHtml(url) {
  const response =
    await fetch(
      url,
      {
        redirect:
          "follow",

        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",

          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

          "Accept-Language":
            "ko-KR,ko;q=0.9,en;q=0.8"
        }
      }
    );

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
  "전시기획",
  "전시 기획",
  "전시유통",
  "전시 유통",

  "미디어아트",
  "미디어 아트",

  "미디어파사드",
  "미디어 파사드",

  "공공미술",
  "공공 미술",

  "공공예술",
  "공공 예술",

  "조형",
  "조형물",

  "설치미술",
  "설치 미술",

  "공간",
  "공간디자인",
  "공간 디자인",

  "아트코리아랩",

  "예술기술",
  "예술 기술",

  "아트페어",
  "아트 페어",

  "화랑",
  "갤러리",

  "디자인",
  "공공디자인",
  "공공 디자인",

  "실감콘텐츠",
  "실감 콘텐츠",

  "인터랙티브"
];


const SUPPORT_KEYWORDS = [
  "예술기업",
  "예술 기업",

  "예술산업",
  "예술 산업",

  "콘텐츠",

  "융합",
  "융복합",

  "창작",
  "유통",

  "해외진출",
  "해외 진출",

  "글로벌",

  "IP",
  "아이피",

  "브랜딩",

  "팝업",
  "팝업스토어",
  "팝업 스토어",

  "지역문화",
  "지역 문화",

  "문화예술",
  "문화 예술",

  "기업협력",
  "기업 협력",
  "기업 동반성장",

  "협업",
  "콜라보레이션",

  "크라우드펀딩"
];


const NEGATIVE_KEYWORDS = [
  "공연예술",
  "공연 예술",
  "공연",

  "연극",
  "뮤지컬",
  "무용",
  "국악",

  "음악",
  "오페라",
  "작곡",
  "관현악",

  "문학",

  "교육생",
  "교육생 모집",
  "수강생",
  "아카데미",

  "채용",

  "선정결과",
  "선정 결과",

  "결과발표",
  "결과 발표",

  "심사결과",
  "심사 결과",

  "시상",
  "수상",
  "우수사례"
];


function analyzeAxooFit(value) {
  const source =
    text(value)
      .toLowerCase();


  const strongMatches =
    STRONG_KEYWORDS.filter(
      keyword =>
        source.includes(
          keyword.toLowerCase()
        )
    );


  const supportMatches =
    SUPPORT_KEYWORDS.filter(
      keyword =>
        source.includes(
          keyword.toLowerCase()
        )
    );


  const negativeMatches =
    NEGATIVE_KEYWORDS.filter(
      keyword =>
        source.includes(
          keyword.toLowerCase()
        )
    );


  let score =
    45;


  score +=
    Math.min(
      strongMatches.length * 12,
      48
    );


  score +=
    Math.min(
      supportMatches.length * 6,
      24
    );


  score -=
    Math.min(
      negativeMatches.length * 25,
      60
    );


  score =
    Math.max(
      0,
      Math.min(
        100,
        score
      )
    );


  let grade =
    "C";


  if (score >= 85) {
    grade =
      "S";
  }

  else if (
    score >= 70
  ) {
    grade =
      "A";
  }

  else if (
    score >= 50
  ) {
    grade =
      "B";
  }


  const matchedKeywords = [
    ...new Set([
      ...strongMatches,
      ...supportMatches
    ])
  ];


  let reason =
    "문화예술 지원사업으로 확인되며 AXOO 사업 연계 가능성을 검토합니다.";


  if (
    strongMatches.length
  ) {
    reason =
      `AXOO 핵심 영역인 ${strongMatches
        .slice(0, 4)
        .join(", ")} 관련성이 확인됩니다.`;
  }

  else if (
    supportMatches.length
  ) {
    reason =
      `${supportMatches
        .slice(0, 4)
        .join(", ")} 키워드가 있어 사업 연계 가능성을 검토할 가치가 있습니다.`;
  }


  if (
    negativeMatches.length
  ) {
    reason +=
      ` 다만 ${negativeMatches.join(", ")} 성격이 포함되어 우선순위를 낮췄습니다.`;
  }


  return {
    score,
    grade,

    matchedKeywords,
    negativeMatches,

    reason,

    isExcluded:
      score < 50
  };
}


/* =========================================================
   NORMALIZED SUPPORT RECORD
========================================================= */

function makeSupportRecord({
  id,
  source,
  sourceCode,
  title,

  startDate = "",
  deadline = "",

  postedDate = "",
  publishedDate = "",

  sourceUrl = "",
  documentUrl = "",

  fit
}) {

  const nextAction =
    fit.grade === "S" ||
    fit.grade === "A"
      ? "공고문과 지원자격을 우선 확인"
      : "AXOO 참여 가능성과 지원조건 검토";


  return {
    id,


    category:
      "arts_content_support",

    categoryLabel:
      "예술·콘텐츠 지원사업",


    priorityCategory:
      "arts_content_support",

    priorityCategoryLabel:
      "예술·콘텐츠 지원사업",


    source,
    sourceCode,

    sourceType:
      "지원사업",


    title,


    organization:
      source,

    agency:
      source,


    status:
      "진행중",


    postedDate,

    publishedDate:
      publishedDate ||
      postedDate ||
      startDate,


    startDate,


    endDate:
      deadline,

    deadline,


    budget:
      null,

    supportAmount:
      null,


    originalUrl:
      sourceUrl,

    sourceUrl,

    documentUrl,


    field:
      fit.matchedKeywords
        .join(" / "),


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
      nextAction,

    nextAction,


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
  };
}


/* =========================================================
   KAMS PARSER
========================================================= */

function findKamsRows(html) {
  return [
    ...String(html)
      .matchAll(
        /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
      )
  ].map(
    match =>
      match[1]
  );
}


function isKamsOpenRow(row) {
  const raw =
    decodeEntities(
      String(row ?? "")
    );

  const plain =
    stripTags(raw);


  return (
    plain.includes(
      "접수중"
    ) ||

    /alt\s*=\s*["'][^"']*접수중[^"']*["']/i
      .test(raw) ||

    /title\s*=\s*["'][^"']*접수중[^"']*["']/i
      .test(raw) ||

    raw.includes(
      "접수중"
    )
  );
}


function getKamsDetailLink(row) {
  const source =
    decodeEntities(
      String(row ?? "")
    );


  const anchors = [
    ...source.matchAll(
      /<a\b([^>]*)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi
    )
  ];


  for (
    const anchor of anchors
  ) {
    const href =
      decodeEntities(
        anchor[2]
      );


    if (
      href.includes(
        "introduction_view.aspx"
      ) &&
      /Idx=\d+/i.test(
        href
      )
    ) {

      const url =
        absoluteUrl(
          href,
          KAMS_BASE
        );


      if (url) {
        return url;
      }
    }
  }


  const fallback =
    source.match(
      /href\s*=\s*["']([^"']*introduction_view\.aspx[^"']*Idx=\d+[^"']*)["']/i
    );


  return fallback
    ? absoluteUrl(
        fallback[1],
        KAMS_BASE
      )
    : "";
}


function getKamsTitle(
  row,
  detailUrl
) {
  const source =
    decodeEntities(
      String(row ?? "")
    );


  const anchors = [
    ...source.matchAll(
      /<a\b([^>]*)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi
    )
  ];


  for (
    const anchor of anchors
  ) {
    const href =
      decodeEntities(
        anchor[2]
      );


    if (
      !href.includes(
        "introduction_view.aspx"
      )
    ) {
      continue;
    }


    const title =
      stripTags(
        anchor[4]
      );


    if (
      title &&
      title !== "보기"
    ) {
      return title;
    }
  }


  if (detailUrl) {
    const id =
      getKamsId(
        detailUrl
      );


    if (id) {
      const pattern =
        new RegExp(
          `<a\\b[^>]*href\\s*=\\s*["'][^"']*Idx=${id}[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>`,
          "i"
        );


      const match =
        source.match(
          pattern
        );


      if (match) {
        return stripTags(
          match[1]
        );
      }
    }
  }


  return "";
}


function getKamsId(url) {
  try {
    return (
      new URL(url)
        .searchParams
        .get("Idx") ||
      ""
    );
  }

  catch {
    return "";
  }
}


function getKamsDeadline(row) {
  const dates =
    extractDates(
      row
    );


  return dates.length
    ? dates[
        dates.length - 1
      ]
    : "";
}


/* =========================================================
   KAMS DETAIL
========================================================= */

async function getKamsDetailInfo(detailUrl) {
  try {
    const html =
      await fetchHtml(
        detailUrl
      );


    const raw =
      decodeEntities(
        String(html ?? "")
      );


    const plain =
      stripTags(raw);


    let postedDate =
      "";


    const plainPatterns = [
      /작성일\s*[:：]?\s*(20\d{2}[-.]\d{1,2}[-.]\d{1,2})/i,
      /등록일\s*[:：]?\s*(20\d{2}[-.]\d{1,2}[-.]\d{1,2})/i,
      /게시일\s*[:：]?\s*(20\d{2}[-.]\d{1,2}[-.]\d{1,2})/i
    ];


    for (
      const pattern of plainPatterns
    ) {
      const match =
        plain.match(
          pattern
        );


      if (match) {
        postedDate =
          normalizeDate(
            match[1]
          );

        break;
      }
    }


    if (!postedDate) {
      const rawPatterns = [
        /작성일[\s\S]{0,500}?(20\d{2}[-.]\d{1,2}[-.]\d{1,2})/i,
        /등록일[\s\S]{0,500}?(20\d{2}[-.]\d{1,2}[-.]\d{1,2})/i,
        /게시일[\s\S]{0,500}?(20\d{2}[-.]\d{1,2}[-.]\d{1,2})/i
      ];


      for (
        const pattern of rawPatterns
      ) {
        const match =
          raw.match(
            pattern
          );


        if (match) {
          postedDate =
            normalizeDate(
              match[1]
            );

          break;
        }
      }
    }


    console.log(
      "  상세 작성일:",
      postedDate ||
      "미확인"
    );


    return {
      postedDate
    };
  }

  catch (error) {
    console.warn(
      "⚠️ KAMS detail fetch failed:",
      detailUrl,
      error.message
    );


    return {
      postedDate:
        ""
    };
  }
}


/* =========================================================
   KAMS COLLECTOR
========================================================= */

async function collectKams() {
  console.log("");
  console.log(
    "===================================="
  );
  console.log(
    "KAMS SUPPORT PROGRAM COLLECTOR"
  );
  console.log(
    "===================================="
  );


  const candidates =
    [];


  let totalRows =
    0;

  let detailLinkCount =
    0;

  let openRowCount =
    0;


  for (
    let page = 1;
    page <= 3;
    page += 1
  ) {

    const url =
      `${KAMS_LIST}?page=${page}` +
      "&ddlKeyfield=45" +
      "&txtKeyword=";


    console.log(
      `KAMS page ${page} fetch`
    );


    const html =
      await fetchHtml(
        url
      );


    console.log(
      `HTML length: ${html.length}`
    );


    const rows =
      findKamsRows(
        html
      );


    console.log(
      `table rows: ${rows.length}`
    );


    totalRows +=
      rows.length;


    for (
      const row of rows
    ) {
      const detailUrl =
        getKamsDetailLink(
          row
        );


      if (!detailUrl) {
        continue;
      }


      detailLinkCount +=
        1;


      if (
        !isKamsOpenRow(
          row
        )
      ) {
        continue;
      }


      openRowCount +=
        1;


      const title =
        getKamsTitle(
          row,
          detailUrl
        );


      if (!title) {
        console.warn(
          "⚠️ 제목 추출 실패:",
          detailUrl
        );

        continue;
      }


      candidates.push({
        id:
          getKamsId(
            detailUrl
          ),

        title,

        detailUrl,

        deadline:
          getKamsDeadline(
            row
          )
      });
    }
  }


  console.log("");
  console.log(
    "KAMS parser diagnostic"
  );

  console.log(
    "전체 table row:",
    totalRows
  );

  console.log(
    "공모 detail link:",
    detailLinkCount
  );

  console.log(
    "접수중 row:",
    openRowCount
  );

  console.log(
    "후보:",
    candidates.length
  );


  if (
    detailLinkCount === 0
  ) {
    throw new Error(
      "KAMS 공모 상세 링크를 하나도 찾지 못했습니다. 사이트 HTML 구조를 다시 확인해야 합니다."
    );
  }


  if (
    openRowCount === 0
  ) {
    throw new Error(
      "KAMS에서 접수중 공고를 하나도 인식하지 못했습니다. 접수 상태 HTML 구조를 확인해야 합니다."
    );
  }


  if (
    candidates.length === 0
  ) {
    throw new Error(
      "KAMS 접수중 공고는 발견했지만 제목을 추출하지 못했습니다."
    );
  }


  const uniqueCandidates =
    uniqueBy(
      candidates,
      item =>
        item.id ||
        item.detailUrl
    );


  const results =
    [];


  for (
    const item of uniqueCandidates
  ) {

    console.log("");
    console.log(
      "→",
      item.title
    );


    const fit =
      analyzeAxooFit(
        item.title
      );


    const detailInfo =
      await getKamsDetailInfo(
        item.detailUrl
      );


    const result =
      makeSupportRecord({
        id:
          `kams-${item.id}`,

        source:
          "예술경영지원센터",

        sourceCode:
          "KAMS",

        title:
          item.title,

        deadline:
          item.deadline,

        postedDate:
          detailInfo.postedDate,

        publishedDate:
          detailInfo.postedDate,

        sourceUrl:
          item.detailUrl,

        fit
      });


    results.push(
      result
    );


    console.log(
      `  ${result.grade} / ${result.score}점 / ${result.deadline || "마감일 미확인"}`
    );
  }


  if (
    results.length === 0
  ) {
    throw new Error(
      "KAMS 결과가 0건입니다. 빈 데이터를 저장하지 않습니다."
    );
  }


  console.log("");
  console.log(
    "------------------------------------"
  );

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
   ARKO PARSER
========================================================= */

function getAnchorEntries(source) {
  return [
    ...String(
      source ?? ""
    ).matchAll(
      /<a\b([^>]*)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi
    )
  ].map(
    match => ({
      attrs:
        `${match[1]} ${match[3]}`,

      href:
        decodeEntities(
          match[2]
        ),

      html:
        match[4],

      plain:
        stripTags(
          match[4]
        ),

      full:
        match[0]
    })
  );
}


function looksLikeArkoDetailUrl(href) {
  const value =
    text(href)
      .toLowerCase();


  return (
    value.includes(
      "artnuri"
    ) ||

    value.includes(
      "/supp/content/"
    ) ||

    value.includes(
      "/board/view/"
    ) ||

    value.includes(
      "/board/view/4013"
    ) ||

    (
      value.includes(
        "bid=463"
      ) &&
      (
        value.includes(
          "cid="
        ) ||

        value.includes(
          "seq="
        ) ||

        value.includes(
          "idx="
        )
      )
    )
  );
}


function getArkoDetailUrl(block) {
  const anchors =
    getAnchorEntries(
      block
    );


  for (
    const anchor of anchors
  ) {

    if (
      looksLikeArkoDetailUrl(
        anchor.href
      )
    ) {

      return absoluteUrl(
        anchor.href,
        ARKO_BASE
      );
    }
  }


  for (
    const anchor of anchors
  ) {

    const href =
      text(
        anchor.href
      );


    if (
      !href ||
      href.startsWith("#") ||
      href
        .toLowerCase()
        .startsWith(
          "javascript:"
        )
    ) {
      continue;
    }


    if (
      anchor.plain.includes(
        "상세보기"
      ) ||

      anchor.plain.includes(
        "자세히보기"
      )
    ) {

      return absoluteUrl(
        href,
        ARKO_BASE
      );
    }
  }


  return "";
}


function getArkoTitle(block) {
  const raw =
    String(
      block ?? ""
    );


  const preferredPatterns = [
    /<(?:strong|h2|h3|h4|h5)\b[^>]*>([\s\S]*?)<\/(?:strong|h2|h3|h4|h5)>/gi,

    /<(?:p|div|span)\b[^>]*class\s*=\s*["'][^"']*(?:tit|title|subject)[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div|span)>/gi
  ];


  for (
    const pattern of preferredPatterns
  ) {

    for (
      const match of raw.matchAll(
        pattern
      )
    ) {

      const candidate =
        stripTags(
          match[1]
        )
          .replace(
            /^진행중\s*/i,
            ""
          )
          .replace(
            /^NEW\s*/i,
            ""
          )
          .trim();


      if (
        candidate.length >= 5 &&
        !candidate.includes(
          "상세보기"
        ) &&
        !/^20\d{2}[.-]/.test(
          candidate
        )
      ) {
        return candidate;
      }
    }
  }


  for (
    const anchor of getAnchorEntries(
      raw
    )
  ) {

    let candidate =
      anchor.plain
        .replace(
          /^진행중\s*/i,
          ""
        )
        .replace(
          /^NEW\s*/i,
          ""
        )
        .replace(
          /상세보기.*$/i,
          ""
        )
        .replace(
          /자세히보기.*$/i,
          ""
        )
        .trim();


    const firstDate =
      candidate.search(
        /20\d{2}[-./]\d{1,2}[-./]\d{1,2}/
      );


    if (
      firstDate >= 0
    ) {

      candidate =
        candidate
          .slice(
            0,
            firstDate
          )
          .trim();
    }


    if (
      candidate.length >= 5 &&
      looksLikeArkoDetailUrl(
        anchor.href
      )
    ) {
      return candidate;
    }
  }


  const plain =
    stripTags(
      raw
    )
      .replace(
        /^진행중\s*/i,
        ""
      )
      .replace(
        /^NEW\s*/i,
        ""
      )
      .trim();


  const dateIndex =
    plain.search(
      /20\d{2}[-./]\d{1,2}[-./]\d{1,2}/
    );


  if (
    dateIndex > 0
  ) {

    return plain
      .slice(
        0,
        dateIndex
      )
      .replace(
        /상세보기.*$/i,
        ""
      )
      .trim();
  }


  return "";
}


function getArkoSummary(
  block,
  title
) {
  const raw =
    String(
      block ?? ""
    );


  const pMatches = [
    ...raw.matchAll(
      /<p\b[^>]*>([\s\S]*?)<\/p>/gi
    )
  ]
    .map(
      match =>
        stripTags(
          match[1]
        )
    )
    .filter(Boolean)
    .filter(
      value =>
        value !== title
    )
    .filter(
      value =>
        !value.includes(
          "상세보기"
        )
    )
    .filter(
      value =>
        !value.includes(
          "자세히보기"
        )
    )
    .filter(
      value =>
        !/^20\d{2}[.-]/.test(
          value
        )
    );


  if (
    pMatches.length
  ) {

    return pMatches
      .sort(
        (
          a,
          b
        ) =>
          b.length -
          a.length
      )[0];
  }


  return text(
    stripTags(
      raw
    )
      .replace(
        title,
        " "
      )
      .replace(
        /진행중/gi,
        " "
      )
      .replace(
        /NEW/gi,
        " "
      )
      .replace(
        /상세보기/gi,
        " "
      )
      .replace(
        /자세히보기/gi,
        " "
      )
      .replace(
        /20\d{2}[-./]\d{1,2}[-./]\d{1,2}/g,
        " "
      )
  );
}


function findArkoBlocks(html) {
  const source =
    String(
      html ?? ""
    );


  const blocks =
    [];


  const liBlocks = [
    ...source.matchAll(
      /<li\b[^>]*>([\s\S]*?)<\/li>/gi
    )
  ].map(
    match =>
      match[0]
  );


  for (
    const block of liBlocks
  ) {

    const plain =
      stripTags(
        block
      );


    if (
      plain.includes(
        "진행중"
      ) &&
      /20\d{2}[-./]\d{1,2}[-./]\d{1,2}/
        .test(
          plain
        )
    ) {

      blocks.push(
        block
      );
    }
  }


  if (
    blocks.length
  ) {
    return blocks;
  }


  for (
    const anchor of getAnchorEntries(
      source
    )
  ) {

    if (
      anchor.plain.includes(
        "진행중"
      ) &&
      /20\d{2}[-./]\d{1,2}[-./]\d{1,2}/
        .test(
          anchor.plain
        )
    ) {

      blocks.push(
        anchor.full
      );
    }
  }


  if (
    blocks.length
  ) {
    return blocks;
  }


  /*
    ARKO 카드 HTML 구조가 변경된 경우를 위한 fallback.
    "진행중" 주변 HTML을 임시 후보로 사용.
  */

  let cursor =
    0;


  while (true) {

    const index =
      source.indexOf(
        "진행중",
        cursor
      );


    if (
      index < 0
    ) {
      break;
    }


    const start =
      Math.max(
        0,
        index - 1800
      );


    const end =
      Math.min(
        source.length,
        index + 3200
      );


    const windowHtml =
      source.slice(
        start,
        end
      );


    if (
      /20\d{2}[-./]\d{1,2}[-./]\d{1,2}/
        .test(
          stripTags(
            windowHtml
          )
        )
    ) {

      blocks.push(
        windowHtml
      );
    }


    cursor =
      index + 3;
  }


  return blocks;
}


function getArkoId(
  detailUrl,
  title
) {
  try {

    const url =
      new URL(
        detailUrl
      );


    const queryKeys = [
      "cid",
      "seq",
      "idx",
      "id",
      "contentId",
      "bbsId"
    ];


    for (
      const key of queryKeys
    ) {

      const value =
        url.searchParams
          .get(
            key
          );


      if (value) {
        return value;
      }
    }


    const pathNumber =
      url.pathname.match(
        /\/(\d+)(?:\/)?$/
      );


    if (
      pathNumber
    ) {

      return pathNumber[1];
    }
  }

  catch {
    // fallback
  }


  return stableId(
    `${detailUrl}|${title}`
  );
}


/* =========================================================
   ARKO COLLECTOR
========================================================= */

async function collectArko() {
  console.log("");
  console.log(
    "===================================="
  );
  console.log(
    "ARKO SUPPORT PROGRAM COLLECTOR"
  );
  console.log(
    "===================================="
  );


  const candidates =
    [];


  let totalBlocks =
    0;

  let openBlocks =
    0;

  let detailLinks =
    0;


  /*
    최근 2페이지 검사
  */

  for (
    let page = 1;
    page <= 2;
    page += 1
  ) {

    const url =
      `${ARKO_LIST}&page=${page}`;


    console.log(
      `ARKO page ${page} fetch`
    );


    const html =
      await fetchHtml(
        url
      );


    console.log(
      `HTML length: ${html.length}`
    );


    if (
      !html.includes(
        "공모"
      ) &&
      !html.includes(
        "지원"
      )
    ) {

      throw new Error(
        "ARKO 목록 페이지를 정상적으로 읽지 못했습니다."
      );
    }


    const blocks =
      findArkoBlocks(
        html
      );


    totalBlocks +=
      blocks.length;


    console.log(
      `진행중 후보 block: ${blocks.length}`
    );


    for (
      const block of blocks
    ) {

      if (
        !stripTags(
          block
        ).includes(
          "진행중"
        )
      ) {
        continue;
      }


      openBlocks +=
        1;


      const detailUrl =
        getArkoDetailUrl(
          block
        );


      if (!detailUrl) {
        continue;
      }


      detailLinks +=
        1;


      const title =
        getArkoTitle(
          block
        );


      if (!title) {
        console.warn(
          "⚠️ ARKO 제목 추출 실패:",
          detailUrl
        );

        continue;
      }


      const dates =
        extractDates(
          block
        );


      const startDate =
        dates[0] ||
        "";


      const deadline =
        dates.length >= 2
          ? dates[1]
          : dates[0] ||
            "";


      const summary =
        getArkoSummary(
          block,
          title
        );


      candidates.push({
        id:
          getArkoId(
            detailUrl,
            title
          ),

        title,

        summary,

        detailUrl,

        startDate,

        deadline
      });
    }
  }


  console.log("");
  console.log(
    "ARKO parser diagnostic"
  );

  console.log(
    "진행중 후보 block:",
    totalBlocks
  );

  console.log(
    "진행중 인식:",
    openBlocks
  );

  console.log(
    "상세 링크:",
    detailLinks
  );

  console.log(
    "후보:",
    candidates.length
  );


  /*
    ARKO는 진행중 공모가 실제 0건일 수도 있음.

    단,
    진행중 블록은 있는데
    실제 후보를 하나도 만들지 못하면
    HTML 구조 변경으로 판단.
  */

  if (
    openBlocks > 0 &&
    candidates.length === 0
  ) {

    throw new Error(
      "ARKO 진행중 공고는 발견했지만 상세 링크 또는 제목을 추출하지 못했습니다."
    );
  }


  const uniqueCandidates =
    uniqueBy(
      candidates,
      item =>
        item.detailUrl ||
        `${item.title}|${item.deadline}`
    );


  const results =
    [];


  for (
    const item of uniqueCandidates
  ) {

    console.log("");
    console.log(
      "→",
      item.title
    );


    /*
      ARKO는 제목 + 목록 설명문까지
      같이 분석한다.
    */

    const fit =
      analyzeAxooFit(
        [
          item.title,
          item.summary
        ]
          .filter(Boolean)
          .join(" ")
      );


    const result =
      makeSupportRecord({
        id:
          `arko-${item.id}`,

        source:
          "한국문화예술위원회",

        sourceCode:
          "ARKO",

        title:
          item.title,

        startDate:
          item.startDate,

        deadline:
          item.deadline,

        publishedDate:
          item.startDate,

        sourceUrl:
          item.detailUrl,

        fit
      });


    results.push(
      result
    );


    console.log(
      `  ${result.grade} / ${result.score}점 / ${result.deadline || "마감일 미확인"}`
    );
  }


  console.log("");
  console.log(
    "------------------------------------"
  );


  console.log(
    `ARKO 진행중 공모: ${results.length}건`
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


  if (
    !Array.isArray(
      existing
    )
  ) {

    throw new Error(
      "data/support_programs.json 은 배열이어야 합니다."
    );
  }


  /*
    KAMS / ARKO는
    이번 실행 결과로 교체.

    향후 추가될
    KCDF / KOCCA 등의 데이터는 유지.
  */

  const preserved =
    existing.filter(
      item =>
        ![
          "KAMS",
          "ARKO"
        ].includes(
          text(
            item.sourceCode
          ).toUpperCase()
        )
    );


  const kams =
    await collectKams();


  const arko =
    await collectArko();


  const output = [
    ...preserved,
    ...kams,
    ...arko
  ];


  if (
    output.length === 0
  ) {

    throw new Error(
      "저장할 지원사업 데이터가 없습니다."
    );
  }


  writeJson(
    OUTPUT_FILE,
    output
  );


  console.log("");
  console.log(
    "===================================="
  );

  console.log(
    "SUPPORT PROGRAM COLLECTION COMPLETE"
  );

  console.log(
    "------------------------------------"
  );


  console.log(
    `support_programs.json 총 ${output.length}건`
  );


  console.log(
    `KAMS ${kams.length}건`
  );


  console.log(
    `ARKO ${arko.length}건`
  );


  console.log(
    `기타 기관 보존 ${preserved.length}건`
  );


  console.log(
    `대시보드 노출 대상 ${
      output.filter(
        item =>
          !item.isExcludedFromPriority
      ).length
    }건`
  );


  console.log(
    "✅ KAMS + ARKO 수집 완료"
  );


  console.log(
    "===================================="
  );
}


main().catch(
  error => {

    console.error("");

    console.error(
      "===================================="
    );

    console.error(
      "❌ SUPPORT PROGRAM COLLECT FAILED"
    );

    console.error(
      "------------------------------------"
    );

    console.error(
      error.stack ||
      error.message ||
      error
    );

    console.error(
      "===================================="
    );


    process.exit(1);
  }
);
