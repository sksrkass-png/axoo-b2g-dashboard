const { spawnSync } = require("child_process");


/* =========================================================
   CONFIG
========================================================= */

const COLLECTORS = [

  {
    id: "gyeonggi",
    label: "경기도",
    script: "scripts/collect_art_commissions.js"
  },

  {
    id: "seoul",
    label: "서울특별시",
    script: "scripts/collect_seoul_art_commissions.js"
  },

  {
    id: "incheon",
    label: "인천광역시",
    script: "scripts/collect_incheon_art_commissions.js"
  },

  {
    id: "busan",
    label: "부산광역시",
    script: "scripts/collect_busan_art_commissions.js"
  }

];


const MAX_ATTEMPTS = 3;


/*
  1차 실패 → 5초 대기
  2차 실패 → 10초 대기
*/

const RETRY_DELAYS_MS = [
  5000,
  10000
];


/* =========================================================
   HELPERS
========================================================= */

function sleep(ms) {

  return new Promise(
    function (resolve) {

      setTimeout(
        resolve,
        ms
      );

    }
  );
}


function runCollector(
  collector
) {

  const result =
    spawnSync(
      process.execPath,
      [
        collector.script
      ],
      {
        cwd:
          process.cwd(),

        encoding:
          "utf8",

        stdio: [
          "inherit",
          "pipe",
          "pipe"
        ],

        env: {
          ...process.env
        }
      }
    );


  return {

    success:
      result.status === 0,

    status:
      result.status,

    stdout:
      String(
        result.stdout || ""
      ),

    stderr:
      String(
        result.stderr || ""
      ),

    error:
      result.error || null
  };
}


function printOutput(
  result
) {

  if (
    result.stdout.trim()
  ) {

    process.stdout.write(
      result.stdout
    );

    if (
      !result.stdout.endsWith(
        "\n"
      )
    ) {

      process.stdout.write(
        "\n"
      );
    }
  }


  if (
    result.stderr.trim()
  ) {

    process.stderr.write(
      result.stderr
    );

    if (
      !result.stderr.endsWith(
        "\n"
      )
    ) {

      process.stderr.write(
        "\n"
      );
    }
  }
}


function printHeader(
  collector,
  attempt
) {

  console.log(
    ""
  );

  console.log(
    "===================================="
  );

  console.log(
    "[COLLECTOR] " +
    collector.label
  );

  console.log(
    "시도: " +
    attempt +
    "/" +
    MAX_ATTEMPTS
  );

  console.log(
    "파일: " +
    collector.script
  );

  console.log(
    "===================================="
  );
}



/* =========================================================
   RETRY
========================================================= */

async function runWithRetry(
  collector
) {

  let lastResult =
    null;


  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt += 1
  ) {

    printHeader(
      collector,
      attempt
    );


    const result =
      runCollector(
        collector
      );


    lastResult =
      result;


    printOutput(
      result
    );


    if (
      result.success
    ) {

      console.log(
        ""
      );

      console.log(
        "✅ " +
        collector.label +
        " 수집 성공"
      );


      return {

        ...collector,

        success:
          true,

        attempts:
          attempt,

        status:
          result.status
      };
    }


    console.log(
      ""
    );

    console.log(
      "⚠️ " +
      collector.label +
      " 수집 실패 (" +
      attempt +
      "/" +
      MAX_ATTEMPTS +
      ")"
    );


    if (
      result.error
    ) {

      console.log(
        "실행 오류:",
        result.error.message
      );
    }


    if (
      attempt <
      MAX_ATTEMPTS
    ) {

      const delay =
        RETRY_DELAYS_MS[
          attempt - 1
        ];


      console.log(
        Math.round(
          delay / 1000
        ) +
        "초 후 재시도합니다."
      );


      await sleep(
        delay
      );
    }
  }


  /*
    중요:
    한 지역이 3번 모두 실패해도
    전체 수집 프로세스를 죽이지 않는다.

    다음 지역으로 계속 진행한다.
  */

  console.log(
    ""
  );

  console.log(
    "::warning title=" +
    collector.label +
    " 수집 실패::" +
    collector.label +
    " 공식 사이트 연결에 3회 실패했습니다. " +
    "기존 데이터는 유지하고 다음 지역 수집을 계속합니다."
  );


  return {

    ...collector,

    success:
      false,

    attempts:
      MAX_ATTEMPTS,

    status:
      lastResult
        ? lastResult.status
        : null
  };
}



/* =========================================================
   SUMMARY
========================================================= */

function printSummary(
  results
) {

  console.log(
    ""
  );

  console.log(
    "===================================="
  );

  console.log(
    "AXOO ART COLLECTOR SUMMARY"
  );

  console.log(
    "===================================="
  );


  results.forEach(
    function (
      result
    ) {

      console.log(
        (
          result.success
            ? "✅ "
            : "⚠️ "
        ) +
        result.label +
        " | " +
        (
          result.success
            ? "SUCCESS"
            : "FAILED"
        ) +
        " | attempts=" +
        result.attempts
      );
    }
  );


  const successCount =
    results.filter(
      function (
        result
      ) {

        return result.success;

      }
    ).length;


  const failureCount =
    results.length -
    successCount;


  console.log(
    "------------------------------------"
  );

  console.log(
    "성공:",
    successCount
  );

  console.log(
    "실패:",
    failureCount
  );

  console.log(
    "===================================="
  );


  return {
    successCount:
      successCount,

    failureCount:
      failureCount
  };
}



/* =========================================================
   RUN
========================================================= */

async function main() {

  const results =
    [];


  for (
    const collector of
    COLLECTORS
  ) {

    const result =
      await runWithRetry(
        collector
      );


    results.push(
      result
    );
  }


  const summary =
    printSummary(
      results
    );


  /*
    3개 지역이 모두 실패한 경우만
    전체 workflow를 실패시킨다.

    1개 또는 2개 지역만 실패한 경우:
    → 기존 데이터 유지
    → 나머지 지역 정상 수집
    → workflow 계속 진행
  */

  if (
    summary.successCount === 0
  ) {

    throw new Error(
      "경기·서울·인천 모든 수집원이 실패했습니다. 전체 수집을 중단합니다."
    );
  }


  if (
    summary.failureCount > 0
  ) {

    console.log(
      ""
    );

    console.log(
      "⚠️ 일부 수집원이 실패했지만 " +
      "정상 수집된 지역 데이터를 기준으로 계속 진행합니다."
    );
  }


  console.log(
    ""
  );

  console.log(
    "✅ 수집 단계 완료"
  );
}


main()
  .catch(
    function (
      error
    ) {

      console.error(
        "[AXOO ART COLLECTOR MANAGER]",
        error
      );


      process.exitCode =
        1;
    }
  );
