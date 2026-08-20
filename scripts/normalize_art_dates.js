const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(
  process.cwd(),
  "data",
  "art_commissions.json"
);

const NORMALIZER_VERSION = "1.0.0";

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
      parsed.slice(
        0,
        4
      )
    );
  }

  return new Date()
    .getFullYear();
}


/* =========================================================
   DATE TOKENS
========================================================= */

function extractDateTokens(
  segment,
  baseYear
) {
  const text =
    cleanText(segment);

  const tokens = [];
  const occupied = [];

  /*
    2026년 8월 10일
    2026. 8. 10.
    2026-08-10
    2026/08/10
  */
  const fullDateRegex =
    /(20\d{2})\s*(?:년|[.\-/])\s*(\d{1,2})\s*(?:월|[.\-/])\s*(\d{1,2})\s*일?/g;

  let match;

  while (
    (
      match =
        fullDateRegex.exec(text)
    ) !== null
  ) {
    const iso =
      toISO(
        match[1],
        match[2],
        match[3]
      );

    if (!iso) {
      continue;
    }

    tokens.push({
      index: match.index,
      end:
        fullDateRegex.lastIndex,
      iso: iso,
      explicitYear: true
    });

    occupied.push([
      match.index,
      fullDateRegex.lastIndex
    ]);
  }

  /*
    8월 29일
    처럼 연도 생략
  */
  const partialDateRegex =
    /(\d{1,2})\s*월\s*(\d{1,2})\s*일?/g;

  while (
    (
      match =
        partialDateRegex.exec(text)
    ) !== null
  ) {
    const start =
      match.index;

    const end =
      partialDateRegex.lastIndex;

    const overlaps =
      occupied.some(
        function (range) {
          return (
            start < range[1] &&
            end > range[0]
          );
        }
      );

    if (overlaps) {
      continue;
    }

    const iso =
      toISO(
        baseYear,
        match[1],
        match[2]
      );

    if (!iso) {
      continue;
    }

    tokens.push({
      index: start,
      end: end,
      iso: iso,
      explicitYear: false
    });
  }

  tokens.sort(
    function (a, b) {
      return (
        a.index -
        b.index
      );
    }
  );

  return tokens;
}


function getKeywordWindow(
  text,
  keyword,
  length
) {
  const index =
    text.indexOf(keyword);

  if (index === -1) {
    return "";
  }

  return text.slice(
    index,
    index + length
  );
}


/* =========================================================
   PUBLISHED DATE
========================================================= */

function extractPublishedDate(
  text,
  existingDates
) {
  /*
    상세페이지의 등록일을
    기존 데이터보다 우선한다.
  */
  for (
    const keyword of
    PUBLISHED_KEYWORDS
  ) {
    const segment =
      getKeywordWindow(
        text,
        keyword,
        120
      );

    if (!segment) {
      continue;
    }

    const tokens =
      extractDateTokens(
        segment,
        new Date()
          .getFullYear()
      );

    if (tokens.length) {
      return {
        value:
          tokens[0].iso,

        source:
          "detail_metadata"
      };
    }
  }

  /*
    상세페이지에서 못 찾은 경우
    기존 공식 데이터 유지.
  */
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
        value: parsed,
        source: "existing"
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
  text,
  publishedDate
) {
  const baseYear =
    yearFromDate(
      publishedDate
    );

  for (
    const keyword of
    PERIOD_KEYWORDS
  ) {
    const segment =
      getKeywordWindow(
        text,
        keyword,
        320
      );

    if (!segment) {
      continue;
    }

    const tokens =
      extractDateTokens(
        segment,
        baseYear
      );

    /*
      예:
      2026년 8월 10일
      ~
      8월 29일
    */
    if (
      tokens.length >= 2
    ) {
      const start =
        tokens[0].iso;

      let end =
        tokens[1].iso;

      /*
        12월 → 1월처럼
        연도 생략된 경우
      */
      if (
        !tokens[1].explicitYear &&
        end < start
      ) {
        const parts =
          end.split("-");

        end =
          toISO(
            Number(
              start.slice(
                0,
                4
              )
            ) + 1,
            parts[1],
            parts[2]
          ) || end;
      }

      return {
        start: start,
        end: end,
        source:
          "detail_body",
        keyword: keyword
      };
    }

    /*
      예:
      2026.08.10 ~ 08.29
    */
    if (
      tokens.length === 1
    ) {
      const first =
        tokens[0];

      const tail =
        segment.slice(
          first.end
        );

      const numericEnd =
        tail.match(
          /[~∼～–—]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?!\d)/
        );

      if (numericEnd) {
        let end =
          toISO(
            Number(
              first.iso.slice(
                0,
                4
              )
            ),
            numericEnd[1],
            numericEnd[2]
          );

        if (
          end &&
          end < first.iso
        ) {
          end =
            toISO(
              Number(
                first.iso.slice(
                  0,
                  4
                )
              ) + 1,
              numericEnd[1],
              numericEnd[2]
            );
        }

        if (end) {
          return {
            start:
              first.iso,

            end: end,

            source:
              "detail_body",

            keyword:
              keyword
          };
        }
      }

      /*
        하루 접수 공고

        2026. 8. 24.(월)
        10:00 ~ 17:00
      */
      const timeRange =
        /\d{1,2}:\d{2}\s*[~∼～–—-]\s*\d{1,2}:\d{2}/
          .test(tail);

      const singleDayKeyword =
        [
          "접수일시",
          "응모작품 접수일시",
          "작품 접수일시",
          "접수일",
          "작품 접수"
        ].includes(keyword);

      if (
        timeRange ||
        singleDayKeyword
      ) {
        return {
          start:
            first.iso,

          end:
            first.iso,

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
  const baseYear =
    yearFromDate(
      publishedDate
    );

  for (
    const keyword of
    DEADLINE_KEYWORDS
  ) {
    const segment =
      getKeywordWindow(
        text,
        keyword,
        200
      );

    if (!segment) {
      continue;
    }

    const tokens =
      extractDateTokens(
        segment,
        baseYear
      );

    if (tokens.length) {
      return {
        value:
          tokens[0].iso,

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
   DATE STATUS
========================================================= */

function dateStatus(
  deadline
) {
  if (!deadline) {
    return {
      isExpired: false,
      deadlineStatus:
        "마감일 확인 필요"
    };
  }

  const now =
    new Date();

  const today =
    [
      now.getFullYear(),
      String(
        now.getMonth() + 1
      ).padStart(2, "0"),
      String(
        now.getDate()
      ).padStart(2, "0")
    ].join("-");

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
  const sourceText =
    cleanText(
      [
        item.detailTextSample,
        item.rawText,
        item.summary,
        item.nextAction,
        item.title
      ]
        .filter(Boolean)
        .join(" | ")
    );

  const published =
    extractPublishedDate(
      sourceText,
      [
        item.postedDate,
        item.publishedDate,
        item.noticeDate,
        item.createdDate
      ]
    );

  const period =
    extractPeriod(
      sourceText,
      published.value
    );

  const explicitDeadline =
    extractExplicitDeadline(
      sourceText,
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

  const periodEnd =
    period.end ||
    existingPeriodEnd ||
    "";

  /*
    마감일 우선순위

    1. 명시적 마감일
    2. 접수/공모기간 종료일
    3. 기존 공식 데이터
  */
  const deadline =
    explicitDeadline.value ||
    periodEnd ||
    existingDeadline ||
    "";

  let deadlineSource =
    "not_found";

  if (
    explicitDeadline.value
  ) {
    deadlineSource =
      explicitDeadline.source;

  } else if (periodEnd) {
    deadlineSource =
      period.source ===
      "detail_body"
        ? "period_end"
        : "existing_period_end";

  } else if (
    existingDeadline
  ) {
    deadlineSource =
      item.deadlineSource &&
      item.deadlineSource !==
      "not_found"
        ? item.deadlineSource
        : "existing_deadline";
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

  } else if (deadline) {
    confidence =
      "MEDIUM";
  }

  const deadlineState =
    dateStatus(
      deadline
    );

  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      );

  return {
    ...item,

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
      today,

    deadlineStatus:
      deadlineState.deadlineStatus,

    isExpired:
      deadlineState.isExpired
  };
}


/* =========================================================
   FILE
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
      projects: items
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
      items: items
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
      data: items
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
    getItems(original);

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

  const high =
    normalized.filter(
      function (item) {
        return (
          item.dateConfidence ===
          "HIGH"
        );
      }
    ).length;

  const medium =
    normalized.filter(
      function (item) {
        return (
          item.dateConfidence ===
          "MEDIUM"
        );
      }
    ).length;

  const low =
    normalized.filter(
      function (item) {
        return (
          item.dateConfidence ===
          "LOW"
        );
      }
    ).length;

  console.log(
    "===================================="
  );

  console.log(
    "AXOO ART DATE NORMALIZER"
  );

  console.log(
    "전체:",
    normalized.length
  );

  console.log(
    "HIGH:",
    high
  );

  console.log(
    "MEDIUM:",
    medium
  );

  console.log(
    "LOW:",
    low
  );

  console.log(
    "===================================="
  );
}


main();
