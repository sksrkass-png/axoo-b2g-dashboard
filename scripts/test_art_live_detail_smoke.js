const {
  extractArtDetail
} = require(
  "./art_detail_extractor"
);


/* ============================================================
   AXOO ART LIVE DETAIL SMOKE TEST
============================================================

   목적
   ------------------------------------------------------------
   실제 공공기관 상세페이지
   → GitHub Actions 네트워크 접근
   → HTML 수신
   → Detail Extractor 실행
   → 실제 공고일 / 마감일 검증

   중요
   ------------------------------------------------------------
   - LIVE JSON 수정 안 함
   - ARCHIVE JSON 수정 안 함
   - GitHub Commit 안 함
   - 읽기 전용 Smoke Test
============================================================ */


/* ============================================================
   KNOWN LIVE TARGET
============================================================ */

const TARGET_TITLE =
  "남양주왕숙2A-1 신축공사 內 미술작품 제작 및 설치 공모 공고";


const TARGET_URL =
  "https://www.gg.go.kr/publicart/bbs/boardView.do?bsIdx=825&bIdx=110904626&menuId=3865";


/*
  기존 실제 수집 데이터에서 이미 확인된 값.

  이 값은 Fixture 가공값이 아니라
  기존 Collector가 해당 실제 상세페이지에서
  추출·정규화해 ARCHIVE에 저장했던 값이다.
*/
const EXPECTED_PUBLISHED_DATE =
  "2026-08-10";


const EXPECTED_DEADLINE =
  "2026-08-29";


/* ============================================================
   CONFIG
============================================================ */

const FETCH_TIMEOUT_MS =
  20000;


const MIN_HTML_BYTES =
  1000;


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
   FETCH
============================================================ */

async function fetchLivePage(
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
              "Mozilla/5.0 (compatible; AXOO-B2G-LiveDetailSmoke/1.0)",

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

      finalUrl:
        response.url,

      html:
        html
    };


  } finally {

    clearTimeout(
      timer
    );
  }
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


  let fetched;


  try {

    fetched =
      await fetchLivePage(
        TARGET_URL
      );


  } catch (
    error
  ) {

    failCount++;


    console.error(
      "❌ LIVE FETCH FAILED"
    );


    console.error(
      error
    );


    return;
  }


  /* ----------------------------------------------------------
     1. NETWORK
  ---------------------------------------------------------- */

  assertTrue(
    "HTTP 응답 성공",
    fetched.ok,
    "HTTP " +
      fetched.status
  );


  assertTrue(
    "실제 HTML 수신",
    Buffer.byteLength(
      fetched.html,
      "utf8"
    ) >=
      MIN_HTML_BYTES,
    Buffer.byteLength(
      fetched.html,
      "utf8"
    ) +
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
     2. DETAIL EXTRACTION
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
    "------------------------------------"
  );


  console.log(
    ""
  );


  /* ----------------------------------------------------------
     3. KNOWN REAL VALUES
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


  /*
    페이지 구조에 따라 기관/작품비/설치장소/참가자격이
    HTML 본문에 모두 존재하지 않을 수 있으므로
    이번 Smoke Test에서는 값 자체를 강제하지 않는다.

    하지만 최소 날짜 정보가 추출돼야
    Detail Extractor가 실제 페이지에서도
    동작한다고 판단한다.
  */
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
