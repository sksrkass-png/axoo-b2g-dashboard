const {
  isCandidateTitle
} = require(
  "./collect_remaining_art_commissions"
);


/* =========================================================
   TEST CASES
========================================================= */

const TEST_CASES = [

  /*
    실제 공모형 제목
    반드시 잡혀야 한다.
  */

  {
    title:
      "유성구 장대동 501 건축물 미술작품 제작·설치 공모",
    expected:
      true
  },

  {
    title:
      "공동주택 건축물 미술작품 제작 설치 공모",
    expected:
      true
  },

  {
    title:
      "신축 공동주택 미술작품 제작 및 설치 공모",
    expected:
      true
  },

  {
    title:
      "건축물 미술작품 제작·설치 공모 공고",
    expected:
      true
  },

  {
    title:
      "공공미술 작품 설치 공모",
    expected:
      true
  },


  /*
    결과 / 심의 / 행정 정보
    반드시 제외되어야 한다.
  */

  {
    title:
      "건축물 미술작품 선정 결과 공고",
    expected:
      false
  },

  {
    title:
      "건축물 미술작품 공모 결과",
    expected:
      false
  },

  {
    title:
      "건축물 미술작품 심의 결과",
    expected:
      false
  },

  {
    title:
      "건축물 미술작품 심의위원 모집",
    expected:
      false
  },

  {
    title:
      "건축물 미술작품 제도 안내",
    expected:
      false
  },

  {
    title:
      "건축물 미술작품 설치 완료 안내",
    expected:
      false
  },


  /*
    미술작품 공모가 아닌 일반 공고
    반드시 제외되어야 한다.
  */

  {
    title:
      "공동주택 신축공사 입찰공고",
    expected:
      false
  },

  {
    title:
      "문화예술 지원사업 참여자 모집",
    expected:
      false
  },

  {
    title:
      "공공디자인 아이디어 공모",
    expected:
      false
  },

  {
    title:
      "건축 설계공모 공고",
    expected:
      false
  }
];


/* =========================================================
   RUN
========================================================= */

let passed =
  0;

let failed =
  0;


console.log(
  ""
);

console.log(
  "===================================="
);

console.log(
  "AXOO ART CANDIDATE FILTER TEST"
);

console.log(
  "===================================="
);


TEST_CASES.forEach(
  function (
    test,
    index
  ) {

    const actual =
      isCandidateTitle(
        test.title
      );


    const success =
      actual ===
      test.expected;


    if (
      success
    ) {

      passed++;

    } else {

      failed++;
    }


    console.log(
      (
        success
          ? "✅"
          : "❌"
      ) +
      " #" +
      (
        index + 1
      ) +
      " | expected=" +
      test.expected +
      " | actual=" +
      actual
    );


    console.log(
      "   " +
      test.title
    );
  }
);


console.log(
  ""
);

console.log(
  "------------------------------------"
);

console.log(
  "PASS:",
  passed
);

console.log(
  "FAIL:",
  failed
);

console.log(
  "TOTAL:",
  TEST_CASES.length
);

console.log(
  "===================================="
);


if (
  failed > 0
) {

  console.error(
    "❌ 공모 제목 필터 테스트 실패"
  );


  process.exitCode =
    1;

} else {

  console.log(
    "✅ 공모 제목 필터 테스트 통과"
  );
}
