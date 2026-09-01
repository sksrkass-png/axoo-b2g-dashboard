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

const {
  getSourceSeedUrls,
  describeSourceAdapter
} = require(
  "./art_source_adapters"
);


/* =========================================================
   CONFIG
========================================================= */

const FETCH_TIMEOUT_MS =
  8000;

const MAX_SEEDS_PER_SOURCE =
  3;

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
   SOURCE LIST
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

      const adapterInfo =
        describeSourceAdapter(
          entry.source
        );


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
        "   Adapter:",
        adapterInfo.adapterId
      );


      console.log(
        "   Seeds:",
        adapterInfo.seedUrls.length
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
              "Mozilla/5.0 (compatible; AXOO-B2G-SourceProbe/1.1)",

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
  seedUrl,
  fetchResult
) {

  const html =
    fetchResult.html ||
    "";


  const pageUrl =
    fetchResult.finalUrl ||
    seedUrl;


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


  /*
    Collector가 허용하는 Origin 기준과 동일하게
    원래 Source 또는 최종 페이지 Origin을 허용한다.
  */
  const allowedAnchors =
    anchors.filter(
      function (
        anchor
      ) {

        return (
          sameOrigin(
            source.sourceUrl,
            anchor.url
          ) ||
          sameOrigin(
            pageUrl,
            anchor.url
          )
        );
      }
    );


  const sourceOriginAnchors =
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
    allowedAnchors.filter(
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
    allowedAnchors.filter(
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
    allowedAnchors.filter(
      function (
        anchor
      ) {

        return isCandidateTitle(
          anchor.label
        );
      }
    );


  const navigationAnchors =
    allowedAnchors

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


  allowedAnchors.forEach(
    function (
      anchor
    ) {

      const label =
        cleanText(
          anchor.label
        );


      if (!label) {

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

    seedUrl:
      seedUrl,

    pageUrl:
      pageUrl,

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

    allowedAnchors:
      allowedAnchors.length,

    sourceOriginAnchors:
      sourceOriginAnchors.length,

    finalOriginAnchors:
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
   SEED RESULT
========================================================= */

function printSeedResult(
  index,
  seedUrl,
  fetchResult,
  analysis
) {

  const originChanged =
    !sameOrigin(
      seedUrl,
      fetchResult.finalUrl
    );


  console.log(
    ""
  );

  console.log(
    "------------------------------------"
  );

  console.log(
    "SEED #" +
    (
      index +
      1
    )
  );

  console.log(
    "------------------------------------"
  );


  console.log(
    "SEED URL:",
    seedUrl
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
    "ALLOWED ORIGIN:",
    analysis.allowedAnchors
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
      "RELATED LABEL SAMPLE:"
    );


    analysis.relatedLabels
      .forEach(
        function (
          label
        ) {

          console.log(
            "   -",
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
      "🎯 CANDIDATE SAMPLE:"
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
            "   -",
            anchor.label
          );


          console.log(
            "     ",
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
      "TOP NAVIGATION SAMPLE:"
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
            "   [" +
            followScore(
              anchor
            ) +
            "]",
            anchor.label ||
              "(NO LABEL)"
          );


          console.log(
            "     ",
            anchor.url
          );
        }
      );
  }
}


/* =========================================================
   COMBINED RESULT
========================================================= */

function buildCombinedResult(
  analyses
) {

  const candidateMap =
    new Map();


  const relatedLabelSet =
    new Set();


  let htmlBytes =
    0;

  let rawAnchors =
    0;

  let parsedAnchors =
    0;

  let javascriptAnchors =
    0;

  let allowedAnchors =
    0;

  let primaryAnchors =
    0;

  let actionAnchors =
    0;

  let navigationAnchors =
    0;


  analyses.forEach(
    function (
      analysis
    ) {

      htmlBytes +=
        analysis.htmlBytes;

      rawAnchors +=
        analysis.rawAnchors;

      parsedAnchors +=
        analysis.parsedAnchors;

      javascriptAnchors +=
        analysis.javascriptAnchors;

      allowedAnchors +=
        analysis.allowedAnchors;

      primaryAnchors +=
        analysis.primaryAnchors.length;

      actionAnchors +=
        analysis.actionAnchors.length;

      navigationAnchors +=
        analysis.navigationAnchors.length;


      analysis.candidateAnchors
        .forEach(
          function (
            anchor
          ) {

            if (
              !candidateMap.has(
                anchor.url
              )
            ) {

              candidateMap.set(
                anchor.url,
                anchor
              );
            }
          }
        );


      analysis.relatedLabels
        .forEach(
          function (
            label
          ) {

            relatedLabelSet.add(
              label
            );
          }
        );
    }
  );


  return {

    htmlBytes:
      htmlBytes,

    rawAnchors:
      rawAnchors,

    parsedAnchors:
      parsedAnchors,

    javascriptAnchors:
      javascriptAnchors,

    allowedAnchors:
      allowedAnchors,

    primaryAnchors:
      primaryAnchors,

    actionAnchors:
      actionAnchors,

    candidateAnchors:
      Array.from(
        candidateMap.values()
      ),

    navigationAnchors:
      navigationAnchors,

    relatedLabels:
      Array.from(
        relatedLabelSet
      )
  };
}


/* =========================================================
   INTERPRETATION
========================================================= */

function printInterpretation(
  successfulSeeds,
  failedSeeds,
  combined
) {

  console.log(
    ""
  );

  console.log(
    "===================================="
  );

  console.log(
    "PROBE SUMMARY"
  );

  console.log(
    "===================================="
  );


  console.log(
    "SUCCESSFUL SEEDS:",
    successfulSeeds
  );


  console.log(
    "FAILED SEEDS:",
    failedSeeds
  );


  console.log(
    "HTML KB:",
    Math.round(
      combined.htmlBytes /
      1024
    )
  );


  console.log(
    "RAW <a>:",
    combined.rawAnchors
  );


  console.log(
    "PARSED <a>:",
    combined.parsedAnchors
  );


  console.log(
    "JAVASCRIPT HREF:",
    combined.javascriptAnchors
  );


  console.log(
    "ALLOWED ORIGIN:",
    combined.allowedAnchors
  );


  console.log(
    "PRIMARY KEYWORD:",
    combined.primaryAnchors
  );


  console.log(
    "ACTION KEYWORD:",
    combined.actionAnchors
  );


  console.log(
    "UNIQUE CANDIDATE:",
    combined.candidateAnchors.length
  );


  console.log(
    "NAVIGATION:",
    combined.navigationAnchors
  );


  if (
    combined.candidateAnchors.length >
    0
  ) {

    console.log(
      ""
    );


    console.log(
      "===================================="
    );

    console.log(
      "🎯 UNIQUE CANDIDATES"
    );

    console.log(
      "===================================="
    );


    combined.candidateAnchors

      .slice(
        0,
        MAX_CANDIDATE_SAMPLES
      )

      .forEach(
        function (
          anchor
        ) {

          console.log(
            "-",
            anchor.label
          );


          console.log(
            " ",
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
    successfulSeeds ===
    0
  ) {

    console.log(
      "❌ 모든 Seed URL 접근에 실패했습니다."
    );


    console.log(
      "→ 네트워크 또는 Source URL 자체를 확인해야 합니다."
    );


  } else if (
    combined.rawAnchors ===
    0
  ) {

    console.log(
      "⚠️ HTML은 받았지만 <a> 링크가 없습니다."
    );


    console.log(
      "→ JavaScript 렌더링/API 기반 Adapter가 필요합니다."
    );


  } else if (
    combined.primaryAnchors ===
      0
  ) {

    console.log(
      "⚠️ 검색 Adapter를 적용했지만 미술작품 관련 제목이 발견되지 않았습니다."
    );


    console.log(
      "→ 검색 파라미터가 실제 사이트 검색에 반영되는지 확인해야 합니다."
    );


  } else if (
    combined.primaryAnchors >
      0 &&
    combined.candidateAnchors.length ===
      0
  ) {

    console.log(
      "⚠️ 미술작품 관련 결과는 발견했지만 Candidate Filter를 통과한 공고가 없습니다."
    );


    console.log(
      "→ 결과 제목 패턴과 Candidate Filter를 비교해야 합니다."
    );


  } else if (
    combined.candidateAnchors.length >
      0
  ) {

    console.log(
      "✅ Adapter를 통해 실제 공모 후보 탐지에 성공했습니다."
    );


    console.log(
      "→ 다음 단계는 상세페이지 정보 추출과 지역 판별입니다."
    );


  } else {

    console.log(
      "ℹ️ HTML 및 링크 탐색은 정상입니다."
    );


    console.log(
      "→ 게시판 상세 탐색 구조를 추가 확인하세요."
    );
  }


  console.log(
    "===================================="
  );
}


/* =========================================================
   PROBE
========================================================= */

async function probeSource(
  target
) {

  const source =
    target.source;


  const region =
    target.region;


  const adapterInfo =
    describeSourceAdapter(
      source
    );


  const seedUrls =
    getSourceSeedUrls(
      source,
      {
        maxSeeds:
          MAX_SEEDS_PER_SOURCE
      }
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
    "CRAWL MODE:",
    source.crawlMode ||
      ""
  );


  console.log(
    "SOURCE URL:",
    source.sourceUrl
  );


  console.log(
    ""
  );


  console.log(
    "ADAPTER APPLIED:",
    formatBoolean(
      adapterInfo.applied
    )
  );


  console.log(
    "ADAPTER ID:",
    adapterInfo.adapterId
  );


  console.log(
    "ADAPTER LABEL:",
    adapterInfo.adapterLabel
  );


  console.log(
    "ADAPTER MODE:",
    adapterInfo.mode
  );


  console.log(
    "SEED COUNT:",
    seedUrls.length
  );


  console.log(
    "TIMEOUT / SEED:",
    FETCH_TIMEOUT_MS +
      "ms"
  );


  if (
    seedUrls.length ===
    0
  ) {

    console.error(
      "❌ Probe 가능한 Seed URL이 없습니다."
    );


    process.exitCode =
      1;


    return;
  }


  const analyses =
    [];


  let successfulSeeds =
    0;


  let failedSeeds =
    0;


  for (
    let index = 0;
    index < seedUrls.length;
    index++
  ) {

    const seedUrl =
      seedUrls[
        index
      ];


    let fetchResult;


    try {

      fetchResult =
        await fetchPage(
          seedUrl
        );


      successfulSeeds++;


      const analysis =
        analyzePage(
          source,
          seedUrl,
          fetchResult
        );


      analyses.push(
        analysis
      );


      printSeedResult(
        index,
        seedUrl,
        fetchResult,
        analysis
      );


      if (
        !fetchResult.ok
      ) {

        console.log(
          "   ⚠️ HTTP 응답이 성공 상태가 아닙니다."
        );
      }


    } catch (
      error
    ) {

      failedSeeds++;


      console.log(
        ""
      );


      console.log(
        "------------------------------------"
      );


      console.log(
        "SEED #" +
        (
          index +
          1
        ) +
        " FAILED"
      );


      console.log(
        "------------------------------------"
      );


      console.log(
        "URL:",
        seedUrl
      );


      console.log(
        "ERROR:",
        error.name,
        "|",
        error.message
      );
    }
  }


  const combined =
    buildCombinedResult(
      analyses
    );


  printInterpretation(
    successfulSeeds,
    failedSeeds,
    combined
  );


  if (
    successfulSeeds ===
    0
  ) {

    process.exitCode =
      1;
  }
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
    argument ===
      "--list"
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


  await probeSource(
    target
  );
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
