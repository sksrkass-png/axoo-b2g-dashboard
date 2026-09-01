const fs = require("fs");
const path = require("path");

/**
 * ============================================================
 * AXOO B2G
 * AUTO ART NOTICE ANALYSIS QUEUE
 * ============================================================
 *
 * File Bridge의 action=projects를 조회하고,
 *
 * 1. 아직 분석 JSON이 없는 프로젝트
 * 2. 분석 JSON이 비정상인 프로젝트
 * 3. 공고 파일 구성이 변경된 프로젝트
 * 4. 공고 파일이 기존 분석보다 새로 수정된 프로젝트
 *
 * 만 자동 분석 대상으로 잡는다.
 *
 * READ ONLY
 * - Google Sheet 수정 없음
 * - Google Drive 수정 없음
 * - GitHub 데이터 수정 없음
 * ============================================================
 */


const ROOT_DIR =
  path.resolve(
    __dirname,
    ".."
  );


const ANALYSIS_DIR =
  path.join(
    ROOT_DIR,
    "data",
    "art_notice_analysis"
  );


const OUTPUT_PATH =
  path.join(
    ROOT_DIR,
    ".tmp",
    "art_notice_analysis_queue.json"
  );


const BRIDGE_URL =
  String(
    process.env.AXOO_BRIDGE_URL ||
    ""
  ).trim();


const BRIDGE_TOKEN =
  String(
    process.env.AXOO_BRIDGE_TOKEN ||
    ""
  ).trim();


/* ============================================================
   CONFIG CHECK
============================================================ */


function ensureConfig() {

  if (!BRIDGE_URL) {

    throw new Error(
      "AXOO_BRIDGE_URL Secret이 없습니다."
    );
  }


  if (!BRIDGE_TOKEN) {

    throw new Error(
      "AXOO_BRIDGE_TOKEN Secret이 없습니다."
    );
  }
}


/* ============================================================
   RESEARCH ID
============================================================ */


function validResearchId(
  value
) {

  const text =
    String(
      value || ""
    ).trim();


  return Boolean(
    text &&
    text.length <= 120 &&
    /^[A-Za-z0-9._-]+$/.test(
      text
    )
  );
}


/* ============================================================
   BRIDGE REQUEST
============================================================ */


async function callBridge(
  payload
) {

  const controller =
    new AbortController();


  const timer =
    setTimeout(
      function () {

        controller.abort();

      },
      120000
    );


  try {

    const response =
      await fetch(
        BRIDGE_URL,
        {
          method:
            "POST",

          redirect:
            "follow",

          signal:
            controller.signal,

          headers: {

            "Content-Type":
              "application/json",

            "Accept":
              "application/json",

            "User-Agent":
              "AXOO-B2G-Auto-Analysis-Queue/1.0"
          },

          body:
            JSON.stringify({
              ...payload,

              token:
                BRIDGE_TOKEN
            })
        }
      );


    const text =
      await response.text();


    if (!response.ok) {

      throw new Error(
        "Bridge HTTP " +
        response.status
      );
    }


    let data;


    try {

      data =
        JSON.parse(
          text
        );

    } catch (error) {

      throw new Error(
        "Bridge JSON 응답이 아닙니다: " +
        text
          .slice(
            0,
            160
          )
          .replace(
            /\s+/g,
            " "
          )
      );
    }


    if (
      !data ||
      data.ok !== true
    ) {

      throw new Error(
        "Bridge error: " +
        (
          data &&
          data.error
            ? data.error
            : "unknown error"
        )
      );
    }


    return data;


  } finally {

    clearTimeout(
      timer
    );
  }
}


/* ============================================================
   DATE
============================================================ */


function parseBridgeModifiedTime(
  value
) {

  const text =
    String(
      value || ""
    ).trim();


  if (!text) {

    return NaN;
  }


  /*
   * Apps Script Bridge가
   * Asia/Seoul 기준으로
   *
   * 2026-08-26 17:48:52
   *
   * 형태로 전달하므로
   * +09:00을 명시한다.
   */

  return Date.parse(
    text.replace(
      " ",
      "T"
    ) +
    "+09:00"
  );
}


/* ============================================================
   EXISTING ANALYSIS
============================================================ */


function readExistingAnalysis(
  researchId
) {

  const filePath =
    path.join(
      ANALYSIS_DIR,
      researchId +
      ".json"
    );


  if (
    !fs.existsSync(
      filePath
    )
  ) {

    return {

      exists:
        false,

      data:
        null
    };
  }


  try {

    const data =
      JSON.parse(
        fs.readFileSync(
          filePath,
          "utf8"
        )
      );


    return {

      exists:
        true,

      data:
        data
    };


  } catch (error) {

    return {

      exists:
        true,

      data:
        null
    };
  }
}


/* ============================================================
   PROJECT DECISION
============================================================ */


function decideProject(
  project
) {

  const researchId =
    String(
      project.researchId ||
      ""
    ).trim();


  /*
   * 잘못된 Research ID 제외
   */

  if (
    !validResearchId(
      researchId
    )
  ) {

    return {

      analyze:
        false,

      reason:
        "invalid_research_id"
    };
  }


  /*
   * Drive 파일 준비 안 됨
   */

  if (
    project.fileStatus !==
    "ready"
  ) {

    return {

      analyze:
        false,

      reason:
        project.fileStatus ||
        "files_not_ready"
    };
  }


  const files =
    Array.isArray(
      project.files
    )
      ? project.files
      : [];


  /*
   * 공고 원본 없음
   */

  if (
    files.length < 1
  ) {

    return {

      analyze:
        false,

      reason:
        "no_notice_files"
    };
  }


  const existing =
    readExistingAnalysis(
      researchId
    );


  /*
   * 분석 JSON 자체가 없음
   */

  if (
    !existing.exists
  ) {

    return {

      analyze:
        true,

      reason:
        "analysis_missing"
    };
  }


  /*
   * 분석 JSON 파싱 불가
   */

  if (
    !existing.data
  ) {

    return {

      analyze:
        true,

      reason:
        "analysis_invalid_json"
    };
  }


  /*
   * 기존 분석 status가 ok가 아님
   */

  if (
    existing.data.status !==
    "ok"
  ) {

    return {

      analyze:
        true,

      reason:
        "analysis_not_ok"
    };
  }


  /*
   * 현재 Drive 파일과
   * 기존 분석 대상 문서 비교
   */

  const analysisDocuments =
    Array.isArray(
      existing.data.documents
    )
      ? existing.data.documents
      : [];


  const bridgeNames =
    files
      .map(
        function (
          file
        ) {

          return String(
            file.name ||
            ""
          ).trim();
        }
      )
      .filter(
        Boolean
      )
      .sort();


  const analysisNames =
    analysisDocuments
      .map(
        function (
          document
        ) {

          return String(
            document.name ||
            ""
          ).trim();
        }
      )
      .filter(
        Boolean
      )
      .sort();


  /*
   * 파일 개수가 달라짐
   */

  if (
    bridgeNames.length !==
    analysisNames.length
  ) {

    return {

      analyze:
        true,

      reason:
        "notice_file_count_changed"
    };
  }


  /*
   * 파일 이름 구성이 달라짐
   */

  if (
    bridgeNames.join(
      "\n"
    ) !==
    analysisNames.join(
      "\n"
    )
  ) {

    return {

      analyze:
        true,

      reason:
        "notice_file_names_changed"
    };
  }


  /*
   * 기존 분석 생성 시각
   */

  const generatedAt =
    Date.parse(
      String(
        existing.data.generatedAt ||
        ""
      )
    );


  /*
   * Drive 공고파일 수정시각
   */

  const modifiedTimes =
    files
      .map(
        function (
          file
        ) {

          return parseBridgeModifiedTime(
            file.modifiedTime
          );
        }
      )
      .filter(
        Number.isFinite
      );


  /*
   * 분석 이후 공고파일이
   * 수정됐다면 재분석
   */

  if (
    Number.isFinite(
      generatedAt
    ) &&
    modifiedTimes.length > 0 &&
    Math.max(
      ...modifiedTimes
    ) >
    generatedAt
  ) {

    return {

      analyze:
        true,

      reason:
        "notice_file_newer_than_analysis"
    };
  }


  /*
   * 현재 분석 최신 상태
   */

  return {

    analyze:
      false,

    reason:
      "up_to_date"
  };
}


/* ============================================================
   MAIN
============================================================ */


async function main() {

  ensureConfig();


  /*
   * Apps Script File Bridge에서
   * 현재 활성 프로젝트 목록 조회
   */

  const result =
    await callBridge({

      action:
        "projects"
    });


  if (
    !Array.isArray(
      result.projects
    )
  ) {

    throw new Error(
      "Bridge projects 응답이 올바르지 않습니다."
    );
  }


  const inspected =
    [];


  const queue =
    [];


  for (
    const project
    of result.projects
  ) {

    const decision =
      decideProject(
        project
      );


    const item = {

      projectId:
        String(
          project.projectId ||
          ""
        ).trim(),

      researchId:
        String(
          project.researchId ||
          ""
        ).trim(),

      projectTitle:
        String(
          project.projectTitle ||
          ""
        ).trim(),

      status:
        String(
          project.status ||
          ""
        ).trim(),

      fileStatus:
        String(
          project.fileStatus ||
          ""
        ).trim(),

      fileCount:
        Number(
          project.fileCount ||
          0
        ),

      analyze:
        decision.analyze,

      reason:
        decision.reason
    };


    inspected.push(
      item
    );


    if (
      decision.analyze
    ) {

      queue.push(
        item
      );
    }
  }


  const output = {

    ok:
      true,

    checkedCount:
      inspected.length,

    queueCount:
      queue.length,

    queue:
      queue,

    inspected:
      inspected
  };


  /*
   * Workflow 내부에서만 사용하는
   * 임시 큐 JSON
   */

  fs.mkdirSync(
    path.dirname(
      OUTPUT_PATH
    ),
    {
      recursive:
        true
    }
  );


  fs.writeFileSync(
    OUTPUT_PATH,

    JSON.stringify(
      output,
      null,
      2
    ) +
    "\n",

    "utf8"
  );


  /*
   * GitHub Actions 로그
   */

  console.log(
    "========================================"
  );

  console.log(
    "AXOO AUTO NOTICE ANALYSIS QUEUE"
  );

  console.log(
    "========================================"
  );


  console.log(
    "Checked:",
    inspected.length
  );


  console.log(
    "Queued:",
    queue.length
  );


  console.log(
    ""
  );


  inspected.forEach(
    function (
      item
    ) {

      console.log(
        item.analyze
          ? "[QUEUE]"
          : "[SKIP]",

        item.projectId,

        item.researchId,

        "|",

        item.reason
      );
    }
  );


  console.log(
    "========================================"
  );
}


/* ============================================================
   RUN
============================================================ */


main().catch(
  function (
    error
  ) {

    console.error(

      "FATAL:",

      error &&
      error.message
        ? error.message
        : error
    );


    process.exit(
      1
    );
  }
);
