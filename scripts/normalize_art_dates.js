const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(
  process.cwd(),
  "data",
  "art_commissions.json"
);

const ARCHIVE_FILE = path.join(
  process.cwd(),
  "data",
  "art_commissions_archive.json"
);

const NORMALIZER_VERSION = "1.3.1";
const DETAIL_TEXT_LIMIT = 12000;
const FETCH_TIMEOUT_MS = 15000;

const PERIOD_KEYWORDS = [
  "응모작품 접수일시",
  "작품 접수일시",
  "작품제출일시",
  "작품 제출일시",
  "작품제출",
  "작품 제출",
  "제출일시",
  "접수일시",
  "접수기간",
  "공모기간",
  "공모 기간",
  "공고기간",
  "공고 기간",
  "응모기간",
  "신청기간",
  "제출기간",
  "작품 접수",
  "접수일",
  "제출일"
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
    .replace(/&#(\d+);/g, function (_, code) {
      return String.fromCharCode(Number(code));
    })
    .replace(/&#x([0-9a-f]+);/gi, function (_, code) {
      return String.fromCharCode(parseInt(code, 16));
    });
}


function htmlToText(html) {
  return cleanText(
    decodeHtmlEntities(
      String(html || "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<(br|\/p|\/div|\/li|\/tr|\/td|\/th|\/h\d)>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    )
  );
}


function getKoreaToday() {
  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).formatToParts(new Date());

  const map = {};

  parts.forEach(function (part) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  });

  return [
    map.year,
    map.month,
    map.day
  ].join("-");
}


function getKoreaYear() {
  return Number(
    getKoreaToday().slice(0, 4)
  );
}


/*
  공공기관 게시물의 명백한 연도 오타 보정.

  예:
  20266. 8. 21 -> 2026. 8. 21
  20255. 3. 10 -> 2025. 3. 10

  안전장치:
  1. 20xx 형태의 4자리 연도 뒤에 숫자가 하나 더 붙은 경우만
  2. 추가 숫자가 정상 연도의 마지막 숫자와 동일해야 함
  3. 현재 연도 기준 ±2년 범위에서만 허용

  즉 임의의 5자리 숫자를 연도로 바꾸지 않는다.
*/

function repairLikelyYearTypos(value) {
  const currentYear = getKoreaYear();

  return String(value || "")
    .replace(
      /\b(20\d{2})(\d)(?=\s*(?:년|[-./]))/g,
      function (
        full,
        fourDigitYear,
        extraDigit
      ) {
        const year = Number(
          fourDigitYear
        );

        const lastDigit =
          fourDigitYear.slice(-1);

        const repeatedLastDigit =
          lastDigit === extraDigit;

        const nearCurrentYear =
          Math.abs(
            year - currentYear
          ) <= 2;

        if (
          repeatedLastDigit &&
          nearCurrentYear
        ) {
          return fourDigitYear;
        }

        return full;
      }
    );
}


function normalizeDateText(value) {
  return repairLikelyYearTypos(
    cleanText(value)
  );
}


function yearFromDate(value) {
  const match = String(value || "")
    .match(/^(\d{4})-/);

  return match
    ? Number(match[1])
    : getKoreaYear();
}


function toISO(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);

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

  const date = new Date(
    Date.UTC(y, m - 1, d)
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
  const text = normalizeDateText(
    value
  );

  const match = text.match(
    /(\d{4})\s*(?:년|[-./])\s*(\d{1,2})\s*(?:월|[-./])\s*(\d{1,2})/
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


/* =========================================================
   FETCH DETAIL PAGE
========================================================= */

async function fetchDetailText(url) {
  const target = normalizeUrl(url);

  if (!/^https?:\/\//i.test(target)) {
    return {
      ok: false,
      reason: "invalid_url",
      text: ""
    };
  }

  const controller = new AbortController();

  const timer = setTimeout(
    function () {
      controller.abort();
    },
    FETCH_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      target,
      {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; AXOO-B2G-DateNormalizer/1.3.1; +https://github.com/sksrkass-png/axoo-b2g-dashboard)",

          "Accept-Language":
            "ko-KR,ko;q=0.9,en;q=0.7"
        }
      }
    );

    if (!response.ok) {
      return {
        ok: false,
        reason:
          "http_" + response.status,
        text: ""
      };
    }

    const html =
      await response.text();

    const text =
      htmlToText(html);

    if (text.length < 30) {
      return {
        ok: false,
        reason: "empty_text",
        text: ""
      };
    }

    return {
      ok: true,
      reason: "ok",
      text: text
    };

  } catch (error) {
    return {
      ok: false,

      reason:
        error &&
        error.name === "AbortError"
          ? "timeout"
          : "fetch_failed",

      text: ""
    };

  } finally {
    clearTimeout(timer);
  }
}


/* =========================================================
   DATE PARSING
========================================================= */

function findDateMatches(text, baseYear) {
  const source =
    normalizeDateText(text);

  const regex =
    /(?:(\d{4})\s*(?:년|[-./])\s*)?(\d{1,2})\s*(?:월|[-./])\s*(\d{1,2})\s*(?:일)?/g;

  const matches = [];

  let match;

  while (
    (match = regex.exec(source)) !== null
  ) {
    const year = match[1]
      ? Number(match[1])
      : Number(
          baseYear ||
          getKoreaYear()
        );

    const value = toISO(
      year,
      match[2],
      match[3]
    );

    if (!value) {
      continue;
    }

    matches.push({
      value: value,
      year: year,

      hasExplicitYear:
        Boolean(match[1]),

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


function findFirstDate(text, baseYear) {
  const dates = findDateMatches(
    text,
    baseYear
  );

  return dates.length
    ? dates[0]
    : null;
}


function hasDateRangeConnector(value) {
  return /[~∼～–—]|\b부터\b|\b까지\b|\s-\s/
    .test(
      String(value || "")
    );
}


function hasTimeRange(value) {
  const source =
    String(value || "");

  const colonRange =
    /\d{1,2}\s*:\s*\d{2}\s*[~∼～–—-]\s*\d{1,2}\s*:\s*\d{2}/;

  const koreanHourRange =
    /\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?\s*[~∼～–—-]\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?/;

  return (
    colonRange.test(source) ||
    koreanHourRange.test(source)
  );
}


function extractDateRange(text, baseYear) {
  /*
    findDateMatches와 source가 반드시
    동일하게 보정된 문자열이어야
    match.index가 어긋나지 않는다.
  */

  const source =
    normalizeDateText(text);

  const dates = findDateMatches(
    source,
    baseYear
  );

  if (dates.length >= 2) {
    for (
      let index = 0;
      index < dates.length - 1;
      index += 1
    ) {
      const first =
        dates[index];

      const second =
        dates[index + 1];

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
        end < first.value
      ) {
        end = toISO(
          first.year + 1,
          Number(
            end.slice(5, 7)
          ),
          Number(
            end.slice(8, 10)
          )
        );
      }

      return {
        start:
          first.value,

        end:
          end
      };
    }
  }

  if (dates.length >= 1) {
    const first =
      dates[0];

    const afterDate =
      source.slice(
        first.end,
        first.end + 140
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
          first.value
      };
    }
  }

  return null;
}


/* =========================================================
   PUBLISHED DATE
========================================================= */

function keywordSegments(
  source,
  keyword,
  segmentLength
) {
  const segments = [];

  let offset = 0;

  while (
    offset < source.length
  ) {
    const index =
      source.indexOf(
        keyword,
        offset
      );

    if (index === -1) {
      break;
    }

    segments.push(
      source.slice(
        index,
        index + segmentLength
      )
    );

    offset =
      index +
      keyword.length;
  }

  return segments;
}


function extractPublishedDate(
  text,
  existingDates
) {
  const source =
    normalizeDateText(text);

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
      const segment of segments
    ) {
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
  const source =
    normalizeDateText(text);

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
        300
      );

    for (
      const segment of segments
    ) {
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

      const firstDate =
        findFirstDate(
          segment,
          baseYear
        );

      if (firstDate) {
        const afterDate =
          segment.slice(
            firstDate.end,
            firstDate.end + 140
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
  text,
  publishedDate
) {
  const source =
    normalizeDateText(text);

  const baseYear =
    yearFromDate(
      publishedDate
    );

  for (
    const keyword of
    DEADLINE_KEYWORDS
  ) {
    const segments =
      keywordSegments(
        source,
        keyword,
        200
      );

    for (
      const segment of segments
    ) {
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

function getDeadlineState(deadline) {
  if (!deadline) {
    return {
      isExpired: false,

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
    item.detailFetchStatus || "";

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

  const periodEnd =
    period.end ||
    existingPeriodEnd ||
    "";

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
    item.status || "";

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
      published.value || "",

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
      period.keyword || "",

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
   JSON HELPERS
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

  if (!raw.trim()) {
    return [];
  }

  const parsed =
    JSON.parse(raw);

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


function sameArchiveItem(a, b) {
  const aId =
    getStrongId(a);

  const bId =
    getStrongId(b);

  if (
    aId &&
    bId &&
    aId === bId
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
    aUrl === bUrl
  ) {
    return true;
  }

  const aBid =
    String(
      a.bidNtceNo || ""
    ).trim();

  const bBid =
    String(
      b.bidNtceNo || ""
    ).trim();

  if (
    aBid &&
    bBid &&
    aBid === bBid
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
    aTitle === bTitle &&
    (
      !aAgency ||
      !bAgency ||
      aAgency === bAgency
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

      if (index >= 0) {
        const previous =
          archive[index];

        archive[index] = {
          ...previous,
          ...item,

          archiveFirstSeenAt:
            previous.archiveFirstSeenAt ||
            previous.dateNormalizedAt ||
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
    function (a, b) {
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

      if (aDate !== bDate) {
        return bDate.localeCompare(
          aDate
        );
      }

      return String(
        a.title || ""
      ).localeCompare(
        String(
          b.title || ""
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
    getItems(original);

  const normalized =
    [];

  /*
    공공사이트 과부하 방지를 위해
    현재 live 공고만 순차 검증한다.

    Archive의 과거 공고는 매번 다시 fetch하지 않는다.
  */

  for (
    const item of items
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
    "===================================="
  );
}


main()
  .catch(
    function (error) {
      console.error(
        "[AXOO ART DATE NORMALIZER]",
        error
      );

      process.exitCode = 1;
    }
  );
