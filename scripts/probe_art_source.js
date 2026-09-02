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


function getRequestSearchTerm(
  request
) {

  if (
    !request ||
    !request.body
  ) {

    return "";
  }


  try {

    const params =
      new URLSearchParams(
        request.body
      );


    return (
      params.get(
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
   SOURCE LIST
========================================================= */

function printSourceList() {

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


  loadAllSources()
    .forEach(
      function (
        entry
      ) {

        const adapter =
          describeSourceAdapter(
            entry.source
          );


        console.log(
          entry.source.id +
          " | " +
          entry.region.name +
          " | " +
          adapter.adapterId
        );
      }
    );


  console.log(
    "===================================="
  );
}


/* =========================================================
   FETCH REQUEST
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

    const headers = {

      "User-Agent":
        "Mozilla/5.0 (compatible; AXOO-B2G-SourceProbe/1.3)",

      "Accept":
        "text/html,application/xhtml+xml,*/*",

      "Accept-Language":
        "ko-KR,ko;q=0.9,en;q=0.6",

      ...(
        request.headers ||
        {}
      )
    };


    const options = {

      method:
        request.method ||
        "GET",

      headers:
        headers,

      signal:
        controller.signal,

      redirect:
        "follow"
    };


    if (
      request.method !==
        "GET" &&
      request.method !==
        "HEAD" &&
      request.body != null
    ) {

      options.body =
        request.body;
    }


    const response =
      await fetch(
        request.url,
        options
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
   ANALYSIS
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
        !/미술|예술|작품|공모|건축|설치|art/i.test(
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


  const searchTerm =
    getRequestSearchTerm(
      request
    );


  const normalizedHtmlText =
    cleanText(
      html
    );


  return {

    searchTerm:
      searchTerm,

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

    primaryAnchors:
      primaryAnchors,

    actionAnchors:
      actionAnchors,

    candidateAnchors:
      candidateAnchors,

    navigationAnchors:
      navigationAnchors,

    relatedLabels:
      relatedLabels,

    searchTermEchoed:
      searchTerm
        ? normalizedHtmlText.includes(
            searchTerm
          )
        : false
  };
}


/* =========================================================
   PRINT REQUEST RESULT
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
    "URL:",
    request.url
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

function combineAnalyses(
  analyses
) {

  const candidateMap =
    new Map();


  const labelSet =
    new Set();


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

  let searchTermEchoCount =
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

        searchTermEchoCount++;
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


      analysis.relatedLabels
        .forEach(
          function (
            label
          ) {

            labelSet.add(
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

    primaryAnchors:
      primaryAnchors,

    actionAnchors:
      actionAnchors,

    navigationAnchors:
      navigationAnchors,

    searchTermEchoCount:
      searchTermEchoCount,

    candidateAnchors:
      Array.from(
        candidateMap.values()
      ),

    relatedLabels:
      Array.from(
        labelSet
      )
  };
}


/* =========================================================
   SUMMARY
========================================================= */

function printSummary(
  requestCount,
  successCount,
  failedCount,
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
    successCount
  );


  console.log(
    "FAILED REQUESTS:",
    failedCount
  );


  console.log(
    "SEARCH TERM ECHO:",
    combined.searchTermEchoCount +
    "/" +
    successCount
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
    successCount ===
    0
  ) {

    console.log(
      "❌ 모든 Request가 실패했습니다."
    );


    console.log(
      "→ 네트워크 또는 POST 요청 구성을 다시 확인해야 합니다."
    );


  } else if (
    combined.primaryAnchors >
      0 &&
    combined.candidateAnchors.length >
      0
  ) {

    console.log(
      "✅ POST 검색을 통해 실제 건축물 미술작품 공모 후보를 탐지했습니다."
    );


    console.log(
      "→ 아트누리 Adapter 검색 단계 성공."
    );


    console.log(
      "→ 다음 단계는 상세페이지/지역/마감일 추출입니다."
    );


  } else if (
    combined.primaryAnchors >
      0
  ) {

    console.log(
      "🟡 POST 검색 자체는 동작하고 미술작품 관련 결과가 나옵니다."
    );


    console.log(
      "→ Candidate Filter 또는 결과 링크 구조를 다음으로 확인해야 합니다."
    );


  } else if (
    combined.searchTermEchoCount >
      0
  ) {

    console.log(
      "🟡 검색어는 서버 응답에 반영됐지만 결과 링크에서 미술작품 제목을 찾지 못했습니다."
    );


    console.log(
      "→ 결과가 별도 AJAX/DOM 구조인지 확인해야 합니다."
    );


  } else {

    console.log(
      "⚠️ POST 요청은 200 응답이지만 검색 결과 반영 여부를 확인하지 못했습니다."
    );


    console.log(
      "→ 실제 Browser submit과 Request 차이를 추가 진단해야 합니다."
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
    "AXOO ART SOURCE REQUEST PROBE"
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
    "SOURCE URL:",
    source.sourceUrl
  );


  console.log(
    "ADAPTER APPLIED:",
    adapterInfo.applied
      ? "YES"
      : "NO"
  );


  console.log(
    "ADAPTER ID:",
    adapterInfo.adapterId
  );


  console.log(
    "ADAPTER MODE:",
    adapterInfo.mode
  );


  console.log(
    "REQUEST COUNT:",
    requests.length
  );


  console.log(
    "TIMEOUT / REQUEST:",
    FETCH_TIMEOUT_MS +
    "ms"
  );


  if (
    requests.length ===
    0
  ) {

    console.error(
      "❌ 실행 가능한 Request가 없습니다."
    );


    process.exitCode =
      1;


    return;
  }


  const analyses =
    [];


  let successCount =
    0;


  let failedCount =
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


      if (
        response.ok
      ) {

        successCount++;


      } else {

        failedCount++;
      }


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


    } catch (
      error
    ) {

      failedCount++;


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
        ) +
        " FAILED"
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
        "ERROR:",
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
    successCount,
    failedCount,
    combined
  );


  if (
    successCount ===
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
    )
      .trim();


  if (
    !argument ||
    argument ===
      "--list"
  ) {

    printSourceList();


    console.log(
      ""
    );


    console.log(
      "사용법:"
    );


    console.log(
      "node scripts/probe_art_source.js <SOURCE_ID>"
    );


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


    process.exitCode =
      1;


    return;
  }


  console.log(
    ""
  );


  console.log(
    "🔎 SOURCE REQUEST PROBE START"
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
        "[AXOO ART SOURCE REQUEST PROBE]",
        error
      );


      process.exitCode =
        1;
    }
  );
