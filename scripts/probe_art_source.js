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
  12;

const MAX_CANDIDATE_SAMPLES =
  12;


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
   COOKIE
========================================================= */

function getSetCookieValues(
  headers
) {

  if (!headers) {

    return [];
  }


  /*
    Node / undici에서 지원하는 경우
    Set-Cookie 각각을 안전하게 가져온다.
  */
  if (
    typeof headers.getSetCookie ===
      "function"
  ) {

    try {

      return headers
        .getSetCookie()
        .filter(
          Boolean
        );


    } catch (
      error
    ) {

      // fallback
    }
  }


  /*
    fallback
  */
  const raw =
    headers.get(
      "set-cookie"
    );


  return raw
    ? [
        raw
      ]
    : [];
}


function buildCookieHeader(
  setCookies
) {

  return setCookies

    .map(
      function (
        value
      ) {

        return String(
          value || ""
        )
          .split(
            ";"
          )[0]
          .trim();
      }
    )

    .filter(
      Boolean
    )

    .join(
      "; "
    );
}


function getCookieNames(
  cookieHeader
) {

  if (!cookieHeader) {

    return [];
  }


  return cookieHeader

    .split(
      ";"
    )

    .map(
      function (
        pair
      ) {

        return pair
          .trim()
          .split(
            "="
          )[0]
          .trim();
      }
    )

    .filter(
      Boolean
    );
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
   FETCH CORE
========================================================= */

async function fetchWithTimeout(
  url,
  options
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

          ...options,

          signal:
            controller.signal,

          redirect:
            "follow"
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

      setCookies:
        getSetCookieValues(
          response.headers
        ),

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
   PREFLIGHT SESSION
========================================================= */

async function createSession(
  source,
  requests
) {

  const firstRequest =
    requests[0];


  const preflightUrl =
    firstRequest
      ? firstRequest.url
      : source.sourceUrl;


  console.log(
    ""
  );


  console.log(
    "===================================="
  );


  console.log(
    "SESSION PREFLIGHT"
  );


  console.log(
    "===================================="
  );


  console.log(
    "GET:",
    preflightUrl
  );


  try {

    const response =
      await fetchWithTimeout(
        preflightUrl,
        {

          method:
            "GET",

          headers: {

            "User-Agent":
              "Mozilla/5.0 (compatible; AXOO-B2G-SourceProbe/1.4)",

            "Accept":
              "text/html,application/xhtml+xml,*/*",

            "Accept-Language":
              "ko-KR,ko;q=0.9,en;q=0.6"
          }
        }
      );


    const cookieHeader =
      buildCookieHeader(
        response.setCookies
      );


    console.log(
      "HTTP:",
      response.status
    );


    console.log(
      "FINAL URL:",
      response.finalUrl
    );


    console.log(
      "HTML KB:",
      Math.round(
        Buffer.byteLength(
          response.html || "",
          "utf8"
        ) /
        1024
      )
    );


    console.log(
      "SET-COOKIE COUNT:",
      response.setCookies.length
    );


    console.log(
      "COOKIE NAMES:",
      getCookieNames(
        cookieHeader
      ).join(
        ", "
      ) || "-"
    );


    console.log(
      "SESSION COOKIE:",
      cookieHeader
        ? "YES"
        : "NO"
    );


    return {

      ok:
        response.ok,

      cookieHeader:
        cookieHeader,

      referer:
        response.finalUrl ||
        preflightUrl
    };


  } catch (
    error
  ) {

    console.log(
      "PREFLIGHT ERROR:",
      error.name,
      "|",
      error.message
    );


    return {

      ok:
        false,

      cookieHeader:
        "",

      referer:
        preflightUrl
    };
  }
}


/* =========================================================
   REQUEST
========================================================= */

async function fetchRequest(
  request,
  session
) {

  const headers = {

    "User-Agent":
      "Mozilla/5.0 (compatible; AXOO-B2G-SourceProbe/1.4)",

    "Accept":
      "text/html,application/xhtml+xml,*/*",

    "Accept-Language":
      "ko-KR,ko;q=0.9,en;q=0.6",

    ...(
      request.headers ||
      {}
    )
  };


  if (
    session &&
    session.cookieHeader
  ) {

    headers.Cookie =
      session.cookieHeader;
  }


  if (
    session &&
    session.referer
  ) {

    headers.Referer =
      session.referer;
  }


  const options = {

    method:
      request.method ||
      "GET",

    headers:
      headers
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


  return fetchWithTimeout(
    request.url,
    options
  );
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


      if (
        !label ||
        !/미술|작품|공공미술|공모|설치|건축/i.test(
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


  const htmlText =
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
      (
        html.match(
          /<a\b/gi
        ) || []
      ).length,

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

    relatedLabels:
      relatedLabels,

    searchTermEchoed:
      searchTerm
        ? htmlText.includes(
            searchTerm
          )
        : false
  };
}


/* =========================================================
   PRINT
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
    "HTTP:",
    response.status
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
    "HTML KB:",
    Math.round(
      analysis.htmlBytes /
      1024
    )
  );


  console.log(
    "SEARCH TERM:",
    analysis.searchTerm ||
    "-"
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


  if (
    analysis.relatedLabels.length
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
    analysis.candidateAnchors.length
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
}


/* =========================================================
   PROBE
========================================================= */

async function probeSource(
  target
) {

  const source =
    target.source;


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
    "AXOO ART SOURCE SESSION PROBE"
  );


  console.log(
    "===================================="
  );


  console.log(
    "SOURCE:",
    source.sourceName
  );


  console.log(
    "ADAPTER:",
    adapterInfo.adapterId
  );


  console.log(
    "REQUESTS:",
    requests.length
  );


  if (
    !requests.length
  ) {

    throw new Error(
      "실행 가능한 Request가 없습니다."
    );
  }


  /*
    브라우저처럼 먼저 GET하여 세션 확보
  */
  const session =
    await createSession(
      source,
      requests
    );


  let successfulRequests =
    0;


  let rejectedRequests =
    0;


  let totalPrimary =
    0;


  let totalCandidate =
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
          request,
          session
        );


      const analysis =
        analyzeResponse(
          source,
          request,
          response
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


      totalPrimary +=
        analysis.primaryAnchors.length;


      totalCandidate +=
        analysis.candidateAnchors.length;


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
    "SESSION PREFLIGHT:",
    session.ok
      ? "OK"
      : "FAILED"
  );


  console.log(
    "SESSION COOKIE:",
    session.cookieHeader
      ? "YES"
      : "NO"
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
    "PRIMARY KEYWORD:",
    totalPrimary
  );


  console.log(
    "CANDIDATE:",
    totalCandidate
  );


  console.log(
    "===================================="
  );


  if (
    successfulRequests >
      0
  ) {

    console.log(
      "✅ 세션 기반 POST 요청이 서버에서 정상 처리되었습니다."
    );


  } else {

    console.log(
      "::warning title=ArtNuri POST probe rejected::" +
      "세션 확보 후에도 POST 요청이 거절되었습니다."
    );


    console.log(
      "⚠️ 다음 단계에서는 fn_egov_link_page()의 실제 action/method 변경 코드를 추출해야 합니다."
    );
  }


  /*
    중요:
    Probe는 외부 사이트 상태를 진단하는 도구다.
    HTTP 404/403 때문에 GitHub Action 자체를 실패시키지 않는다.
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
    "🔎 SOURCE SESSION PROBE START"
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

      /*
        코드 오류/구성 오류는 실제 실패 처리.
        외부 사이트 HTTP 거절은 probeSource 안에서 warning 처리.
      */

      console.error(
        "[AXOO ART SOURCE SESSION PROBE]",
        error
      );


      process.exitCode =
        1;
    }
  );
