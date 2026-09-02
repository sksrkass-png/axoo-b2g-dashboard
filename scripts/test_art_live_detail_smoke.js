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
   VERSION: 1.1.0
============================================================

   목적
   ------------------------------------------------------------
   실제 공공기관 상세페이지
   → GitHub Actions 네트워크 접근
   → HTML 수신
   → Detail Extractor 실행
   → 실제 공고일 / 마감일 검증

   전송 전략
   ------------------------------------------------------------
   1. Node fetch 시도
   2. Node/Undici 연결 실패 시
      curl IPv4 GET으로 자동 fallback

   중요
   ------------------------------------------------------------
   - LIVE JSON 수정 안 함
   - ARCHIVE JSON 수정 안 함
   - GitHub Commit 안 함
   - 읽기 전용 Smoke Test
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
   CONFIG
============================================================ */

const NODE_FETCH_TIMEOUT_MS =
  15000;


const CURL_CONNECT_TIMEOUT_SECONDS =
  20;


const CURL_MAX_TIME_SECONDS =
  45;


const MIN_HTML_BYTES =
  1000;


const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/151.0.0.0 Safari/537.36";


/* ============================================================
   TEST RESULT
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
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

            "Accept-Language":
              "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",

            "Cache-Control":
              "no-cache",

            "Pragma":
              "no-cache",

            "Referer":
              "https://www.gg.go.kr/publicart/main.do"
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
   CURL IPv4 FALLBACK
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
    "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

    "--header",
    "Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",

    "--header",
    "Cache-Control: no-cache",

    "--header",
    "Pragma: no-cache",

    "--header",
    "Referer: https://www.gg.go.kr/publicart/main.do",

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


  const httpOk =
    status >=
      200 &&
    status <
      400;


  const processOk =
    result.status ===
      0;


  return {

    success:
      processOk &&
      httpOk,

    transport:
      "curl-ipv4",

    status:
      status,

    finalUrl:
      finalUrl,

    html:
      html,

    error:
      stderr ||
      (
        result.error
          ? String(
              result.error
            )
          : ""
      ),

    exitCode:
      result.status
  };
}


/* ============================================================
   FETCH WITH FALLBACK
============================================================ */

async function fetchLivePage(
  url
) {

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
      "✅ NODE FETCH SUCCESS",
      "| HTTP",
      nodeResult.status
    );


    return nodeResult;
  }


  console.log(
    "⚠️ NODE FETCH FAILED"
  );


  console.log(
    "   status:",
    nodeResult.status ||
      "-"
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
    curlResult.success
  ) {

    console.log(
      "✅ CURL IPv4 SUCCESS",
      "| HTTP",
      curlResult.status
    );


  } else {

    console.log(
      "❌ CURL IPv4 FAILED"
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
  }


  return curlResult;
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
    "1.1.0"
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


    if (
      fetched.error
    ) {

      console.error(
        fetched.error
      );
    }


    return;
  }


  /* ----------------------------------------------------------
     NETWORK ASSERT
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


  console.log(
    ""
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
