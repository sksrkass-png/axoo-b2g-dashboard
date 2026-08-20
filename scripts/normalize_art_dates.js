const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(
  process.cwd(),
  "data",
  "art_commissions.json"
);

const NORMALIZER_VERSION = "1.1.0";


const PERIOD_KEYWORDS = [
  "응모작품 접수일시",
  "작품 접수일시",
  "접수일시",
  "접수기간",
  "공모기간",
  "응모기간",
  "신청기간",
  "제출기간",
  "작품 접수",
  "접수일"
];


const DEADLINE_KEYWORDS = [
  "접수마감",
  "제출마감",
  "신청마감",
  "응모마감",
  "마감일",
  "마감기한",
  "제출기한",
  "접수기한"
];


const PUBLISHED_KEYWORDS = [
  "등록일",
  "등록일자",
  "작성일",
  "게시일",
  "공고일"
];


/* =========================================================
   BASIC
========================================================= */

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\t\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function toISO(
  year,
  month,
  day
) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);

  if (
    !Number.isInteger(y) ||
    !Number.isInteger(m) ||
    !Number.isInteger(d)
  ) {
    return "";
  }

  if (
    y < 2000 ||
    y > 2100 ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31
  ) {
    return "";
  }

  const date =
    new Date(
      Date.UTC(
        y,
        m - 1,
        d
      )
    );

  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return "";
  }

  return [
    String(y).padStart(4, "0"),
    String(m).padStart(2, "0"),
    String(d).padStart(2, "0")
  ].join("-");
}


function parseExistingDate(value) {
  const text =
    cleanText(value);

  if (!text) {
    return "";
  }

  const match =
    text.match(
      /(20\d{2})\s*(?:년|[.\-/])\s*(\d{1,2})\s*(?:월|[.\-/])\s*(\d{1,2})/
    );

  if (!match) {
    return "";
  }

  return toISO(
    match[1],
    match[2],
    match[3]
  );
}


function yearFromDate(value) {
  const parsed =
    parseExistingDate(value);

  if (parsed) {
    return Number(
      parsed.slice(0, 4)
    );
  }

  return getKoreaTodayYear();
}


function getKoreaToday() {
  const korea =
    new Date(
      Date.now() +
      9 * 60 * 60 * 1000
    );

  return korea
    .toISOString()
    .slice(0, 10);
}


function getKoreaTodayYear() {
  return Number(
    getKoreaToday()
      .slice(0, 4)
  );
}


/* =========================================================
   DATE FINDER
========================================================= */

function findFirstDate(
  text,
  baseYear
) {
  const source =
    cleanText(text);

  const candidates = [];


  /*
    2026년 8월 10일
    2026. 8. 10.
    2026-08-10
  */
  const fullRegex =
    /(20\d{2})\s*(?:년|[.\-/])\s*(\d{1,2})\s*(?:월|[.\-/])\s*(\d{1,2})\s*일?/g;

  let match;

  while (
    (
      match =
        fullRegex.exec(source)
    ) !== null
  ) {
    const value =
      toISO(
        match[1],
        match[2],
        match[3]
      );

    if (value) {
      candidates.push({
        index: match.index,
        end: fullRegex.lastIndex,
        value: value,
        explicitYear: true
      });
    }
  }


  /*
    8월 29일
  */
  const koreanPartialRegex =
    /(\d{1,2})\s*월\s*(\d{1,2})\s*일?/g;

  while (
    (
      match =
        koreanPartialRegex.exec(
          source
        )
    ) !== null
  ) {
    /*
      이미 2026년 8월 29일 안에
      포함된 부분 날짜인지 검사.
    */
    const insideFull =
      candidates.some(
        function (candidate) {
          return (
            match.index >=
              candidate.index &&
            match.index <
              candidate.end
          );
        }
      );

    if (insideFull) {
      continue;
    }

    const value =
      toISO(
        baseYear,
        match[1],
        match[2]
      );

    if (value) {
      candidates.push({
        index:
          match.index,

        end:
          koreanPartialRegex
            .lastIndex,

        value:
          value,

        explicitYear:
          false
      });
    }
  }


  candidates.sort(
    function (a, b) {
      return (
        a.index -
        b.index
      );
    }
  );

  return (
    candidates[0] ||
    null
  );
}


/* =========================================================
   RANGE PARSER
========================================================= */

function extractDateRange(
  segment,
  baseYear
) {
  const text =
    cleanText(segment);


  /*
    CASE 1

    2026년 8월 10일 ~ 8월 29일
    2026.08.10 ~ 08.29
    2026-08-10 ~ 2026-08-29

    핵심:
    날짜와 날짜 사이에 실제 "~"가 있을 때만
    공모기간으로 인정한다.

    10:00 ~ 17:00은 날짜 범위가 아니다.
  */
  let match =
    text.match(
      /(20\d{2})\s*(?:년|[.\-/])\s*(\d{1,2})\s*(?:월|[.\-/])\s*(\d{1,2})\s*일?\s*(?:\([^)]*\))?\s*[~∼～–—-]\s*(?:(20\d{2})\s*(?:년|[.\-/])\s*)?(\d{1,2})\s*(?:월|[.\-/])\s*(\d{1,2})\s*일?/
    );

  if (match) {
    const startYear =
      Number(match[1]);

    const endHasYear =
      Boolean(match[4]);

    let endYear =
      endHasYear
        ? Number(match[4])
        : startYear;

    const start =
      toISO(
        startYear,
        match[2],
        match[3]
      );

    let end =
      toISO(
        endYear,
        match[5],
        match[6]
      );

    /*
      2026.12.20 ~ 01.10
      같은 연도 생략 처리.
    */
    if (
      start &&
      end &&
      !endHasYear &&
      end < start
    ) {
      endYear += 1;

      end =
        toISO(
          endYear,
          match[5],
          match[6]
        );
    }

    if (
      start &&
      end
    ) {
      return {
        start: start,
        end: end,
        type: "date_range"
      };
    }
  }


  /*
    CASE 2

    8월 10일 ~ 8월 29일
  */
  match =
    text.match(
      /(\d{1,2})\s*월\s*(\d{1,2})\s*일?\s*(?:\([^)]*\))?\s*[~∼～–—-]\s*(?:(20\d{2})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일?/
    );

  if (match) {
    const startYear =
      baseYear;

    const endHasYear =
      Boolean(match[3]);

    let endYear =
      endHasYear
        ? Number(match[3])
        : startYear;

    const start =
      toISO(
        startYear,
        match[1],
        match[2]
      );

    let end =
      toISO(
        endYear,
        match[4],
        match[5]
      );

    if (
      start &&
      end &&
      !endHasYear &&
      end < start
    ) {
      endYear += 1;

      end =
        toISO(
          endYear,
          match[4],
          match[5]
        );
    }

    if (
      start &&
      end
    ) {
      return {
        start: start,
        end: end,
        type: "date_range"
      };
    }
  }


  return null;
}


/* =========================================================
   PUBLISHED DATE
========================================================= */

function extractPublishedDate(
  detailText,
  existingDates
) {
  const text =
    cleanText(detailText);

  /*
    상세페이지 등록일 최우선.
  */
  for (
    const keyword of
    PUBLISHED_KEYWORDS
  ) {
    const index =
      text.indexOf(keyword);

    if (index === -1) {
      continue;
    }

    const segment =
      text.slice(
        index,
        index + 120
      );

    const date =
      findFirstDate(
        segment,
        getKoreaTodayYear()
      );

    if (date) {
      return {
        value:
          date.value,

        source:
          "detail_metadata"
      };
    }
  }


  /*
    상세 페이지에서 못 찾았으면
    기존 공식 값 보존.
  */
  for (
    const candidate of
    existingDates
  ) {
    const value =
      parseExistingDate(
        candidate
      );

    if (value) {
      return {
        value:
          value,

        source:
          "existing"
      };
    }
  }


  return {
    value: "",
    source: "not_found"
  };
}


/* =========================================================
   PERIOD
========================================================= */

function extractPeriod(
  detailText,
  publishedDate
) {
  const text =
    cleanText(detailText);

  const baseYear =
    yearFromDate(
      publishedDate
    );


  for (
    const keyword of
    PERIOD_KEYWORDS
  ) {
    const index =
      text.indexOf(keyword);

    if (index === -1) {
      continue;
    }


    /*
      중요:
      이전에는 너무 긴 텍스트를 잡아서
      다음 항목의 날짜나 rawText 날짜를
      공모 종료일로 잘못 인식할 수 있었다.

      이제 해당 키워드 뒤 220자 안에서
      "날짜 ~ 날짜" 형태를 먼저 검사한다.
    */
    const segment =
      text.slice(
        index,
        index + 220
      );


    const range =
      extractDateRange(
        segment,
        baseYear
      );

    if (range) {
      return {
        start:
          range.start,

        end:
          range.end,

        source:
          "detail_body",

        keyword:
          keyword
      };
    }


    /*
      하루 접수 공고

      2026. 8. 24.(월)
      10:00 ~ 17:00

      "~"가 시간 사이에 있기 때문에
      날짜 범위로 보면 안 된다.
    */
    const firstDate =
      findFirstDate(
        segment,
        baseYear
      );

    if (firstDate) {
      const afterDate =
        segment.slice(
          firstDate.end,
          firstDate.end + 100
        );

      const hasTimeRange =
        /\d{1,2}\s*:\s*\d{2}\s*[~∼～–—-]\s*\d{1,2}\s*:\s*\d{2}/
          .test(
            afterDate
          );

      if (hasTimeRange) {
        return {
          start:
            firstDate.value,

          end:
            firstDate.value,

          source:
            "detail_body",

          keyword:
            keyword
        };
      }
    }
  }


  return {
    start: "",
    end: "",
    source: "not_found",
    keyword: ""
  };
}


/* =========================================================
   EXPLICIT DEADLINE
========================================================= */

function extractExplicitDeadline(
  detailText,
  publishedDate
) {
  const text =
    cleanText(detailText);

  const baseYear =
    yearFromDate(
      publishedDate
    );


  for (
    const keyword of
    DEADLINE_KEYWORDS
  ) {
    const index =
      text.indexOf(
        keyword
      );

    if (index === -1) {
      continue;
    }

    const segment =
      text.slice(
        index,
        index + 160
      );

    const date =
      findFirstDate(
        segment,
        baseYear
      );

    if (date) {
      return {
        value:
          date.value,

        source:
          "explicit_deadline",

        keyword:
          keyword
      };
    }
  }


  return {
    value: "",
    source: "not_found",
    keyword: ""
  };
}


/* =========================================================
   STATUS
========================================================= */

function getDeadlineState(
  deadline
) {
  if (!deadline) {
    return {
      isExpired:
        false,

      deadlineStatus:
        "마감일 확인 필요"
    };
  }

  const today =
    getKoreaToday();

  const expired =
    deadline < today;

  return {
    isExpired:
      expired,

    deadlineStatus:
      expired
        ? "마감"
        : "진행중"
  };
}


/* =========================================================
   NORMALIZE ONE ITEM
========================================================= */

function normalizeItem(item) {
  /*
    날짜 판독은 detailTextSample을
    가장 신뢰한다.

    중요:
    detailTextSample 뒤에 rawText를 붙이지 않는다.
    서로 다른 영역의 날짜가 섞이는 것을 방지.
  */
  const detailText =
    cleanText(
      item.detailTextSample
    );


  const fallbackText =
    cleanText(
      [
        item.rawText,
        item.summary,
        item.nextAction,
        item.title
      ]
        .filter(Boolean)
        .join(" | ")
    );


  const extractionText =
    detailText ||
    fallbackText;


  const published =
    extractPublishedDate(
      extractionText,
      [
        item.postedDate,
        item.publishedDate,
        item.noticeDate,
        item.createdDate
      ]
    );


  const period =
    extractPeriod(
      extractionText,
      published.value
    );


  const explicitDeadline =
    extractExplicitDeadline(
      extractionText,
      published.value
    );


  const existingPeriodStart =
    parseExistingDate(
      item.periodStart
    );


  const existingPeriodEnd =
    parseExistingDate(
      item.periodEnd
    );


  const existingDeadline =
    parseExistingDate(
      item.deadline ||
      item.endDate ||
      item.closeDate
    );


  /*
    상세페이지에서 새로 판독한 값이
    기존 자동값보다 우선.
  */
  const periodStart =
    period.start ||
    existingPeriodStart ||
    "";


  const periodEnd =
    period.end ||
    existingPeriodEnd ||
    "";


  /*
    마감일 신뢰 우선순위

    1. "접수마감 / 제출기한" 등
       명시된 마감일

    2. 상세페이지에서 읽은
       접수/공모기간 종료일

    3. 기존 데이터의 마감일
  */
  const deadline =
    explicitDeadline.value ||
    period.end ||
    existingDeadline ||
    periodEnd ||
    "";


  let deadlineSource =
    "not_found";


  if (
    explicitDeadline.value
  ) {
    deadlineSource =
      "explicit_deadline";

  } else if (
    period.end
  ) {
    deadlineSource =
      "period_end";

  } else if (
    existingDeadline
  ) {
    deadlineSource =
      (
        item.deadlineSource &&
        item.deadlineSource !==
          "not_found"
      )
        ? item.deadlineSource
        : "existing_deadline";

  } else if (
    existingPeriodEnd
  ) {
    deadlineSource =
      "existing_period_end";
  }


  let confidence =
    "LOW";


  if (
    published.value &&
    deadline &&
    (
      deadlineSource ===
        "explicit_deadline" ||
      deadlineSource ===
        "period_end"
    )
  ) {
    confidence =
      "HIGH";

  } else if (
    deadline
  ) {
    confidence =
      "MEDIUM";
  }


  const deadlineState =
    getDeadlineState(
      deadline
    );


  /*
    기존 상태가
    "마감일 확인 필요"인데
    날짜 보정에 성공했다면
    상태도 현실에 맞게 정리.
  */
  let normalizedStatus =
    item.status ||
    "";


  if (
    deadline &&
    normalizedStatus.includes(
      "마감일 확인 필요"
    )
  ) {
    normalizedStatus =
      deadlineState.isExpired
        ? "마감"
        : "공모중";
  }


  return {
    ...item,

    status:
      normalizedStatus,

    publishedDate:
      published.value ||
      "",

    postedDate:
      published.value ||
      item.postedDate ||
      "",

    periodStart:
      periodStart,

    periodEnd:
      periodEnd,

    deadline:
      deadline,

    endDate:
      deadline,

    publishedDateSource:
      published.source,

    periodSource:
      period.start
        ? period.source
        : (
            item.periodSource ||
            "not_found"
          ),

    periodKeyword:
      period.keyword ||
      "",

    deadlineSource:
      deadlineSource,

    deadlineKeyword:
      explicitDeadline.keyword ||
      "",

    dateConfidence:
      confidence,

    dateNormalizationVersion:
      NORMALIZER_VERSION,

    dateNormalizedAt:
      getKoreaToday(),

    deadlineStatus:
      deadlineState.deadlineStatus,

    isExpired:
      deadlineState.isExpired
  };
}


/* =========================================================
   JSON STRUCTURE
========================================================= */

function getItems(data) {
  if (
    Array.isArray(data)
  ) {
    return data;
  }

  if (
    data &&
    Array.isArray(
      data.projects
    )
  ) {
    return data.projects;
  }

  if (
    data &&
    Array.isArray(
      data.items
    )
  ) {
    return data.items;
  }

  if (
    data &&
    Array.isArray(
      data.data
    )
  ) {
    return data.data;
  }

  throw new Error(
    "art_commissions.json 형식을 확인할 수 없습니다."
  );
}


function replaceItems(
  original,
  items
) {
  if (
    Array.isArray(
      original
    )
  ) {
    return items;
  }

  if (
    original &&
    Array.isArray(
      original.projects
    )
  ) {
    return {
      ...original,
      projects:
        items
    };
  }

  if (
    original &&
    Array.isArray(
      original.items
    )
  ) {
    return {
      ...original,
      items:
        items
    };
  }

  if (
    original &&
    Array.isArray(
      original.data
    )
  ) {
    return {
      ...original,
      data:
        items
    };
  }

  return items;
}


/* =========================================================
   RUN
========================================================= */

function main() {
  if (
    !fs.existsSync(
      DATA_FILE
    )
  ) {
    throw new Error(
      "data/art_commissions.json 파일을 찾을 수 없습니다."
    );
  }


  const original =
    JSON.parse(
      fs.readFileSync(
        DATA_FILE,
        "utf8"
      )
    );


  const items =
    getItems(
      original
    );


  const normalized =
    items.map(
      normalizeItem
    );


  const output =
    replaceItems(
      original,
      normalized
    );


  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(
      output,
      null,
      2
    ) + "\n",
    "utf8"
  );


  const summary = {
    HIGH:
      0,

    MEDIUM:
      0,

    LOW:
      0
  };


  normalized.forEach(
    function (item) {
      const key =
        item.dateConfidence ||
        "LOW";

      if (
        summary[key] !==
        undefined
      ) {
        summary[key] += 1;
      }
    }
  );


  console.log(
    "===================================="
  );

  console.log(
    "AXOO ART DATE NORMALIZER v" +
    NORMALIZER_VERSION
  );

  console.log(
    "전체:",
    normalized.length
  );

  console.log(
    "HIGH:",
    summary.HIGH
  );

  console.log(
    "MEDIUM:",
    summary.MEDIUM
  );

  console.log(
    "LOW:",
    summary.LOW
  );

  console.log(
    "===================================="
  );
}


main();
