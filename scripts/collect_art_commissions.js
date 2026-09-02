const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
  extractArtDetail,
  mergeArtDetailIntoItem
} = require("./art_detail_extractor");


/* =========================================================
   CONFIG
========================================================= */

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

const SOURCE_NAME =
  "경기도 건축물 미술작품";

const SOURCE_ID =
  "gyeonggi_public_art";

const SOURCE_MAIN_URL =
  "https://www.gg.go.kr/publicart/bbs/board.do?bsIdx=825&menuId=3865";

const FETCH_BRIDGE_URL =
  process.env.AXOO_B2G_FETCH_BRIDGE_URL ||
  "https://script.google.com/macros/s/AKfycbzu4m0lNbY5RzXFuKTR3C6H2hd_swAfLTdyZeERGqM3XrChjBrT46cWdiWTQGWSn9-4aQ/exec";

const COLLECTION_VERSION =
  "1.3.0";

const FETCH_TIMEOUT_MS =
  12000;

const LIST_BRIDGE_TIMEOUT_MS =
  15000;

const DETAIL_BRIDGE_TIMEOUT_MS =
  30000;

const DETAIL_DIRECT_FALLBACK_TIMEOUT_MS =
  8000;

const MIN_HTML_BYTES =
  1000;

const MAX_LIST_PAGES =
  4;

const LIST_LOOKBACK_DAYS =
  90;

const DETAIL_ENRICH_LOOKBACK_DAYS =
  60;

const DETAIL_TEXT_LIMIT =
  12000;

const EXCLUDE_KEYWORDS = [
  "선정결과",
  "선정 결과",
  "공모결과",
  "공모 결과",
  "결과공고",
  "결과 공고",
  "심의결과",
  "심의 결과",
  "심의위원",
  "위원 모집",
  "회의록",
  "조례",
  "행정예고",
  "신청서",
  "서식",
  "설치완료",
  "설치 완료",
  "준공",
  "확인서",
  "제출서류",
  "작성양식",
  "양식 다운로드",
  "업무 안내",
  "제도 안내"
];


/* =========================================================
   JSON
========================================================= */

function readArray(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs
    .readFileSync(filePath, "utf8")
    .trim();

  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(
      filePath +
      " 은 배열 형식이어야 합니다."
    );
  }

  return parsed;
}


function writeArray(filePath, items) {
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      items,
      null,
      2
    ) + "\n",
    "utf8"
  );
}


/* =========================================================
   TEXT
========================================================= */

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
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


function cleanText(value) {
  return decodeHtmlEntities(value)
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )
    .replace(
      /<br\s*\/?\s*>/gi,
      " "
    )
    .replace(
      /<\/p>/gi,
      " "
    )
    .replace(
      /<\/div>/gi,
      " "
    )
    .replace(
      /<\/li>/gi,
      " "
    )
    .replace(
      /<[^>]*>/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


/* =========================================================
   DATE
========================================================= */

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
        map[part.type] =
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


function normalizeIsoDate(value) {
  const text =
    String(
      value || ""
    ).trim();

  const match =
    text.match(
      /(20\d{2})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/
    );

  if (!match) {
    return "";
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return "";
  }

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
  ) {
    return "";
  }

  return [
    String(year)
      .padStart(4, "0"),

    String(month)
      .padStart(2, "0"),

    String(day)
      .padStart(2, "0")
  ].join("-");
}


function daysFromToday(value) {
  const iso =
    normalizeIsoDate(value);

  if (!iso) {
    return null;
  }

  const today =
    new Date(
      getKoreaToday() +
      "T00:00:00+09:00"
    );

  const target =
    new Date(
      iso +
      "T00:00:00+09:00"
    );

  return Math.floor(
    (
      target.getTime() -
      today.getTime()
    ) /
    86400000
  );
}


function daysSince(value) {
  const diff =
    daysFromToday(value);

  if (diff === null) {
    return null;
  }

  return -diff;
}


/* =========================================================
   URL
========================================================= */

function buildGyeonggiDetailUrl(
  bIdx
) {
  const value =
    String(
      bIdx || ""
    ).trim();

  if (
    !/^\d{1,20}$/.test(
      value
    )
  ) {
    return "";
  }

  return (
    "https://www.gg.go.kr/publicart/bbs/boardView.do" +
    "?bsIdx=825" +
    "&bIdx=" +
    encodeURIComponent(
      value
    ) +
    "&menuId=3865"
  );
}


function canonicalizeBoardUrl(
  value
) {
  try {
    const url =
      new URL(
        value,
        SOURCE_MAIN_URL
      );

    if (
      url.pathname.includes(
        "/publicart/bbs/boardView.do"
      ) &&
      url.searchParams.get(
        "bIdx"
      )
    ) {
      return buildGyeonggiDetailUrl(
        url.searchParams.get(
          "bIdx"
        )
      );
    }

    url.hash = "";

    return url.toString();

  } catch (error) {
    return "";
  }
}


function getGyeonggiBIdx(
  value
) {
  try {
    const url =
      new URL(
        value,
        SOURCE_MAIN_URL
      );

    const bIdx =
      String(
        url.searchParams.get(
          "bIdx"
        ) || ""
      ).trim();

    if (
      !/^\d{1,20}$/.test(
        bIdx
      )
    ) {
      return "";
    }

    return bIdx;

  } catch (error) {
    return "";
  }
}


function getItemUrl(item) {
  if (!item) {
    return "";
  }

  return canonicalizeBoardUrl(
    item.sourceUrl ||
    item.originalUrl ||
    item.url ||
    ""
  );
}


/* =========================================================
   FILTER
========================================================= */

function hasExcludedKeyword(
  title
) {
  const text =
    cleanText(title);

  return EXCLUDE_KEYWORDS.some(
    function (keyword) {
      return text.includes(
        keyword
      );
    }
  );
}


function isCandidateTitle(
  title
) {
  const text =
    cleanText(title);

  if (!text) {
    return false;
  }

  if (
    hasExcludedKeyword(
      text
    )
  ) {
    return false;
  }

  if (
    !text.includes(
      "미술작품"
    ) ||
    !text.includes(
      "공모"
    )
  ) {
    return false;
  }

  return [
    "공고",
    "제작",
    "설치",
    "신축",
    "공동주택"
  ].some(
    function (keyword) {
      return text.includes(
        keyword
      );
    }
  );
}


/* =========================================================
   MANAGED ITEM
========================================================= */

function isManagedGyeonggiItem(
  item
) {
  if (!item) {
    return false;
  }

  if (
    item.collectionSourceId ===
    SOURCE_ID
  ) {
    return true;
  }

  const sourceUrl =
    String(
      item.sourceUrl ||
      item.originalUrl ||
      item.url ||
      ""
    );

  return (
    item.source ===
      SOURCE_NAME &&
    sourceUrl.includes(
      "gg.go.kr/publicart"
    )
  );
}


function cleanFalsePositives(
  items
) {
  return items.filter(
    function (item) {
      if (
        !isManagedGyeonggiItem(
          item
        )
      ) {
        return true;
      }

      return isCandidateTitle(
        item.title
      );
    }
  );
}


/* =========================================================
   ID
========================================================= */

function stableId(
  sourceUrl
) {
  const hash =
    crypto
      .createHash(
        "sha1"
      )
      .update(
        sourceUrl
      )
      .digest(
        "hex"
      )
      .slice(
        0,
        16
      );

  return (
    "external-" +
    hash
  );
}


/* =========================================================
   BRIDGE CORE
========================================================= */

async function fetchBridgePayload(
  params,
  timeoutMs
) {
  const timeout =
    timeoutMs ||
    LIST_BRIDGE_TIMEOUT_MS;

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      function () {
        controller.abort();
      },
      timeout
    );

  try {
    const url =
      new URL(
        FETCH_BRIDGE_URL
      );

    Object.keys(
      params || {}
    ).forEach(
      function (key) {
        url.searchParams.set(
          key,
          String(
            params[key]
          )
        );
      }
    );

    const response =
      await fetch(
        url.toString(),
        {
          signal:
            controller.signal,

          redirect:
            "follow",

          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; AXOO-B2G-Collector/1.3)",

            "Accept":
              "application/json,text/plain,*/*"
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        "BRIDGE_HTTP_" +
        response.status
      );
    }

    const text =
      await response.text();

    let payload;

    try {
      payload =
        JSON.parse(text);

    } catch (error) {
      throw new Error(
        "BRIDGE_JSON_PARSE_FAILED: " +
        error.message
      );
    }

    if (
      !payload ||
      payload.ok !== true
    ) {
      throw new Error(
        "BRIDGE_UPSTREAM_FAILED: " +
        String(
          (
            payload &&
            (
              payload.message ||
              payload.error
            )
          ) ||
          "unknown"
        )
      );
    }

    return payload;

  } finally {
    clearTimeout(
      timer
    );
  }
}


async function fetchBridgeHtml(
  params,
  timeoutMs
) {
  const payload =
    await fetchBridgePayload(
      params,
      timeoutMs
    );

  const htmlBase64 =
    String(
      payload.htmlBase64 ||
      ""
    );

  if (!htmlBase64) {
    throw new Error(
      "BRIDGE_HTML_EMPTY"
    );
  }

  const html =
    Buffer
      .from(
        htmlBase64,
        "base64"
      )
      .toString(
        "utf8"
      );

  const bytes =
    Buffer.byteLength(
      html,
      "utf8"
    );

  if (
    bytes <
    MIN_HTML_BYTES
  ) {
    throw new Error(
      "BRIDGE_HTML_TOO_SMALL"
    );
  }

  return {
    html:
      html,

    transport:
      "apps-script-bridge",

    status:
      Number(
        payload.upstreamStatus
      ) || 0,

    finalUrl:
      payload.upstreamUrl ||
      "",

    bridgeMeta: {
      target:
        payload.target ||
        "",

      chars:
        payload.chars ||
        0,

      bytes:
        payload.bytes ||
        0,

      truncated:
        payload.truncated ===
        true,

      hasArtKeyword:
        payload.hasArtKeyword ===
        true
    }
  };
}


/* =========================================================
   GYEONGGI AJAX LIST
========================================================= */

async function fetchGyeonggiListPage(
  page
) {
  const payload =
    await fetchBridgePayload(
      {
        action:
          "fetchGyeonggiList",

        page:
          page
      },

      LIST_BRIDGE_TIMEOUT_MS
    );

  const upstreamJson =
    payload.upstreamJson ||
    {};

  const resultList =
    Array.isArray(
      upstreamJson.resultList
    )
      ? upstreamJson.resultList
      : [];

  const paginationInfo =
    payload.paginationInfo ||
    upstreamJson.paginationInfo ||
    {};

  return {
    page:
      page,

    items:
      resultList,

    paginationInfo:
      paginationInfo,

    transport:
      "apps-script-bridge-ajax",

    status:
      Number(
        payload.upstreamStatus
      ) || 0,

    target:
      payload.target ||
      "gyeonggi_list_" +
      page
  };
}


function getRawPublishedDate(
  raw
) {
  return normalizeIsoDate(
    raw &&
    (
      raw.WRITE_DATE2 ||
      raw.WRITE_DATE ||
      raw.REG_DATE ||
      raw.MOD_DATE
    )
  );
}


function getOldestPublishedDate(
  rawItems
) {
  const dates =
    rawItems
      .map(
        getRawPublishedDate
      )
      .filter(
        Boolean
      )
      .sort();

  return dates.length
    ? dates[0]
    : "";
}


async function collectRawGyeonggiList() {
  const all = [];

  const seenBIdx =
    new Set();

  let pagesFetched =
    0;

  let totalPages =
    null;

  for (
    let page = 1;
    page <= MAX_LIST_PAGES;
    page++
  ) {
    const fetched =
      await fetchGyeonggiListPage(
        page
      );

    pagesFetched += 1;

    const pageItems =
      fetched.items;

    if (
      totalPages === null &&
      Number.isFinite(
        Number(
          fetched
            .paginationInfo
            .totalPageCount
        )
      )
    ) {
      totalPages =
        Number(
          fetched
            .paginationInfo
            .totalPageCount
        );
    }

    pageItems.forEach(
      function (raw) {
        const bIdx =
          String(
            (
              raw &&
              raw.B_IDX
            ) ||
            ""
          ).trim();

        if (
          bIdx &&
          !seenBIdx.has(
            bIdx
          )
        ) {
          seenBIdx.add(
            bIdx
          );

          all.push(
            raw
          );
        }
      }
    );

    console.log(
      "[GYEONGGI LIST]",
      "page=" + page,
      "http=" +
        fetched.status,
      "items=" +
        pageItems.length,
      "totalPages=" +
        (
          totalPages ||
          "-"
        )
    );

    if (
      pageItems.length ===
      0
    ) {
      break;
    }

    if (
      totalPages !== null &&
      page >= totalPages
    ) {
      break;
    }

    const oldest =
      getOldestPublishedDate(
        pageItems
      );

    const age =
      daysSince(
        oldest
      );

    if (
      page >= 2 &&
      age !== null &&
      age >=
        LIST_LOOKBACK_DAYS
    ) {
      console.log(
        "[GYEONGGI LIST] lookback stop",
        "oldest=" +
          oldest,
        "ageDays=" +
          age
      );

      break;
    }
  }

  return {
    items:
      all,

    pagesFetched:
      pagesFetched,

    totalPages:
      totalPages,

    transport:
      "apps-script-bridge-ajax"
  };
}


/* =========================================================
   LIST ITEM NORMALIZE
========================================================= */

function buildBaseItemFromAjax(
  raw
) {
  if (
    !raw ||
    typeof raw !==
      "object"
  ) {
    return null;
  }

  const bIdx =
    String(
      raw.B_IDX ||
      raw.GNO2 ||
      ""
    ).trim();

  const title =
    cleanText(
      raw.SUBJECT ||
      ""
    );

  const addColumn =
    cleanText(
      raw.ADD_COLUMN01 ||
      ""
    );

  if (
    !/^\d{1,20}$/.test(
      bIdx
    )
  ) {
    return null;
  }

  if (
    String(
      raw.DEL_YN ||
      "N"
    ) === "Y"
  ) {
    return null;
  }

  if (
    addColumn ===
      "결과" ||
    hasExcludedKeyword(
      title
    ) ||
    !isCandidateTitle(
      title
    )
  ) {
    return null;
  }

  const sourceUrl =
    buildGyeonggiDetailUrl(
      bIdx
    );

  if (!sourceUrl) {
    return null;
  }

  const publishedDate =
    getRawPublishedDate(
      raw
    );

  const remarkHtml =
    String(
      raw.REMARK ||
      ""
    );

  const remarkText =
    cleanText(
      remarkHtml
    ).slice(
      0,
      DETAIL_TEXT_LIMIT
    );

  let item = {
    id:
      stableId(
        sourceUrl
      ),

    source:
      SOURCE_NAME,

    title:
      title,

    agency:
      "경기도",

    organization:
      "경기도",

    region:
      "경기",

    category:
      "미술작품 공모",

    status:
      "마감일 확인 필요",

    publishedDate:
      publishedDate,

    postedDate:
      publishedDate,

    periodStart:
      "",

    deadline:
      "",

    endDate:
      "",

    amount:
      "",

    amountNumeric:
      null,

    budget:
      "",

    location:
      "",

    installationLocation:
      "",

    eligibility:
      "",

    keywords: [
      "미술작품",
      "공모",
      "공고",
      "제작",
      "설치"
    ],

    recommendedAction:
      "공고 원문 확인 후 공모 요강·접수 기간·참여 자격 검토",

    sourceUrl:
      sourceUrl,

    originalUrl:
      sourceUrl,

    bidNtceNo:
      "",

    score:
      85,

    grade:
      "A",

    isExpired:
      false,

    isStaleCandidate:
      false,

    collectionSourceId:
      SOURCE_ID,

    collectionVersion:
      COLLECTION_VERSION,

    detailFetchStatus:
      "pending",

    detailFetchTransport:
      "",

    detailFetchError:
      "",

    detailHtmlBytes:
      0,

    detailTextSample:
      remarkText,

    listFetchTransport:
      "apps-script-bridge-ajax",

    listBIdx:
      bIdx,

    listRecordNo:
      raw.NO !== undefined
        ? raw.NO
        : null,

    listCategory:
      addColumn,

    listFileName:
      cleanText(
        raw.IMG_STR ||
        ""
      ),

    listRemarkExtractionStatus:
      remarkText
        ? "available"
        : "empty"
  };

  if (
    remarkHtml.trim()
  ) {
    try {
      const listDetail =
        extractArtDetail(
          remarkHtml,
          {
            sourceUrl:
              sourceUrl,

            title:
              title
          }
        );

      item =
        mergeArtDetailIntoItem(
          item,
          listDetail
        );

      item
        .listRemarkExtractionStatus =
        "ok";

    } catch (error) {
      item
        .listRemarkExtractionStatus =
        "failed";

      item
        .listRemarkExtractionError =
        String(
          error &&
          error.message
            ? error.message
            : error
        ).slice(
          0,
          500
        );
    }
  }

  item.source =
    SOURCE_NAME;

  item.region =
    "경기";

  item.category =
    "미술작품 공모";

  item.sourceUrl =
    sourceUrl;

  item.originalUrl =
    sourceUrl;

  item.collectionSourceId =
    SOURCE_ID;

  item.collectionVersion =
    COLLECTION_VERSION;

  item.publishedDate =
    publishedDate ||
    item.publishedDate ||
    "";

  item.postedDate =
    publishedDate ||
    item.postedDate ||
    "";

  item.detailTextSample =
    remarkText ||
    item.detailTextSample ||
    "";

  if (
    item.deadline &&
    item.deadline <
      getKoreaToday()
  ) {
    item.isExpired =
      true;
  }

  return item;
}


function extractAjaxCandidates(
  rawItems
) {
  const found = [];

  const seen =
    new Set();

  rawItems.forEach(
    function (raw) {
      const item =
        buildBaseItemFromAjax(
          raw
        );

      if (!item) {
        return;
      }

      const url =
        getItemUrl(
          item
        );

      if (
        !url ||
        seen.has(
          url
        )
      ) {
        return;
      }

      seen.add(
        url
      );

      found.push(
        item
      );
    }
  );

  return found;
}


/* =========================================================
   DIRECT DETAIL FETCH
========================================================= */

async function fetchTextDirect(
  url,
  timeoutMs
) {
  const timeout =
    timeoutMs ||
    FETCH_TIMEOUT_MS;

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      function () {
        controller.abort();
      },
      timeout
    );

  try {
    const response =
      await fetch(
        url,
        {
          signal:
            controller.signal,

         
