const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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
  "부산광역시 고시공고";

const SOURCE_ID =
  "busan_public_art";

const LIST_BASE_URL =
  "https://www.busan.go.kr/nbgosi/list";

const FETCH_BRIDGE_URL =
  process.env.AXOO_B2G_FETCH_BRIDGE_URL ||
  "https://script.google.com/macros/s/AKfycbzu4m0lNbY5RzXFuKTR3C6H2hd_swAfLTdyZeERGqM3XrChjBrT46cWdiWTQGWSn9-4aQ/exec";

const COLLECTION_VERSION =
  "1.1.0";

const MAX_PAGES =
  40;

const PAGE_CONCURRENCY =
  8;

const BRIDGE_TIMEOUT_MS =
  10000;

const DIRECT_TIMEOUT_MS =
  5000;

const MIN_HTML_BYTES =
  1000;

const MIN_SUCCESS_PAGES =
  Math.ceil(
    MAX_PAGES *
    0.75
  );

const EXCLUDE_KEYWORDS = [
  "선정결과",
  "선정 결과",
  "공모결과",
  "공모 결과",
  "결과공고",
  "결과 공고",
  "심사결과",
  "심사 결과",
  "심의결과",
  "심의 결과",
  "당선작",
  "당선 후보",
  "당선후보",
  "이의신청",
  "회의록",
  "심의위원회",
  "위원 모집",
  "설치완료",
  "설치 완료",
  "준공",
  "조례",
  "행정예고"
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

      (
        _,
        code
      ) =>
        String.fromCharCode(
          Number(
            code
          )
        )
    )

    .replace(
      /&#x([0-9a-f]+);/gi,

      (
        _,
        code
      ) =>
        String.fromCharCode(
          parseInt(
            code,
            16
          )
        )
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

function makeListUrl(
  page
) {

  return (
    LIST_BASE_URL +
    "?curPage=" +
    encodeURIComponent(
      String(
        page
      )
    ) +
    "&gosiGbn=A"
  );
}


function canonicalizeBusanUrl(
  value
) {

  try {

    const url =
      new URL(
        value,
        LIST_BASE_URL
      );


    if (
      url.hostname !==
      "www.busan.go.kr"
    ) {

      return "";
    }


    if (
      !url.pathname.includes(
        "/nbgosi/view"
      )
    ) {

      return "";
    }


    const sno =
      url.searchParams.get(
        "sno"
      );


    if (!sno) {

      return "";
    }


    return (
      "https://www.busan.go.kr/nbgosi/view" +
      "?gosiGbn=A" +
      "&sno=" +
      encodeURIComponent(
        sno
      )
    );


  } catch (
    error
  ) {

    return "";
  }
}


function normalizeUrl(
  value
) {

  return String(
    value ||
    ""
  )

    .trim()

    .replace(
      /#.*$/,
      ""
    )

    .replace(
      /\/$/,
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

    "제작",
    "설치",
    "건축물",
    "공동주택",
    "공공주택",
    "아파트",
    "신축",
    "건립"

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


function isExcludedArtNotice(
  item
) {

  if (!item) {

    return true;
  }


  const title =
    cleanText(
      item.title ||
      ""
    );


  if (!title) {

    return true;
  }


  if (
    hasExcludedKeyword(
      title
    )
  ) {

    return true;
  }


  const region =
    String(
      item.region ||
      ""
    ).trim();


  if (
    region &&
    region !==
    "부산"
  ) {

    return true;
  }


  return false;
}


/* =========================================================
   MANAGED SOURCE
========================================================= */

function isManagedBusanItem(
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
      "busan.go.kr/nbgosi/"
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

      /*
       * 다른 지역 Collector 데이터는
       * 절대 수정하지 않는다.
       */

      if (
        !isManagedBusanItem(
          item
        )
      ) {

        return true;
      }


      if (
        isExcludedArtNotice(
          item
        )
      ) {

        return false;
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
    ) !== null
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
      canonicalizeBusanUrl(
        href
      );


    if (!sourceUrl) {

      continue;
    }


    if (!title) {

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


    const item = {

      id:
        stableId(
          sourceUrl
        ),

      source:
        SOURCE_NAME,

      title:
        title,

      agency:
        "부산광역시",

      region:
        "부산",

      category:
        "미술작품 공모",

      status:
        "마감일 확인 필요",

      publishedDate:
        "",

      periodStart:
        "",

      deadline:
        "",

      budget:
        0,

      keywords: [
        "건축물",
        "미술작품",
        "공모",
        "제작",
        "설치",
        "부산"
      ],

      recommendedAction:
        "공고 원문 확인 후 공모 요강·접수 기간·참여 자격·작품비·설치조건 검토",

      sourceUrl:
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
        COLLECTION_VERSION
    };


    if (
      isExcludedArtNotice(
        item
      )
    ) {

      continue;
    }


    seen.add(
      sourceUrl
    );


    found.push(
      item
    );
  }


  return found;
}


/* =========================================================
   FETCH HELPERS
========================================================= */

async function fetchWithTimeout(
  url,
  options,
  timeoutMs
) {

  const controller =
    new AbortController();


  const timer =
    setTimeout(

      function () {

        controller.abort();

      },

      timeoutMs
    );


  try {

    return await fetch(
      url,
      {

        ...options,

        signal:
          controller.signal
      }
    );


  } finally {

    clearTimeout(
      timer
    );
  }
}


function validateBusanListHtml(
  html,
  label
) {

  const bytes =
    Buffer.byteLength(
      String(
        html ||
        ""
      ),
      "utf8"
    );


  if (
    bytes <
    MIN_HTML_BYTES
  ) {

    throw new Error(
      label +
      "_HTML_TOO_SMALL"
    );
  }


  if (
    !/\/nbgosi\/view/.test(
      html
    )
  ) {

    throw new Error(
      label +
      "_BOARD_STRUCTURE_NOT_FOUND"
    );
  }
}


/* =========================================================
   FETCH BRIDGE
========================================================= */

async function fetchBusanPageViaBridge(
  page
) {

  const bridgeUrl =
    new URL(
      FETCH_BRIDGE_URL
    );


  bridgeUrl.searchParams.set(
    "action",
    "fetchBusanList"
  );


  bridgeUrl.searchParams.set(
    "curPage",
    String(
      page
    )
  );


  const response =
    await fetchWithTimeout(

      bridgeUrl.toString(),

      {

        redirect:
          "follow",

        headers: {

          "User-Agent":
            "Mozilla/5.0 (compatible; AXOO-B2G-Busan-Collector/1.1)",

          "Accept":
            "application/json,text/plain,*/*"
        }
      },

      BRIDGE_TIMEOUT_MS
    );


  if (
    !response.ok
  ) {

    throw new Error(
      "BRIDGE_HTTP_" +
      response.status
    );
  }


  let payload;


  try {

    payload =
      JSON.parse(
        await response.text()
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


  const upstreamStatus =
    Number(
      payload.upstreamStatus
    );


  if (
    upstreamStatus <
      200 ||

    upstreamStatus >=
      400
  ) {

    throw new Error(
      "BRIDGE_UPSTREAM_HTTP_" +
      String(
        payload.upstreamStatus ||
        ""
      )
    );
  }


  if (
    payload.truncated ===
    true
  ) {

    throw new Error(
      "BRIDGE_RESPONSE_TRUNCATED"
    );
  }


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


  validateBusanListHtml(
    html,
    "BRIDGE"
  );


  return {

    page:
      page,

    html:
      html,

    transport:
      "apps-script-bridge",

    status:
      upstreamStatus,

    bytes:
      Buffer.byteLength(
        html,
        "utf8"
      )
  };
}


/* =========================================================
   DIRECT FALLBACK
========================================================= */

async function fetchBusanPageDirect(
  page
) {

  const response =
    await fetchWithTimeout(

      makeListUrl(
        page
      ),

      {

        redirect:
          "follow",

        headers: {

          "User-Agent":
            "Mozilla/5.0 (compatible; AXOO-B2G-Busan-Collector/1.1)",

          "Accept":
            "text/html,application/xhtml+xml,*/*",

          "Accept-Language":
            "ko-KR,ko;q=0.9,en;q=0.7"
        }
      },

      DIRECT_TIMEOUT_MS
    );


  if (
    !response.ok
  ) {

    throw new Error(
      "DIRECT_HTTP_" +
      response.status
    );
  }


  const html =
    await response.text();


  validateBusanListHtml(
    html,
    "DIRECT"
  );


  return {

    page:
      page,

    html:
      html,

    transport:
      "direct",

    status:
      response.status,

    bytes:
      Buffer.byteLength(
        html,
        "utf8"
      )
  };
}


async function fetchBusanPage(
  page
) {

  try {

    return await fetchBusanPageViaBridge(
      page
    );


  } catch (
    bridgeError
  ) {

    console.warn(
      "[BUSAN BRIDGE FAILED]",
      "page=" +
      page,
      bridgeError.message ||
      bridgeError
    );


    try {

      return await fetchBusanPageDirect(
        page
      );


    } catch (
      directError
    ) {

      const error =
        new Error(

          "bridge=" +
          String(
            bridgeError.message ||
            bridgeError
          ) +

          " | direct=" +
          String(
            directError.message ||
            directError
          )
        );


      error.page =
        page;


      throw error;
    }
  }
}


/* =========================================================
   CONCURRENCY
========================================================= */

async function mapWithConcurrency(
  values,
  concurrency,
  worker
) {

  const results =
    new Array(
      values.length
    );


  let nextIndex =
    0;


  async function runner() {

    while (
      true
    ) {

      const index =
        nextIndex++;


      if (
        index >=
        values.length
      ) {

        return;
      }


      try {

        results[
          index
        ] = {

          ok:
            true,

          value:
            await worker(
              values[
                index
              ]
            )
        };


      } catch (
        error
      ) {

        results[
          index
        ] = {

          ok:
            false,

          error:
            error
        };
      }
    }
  }


  const workerCount =
    Math.min(

      Math.max(
        1,
        concurrency
      ),

      values.length
    );


  await Promise.all(

    Array.from(

      {
        length:
          workerCount
      },

      function () {

        return runner();
      }
    )
  );


  return results;
}


/* =========================================================
   DISCOVER
========================================================= */

async function discoverBusanItems() {

  const discovered =
    new Map();


  const pages =
    Array.from(

      {
        length:
          MAX_PAGES
      },

      function (
        _,
        index
      ) {

        return (
          index +
          1
        );
      }
    );


  const results =
    await mapWithConcurrency(

      pages,

      PAGE_CONCURRENCY,

      fetchBusanPage
    );


  let successfulPages =
    0;


  let failedPages =
    0;


  let bridgePages =
    0;


  let directPages =
    0;


  results.forEach(

    function (
      result,
      index
    ) {

      const page =
        pages[
          index
        ];


      if (
        !result ||
        result.ok !==
        true
      ) {

        failedPages++;


        console.error(
          "[BUSAN PAGE FAILED]",
          page,

          result &&
          result.error

            ? (
                result.error.message ||
                result.error
              )

            : "unknown"
        );


        return;
      }


      successfulPages++;


      const fetched =
        result.value;


      if (
        fetched.transport ===
        "apps-script-bridge"
      ) {

        bridgePages++;


      } else if (
        fetched.transport ===
        "direct"
      ) {

        directPages++;
      }


      const items =
        extractBoardItems(
          fetched.html
        );


      items.forEach(

        function (
          item
        ) {

          discovered.set(
            item.sourceUrl,
            item
          );
        }
      );


      console.log(
        "[BUSAN]",
        "page=" +
          page,
        "transport=" +
          fetched.transport,
        "http=" +
          fetched.status,
        "bytes=" +
          fetched.bytes,
        "found=" +
          items.length
      );
    }
  );


  console.log(
    "[BUSAN FETCH]",
    "successPages=" +
      successfulPages,
    "failedPages=" +
      failedPages,
    "bridgePages=" +
      bridgePages,
    "directPages=" +
      directPages
  );


  if (
    successfulPages ===
    0
  ) {

    throw new Error(
      "부산광역시 고시공고 페이지를 하나도 불러오지 못했습니다."
    );
  }


  /*
   * 일부 페이지만 읽힌 상태를 정상 완료로 오인하지 않도록
   * 최소 75% 성공을 요구한다.
   *
   * 미달 시 파일 쓰기 전 종료하여 기존 데이터 보존.
   */

  if (
    successfulPages <
    MIN_SUCCESS_PAGES
  ) {

    throw new Error(

      "부산 페이지 수집 성공률이 안전 기준보다 낮습니다. " +

      "successPages=" +
      successfulPages +

      "/" +
      MAX_PAGES +

      " (required=" +
      MIN_SUCCESS_PAGES +

      "). 기존 데이터를 유지합니다."
    );
  }


  return Array.from(
    discovered.values()
  );
}


/* =========================================================
   ITEM URL
========================================================= */

function getItemUrl(
  item
) {

  if (!item) {

    return "";
  }


  const raw =

    item.sourceUrl ||

    item.originalUrl ||

    item.url ||

    "";


  const busan =
    canonicalizeBusanUrl(
      raw
    );


  return (
    busan ||
    normalizeUrl(
      raw
    )
  );
}


/* =========================================================
   LIVE MERGE
========================================================= */

function mergeLive(
  existing,
  archive,
  discovered
) {

  const cleanedExisting =
    cleanFalsePositives(
      existing
    );


  const cleanedArchive =
    cleanFalsePositives(
      archive
    );


  const expiredUrls =
    new Set(

      cleanedArchive

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


      if (
        url
      ) {

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


      if (
        previous
      ) {

        byUrl.set(
          url,
          {

            ...item,

            ...previous,

            title:
              item.title ||
              previous.title,

            source:
              SOURCE_NAME,

            agency:
              "부산광역시",

            region:
              "부산",

            category:
              "미술작품 공모",

            sourceUrl:
              url,

            collectionSourceId:
              SOURCE_ID,

            collectionVersion:
              COLLECTION_VERSION
          }
        );


      } else {

        byUrl.set(
          url,
          {

            ...item,

            sourceUrl:
              url,

            collectionVersion:
              COLLECTION_VERSION
          }
        );
      }
    }
  );


  return [

    ...withoutUrl,

    ...Array.from(
      byUrl.values()
    )
  ];
}


/* =========================================================
   ARCHIVE MERGE
========================================================= */

function mergeArchive(
  archive,
  discovered
) {

  const cleanedArchive =
    cleanFalsePositives(
      archive
    );


  const byKey =
    new Map();


  cleanedArchive.forEach(

    function (
      item
    ) {

      if (!item) {

        return;
      }


      const url =
        getItemUrl(
          item
        );


      const key =
        url ||
        item.id;


      if (!key) {

        return;
      }


      byKey.set(
        key,
        item
      );
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


      const key =
        url ||
        item.id;


      if (!key) {

        return;
      }


      const previous =
        byKey.get(
          key
        );


      if (
        previous
      ) {

        byKey.set(
          key,
          {

            ...item,

            ...previous,

            title:
              item.title ||
              previous.title,

            source:
              SOURCE_NAME,

            agency:
              "부산광역시",

            region:
              "부산",

            sourceUrl:
              url,

            collectionSourceId:
              SOURCE_ID,

            collectionVersion:
              COLLECTION_VERSION
          }
        );


      } else {

        byKey.set(
          key,
          {

            ...item,

            sourceUrl:
              url,

            collectionVersion:
              COLLECTION_VERSION
          }
        );
      }
    }
  );


  return Array.from(
    byKey.values()
  );
}


/* =========================================================
   MAIN
========================================================= */

async function main() {

  console.log(
    "===================================="
  );


  console.log(
    "AXOO BUSAN ART COMMISSION COLLECTOR v" +
    COLLECTION_VERSION
  );


  console.log(
    "===================================="
  );


  const existing =
    readArray(
      DATA_FILE
    );


  const archive =
    readArray(
      ARCHIVE_FILE
    );


  console.log(
    "기존 LIVE:",
    existing.length
  );


  console.log(
    "기존 ARCHIVE:",
    archive.length
  );


  /*
   * 네트워크 / 게시판 구조 검증이 모두 끝난 뒤에만
   * LIVE / ARCHIVE 파일을 쓴다.
   */

  const discovered =
    await discoverBusanItems();


  console.log(
    "부산 공모 후보:",
    discovered.length
  );


  discovered.forEach(

    function (
      item
    ) {

      console.log(
        "  +",
        item.title
      );


      console.log(
        "    ",
        item.sourceUrl
      );
    }
  );


  const nextLive =
    mergeLive(
      existing,
      archive,
      discovered
    );


  const nextArchive =
    mergeArchive(
      archive,
      discovered
    );


  writeArray(
    DATA_FILE,
    nextLive
  );


  writeArray(
    ARCHIVE_FILE,
    nextArchive
  );


  console.log(
    "------------------------------------"
  );


  console.log(
    "최종 LIVE:",
    nextLive.length
  );


  console.log(
    "최종 ARCHIVE:",
    nextArchive.length
  );


  console.log(
    "✅ 부산 수집 완료"
  );


  console.log(
    "===================================="
  );
}


/* =========================================================
   RUN
========================================================= */

main()
  .catch(

    function (
      error
    ) {

      console.error(
        "[AXOO BUSAN ART COMMISSION COLLECTOR]",
        error
      );


      process.exitCode =
        1;
    }
  );
