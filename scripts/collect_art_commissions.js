const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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

const SOURCE_MAIN_URL =
  "https://www.gg.go.kr/publicart/main.do";

const COLLECTION_VERSION =
  "1.0.0";

const FETCH_TIMEOUT_MS =
  15000;


const EXCLUDE_KEYWORDS = [
  "선정결과",
  "선정 결과",
  "공모결과",
  "공모 결과",
  "결과 공고",
  "심의 결과",
  "심의위원",
  "회의록",
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
    );
}


function cleanText(
  value
) {

  return decodeHtmlEntities(
    value
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


/* =========================================================
   TITLE FILTER
========================================================= */

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
    EXCLUDE_KEYWORDS.some(
      function (
        keyword
      ) {

        return text.includes(
          keyword
        );
      }
    )
  ) {

    return false;
  }


  const hasArt =
    text.includes(
      "미술작품"
    );


  const hasCommissionWord =
    (
      text.includes(
        "공모"
      ) ||

      text.includes(
        "제작"
      ) ||

      text.includes(
        "설치"
      )
    );


  return (
    hasArt &&
    hasCommissionWord
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
        "gyeonggi_public_art",

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
              "Mozilla/5.0 (compatible; AXOO-B2G-Collector/1.0)",

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

  return canonicalizeBoardUrl(
    item &&
    (
      item.sourceUrl ||
      item.originalUrl ||
      item.url ||
      ""
    )
  );
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
    이미 Archive에서 마감 처리된 공고는
    홈페이지에 남아 있어도 다시 live로 복귀시키지 않는다.
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
    현재 live 데이터 중
    아직 마감되지 않은 항목은 보존.
  */

  existing.forEach(
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
          {
            ...item,
            sourceUrl:
              url
          }
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
    신규 발견 공고 병합.
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


      /*
        이미 과거 Archive에서
        마감으로 확정된 URL이면
        다시 live에 넣지 않는다.
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
              "경기도",

            region:
              "경기",

            category:
              "미술작품 공모",

            sourceUrl:
              url,

            collectionSourceId:
              "gyeonggi_public_art",

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
      )
        .localeCompare(
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

  const existing =
    readArray(
      DATA_FILE
    );


  const archive =
    readArray(
      ARCHIVE_FILE
    );


  const html =
    await fetchText(
      SOURCE_MAIN_URL
    );


  const discovered =
    extractBoardItems(
      html
    );


  /*
    안전장치:
    사이트 구조 변경으로 링크를 못 읽으면
    기존 JSON을 비우지 않고 실패 처리.
  */

  if (
    discovered.length ===
    0
  ) {

    throw new Error(
      "경기도 공모공고 링크를 1건도 찾지 못했습니다. " +
      "사이트 구조 변경 가능성이 있어 기존 데이터를 유지하고 종료합니다."
    );
  }


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
    "기존 활성:",
    existing.filter(
      function (
        item
      ) {

        return (
          item &&
          item.isExpired !==
          true
        );
      }
    ).length
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


  const active =
    items.filter(
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
    "마감 제거:",
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
