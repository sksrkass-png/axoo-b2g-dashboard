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
  followScore
} = require(
  "./collect_remaining_art_commissions"
);

const {
  getSourceRequests,
  describeSourceAdapter,
  describeRequest
} = require(
  "./art_source_adapters"
);


/* =========================================================
   CONFIG
========================================================= */

const FETCH_TIMEOUT_MS =
  8000;

const MAX_REQUESTS_PER_SOURCE =
  3;

const MAX_LABEL_SAMPLES =
  15;

const MAX_CANDIDATE_SAMPLES =
  15;

const MAX_NAV_SAMPLES =
  10;


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


/* =========================================================
   HELPERS
========================================================= */

function hasAnyKeyword(
  text,
  keywords
) {

  const value =
    String(
      text || ""
    );


  return keywords.some(
    function (
      keyword
    ) {

      return value.includes(
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
      new URL(first).origin ===
      new URL(second).origin
    );


  } catch (
    error
  ) {

    return false;
  }
}


function getSearchTerm(
  request
) {

  if (
    !request ||
    !request.url
  ) {

    return "";
  }


  try {

    const url =
      new URL(
        request.url
      );


    return (
      url.searchParams.get(
        "sw"
      ) ||
      ""
    );


  } catch (
    error
  ) {

    return "";
  }
}


/* =========================================================
   SOURCE REGISTRY
========================================================= */

function loadAllSources() {

  const result =
    [];


  getRegionalSources()
    .forEach(
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
   FETCH
========================================================= */

async function fetchRequest(
  request
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
        request.url,
        {

          method:
            request.method ||
            "GET",

          signal:
            controller.signal,

          redirect:
            "follow",

          headers: {

            "User-Agent":
              "Mozilla/5.0 (compatible; AXOO-B2G-GETFormProbe/1.0)",

            "Accept":
              "text/html,application/xhtml+xml,*/*",

            "Accept-Language":
              "ko-KR,ko;q=0.9,en;q=0.6",

            ...(
              request.headers ||
              {}
            )
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

function analyzeResponse(
  source,
  request,
  response
) {

  const html =
    response.html ||
    "";


  const pageUrl =
    response.finalUrl ||
    request.url;


  const searchTerm =
    getSearchTerm(
      request
    );


  const text =
    cleanText(
      html
    );


  const rawAnchors =
    (
      html.match(
        /<a\b/gi
      ) || []
    ).length;


  const anchors =
    extractAnchors(
      html,
      pageUrl
    );


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
            ) >
            0
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
        !/건축|미술|예술|작품|공모|설치|공동주택|art/i.test(
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

    searchTerm:
      searchTerm,

    searchTermEchoed:
      searchTerm
        ? text.includes(
            searchTerm
          )
        : false,

    htmlBytes:
      Buffer.byteLength(
        html,
        "utf8"
      ),

    rawAnchors:
      rawAnchors,

    parsedAnchors:
      anchors.length,

    allowedAnchors:
      allowedAnchors.length,

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

function printRequestResult(
  index,
  request,
  response,
  analysis
) {

  console.log(
    ""
  );


  console.log(
    "------------------------------------"
  );


  console.log(
    "REQUEST #" +
    (
      index +
      1
    )
  );


  console.log(
    "------------------------------------"
  );


  console.log(
    "REQUEST:",
    describeRequest(
      request
    )
  );


  console.log(
    "METHOD:",
    request.method
  );


  console.log(
    "SEARCH TERM:",
    analysis.searchTerm ||
    "-"
  );


  console.log(
    "HTTP:",
    response.status,
    response.statusText
  );


  console.log(
    "FINAL URL:",
    response.finalUrl
  );


  console.log(
    "TIME:",
    response.elapsedMs +
    "ms"
  );


  console.log(
    "CONTENT TYPE:",
    response.contentType
  );


  console.log(
    "HTML KB:",
    Math.round(
      analysis.htmlBytes /
      1024
    )
  );


  console.log(
    "SEARCH TERM ECHOED:",
    analysis.searchTermEchoed
      ? "YES"
      : "NO"
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
        }
      );
  }
}


/* =========================================================
   COMBINE
========================================================= */

function combineAnalyses(
  analyses
) {

  const candidateMap =
    new Map();


  let htmlBytes =
    0;

  let rawAnchors =
    0;

  let parsedAnchors =
    0;

  let primaryAnchors =
    0;

  let actionAnchors =
    0;

  let navigationAnchors =
    0;

  let echoedCount =
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


      primaryAnchors +=
        analysis.primaryAnchors.length;


      actionAnchors +=
        analysis.actionAnchors.length;


      navigationAnchors +=
        analysis.navigationAnchors.length;


      if (
        analysis.searchTermEchoed
      ) {

        echoedCount++;
      }


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
    }
  );


  return {

    htmlBytes:
      htmlBytes,

    rawAnchors:
      rawAnchors,

    parsedAnchors:
      parsedAnchors,

    primaryAnchors:
      primaryAnchors,

    actionAnchors:
      actionAnchors,

    navigationAnchors:
      navigationAnchors,

    echoedCount:
      echoedCount,

    candidateAnchors:
      Array.from(
        candidateMap.values()
      )
  };
}


/* =========================================================
   SUMMARY
========================================================= */

function printSummary(
  requestCount,
  successfulRequests,
  rejectedRequests,
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
    "REQUESTS:",
    requestCount
  );


  console.log(
    "SUCCESSFUL REQUESTS:",
    successfulRequests
  );


  console.log(
    "REJECTED REQUESTS:",
    rejectedRequests
  );


  console.log(
    "SEARCH TERM ECHO:",
    combined.echoedCount +
    "/" +
    successfulRequests
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
    successfulRequests ===
    0
  ) {

    console.log(
      "⚠️ GET Form Request가 모두 거절되었습니다."
    );


    console.log(
      "→ URL/Form parameter 구조를 다시 확인해야 합니다."
    );


  } else if (
    combined.candidateAnchors.length >
      0
  ) {

    console.log(
      "✅ 아트누리 GET Form 검색으로 실제 공모 후보 탐지 성공."
    );


    console.log(
      "→ Adapter 검색 단계 검증 완료."
    );


    console.log(
      "→ 다음 단계: 지역 판별 + 상세페이지 + 마감일 추출."
    );


  } else if (
    combined.primaryAnchors >
      0
  ) {

    console.log(
      "🟡 GET Form 검색 결과에 미술작품 관련 항목이 존재합니다."
    );


    console.log(
      "→ Candidate Filter와 결과 제목 구조를 확인해야 합니다."
    );


  } else if (
    combined.echoedCount >
      0
  ) {

    console.log(
      "🟡 검색어는 서버에 정상 반영됐지만 현재 결과에서 관련 공고를 발견하지 못했습니다."
    );


    console.log(
      "→ 검색 자체는 동작하는 것으로 볼 수 있습니다."
    );


  } else {

    console.log(
      "⚠️ HTTP 200은 받았지만 검색어 반영 여부가 확인되지 않았습니다."
    );


    console.log(
      "→ Form parameter 또는 결과 렌더링 구조를 추가 확인해야 합니다."
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


  const adapter =
    describeSourceAdapter(
      source
    );


  const requests =
    getSourceRequests(
      source,
      {
        maxRequests:
          MAX_REQUESTS_PER_SOURCE
      }
    );


  console.log(
    ""
  );


  console.log(
    "===================================="
  );


  console.log(
    "AXOO ART SOURCE GET FORM PROBE"
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
    target.region.name
  );


  console.log(
    "SOURCE:",
    source.sourceName
  );


  console.log(
    "ADAPTER:",
    adapter.adapterId
  );


  console.log(
    "ADAPTER MODE:",
    adapter.mode
  );


  console.log(
    "REQUEST COUNT:",
    requests.length
  );


  if (
    requests.length ===
    0
  ) {

    throw new Error(
      "실행 가능한 Request가 없습니다."
    );
  }


  const analyses =
    [];


  let successfulRequests =
    0;


  let rejectedRequests =
    0;


  for (
    let index = 0;
    index < requests.length;
    index++
  ) {

    const request =
      requests[
        index
      ];


    try {

      const response =
        await fetchRequest(
          request
        );


      const analysis =
        analyzeResponse(
          source,
          request,
          response
        );


      analyses.push(
        analysis
      );


      printRequestResult(
        index,
        request,
        response,
        analysis
      );


      if (
        response.ok
      ) {

        successfulRequests++;

      } else {

        rejectedRequests++;
      }


    } catch (
      error
    ) {

      rejectedRequests++;


      console.log(
        ""
      );


      console.log(
        "REQUEST #" +
        (
          index +
          1
        ) +
        " ERROR:"
      );


      console.log(
        error.name,
        "|",
        error.message
      );
    }
  }


  const combined =
    combineAnalyses(
      analyses
    );


  printSummary(
    requests.length,
    successfulRequests,
    rejectedRequests,
    combined
  );


  /*
    Probe는 외부 사이트 결과를 진단하는 도구이므로
    0건 또는 HTTP 거절만으로 Action을 실패시키지 않는다.
  */
}


/* =========================================================
   RUN
========================================================= */

async function main() {

  const sourceId =
    String(
      process.argv[2] ||
      ""
    )
      .trim();


  if (!sourceId) {

    throw new Error(
      "SOURCE_ID가 필요합니다."
    );
  }


  const target =
    findSource(
      sourceId
    );


  if (!target) {

    throw new Error(
      "SOURCE ID를 찾을 수 없습니다: " +
      sourceId
    );
  }


  console.log(
    ""
  );


  console.log(
    "🔎 GET FORM PROBE START"
  );


  console.log(
    "SOURCE ID:",
    sourceId
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
        "[AXOO ART SOURCE GET FORM PROBE]",
        error
      );


      process.exitCode =
        1;
    }
  );
