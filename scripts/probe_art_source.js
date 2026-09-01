const {
  getRegionalSources,
  getNationalSources
} = require(
  "./art_commission_sources"
);

const {
  isCandidateTitle,
  cleanText,
  extractAnchors,
  followScore,
  canonicalUrl
} = require(
  "./collect_remaining_art_commissions"
);


/* =========================================================
   CONFIG
========================================================= */

const FETCH_TIMEOUT_MS =
  8000;

const MAX_LABEL_SAMPLES =
  10;

const MAX_NAV_SAMPLES =
  10;

const MAX_CANDIDATE_SAMPLES =
  10;


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


/* =========================================================
   HELPERS
========================================================= */

function hasAnyKeyword(
  text,
  keywords
) {

  return keywords.some(
    function (
      keyword
    ) {

      return String(
        text || ""
      ).includes(
        keyword
      );
    }
  );
}


function sameOrigin(
  first,
  second
) {

  try {

    return (
      new URL(
        first
      ).origin ===
      new URL(
        second
      ).origin
    );

  } catch (
    error
  ) {

    return false;
  }
}


function formatBoolean(
  value
) {

  return value
    ? "YES"
    : "NO";
}


/* =========================================================
   SOURCE REGISTRY
========================================================= */

function loadAllSources() {

  const result =
    [];


  const regional =
    getRegionalSources();


  regional.forEach(
    function (
      region
    ) {

      region.sources.forEach(
        function (
          source
        ) {

          result.push({

            region: {
              id:
                region.id,

              name:
                region.name,

              fullName:
                region.fullName
            },

            source:
              source
          });
        }
      );
    }
  );


  const nationalRegion = {

    id:
      "national",

    name:
      "전국",

    fullName:
      "전국 공통 백업"
  };


  getNationalSources()
    .forEach(
      function (
        source
      ) {

        result.push({

          region:
            nationalRegion,

          source:
            source
        });
      }
    );


  return result;
}


function findSource(
  sourceId
) {

  return loadAllSources()
    .find(
      function (
        entry
      ) {

        return (
          entry.source.id ===
          sourceId
        );
      }
    );
}


/* =========================================================
   LIST
========================================================= */

function printSourceList() {

  const sources =
    loadAllSources();


  console.log(
    ""
  );

  console.log(
    "===================================="
  );

  console.log(
    "AXOO ART SOURCE LIST"
  );

  console.log(
    "===================================="
  );


  sources.forEach(
    function (
      entry
    ) {

      console.log(
        entry.source.id
      );

      console.log(
        "   지역:",
        entry.region.name
      );

      console.log(
        "   소스:",
        entry.source.sourceName
      );

      console.log(
        "   URL:",
        entry.source.sourceUrl
      );

      console.log(
        ""
      );
    }
  );


  console.log(
    "TOTAL:",
    sources.length
  );

  console.log(
    "===================================="
  );
}


/* =========================================================
   FETCH
========================================================= */

async function fetchPage(
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


  const startedAt =
    Date.now();


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
              "Mozilla/5.0 (compatible; AXOO-B2G-SourceProbe/1.0)",

            "Accept":
              "text/html,application/xhtml+xml,*/*",

            "Accept-Language":
              "ko-KR,ko;q=0.9,en;q=0.6"
          }
        }
      );


    const html =
      await response.text();


    return {

      ok:
        response.ok,

      status:
        response.status,

      statusText:
        response.statusText,

      finalUrl:
        response.url,

      contentType:
        response.headers.get(
          "content-type"
        ) || "",

      elapsedMs:
        Date.now() -
        startedAt,

      html:
        html
    };


  } finally {

    clearTimeout(
      timer
    );
  }
}


/* =========================================================
   ANALYZE
========================================================= */

function analyzePage(
  source,
  fetchResult
) {

  const html =
    fetchResult.html || "";


  const pageUrl =
    fetchResult.finalUrl ||
    source.sourceUrl;


  const rawAnchors =
    (
      html.match(
        /<a\b/gi
      ) || []
    ).length;


  const javascriptAnchors =
    (
      html.match(
        /href\s*=\s*["']\s*javascript:/gi
      ) || []
    ).length;


  const anchors =
    extractAnchors(
      html,
      pageUrl
    );


  const sameOriginAnchors =
    anchors.filter(
      function (
        anchor
      ) {

        return sameOrigin(
          source.sourceUrl,
          anchor.url
        );
      }
    );


  const finalOriginAnchors =
    anchors.filter(
      function (
        anchor
      ) {

        return sameOrigin(
          pageUrl,
          anchor.url
        );
      }
    );


  const primaryAnchors =
    sameOriginAnchors.filter(
      function (
        anchor
      ) {

        return hasAnyKeyword(
          cleanText(
            anchor.label
          ),
          PRIMARY_KEYWORDS
        );
      }
    );


  const actionAnchors =
    sameOriginAnchors.filter(
      function (
        anchor
      ) {

        return hasAnyKeyword(
          cleanText(
            anchor.label
          ),
          ACTION_KEYWORDS
        );
      }
    );


  const candidateAnchors =
    sameOriginAnchors.filter(
      function (
        anchor
      ) {

        return isCandidateTitle(
          anchor.label
        );
      }
    );


  const navigationAnchors =
    sameOriginAnchors

      .filter(
        function (
          anchor
        ) {

          return (
            followScore(
              anchor
            ) > 0
          );
        }
      )

      .sort(
        function (
          first,
          second
        ) {

          return (
            followScore(
              second
            ) -
            followScore(
              first
            )
          );
        }
      );


  const relatedLabels =
    [];


  sameOriginAnchors.forEach(
    function (
      anchor
    ) {

      const label =
        cleanText(
          anchor.label
        );


      if (
        !label
      ) {

        return;
      }


      if (
        !/미술|예술|작품|공모|공고|고시|art/i.test(
          label
        )
      ) {

        return;
      }


      if (
        relatedLabels.includes(
          label
        )
      ) {

        return;
      }


      if (
        relatedLabels.length >=
        MAX_LABEL_SAMPLES
      ) {

        return;
      }


      relatedLabels.push(
        label
      );
    }
  );


  return {

    htmlBytes:
      Buffer.byteLength(
        html,
        "utf8"
      ),

    rawAnchors:
      rawAnchors,

    parsedAnchors:
      anchors.length,

    javascriptAnchors:
      javascriptAnchors,

    collectorSameOriginAnchors:
      sameOriginAnchors.length,

    finalPageSameOriginAnchors:
      finalOriginAnchors.length,

    primaryAnchors:
      primaryAnchors,

    actionAnchors:
      actionAnchors,

    candidateAnchors:
      candidateAnchors,

    navigationAnchors:
      navigationAnchors,

    relatedLabels:
      relatedLabels
  };
}


/* =========================================================
   RESULT PRINT
========================================================= */

function printResult(
  target,
  fetchResult,
  analysis
) {

  const source =
    target.source;


  const region =
    target.region;


  const originalUrl =
    canonicalUrl(
      source.sourceUrl,
      source.sourceUrl
    );


  const finalUrl =
    canonicalUrl(
      fetchResult.finalUrl,
      fetchResult.finalUrl
    );


  const originChanged =
    !sameOrigin(
      originalUrl,
      finalUrl
    );


  console.log(
    ""
  );

  console.log(
    "===================================="
  );

  console.log(
    "AXOO ART SOURCE PROBE"
  );

  console.log(
    "===================================="
  );

  console.log(
    "SOURCE ID:",
    source.id
  );

  console.log(
    "REGION:",
    region.name
  );

  console.log(
    "SOURCE:",
    source.sourceName
  );

  console.log(
    "TYPE:",
    source.sourceType
  );

  console.log(
    "URL:",
    source.sourceUrl
  );

  console.log(
    "FINAL URL:",
    fetchResult.finalUrl
  );

  console.log(
    "ORIGIN CHANGED:",
    formatBoolean(
      originChanged
    )
  );

  console.log(
    "HTTP:",
    fetchResult.status,
    fetchResult.statusText
  );

  console.log(
    "CONTENT TYPE:",
    fetchResult.contentType
  );

  console.log(
    "TIME:",
    fetchResult.elapsedMs +
      "ms"
  );


  console.log(
    ""
  );

  console.log(
    "------------------------------------"
  );

  console.log(
    "HTML / LINK DIAGNOSTICS"
  );

  console.log(
    "------------------------------------"
  );

  console.log(
    "HTML KB:",
    Math.round(
      analysis.htmlBytes /
      1024
    )
  );

  console.log(
    "RAW <a>:",
    analysis.rawAnchors
  );

  console.log(
    "PARSED <a>:",
    analysis.parsedAnchors
  );

  console.log(
    "JAVASCRIPT HREF:",
    analysis.javascriptAnchors
  );

  console.log(
    "COLLECTOR SAME ORIGIN:",
    analysis.collectorSameOriginAnchors
  );

  console.log(
    "FINAL PAGE SAME ORIGIN:",
    analysis.finalPageSameOriginAnchors
  );

  console.log(
    "PRIMARY KEYWORD:",
    analysis.primaryAnchors.length
  );

  console.log(
    "ACTION KEYWORD:",
    analysis.actionAnchors.length
  );

  console.log(
    "CANDIDATE:",
    analysis.candidateAnchors.length
  );

  console.log(
    "NAVIGATION:",
    analysis.navigationAnchors.length
  );


  if (
    analysis.relatedLabels.length >
    0
  ) {

    console.log(
      ""
    );

    console.log(
      "------------------------------------"
    );

    console.log(
      "RELATED LABEL SAMPLE"
    );

    console.log(
      "------------------------------------"
    );


    analysis.relatedLabels
      .forEach(
        function (
          label
        ) {

          console.log(
            "-",
            label
          );
        }
      );
  }


  if (
    analysis.candidateAnchors.length >
    0
  ) {

    console.log(
      ""
    );

    console.log(
      "------------------------------------"
    );

    console.log(
      "CANDIDATE SAMPLE"
    );

    console.log(
      "------------------------------------"
    );


    analysis.candidateAnchors
      .slice(
        0,
        MAX_CANDIDATE_SAMPLES
      )
      .forEach(
        function (
          anchor
        ) {

          console.log(
            "🎯",
            anchor.label
          );

          console.log(
            "   ",
            anchor.url
          );
        }
      );
  }


  if (
    analysis.navigationAnchors.length >
    0
  ) {

    console.log(
      ""
    );

    console.log(
      "------------------------------------"
    );

    console.log(
      "TOP NAVIGATION SAMPLE"
    );

    console.log(
      "------------------------------------"
    );


    analysis.navigationAnchors
      .slice(
        0,
        MAX_NAV_SAMPLES
      )
      .forEach(
        function (
          anchor
        ) {

          console.log(
            "[" +
            followScore(
              anchor
            ) +
            "]",
            anchor.label || "(NO LABEL)"
          );

          console.log(
            "   ",
            anchor.url
          );
        }
      );
  }


  console.log(
    ""
  );

  console.log(
    "===================================="
  );

  console.log(
    "PROBE INTERPRETATION"
  );

  console.log(
    "===================================="
  );


  if (
    analysis.rawAnchors ===
    0
  ) {

    console.log(
      "⚠️ HTML은 받았지만 <a> 링크가 없습니다."
    );

    console.log(
      "→ JavaScript 렌더링/API 기반 페이지 가능성이 높습니다."
    );


  } else if (
    analysis.javascriptAnchors >
      0 &&
    analysis.parsedAnchors <
      analysis.rawAnchors * 0.5
  ) {

    console.log(
      "⚠️ javascript: 링크 비중이 높습니다."
    );

    console.log(
      "→ JavaScript Board Adapter 후보입니다."
    );


  } else if (
    analysis.collectorSameOriginAnchors ===
      0 &&
    analysis.finalPageSameOriginAnchors >
      0
  ) {

    console.log(
      "⚠️ 리다이렉트 후 Origin이 달라졌습니다."
    );

    console.log(
      "→ Collector sameOrigin 기준 수정이 필요할 수 있습니다."
    );


  } else if (
    analysis.primaryAnchors.length ===
    0
  ) {

    console.log(
      "ℹ️ 첫 페이지에 미술작품/공공미술 제목이 없습니다."
    );

    console.log(
      "→ 게시판 내부 탐색 또는 검색 Adapter가 필요할 수 있습니다."
    );


  } else if (
    analysis.primaryAnchors.length >
      0 &&
    analysis.candidateAnchors.length ===
      0
  ) {

    console.log(
      "⚠️ 미술작품 관련 제목은 있지만 후보 필터를 통과하지 못했습니다."
    );

    console.log(
      "→ 제목 패턴/필터 조건을 점검해야 합니다."
    );


  } else if (
    analysis.candidateAnchors.length >
    0
  ) {

    console.log(
      "✅ 첫 페이지에서 실제 공모 후보 탐지 성공."
    );


  } else {

    console.log(
      "ℹ️ 일반 HTML 링크는 정상 추출되고 있습니다."
    );

    console.log(
      "→ 다음 단계에서 게시판 탐색 경로를 확인하세요."
    );
  }


  console.log(
    "===================================="
  );
}


/* =========================================================
   RUN
========================================================= */

async function main() {

  const argument =
    String(
      process.argv[2] ||
      ""
    ).trim();


  if (
    !argument ||
    argument === "--list"
  ) {

    printSourceList();


    if (
      !argument
    ) {

      console.log(
        ""
      );

      console.log(
        "사용법:"
      );

      console.log(
        "node scripts/probe_art_source.js <SOURCE_ID>"
      );

      console.log(
        ""
      );

      console.log(
        "예:"
      );

      console.log(
        "node scripts/probe_art_source.js daejeon_city_notice"
      );

      console.log(
        "node scripts/probe_art_source.js artnuri_art_commission"
      );
    }


    return;
  }


  const target =
    findSource(
      argument
    );


  if (!target) {

    console.error(
      "❌ SOURCE ID를 찾을 수 없습니다:",
      argument
    );


    console.log(
      ""
    );


    printSourceList();


    process.exitCode =
      1;


    return;
  }


  console.log(
    ""
  );

  console.log(
    "🔎 SOURCE PROBE START"
  );

  console.log(
    "SOURCE ID:",
    target.source.id
  );

  console.log(
    "TIMEOUT:",
    FETCH_TIMEOUT_MS +
      "ms"
  );


  let fetchResult;


  try {

    fetchResult =
      await fetchPage(
        target.source.sourceUrl
      );


  } catch (
    error
  ) {

    console.error(
      ""
    );

    console.error(
      "===================================="
    );

    console.error(
      "SOURCE PROBE FAILED"
    );

    console.error(
      "===================================="
    );

    console.error(
      "SOURCE ID:",
      target.source.id
    );

    console.error(
      "REGION:",
      target.region.name
    );

    console.error(
      "SOURCE:",
      target.source.sourceName
    );

    console.error(
      "URL:",
      target.source.sourceUrl
    );

    console.error(
      "ERROR:",
      error.name,
      "|",
      error.message
    );

    console.error(
      "===================================="
    );


    process.exitCode =
      1;


    return;
  }


  const analysis =
    analyzePage(
      target.source,
      fetchResult
    );


  printResult(
    target,
    fetchResult,
    analysis
  );


  if (
    !fetchResult.ok
  ) {

    process.exitCode =
      1;
  }
}


/* =========================================================
   START
========================================================= */

main()
  .catch(
    function (
      error
    ) {

      console.error(
        "[AXOO ART SOURCE PROBE]",
        error
      );


      process.exitCode =
        1;
    }
  );
