const {
  spawnSync
} = require(
  "child_process"
);

const {
  extractArtDetail
} = require(
  "./art_detail_extractor"
);


/* ============================================================
   AXOO ART LIVE DETAIL SMOKE TEST
   VERSION: 1.2.0
============================================================

   목적
   ------------------------------------------------------------
   실제 공공기관 상세페이지
   → 실제 HTML 수신
   → Detail Extractor 실행
   → 실제 공고일 / 마감일 검증

   네트워크 전략
   ------------------------------------------------------------
   1. Node fetch
   2. curl IPv4
   3. AXOO B2G Fetch Bridge

   데이터는 절대 수정하지 않는다.
============================================================ */


/* ============================================================
   TARGET
============================================================ */

const TARGET_TITLE =
  "남양주왕숙2A-1 신축공사 內 미술작품 제작 및 설치 공모 공고";


const TARGET_URL =
  "https://www.gg.go.kr/publicart/bbs/boardView.do?bsIdx=825&bIdx=110904626&menuId=3865";


const EXPECTED_PUBLISHED_DATE =
  "2026-08-10";


const EXPECTED_DEADLINE =
  "2026-08-29";


/* ============================================================
   FETCH BRIDGE
============================================================ */

const FETCH_BRIDGE_URL =
  "https://script.google.com/macros/s/AKfycbzu4m0lNbY5RzXFuKTR3C6H2hd_swAfLTdyZeERGqM3XrChjBrT46cWdiWTQGWSn9-4aQ/exec";


const FETCH_BRIDGE_TARGET =
  "gyeonggi_known_detail";


/* ============================================================
   CONFIG
============================================================ */

const NODE_FETCH_TIMEOUT_MS =
  15000;


const CURL_CONNECT_TIMEOUT_SECONDS =
  20;


const CURL_MAX_TIME_SECONDS =
  45;


const BRIDGE_TIMEOUT_MS =
  30000;


const MIN_HTML_BYTES =
  1000;


const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/151.0.0.0 Safari/537.36";


/* ============================================================
   RESULT COUNTERS
============================================================ */

let passCount =
  0;


let failCount =
  0;


/* ============================================================
   ASSERT
============================================================ */

function pass(
  name,
  value
) {

  passCount++;


  console.log(
    "✅ PASS |",
    name,
    value !== undefined
      ? "| " + value
      : ""
  );
}


function fail(
  name,
  expected,
  actual
) {

  failCount++;


  console.log(
    "❌ FAIL |",
    name
  );


  console.log(
    "   expected:",
    expected
  );


  console.log(
    "   actual:",
    actual
  );
}


function assertEqual(
  name,
  actual,
  expected
) {

  if (
    actual ===
    expected
  ) {

    pass(
      name,
      actual
    );


    return;
  }


  fail(
    name,
    expected,
    actual
  );
}


function assertTrue(
  name,
  actual,
  description
) {

  if (
    Boolean(
      actual
    )
  ) {

    pass(
      name,
      description
    );


    return;
  }


  fail(
    name,
    true,
    actual
  );
}


/* ============================================================
   NODE FETCH
============================================================ */

async function fetchWithNode(
  url
) {

  const controller =
    new AbortController();


  const timer =
    setTimeout(
      function () {

        controller.abort();

      },
      NODE_FETCH_TIMEOUT_MS
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
              USER_AGENT,

            "Accept":
              "text/html,application/xhtml+xml,*/*",

            "Accept-Language":
              "ko-KR,ko;q=0.9,en;q=0.7"
          }
        }
      );


    const html =
      await response.text();


    return {

      success:
        response.ok,

      transport:
        "node-fetch",

      status:
        response.status,

      finalUrl:
        response.url ||
        url,

      html:
        html,

      error:
        ""
    };


  } catch (
    error
  ) {

    return {

      success:
        false,

      transport:
        "node-fetch",

      status:
        0,

      finalUrl:
        url,

      html:
        "",

      error:
        (
          error &&
          (
            error.stack ||
            error.message
          )
        ) ||
        String(
          error
        )
    };


  } finally {

    clearTimeout(
      timer
    );
  }
}


/* ============================================================
   CURL IPv4
============================================================ */

function fetchWithCurlIPv4(
  url
) {

  const args = [

    "-4",

    "--http1.1",

    "--location",

    "--silent",

    "--show-error",

    "--compressed",

    "--connect-timeout",
    String(
      CURL_CONNECT_TIMEOUT_SECONDS
    ),

    "--max-time",
    String(
      CURL_MAX_TIME_SECONDS
    ),

    "--user-agent",
    USER_AGENT,

    "--header",
    "Accept: text/html,application/xhtml+xml,*/*",

    "--header",
    "Accept-Language: ko-KR,ko;q=0.9,en;q=0.7",

    "--write-out",
    "\n__AXOO_HTTP_STATUS__:%{http_code}\n" +
    "__AXOO_FINAL_URL__:%{url_effective}\n",

    url
  ];


  const result =
    spawnSync(
      "curl",
      args,
      {

        encoding:
          "utf8",

        maxBuffer:
          20 *
          1024 *
          1024
      }
    );


  const stdout =
    String(
      result.stdout ||
      ""
    );


  const stderr =
    String(
      result.stderr ||
      ""
    );


  const statusMatch =
    stdout.match(
      /\n__AXOO_HTTP_STATUS__:(\d{3})\n/
    );


  const finalUrlMatch =
    stdout.match(
      /\n__AXOO_FINAL_URL__:(.+)\n?$/
    );


  const status =
    statusMatch
      ? Number(
          statusMatch[1]
        )
      : 0;


  const finalUrl =
    finalUrlMatch
      ? finalUrlMatch[1].trim()
      : url;


  const html =
    stdout

      .replace(
        /\n__AXOO_HTTP_STATUS__:\d{3}\n/,
        "\n"
      )

      .replace(
        /\n__AXOO_FINAL_URL__:.+\n?$/,
        ""
      );


  return {

    success:
      result.status ===
        0 &&
      status >=
        200 &&
      status <
        400,

    transport:
      "curl-ipv4",

    status:
      status,

    finalUrl:
      finalUrl,

    html:
      html,

    error:
      stderr,

    exitCode:
      result.status
  };
}


/* ============================================================
   APPS SCRIPT BRIDGE
============================================================ */

async function fetchWithBridge() {

  const controller =
    new AbortController();


  const timer =
    setTimeout(
      function () {

        controller.abort();

      },
      BRIDGE_TIMEOUT_MS
    );


  try {

    const url =
      new URL(
        FETCH_BRIDGE_URL
      );


    url.searchParams.set(
      "action",
      "fetch"
    );


    url.searchParams.set(
      "target",
      FETCH_BRIDGE_TARGET
    );


    const response =
      await fetch(
        url.toString(),
        {

          signal:
            controller.signal,

          redirect:
            "follow",

          headers: {

            "User-Agent":
              USER_AGENT,

            "Accept":
              "application/json,text/plain,*/*"
          }
        }
      );


    const text =
      await response.text();


    if (
      !response.ok
    ) {

      return {

        success:
          false,

        transport:
          "apps-script-bridge",

        status:
          response.status,

        finalUrl:
          TARGET_URL,

        html:
          "",

        error:
          "Bridge HTTP " +
          response.status
      };
    }


    let payload;


    try {

      payload =
        JSON.parse(
          text
        );


    } catch (
      error
    ) {

      return {

        success:
          false,

        transport:
          "apps-script-bridge",

        status:
          response.status,

        finalUrl:
          TARGET_URL,

        html:
          "",

        error:
          "Bridge JSON parse failed: " +
          error.message
      };
    }


    if (
      !payload ||
      payload.ok !==
        true
    ) {

      return {

        success:
          false,

        transport:
          "apps-script-bridge",

        status:
          payload &&
          payload.upstreamStatus
            ? payload.upstreamStatus
            : response.status,

        finalUrl:
          payload &&
          payload.upstreamUrl
            ? payload.upstreamUrl
            : TARGET_URL,

        html:
          "",

        error:
          (
            payload &&
            (
              payload.message ||
              payload.error
            )
          ) ||
          "Bridge returned ok=false"
      };
    }


    const base64 =
      String(
        payload.htmlBase64 ||
        ""
      );


    if (
      !base64
    ) {

      return {

        success:
          false,

        transport:
          "apps-script-bridge",

        status:
          payload.upstreamStatus ||
          0,

        finalUrl:
          payload.upstreamUrl ||
          TARGET_URL,

        html:
          "",

        error:
          "htmlBase64 is empty"
      };
    }


    let html;


    try {

      html =
        Buffer
          .from(
            base64,
            "base64"
          )
          .toString(
            "utf8"
          );


    } catch (
      error
    ) {

      return {

        success:
          false,

        transport:
          "apps-script-bridge",

        status:
          payload.upstreamStatus ||
          0,

        finalUrl:
          payload.upstreamUrl ||
          TARGET_URL,

        html:
          "",

        error:
          "Base64 decode failed: " +
          error.message
      };
    }


    return {

      success:
        payload.upstreamStatus >=
          200 &&
        payload.upstreamStatus <
          400 &&
        html.length >
          0,

      transport:
        "apps-script-bridge",

      status:
        payload.upstreamStatus,

      finalUrl:
        payload.upstreamUrl ||
        TARGET_URL,

      html:
        html,

      error:
        "",

      bridgeMeta: {

        chars:
          payload.chars,

        bytes:
          payload.bytes,

        truncated:
          payload.truncated,

        hasArtKeyword:
          payload.hasArtKeyword,

        hasTargetTitle:
          payload.hasTargetTitle
      }
    };


  } catch (
    error
  ) {

    return {

      success:
        false,

      transport:
        "apps-script-bridge",

      status:
        0,

      finalUrl:
        TARGET_URL,

      html:
        "",

      error:
        (
          error &&
          (
            error.stack ||
            error.message
          )
        ) ||
        String(
          error
        )
    };


  } finally {

    clearTimeout(
      timer
    );
  }
}


/* ============================================================
   NETWORK FALLBACK CHAIN
============================================================ */

async function fetchLivePage(
  url
) {

  /* ----------------------------------------------------------
     STEP 1
  ---------------------------------------------------------- */

  console.log(
    "NETWORK STEP 1:",
    "Node fetch"
  );


  const nodeResult =
    await fetchWithNode(
      url
    );


  if (
    nodeResult.success &&
    Buffer.byteLength(
      nodeResult.html,
      "utf8"
    ) >=
      MIN_HTML_BYTES
  ) {

    console.log(
      "✅ NODE FETCH SUCCESS"
    );


    return nodeResult;
  }


  console.log(
    "⚠️ NODE FETCH FAILED"
  );


  if (
    nodeResult.error
  ) {

    console.log(
      "   error:",
      nodeResult.error
        .split(
          "\n"
        )[0]
    );
  }


  /* ----------------------------------------------------------
     STEP 2
  ---------------------------------------------------------- */

  console.log(
    ""
  );


  console.log(
    "NETWORK STEP 2:",
    "curl IPv4 GET fallback"
  );


  const curlResult =
    fetchWithCurlIPv4(
      url
    );


  if (
    curlResult.success &&
    Buffer.byteLength(
      curlResult.html,
      "utf8"
    ) >=
      MIN_HTML_BYTES
  ) {

    console.log(
      "✅ CURL IPv4 SUCCESS"
    );


    return curlResult;
  }


  console.log(
    "⚠️ CURL IPv4 FAILED"
  );


  console.log(
    "   exitCode:",
    curlResult.exitCode
  );


  console.log(
    "   httpStatus:",
    curlResult.status ||
      "-"
  );


  if (
    curlResult.error
  ) {

    console.log(
      "   error:",
      curlResult.error
        .trim()
        .split(
          "\n"
        )[0]
    );
  }


  /* ----------------------------------------------------------
     STEP 3
  ---------------------------------------------------------- */

  console.log(
    ""
  );


  console.log(
    "NETWORK STEP 3:",
    "AXOO B2G Fetch Bridge"
  );


  const bridgeResult =
    await fetchWithBridge();


  if (
    bridgeResult.success
  ) {

    console.log(
      "✅ FETCH BRIDGE SUCCESS",
      "| HTTP",
      bridgeResult.status
    );


    if (
      bridgeResult.bridgeMeta
    ) {

      console.log(
        "   chars:",
        bridgeResult.bridgeMeta.chars
      );


      console.log(
        "   bytes:",
        bridgeResult.bridgeMeta.bytes
      );


      console.log(
        "   truncated:",
        bridgeResult.bridgeMeta.truncated
      );


      console.log(
        "   hasArtKeyword:",
        bridgeResult.bridgeMeta.hasArtKeyword
      );


      console.log(
        "   hasTargetTitle:",
        bridgeResult.bridgeMeta.hasTargetTitle
      );
    }


    return bridgeResult;
  }


  console.log(
    "❌ FETCH BRIDGE FAILED"
  );


  console.log(
    "   status:",
    bridgeResult.status ||
      "-"
  );


  console.log(
    "   error:",
    bridgeResult.error ||
      "-"
  );


  return bridgeResult;
}


/* ============================================================
   LIVE SMOKE
============================================================ */

async function runLiveSmoke() {

  console.log(
    ""
  );


  console.log(
    "===================================="
  );


  console.log(
    "AXOO ART LIVE DETAIL SMOKE TEST"
  );


  console.log(
    "===================================="
  );


  console.log(
    "VERSION:",
    "1.2.0"
  );


  console.log(
    "TITLE:",
    TARGET_TITLE
  );


  console.log(
    "URL:",
    TARGET_URL
  );


  console.log(
    "MODE:",
    "READ ONLY"
  );


  console.log(
    ""
  );


  const fetched =
    await fetchLivePage(
      TARGET_URL
    );


  console.log(
    ""
  );


  console.log(
    "------------------------------------"
  );


  console.log(
    "NETWORK RESULT"
  );


  console.log(
    "------------------------------------"
  );


  console.log(
    "transport:",
    fetched.transport
  );


  console.log(
    "status:",
    fetched.status ||
      "-"
  );


  console.log(
    "finalUrl:",
    fetched.finalUrl ||
      "-"
  );


  console.log(
    "htmlBytes:",
    Buffer.byteLength(
      fetched.html ||
      "",
      "utf8"
    )
  );


  console.log(
    "------------------------------------"
  );


  if (
    !fetched.success
  ) {

    failCount++;


    console.error(
      "❌ LIVE PAGE NETWORK ACCESS FAILED"
    );


    return;
  }


  /* ----------------------------------------------------------
     NETWORK CHECK
  ---------------------------------------------------------- */

  assertTrue(
    "HTTP 응답 성공",
    fetched.status >=
      200 &&
    fetched.status <
      400,
    "HTTP " +
      fetched.status
  );


  const htmlBytes =
    Buffer.byteLength(
      fetched.html,
      "utf8"
    );


  assertTrue(
    "실제 HTML 수신",
    htmlBytes >=
      MIN_HTML_BYTES,
    htmlBytes +
      " bytes"
  );


  assertTrue(
    "상세페이지에 미술작품 키워드 존재",
    fetched.html.includes(
      "미술작품"
    ),
    "미술작품"
  );


  assertTrue(
    "상세페이지 제목 확인",
    fetched.html.includes(
      "남양주왕숙2A-1"
    ),
    "남양주왕숙2A-1"
  );


  /* ----------------------------------------------------------
     DETAIL EXTRACTION
  ---------------------------------------------------------- */

  const detail =
    extractArtDetail(
      fetched.html,
      {

        sourceUrl:
          fetched.finalUrl ||
          TARGET_URL,

        title:
          TARGET_TITLE
      }
    );


  console.log(
    ""
  );


  console.log(
    "------------------------------------"
  );


  console.log(
    "EXTRACTED DETAIL"
  );


  console.log(
    "------------------------------------"
  );


  console.log(
    "publishedDate:",
    detail.publishedDate ||
      "-"
  );


  console.log(
    "deadline:",
    detail.deadline ||
      "-"
  );


  console.log(
    "agency:",
    detail.agency ||
      "-"
  );


  console.log(
    "amount:",
    detail.amount ||
      "-"
  );


  console.log(
    "location:",
    detail.location ||
      "-"
  );


  console.log(
    "eligibility:",
    detail.eligibility ||
      "-"
  );


  console.log(
    "fieldCount:",
    detail.detailExtractionCount
  );


  console.log(
    "detailVersion:",
    detail.detailExtractionVersion
  );


  console.log(
    "------------------------------------"
  );


  /* ----------------------------------------------------------
     KNOWN REAL VALUES
  ---------------------------------------------------------- */

  assertEqual(
    "실제 공고일 추출",
    detail.publishedDate,
    EXPECTED_PUBLISHED_DATE
  );


  assertEqual(
    "실제 마감일 추출",
    detail.deadline,
    EXPECTED_DEADLINE
  );


  assertTrue(
    "실제 상세페이지 핵심 필드 2개 이상 추출",
    detail.detailExtractionCount >=
      2,
    detail.detailExtractionCount +
      " fields"
  );
}


/* ============================================================
   RUN
============================================================ */

async function main() {

  await runLiveSmoke();


  const total =
    passCount +
    failCount;


  console.log(
    ""
  );


  console.log(
    "===================================="
  );


  console.log(
    "LIVE DETAIL SMOKE RESULT"
  );


  console.log(
    "===================================="
  );


  console.log(
    "PASS:",
    passCount
  );


  console.log(
    "FAIL:",
    failCount
  );


  console.log(
    "TOTAL:",
    total
  );


  console.log(
    "===================================="
  );


  if (
    failCount >
    0
  ) {

    console.error(
      "❌ ART LIVE DETAIL SMOKE TEST FAILED"
    );


    process.exitCode =
      1;


    return;
  }


  console.log(
    "✅ ART LIVE DETAIL SMOKE TEST PASSED"
  );
}


/* ============================================================
   START
============================================================ */

main()
  .catch(
    function (
      error
    ) {

      console.error(
        "[AXOO ART LIVE DETAIL SMOKE]",
        error
      );


      process.exitCode =
        1;
    }
  );
