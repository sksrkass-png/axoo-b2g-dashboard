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

const DATA_FILE =
  path.join(
    process.cwd(),
    "data",
    "art_commissions.json"
  );


const ARCHIVE_FILE =
  path.join(
    process.cwd(),
    "data",
    "art_commissions_archive.json"
  );


const SOURCE_NAME =
  "경기도 건축물 미술작품";


const SOURCE_ID =
  "gyeonggi_public_art";


const SOURCE_MAIN_URL =
  "https://www.gg.go.kr/publicart/main.do";


const FETCH_BRIDGE_URL =
  process.env.AXOO_B2G_FETCH_BRIDGE_URL ||
  "https://script.google.com/macros/s/AKfycbzu4m0lNbY5RzXFuKTR3C6H2hd_swAfLTdyZeERGqM3XrChjBrT46cWdiWTQGWSn9-4aQ/exec";


const COLLECTION_VERSION =
  "1.2.0";


const FETCH_TIMEOUT_MS =
  15000;


const DETAIL_BRIDGE_TIMEOUT_MS =
  30000;


const DETAIL_DIRECT_FALLBACK_TIMEOUT_MS =
  8000;


const MIN_HTML_BYTES =
  1000;


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

function readArray(
  filePath
) {

  if (
    !fs.existsSync(
      filePath
    )
  ) {

    return [];
  }


  const raw =
    fs
      .readFileSync(
        filePath,
        "utf8"
      )
      .trim();


  if (!raw) {

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
      filePath +
      " 은 배열 형식이어야 합니다."
    );
  }


  return parsed;
}


function writeArray(
  filePath,
  items
) {

  fs.writeFileSync(
    filePath,
    JSON.stringify(
      items,
      null,
      2
    ) +
    "\n",
    "utf8"
  );
}


/* =========================================================
   TEXT
========================================================= */

function decodeHtmlEntities(
  value
) {

  return String(
    value ||
    ""
  )

    .replace(
      /&amp;/gi,
      "&"
    )

    .replace(
      /&quot;/gi,
      "\""
    )

    .replace(
      /&#39;/gi,
      "'"
    )

    .replace(
      /&lt;/gi,
      "<"
    )

    .replace(
      /&gt;/gi,
      ">"
    )

    .replace(
      /&nbsp;/gi,
      " "
    )

    .replace(
      /&#(\d+);/g,
      function (
        _,
        code
      ) {

        return String.fromCharCode(
          Number(
            code
          )
        );
      }
    )

    .replace(
      /&#x([0-9a-f]+);/gi,
      function (
        _,
        code
      ) {

        return String.fromCharCode(
          parseInt(
            code,
            16
          )
        );
      }
    );
}


function cleanText(
  value
) {

  return decodeHtmlEntities(
    value
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
   URL
========================================================= */

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

      const bIdx =
        url.searchParams.get(
          "bIdx"
        );


      return (
        "https://www.gg.go.kr/publicart/bbs/boardView.do" +
        "?bsIdx=825" +
        "&bIdx=" +
        encodeURIComponent(
          bIdx
        ) +
        "&menuId=3865"
      );
    }


    url.hash =
      "";


    return url.toString();


  } catch (
    error
  ) {

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
        ) ||
        ""
      )
        .trim();


    if (
      !/^\d{1,20}$/.test(
        bIdx
      )
    ) {

      return "";
    }


    return bIdx;


  } catch (
    error
  ) {

    return "";
  }
}


function getItemUrl(
  item
) {

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
    cleanText(
      title
    );


  return EXCLUDE_KEYWORDS.some(

    function (
      keyword
    ) {

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
    cleanText(
      title
    );


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

    function (
      keyword
    ) {

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

    function (
      item
    ) {

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
   LIST PARSER
========================================================= */

function extractBoardItems(
  html
) {

  const found =
    [];


  const seen =
    new Set();


  const anchorRegex =
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;


  let match;


  while (
    (
      match =
        anchorRegex.exec(
          html
        )
    ) !==
    null
  ) {

    const href =
      decodeHtmlEntities(
        match[1]
      );


    const title =
      cleanText(
        match[2]
      );


    const sourceUrl =
      canonicalizeBoardUrl(
        href
      );


    if (!sourceUrl) {

      continue;
    }


    if (
      !sourceUrl.includes(
        "/publicart/bbs/boardView.do"
      )
    ) {

      continue;
    }


    if (
      !sourceUrl.includes(
        "bsIdx=825"
      )
    ) {

      continue;
    }


    if (
      !isCandidateTitle(
        title
      )
    ) {

      continue;
    }


    if (
      seen.has(
        sourceUrl
      )
    ) {

      continue;
    }


    seen.add(
      sourceUrl
    );


    found.push({

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
        "",

      postedDate:
        "",

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
        0
    });
  }


  return found;
}


/* =========================================================
   DIRECT FETCH
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

          redirect:
            "follow",

          headers: {

            "User-Agent":
              "Mozilla/5.0 (compatible; AXOO-B2G-Collector/1.2)",

            "Accept":
              "text/html,application/xhtml+xml,*/*",

            "Accept-Language":
              "ko-KR,ko;q=0.9,en;q=0.7"
          }
        }
      );


    if (
      !response.ok
    ) {

      throw new Error(
        "HTTP " +
        response.status
      );
    }


    const html =
      await response.text();


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
        "HTML_TOO_SMALL"
      );
    }


    return {

      html:
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

    clearTimeout(
      timer
    );
  }
}


/* =========================================================
   FETCH BRIDGE
========================================================= */

async function fetchBridgeHtml(
  params,
  timeoutMs
) {

  const timeout =
    timeoutMs ||
    DETAIL_BRIDGE_TIMEOUT_MS;


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
      params ||
      {}
    ).forEach(

      function (
        key
      ) {

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
              "Mozilla/5.0 (compatible; AXOO-B2G-Collector/1.2)",

            "Accept":
              "application/json,text/plain,*/*"
          }
        }
      );


    if (
      !response.ok
    ) {

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
        JSON.parse(
          text
        );


    } catch (
      error
    ) {

      throw new Error(
        "BRIDGE_JSON_PARSE_FAILED: " +
        error.message
      );
    }


    if (
      !payload ||
      payload.ok !==
        true
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


    const htmlBase64 =
      String(
        payload.htmlBase64 ||
        ""
      );


    if (
      !htmlBase64
    ) {

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
        ) ||
        0,

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


  } finally {

    clearTimeout(
      timer
    );
  }
}


/* =========================================================
   MAIN FETCH
========================================================= */

async function fetchSourceMainViaBridge() {

  return fetchBridgeHtml(
    {

      action:
        "fetch",

      target:
        "gyeonggi_main"
    },

    DETAIL_BRIDGE_TIMEOUT_MS
  );
}


async function fetchSourceMainHtml() {

  try {

    return await fetchTextDirect(
      SOURCE_MAIN_URL,
      FETCH_TIMEOUT_MS
    );


  } catch (
    directError
  ) {

    console.log(
      "⚠️ 경기 MAIN direct fetch 실패 → Fetch Bridge fallback"
    );


    console.log(
      "   direct error:",
      directError.message
    );


    return fetchSourceMainViaBridge();
  }
}


/* =========================================================
   DETAIL FETCH
========================================================= */

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


  /*
    GitHub Runner에서 경기도 상세페이지 직접 접근은
    TCP Connect Timeout이 반복 확인되었다.

    따라서 상세페이지는
    Apps Script Fetch Bridge를 1순위로 사용한다.

    Bridge 장애 시에만 direct를 짧게 재시도한다.
  */

  try {

    return await fetchBridgeHtml(
      {

        action:
          "fetchGyeonggiDetail",

        bIdx:
          bIdx
      },

      DETAIL_BRIDGE_TIMEOUT_MS
    );


  } catch (
    bridgeError
  ) {

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


    } catch (
      directError
    ) {

      throw new Error(

        "DETAIL_FETCH_FAILED | bridge=" +

        bridgeError.message +

        " | direct=" +

        directError.message
      );
    }
  }
}


/* =========================================================
   DETAIL ENRICHMENT
========================================================= */

function shouldSkipDetailFetch(
  item,
  existingUrls,
  expiredArchiveUrls
) {

  const url =
    getItemUrl(
      item
    );


  if (!url) {

    return true;
  }


  return (

    expiredArchiveUrls.has(
      url
    ) &&

    !existingUrls.has(
      url
    )
  );
}


async function enrichOneDetail(
  item
) {

  const sourceUrl =
    getItemUrl(
      item
    );


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

      sourceUrl:
        sourceUrl,

      originalUrl:
        sourceUrl,

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

      collectionVersion:
        COLLECTION_VERSION
    };


  } catch (
    error
  ) {

    return {

      ...item,

      sourceUrl:
        sourceUrl,

      originalUrl:
        sourceUrl,

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

        .filter(
          Boolean
        )
    );


  const expiredArchiveUrls =
    new Set(

      archive

        .filter(

          function (
            item
          ) {

            return (
              item &&
              item.isExpired ===
                true
            );
          }
        )

        .map(
          getItemUrl
        )

        .filter(
          Boolean
        )
    );


  return Promise.all(

    discovered.map(

      async function (
        item
      ) {

        if (
          shouldSkipDetailFetch(
            item,
            existingUrls,
            expiredArchiveUrls
          )
        ) {

          return {

            ...item,

            detailFetchStatus:
              "skipped_archived",

            detailFetchTransport:
              "",

            detailFetchError:
              "",

            detailHtmlBytes:
              0
          };
        }


        return enrichOneDetail(
          item
        );
      }
    )
  );
}


/* =========================================================
   ARCHIVE CLEANUP
========================================================= */

function cleanArchive(
  archive
) {

  const cleaned =
    cleanFalsePositives(
      archive
    );


  const removed =
    archive.length -
    cleaned.length;


  if (
    removed >
    0
  ) {

    console.log(
      "[ARCHIVE CLEANUP] 오탐 제거:",
      removed
    );
  }


  return cleaned;
}


/* =========================================================
   DETAIL MERGE POLICY
========================================================= */

function hasFreshEvidence(
  item,
  field
) {

  const evidence =

    item &&

    item.detailExtractionEvidence &&

    item.detailExtractionEvidence[
      field
    ];


  return Boolean(
    evidence &&
    evidence.value
  );
}


function mergeFreshDetailFields(
  target,
  fresh
) {

  const result = {

    ...target
  };


  if (
    fresh.detailFetchStatus !==
    "ok"
  ) {

    return result;
  }


  if (
    hasFreshEvidence(
      fresh,
      "deadline"
    )
  ) {

    result.deadline =
      fresh.deadline ||
      "";


    result.endDate =
      fresh.endDate ||
      fresh.deadline ||
      "";
  }


  if (
    hasFreshEvidence(
      fresh,
      "publishedDate"
    )
  ) {

    result.publishedDate =
      fresh.publishedDate ||
      "";


    result.postedDate =
      fresh.postedDate ||
      fresh.publishedDate ||
      "";
  }


  if (
    hasFreshEvidence(
      fresh,
      "agency"
    )
  ) {

    result.agency =
      fresh.agency ||
      "";


    result.organization =
      fresh.organization ||
      fresh.agency ||
      "";
  }


  if (
    hasFreshEvidence(
      fresh,
      "amount"
    )
  ) {

    result.amount =
      fresh.amount ||
      "";


    result.amountNumeric =
      fresh.amountNumeric !==
      undefined
        ? fresh.amountNumeric
        : null;


    result.budget =
      fresh.budget ||
      fresh.amount ||
      "";
  }


  if (
    hasFreshEvidence(
      fresh,
      "location"
    )
  ) {

    result.location =
      fresh.location ||
      "";


    result.installationLocation =
      fresh.installationLocation ||
      fresh.location ||
      "";
  }


  if (
    hasFreshEvidence(
      fresh,
      "eligibility"
    )
  ) {

    result.eligibility =
      fresh.eligibility ||
      "";
  }


  result.detailExtractionStatus =
    fresh.detailExtractionStatus ||
    result.detailExtractionStatus ||
    "";


  result.detailExtractionCount =
    fresh.detailExtractionCount !==
    undefined
      ? fresh.detailExtractionCount
      : (
          result.detailExtractionCount ||
          0
        );


  result.detailExtractionVersion =
    fresh.detailExtractionVersion ||
    result.detailExtractionVersion ||
    "";


  result.detailExtractionEvidence =
    fresh.detailExtractionEvidence ||
    result.detailExtractionEvidence ||
    {};


  result.detailFetchStatus =
    fresh.detailFetchStatus;


  result.detailFetchTransport =
    fresh.detailFetchTransport ||
    "";


  result.detailFetchError =
    "";


  result.detailHtmlBytes =
    fresh.detailHtmlBytes ||
    0;


  return result;
}


/* =========================================================
   MERGE
========================================================= */

function mergeWithExisting(
  existing,
  archive,
  discovered
) {

  const expiredUrls =
    new Set(

      archive

        .filter(

          function (
            item
          ) {

            return (
              item &&
              item.isExpired ===
                true
            );
          }
        )

        .map(
          getItemUrl
        )

        .filter(
          Boolean
        )
    );


  const byUrl =
    new Map();


  const withoutUrl =
    [];


  const cleanedExisting =
    cleanFalsePositives(
      existing
    );


  cleanedExisting.forEach(

    function (
      item
    ) {

      if (
        !item ||
        item.isExpired ===
          true
      ) {

        return;
      }


      const url =
        getItemUrl(
          item
        );


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

    function (
      item
    ) {

      const url =
        getItemUrl(
          item
        );


      if (!url) {

        return;
      }


      if (
        expiredUrls.has(
          url
        ) &&

        !byUrl.has(
          url
        )
      ) {

        return;
      }


      const previous =
        byUrl.get(
          url
        );


      if (!previous) {

        byUrl.set(
          url,
          {

            ...item,

            sourceUrl:
              url,

            originalUrl:
              url,

            collectionSourceId:
              SOURCE_ID,

            collectionVersion:
              COLLECTION_VERSION
          }
        );


        return;
      }


      let combined = {

        ...item,

        ...previous,

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


      combined =
        mergeFreshDetailFields(
          combined,
          item
        );


      if (
        item.detailFetchStatus ===
        "failed"
      ) {

        combined.detailFetchStatus =
          previous.detailFetchStatus ||
          "failed";


        combined.detailFetchTransport =
          previous.detailFetchTransport ||
          "";


        combined.detailFetchError =
          item.detailFetchError ||
          previous.detailFetchError ||
          "";


        combined.detailHtmlBytes =
          previous.detailHtmlBytes ||
          0;
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

        return bDate.localeCompare(
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
}


/* =========================================================
   COLLECT
========================================================= */

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
    cleanArchive(
      originalArchive
    );


  /*
    1.
    경기도 메인 페이지 수집

    direct 실패 시 Bridge 자동 fallback.
  */

  let mainFetch =
    await fetchSourceMainHtml();


  let discoveredBase =
    extractBoardItems(
      mainFetch.html
    );


  /*
    direct 응답 자체는 성공했지만
    후보가 0건이면 차단 페이지일 가능성이 있으므로
    Bridge로 한 번 더 확인한다.
  */

  if (
    discoveredBase.length ===
      0 &&

    mainFetch.transport ===
      "direct"
  ) {

    console.log(
      "⚠️ 경기 MAIN direct 후보 0건 → Fetch Bridge 재확인"
    );


    mainFetch =
      await fetchSourceMainViaBridge();


    discoveredBase =
      extractBoardItems(
        mainFetch.html
      );
  }


  /*
    direct + Bridge 모두 확인했는데도 0건이면
    기존 JSON 보호를 위해 저장하지 않는다.
  */

  if (
    discoveredBase.length ===
    0
  ) {

    throw new Error(

      "경기도 미술작품 공모 링크를 1건도 찾지 못했습니다. " +

      "direct/Bridge 확인 후에도 0건이므로 기존 데이터를 유지하고 종료합니다."
    );
  }


  /*
    2.
    신규/활성 후보의 상세페이지 수집

    Bridge
    → Detail Extractor
    → 핵심 필드 병합
  */

  const discovered =
    await enrichDiscoveredItems(
      discoveredBase,
      existing,
      archive
    );


  /*
    3.
    기존 LIVE와 병합
  */

  const merged =
    mergeWithExisting(
      existing,
      archive,
      discovered
    );


  /*
    4.
    정상 수집 후에만 저장
  */

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

      function (
        item
      ) {

        return (
          item.detailFetchStatus ===
          "ok"
        );
      }
    ).length;


  const detailFailed =
    discovered.filter(

      function (
        item
      ) {

        return (
          item.detailFetchStatus ===
          "failed"
        );
      }
    ).length;


  const detailSkipped =
    discovered.filter(

      function (
        item
      ) {

        return (
          item.detailFetchStatus ===
          "skipped_archived"
        );
      }
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
    "MAIN transport:",
    mainFetch.transport
  );


  console.log(
    "발견:",
    discovered.length
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
    "DETAIL archive skip:",
    detailSkipped
  );


  console.log(
    "LIVE 오탐 제거:",
    originalExisting.length -
    existing.length
  );


  console.log(
    "ARCHIVE 오탐 제거:",
    originalArchive.length -
    archive.length
  );


  console.log(
    "병합 후:",
    merged.length
  );


  discovered.forEach(

    function (
      item
    ) {

      if (
        item.detailFetchStatus !==
        "ok"
      ) {

        return;
      }


      console.log(

        "📄 DETAIL",

        "| transport=" +
        item.detailFetchTransport,

        "| fields=" +
        (
          item.detailExtractionCount ||
          0
        ),

        "| deadline=" +
        (
          item.deadline ||
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


/* =========================================================
   PRUNE EXPIRED
========================================================= */

function pruneExpired() {

  const items =
    readArray(
      DATA_FILE
    );


  const cleaned =
    cleanFalsePositives(
      items
    );


  const active =
    cleaned.filter(

      function (
        item
      ) {

        return (
          item &&
          item.isExpired !==
            true
        );
      }
    );


  const removed =
    items.length -
    active.length;


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
    removed
  );


  console.log(
    "현재 활성:",
    active.length
  );


  console.log(
    "===================================="
  );
}


/* =========================================================
   RUN
========================================================= */

if (
  process.argv.includes(
    "--prune-expired"
  )
) {

  pruneExpired();


} else {

  collect()

    .catch(

      function (
        error
      ) {

        console.error(
          "[AXOO ART COMMISSION COLLECTOR]",
          error
        );


        process.exitCode =
          1;
      }
    );
}
