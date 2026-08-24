const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(
  process.cwd(),
  "data",
  "art_commissions.json"
);

const NORMALIZER_VERSION = "1.2.0";

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


function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(
      /&#(\d+);/g,
      function (_, code) {
        return String.fromCharCode(
          Number(code)
        );
      }
    )
    .replace(
      /&#x([0-9a-f]+);/gi,
      function (_, code) {
        return String.fromCharCode(
          parseInt(code, 16)
        );
      }
    );
}


function htmlToText(html) {
  return cleanText(
    decodeHtmlEntities(
      String(html || "")
        .replace(
          /<!--[\s\S]*?-->/g,
          " "
        )
        .replace(
          /<script[\s\S]*?<\/script>/gi,
          " "
        )
        .replace(
          /<style[\s\S]*?<\/style>/gi,
          " "
        )
        .replace(
          /<(br|\/p|\/div|\/li|\/tr|\/h\d)>/gi,
          " "
        )
        .replace(
          /<[^>]+>/g,
          " "
        )
    )
  );
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


function getKoreaYear() {
  return Number(
    getKoreaToday()
      .slice(0, 4)
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

  return getKoreaYear();
}


/* =========================================================
   DETAIL PAGE FETCH
========================================================= */

async function fetchDetailText(url) {
  const sourceUrl =
    String(url || "")
      .trim();

  if (
    !sourceUrl ||
    !/^https?:\/\//i.test(
      sourceUrl
    )
  ) {
    return {
      ok: false,
      text: "",
      reason: "no_url"
    };
  }

  try {
    console.log(
      "FETCH:",
      sourceUrl
    );

    const response =
      await fetch(
        sourceUrl,
        {
          redirect: "follow",

          headers: {
            "User-Agent":
              "Mozilla/5.0 AXOO-B2G-DateVerifier/1.2",

            "Accept":
              "text/html,application/xhtml+xml"
          }
        }
      );

    if (!response.ok) {
      return {
        ok: false,
        text: "",
        reason:
          "HTTP_" +
          response.status
      };
    }

    const html =
      await response.text();

    const text =
      htmlToText(html);

    if (
      text.length < 50
    ) {
      return {
        ok: false,
        text: text,
        reason:
          "empty_body"
      };
    }

    return {
      ok: true,
      text: text,
      reason: ""
    };

  } catch (error) {
    console.warn(
      "DETAIL FETCH ERROR:",
      sourceUrl,
      error.message
    );

    return {
      ok: false,
      text: "",
      reason:
        error.message ||
        "fetch_error"
    };
  }
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
        index:
          match.index,

        end:
          fullRegex.lastIndex,

        value:
          value,

        explicitYear:
          true
      });
    }
  }


  const partialRegex =
    /(\d{1,2})\s*월\s*(\d{1,2})\s*일?/g;

  while (
    (
      match =
        partialRegex.exec(source)
    ) !== null
  ) {
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
          partialRegex.lastIndex,

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
   DATE RANGE
========================================================= */

function extractDateRange(
  segment,
  baseYear
) {
  const text =
    cleanText(segment);


  /*
    2026년 8월 10일 ~ 8월 29일
    2026.08.10 ~ 08.29
    2026-08-10 ~ 2026-08-29
  */
  let match =
    text.match(
      /(20\d{2})\s*(?:년|[.\-/])\s*(\d{1,2})\s*(?:월|[.\-/])\s*(\d{1,2})\s*일?\s*(?:\([^)]*\))?\s*[~∼～–—-]\s*(?:(20\d{2})\s*(?:년|[.\-/])\s*)?(\d{1,2})\s*(?:월|[.\-/])\s*(\d{1,2})\s*일?/
    );

  if (match) {
    const startYear =
      Number(match[1]);

    let endYear =
      match[4]
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

    if (
      start &&
      end &&
      !match[4] &&
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
        end: end
      };
    }
  }


  /*
    8월 10일 ~ 8월 29일
  */
  match =
    text.match(
      /(\d{1,2})\s*월\s*(\d{1,2})\s*일?\s*(?:\([^)]*\))?\s*[~∼～–—-]\s*(?:(20\d{2})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일?/
    );

  if (match) {
    const startYear =
      baseYear;

    let endYear =
      match[3]
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
      !match[3] &&
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
        end: end
      };
    }
  }


  return null;
}


/* =========================================================
   PUBLISHED DATE
========================================================= */

function extractPublishedDate(
  text,
  existingDates
) {
  const source =
    cleanText(text);


  for (
    const keyword of
    PUBLISHED_KEYWORDS
  ) {
    const index =
      source.indexOf(keyword);

    if (index === -1) {
      continue;
    }

    const segment =
      source.slice(
        index,
        index + 140
      );

    const date =
      findFirstDate(
        segment,
        getKoreaYear()
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


  for (
    const candidate of
    existingDates
  ) {
    const parsed =
      parseExistingDate(
        candidate
      );

    if (parsed) {
      return {
        value:
          parsed,

        source:
          "existing"
      };
    }
  }


  return {
    value: "",
    source:
      "not_found"
  };
}


/* =========================================================
   PERIOD
========================================================= */

function extractPeriod(
  text,
  publishedDate
) {
  const source =
    cleanText(text);

  const baseYear =
    yearFromDate(
      publishedDate
    );


  for (
    const keyword of
    PERIOD_KEYWORDS
  ) {
    const index =
      source.indexOf(keyword);

    if (index === -1) {
      continue;
    }

    const segment =
      source.slice(
        index,
        index + 260
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
      하루 접수:
      2026. 8. 24.(월) 10:00 ~ 17:00
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
          firstDate.end + 120
        );

      const hasTimeRange =
        /\d{1,2}\s*:\s*\d{2}\s*[~∼～–—-]\s*\d{1,2}\s*:\s*\d{2}/
          .test(afterDate);

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
    source:
      "not_found",
    keyword: ""
  };
}


/* =========================================================
   EXPLICIT DEADLINE
========================================================= */

function extractExplicitDeadline(
  text,
  publishedDate
) {
  const source =
    cleanText(text);

  const baseYear =
    yearFromDate(
      publishedDate
    );


  for (
    const keyword of
    DEADLINE_KEYWORDS
  ) {
    const index =
      source.indexOf(keyword);

    if (index === -1) {
      continue;
    }

    const segment =
      source.slice(
        index,
        index + 180
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
    source:
      "not_found",
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

  const expired =
    deadline <
    getKoreaToday();

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
   NORMALIZE ITEM
========================================================= */

async function normalizeItem(item) {
  let detailText =
    cleanText(
      item.detailTextSample
    );

  let detailFetchStatus =
    item.detailFetchStatus ||
    "";


  /*
    상세 본문이 없거나 지나치게 짧으면
    공고 URL을 직접 다시 연다.
  */
  if (
    detailText.length < 100
  ) {
    const fetched =
      await fetchDetailText(
        item.sourceUrl ||
        item.originalUrl ||
        item.url
      );

    if (fetched.ok) {
      detailText =
        fetched.text;

      detailFetchStatus =
        "ok";

    } else {
      detailFetchStatus =
        fetched.reason ||
        "failed";
    }
  }


  const fallbackText =
    cleanText(
      [
        item.rawText,
        item.summary,
        item.nextAction,
        item.recommendedAction,
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


  const periodStart =
    period.start ||
    existingPeriodStart ||
    "";


  /*
    상세 원문에서 종료일을 찾았다면
    기존 periodEnd보다 무조건 우선.
  */
  const periodEnd =
    period.end ||
    existingPeriodEnd ||
    "";


  /*
    신뢰 우선순위

    1. 명시된 접수/제출 마감
    2. 원문 접수기간 종료일
    3. 기존 JSON 마감일
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
      "existing_deadline";

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


  const recommendedBase =
    String(
      item.recommendedAction ||
      item.nextAction ||
      "공고 원문 확인 후 공모 요강·접수 기간·참여 자격 검토"
    )
      .replace(
        /\s*\/\s*공모기간\s*:[^/]+$/i,
        ""
      )
      .trim();


  const recommendedAction =
    recommendedBase +
    (
      periodStart &&
      periodEnd
        ? " / 공모기간: " +
          periodStart +
          " ~ " +
          periodEnd
        : ""
    );


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

    recommendedAction:
      recommendedAction,

    detailFetchStatus:
      detailFetchStatus,

    /*
      근거 보존.
      다음 실행에서 다시 URL을 열 필요가 없도록 한다.
    */
    detailTextSample:
      detailText
        ? detailText.slice(
            0,
            12000
          )
        : "",

    publishedDateSource:
      published.source,

    periodSource:
      period.start
        ? period.source
        : "not_found",

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
   JSON
========================================================= */

function getItems(data) {
  if (Array.isArray(data)) {
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
  if (Array.isArray(original)) {
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

async function main() {
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
    getItems(original);


  const normalized = [];


  /*
    공공사이트 과부하 방지를 위해
    순차적으로 검증.
  */
  for (
    const item of
    items
  ) {
    const result =
      await normalizeItem(
        item
      );

    normalized.push(
      result
    );
  }


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
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0
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


main()
  .catch(
    function (error) {
      console.error(
        error
      );

      process.exit(1);
    }
  );
