const {
  crawlSource,
  isCandidateTitle,
  extractAnchors
} = require(
  "./collect_remaining_art_commissions"
);


/* =========================================================
   KNOWN POSITIVE FIXTURE

   실제 확인된 과거 대전 건축물 미술작품 공모를
   네트워크 없이 재현한다.

   목적:
   LIST HTML
   → LINK EXTRACTION
   → TITLE FILTER
   → CRAWL
   → ITEM BUILD

   전체 파이프라인 Recall 검증
========================================================= */

const KNOWN_TITLE =
  "2026-02 유성구 장대동 501 건축물 미술작품 제작·설치 공모";


const LIST_URL =
  "https://www.daejeon.go.kr/drh/depart/board/boardNormalList.do?boardId=normal_0167&menuSeq=1453";


const DETAIL_PATH =
  "/drh/depart/board/boardNormalView.do?boardId=normal_0167&menuSeq=1453&ntatcSeq=1506067944&pageIndex=1";


const DETAIL_URL =
  "https://www.daejeon.go.kr" +
  DETAIL_PATH;


/* =========================================================
   FIXTURE HTML
========================================================= */

const LIST_HTML = `
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>대전광역시 공고</title>
</head>
<body>

  <div class="board-list">

    <a
      href="/drh/depart/board/boardNormalView.do?boardId=normal_0167&menuSeq=1453&ntatcSeq=9999999999&pageIndex=1"
    >
      건축물 미술작품 심의위원 모집 결과
    </a>

    <a
      href="${DETAIL_PATH}"
    >
      ${KNOWN_TITLE}
    </a>

    <a
      href="/drh/depart/board/boardNormalView.do?boardId=normal_0167&menuSeq=1453&ntatcSeq=8888888888&pageIndex=1"
    >
      도시경관 디자인 공모 결과 안내
    </a>

  </div>

</body>
</html>
`;


const DETAIL_HTML = `
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${KNOWN_TITLE}</title>
</head>
<body>

  <article>

    <h1>
      ${KNOWN_TITLE}
    </h1>

    <p>
      건축물 미술작품 제작 및 설치 공모 안내
    </p>

  </article>

</body>
</html>
`;


/* =========================================================
   TEST SOURCE
========================================================= */

const REGION = {

  id:
    "daejeon",

  name:
    "대전",

  fullName:
    "대전광역시"
};


const SOURCE = {

  id:
    "daejeon_known_positive_fixture",

  sourceName:
    "대전광역시 건축물 미술작품 Known-positive Fixture",

  sourceType:
    "regional_official",

  sourceUrl:
    LIST_URL,

  crawlMode:
    "board",

  priority:
    1,

  priorityLabel:
    "Known-positive Recall Test",

  regionGroup:
    "충청권",

  regionGroupLabel:
    "충청권"
};


/* =========================================================
   TEST RESULT
========================================================= */

let passCount =
  0;


let failCount =
  0;


function pass(
  name
) {

  passCount++;


  console.log(
    "✅ PASS |",
    name
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
      name
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
  actual
) {

  assertEqual(
    name,
    Boolean(
      actual
    ),
    true
  );
}


/* =========================================================
   MOCK FETCH
========================================================= */

function createMockResponse(
  url,
  html
) {

  return {

    ok:
      true,

    status:
      200,

    statusText:
      "OK",

    url:
      url,

    text:
      async function () {

        return html;
      }
  };
}


async function mockFetch(
  input
) {

  const url =
    String(
      input
    );


  /*
    LIST
  */
  if (
    url.includes(
      "boardNormalList.do"
    )
  ) {

    return createMockResponse(
      url,
      LIST_HTML
    );
  }


  /*
    KNOWN POSITIVE DETAIL
  */
  if (
    url.includes(
      "ntatcSeq=1506067944"
    )
  ) {

    return createMockResponse(
      url,
      DETAIL_HTML
    );
  }


  /*
    기타 링크가 Queue에 들어와도
    테스트가 네트워크에 접근하지 않도록
    빈 정상 페이지를 반환한다.
  */
  return createMockResponse(
    url,
    `
      <!doctype html>
      <html lang="ko">
      <body>
      </body>
      </html>
    `
  );
}


/* =========================================================
   TEST 1
   TITLE FILTER
========================================================= */

function testTitleFilter() {

  assertTrue(
    "Known-positive 제목이 Candidate Filter를 통과한다",
    isCandidateTitle(
      KNOWN_TITLE
    )
  );


  assertEqual(
    "심의위원 결과 제목은 Candidate가 아니다",
    isCandidateTitle(
      "건축물 미술작품 심의위원 모집 결과"
    ),
    false
  );


  assertEqual(
    "일반 디자인 공모 결과는 Candidate가 아니다",
    isCandidateTitle(
      "도시경관 디자인 공모 결과 안내"
    ),
    false
  );
}


/* =========================================================
   TEST 2
   LINK EXTRACTION
========================================================= */

function testLinkExtraction() {

  const anchors =
    extractAnchors(
      LIST_HTML,
      LIST_URL
    );


  const known =
    anchors.find(
      function (
        anchor
      ) {

        return (
          anchor.label ===
          KNOWN_TITLE
        );
      }
    );


  assertTrue(
    "Known-positive 링크가 HTML에서 추출된다",
    known
  );


  if (!known) {

    return;
  }


  assertEqual(
    "Known-positive Detail URL이 정확히 canonicalize 된다",
    known.url,
    DETAIL_URL
  );


  assertEqual(
    "Known-positive 링크 제목이 보존된다",
    known.label,
    KNOWN_TITLE
  );
}


/* =========================================================
   TEST 3
   CRAWL → ITEM
========================================================= */

async function testCrawlRecall() {

  const originalFetch =
    global.fetch;


  global.fetch =
    mockFetch;


  try {

    const result =
      await crawlSource(
        REGION,
        SOURCE
      );


    assertEqual(
      "Source 접근 성공",
      result.accessOk,
      true
    );


    assertTrue(
      "최소 1페이지 이상 처리",
      result.pagesFetched >=
        1
    );


    assertEqual(
      "Known-positive Item은 정확히 1개 생성",
      result.items.length,
      1
    );


    if (
      result.items.length ===
      0
    ) {

      return;
    }


    const item =
      result.items[0];


    assertEqual(
      "Item 제목",
      item.title,
      KNOWN_TITLE
    );


    assertEqual(
      "Item Detail URL",
      item.sourceUrl,
      DETAIL_URL
    );


    assertEqual(
      "Item 원본 URL",
      item.originalUrl,
      DETAIL_URL
    );


    assertEqual(
      "Item 지역",
      item.region,
      "대전"
    );


    assertEqual(
      "Item 카테고리",
      item.category,
      "건축물 미술작품"
    );


    assertEqual(
      "Item 상태",
      item.status,
      "마감일 확인 필요"
    );


    assertEqual(
      "Item Grade",
      item.grade,
      "A"
    );


    assertEqual(
      "Item Score",
      item.score,
      80
    );


    assertEqual(
      "Item Source ID",
      item.collectionSourceId,
      SOURCE.id
    );


    assertEqual(
      "Item Source Name",
      item.sourceName,
      SOURCE.sourceName
    );


    assertEqual(
      "Item Crawl Mode",
      item.crawlMode,
      "board"
    );


  } finally {

    global.fetch =
      originalFetch;
  }
}


/* =========================================================
   RUN
========================================================= */

async function main() {

  console.log(
    ""
  );


  console.log(
    "===================================="
  );


  console.log(
    "AXOO ART KNOWN-POSITIVE RECALL TEST"
  );


  console.log(
    "===================================="
  );


  console.log(
    "TITLE:",
    KNOWN_TITLE
  );


  console.log(
    "DETAIL:",
    DETAIL_URL
  );


  console.log(
    ""
  );


  testTitleFilter();


  testLinkExtraction();


  await testCrawlRecall();


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
    "KNOWN-POSITIVE RECALL RESULT"
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
      "❌ KNOWN-POSITIVE RECALL TEST FAILED"
    );


    process.exitCode =
      1;


    return;
  }


  console.log(
    "✅ KNOWN-POSITIVE RECALL TEST PASSED"
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
        "[AXOO KNOWN-POSITIVE RECALL TEST]",
        error
      );


      process.exitCode =
        1;
    }
  );
