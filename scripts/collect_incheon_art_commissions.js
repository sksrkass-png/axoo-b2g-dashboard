const fs = require("fs");
const path = require("path");
const crypto = require("crypto");


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
  "인천광역시 건축물 미술작품 공모 공고·결과";


const SOURCE_ID =
  "incheon_city_art_commission";


const LIST_URL =
  "https://www.incheon.go.kr/culture/CU070302";


const FETCH_BRIDGE_URL =
  process.env.AXOO_B2G_FETCH_BRIDGE_URL ||
  "https://script.google.com/macros/s/AKfycbzu4m0lNbY5RzXFuKTR3C6H2hd_swAfLTdyZeERGqM3XrChjBrT46cWdiWTQGWSn9-4aQ/exec";


const COLLECTION_VERSION =
  "1.1.0";


const FETCH_TIMEOUT_MS =
  15000;


const BRIDGE_TIMEOUT_MS =
  30000;


const MIN_HTML_BYTES =
  1000;


/*
  최초 도입 시 오래된 게시물을
  전부 LIVE 후보로 되살리지 않기 위한 안전장치.

  최근 120일 내 게시물만 신규 후보로 본다.
*/

const MAX_POST_AGE_DAYS =
  120;


const EXCLUDE_KEYWORDS = [

  "선정결과",
  "선정 결과",

  "공모결과",
  "공모 결과",

  "결과공고",
  "결과 공고",

  "심의결과",
  "심의 결과",

  "심사결과",
  "심사 결과",

  "당선작",

  "회의록",

  "심의위원",

  "위원 모집",

  "신청서",

  "서식",

  "설치완료",
  "설치 완료",

  "준공",

  "조례",

  "규칙",

  "행정예고",

  "제도 안내",

  "업무 안내"
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


function cleanTitle(
  value
) {

  return cleanText(
    value
  )

    .replace(
      /^공지\s*/i,
      ""
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


  const map =
    {};


  parts.forEach(

    function (
      part
    ) {

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

  ].join(
    "-"
  );
}


function parseISODate(
  value
) {

  const match =
    String(
      value ||
      ""
    )
      .match(
        /(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/
      );


  if (!match) {

    return "";
  }


  const year =
    Number(
      match[1]
    );


  const month =
    Number(
      match[2]
    );


  const day =
    Number(
      match[3]
    );


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

    String(
      year
    ).padStart(
      4,
      "0"
    ),

    String(
      month
    ).padStart(
      2,
      "0"
    ),

    String(
      day
    ).padStart(
      2,
      "0"
    )

  ].join(
    "-"
  );
}


function daysBetween(
  fromISO,
  toISO
) {

  if (
    !fromISO ||
    !toISO
  ) {

    return null;
  }


  const from =
    Date.parse(
      fromISO +
      "T00:00:00Z"
    );


  const to =
    Date.parse(
      toISO +
      "T00:00:00Z"
    );


  if (
    !Number.isFinite(
      from
    ) ||

    !Number.isFinite(
      to
    )
  ) {

    return null;
  }


  return Math.floor(
    (
      to -
      from
    ) /
    86400000
  );
}


function isRecentEnough(
  publishedDate
) {

  if (
    !publishedDate
  ) {

    return true;
  }


  const age =
    daysBetween(
      publishedDate,
      getKoreaToday()
    );


  if (
    age ===
    null
  ) {

    return true;
  }


  return (
    age <=
    MAX_POST_AGE_DAYS
  );
}


/* =========================================================
   URL
========================================================= */

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


function canonicalizeIncheonUrl(
  value
) {

  try {

    const url =
      new URL(
        value,
        LIST_URL
      );


    if (
      url.hostname !==
        "www.incheon.go.kr" &&

      url.hostname !==
        "incheon.go.kr"
    ) {

      return "";
    }


    const match =
      url.pathname.match(
        /^\/culture\/CU070302\/(\d+)\/?$/
      );


    if (!match) {

      return "";
    }


    return (
      "https://www.incheon.go.kr/culture/CU070302/" +
      match[1]
    );


  } catch (
    error
  ) {

    return "";
  }
}


/* =========================================================
   FILTER
========================================================= */

function hasExcludedKeyword(
  title
) {

  const text =
    cleanTitle(
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
    cleanTitle(
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


  /*
    반드시 미술작품 + 공모
  */

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


  /*
    실제 건축물 미술작품 설치 공모인지
    추가 신호 확인
  */

  return [

    "제작",

    "설치",

    "건축물",

    "공동주택",

    "아파트",

    "청사",

    "신축",

    "재건축"

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

function isManagedIncheonItem(
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
      "incheon.go.kr/culture/CU070302/"
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
        인천 Collector가 관리하지 않는
        서울 / 경기 / 기타 데이터는
        절대로 건드리지 않는다.
      */

      if (
        !isManagedIncheonItem(
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

function extractPublishedDateFromRow(
  html,
  anchorStart
) {

  const rowStart =
    html.lastIndexOf(
      "<tr",
      anchorStart
    );


  if (
    rowStart <
    0
  ) {

    return "";
  }


  const rowEnd =
    html.indexOf(
      "</tr>",
      anchorStart
    );


  if (
    rowEnd <
    0
  ) {

    return "";
  }


  const rowHtml =
    html.slice(
      rowStart,
      rowEnd +
      5
    );


  const dateMatch =
    rowHtml.match(
      /20\d{2}[-./]\d{1,2}[-./]\d{1,2}/
    );


  return dateMatch
    ? parseISODate(
        dateMatch[0]
      )
    : "";
}


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


    const sourceUrl =
      canonicalizeIncheonUrl(
        href
      );


    if (!sourceUrl) {

      continue;
    }


    if (
      seen.has(
        sourceUrl
      )
    ) {

      continue;
    }


    const title =
      cleanTitle(
        match[2]
      );


    if (
      !isCandidateTitle(
        title
      )
    ) {

      continue;
    }


    const publishedDate =
      extractPublishedDateFromRow(
        html,
        match.index
      );


    /*
      과거 게시물을 최초 실행 때
      대량 LIVE 복원시키지 않는다.
    */

    if (
      !isRecentEnough(
        publishedDate
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
        "인천광역시",

      region:
        "인천",

      category:
        "미술작품 공모",

      status:
        "마감일 확인 필요",

      publishedDate:
        publishedDate,

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

        "설치"
      ],

      recommendedAction:
        "공고 원문 확인 후 공모기간·접수 방식·응모 자격·설치 금액 검토",

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
    });
  }


  return found;
}


/* =========================================================
   DIRECT FETCH
========================================================= */

async function fetchTextDirect(
  url
) {

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
        url,
        {

          signal:
            controller.signal,

          redirect:
            "follow",

          headers: {

            "User-Agent":
              "Mozilla/5.0 (compatible; AXOO-B2G-Incheon-Collector/1.1)",

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

async function fetchIncheonMainViaBridge() {

  const controller =
    new AbortController();


  const timer =
    setTimeout(

      function () {

        controller.abort();

      },

      BRIDGE_TIMEOUT_MS
    );


  try {

    const url =
      new URL(
        FETCH_BRIDGE_URL
      );


    url.searchParams.set(
      "action",
      "fetch"
    );


    url.searchParams.set(
      "target",
      "incheon_main"
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
              "Mozilla/5.0 (compatible; AXOO-B2G-Incheon-Collector/1.1)",

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


    if (
      Number(
        payload.upstreamStatus
      ) <
        200 ||

      Number(
        payload.upstreamStatus
      ) >=
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
        LIST_URL,

      bridgeMeta: {

        chars:
          Number(
            payload.chars
          ) ||
          0,

        bytes:
          Number(
            payload.bytes
          ) ||
          0,

        truncated:
          payload.truncated ===
          true,

        hasArtKeyword:
          payload.hasArtKeyword ===
          true,

        hasCompetitionKeyword:
          payload.hasCompetitionKeyword ===
          true,

        hasIncheonKeyword:
          payload.hasIncheonKeyword ===
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
   LIST FETCH WITH FALLBACK
========================================================= */

async function fetchListHtml() {

  try {

    const direct =
      await fetchTextDirect(
        LIST_URL
      );


    /*
      HTTP 성공이어도 실제 게시판 HTML이 아니라
      차단/오류 페이지일 가능성을 검사한다.
    */

    const hasBoardStructure =
      /\/culture\/CU070302\/\d+/.test(
        direct.html
      );


    if (
      hasBoardStructure
    ) {

      return direct;
    }


    console.log(
      "⚠️ 인천 direct 응답에서 게시판 구조 미검출 → Fetch Bridge fallback"
    );


  } catch (
    directError
  ) {

    console.log(
      "⚠️ 인천 MAIN direct fetch 실패 → Fetch Bridge fallback"
    );


    console.log(
      "   direct error:",
      directError.message
    );
  }


  return fetchIncheonMainViaBridge();
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


  const incheon =
    canonicalizeIncheonUrl(
      raw
    );


  if (
    incheon
  ) {

    return incheon;
  }


  return normalizeUrl(
    raw
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
      "[INCHEON ARCHIVE CLEANUP] 오탐 제거:",
      removed
    );
  }


  return cleaned;
}


/* =========================================================
   MERGE
========================================================= */

function mergeWithExisting(
  existing,
  archive,
  discovered
) {

  /*
    이미 Archive에서 마감된 공고는
    게시판에 계속 있어도
    LIVE로 복귀하지 않는다.
  */

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
              "인천광역시",

            region:
              "인천",

            category:
              "미술작품 공모",

            sourceUrl:
              url,

            publishedDate:
              previous.publishedDate ||
              item.publishedDate ||
              "",

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
    파일 저장 전 네트워크 검증부터 한다.

    direct 접속이 실패하거나
    차단 페이지가 반환되면
    Apps Script Fetch Bridge 사용.
  */

  const fetched =
    await fetchListHtml();


  const html =
    fetched.html;


  /*
    게시판 상세 URL 구조 자체를 읽었는지 검증.
  */

  const hasBoardStructure =
    /\/culture\/CU070302\/\d+/.test(
      html
    );


  if (
    !hasBoardStructure
  ) {

    throw new Error(
      "인천 건축물 미술작품 게시물 링크 구조를 읽지 못했습니다. " +
      "direct/Bridge 확인 후에도 구조가 없어 기존 데이터를 유지하고 종료합니다."
    );
  }


  const discovered =
    extractBoardItems(
      html
    );


  const merged =
    mergeWithExisting(
      existing,
      archive,
      discovered
    );


  /*
    네트워크 + 구조 검증이 끝난 뒤에만 저장한다.
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


  console.log(
    "===================================="
  );


  console.log(
    "AXOO INCHEON ART COMMISSION COLLECTOR v" +
    COLLECTION_VERSION
  );


  console.log(
    "소스:",
    SOURCE_NAME
  );


  console.log(
    "MAIN transport:",
    fetched.transport
  );


  console.log(
    "HTTP:",
    fetched.status ||
    "-"
  );


  if (
    fetched.bridgeMeta
  ) {

    console.log(
      "Bridge bytes:",
      fetched.bridgeMeta.bytes
    );


    console.log(
      "Bridge truncated:",
      fetched.bridgeMeta.truncated
    );


    console.log(
      "Bridge 미술작품:",
      fetched.bridgeMeta.hasArtKeyword
    );


    console.log(
      "Bridge 공모:",
      fetched.bridgeMeta.hasCompetitionKeyword
    );


    console.log(
      "Bridge 인천:",
      fetched.bridgeMeta.hasIncheonKeyword
    );
  }


  console.log(
    "최근 공모 후보:",
    discovered.length
  );


  console.log(
    "LIVE 인천 오탐 제거:",
    originalExisting.length -
    existing.length
  );


  console.log(
    "ARCHIVE 인천 오탐 제거:",
    originalArchive.length -
    archive.length
  );


  console.log(
    "통합 LIVE:",
    merged.length
  );


  console.log(
    "===================================="
  );
}


/* =========================================================
   RUN
========================================================= */

collect()
  .catch(

    function (
      error
    ) {

      console.error(
        "[AXOO INCHEON ART COMMISSION COLLECTOR]",
        error
      );


      process.exitCode =
        1;
    }
  );
