const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(process.cwd(), "data", "art_commissions.json");
const ARCHIVE_FILE = path.join(process.cwd(), "data", "art_commissions_archive.json");

const NORMALIZER_VERSION = "1.4.1";
const DETAIL_TEXT_LIMIT = 12000;
const FETCH_TIMEOUT_MS = 15000;
const MAX_REASONABLE_PERIOD_DAYS = 180;
const UNKNOWN_DEADLINE_STALE_DAYS = 75;

const PUBLISHED_KEYWORDS = [
  "등록일자",
  "등록일",
  "작성일",
  "게시일",
  "공고일"
];

const PRIORITY_DEADLINE_KEYWORDS = [
  "응모작품 접수일시",
  "작품 접수일시",
  "작품접수일시",
  "작품 제출일시",
  "작품제출일시",
  "접수 일자",
  "접수일자",
  "접수 일시",
  "접수일시",
  "제출 일자",
  "제출일자",
  "제출 일시",
  "제출일시",
  "응모 접수",
  "응모접수",
  "접수마감",
  "제출마감",
  "신청마감",
  "응모마감",
  "마감일",
  "마감기한",
  "제출기한",
  "접수기한",

  // v1.4.1
  // 실제 경기도 공모에서 확인된 추가 표현
  "공모 방법",
  "공모방법",
  "일자 / 방법",
  "일자/방법",

  "일자 / 시간",
  "일자/시간",
  "작품 접수",
  "접수일",
  "제출일"
];

const RANGE_DEADLINE_KEYWORDS = [
  "작품 접수기간",
  "작품접수기간",
  "접수기간",
  "제출기간",
  "응모기간",
  "신청기간"
];

const PERIOD_KEYWORDS = [
  "공모기간",
  "공모 기간",
  "공고기간",
  "공고 기간",
  "응모기간",
  "신청기간",
  "제출기간",
  "접수기간",
  "응모작품 접수일시",
  "작품 접수일시",
  "작품제출일시",
  "작품 제출일시",
  "제출일시",
  "접수일시",
  "작품 접수",
  "접수일",
  "제출일"
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


function normalizeText(value) {
  return cleanText(value)
    .toLowerCase();
}


function normalizeUrl(value) {
  return String(value || "")
    .trim()
    .replace(/#.*$/, "")
    .replace(/\/$/, "");
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
          /<script[\s\S]*?<\/script>/gi,
          " "
        )
        .replace(
          /<style[\s\S]*?<\/style>/gi,
          " "
        )
        .replace(
          /<noscript[\s\S]*?<\/noscript>/gi,
          " "
        )
        .replace(
          /<(br|\/p|\/div|\/li|\/tr|\/td|\/th|\/h\d)>/gi,
          " "
        )
        .replace(
          /<[^>]+>/g,
          " "
        )
    )
  );
}


function getKoreaToday() {
  const parts =
    new Intl.DateTimeFormat(
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
    )
      .formatToParts(
        new Date()
      );

  const map = {};

  parts.forEach(
    function (part) {
      if (
        part.type !==
        "literal"
      ) {
        map[
          part.type
        ] =
          part.value;
      }
    }
  );

  return [
    map.year,
    map.month,
    map.day
  ].join("-");
}


function getKoreaYear() {
  return Number(
    getKoreaToday()
      .slice(
        0,
        4
      )
  );
}


/* =========================================================
   YEAR / DATE NORMALIZATION
========================================================= */

function repairLikelyYearTypos(value) {
  const currentYear =
    getKoreaYear();

  return String(
    value || ""
  ).replace(
    /\b(20\d{2})(\d)(?=\s*(?:년|[-./]))/g,

    function (
      full,
      fourDigitYear,
      extraDigit
    ) {
      const year =
        Number(
          fourDigitYear
        );

      const repeatedLastDigit =
        fourDigitYear
          .slice(-1) ===
        extraDigit;

      const nearCurrentYear =
        Math.abs(
          year -
          currentYear
        ) <= 2;

      return (
        repeatedLastDigit &&
        nearCurrentYear
      )
        ? fourDigitYear
        : full;
    }
  );
}


function normalizeDateText(value) {
  return repairLikelyYearTypos(
    cleanText(value)
  );
}


function yearFromDate(value) {
  const match =
    String(
      value || ""
    ).match(
      /^(\d{4})-/
    );

  return match
    ? Number(
        match[1]
      )
    : getKoreaYear();
}


function resolveYearToken(
  token,
  baseYear
) {
  const raw =
    String(
      token || ""
    ).trim();

  const base =
    Number(
      baseYear ||
      getKoreaYear()
    );

  if (
    /^\d{4}$/.test(
      raw
    )
  ) {
    const year =
      Number(raw);

    return (
      year >= 2000 &&
      year <= 2100
    )
      ? year
      : null;
  }

  if (
    /^\d{2}$/.test(
      raw
    )
  ) {
    const century =
      Math.floor(
        base / 100
      ) * 100;

    let year =
      century +
      Number(raw);

    if (
      year -
      base >
      50
    ) {
      year -= 100;
    }

    if (
      base -
      year >
      50
    ) {
      year += 100;
    }

    return (
      year >= 2000 &&
      year <= 2100
    )
      ? year
      : null;
  }

  return null;
}


function toISO(
  year,
  month,
  day
) {
  const y =
    Number(year);

  const m =
    Number(month);

  const d =
    Number(day);

  if (
    !Number.isFinite(y) ||
    !Number.isFinite(m) ||
    !Number.isFinite(d) ||
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
    date.getUTCFullYear() !==
      y ||

    date.getUTCMonth() !==
      m - 1 ||

    date.getUTCDate() !==
      d
  ) {
    return "";
  }

  return [
    String(y)
      .padStart(
        4,
        "0"
      ),

    String(m)
      .padStart(
        2,
        "0"
      ),

    String(d)
      .padStart(
        2,
        "0"
      )
  ].join("-");
}


function parseExistingDate(
  value,
  baseYear
) {
  const matches =
    findDateMatches(
      value,
      baseYear ||
      getKoreaYear()
    );

  return matches.length
    ? matches[0].value
    : "";
}


function dateDiffDays(
  fromIso,
  toIso
) {
  if (
    !fromIso ||
    !toIso
  ) {
    return null;
  }

  const from =
    new Date(
      fromIso +
      "T00:00:00+09:00"
    );

  const to =
    new Date(
      toIso +
      "T00:00:00+09:00"
    );

  if (
    Number.isNaN(
      from.getTime()
    ) ||

    Number.isNaN(
      to.getTime()
    )
  ) {
    return null;
  }

  return Math.round(
    (
      to.getTime() -
      from.getTime()
    ) /
    86400000
  );
}


/* =========================================================
   FETCH DETAIL PAGE
========================================================= */

async function fetchDetailText(url) {
  const target =
    normalizeUrl(url);

  if (
    !/^https?:\/\//i.test(
      target
    )
  ) {
    return {
      ok:
        false,

      reason:
        "invalid_url",

      text:
        ""
    };
  }

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      function () {
        controller.abort();
      },
      FETCH_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        target,
        {
          signal:
            controller.signal,

          redirect:
            "follow",

          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; AXOO-B2G-DateNormalizer/1.4.1; +https://github.com/sksrkass-png/axoo-b2g-dashboard)",

            "Accept-Language":
              "ko-KR,ko;q=0.9,en;q=0.7"
          }
        }
      );

    if (
      !response.ok
    ) {
      return {
        ok:
          false,

        reason:
          "http_" +
          response.status,

        text:
          ""
      };
    }

    const html =
      await response.text();

    const text =
      htmlToText(
        html
      );

    if (
      text.length <
      30
    ) {
      return {
        ok:
          false,

        reason:
          "empty_text",

        text:
          ""
      };
    }

    return {
      ok:
        true,

      reason:
        "ok",

      text:
        text
    };

  } catch (error) {
    return {
      ok:
        false,

      reason:
        error &&
        error.name ===
          "AbortError"
          ? "timeout"
          : "fetch_failed",

      text:
        ""
    };

  } finally {
    clearTimeout(
      timer
    );
  }
}


/* =========================================================
   DATE PARSING
========================================================= */

function findDateMatches(
  text,
  baseYear
) {
  const source =
    normalizeDateText(
      text
    );

  const regex =
    /(?:(\d{4}|\d{2})\s*(?:년|[-./])\s*)?(\d{1,2})\s*(?:월|[-./])\s*(\d{1,2})\s*(?:일)?/g;

  const matches =
    [];

  let match;

  while (
    (
      match =
        regex.exec(
          source
        )
    ) !== null
  ) {
    const explicitToken =
      match[1] ||
      "";

    const year =
      explicitToken
        ? resolveYearToken(
            explicitToken,
            baseYear
          )

        : Number(
            baseYear ||
            getKoreaYear()
          );

    if (
      !year
    ) {
      continue;
    }

    const value =
      toISO(
        year,
        match[2],
        match[3]
      );

    if (
      !value
    ) {
      continue;
    }

    matches.push({
      value:
        value,

      year:
        year,

      hasExplicitYear:
        Boolean(
          explicitToken
        ),

      yearToken:
        explicitToken,

      start:
        match.index,

      end:
        regex.lastIndex,

      raw:
        match[0]
    });
  }

  return matches;
}


function findFirstDate(
  text,
  baseYear
) {
  const dates =
    findDateMatches(
      text,
      baseYear
    );

  return dates.length
    ? dates[0]
    : null;
}


function hasDateRangeConnector(value) {
  return (
    /[~∼～–—]|\b부터\b|\b까지\b|\s-\s/
      .test(
        String(
          value ||
          ""
        )
      )
  );
}


function hasTimeRange(value) {
  const source =
    String(
      value ||
      ""
    );

  const colonRange =
    /\d{1,2}\s*:\s*\d{2}\s*[~∼～–—-]\s*\d{1,2}\s*:\s*\d{2}/;

  const koreanHourRange =
    /\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?\s*[~∼～–—-]\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?/;

  return (
    colonRange.test(
      source
    ) ||

    koreanHourRange.test(
      source
    )
  );
}


function extractDateRange(
  text,
  baseYear
) {
  const source =
    normalizeDateText(
      text
    );

  const dates =
    findDateMatches(
      source,
      baseYear
    );

  if (
    dates.length >=
    2
  ) {
    for (
      let index = 0;
      index <
      dates.length - 1;
      index += 1
    ) {
      const first =
        dates[index];

      const second =
        dates[
          index + 1
        ];

      const between =
        source.slice(
          first.end,
          second.start
        );

      if (
        !hasDateRangeConnector(
          between
        )
      ) {
        continue;
      }

      let end =
        second.value;

      if (
        !second.hasExplicitYear &&
        end <
        first.value
      ) {
        end =
          toISO(
            first.year + 1,

            Number(
              end.slice(
                5,
                7
              )
            ),

            Number(
              end.slice(
                8,
                10
              )
            )
          );
      }

      return {
        start:
          first.value,

        end:
          end,

        rawStart:
          first.raw,

        rawEnd:
          second.raw
      };
    }
  }

  if (
    dates.length >=
    1
  ) {
    const first =
      dates[0];

    const afterDate =
      source.slice(
        first.end,
        first.end +
        140
      );

    if (
      hasTimeRange(
        afterDate
      )
    ) {
      return {
        start:
          first.value,

        end:
          first.value,

        rawStart:
          first.raw,

        rawEnd:
          first.raw
      };
    }
  }

  return null;
}


/* =========================================================
   SEGMENTS
========================================================= */

function keywordSegments(
  source,
  keyword,
  segmentLength
) {
  const segments =
    [];

  let offset =
    0;

  while (
    offset <
    source.length
  ) {
    const index =
      source.indexOf(
        keyword,
        offset
      );

    if (
      index ===
      -1
    ) {
      break;
    }

    segments.push(
      source.slice(
        index,
        index +
        segmentLength
      )
    );

    offset =
      index +
      keyword.length;
  }

  return segments;
}


/* =========================================================
   PUBLISHED DATE
========================================================= */

function extractPublishedDate(
  text,
  existingDates
) {
  const source =
    normalizeDateText(
      text
    );

  for (
    const keyword of
    PUBLISHED_KEYWORDS
  ) {
    const segments =
      keywordSegments(
        source,
        keyword,
        160
      );

    for (
      const segment of
      segments
    ) {
      const date =
        findFirstDate(
          segment,
          getKoreaYear()
        );

      if (
        date
      ) {
        return {
          value:
            date.value,

          source:
            "detail_metadata",

          keyword:
            keyword
        };
      }
    }
  }

  for (
    const candidate of
    existingDates
  ) {
    const parsed =
      parseExistingDate(
        candidate,
        getKoreaYear()
      );

    if (
      parsed
    ) {
      return {
        value:
          parsed,

        source:
          "existing",

        keyword:
          ""
      };
    }
  }

  return {
    value:
      "",

    source:
      "not_found",

    keyword:
      ""
  };
}


/* =========================================================
   PRIORITY DEADLINE
========================================================= */

function extractPriorityDeadline(
  text,
  publishedDate
) {
  const source =
    normalizeDateText(
      text
    );

  const baseYear =
    yearFromDate(
      publishedDate
    );

  for (
    const keyword of
    PRIORITY_DEADLINE_KEYWORDS
  ) {
    const segments =
      keywordSegments(
        source,
        keyword,
        260
      );

    for (
      const segment of
      segments
    ) {
      const range =
        extractDateRange(
          segment,
          baseYear
        );

      if (
        range
      ) {
        return {
          value:
            range.end,

          source:
            "priority_deadline_range",

          keyword:
            keyword,

          raw:
            range.rawEnd ||
            ""
        };
      }

      const date =
        findFirstDate(
          segment,
          baseYear
        );

      if (
        date
      ) {
        return {
          value:
            date.value,

          source:
            "priority_deadline",

          keyword:
            keyword,

          raw:
            date.raw
        };
      }
    }
  }


  for (
    const keyword of
    RANGE_DEADLINE_KEYWORDS
  ) {
    const segments =
      keywordSegments(
        source,
        keyword,
        320
      );

    for (
      const segment of
      segments
    ) {
      const range =
        extractDateRange(
          segment,
          baseYear
        );

      if (
        range
      ) {
        return {
          value:
            range.end,

          source:
            "priority_deadline_range",

          keyword:
            keyword,

          raw:
            range.rawEnd ||
            ""
        };
      }
    }
  }

  return {
    value:
      "",

    source:
      "not_found",

    keyword:
      "",

    raw:
      ""
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
    normalizeDateText(
      text
    );

  const baseYear =
    yearFromDate(
      publishedDate
    );

  for (
    const keyword of
    PERIOD_KEYWORDS
  ) {
    const segments =
      keywordSegments(
        source,
        keyword,
        320
      );

    for (
      const segment of
      segments
    ) {
      const range =
        extractDateRange(
          segment,
          baseYear
        );

      if (
        range
      ) {
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

      const firstDate =
        findFirstDate(
          segment,
          baseYear
        );

      if (
        firstDate
      ) {
        const afterDate =
          segment.slice(
            firstDate.end,
            firstDate.end +
            140
          );

        if (
          hasTimeRange(
            afterDate
          )
        ) {
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
  }

  return {
    start:
      "",

    end:
      "",

    source:
      "not_found",

    keyword:
      ""
  };
}


/* =========================================================
   DEADLINE CHOICE
========================================================= */

function chooseDeadline(options) {
  const publishedDate =
    options.publishedDate ||
    "";

  const priority =
    options.priority ||
    {
      value:
        ""
    };

  const period =
    options.period ||
    {
      end:
        ""
    };

  const existingDeadline =
    options.existingDeadline ||
    "";

  const existingPeriodEnd =
    options.existingPeriodEnd ||
    "";


  if (
    priority.value
  ) {
    return {
      value:
        priority.value,

      source:
        priority.source,

      keyword:
        priority.keyword ||
        "",

      suspiciousPeriodIgnored:
        false
    };
  }


  if (
    period.end
  ) {
    const periodDays =
      dateDiffDays(
        publishedDate,
        period.end
      );

    const suspicious =
      periodDays !==
        null &&

      periodDays >
        MAX_REASONABLE_PERIOD_DAYS;

    if (
      !suspicious
    ) {
      return {
        value:
          period.end,

        source:
          "period_end",

        keyword:
          period.keyword ||
          "",

        suspiciousPeriodIgnored:
          false
      };
    }
  }


  if (
    existingDeadline
  ) {
    const existingDays =
      dateDiffDays(
        publishedDate,
        existingDeadline
      );

    const suspiciousExisting =
      existingDays !==
        null &&

      existingDays >
        MAX_REASONABLE_PERIOD_DAYS;

    if (
      !suspiciousExisting
    ) {
      return {
        value:
          existingDeadline,

        source:
          "existing_deadline",

        keyword:
          "",

        suspiciousPeriodIgnored:
          Boolean(
            period.end
          )
      };
    }
  }


  if (
    existingPeriodEnd
  ) {
    const existingPeriodDays =
      dateDiffDays(
        publishedDate,
        existingPeriodEnd
      );

    const suspiciousExistingPeriod =
      existingPeriodDays !==
        null &&

      existingPeriodDays >
        MAX_REASONABLE_PERIOD_DAYS;

    if (
      !suspiciousExistingPeriod
    ) {
      return {
        value:
          existingPeriodEnd,

        source:
          "existing_period_end",

        keyword:
          "",

        suspiciousPeriodIgnored:
          Boolean(
            period.end
          )
      };
    }
  }


  return {
    value:
      "",

    source:
      period.end
        ? "suspicious_period_ignored"
        : "not_found",

    keyword:
      "",

    suspiciousPeriodIgnored:
      Boolean(
        period.end
      )
  };
}


/* =========================================================
   STATUS
========================================================= */

function getDeadlineState(
  deadline,
  publishedDate
) {
  const today =
    getKoreaToday();

  if (
    deadline
  ) {
    const expired =
      deadline <
      today;

    return {
      isExpired:
        expired,

      deadlineStatus:
        expired
          ? "마감"
          : "진행중",

      isStaleCandidate:
        false,

      staleReason:
        ""
    };
  }


  const ageDays =
    dateDiffDays(
      publishedDate,
      today
    );

  const stale =
    ageDays !==
      null &&

    ageDays >=
      UNKNOWN_DEADLINE_STALE_DAYS;

  return {
    isExpired:
      stale,

    deadlineStatus:
      stale
        ? "마감 추정"
        : "마감일 확인 필요",

    isStaleCandidate:
      stale,

    staleReason:
      stale
        ? "마감일 미확인 + 등록 후 " +
          ageDays +
          "일 경과"

        : ""
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


  if (
    detailText.length <
    100
  ) {
    const fetched =
      await fetchDetailText(
        item.sourceUrl ||
        item.originalUrl ||
        item.url
      );

    if (
      fetched.ok
    ) {
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
        .join(
          " | "
        )
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


  const priorityDeadline =
    extractPriorityDeadline(
      extractionText,
      published.value
    );


  const period =
    extractPeriod(
      extractionText,
      published.value
    );


  const existingPeriodStart =
    parseExistingDate(
      item.periodStart,
      yearFromDate(
        published.value
      )
    );


  const existingPeriodEnd =
    parseExistingDate(
      item.periodEnd,
      yearFromDate(
        published.value
      )
    );


  const existingDeadline =
    parseExistingDate(
      item.deadline ||
      item.endDate ||
      item.closeDate,

      yearFromDate(
        published.value
      )
    );


  const periodStart =
    period.start ||
    existingPeriodStart ||
    "";


  const periodEnd =
    period.end ||
    existingPeriodEnd ||
    "";


  const deadlineChoice =
    chooseDeadline({
      publishedDate:
        published.value,

      priority:
        priorityDeadline,

      period:
        period,

      existingDeadline:
        existingDeadline,

      existingPeriodEnd:
        existingPeriodEnd
    });


  const deadline =
    deadlineChoice.value;


  const deadlineState =
    getDeadlineState(
      deadline,
      published.value
    );


  let confidence =
    "LOW";


  if (
    published.value &&
    deadline &&
    [
      "priority_deadline",
      "priority_deadline_range",
      "period_end"
    ].includes(
      deadlineChoice.source
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


  const normalizedStatus =
    deadline
      ? deadlineState
          .isExpired
        ? "마감"
        : "공모중"

      : deadlineState
          .deadlineStatus;


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
      .replace(
        /\s*\/\s*작품제출\s*:[^/]+$/i,
        ""
      )
      .trim();


  let periodLabel =
    "";


  if (
    periodStart &&
    periodEnd
  ) {
    periodLabel =
      periodStart ===
      periodEnd
        ? " / 공모기간: " +
          periodStart

        : " / 공모기간: " +
          periodStart +
          " ~ " +
          periodEnd;
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

    recommendedAction:
      recommendedBase +
      periodLabel,

    detailFetchStatus:
      detailFetchStatus,

    detailTextSample:
      detailText
        ? detailText.slice(
            0,
            DETAIL_TEXT_LIMIT
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
      deadlineChoice.source,

    deadlineKeyword:
      priorityDeadline.keyword ||
      deadlineChoice.keyword ||
      "",

    deadlineRaw:
      priorityDeadline.raw ||
      "",

    suspiciousPeriodIgnored:
      deadlineChoice
        .suspiciousPeriodIgnored,

    dateConfidence:
      confidence,

    dateNormalizationVersion:
      NORMALIZER_VERSION,

    dateNormalizedAt:
      getKoreaToday(),

    deadlineStatus:
      deadlineState
        .deadlineStatus,

    isExpired:
      deadlineState
        .isExpired,

    isStaleCandidate:
      deadlineState
        .isStaleCandidate,

    staleReason:
      deadlineState
        .staleReason
  };
}


/* =========================================================
   JSON HELPERS
========================================================= */

function getItems(data) {
  if (
    Array.isArray(
      data
    )
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


function readArchive() {
  if (
    !fs.existsSync(
      ARCHIVE_FILE
    )
  ) {
    return [];
  }

  const raw =
    fs.readFileSync(
      ARCHIVE_FILE,
      "utf8"
    );

  if (
    !raw.trim()
  ) {
    return [];
  }

  const parsed =
    JSON.parse(
      raw
    );

  if (
    !Array.isArray(
      parsed
    )
  ) {
    throw new Error(
      "data/art_commissions_archive.json 은 배열 형식이어야 합니다."
    );
  }

  return parsed;
}


/* =========================================================
   ARCHIVE
========================================================= */

function getSourceUrl(item) {
  return normalizeUrl(
    item.sourceUrl ||
    item.originalUrl ||
    item.url ||
    ""
  );
}


function getStrongId(item) {
  return String(
    item.id ||
    item.bidNtceNo ||
    item.noticeNo ||
    item.noticeId ||
    item.sourceId ||
    ""
  ).trim();
}


function sameArchiveItem(
  a,
  b
) {
  const aId =
    getStrongId(a);

  const bId =
    getStrongId(b);

  if (
    aId &&
    bId &&
    aId ===
      bId
  ) {
    return true;
  }

  const aUrl =
    getSourceUrl(a);

  const bUrl =
    getSourceUrl(b);

  if (
    aUrl &&
    bUrl &&
    aUrl ===
      bUrl
  ) {
    return true;
  }

  const aBid =
    String(
      a.bidNtceNo ||
      ""
    ).trim();

  const bBid =
    String(
      b.bidNtceNo ||
      ""
    ).trim();

  if (
    aBid &&
    bBid &&
    aBid ===
      bBid
  ) {
    return true;
  }

  const aTitle =
    normalizeText(
      a.title ||
      a.projectName
    );

  const bTitle =
    normalizeText(
      b.title ||
      b.projectName
    );

  const aAgency =
    normalizeText(
      a.agency ||
      a.organization ||
      a.noticeAgency
    );

  const bAgency =
    normalizeText(
      b.agency ||
      b.organization ||
      b.noticeAgency
    );

  return Boolean(
    aTitle &&
    bTitle &&
    aTitle ===
      bTitle &&
    (
      !aAgency ||
      !bAgency ||
      aAgency ===
        bAgency
    )
  );
}


function upsertArchive(
  existingArchive,
  normalizedItems
) {
  const today =
    getKoreaToday();


  const archive =
    existingArchive.map(
      function (item) {
        return {
          ...item,

          archiveIsCurrent:
            false
        };
      }
    );


  normalizedItems.forEach(
    function (item) {
      const index =
        archive.findIndex(
          function (
            archived
          ) {
            return sameArchiveItem(
              archived,
              item
            );
          }
        );


      if (
        index >=
        0
      ) {
        const previous =
          archive[index];

        archive[index] = {
          ...previous,
          ...item,

          archiveFirstSeenAt:
            previous
              .archiveFirstSeenAt ||
            previous
              .dateNormalizedAt ||
            today,

          archiveLastSeenAt:
            today,

          archiveIsCurrent:
            true
        };

      } else {
        archive.push({
          ...item,

          archiveFirstSeenAt:
            today,

          archiveLastSeenAt:
            today,

          archiveIsCurrent:
            true
        });
      }
    }
  );


  archive.sort(
    function (
      a,
      b
    ) {
      const aDate =
        a.publishedDate ||
        a.postedDate ||
        a.deadline ||
        "";

      const bDate =
        b.publishedDate ||
        b.postedDate ||
        b.deadline ||
        "";

      if (
        aDate !==
        bDate
      ) {
        return bDate
          .localeCompare(
            aDate
          );
      }

      return String(
        a.title ||
        ""
      ).localeCompare(
        String(
          b.title ||
          ""
        ),
        "ko"
      );
    }
  );

  return archive;
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
    getItems(
      original
    );


  const normalized =
    [];


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


  const existingArchive =
    readArchive();


  const archive =
    upsertArchive(
      existingArchive,
      normalized
    );


  fs.writeFileSync(
    ARCHIVE_FILE,

    JSON.stringify(
      archive,
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
      0,

    EXPIRED:
      0,

    STALE:
      0,

    SUSPICIOUS_PERIOD_IGNORED:
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
        summary[key] +=
          1;
      }

      if (
        item.isExpired
      ) {
        summary.EXPIRED +=
          1;
      }

      if (
        item.isStaleCandidate
      ) {
        summary.STALE +=
          1;
      }

      if (
        item
          .suspiciousPeriodIgnored
      ) {
        summary
          .SUSPICIOUS_PERIOD_IGNORED +=
          1;
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
    "현재 공고:",
    normalized.length
  );

  console.log(
    "Archive 전체:",
    archive.length
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
    "마감 판정:",
    summary.EXPIRED
  );

  console.log(
    "마감일 미확인 장기경과:",
    summary.STALE
  );

  console.log(
    "비정상 장기 공모기간 무시:",
    summary
      .SUSPICIOUS_PERIOD_IGNORED
  );

  console.log(
    "===================================="
  );
}


/* =========================================================
   ENTRY
========================================================= */

if (
  require.main ===
  module
) {
  main()
    .catch(
      function (error) {
        console.error(
          "[AXOO ART DATE NORMALIZER]",
          error
        );

        process.exitCode =
          1;
      }
    );
}


/* =========================================================
   TEST EXPORTS
========================================================= */

module.exports = {
  findDateMatches,
  extractDateRange,
  extractPriorityDeadline,
  extractPeriod,
  normalizeItem,
  parseExistingDate,
  chooseDeadline,
  getDeadlineState
};
