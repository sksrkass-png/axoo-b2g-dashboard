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
  "경기도 건축물 미술작품";

const SOURCE_ID =
  "gyeonggi_public_art";

const SOURCE_MAIN_URL =
  "https://www.gg.go.kr/publicart/main.do";

const COLLECTION_VERSION =
  "1.1.0";

const FETCH_TIMEOUT_MS =
  15000;


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

function canonicalizeBoardUrl(value) {

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
      url.searchParams.get("bIdx")
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


    url.hash = "";

    return url.toString();

  } catch (error) {

    return "";
  }
}


/* =========================================================
   TITLE FILTER
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
    hasExcludedKeyword(text)
  ) {
    return false;
  }


  /*
    반드시:
    미술작품 + 공모
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
    실제 공모 게시물 신호
  */

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

      /*
        다른 지역 데이터는
        절대 건드리지 않는다.
      */

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
   HTML PARSER
========================================================= */

function extractBoardItems(
  html
) {

  const found = [];

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

      region:
        "경기",

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
              "Mozilla/5.0 (compatible; AXOO-B2G-Collector/1.1)",

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


  return canonicalizeBoardUrl(
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
      "[ARCHIVE CLEANUP] 오탐 제거:",
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
    Archive에서 이미 마감된 공고는
    게시판에 남아 있어도 LIVE 복귀 금지.
  */

  const expiredUrls =
    new Set(

      archive

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


  const cleanedExisting =
    cleanFalsePositives(
      existing
    );


  /*
    현재 살아 있는 모든 지역 데이터 보존.
  */

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


  /*
    신규 경기도 공고 병합.
  */

  discovered.forEach(
    function (item) {

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
              "경기도",

            region:
              "경기",

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
    여기서는 아직 파일을 저장하지 않는다.

    공식 사이트 연결 자체가 실패하면
    기존 JSON을 그대로 유지하기 위함.
  */


  const html =
    await fetchText(
      SOURCE_MAIN_URL
    );


  const discovered =
    extractBoardItems(
      html
    );


  /*
    경기도 게시판은 현재 정상 공모가
    실제로 존재하므로 0건은 구조 변경으로 본다.
  */

  if (
    discovered.length === 0
  ) {

    throw new Error(
      "경기도 미술작품 공모 링크를 1건도 찾지 못했습니다. " +
      "사이트 구조 변경 가능성이 있어 기존 데이터를 유지하고 종료합니다."
    );
  }


  const merged =
    mergeWithExisting(
      existing,
      archive,
      discovered
    );


  /*
    정상 수집 성공 후에만 저장.
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
    "AXOO ART COMMISSION COLLECTOR v" +
    COLLECTION_VERSION
  );


  console.log(
    "소스:",
    SOURCE_NAME
  );


  console.log(
    "발견:",
    discovered.length
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


  /*
    경기도 오탐 청소 후,
    지역과 관계없이 isExpired=true 제거.

    서울/인천의 마감 공고도
    동일하게 LIVE에서 제거된다.
  */

  const cleaned =
    cleanFalsePositives(
      items
    );


  const active =
    cleaned.filter(
      function (item) {

        return (
          item &&
          item.isExpired !== true
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
      function (error) {

        console.error(
          "[AXOO ART COMMISSION COLLECTOR]",
          error
        );

        process.exitCode =
          1;
      }
    );
}
