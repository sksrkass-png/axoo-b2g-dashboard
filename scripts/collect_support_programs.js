const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const OUTPUT_FILE = path.join(
  process.cwd(),
  "data",
  "support_programs.json"
);

const KAMS_BASE =
  "https://www.gokams.or.kr/02_apply/";

const KAMS_LIST =
  "https://www.gokams.or.kr/02_apply/introduction.aspx";

const ARKO_BASE =
  "https://www.arko.or.kr/";

const ARKO_LIST =
  "https://www.arko.or.kr/board/list/4013?bid=463&sf_icon_category=cw00000019";

const KCDF_BASE =
  "https://www.kcdf.or.kr/";

const KCDF_LIST =
  "https://www.kcdf.or.kr/brd/board/337/L/menu/284";

const KOCCA_BASE =
  "https://www.kocca.kr/";

const KOCCA_LIST =
  "https://www.kocca.kr/kocca/pims/list.do?menuNo=204104";

const COLLECTOR_VERSION =
  "support_programs_kams_arko_kcdf_kocca_v4.0";


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
  const raw =
    text(value);

  let match =
    raw.match(
      /(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/
    );

  if (!match) {
    match =
      raw.match(
        /(?:^|\D)(\d{2})[-./](\d{1,2})[-./](\d{1,2})(?:\D|$)/
      );

    if (!match) {
      return "";
    }

    return [
      `20${match[1]}`,
      String(match[2]).padStart(
        2,
        "0"
      ),
      String(match[3]).padStart(
        2,
        "0"
      )
    ].join("-");
  }

  return [
    match[1],
    String(match[2]).padStart(
      2,
      "0"
    ),
    String(match[3]).padStart(
      2,
      "0"
    )
  ].join("-");
}


function extractDates(value) {
  const plain =
    stripTags(
      value
    );

  const results =
    [];

  for (
    const match of plain.matchAll(
      /20\d{2}[-./]\d{1,2}[-./]\d{1,2}/g
    )
  ) {
    const date =
      normalizeDate(
        match[0]
      );

    if (date) {
      results.push(
        date
      );
    }
  }

  return results;
}


function extractShortDates(value) {
  const plain =
    stripTags(
      value
    );

  const results =
    [];

  const regex =
    /(?:20\d{2}|\d{2})[-./]\d{1,2}[-./]\d{1,2}/g;

  for (
    const match of plain.matchAll(
      regex
    )
  ) {
    const date =
      normalizeDate(
        match[0]
      );

    if (date) {
      results.push(
        date
      );
    }
  }

  return results;
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


function isExpired(deadline) {
  const normalized =
    normalizeDate(
      deadline
    );

  if (!normalized) {
    return false;
  }

  return (
    normalized <
    getKstToday()
  );
}


function stableId(value) {
  return crypto
    .createHash(
      "sha1"
    )
    .update(
      text(value)
    )
    .digest(
      "hex"
    )
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
      decodeEntities(
        href
      ),
      base
    ).href;
  }

  catch {
    return "";
  }
}


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

  "인터랙티브",

  "공예"
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
  "브랜드",

  "팝업",
  "팝업스토어",
  "팝업 스토어",

  "지역문화",
  "지역 문화",

  "문화예술",
  "문화 예술",

  "기업협력",
  "기업 협력",

  "기업연계",
  "기업 연계",

  "기업 동반성장",

  "협업",
  "콜라보레이션",

  "크라우드펀딩",

  "전통문화",
  "전통 문화",

  "공급기업",
  "공급 기업",

  "수요기업",
  "수요 기업",

  "기술혁신",
  "기술 혁신",

  "디자인개발",
  "디자인 개발",

  "플랫폼 구축",

  "문화상품",
  "문화 상품",

  "제품개발",
  "제품 개발",

  "사업화",
  "창업",

  "프로모션",

  "쇼케이스",

  "파트너사",
  "참가사",

  "제작지원",
  "제작 지원",

  "콘텐츠 제작",

  "문화기술",
  "문화 기술",

  "신기술",

  "인공지능",
  "AI",
  "에이아이"
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

  "우수사례",

  "후보자 추천",
  "후보 추천",

  "공예상",

  "참여작가",
  "참여 작가",

  "참여자 모집",
  "참가자 모집",

  "교육 참여자"
];


const HARD_EXCLUDE_KEYWORDS = [
  "교육생 모집",
  "수강생 모집",

  "채용",

  "선정결과",
  "선정 결과",

  "결과발표",
  "결과 발표",

  "심사결과",
  "심사 결과",

  "후보자 추천",
  "후보 추천",

  "참여작가",
  "참여 작가",

  "참여자 모집",
  "참가자 모집"
];


function analyzeAxooFit(value) {
  const source =
    text(
      value
    )
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


  const hardExcludeMatches =
    HARD_EXCLUDE_KEYWORDS.filter(
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


  if (
    hardExcludeMatches.length
  ) {
    score =
      Math.min(
        score,
        45
      );
  }


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


  if (
    hardExcludeMatches.length
  ) {
    reason +=
      ` ${hardExcludeMatches.join(", ")} 유형은 AXOO 직접 사업 참여 대상에서 제외합니다.`;
  }


  return {
    score,
    grade,

    matchedKeywords,
    negativeMatches,
    hardExcludeMatches,

    reason,

    isExcluded:
      score < 50 ||
      hardExcludeMatches.length > 0
  };
}


/* =========================================================
   KOCCA FIT
========================================================= */

const KOCCA_POSITIVE_KEYWORDS = [
  "인공지능",
  "AI",
  "에이아이",

  "신기술",

  "문화기술",

  "실감콘텐츠",
  "실감 콘텐츠",

  "융복합",
  "융합",

  "XR",
  "VR",
  "AR",

  "메타버스",

  "콘텐츠 제작",

  "제작지원",
  "제작 지원",

  "협력형",

  "수요기업",
  "수요 기업",

  "공급기업",
  "공급 기업",

  "디자인",

  "브랜드",
  "브랜딩",

  "IP",

  "팝업",

  "전시",

  "공간"
];


const KOCCA_GENRE_DOWNRANK_KEYWORDS = [
  "웹툰",
  "만화",

  "게임",

  "애니메이션",

  "방송",

  "영화",

  "음악",

  "공연",

  "출판",

  "e스포츠",
  "이스포츠"
];


const KOCCA_HARD_EXCLUDE_KEYWORDS = [
  "인턴십",

  "교육생",
  "수강생",

  "인재양성",

  "입주기업 모집",
  "신규 입주기업",

  "데브캠프",

  "교육과정",

  "연수생"
];


function analyzeKoccaFit(title) {
  const base =
    analyzeAxooFit(
      title
    );


  const source =
    text(
      title
    )
      .toLowerCase();


  const positiveMatches =
    KOCCA_POSITIVE_KEYWORDS.filter(
      keyword =>
        source.includes(
          keyword.toLowerCase()
        )
    );


  const genreMatches =
    KOCCA_GENRE_DOWNRANK_KEYWORDS.filter(
      keyword =>
        source.includes(
          keyword.toLowerCase()
        )
    );


  const hardMatches =
    KOCCA_HARD_EXCLUDE_KEYWORDS.filter(
      keyword =>
        source.includes(
          keyword.toLowerCase()
        )
    );


  let score =
    base.score;


  score +=
    Math.min(
      positiveMatches.length * 8,
      24
    );


  score -=
    Math.min(
      genreMatches.length * 30,
      60
    );


  if (
    hardMatches.length
  ) {
    score =
      Math.min(
        score,
        45
      );
  }


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
      ...base.matchedKeywords,
      ...positiveMatches
    ])
  ];


  let reason =
    base.reason;


  if (
    positiveMatches.length
  ) {
    reason +=
      ` KOCCA 사업 중 ${positiveMatches
        .slice(0, 4)
        .join(", ")} 요소가 AXOO와 연결됩니다.`;
  }


  if (
    genreMatches.length
  ) {
    reason +=
      ` 다만 ${genreMatches.join(", ")} 장르 중심 사업이라 우선순위를 낮췄습니다.`;
  }


  if (
    hardMatches.length
  ) {
    reason +=
      ` ${hardMatches.join(", ")} 유형은 직접 사업 참여 검토 대상에서 제외합니다.`;
  }


  return {
    ...base,

    score,
    grade,

    matchedKeywords,

    reason,

    isExcluded:
      score < 50 ||
      hardMatches.length > 0 ||
      base.hardExcludeMatches.length > 0
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
        ? "AXOO 시각예술·공간·콘텐츠 사업과의 직접 적합도가 낮거나 직접 참여형 공모가 아님"
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
   KAMS
========================================================= */

function findKamsRows(html) {
  return [
    ...String(
      html
    ).matchAll(
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
      String(
        row ?? ""
      )
    );


  const plain =
    stripTags(
      raw
    );


  return (
    plain.includes(
      "접수중"
    ) ||

    /alt\s*=\s*["'][^"']*접수중[^"']*["']/i
      .test(
        raw
      ) ||

    /title\s*=\s*["'][^"']*접수중[^"']*["']/i
      .test(
        raw
      ) ||

    raw.includes(
      "접수중"
    )
  );
}


function getKamsDetailLink(row) {
  const source =
    decodeEntities(
      String(
        row ?? ""
      )
    );


  for (
    const anchor of getAnchorEntries(
      source
    )
  ) {
    if (
      anchor.href.includes(
        "introduction_view.aspx"
      ) &&
      /Idx=\d+/i.test(
        anchor.href
      )
    ) {
      const url =
        absoluteUrl(
          anchor.href,
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
      String(
        row ?? ""
      )
    );


  for (
    const anchor of getAnchorEntries(
      source
    )
  ) {
    if (
      !anchor.href.includes(
        "introduction_view.aspx"
      )
    ) {
      continue;
    }


    if (
      anchor.plain &&
      anchor.plain !== "보기"
    ) {
      return anchor.plain;
    }
  }


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


  return "";
}


function getKamsId(url) {
  try {
    return (
      new URL(
        url
      )
        .searchParams
        .get(
          "Idx"
        ) ||
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


async function getKamsDetailInfo(detailUrl) {
  try {
    const html =
      await fetchHtml(
        detailUrl
      );


    const raw =
      decodeEntities(
        String(
          html ?? ""
        )
      );


    const plain =
      stripTags(
        raw
      );


    let postedDate =
      "";


    const patterns = [
      /작성일\s*[:：]?\s*(20\d{2}[-.]\d{1,2}[-.]\d{1,2})/i,
      /등록일\s*[:：]?\s*(20\d{2}[-.]\d{1,2}[-.]\d{1,2})/i,
      /게시일\s*[:：]?\s*(20\d{2}[-.]\d{1,2}[-.]\d{1,2})/i,

      /작성일[\s\S]{0,500}?(20\d{2}[-.]\d{1,2}[-.]\d{1,2})/i,
      /등록일[\s\S]{0,500}?(20\d{2}[-.]\d{1,2}[-.]\d{1,2})/i,
      /게시일[\s\S]{0,500}?(20\d{2}[-.]\d{1,2}[-.]\d{1,2})/i
    ];


    for (
      const pattern of patterns
    ) {
      const source =
        pattern.source.includes(
          "[\\s\\S]"
        )
          ? raw
          : plain;


      const match =
        source.match(
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


    const html =
      await fetchHtml(
        url
      );


    const rows =
      findKamsRows(
        html
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
      "KAMS 상세 링크를 찾지 못했습니다."
    );
  }


  if (
    openRowCount === 0
  ) {
    throw new Error(
      "KAMS 접수중 공고를 인식하지 못했습니다."
    );
  }


  if (
    candidates.length === 0
  ) {
    throw new Error(
      "KAMS 제목 추출 결과가 0건입니다."
    );
  }


  const results =
    [];


  for (
    const item of uniqueBy(
      candidates,
      item =>
        item.id ||
        item.detailUrl
    )
  ) {
    const fit =
      analyzeAxooFit(
        item.title
      );


    const detailInfo =
      await getKamsDetailInfo(
        item.detailUrl
      );


    results.push(
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
      })
    );
  }


  if (
    !results.length
  ) {
    throw new Error(
      "KAMS 결과가 0건입니다."
    );
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
   ARKO
========================================================= */

function looksLikeArkoDetailUrl(href) {
  const value =
    text(
      href
    )
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
  for (
    const anchor of getAnchorEntries(
      block
    )
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
    const anchor of getAnchorEntries(
      block
    )
  ) {
    const href =
      text(
        anchor.href
      );


    if (
      !href ||
      href.startsWith(
        "#"
      ) ||
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


  const patterns = [
    /<(?:strong|h2|h3|h4|h5)\b[^>]*>([\s\S]*?)<\/(?:strong|h2|h3|h4|h5)>/gi,

    /<(?:p|div|span)\b[^>]*class\s*=\s*["'][^"']*(?:tit|title|subject)[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div|span)>/gi
  ];


  for (
    const pattern of patterns
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
        ) &&
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
        (a, b) =>
          b.length -
          a.length
      )[0];
  }


  return "";
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


    const windowHtml =
      source.slice(
        Math.max(
          0,
          index - 1800
        ),
        Math.min(
          source.length,
          index + 3200
        )
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


    for (
      const key of [
        "cid",
        "seq",
        "idx",
        "id",
        "contentId",
        "bbsId",
        "docid"
      ]
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

  let detailLinks =
    0;


  for (
    let page = 1;
    page <= 2;
    page += 1
  ) {
    const html =
      await fetchHtml(
        `${ARKO_LIST}&page=${page}`
      );


    const blocks =
      findArkoBlocks(
        html
      );


    totalBlocks +=
      blocks.length;


    for (
      const block of blocks
    ) {
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


      if (
        isExpired(
          deadline
        )
      ) {
        continue;
      }


      candidates.push({
        id:
          getArkoId(
            detailUrl,
            title
          ),

        title,

        summary:
          getArkoSummary(
            block,
            title
          ),

        detailUrl,

        startDate,

        deadline
      });
    }
  }


  console.log(
    "진행중 후보 block:",
    totalBlocks
  );


  console.log(
    "상세 링크:",
    detailLinks
  );


  console.log(
    "유효 후보:",
    candidates.length
  );


  if (
    totalBlocks > 0 &&
    detailLinks === 0
  ) {
    throw new Error(
      "ARKO 상세 링크를 추출하지 못했습니다."
    );
  }


  const results =
    uniqueBy(
      candidates,
      item =>
        item.detailUrl ||
        `${item.title}|${item.deadline}`
    )
      .map(
        item => {
          const fit =
            analyzeAxooFit(
              [
                item.title,
                item.summary
              ]
                .filter(Boolean)
                .join(" ")
            );


          return makeSupportRecord({
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
        }
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
   KCDF
========================================================= */

function findKcdfRows(html) {
  const source =
    String(
      html ?? ""
    );


  const trRows = [
    ...source.matchAll(
      /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
    )
  ].map(
    match =>
      match[0]
  );


  const relevant =
    trRows.filter(
      row =>
        /bbIdx=\d+/i.test(
          decodeEntities(
            row
          )
        )
    );


  if (
    relevant.length
  ) {
    return relevant;
  }


  return [
    ...source.matchAll(
      /<li\b[^>]*>([\s\S]*?)<\/li>/gi
    )
  ]
    .map(
      match =>
        match[0]
    )
    .filter(
      row =>
        /bbIdx=\d+/i.test(
          decodeEntities(
            row
          )
        )
    );
}


function isKcdfOpenRow(row) {
  const raw =
    decodeEntities(
      String(
        row ?? ""
      )
    );


  const plain =
    stripTags(
      raw
    );


  return (
    plain.includes(
      "접수중"
    ) ||

    /alt\s*=\s*["'][^"']*접수중[^"']*["']/i
      .test(
        raw
      ) ||

    /title\s*=\s*["'][^"']*접수중[^"']*["']/i
      .test(
        raw
      )
  );
}


function getKcdfDetailLink(row) {
  const source =
    decodeEntities(
      String(
        row ?? ""
      )
    );


  for (
    const anchor of getAnchorEntries(
      source
    )
  ) {
    if (
      /bbIdx=\d+/i.test(
        anchor.href
      )
    ) {
      const url =
        absoluteUrl(
          anchor.href,
          KCDF_BASE
        );


      if (url) {
        return url;
      }
    }
  }


  return "";
}


function getKcdfTitle(row) {
  for (
    const anchor of getAnchorEntries(
      row
    )
  ) {
    if (
      !/bbIdx=\d+/i.test(
        anchor.href
      )
    ) {
      continue;
    }


    const candidate =
      anchor.plain
        .replace(
          /^접수중\s*/i,
          ""
        )
        .replace(
          /^접수예정\s*/i,
          ""
        )
        .trim();


    if (
      candidate.length >= 5 &&
      !candidate.includes(
        "바로보기"
      ) &&
      !candidate.includes(
        "다운로드"
      )
    ) {
      return candidate;
    }
  }


  return "";
}


function getKcdfId(detailUrl) {
  try {
    return (
      new URL(
        detailUrl
      )
        .searchParams
        .get(
          "bbIdx"
        ) ||
      ""
    );
  }

  catch {
    return "";
  }
}


async function getKcdfDetailInfo(detailUrl) {
  try {
    const html =
      await fetchHtml(
        detailUrl
      );


    const plain =
      stripTags(
        html
      );


    const periodMatch =
      plain.match(
        /공모기간\s*[:：]?\s*(20\d{2}[-./]\d{1,2}[-./]\d{1,2})\s*[~∼-]\s*(20\d{2}[-./]\d{1,2}[-./]\d{1,2})/i
      );


    let documentUrl =
      "";


    for (
      const anchor of getAnchorEntries(
        html
      )
    ) {
      const label =
        text(
          anchor.plain
        )
          .toLowerCase();


      if (
        (
          label.includes(
            "공고문"
          ) ||
          label.includes(
            "pdf"
          )
        ) &&
        anchor.href
      ) {
        documentUrl =
          absoluteUrl(
            anchor.href,
            KCDF_BASE
          );


        if (
          documentUrl
        ) {
          break;
        }
      }
    }


    return {
      startDate:
        periodMatch
          ? normalizeDate(
              periodMatch[1]
            )
          : "",

      deadline:
        periodMatch
          ? normalizeDate(
              periodMatch[2]
            )
          : "",

      documentUrl
    };
  }

  catch (error) {
    console.warn(
      "⚠️ KCDF detail fetch failed:",
      detailUrl,
      error.message
    );


    return {
      startDate:
        "",

      deadline:
        "",

      documentUrl:
        ""
    };
  }
}


async function collectKcdf() {
  console.log("");
  console.log(
    "===================================="
  );
  console.log(
    "KCDF SUPPORT PROGRAM COLLECTOR"
  );
  console.log(
    "===================================="
  );


  const candidates =
    [];


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
      `${KCDF_LIST}` +
      `?brdCodeValue=` +
      `&brdType=L` +
      `&searchField=titlecontent` +
      `&thisPage=${page}`;


    const html =
      await fetchHtml(
        url
      );


    const rows =
      findKcdfRows(
        html
      );


    for (
      const row of rows
    ) {
      const detailUrl =
        getKcdfDetailLink(
          row
        );


      if (!detailUrl) {
        continue;
      }


      detailLinkCount +=
        1;


      if (
        !isKcdfOpenRow(
          row
        )
      ) {
        continue;
      }


      openRowCount +=
        1;


      const title =
        getKcdfTitle(
          row
        );


      if (!title) {
        continue;
      }


      const dates =
        extractDates(
          row
        );


      const startDate =
        dates[0] ||
        "";


      const deadline =
        dates.length >= 2
          ? dates[1]
          : dates[0] ||
            "";


      if (
        isExpired(
          deadline
        )
      ) {
        continue;
      }


      candidates.push({
        id:
          getKcdfId(
            detailUrl
          ) ||
          stableId(
            detailUrl
          ),

        title,

        detailUrl,

        startDate,

        deadline
      });
    }
  }


  console.log(
    "상세 링크:",
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
      "KCDF 상세 링크를 찾지 못했습니다."
    );
  }


  const results =
    [];


  for (
    const item of uniqueBy(
      candidates,
      item =>
        item.id ||
        item.detailUrl
    )
  ) {
    const detail =
      await getKcdfDetailInfo(
        item.detailUrl
      );


    const startDate =
      detail.startDate ||
      item.startDate;


    const deadline =
      detail.deadline ||
      item.deadline;


    if (
      isExpired(
        deadline
      )
    ) {
      continue;
    }


    const fit =
      analyzeAxooFit(
        item.title
      );


    results.push(
      makeSupportRecord({
        id:
          `kcdf-${item.id}`,

        source:
          "한국공예·디자인문화진흥원",

        sourceCode:
          "KCDF",

        title:
          item.title,

        startDate,

        deadline,

        publishedDate:
          startDate,

        sourceUrl:
          item.detailUrl,

        documentUrl:
          detail.documentUrl,

        fit
      })
    );
  }


  console.log(
    `KCDF 접수중 공모: ${results.length}건`
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
   KOCCA
========================================================= */

function findKoccaRows(html) {
  return [
    ...String(
      html ?? ""
    ).matchAll(
      /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
    )
  ]
    .map(
      match =>
        match[0]
    )
    .filter(
      row =>
        /pims\/view\.do/i.test(
          row
        ) &&
        /intcNo=/i.test(
          row
        )
    );
}


function getKoccaDetailLink(row) {
  for (
    const anchor of getAnchorEntries(
      row
    )
  ) {
    if (
      /pims\/view\.do/i.test(
        anchor.href
      ) &&
      /intcNo=/i.test(
        anchor.href
      )
    ) {
      return absoluteUrl(
        anchor.href,
        KOCCA_BASE
      );
    }
  }


  return "";
}


function getKoccaTitle(row) {
  for (
    const anchor of getAnchorEntries(
      row
    )
  ) {
    if (
      !/pims\/view\.do/i.test(
        anchor.href
      ) ||
      !/intcNo=/i.test(
        anchor.href
      )
    ) {
      continue;
    }


    const candidate =
      anchor.plain
        .replace(
          /^NEW\s*/i,
          ""
        )
        .trim();


    if (
      candidate.length >= 5
    ) {
      return candidate;
    }
  }


  return "";
}


function getKoccaId(detailUrl) {
  try {
    return (
      new URL(
        detailUrl
      )
        .searchParams
        .get(
          "intcNo"
        ) ||
      ""
    );
  }

  catch {
    return "";
  }
}


function getKoccaDates(row) {
  const dates =
    extractShortDates(
      row
    );


  if (
    !dates.length
  ) {
    return {
      postedDate:
        "",

      startDate:
        "",

      deadline:
        ""
    };
  }


  if (
    dates.length >= 3
  ) {
    return {
      postedDate:
        dates[0],

      startDate:
        dates[
          dates.length - 2
        ],

      deadline:
        dates[
          dates.length - 1
        ]
    };
  }


  if (
    dates.length === 2
  ) {
    return {
      postedDate:
        dates[0],

      startDate:
        dates[0],

      deadline:
        dates[1]
    };
  }


  return {
    postedDate:
      dates[0],

    startDate:
      dates[0],

    deadline:
      dates[0]
  };
}


async function collectKocca() {
  console.log("");
  console.log(
    "===================================="
  );
  console.log(
    "KOCCA SUPPORT PROGRAM COLLECTOR"
  );
  console.log(
    "===================================="
  );


  const candidates =
    [];


  let totalRows =
    0;

  let detailLinks =
    0;


  /*
    KOCCA 현재 지원공고는
    페이지당 여러 건으로 구성되므로
    최근 4페이지 검사.
  */

  for (
    let page = 1;
    page <= 4;
    page += 1
  ) {
    const url =
      `${KOCCA_LIST}&pageIndex=${page}`;


    console.log(
      `KOCCA page ${page} fetch`
    );


    const html =
      await fetchHtml(
        url
      );


    if (
      !html.includes(
        "지원공고"
      ) &&
      !html.includes(
        "접수기간"
      )
    ) {
      throw new Error(
        "KOCCA 지원공고 목록 페이지를 정상적으로 읽지 못했습니다."
      );
    }


    const rows =
      findKoccaRows(
        html
      );


    totalRows +=
      rows.length;


    for (
      const row of rows
    ) {
      const detailUrl =
        getKoccaDetailLink(
          row
        );


      if (!detailUrl) {
        continue;
      }


      detailLinks +=
        1;


      const title =
        getKoccaTitle(
          row
        );


      if (!title) {
        continue;
      }


      const dates =
        getKoccaDates(
          row
        );


      /*
        KOCCA 목록에는
        종료된 공고가 섞여 들어올 가능성에 대비.
      */

      if (
        isExpired(
          dates.deadline
        )
      ) {
        continue;
      }


      candidates.push({
        id:
          getKoccaId(
            detailUrl
          ) ||
          stableId(
            detailUrl
          ),

        title,

        detailUrl,

        ...dates
      });
    }
  }


  console.log(
    "전체 KOCCA row:",
    totalRows
  );


  console.log(
    "상세 링크:",
    detailLinks
  );


  console.log(
    "진행중 후보:",
    candidates.length
  );


  if (
    detailLinks === 0
  ) {
    throw new Error(
      "KOCCA 지원공고 상세 링크를 하나도 찾지 못했습니다. HTML 구조를 확인해야 합니다."
    );
  }


  const results =
    [];


  for (
    const item of uniqueBy(
      candidates,
      item =>
        item.id ||
        item.detailUrl
    )
  ) {
    const fit =
      analyzeKoccaFit(
        item.title
      );


    const result =
      makeSupportRecord({
        id:
          `kocca-${item.id}`,

        source:
          "한국콘텐츠진흥원",

        sourceCode:
          "KOCCA",

        title:
          item.title,

        startDate:
          item.startDate,

        deadline:
          item.deadline,

        postedDate:
          item.postedDate,

        publishedDate:
          item.postedDate,

        sourceUrl:
          item.detailUrl,

        fit
      });


    results.push(
      result
    );


    console.log(
      `→ ${result.grade} / ${result.score}점 / ${
        result.isExcludedFromPriority
          ? "제외"
          : "노출"
      } / ${result.title}`
    );
  }


  console.log(
    `KOCCA 진행중 공모: ${results.length}건`
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


  const replacedSourceCodes = [
    "KAMS",
    "ARKO",
    "KCDF",
    "KOCCA"
  ];


  const preserved =
    existing.filter(
      item =>
        !replacedSourceCodes.includes(
          text(
            item.sourceCode
          )
            .toUpperCase()
        )
    );


  const kams =
    await collectKams();


  const arko =
    await collectArko();


  const kcdf =
    await collectKcdf();


  const kocca =
    await collectKocca();


  const output = [
    ...preserved,
    ...kams,
    ...arko,
    ...kcdf,
    ...kocca
  ];


  if (
    !output.length
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
    `KCDF ${kcdf.length}건`
  );


  console.log(
    `KOCCA ${kocca.length}건`
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
    "✅ KAMS + ARKO + KCDF + KOCCA v4.0 수집 완료"
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

    process.exit(
      1
    );
  }
);
