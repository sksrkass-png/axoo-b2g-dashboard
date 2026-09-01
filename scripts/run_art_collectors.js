const { spawnSync } = require("child_process");


/* =========================================================
   CONFIG
========================================================= */

const COLLECTORS = [

  {
    id: "gyeonggi",
    label: "경기도",
    script: "scripts/collect_art_commissions.js",
    maxAttempts: 3,
    timeoutMs: 45000
  },

  {
    id: "seoul",
    label: "서울특별시",
    script: "scripts/collect_seoul_art_commissions.js",
    maxAttempts: 3,
    timeoutMs: 60000
  },

  {
    id: "incheon",
    label: "인천광역시",
    script: "scripts/collect_incheon_art_commissions.js",
    maxAttempts: 3,
    timeoutMs: 45000
  },

  {
    id: "busan",
    label: "부산광역시",
    script: "scripts/collect_busan_art_commissions.js",

    /*
      부산은 최대 40페이지를 조회하므로
      사이트 연결 장애 시 전체 workflow가
      장시간 붙잡히지 않도록 1회만 실행한다.
    */
    maxAttempts: 1,
    timeoutMs: 90000
  }

     ,

  {
    id: "remaining-regions",
    label: "나머지 13개 시도",
    script: "scripts/collect_remaining_art_commissions.js",

    /*
      13개 지역을 내부에서 자체적으로 순회하므로
      Manager에서는 재시도하지 않는다.
    */
    maxAttempts: 1,

    /*
      지역별 사이트 장애는 내부 Collector가 격리한다.
      전국 순회 전체에는 최대 13분 허용.
    */
    timeoutMs: 780000
  }
   
];


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
        },

        /*
          중요:
          개별 지역 수집기가 멈춰도
          전체 GitHub Actions를 붙잡지 않는다.
        */
        timeout:
          collector.timeoutMs,

        killSignal:
          "SIGTERM",

        maxBuffer:
          10 * 1024 * 1024
      }
    );


  const timedOut =
    Boolean(
      result.error &&
      (
        result.error.code === "ETIMEDOUT" ||
        result.error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"
      )
    );


  return {

    success:
      result.status === 0,

    timedOut:
      timedOut,

    status:
      result.status,

    signal:
      result.signal || null,

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

  console.log("");

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
    collector.maxAttempts
  );

  console.log(
    "파일: " +
    collector.script
  );

  console.log(
    "제한시간: " +
    Math.round(
      collector.timeoutMs / 1000
    ) +
    "초"
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
    attempt <= collector.maxAttempts;
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

      console.log("");

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
          result.status,

        timedOut:
          false
      };
    }


    console.log("");


    if (
      result.timedOut
    ) {

      console.log(
        "⏱️ " +
        collector.label +
        " 수집 제한시간 초과"
      );

    } else {

      console.log(
        "⚠️ " +
        collector.label +
        " 수집 실패 (" +
        attempt +
        "/" +
        collector.maxAttempts +
        ")"
      );
    }


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
      collector.maxAttempts
    ) {

      const delay =
        RETRY_DELAYS_MS[
          Math.min(
            attempt - 1,
            RETRY_DELAYS_MS.length - 1
          )
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


  console.log("");


  console.log(
    "::warning title=" +
    collector.label +
    " 수집 실패::" +
    collector.label +
    " 수집에 실패했습니다. " +
    "기존 데이터는 유지하고 다음 지역 수집을 계속합니다."
  );


  return {

    ...collector,

    success:
      false,

    attempts:
      collector.maxAttempts,

    status:
      lastResult
        ? lastResult.status
        : null,

    timedOut:
      lastResult
        ? lastResult.timedOut
        : false
  };
}


/* =========================================================
   SUMMARY
========================================================= */

function printSummary(
  results
) {

  console.log("");

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

      let state =
        "FAILED";


      if (
        result.success
      ) {

        state =
          "SUCCESS";

      } else if (
        result.timedOut
      ) {

        state =
          "TIMEOUT";
      }


      console.log(
        (
          result.success
            ? "✅ "
            : "⚠️ "
        ) +
        result.label +
        " | " +
        state +
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
    모든 지역이 실패한 경우에만
    전체 workflow를 실패시킨다.

    일부 지역만 실패하면:
    → 해당 지역 기존 데이터 유지
    → 정상 지역 데이터 사용
    → 후속 정리/커밋 단계 계속 실행
  */

  if (
    summary.successCount === 0
  ) {

    throw new Error(
      "모든 지역 공공미술 수집원이 실패했습니다. 전체 수집을 중단합니다."
    );
  }


  if (
    summary.failureCount > 0
  ) {

    console.log("");

    console.log(
      "⚠️ 일부 수집원이 실패했지만 " +
      "정상 수집된 지역 데이터를 기준으로 계속 진행합니다."
    );
  }


  console.log("");

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
