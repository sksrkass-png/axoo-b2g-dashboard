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
  "서울특별시 공공미술 소식";


const SOURCE_ID =
  "seoul_public_art";


const LIST_URL =
  "https://news.seoul.go.kr/culture/archives/category/design-news_c1/business_design_c1/public-art-news-n1";


const COLLECTION_VERSION =
  "1.0.0";


const FETCH_TIMEOUT_MS =
  15000;


/*
  건축물 미술작품 공모와 관계없는
  결과/프로그램/시민참여형 게시물 제외.
*/

const EXCLUDE_KEYWORDS = [

  "심의 결과",
  "심의결과",

  "심사 결과",
  "심사결과",

  "결과 알림",
  "결과알림",

  "결과 발표",
  "결과발표",

  "결과 공고",
  "결과공고",

  "선정 결과",
  "선정결과",

  "당선작",

  "시민 아이디어",
  "시민아이디어",

  "신진작가",

  "대학생",

  "워크숍",

  "참가자 모집",

  "참여자 모집",

  "공모대행제",

  "제도 안내",

  "사업 안내"
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
    ) + "\n",

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
    value || ""
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

function normalizeUrl(
  value
) {

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



function canonicalizeSeoulUrl(
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
      "news.seoul.go.kr"
    ) {

      return "";
    }


    const match =
      url.pathname.match(
        /^\/culture\/archives\/(\d+)\/?$/
      );


    if (!match) {

      return "";
    }


    return (
      "https://news.seoul.go.kr/culture/archives/" +
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


  /*
    결과공고, 시민 공공미술 사업 등
    명백한 비대상 게시물 제외.
  */

  if (
    hasExcludedKeyword(
      text
    )
  ) {

    return false;
  }


  /*
    건축물 미술작품 공모의
    핵심 두 키워드는 반드시 포함.
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
    일반 공공미술 프로젝트와
    건축물 설치 공모를 구분하기 위한
    추가 신호.
  */

  const hasBuildingCommissionSignal =
    [

      "제작",
      "설치",
      "건축물",
      "아파트",
      "공동주택",
      "공공주택",
      "신청사",
      "신축"

    ].some(
      function (
        keyword
      ) {

        return text.includes(
          keyword
        );
      }
    );


  return hasBuildingCommissionSignal;
}



/* =========================================================
   MANAGED ITEM
========================================================= */

function isManagedSeoulItem(
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
      "news.seoul.go.kr/culture/archives/"
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
        서울 자동수집기가 관리하지 않는
        경기도/기타 데이터는 절대 건드리지 않는다.
      */

      if (
        !isManagedSeoulItem(
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
   PARSER
========================================================= */

function extractLinks(
  html
) {

  const links = [];


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


    const sourceUrl =
      canonicalizeSeoulUrl(
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
      cleanText(
        match[2]
      );


    if (!title) {

      continue;
    }


    seen.add(
      sourceUrl
    );


    links.push({
      sourceUrl:
        sourceUrl,

      title:
        title
    });
  }


  return links;
}



function extractCommissionItems(
  html
) {

  const allLinks =
    extractLinks(
      html
    );


  const candidates =
    allLinks
      .filter(
        function (
          item
        ) {

          return isCandidateTitle(
            item.title
          );
        }
      )

      .map(
        function (
          item
        ) {

          return {

            id:
              stableId(
                item.sourceUrl
              ),

            source:
              SOURCE_NAME,

            title:
              item.title,

            agency:
              "서울특별시",

            region:
              "서울",

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
              "설치"
            ],

            recommendedAction:
              "공고 원문 확인 후 공모 요강·제출 기한·응모 자격·설치 금액 검토",

            sourceUrl:
              item.sourceUrl,

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
        }
      );


  return {
    articleLinkCount:
      allLinks.length,

    candidates:
      candidates
  };
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
              "Mozilla/5.0 (compatible; AXOO-B2G-Seoul-Collector/1.0)",

            "Accept":
              "text/html,application/xhtml+xml,*/*"
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


  const seoul =
    canonicalizeSeoulUrl(
      raw
    );


  if (seoul) {

    return seoul;
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
    removed > 0
  ) {

    console.log(
      "[SEOUL ARCHIVE CLEANUP] 오탐 제거:",
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
    이미 Archive에서 마감으로 확인된 공고는
    게시판에 계속 남아 있어도
    live로 다시 복귀시키지 않는다.
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


  /*
    기존 데이터 보존.
    서울 자동수집 오탐만 먼저 청소.
  */

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


  /*
    이번 서울시 게시판에서
    발견된 공모 병합.
  */

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
              "서울특별시",

            region:
              "서울",

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
              url
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
    이전 서울 수집 버전에서
    오탐이 생긴 경우 Archive도 청소.
  */

  if (
    archive.length !==
    originalArchive.length
  ) {

    writeArray(
      ARCHIVE_FILE,
      archive
    );
  }


  const html =
    await fetchText(
      LIST_URL
    );


  const parsed =
    extractCommissionItems(
      html
    );


  /*
    사이트 구조 자체를 읽지 못한 경우만 실패.

    공모 후보가 0건인 것은 정상일 수 있다.
    즉 "오늘 새 건축물 미술작품 공모 없음"은
    오류가 아니다.
  */

  if (
    parsed.articleLinkCount ===
    0
  ) {

    throw new Error(
      "서울시 공공미술 게시물 링크를 읽지 못했습니다. " +
      "사이트 구조 변경 가능성이 있어 기존 데이터를 유지하고 종료합니다."
    );
  }


  const merged =
    mergeWithExisting(
      existing,
      archive,
      parsed.candidates
    );


  writeArray(
    DATA_FILE,
    merged
  );


  console.log(
    "===================================="
  );


  console.log(
    "AXOO SEOUL ART COMMISSION COLLECTOR v" +
    COLLECTION_VERSION
  );


  console.log(
    "소스:",
    SOURCE_NAME
  );


  console.log(
    "게시물 링크:",
    parsed.articleLinkCount
  );


  console.log(
    "공모 후보:",
    parsed.candidates.length
  );


  console.log(
    "LIVE 서울 오탐 제거:",
    originalExisting.length -
    existing.length
  );


  console.log(
    "ARCHIVE 서울 오탐 제거:",
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
        "[AXOO SEOUL ART COMMISSION COLLECTOR]",
        error
      );


      process.exitCode =
        1;
    }
  );
