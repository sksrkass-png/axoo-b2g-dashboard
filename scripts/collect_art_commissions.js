const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { extractArtDetail, mergeArtDetailIntoItem } = require("./art_detail_extractor");

const DATA_FILE = path.join(process.cwd(), "data", "art_commissions.json");
const ARCHIVE_FILE = path.join(process.cwd(), "data", "art_commissions_archive.json");
const SOURCE_NAME = "경기도 건축물 미술작품";
const SOURCE_ID = "gyeonggi_public_art";
const SOURCE_MAIN_URL = "https://www.gg.go.kr/publicart/bbs/board.do?bsIdx=825&menuId=3865";
const FETCH_BRIDGE_URL = process.env.AXOO_B2G_FETCH_BRIDGE_URL || "https://script.google.com/macros/s/AKfycbzu4m0lNbY5RzXFuKTR3C6H2hd_swAfLTdyZeERGqM3XrChjBrT46cWdiWTQGWSn9-4aQ/exec";
const COLLECTION_VERSION = "1.3.1";
const LIST_BRIDGE_TIMEOUT_MS = 15000;
const DETAIL_BRIDGE_TIMEOUT_MS = 30000;
const DETAIL_DIRECT_FALLBACK_TIMEOUT_MS = 8000;
const MIN_HTML_BYTES = 1000;
const MAX_LIST_PAGES = 4;
const LIST_LOOKBACK_DAYS = 90;
const DETAIL_ENRICH_LOOKBACK_DAYS = 60;
const DETAIL_TEXT_LIMIT = 12000;

const EXCLUDE_KEYWORDS = [
  "선정결과", "선정 결과", "공모결과", "공모 결과", "결과공고", "결과 공고",
  "심의결과", "심의 결과", "심의위원", "위원 모집", "회의록", "조례", "행정예고",
  "신청서", "서식", "설치완료", "설치 완료", "준공", "확인서", "제출서류",
  "작성양식", "양식 다운로드", "업무 안내", "제도 안내"
];

function readArray(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const raw = fs
    .readFileSync(filePath, "utf8")
    .trim();

  if (!raw) return [];

  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(filePath + " 은 배열 형식이어야 합니다.");
  }

  return parsed;
}

function writeArray(filePath, items) {
  fs.writeFileSync(
    filePath,
    JSON.stringify(items, null, 2) + "\n",
    "utf8"
  );
}

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
      (_, code) => String.fromCharCode(Number(code))
    )
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, code) => String.fromCharCode(parseInt(code, 16))
    );
}

function cleanText(value) {
  return decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<\/(p|div|li|td|tr|th)>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

  parts.forEach(part => {
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

function normalizeIsoDate(value) {
  const match = String(value || "")
    .trim()
    .match(
      /(20\d{2})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/
    );

  if (!match) return "";

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);

  if (
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31
  ) {
    return "";
  }

  const date = new Date(
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

function daysFromToday(value) {
  const iso = normalizeIsoDate(value);

  if (!iso) return null;

  const today = new Date(
    getKoreaToday() +
    "T00:00:00+09:00"
  );

  const target = new Date(
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
  const diff = daysFromToday(value);

  return diff === null
    ? null
    : -diff;
}

function buildGyeonggiDetailUrl(bIdx) {
  const value = String(
    bIdx || ""
  ).trim();

  if (!/^\d{1,20}$/.test(value)) {
    return "";
  }

  return (
    "https://www.gg.go.kr/publicart/bbs/boardView.do" +
    "?bsIdx=825" +
    "&bIdx=" +
    encodeURIComponent(value) +
    "&menuId=3865"
  );
}

function canonicalizeBoardUrl(value) {
  try {
    const url = new URL(
      value,
      SOURCE_MAIN_URL
    );

    if (
      url.pathname.includes(
        "/publicart/bbs/boardView.do"
      ) &&
      url.searchParams.get("bIdx")
    ) {
      return buildGyeonggiDetailUrl(
        url.searchParams.get("bIdx")
      );
    }

    url.hash = "";

    return url.toString();

  } catch (_) {
    return "";
  }
}

function getGyeonggiBIdx(value) {
  try {
    const url = new URL(
      value,
      SOURCE_MAIN_URL
    );

    const bIdx = String(
      url.searchParams.get("bIdx") ||
      ""
    ).trim();

    return /^\d{1,20}$/.test(bIdx)
      ? bIdx
      : "";

  } catch (_) {
    return "";
  }
}

function getItemUrl(item) {
  if (!item) return "";

  return canonicalizeBoardUrl(
    item.sourceUrl ||
    item.originalUrl ||
    item.url ||
    ""
  );
}

function hasExcludedKeyword(title) {
  const text = cleanText(title);

  return EXCLUDE_KEYWORDS.some(
    keyword =>
      text.includes(keyword)
  );
}

function isCandidateTitle(title) {
  const text = cleanText(title);

  if (
    !text ||
    hasExcludedKeyword(text)
  ) {
    return false;
  }

  if (
    !text.includes("미술작품") ||
    !text.includes("공모")
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
    keyword =>
      text.includes(keyword)
  );
}

function isManagedGyeonggiItem(item) {
  if (!item) return false;

  if (
    item.collectionSourceId ===
    SOURCE_ID
  ) {
    return true;
  }

  const sourceUrl = String(
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

function cleanFalsePositives(items) {
  return items.filter(
    item =>
      !isManagedGyeonggiItem(item) ||
      isCandidateTitle(item.title)
  );
}

function stableId(sourceUrl) {
  return (
    "external-" +
    crypto
      .createHash("sha1")
      .update(sourceUrl)
      .digest("hex")
      .slice(0, 16)
  );
}

async function fetchBridgePayload(
  params,
  timeoutMs
) {
  const controller =
    new AbortController();

  const timer = setTimeout(
    () =>
      controller.abort(),
    timeoutMs ||
      LIST_BRIDGE_TIMEOUT_MS
  );

  try {
    const url = new URL(
      FETCH_BRIDGE_URL
    );

    Object
      .keys(params || {})
      .forEach(
        key =>
          url.searchParams.set(
            key,
            String(params[key])
          )
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
              "Mozilla/5.0 (compatible; AXOO-B2G-Collector/1.3.1)",

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
    clearTimeout(timer);
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
      .toString("utf8");

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
    html,

    transport:
      "apps-script-bridge",

    status:
      Number(
        payload.upstreamStatus
      ) || 0,

    finalUrl:
      payload.upstreamUrl ||
      ""
  };
}

async function fetchGyeonggiListPage(
  page
) {
  const payload =
    await fetchBridgePayload(
      {
        action:
          "fetchGyeonggiList",

        page
      },

      LIST_BRIDGE_TIMEOUT_MS
    );

  const upstreamJson =
    payload.upstreamJson ||
    {};

  return {
    page,

    items:
      Array.isArray(
        upstreamJson.resultList
      )
        ? upstreamJson.resultList
        : [],

    paginationInfo:
      payload.paginationInfo ||
      upstreamJson.paginationInfo ||
      {},

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

function getRawPublishedDate(raw) {
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
      .filter(Boolean)
      .sort();

  return dates.length
    ? dates[0]
    : "";
}

async function collectRawGyeonggiList() {
  const all = [];

  const seenBIdx =
    new Set();

  let pagesFetched = 0;
  let totalPages = null;

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

    const parsedTotalPages =
      Number(
        fetched
          .paginationInfo
          .totalPageCount
      );

    if (
      totalPages === null &&
      Number.isFinite(
        parsedTotalPages
      ) &&
      parsedTotalPages > 0
    ) {
      totalPages =
        parsedTotalPages;
    }

    pageItems.forEach(
      raw => {
        const bIdx =
          String(
            (
              raw &&
              (
                raw.B_IDX ||
                raw.GNO2
              )
            ) ||
            ""
          ).trim();

        if (
          bIdx &&
          !seenBIdx.has(bIdx)
        ) {
          seenBIdx.add(bIdx);

          all.push(raw);
        }
      }
    );

    console.log(
      "[GYEONGGI LIST]",
      "page=" + page,
      "http=" + fetched.status,
      "items=" + pageItems.length,
      "totalPages=" +
        (
          totalPages ||
          "-"
        )
    );

    if (
      pageItems.length === 0
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
      daysSince(oldest);

    if (
      page >= 2 &&
      age !== null &&
      age >=
        LIST_LOOKBACK_DAYS
    ) {
      console.log(
        "[GYEONGGI LIST] lookback stop",
        "oldest=" + oldest,
        "ageDays=" + age
      );

      break;
    }
  }

  return {
    items: all,

    pagesFetched,

    totalPages,

    transport:
      "apps-script-bridge-ajax"
  };
}

function buildBaseItemFromAjax(raw) {
  if (
    !raw ||
    typeof raw !== "object"
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

  const listCategory =
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
    listCategory ===
      "결과" ||
    hasExcludedKeyword(title) ||
    !isCandidateTitle(title)
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
    getRawPublishedDate(raw);

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

    listCategory,

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
      const detail =
        extractArtDetail(
          remarkHtml,
          {
            sourceUrl,
            title
          }
        );

      item =
        mergeArtDetailIntoItem(
          item,
          detail
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
    raw => {
      const item =
        buildBaseItemFromAjax(
          raw
        );

      if (!item) {
        return;
      }

      const url =
        getItemUrl(item);

      if (
        !url ||
        seen.has(url)
      ) {
        return;
      }

      seen.add(url);

      found.push(item);
    }
  );

  return found;
}

async function fetchTextDirect(
  url,
  timeoutMs
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),

      timeoutMs ||
      DETAIL_DIRECT_FALLBACK_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        url,
        {
          signal:
            controller.signal,

          redirect:
            "follow",

          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; AXOO-B2G-Collector/1.3.1)",

            "Accept":
              "text/html,application/xhtml+xml,*/*",

            "Accept-Language":
              "ko-KR,ko;q=0.9,en;q=0.7"
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        "HTTP " +
        response.status
      );
    }

    const html =
      await response.text();

    if (
      Buffer.byteLength(
        html,
        "utf8"
      ) <
      MIN_HTML_BYTES
    ) {
      throw new Error(
        "HTML_TOO_SMALL"
      );
    }

    return {
      html,

      transport:
        "direct",

      status:
        response.status,

      finalUrl:
        response.url ||
        url
    };

  } finally {
    clearTimeout(timer);
  }
}

async function fetchGyeonggiDetailHtml(
  sourceUrl
) {
  const bIdx =
    getGyeonggiBIdx(
      sourceUrl
    );

  if (!bIdx) {
    throw new Error(
      "BIDX_NOT_FOUND"
    );
  }

  try {
    return await fetchBridgeHtml(
      {
        action:
          "fetchGyeonggiDetail",

        bIdx
      },

      DETAIL_BRIDGE_TIMEOUT_MS
    );

  } catch (bridgeError) {
    console.log(
      "⚠️ 경기 DETAIL Bridge 실패 → direct fallback | bIdx=" +
      bIdx
    );

    console.log(
      "   bridge error:",
      bridgeError.message
    );

    try {
      return await fetchTextDirect(
        sourceUrl,
        DETAIL_DIRECT_FALLBACK_TIMEOUT_MS
      );

    } catch (directError) {
      throw new Error(
        "DETAIL_FETCH_FAILED | bridge=" +
        bridgeError.message +
        " | direct=" +
        directError.message
      );
    }
  }
}

function shouldFetchFreshDetail(
  item
) {
  const age =
    daysSince(
      item.publishedDate ||
      item.postedDate
    );

  return (
    age === null ||
    age <=
      DETAIL_ENRICH_LOOKBACK_DAYS
  );
}

async function enrichOneDetail(item) {
  const sourceUrl =
    getItemUrl(item);

  try {
    const fetched =
      await fetchGyeonggiDetailHtml(
        sourceUrl
      );

    const detail =
      extractArtDetail(
        fetched.html,
        {
          sourceUrl:
            fetched.finalUrl ||
            sourceUrl,

          title:
            item.title
        }
      );

    const merged =
      mergeArtDetailIntoItem(
        item,
        detail
      );

    return {
      ...merged,

      source:
        SOURCE_NAME,

      region:
        "경기",

      category:
        "미술작품 공모",

      sourceUrl,

      originalUrl:
        sourceUrl,

      collectionSourceId:
        SOURCE_ID,

      collectionVersion:
        COLLECTION_VERSION,

      publishedDate:
        item.publishedDate ||
        merged.publishedDate ||
        "",

      postedDate:
        item.postedDate ||
        merged.postedDate ||
        item.publishedDate ||
        "",

      detailFetchStatus:
        "ok",

      detailFetchTransport:
        fetched.transport,

      detailFetchError:
        "",

      detailHtmlBytes:
        Buffer.byteLength(
          fetched.html,
          "utf8"
        ),

      detailTextSample:
        cleanText(
          fetched.html
        ).slice(
          0,
          DETAIL_TEXT_LIMIT
        ) ||
        item.detailTextSample ||
        ""
    };

  } catch (error) {
    return {
      ...item,

      detailFetchStatus:
        "failed",

      detailFetchTransport:
        "",

      detailFetchError:
        String(
          error &&
          error.message
            ? error.message
            : error
        ).slice(
          0,
          1000
        ),

      detailHtmlBytes:
        0,

      collectionVersion:
        COLLECTION_VERSION
    };
  }
}

async function enrichDiscoveredItems(
  discovered,
  existing,
  archive
) {
  const existingUrls =
    new Set(
      existing
        .map(
          getItemUrl
        )
        .filter(Boolean)
    );

  const expiredArchiveUrls =
    new Set(
      archive
        .filter(
          item =>
            item &&
            item.isExpired ===
              true
        )
        .map(
          getItemUrl
        )
        .filter(Boolean)
    );

  const output = [];

  for (
    const item of discovered
  ) {
    const url =
      getItemUrl(item);

    if (
      expiredArchiveUrls.has(
        url
      ) &&
      !existingUrls.has(url)
    ) {
      output.push({
        ...item,

        detailFetchStatus:
          "skipped_archived",

        detailFetchTransport:
          "",

        detailFetchError:
          "",

        detailHtmlBytes:
          0
      });

      continue;
    }

    if (
      !shouldFetchFreshDetail(
        item
      )
    ) {
      output.push({
        ...item,

        detailFetchStatus:
          "skipped_old",

        collectionVersion:
          COLLECTION_VERSION
      });

      continue;
    }

    output.push(
      await enrichOneDetail(
        item
      )
    );
  }

  return output;
}

function mergeWithExisting(
  existing,
  archive,
  discovered
) {
  const expiredUrls =
    new Set(
      archive
        .filter(
          item =>
            item &&
            item.isExpired ===
              true
        )
        .map(
          getItemUrl
        )
        .filter(Boolean)
    );

  const byUrl =
    new Map();

  const withoutUrl =
    [];

  cleanFalsePositives(
    existing
  ).forEach(
    item => {
      if (
        !item ||
        item.isExpired === true
      ) {
        return;
      }

      const url =
        getItemUrl(item);

      if (url) {
        byUrl.set(
          url,
          item
        );

      } else if (
        item.id
      ) {
        withoutUrl.push(
          item
        );
      }
    }
  );

  discovered.forEach(
    item => {
      const url =
        getItemUrl(item);

      if (
        !url ||
        item.isExpired === true
      ) {
        return;
      }

      if (
        expiredUrls.has(url) &&
        !byUrl.has(url)
      ) {
        return;
      }

      const previous =
        byUrl.get(url) ||
        {};

      const combined = {
        ...previous,
        ...item,

        title:
          item.title ||
          previous.title,

        source:
          SOURCE_NAME,

        region:
          "경기",

        category:
          "미술작품 공모",

        sourceUrl:
          url,

        originalUrl:
          url,

        collectionSourceId:
          SOURCE_ID,

        collectionVersion:
          COLLECTION_VERSION
      };

      if (
        item.detailFetchStatus ===
          "failed" &&
        previous.detailFetchStatus
      ) {
        combined.detailFetchStatus =
          previous.detailFetchStatus;

        combined.detailFetchTransport =
          previous.detailFetchTransport ||
          "";

        combined.detailHtmlBytes =
          previous.detailHtmlBytes ||
          0;

        combined.detailFetchError =
          item.detailFetchError ||
          previous.detailFetchError ||
          "";
      }

      byUrl.set(
        url,
        combined
      );
    }
  );

  return [
    ...byUrl.values(),
    ...withoutUrl
  ].sort(
    (a, b) => {
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
        aDate !== bDate
      ) {
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
}

async function collect() {
  const originalExisting =
    readArray(
      DATA_FILE
    );

  const originalArchive =
    readArray(
      ARCHIVE_FILE
    );

  const existing =
    cleanFalsePositives(
      originalExisting
    );

  const archive =
    cleanFalsePositives(
      originalArchive
    );

  const rawList =
    await collectRawGyeonggiList();

  const discoveredBase =
    extractAjaxCandidates(
      rawList.items
    );

  if (
    discoveredBase.length === 0
  ) {
    throw new Error(
      "경기도 AJAX 목록에서 미술작품 공모 후보를 1건도 찾지 못했습니다. 기존 데이터를 유지합니다."
    );
  }

  const discovered =
    await enrichDiscoveredItems(
      discoveredBase,
      existing,
      archive
    );

  const merged =
    mergeWithExisting(
      existing,
      archive,
      discovered
    );

  writeArray(
    DATA_FILE,
    merged
  );

  if (
    archive.length !==
    originalArchive.length
  ) {
    writeArray(
      ARCHIVE_FILE,
      archive
    );
  }

  const detailOk =
    discovered.filter(
      item =>
        item.detailFetchStatus ===
        "ok"
    ).length;

  const detailFailed =
    discovered.filter(
      item =>
        item.detailFetchStatus ===
        "failed"
    ).length;

  const detailSkipped =
    discovered.filter(
      item =>
        [
          "skipped_archived",
          "skipped_old"
        ].includes(
          item.detailFetchStatus
        )
    ).length;

  console.log(
    "===================================="
  );

  console.log(
    "AXOO ART COMMISSION COLLECTOR v" +
    COLLECTION_VERSION
  );

  console.log(
    "소스:",
    SOURCE_NAME
  );

  console.log(
    "LIST transport:",
    rawList.transport
  );

  console.log(
    "LIST pages:",
    rawList.pagesFetched
  );

  console.log(
    "LIST raw:",
    rawList.items.length
  );

  console.log(
    "후보:",
    discoveredBase.length
  );

  console.log(
    "DETAIL 성공:",
    detailOk
  );

  console.log(
    "DETAIL 실패:",
    detailFailed
  );

  console.log(
    "DETAIL skip:",
    detailSkipped
  );

  console.log(
    "병합 후:",
    merged.length
  );

  discovered.forEach(
    item => {
      if (
        item.detailFetchStatus !==
          "ok" &&
        item
          .listRemarkExtractionStatus !==
          "ok"
      ) {
        return;
      }

      console.log(
        "📄 ITEM",

        "| detail=" +
        item.detailFetchStatus,

        "| deadline=" +
        (
          item.deadline ||
          "-"
        ),

        "| published=" +
        (
          item.publishedDate ||
          "-"
        ),

        "| title=" +
        item.title
      );
    }
  );

  console.log(
    "===================================="
  );
}

function pruneExpired() {
  const items =
    readArray(
      DATA_FILE
    );

  const today =
    getKoreaToday();

  const active =
    cleanFalsePositives(
      items
    ).filter(
      item => {
        if (
          !item ||
          item.isExpired === true
        ) {
          return false;
        }

        const deadline =
          normalizeIsoDate(
            item.deadline ||
            item.endDate ||
            ""
          );

        return !(
          deadline &&
          deadline < today
        );
      }
    );

  writeArray(
    DATA_FILE,
    active
  );

  console.log(
    "===================================="
  );

  console.log(
    "AXOO ART COMMISSION PRUNE"
  );

  console.log(
    "마감 / 오탐 제거:",
    items.length -
    active.length
  );

  console.log(
    "현재 활성:",
    active.length
  );

  console.log(
    "===================================="
  );
}

if (
  process.argv.includes(
    "--prune-expired"
  )
) {
  pruneExpired();

} else {
  collect()
    .catch(
      error => {
        console.error(
          "[AXOO ART COMMISSION COLLECTOR]",
          error
        );

        process.exitCode =
          1;
      }
    );
}
