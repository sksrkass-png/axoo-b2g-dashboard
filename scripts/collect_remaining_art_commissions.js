const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
  getRegionalSources,
  getNationalSources
} = require("./art_commission_sources");

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

const SPECIALIZED_REGION_IDS = new Set([
  "seoul",
  "gyeonggi",
  "incheon",
  "busan"
]);

const COLLECTION_VERSION =
  "nationwide-generic-1.1.0";

const FETCH_TIMEOUT_MS =
  12000;

const FETCH_MAX_ATTEMPTS =
  2;

const FETCH_RETRY_DELAY_MS =
  800;

const MAX_PAGES_PER_SOURCE =
  4;

const MAX_SOURCES_PER_REGION =
  2;

const MAX_SOURCE_BUDGET_MS =
  25000;

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
    formatter.formatToParts(
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


    result.push({

      url:
        url,

      label:
        cleanText(
          match[4]
        ),

      attrs:
        cleanText(
          (
            match[1] || ""
          ) +
          " " +
          (
            match[3] || ""
          )
        )
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

function sleep(
  ms
) {

  return new Promise(
    function (
      resolve
    ) {

      setTimeout(
        resolve,
        ms
      );
    }
  );
}


async function fetchText(
  url
) {

  let lastError =
    null;


  for (
    let attempt = 1;
    attempt <= FETCH_MAX_ATTEMPTS;
    attempt++
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
                "Mozilla/5.0 (compatible; AXOO-B2G-NationwideCollector/1.1)",

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


    } catch (
      error
    ) {

      lastError =
        error;


      if (
        attempt <
        FETCH_MAX_ATTEMPTS
      ) {

        console.log(
          "   ↻ FETCH RETRY" +
          " | attempt=" +
          (attempt + 1) +
          "/" +
          FETCH_MAX_ATTEMPTS +
          " | " +
          url
        );


        await sleep(
          FETCH_RETRY_DELAY_MS
        );
      }


    } finally {

      clearTimeout(
        timer
      );
    }
  }


  throw (
    lastError ||
    new Error(
      "FETCH FAILED"
    )
  );
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


  const isNational =
    region.name ===
    "전국";


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

    keywords: [
      "건축물 미술작품",
      "미술작품 공모"
    ],

    matchedKeywords: [
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
      isNational
        ? "전국 공통 소스에서 건축물 미술작품 공모 키워드가 확인된 후보입니다."
        : "광역시·도 공식 소스에서 건축물 미술작품 공모 키워드가 확인된 후보입니다.",

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


  const rootUrl =
    canonicalUrl(
      source.sourceUrl,
      source.sourceUrl
    );


  /*
    items=0 원인을 분리하기 위한
    소스 단위 진단 정보
  */
  const diagnostics = {

    htmlBytes:
      0,

    rawAnchors:
      0,

    extractedAnchors:
      0,

    javascriptAnchors:
      0,

    sameOriginAnchors:
      0,

    primaryKeywordAnchors:
      0,

    actionKeywordAnchors:
      0,

    candidateAnchors:
      0,

    navigationCandidates:
      0,

    sampleLabels:
      new Set()
  };


  if (!rootUrl) {

    return {

      sourceId:
        source.id,

      sourceName:
        source.sourceName,

      region:
        region.name,

      accessOk:
        false,

      pagesFetched:
        0,

      items:
        []
    };
  }


  const queue = [
    {
      url:
        rootUrl,

      depth:
        0
    }
  ];


  const queued =
    new Set(
      [
        rootUrl
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


    /*
      HTML 자체를 받았는지 확인
    */
    diagnostics.htmlBytes +=
      Buffer.byteLength(
        html,
        "utf8"
      );


    /*
      HTML 안에 존재하는 전체 <a> 개수
    */
    diagnostics.rawAnchors +=
      (
        html.match(
          /<a\b/gi
        ) || []
      ).length;


    /*
      javascript: 기반 링크 개수

      현재 extractAnchors()에서는
      javascript: 링크를 제외하므로
      이 숫자가 크면 전용 Adapter가 필요할 가능성이 높다.
    */
    diagnostics.javascriptAnchors +=
      (
        html.match(
          /href\s*=\s*["']\s*javascript:/gi
        ) || []
      ).length;


    const anchors =
      extractAnchors(
        html,
        current.url
      );


    diagnostics.extractedAnchors +=
      anchors.length;


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


        diagnostics.sameOriginAnchors++;


        const label =
          cleanText(
            anchor.label
          );


        /*
          실제 게시판에 미술 / 작품 / 공모 등의
          관련 문구가 존재하는지 샘플 저장
        */
        if (
          diagnostics.sampleLabels.size < 5 &&
          /미술|예술|작품|공모|art/i.test(
            label
          )
        ) {

          diagnostics.sampleLabels.add(
            label
          );
        }


        if (
          hasAnyKeyword(
            label,
            PRIMARY_KEYWORDS
          )
        ) {

          diagnostics.primaryKeywordAnchors++;
        }


        if (
          hasAnyKeyword(
            label,
            ACTION_KEYWORDS
          )
        ) {

          diagnostics.actionKeywordAnchors++;
        }


        if (
          !isCandidateTitle(
            label
          )
        ) {

          return;
        }


        diagnostics.candidateAnchors++;


        found.set(
          anchor.url,

          buildItem(
            region,
            source,
            label,
            anchor.url
          )
        );
      }
    );


    /*
      내부 게시판 / 고시공고 링크 탐색
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


    diagnostics.navigationCandidates +=
      followCandidates.length;


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


  /*
    items=0 진단 출력
  */
  if (
    pagesFetched > 0
  ) {

    console.log(
      "   🔎 DIAG" +
      " | htmlKB=" +
      Math.round(
        diagnostics.htmlBytes /
        1024
      ) +
      " | rawA=" +
      diagnostics.rawAnchors +
      " | parsedA=" +
      diagnostics.extractedAnchors +
      " | jsHref=" +
      diagnostics.javascriptAnchors +
      " | sameOrigin=" +
      diagnostics.sameOriginAnchors +
      " | primary=" +
      diagnostics.primaryKeywordAnchors +
      " | action=" +
      diagnostics.actionKeywordAnchors +
      " | candidate=" +
      diagnostics.candidateAnchors +
      " | nav=" +
      diagnostics.navigationCandidates
    );


    if (
      diagnostics.sampleLabels.size >
      0
    ) {

      console.log(
        "   🔎 LABEL SAMPLE:"
      );


      Array.from(
        diagnostics.sampleLabels
      ).forEach(
        function (
          label
        ) {

          console.log(
            "      -",
            label
          );
        }
      );
    }
  }


  return {

    sourceId:
      source.id,

    sourceName:
      source.sourceName,

    region:
      region.name,

    accessOk:
      pagesFetched > 0,

    pagesFetched:
      pagesFetched,

    items:
      Array.from(
        found.values()
      )
  };
}


  const queued =
    new Set(
      [
        rootUrl
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
      내부 게시판 / 고시공고 링크 탐색
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


  return {

    sourceId:
      source.id,

    sourceName:
      source.sourceName,

    region:
      region.name,

    accessOk:
      pagesFetched > 0,

    pagesFetched:
      pagesFetched,

    items:
      Array.from(
        found.values()
      )
  };
}


/* =========================================================
   DATA MERGE
========================================================= */

function itemUrl(
  item
) {

  const value =
    item &&
    (
      item.sourceUrl ||
      item.originalUrl ||
      item.url ||
      ""
    );


  return canonicalUrl(
    value,
    value
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
    이미 마감된 공고 URL은
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

      if (!item) {

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
          기존 날짜 검증 정보는 보존.
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
   SOURCE GROUP RUNNER
========================================================= */

async function runSourceGroup(
  options
) {

  const sources =
    options.sources || [];


  const region =
    options.region;


  const discovered =
    options.discovered;


  const counters =
    options.counters;


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

        counters.success++;


        console.log(
          "   ✅ ACCESS OK" +
          " | pages=" +
          result.pagesFetched +
          " | items=" +
          result.items.length
        );


      } else {

        counters.failed++;


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


    } catch (
      error
    ) {

      counters.failed++;


      console.warn(
        "   ⚠️ SOURCE FAILED:",
        source.sourceName,
        "|",
        error.message
      );
    }
  }
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


  const nationalSources =
    getNationalSources();


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


  console.log(
    "전국 백업 소스:",
    nationalSources.length
  );


  const discovered =
    [];


  const counters = {

    success:
      0,

    failed:
      0
  };


  /* ---------------------------------------------------------
     1. 나머지 13개 시도
  --------------------------------------------------------- */

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


    await runSourceGroup({

      sources:
        sources,

      region:
        region,

      discovered:
        discovered,

      counters:
        counters
    });
  }


  /* ---------------------------------------------------------
     2. 전국 공통 백업

     지역별 공식 소스에서 놓친 공모를
     아트누리 / LH 등 전국 소스로 다시 확인한다.
  --------------------------------------------------------- */

  const nationalRegion = {

    id:
      "national",

    name:
      "전국",

    fullName:
      "전국 공통 백업"
  };


  console.log(
    ""
  );


  console.log(
    "▶ 전국 공통 백업"
  );


  if (
    nationalSources.length === 0
  ) {

    console.log(
      "   ⚠️ 등록된 전국 공통 소스 없음"
    );


  } else {

    await runSourceGroup({

      sources:
        nationalSources,

      region:
        nationalRegion,

      discovered:
        discovered,

      counters:
        counters
    });
  }


  /* ---------------------------------------------------------
     3. URL 기준 중복 제거

     지역 소스를 먼저 수집하므로
     같은 URL이 전국 백업에서도 발견되면
     지역 레코드를 우선 보존한다.
  --------------------------------------------------------- */

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


  /* ---------------------------------------------------------
     4. SUMMARY
  --------------------------------------------------------- */

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
    "전국 백업 소스:",
    nationalSources.length
  );


  console.log(
    "성공 소스:",
    counters.success
  );


  console.log(
    "실패 소스:",
    counters.failed
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


  if (
    counters.failed > 0
  ) {

    console.log(
      "::warning title=일부 미술작품 수집 소스 접근 실패::" +
      counters.failed +
      "개 소스 접근에 실패했지만 나머지 수집은 완료했습니다."
    );
  }


  console.log(
    ""
  );


  console.log(
    "✅ 남은 13개 지역 + 전국 공통 백업 수집 완료"
  );
}


/* =========================================================
   START
========================================================= */

if (
  require.main ===
  module
) {

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
}


/* =========================================================
   TEST EXPORT
========================================================= */

module.exports = {

  isCandidateTitle,

  cleanText,

  extractAnchors,

  followScore,

  canonicalUrl
};
