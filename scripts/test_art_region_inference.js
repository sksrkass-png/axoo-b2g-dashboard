const {
  findTargetArtRegion,
  inferTargetArtRegionFromValues
} = require(
  "./art_region_scope"
);

const {
  resolveCandidateRegion,
  extractRegionEvidenceSnippets,
  enrichNationalItemRegionFromDetail,
  buildItem
} = require(
  "./collect_remaining_art_commissions"
);


/* =========================================================
   TEST CONTEXT
========================================================= */

const NATIONAL_REGION = {

  id:
    "national",

  name:
    "전국",

  fullName:
    "전국 공통 백업"
};


const DAEJEON_REGION = {

  id:
    "daejeon",

  name:
    "대전",

  fullName:
    "대전광역시"
};


const NATIONAL_SOURCE = {

  id:
    "artnuri_art_commission",

  sourceName:
    "아트누리 지원사업·공모 검색",

  sourceType:
    "national_portal",

  sourceUrl:
    "https://artnuri.or.kr/crawler/info/search.do",

  crawlMode:
    "keyword_search",

  priority:
    3,

  priorityLabel:
    "전국 자동수집"
};


/* =========================================================
   RESULT
========================================================= */

let passCount =
  0;

let failCount =
  0;


/* =========================================================
   ASSERT
========================================================= */

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


function assertRegion(
  name,
  region,
  expectedName
) {

  const actual =
    region
      ? region.name
      : null;


  assertEqual(
    name,
    actual,
    expectedName
  );
}


/* =========================================================
   1. BASIC REGION MATCH
========================================================= */

function testBasicRegionInference() {

  assertRegion(
    "서울특별시 → 서울",
    findTargetArtRegion(
      "서울특별시 강남구 건축물 미술작품 공모"
    ),
    "서울"
  );


  assertRegion(
    "부산광역시 → 부산",
    findTargetArtRegion(
      "부산광역시 해운대구 미술작품 제작 설치 공모"
    ),
    "부산"
  );


  assertRegion(
    "대전광역시 → 대전",
    findTargetArtRegion(
      "대전광역시 유성구 미술작품 공모"
    ),
    "대전"
  );


  assertRegion(
    "강원도 구 명칭 → 강원",
    findTargetArtRegion(
      "강원도 춘천시 건축물 미술작품 공모"
    ),
    "강원"
  );


  assertRegion(
    "전라북도 구 명칭 → 전북",
    findTargetArtRegion(
      "전라북도 전주시 미술작품 설치 공모"
    ),
    "전북"
  );


  assertRegion(
    "제주특별자치도 → 제주",
    findTargetArtRegion(
      "제주특별자치도 제주시 건축물 미술작품 공모"
    ),
    "제주"
  );
}


/* =========================================================
   2. GWANGJU AMBIGUITY
========================================================= */

function testGwangjuAmbiguity() {

  assertRegion(
    "광주광역시 → 광주",
    findTargetArtRegion(
      "광주광역시 북구 건축물 미술작품 공모"
    ),
    "광주"
  );


  assertRegion(
    "경기도 광주시 → 경기",
    findTargetArtRegion(
      "경기도 광주시 공동주택 미술작품 제작 설치 공모"
    ),
    "경기"
  );


  assertRegion(
    "광주시 단독 → 미확정",
    findTargetArtRegion(
      "광주시 공동주택 미술작품 제작 설치 공모"
    ),
    null
  );
}


/* =========================================================
   3. MULTI VALUE INFERENCE
========================================================= */

function testMultiValueInference() {

  const region =
    inferTargetArtRegionFromValues(
      [
        "건축물 미술작품 제작 설치 공모",
        "",
        "주관기관 대전광역시",
        "유성구"
      ]
    );


  assertRegion(
    "여러 Evidence 중 대전광역시 탐지",
    region,
    "대전"
  );
}


/* =========================================================
   4. NATIONAL TITLE INFERENCE
========================================================= */

function testNationalTitleInference() {

  const gyeonggi =
    resolveCandidateRegion(
      NATIONAL_REGION,
      "경기도 광주시 공동주택 건축물 미술작품 제작 설치 공모",
      []
    );


  assertRegion(
    "전국 Source + 경기도 광주시 제목 → 경기",
    gyeonggi.region,
    "경기"
  );


  assertEqual(
    "경기 추론 Source = title",
    gyeonggi.method,
    "title"
  );


  assertEqual(
    "경기 추론 inferred = true",
    gyeonggi.inferred,
    true
  );


  const gwangju =
    resolveCandidateRegion(
      NATIONAL_REGION,
      "광주광역시 신축 건축물 미술작품 제작 설치 공모",
      []
    );


  assertRegion(
    "전국 Source + 광주광역시 제목 → 광주",
    gwangju.region,
    "광주"
  );


  assertEqual(
    "광주 추론 Source = title",
    gwangju.method,
    "title"
  );
}


/* =========================================================
   5. UNRESOLVED NATIONAL TITLE
========================================================= */

function testNationalUnresolved() {

  const result =
    resolveCandidateRegion(
      NATIONAL_REGION,
      "공동주택 건축물 미술작품 제작 설치 공모",
      []
    );


  assertRegion(
    "지역 없는 전국 제목 → 전국 유지",
    result.region,
    "전국"
  );


  assertEqual(
    "지역 미확정 method",
    result.method,
    "unresolved"
  );


  assertEqual(
    "지역 미확정 inferred = false",
    result.inferred,
    false
  );
}


/* =========================================================
   6. DETAIL EVIDENCE EXTRACTION
========================================================= */

function testDetailEvidenceExtraction() {

  const title =
    "공동주택 건축물 미술작품 제작 설치 공모";


  const html = `
    <!doctype html>
    <html lang="ko">

    <body>

      <nav>
        서울 부산 대구 인천 광주 대전 울산 세종
        경기 강원 충북 충남 전북 전남 경북 경남 제주
      </nav>

      <article>

        <h1>
          ${title}
        </h1>

        <dl>

          <dt>
            설치장소
          </dt>

          <dd>
            대전광역시 유성구 장대동 501
          </dd>

          <dt>
            주관기관
          </dt>

          <dd>
            대전광역시
          </dd>

        </dl>

      </article>

    </body>

    </html>
  `;


  const snippets =
    extractRegionEvidenceSnippets(
      html,
      title
    );


  assertEqual(
    "상세 Evidence Snippet 생성",
    snippets.length >
      0,
    true
  );


  const region =
    inferTargetArtRegionFromValues(
      snippets
    );


  assertRegion(
    "상세 Evidence → 대전",
    region,
    "대전"
  );
}


/* =========================================================
   7. NATIONAL ITEM DETAIL ENRICHMENT
========================================================= */

function testNationalDetailEnrichment() {

  const title =
    "공동주택 건축물 미술작품 제작 설치 공모";


  const sourceUrl =
    "https://example.com/art/detail/100";


  const initial =
    buildItem(
      NATIONAL_REGION,
      NATIONAL_SOURCE,
      title,
      sourceUrl
    );


  assertEqual(
    "초기 전국 Item 지역",
    initial.region,
    "전국"
  );


  assertEqual(
    "초기 전국 Item 추론 상태",
    initial.regionInferenceStatus,
    "unresolved"
  );


  const detailHtml = `
    <!doctype html>
    <html lang="ko">

    <body>

      <header>
        전국 문화예술 지원사업 검색
      </header>

      <main>

        <h1>
          ${title}
        </h1>

        <p>
          설치장소 : 대전광역시 유성구 장대동 501
        </p>

        <p>
          공고기관 : 대전광역시
        </p>

      </main>

    </body>

    </html>
  `;


  const enriched =
    enrichNationalItemRegionFromDetail(
      initial,
      NATIONAL_REGION,
      detailHtml
    );


  assertEqual(
    "상세페이지 보완 후 지역 = 대전",
    enriched.region,
    "대전"
  );


  assertEqual(
    "상세페이지 보완 regionId",
    enriched.regionId,
    "daejeon"
  );


  assertEqual(
    "상세페이지 보완 regionFullName",
    enriched.regionFullName,
    "대전광역시"
  );


  assertEqual(
    "상세페이지 보완 inferred = true",
    enriched.regionInferred,
    true
  );


  assertEqual(
    "상세페이지 보완 Source = detail",
    enriched.regionInferenceSource,
    "detail"
  );


  assertEqual(
    "상세페이지 보완 Status = resolved",
    enriched.regionInferenceStatus,
    "resolved"
  );


  assertEqual(
    "원래 Source 범위는 전국으로 보존",
    enriched.sourceRegion,
    "전국"
  );
}


/* =========================================================
   8. TITLE RESOLUTION MUST NOT BE OVERWRITTEN
========================================================= */

function testTitleResolutionProtection() {

  const title =
    "경기도 성남시 건축물 미술작품 제작 설치 공모";


  const item =
    buildItem(
      NATIONAL_REGION,
      NATIONAL_SOURCE,
      title,
      "https://example.com/art/detail/200"
    );


  assertEqual(
    "제목에서 경기 판별",
    item.region,
    "경기"
  );


  const misleadingHtml = `
    <!doctype html>
    <html lang="ko">

    <body>

      <h1>
        ${title}
      </h1>

      <footer>
        서울 부산 대구 인천 대전 제주
      </footer>

      <p>
        관련기관 대전광역시
      </p>

    </body>

    </html>
  `;


  const enriched =
    enrichNationalItemRegionFromDetail(
      item,
      NATIONAL_REGION,
      misleadingHtml
    );


  assertEqual(
    "제목에서 확정된 경기는 상세 공통텍스트로 덮어쓰지 않음",
    enriched.region,
    "경기"
  );


  assertEqual(
    "제목 추론 Source 유지",
    enriched.regionInferenceSource,
    "title"
  );
}


/* =========================================================
   9. REGIONAL SOURCE MUST STAY REGIONAL
========================================================= */

function testRegionalSourcePreservation() {

  const result =
    resolveCandidateRegion(
      DAEJEON_REGION,
      "서울특별시 관련 건축물 미술작품 제작 설치 공모",
      []
    );


  assertRegion(
    "광역시 공식 Source는 Registry 지역 유지",
    result.region,
    "대전"
  );


  assertEqual(
    "공식 Source 추론 Method",
    result.method,
    "source_registry"
  );


  assertEqual(
    "공식 Source inferred = false",
    result.inferred,
    false
  );
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
    "AXOO ART REGION INFERENCE TEST"
  );


  console.log(
    "===================================="
  );


  console.log(
    ""
  );


  testBasicRegionInference();

  testGwangjuAmbiguity();

  testMultiValueInference();

  testNationalTitleInference();

  testNationalUnresolved();

  testDetailEvidenceExtraction();

  testNationalDetailEnrichment();

  testTitleResolutionProtection();

  testRegionalSourcePreservation();


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
    "ART REGION INFERENCE RESULT"
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
      "❌ ART REGION INFERENCE TEST FAILED"
    );


    process.exitCode =
      1;


    return;
  }


  console.log(
    "✅ ART REGION INFERENCE TEST PASSED"
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
        "[AXOO ART REGION INFERENCE TEST]",
        error
      );


      process.exitCode =
        1;
    }
  );
