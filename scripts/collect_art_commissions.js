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


/*
  제목에 아래 단어가 하나라도 있으면
  공모 후보에서 강제로 제외.
*/

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
   TITLE FILTER v1.1
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
    제외 키워드가 있으면
    즉시 탈락.
  */

  if (
    hasExcludedKeyword(
      text
    )
  ) {

    return false;
  }


  /*
    실제 공모 후보는 반드시:

    1. 미술작품
    2. 공모

    두 단어가 모두 있어야 한다.
  */

  const hasArt =
    text.includes(
      "미술작품"
    );


  const hasCompetition =
    text.includes(
      "공모"
    );


  if (
    !hasArt ||
    !hasCompetition
  ) {

    return false;
  }


  /*
    공모 게시물로 볼 수 있는
    최소한의 표현 확인.
  */

  const hasRelevantWord =
    (
      text.includes(
        "공고"
      ) ||

      text.includes(
        "제작"
      ) ||

      text.includes(
        "설치"
      ) ||

      text.includes(
        "신축"
      ) ||

      text.includes(
        "공동주택"
      )
    );


  return hasRelevantWord;
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


  return (
    item.source ===
      SOURCE_NAME &&

    String(
      item.sourceUrl || ""
    ).includes(
      "gg.go.kr/publicart"
    )
  );
}



/*
  자동 수집기가 만든 경기도 항목 중
  현재 필터 기준으로 공모가 아닌 항목 제거.

  사용자가 직접 등록한 다른 데이터에는
  영향을 주지 않는다.
*/

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
    기존 live 데이터에서 먼저
    자동 수집 오탐을 제거.
  */

  const cleanedExisting =
    cleanFalsePositives(
      existing
    );


  /*
    현재 live 데이터 중
    아직 마감되지 않은 항목은 보존.
  */

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
    이번 수집에서 발견된
    신규 공고 병합.
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
        Archive에서 이미
        마감 처리된 공고라면
        live에 다시 넣지 않는다.
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

  const originalExisting =
    readArray(
      DATA_FILE
    );


  const originalArchive =
    readArray(
      ARCHIVE_FILE
    );


  /*
    기존 잘못 수집된 경기도 항목
    live / archive 양쪽에서 정리.
  */

  const existing =
    cleanFalsePositives(
      originalExisting
    );


  const archive =
    cleanArchive(
      originalArchive
    );


  /*
    Archive 청소 결과를
    바로 저장.
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
      SOURCE_MAIN_URL
    );


  const discovered =
    extractBoardItems(
      html
    );


  /*
    안전장치:

    사이트 HTML 구조가 바뀌어
    정상적인 공모 링크를 하나도 찾지 못하면

    기존 live 데이터를 지우지 않고
    실패 처리한다.
  */

  if (
    discovered.length ===
    0
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


  writeArray(
    DATA_FILE,
    merged
  );


  const removedLive =
    originalExisting.length -
    existing.length;


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
    removedLive
  );


  console.log(
    "ARCHIVE 오탐 제거:",
    originalArchive.length -
    archive.length
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


  /*
    만약 이전 버전에서 남은
    오탐이 있다면 여기서도 한 번 더 제거.
  */

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
