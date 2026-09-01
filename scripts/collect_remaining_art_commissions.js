const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
  getRegionalSources
} = require("./art_commission_sources");


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


/*
  이미 전용 Collector가 있는 지역.
  이 파일에서는 제외한다.
*/
const SPECIALIZED_REGION_IDS =
  new Set([
    "seoul",
    "gyeonggi",
    "incheon",
    "busan"
  ]);


const COLLECTION_VERSION =
  "nationwide-generic-1.0.0";


/*
  한 HTTP 요청 최대 시간
*/
const FETCH_TIMEOUT_MS =
  7000;


/*
  한 소스에서 탐색할 최대 페이지
*/
const MAX_PAGES_PER_SOURCE =
  4;


/*
  지역별 우선 소스 최대 개수
*/
const MAX_SOURCES_PER_REGION =
  2;


/*
  한 소스 전체 작업 제한시간
*/
const MAX_SOURCE_BUDGET_MS =
  25000;


/*
  사이트 내부 탐색 깊이
*/
const MAX_DEPTH =
  2;


/* =========================================================
   KEYWORDS
========================================================= */

const PRIMARY_KEYWORDS = [
  "미술작품",
  "공공미술"
];


const ACTION_KEYWORDS = [
  "공모",
  "제작",
  "설치",
  "신축",
  "공동주택"
];


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
  "규칙",

  "행정예고",

  "제도 안내",
  "업무 안내",

  "설치완료",
  "설치 완료",

  "준공"
];


const NAVIGATION_KEYWORDS = [
  "공고",
  "고시",
  "알림",
  "소식",
  "게시판",

  "문화",
  "예술",
  "미술",

  "공모",

  "notice",
  "board",
  "bbs",
  "announce",
  "announcement",

  "gosi",
  "gonggo",
  "culture",
  "art"
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
          Number(code)
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
   DATE
========================================================= */

function todayKst() {

  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
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
    );


  const parts =
    formatter
      .formatToParts(
        new Date()
      );


  const values =
    {};


  parts.forEach(
    function (
      part
    ) {

      values[
        part.type
      ] =
        part.value;
    }
  );


  return (
    values.year +
    "-" +
    values.month +
    "-" +
    values.day
  );
}


/* =========================================================
   URL
========================================================= */

function canonicalUrl(
  value,
  baseUrl
) {

  try {

    const url =
      new URL(
        value,
        baseUrl
      );


    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {

      return "";
    }


    url.hash =
      "";


    /*
      tracking parameter 제거
    */
    Array.from(
      url.searchParams.keys()
    ).forEach(
      function (
        key
      ) {

        if (
          key
            .toLowerCase()
            .startsWith(
              "utm_"
            )
        ) {

          url.searchParams.delete(
            key
          );
        }
      }
    );


    return url.toString();

  } catch (
    error
  ) {

    return "";
  }
}


function sameOrigin(
  first,
  second
) {

  try {

    return (
      new URL(first).origin ===
      new URL(second).origin
    );

  } catch (
    error
  ) {

    return false;
  }
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
        12
      );


  return (
    "nationwide-art-commission-" +
    hash
  );
}


/* =========================================================
   TITLE FILTER
========================================================= */

function hasAnyKeyword(
  text,
  keywords
) {

  return keywords.some(
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
  value
) {

  const title =
    cleanText(
      value
    );


  if (
    !title ||
    title.length < 4
  ) {

    return false;
  }


  if (
    hasAnyKeyword(
      title,
      EXCLUDE_KEYWORDS
    )
  ) {

    return false;
  }


  if (
    !hasAnyKeyword(
      title,
      PRIMARY_KEYWORDS
    )
  ) {

    return false;
  }


  if (
    !hasAnyKeyword(
      title,
      ACTION_KEYWORDS
    )
  ) {

    return false;
  }


  return true;
}


/* =========================================================
   HTML LINK
========================================================= */

function extractAnchors(
  html,
  pageUrl
) {

  const result =
    [];


  const regex =
    /<a\b([^>]*)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;


  let match;


  while (
    (
      match =
        regex.exec(
          html
        )
    ) !== null
  ) {

    const href =
      decodeHtmlEntities(
        match[2]
      );


    if (
      !href ||
      href.startsWith(
        "#"
      ) ||
      href
        .toLowerCase()
        .startsWith(
          "javascript:"
        ) ||
      href
        .toLowerCase()
        .startsWith(
          "mailto:"
        )
    ) {

      continue;
    }


    const url =
      canonicalUrl(
        href,
        pageUrl
      );


    if (!url) {

      continue;
    }


    const label =
      cleanText(
        match[4]
      );


    const attrs =
      cleanText(
        (
          match[1] || ""
        ) +
        " " +
        (
          match[3] || ""
        )
      );


    result.push({

      url:
        url,

      label:
        label,

      attrs:
        attrs
    });
  }


  return result;
}


/* =========================================================
   NAVIGATION
========================================================= */

function followScore(
  anchor
) {

  const target =
    (
      anchor.label +
      " " +
      anchor.url +
      " " +
      anchor.attrs
    )
      .toLowerCase();


  let score =
    0;


  NAVIGATION_KEYWORDS.forEach(
    function (
      keyword
    ) {

      if (
        target.includes(
          keyword.toLowerCase()
        )
      ) {

        score +=
          10;
      }
    }
  );


  if (
    isCandidateTitle(
      anchor.label
    )
  ) {

    score +=
      100;
  }


  return score;
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

          redirect:
            "follow",

          headers: {

            "User-Agent":
              "Mozilla/5.0 (compatible; AXOO-B2G-NationwideCollector/1.0)",

            "Accept":
              "text/html,application/xhtml+xml,*/*",

            "Accept-Language":
              "ko-KR,ko;q=0.9,en;q=0.6"
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
   ITEM
========================================================= */

function buildItem(
  region,
  source,
  title,
  sourceUrl
) {

  const today =
    todayKst();


  return {

    id:
      stableId(
        sourceUrl
      ),

    category:
      "건축물 미술작품",

    categoryLabel:
      "건축물 미술작품",

    status:
      "마감일 확인 필요",

    source:
      source.sourceName,

    sourceName:
      source.sourceName,

    sourceType:
      source.sourceType,

    agency:
      source.sourceName,

    organization:
      source.sourceName,

    title:
      cleanText(
        title
      ),

    region:
      region.name,

    regionGroup:
      source.regionGroup || "",

    regionGroupLabel:
      source.regionGroupLabel || "",

    sourceUrl:
      sourceUrl,

    originalUrl:
      sourceUrl,

    url:
      sourceUrl,

    rawSourcePageUrl:
      source.sourceUrl,

    publishedDate:
      "",

    postedDate:
      "",

    periodStart:
      "",

    periodEnd:
      "",

    deadline:
      "",

    endDate:
      "",

    budget:
      "",

    amount:
      "",

    keywords:
      [
        "건축물 미술작품",
        "미술작품 공모"
      ],

    matchedKeywords:
      [
        "미술작품",
        "공모"
      ],

    crawlMode:
      source.crawlMode ||
      "generic_board_discovery",

    priority:
      source.priority || 3,

    priorityLabel:
      source.priorityLabel ||
      "전국 자동수집",

    fitReason:
      "광역시·도 공식 소스에서 건축물 미술작품 공모 키워드가 확인된 후보입니다.",

    summary:
      "공고 원문에서 마감일, 참가자격, 작품비, 설치조건을 확인해야 합니다.",

    nextAction:
      "공고 원문 확인 후 마감일, 제출 방식, 설치 조건을 검토하세요.",

    recommendedAction:
      "공고 원문 확인 후 마감일, 제출 방식, 설치 조건을 검토하세요.",

    score:
      80,

    grade:
      "A",

    isExpired:
      false,

    isStaleCandidate:
      false,

    deadlineStatus:
      "마감일 확인 필요",

    collectedAt:
      today,

    updatedAt:
      today,

    collectionSourceId:
      source.id,

    collectionVersion:
      COLLECTION_VERSION
  };
}


/* =========================================================
   SOURCE CRAWL
========================================================= */

async function crawlSource(
  region,
  source
) {

  const startedAt =
    Date.now();


  const queue =
    [
      {
        url:
          source.sourceUrl,

        depth:
          0
      }
    ];


  const queued =
    new Set(
      [
        canonicalUrl(
          source.sourceUrl,
          source.sourceUrl
        )
      ]
    );


  const visited =
    new Set();


  const found =
    new Map();


  let pagesFetched =
    0;


  while (
    queue.length &&
    pagesFetched <
      MAX_PAGES_PER_SOURCE &&
    (
      Date.now() -
      startedAt
    ) <
      MAX_SOURCE_BUDGET_MS
  ) {

    const current =
      queue.shift();


    if (
      !current ||
      visited.has(
        current.url
      )
    ) {

      continue;
    }


    visited.add(
      current.url
    );


    let html;


    try {

      html =
        await fetchText(
          current.url
        );


      pagesFetched++;

    } catch (
      error
    ) {

      console.warn(
        "   ⚠️ FETCH",
        current.url,
        error.message
      );


      continue;
    }


    const anchors =
      extractAnchors(
        html,
        current.url
      );


    /*
      공모 후보 추출
    */
    anchors.forEach(
      function (
        anchor
      ) {

        if (
          !sameOrigin(
            source.sourceUrl,
            anchor.url
          )
        ) {

          return;
        }


        if (
          !isCandidateTitle(
            anchor.label
          )
        ) {

          return;
        }


        found.set(
          anchor.url,

          buildItem(
            region,
            source,
            anchor.label,
            anchor.url
          )
        );
      }
    );


    /*
      내부 게시판/고시공고 링크 탐색
    */
    if (
      current.depth >=
      MAX_DEPTH
    ) {

      continue;
    }


    const followCandidates =
      anchors

        .filter(
          function (
            anchor
          ) {

            if (
              !sameOrigin(
                source.sourceUrl,
                anchor.url
              )
            ) {

              return false;
            }


            if (
              visited.has(
                anchor.url
              ) ||
              queued.has(
                anchor.url
              )
            ) {

              return false;
            }


            return (
              followScore(
                anchor
              ) > 0
            );
          }
        )

        .sort(
          function (
            a,
            b
          ) {

            return (
              followScore(b) -
              followScore(a)
            );
          }
        );


    followCandidates
      .slice(
        0,
        MAX_PAGES_PER_SOURCE
      )
      .forEach(
        function (
          anchor
        ) {

          queued.add(
            anchor.url
          );


          queue.push({

            url:
              anchor.url,

            depth:
              current.depth + 1
          });
        }
      );
  }


  const accessOk =
  pagesFetched > 0;


return {

  sourceId:
    source.id,

  sourceName:
    source.sourceName,

  region:
    region.name,

  accessOk:
    accessOk,

  pagesFetched:
    pagesFetched,

  items:
    Array.from(
      found.values()
    )
};


/* =========================================================
   DATA MERGE
========================================================= */

function itemUrl(
  item
) {

  return canonicalUrl(
    item &&
    (
      item.sourceUrl ||
      item.originalUrl ||
      item.url ||
      ""
    ),
    item &&
    (
      item.sourceUrl ||
      item.originalUrl ||
      item.url ||
      ""
    )
  );
}


function mergeData(
  discovered
) {

  const live =
    readArray(
      DATA_FILE
    );


  const archive =
    readArray(
      ARCHIVE_FILE
    );


  const today =
    todayKst();


  /*
    이미 마감된 공고는
    다시 LIVE에 올리지 않는다.
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
          itemUrl
        )

        .filter(
          Boolean
        )
    );


  const liveByUrl =
    new Map();


  const liveWithoutUrl =
    [];


  live.forEach(
    function (
      item
    ) {

      if (
        !item
      ) {

        return;
      }


      const url =
        itemUrl(
          item
        );


      if (url) {

        liveByUrl.set(
          url,
          item
        );

      } else {

        liveWithoutUrl.push(
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
        itemUrl(
          item
        );


      if (!url) {

        return;
      }


      if (
        expiredUrls.has(
          url
        ) &&
        !liveByUrl.has(
          url
        )
      ) {

        return;
      }


      const previous =
        liveByUrl.get(
          url
        );


      if (previous) {

        /*
          기존에 날짜 검증된 정보는 보존
        */
        liveByUrl.set(
          url,
          {
            ...item,
            ...previous,

            title:
              item.title ||
              previous.title,

            source:
              item.source,

            sourceName:
              item.sourceName,

            sourceType:
              item.sourceType,

            region:
              item.region,

            collectionSourceId:
              item.collectionSourceId,

            collectionVersion:
              item.collectionVersion,

            updatedAt:
              today
          }
        );

      } else {

        liveByUrl.set(
          url,
          item
        );
      }
    }
  );


  const archiveByUrl =
    new Map();


  const archiveWithoutUrl =
    [];


  archive.forEach(
    function (
      item
    ) {

      const url =
        itemUrl(
          item
        );


      if (url) {

        archiveByUrl.set(
          url,
          item
        );

      } else {

        archiveWithoutUrl.push(
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
        itemUrl(
          item
        );


      if (!url) {

        return;
      }


      const previous =
        archiveByUrl.get(
          url
        );


      archiveByUrl.set(
        url,
        {

          ...item,

          ...(previous || {}),

          title:
            item.title ||
            (
              previous &&
              previous.title
            ) ||
            "",

          source:
            item.source,

          sourceName:
            item.sourceName,

          sourceType:
            item.sourceType,

          region:
            item.region,

          collectionSourceId:
            item.collectionSourceId,

          collectionVersion:
            item.collectionVersion,

          archiveFirstSeenAt:
            (
              previous &&
              previous.archiveFirstSeenAt
            ) ||
            today,

          archiveLastSeenAt:
            today,

          archiveIsCurrent:
            true,

          collectedAt:
            (
              previous &&
              previous.collectedAt
            ) ||
            today,

          updatedAt:
            today
        }
      );
    }
  );


  const nextLive =
    Array.from(
      liveByUrl.values()
    )
      .concat(
        liveWithoutUrl
      );


  const nextArchive =
    Array.from(
      archiveByUrl.values()
    )
      .concat(
        archiveWithoutUrl
      );


  writeArray(
    DATA_FILE,
    nextLive
  );


  writeArray(
    ARCHIVE_FILE,
    nextArchive
  );


  return {

    liveCount:
      nextLive.length,

    archiveCount:
      nextArchive.length
  };
}


/* =========================================================
   RUN
========================================================= */

async function main() {

  const registry =
    getRegionalSources();


  const targetRegions =
    registry.filter(
      function (
        region
      ) {

        return (
          !SPECIALIZED_REGION_IDS.has(
            region.id
          )
        );
      }
    );


  console.log(
    ""
  );

  console.log(
    "===================================="
  );

  console.log(
    "AXOO REMAINING REGION COLLECTOR"
  );

  console.log(
    "===================================="
  );

  console.log(
    "대상 지역:",
    targetRegions.length
  );


  const discovered =
    [];


  let successfulSources =
    0;

  let failedSources =
    0;


  for (
    const region of
    targetRegions
  ) {

    console.log(
      ""
    );

    console.log(
      "▶",
      region.fullName
    );


    const sources =
      region.sources.slice(
        0,
        MAX_SOURCES_PER_REGION
      );


    if (
      sources.length === 0
    ) {

      console.log(
        "   ⚠️ 등록된 소스 없음"
      );


      continue;
    }


    for (
      const source of
      sources
    ) {

      console.log(
        "   SOURCE:",
        source.sourceName
      );


      try {

        const result =
          await crawlSource(
            region,
            source
          );


        if (
  result.accessOk
) {

  successfulSources++;


  console.log(
    "   ✅ ACCESS OK" +
    " | pages=" +
    result.pagesFetched +
    " | items=" +
    result.items.length
  );


} else {

  failedSources++;


  console.log(
    "   ❌ ACCESS FAILED" +
    " | pages=0" +
    " | items=0"
  );
}


if (
  result.items.length > 0
) {

  console.log(
    "   🎯 ITEMS FOUND:",
    result.items.length
  );


  discovered.push(
    ...result.items
  );
}


  /*
    URL 기준 중복 제거
  */
  const unique =
    new Map();


  discovered.forEach(
    function (
      item
    ) {

      const url =
        itemUrl(
          item
        );


      if (
        url &&
        !unique.has(
          url
        )
      ) {

        unique.set(
          url,
          item
        );
      }
    }
  );


  const items =
    Array.from(
      unique.values()
    );


  const merged =
    mergeData(
      items
    );


  console.log(
    ""
  );

  console.log(
    "===================================="
  );

  console.log(
    "REMAINING REGION SUMMARY"
  );

  console.log(
    "===================================="
  );

  console.log(
    "지역:",
    targetRegions.length
  );

  console.log(
    "성공 소스:",
    successfulSources
  );

  console.log(
    "실패 소스:",
    failedSources
  );

  console.log(
    "신규/발견 후보:",
    items.length
  );

  console.log(
    "LIVE:",
    merged.liveCount
  );

  console.log(
    "ARCHIVE:",
    merged.archiveCount
  );

  console.log(
    "===================================="
  );


  /*
    일부 사이트 장애는 정상 허용.
    전체 workflow를 실패시키지 않는다.
  */
  if (
    failedSources > 0
  ) {

    console.log(
      "::warning title=일부 지역 소스 접근 실패::" +
      failedSources +
      "개 소스 접근에 실패했지만 나머지 지역 수집은 완료했습니다."
    );
  }


  console.log(
    ""
  );

  console.log(
    "✅ 남은 13개 지역 통합 수집 완료"
  );
}


main()
  .catch(
    function (
      error
    ) {

      console.error(
        "[AXOO REMAINING COLLECTOR]",
        error
      );


      process.exitCode =
        1;
    }
  );
