const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
  isExcludedArtNotice
} = require("./art_region_scope");


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

const COLLECTION_VERSION =
  "1.0.0";

const FETCH_TIMEOUT_MS =
  15000;


/*
 * 초기 전국 확장 단계에서는
 * 최근 공고 누락을 줄이기 위해 40페이지 확인.
 *
 * 이미 Archive에 들어온 공고는 계속 유지된다.
 */
const MAX_PAGES =
  40;


/*
 * 공모가 아닌 결과/심의/행정 문서 제외
 */
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

function readArray(filePath) {

  if (!fs.existsSync(filePath)) {
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
    JSON.parse(raw);


  if (!Array.isArray(parsed)) {

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
          parseInt(
            code,
            16
          )
        );
      }
    );
}



function cleanText(value) {

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

function makeListUrl(page) {

  return (
    LIST_BASE_URL +
    "?curPage=" +
    encodeURIComponent(page) +
    "&gosiGbn=A"
  );
}



function canonicalizeBusanUrl(value) {

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
      encodeURIComponent(sno)
    );


  } catch (error) {

    return "";
  }
}



function normalizeUrl(value) {

  return String(
    value || ""
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


  /*
   * 건축물 미술작품 공모의
   * 핵심 신호
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
   * 일반 미술 공모전과
   * 건축물 설치 공모 구분
   */

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
    function (keyword) {

      return text.includes(
        keyword
      );
    }
  );
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
    function (item) {

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


    /*
     * 전국 범위 정책의 최종 안전장치.
     * 부산 Collector에서는 정상적으로 false여야 한다.
     */

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
   FETCH
========================================================= */

async function fetchText(
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

          headers: {

            "User-Agent":
              "Mozilla/5.0 (compatible; AXOO-B2G-Busan-Collector/1.0)",

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


    return await response.text();


  } finally {

    clearTimeout(
      timer
    );
  }
}



/* =========================================================
   DISCOVER
========================================================= */

async function discoverBusanItems() {

  const discovered =
    new Map();


  let successfulPages =
    0;


  let failedPages =
    0;


  for (
    let page = 1;
    page <= MAX_PAGES;
    page++
  ) {

    const url =
      makeListUrl(
        page
      );


    try {

      const html =
        await fetchText(
          url
        );


      successfulPages++;


      const items =
        extractBoardItems(
          html
        );


      items.forEach(
        function (item) {

          discovered.set(
            item.sourceUrl,
            item
          );
        }
      );


      console.log(
        "[BUSAN]",
        "page=" + page,
        "found=" + items.length
      );


    } catch (error) {

      failedPages++;


      console.error(
        "[BUSAN PAGE FAILED]",
        page,
        error.message ||
        error
      );
    }
  }


  if (
    successfulPages === 0
  ) {

    throw new Error(
      "부산광역시 고시공고 페이지를 불러오지 못했습니다."
    );
  }


  console.log(
    "[BUSAN FETCH]",
    "successPages=" +
      successfulPages,
    "failedPages=" +
      failedPages
  );


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


  if (busan) {

    return busan;
  }


  return normalizeUrl(
    raw
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


  /*
   * 이미 마감 처리된 URL을 기억.
   * 게시판에 남아 있어도 LIVE 부활 금지.
   */

  const expiredUrls =
    new Set(

      cleanedArchive

        .filter(
          function (item) {

            return (
              item &&
              item.isExpired === true
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
    function (item) {

      if (
        !item ||
        item.isExpired === true
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
    function (item) {

      const url =
        getItemUrl(
          item
        );


      if (!url) {

        return;
      }


      /*
       * 이미 Archive에서 마감된 공고는
       * 다시 LIVE로 넣지 않는다.
       */

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


      if (previous) {

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
          item
        );
      }
    }
  );


  return [

    ...withoutUrl,

    ...Array.from(
      byUrl.values()
    )

  ].filter(
    function (item) {

      return !isExcludedArtNotice(
        item
      );
    }
  );
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
    function (item) {

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
    function (item) {

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


      if (previous) {

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
          item
        );
      }
    }
  );


  return Array.from(
    byKey.values()
  ).filter(
    function (item) {

      return !isExcludedArtNotice(
        item
      );
    }
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
    "AXOO BUSAN ART COMMISSION COLLECTOR"
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


  const discovered =
    await discoverBusanItems();


  console.log(
    "부산 공모 후보:",
    discovered.length
  );


  discovered.forEach(
    function (item) {

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



main()

  .catch(
    function (error) {

      console.error(
        "[AXOO BUSAN ART COLLECTOR]",
        error
      );


      process.exitCode =
        1;
    }
  );
