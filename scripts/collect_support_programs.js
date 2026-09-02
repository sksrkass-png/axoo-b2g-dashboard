const fs = require("fs");
const path = require("path");

const OUTPUT_FILE = path.join(
  process.cwd(),
  "data",
  "support_programs.json"
);

const KAMS_BASE = "https://www.gokams.or.kr/02_apply/";

const KAMS_LIST =
  "https://www.gokams.or.kr/02_apply/introduction.aspx";

const COLLECTOR_VERSION =
  "support_programs_kams_v1.1";


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

  const match =
    raw.match(
      /(20\d{2})[-.](\d{1,2})[-.](\d{1,2})/
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

  "협업",
  "콜라보레이션"
];


const NEGATIVE_KEYWORDS = [
  "연극",
  "뮤지컬",
  "무용",
  "국악",

  "음악",
  "오페라",

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
  "심사 결과"
];


function analyzeAxooFit(title) {
  const source =
    text(title)
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


  let score = 45;

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
    grade = "S";
  }

  else if (
    score >= 70
  ) {
    grade = "A";
  }

  else if (
    score >= 50
  ) {
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


/*
  핵심 수정:
  stripTags() 전에 원본 row 자체에서
  접수중 문구 / alt / title 속성을 검사.
*/
function isKamsOpenRow(row) {
  const raw =
    decodeEntities(
      String(row ?? "")
    );

  const plain =
    stripTags(raw);


  if (
    plain.includes(
      "접수중"
    )
  ) {
    return true;
  }


  if (
    /alt\s*=\s*["'][^"']*접수중[^"']*["']/i
      .test(raw)
  ) {
    return true;
  }


  if (
    /title\s*=\s*["'][^"']*접수중[^"']*["']/i
      .test(raw)
  ) {
    return true;
  }


  if (
    raw.includes(
      "접수중"
    )
  ) {
    return true;
  }


  return false;
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
      !href.includes(
        "introduction_view.aspx"
      )
    ) {
      continue;
    }

    if (
      !/Idx=\d+/i.test(
        href
      )
    ) {
      continue;
    }


    try {
      return new URL(
        href,
        KAMS_BASE
      ).href;
    }

    catch {
      continue;
    }
  }


  /*
    Anchor regex가 실패할 경우 fallback
  */

  const fallback =
    source.match(
      /href\s*=\s*["']([^"']*introduction_view\.aspx[^"']*Idx=\d+[^"']*)["']/i
    );

  if (!fallback) {
    return "";
  }


  try {
    return new URL(
      decodeEntities(
        fallback[1]
      ),
      KAMS_BASE
    ).href;
  }

  catch {
    return "";
  }
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


  /*
    href 기준 fallback
  */

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
  const raw =
    decodeEntities(
      String(row ?? "")
    );

  const plain =
    stripTags(raw);


  const matches = [
    ...plain.matchAll(
      /(20\d{2}[-.]\d{1,2}[-.]\d{1,2})(?:\s+\d{1,2}:\d{2})?/g
    )
  ];


  if (
    !matches.length
  ) {
    return "";
  }


  /*
    목록에서 날짜가 여러 개 나올 경우
    마지막 날짜를 마감일 후보로 사용.
  */

  return normalizeDate(
    matches[
      matches.length - 1
    ][1]
  );
}


/* =========================================================
   KAMS DETAIL
========================================================= */

async function getKamsDetailInfo(
  detailUrl
) {
  try {
    const html =
      await fetchHtml(
        detailUrl
      );

    const plain =
      stripTags(html);


    let postedDate =
      "";


    const postedPatterns = [
      /작성일\s*[:：]?\s*(20\d{2}[-.]\d{1,2}[-.]\d{1,2})/i,

      /등록일\s*[:：]?\s*(20\d{2}[-.]\d{1,2}[-.]\d{1,2})/i,

      /게시일\s*[:：]?\s*(20\d{2}[-.]\d{1,2}[-.]\d{1,2})/i
    ];


    for (
      const pattern of postedPatterns
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


  const candidates = [];

  let totalRows =
    0;

  let detailLinkCount =
    0;

  let openRowCount =
    0;


  /*
    최근 3페이지 검사
  */

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


      const id =
        getKamsId(
          detailUrl
        );


      const deadline =
        getKamsDeadline(
          row
        );


      candidates.push({
        id,
        title,
        detailUrl,
        deadline
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


  /*
    사이트 구조 변경 감지
  */

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


  const uniqueCandidates = [
    ...new Map(
      candidates.map(
        item => [
          item.id ||
          item.detailUrl,

          item
        ]
      )
    ).values()
  ];


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


    const result = {
      id:
        `kams-${item.id}`,


      category:
        "arts_content_support",

      categoryLabel:
        "예술·콘텐츠 지원사업",


      priorityCategory:
        "arts_content_support",

      priorityCategoryLabel:
        "예술·콘텐츠 지원사업",


      source:
        "예술경영지원센터",

      sourceCode:
        "KAMS",

      sourceType:
        "지원사업",


      title:
        item.title,


      organization:
        "예술경영지원센터",

      agency:
        "예술경영지원센터",


      status:
        "진행중",


      postedDate:
        detailInfo.postedDate,

      publishedDate:
        detailInfo.postedDate,


      startDate:
        "",


      endDate:
        item.deadline,

      deadline:
        item.deadline,


      budget:
        null,

      supportAmount:
        null,


      originalUrl:
        item.detailUrl,

      sourceUrl:
        item.detailUrl,

      documentUrl:
        "",


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
    };


    results.push(
      result
    );


    console.log(
      `  ${result.grade} / ${result.score}점 / ${result.deadline || "마감일 미확인"}`
    );
  }


  /*
    가장 중요한 안전장치:
    0건인데 성공 처리하는 상황 방지
  */

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
    향후 추가될
    ARKO / KOCCA / KCDF 데이터는 유지.
    KAMS만 이번 결과로 교체.
  */

  const preserved =
    existing.filter(
      item =>
        item.sourceCode !==
        "KAMS"
    );


  const kams =
    await collectKams();


  const output = [
    ...preserved,
    ...kams
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
    `기타 기관 보존 ${preserved.length}건`
  );

  console.log(
    "✅ KAMS 수집 완료"
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
