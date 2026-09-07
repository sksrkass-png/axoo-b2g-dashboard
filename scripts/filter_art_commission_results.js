const fs = require("fs");
const path = require("path");


/* =========================================================
   AXOO B2G · ART COMMISSION RESULT FILTER
   v1.0.0

   목적:
   - 실제 지원 가능한 "진행 공모"만 리서치 데이터에 남긴다.
   - 당선작 / 선정결과 / 심사결과 / 공모결과 등
     결과·후속 고지는 LIVE와 ARCHIVE에서 제거한다.
   - 재공모 / 추가공모처럼 다시 지원 가능한 공고는 보존한다.

   중요:
   - 제목만 판정한다.
   - 본문(detailTextSample)은 판정에 사용하지 않는다.
     공식 사이트 본문에는 메뉴명 "공모결과" 등이 섞일 수 있어
     정상 공고를 오탐 제거할 위험이 있기 때문이다.
========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const VERSION =
  "axoo_art_result_filter_v1.0.0";


const DATA_FILE =
  path.join(
    process.cwd(),
    "data",
    "art_commissions.json"
  );


const ARCHIVE_FILE =
  path.join(
    process.cwd(),
    "data",
    "art_commissions_archive.json"
  );


/*
  결과/후속 고지 신호.

  비교 시 공백과 일부 구두점을 제거한 제목에도 적용하므로
  "심사 결과", "심사결과"를 별도로 모두 적을 필요는 없다.
*/
const RESULT_KEYWORDS = [

  "당선작",
  "당선자",

  "선정작",
  "선정자",
  "선정결과",

  "수상작",
  "수상자",

  "공모결과",
  "결과공고",
  "결과발표",
  "최종결과",

  "심사결과",
  "심의결과",
  "평가결과",

  "심사위원",
  "심의위원",

  "공모취소",
  "공고취소",

  "낙찰결과"
];


/*
  제목에 결과 단어가 섞여 있어도
  실제로 다시 지원할 수 있는 신규 공모라면 보존한다.

  예:
  - "기존 공모 결과 취소 및 재공모 공고"
  - "미선정에 따른 추가 공모 공고"
*/
const REOPEN_KEYWORDS = [

  "재공모",
  "재공고",

  "추가공모",
  "추가모집",

  "재모집",

  "신규공모"
];


/* =========================================================
   JSON
========================================================= */

function readArray(
  filePath
) {

  if (
    !fs.existsSync(
      filePath
    )
  ) {

    return [];
  }


  const raw =
    fs
      .readFileSync(
        filePath,
        "utf8"
      )
      .trim();


  if (!raw) {

    return [];
  }


  const parsed =
    JSON.parse(
      raw
    );


  if (
    !Array.isArray(
      parsed
    )
  ) {

    throw new Error(
      filePath +
      " 은 배열 형식이어야 합니다."
    );
  }


  return parsed;
}


function writeArray(
  filePath,
  items
) {

  fs.writeFileSync(
    filePath,
    JSON.stringify(
      items,
      null,
      2
    ) + "\n",
    "utf8"
  );
}


/* =========================================================
   TEXT
========================================================= */

function cleanText(
  value
) {

  return String(
    value == null
      ? ""
      : value
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function compactText(
  value
) {

  return cleanText(
    value
  )
    .toLowerCase()
    .replace(
      /[\s·ㆍ:：,，.。/\\()[\]{}<>"'’‘“”_\-–—]+/g,
      ""
    );
}


function hasKeyword(
  compactTitle,
  keyword
) {

  return compactTitle.includes(
    compactText(
      keyword
    )
  );
}


function findMatchedKeyword(
  compactTitle,
  keywords
) {

  return (
    keywords.find(
      function (
        keyword
      ) {

        return hasKeyword(
          compactTitle,
          keyword
        );
      }
    ) ||
    ""
  );
}


/* =========================================================
   FILTER
========================================================= */

function evaluateTitle(
  title
) {

  const cleanTitle =
    cleanText(
      title
    );


  if (!cleanTitle) {

    return {
      excluded:
        false,
      reason:
        "",
      matchedKeyword:
        "",
      reopenKeyword:
        ""
    };
  }


  const compactTitle =
    compactText(
      cleanTitle
    );


  const matchedKeyword =
    findMatchedKeyword(
      compactTitle,
      RESULT_KEYWORDS
    );


  if (!matchedKeyword) {

    return {
      excluded:
        false,
      reason:
        "",
      matchedKeyword:
        "",
      reopenKeyword:
        ""
    };
  }


  const reopenKeyword =
    findMatchedKeyword(
      compactTitle,
      REOPEN_KEYWORDS
    );


  /*
    재공모 / 추가공모는 실제 지원 가능성이 있으므로
    결과 단어가 함께 있어도 보존한다.
  */
  if (reopenKeyword) {

    return {
      excluded:
        false,
      reason:
        "reopened_opportunity",
      matchedKeyword:
        matchedKeyword,
      reopenKeyword:
        reopenKeyword
    };
  }


  return {
    excluded:
      true,
    reason:
      "result_or_followup_notice",
    matchedKeyword:
      matchedKeyword,
    reopenKeyword:
      ""
  };
}


function shouldExcludeItem(
  item
) {

  if (
    !item ||
    typeof item !==
      "object"
  ) {

    return {
      excluded:
        false,
      reason:
        "",
      matchedKeyword:
        "",
      reopenKeyword:
        ""
    };
  }


  return evaluateTitle(
    item.title
  );
}


function filterItems(
  items,
  label
) {

  const kept =
    [];

  const removed =
    [];


  items.forEach(
    function (
      item
    ) {

      const evaluation =
        shouldExcludeItem(
          item
        );


      if (
        evaluation.excluded
      ) {

        removed.push({
          id:
            item &&
            item.id
              ? item.id
              : "",
          title:
            item &&
            item.title
              ? item.title
              : "",
          source:
            item &&
            (
              item.sourceName ||
              item.source ||
              ""
            ),
          reason:
            evaluation.reason,
          matchedKeyword:
            evaluation.matchedKeyword
        });

        return;
      }


      kept.push(
        item
      );
    }
  );


  return {
    label:
      label,
    kept:
      kept,
    removed:
      removed
  };
}


/* =========================================================
   SELF TEST
========================================================= */

function runSelfTest() {

  const cases = [

    {
      title:
        "인천지방국세청 신청사 미술작품 제작 설치 공모 당선작 공모 게시",
      expectedExcluded:
        true
    },

    {
      title:
        "○○지구 미술작품 공모 선정 결과 공고",
      expectedExcluded:
        true
    },

    {
      title:
        "○○청사 미술작품 심사결과 발표",
      expectedExcluded:
        true
    },

    {
      title:
        "○○아파트 미술작품 공모 결과",
      expectedExcluded:
        true
    },

    {
      title:
        "기존 공모 결과 취소 및 재공모 공고",
      expectedExcluded:
        false
    },

    {
      title:
        "미선정에 따른 추가 공모 공고",
      expectedExcluded:
        false
    },

    {
      title:
        "김포 한강 시네폴리스 신축공사 미술작품 제작 및 설치 공모 공고",
      expectedExcluded:
        false
    },

    {
      title:
        "수원당수 D-3블록 설계공모 미술작품 공모 공고",
      expectedExcluded:
        false
    }
  ];


  const failures =
    [];


  cases.forEach(
    function (
      testCase
    ) {

      const result =
        evaluateTitle(
          testCase.title
        );


      if (
        result.excluded !==
        testCase.expectedExcluded
      ) {

        failures.push({
          title:
            testCase.title,
          expectedExcluded:
            testCase.expectedExcluded,
          actualExcluded:
            result.excluded,
          matchedKeyword:
            result.matchedKeyword,
          reopenKeyword:
            result.reopenKeyword
        });
      }
    }
  );


  if (
    failures.length
  ) {

    console.error(
      "[SELF TEST FAILED]"
    );

    console.error(
      JSON.stringify(
        failures,
        null,
        2
      )
    );

    process.exitCode =
      1;

    return false;
  }


  console.log(
    "✅ ART RESULT FILTER SELF TEST PASS"
  );

  console.log(
    "cases=" +
    cases.length
  );


  return true;
}


/* =========================================================
   RUN
========================================================= */

function main() {

  const args =
    new Set(
      process.argv.slice(
        2
      )
    );


  if (
    args.has(
      "--self-test"
    )
  ) {

    runSelfTest();

    return;
  }


  const dryRun =
    args.has(
      "--dry-run"
    );


  const live =
    readArray(
      DATA_FILE
    );


  const archive =
    readArray(
      ARCHIVE_FILE
    );


  const liveResult =
    filterItems(
      live,
      "LIVE"
    );


  const archiveResult =
    filterItems(
      archive,
      "ARCHIVE"
    );


  console.log(
    ""
  );

  console.log(
    "===================================="
  );

  console.log(
    "AXOO ART RESULT FILTER"
  );

  console.log(
    "===================================="
  );

  console.log(
    "VERSION:",
    VERSION
  );

  console.log(
    "LIVE:",
    live.length,
    "→",
    liveResult.kept.length,
    "| removed=" +
    liveResult.removed.length
  );

  console.log(
    "ARCHIVE:",
    archive.length,
    "→",
    archiveResult.kept.length,
    "| removed=" +
    archiveResult.removed.length
  );


  const removedMap =
    new Map();


  liveResult.removed
    .concat(
      archiveResult.removed
    )
    .forEach(
      function (
        item
      ) {

        const key =
          (
            item.id ||
            ""
          ) +
          "|" +
          (
            item.title ||
            ""
          );


        if (
          !removedMap.has(
            key
          )
        ) {

          removedMap.set(
            key,
            item
          );
        }
      }
    );


  if (
    removedMap.size
  ) {

    console.log(
      ""
    );

    console.log(
      "제외된 결과/후속 고지:"
    );


    Array.from(
      removedMap.values()
    ).forEach(
      function (
        item
      ) {

        console.log(
          "  ❌",
          item.title,
          "| keyword=" +
          item.matchedKeyword
        );
      }
    );

  } else {

    console.log(
      "제외 대상 없음"
    );
  }


  if (
    dryRun
  ) {

    console.log(
      ""
    );

    console.log(
      "DRY RUN · 파일은 변경하지 않았습니다."
    );

    return;
  }


  writeArray(
    DATA_FILE,
    liveResult.kept
  );


  writeArray(
    ARCHIVE_FILE,
    archiveResult.kept
  );


  console.log(
    ""
  );

  console.log(
    "✅ 결과/후속 고지 필터 적용 완료"
  );
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {

  VERSION,

  RESULT_KEYWORDS,

  REOPEN_KEYWORDS,

  cleanText,

  compactText,

  evaluateTitle,

  shouldExcludeItem,

  filterItems,

  runSelfTest

};


if (
  require.main ===
  module
) {

  try {

    main();

  } catch (
    error
  ) {

    console.error(
      "[AXOO ART RESULT FILTER]",
      error
    );

    process.exitCode =
      1;
  }
}
