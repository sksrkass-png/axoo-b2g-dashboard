const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  pathToFileURL
} = require("url");


/**
 * ============================================================
 * AXOO B2G
 * ART NOTICE DRIVE BRIDGE DOWNLOADER
 * ============================================================
 *
 * Apps Script Bridge
 *   → PROJECTS Sheet
 *   → Project Drive / 01_공고문
 *   → HWP / HWPX / PDF
 *   → GitHub Actions 임시 폴더
 *
 * OUTPUT
 * data/art_notice_attachments.json
 *
 * 실제 바이너리는 .tmp 아래에만 저장하며
 * GitHub Repository에는 Commit하지 않는다.
 * ============================================================
 */


const ROOT_DIR =
  path.resolve(
    __dirname,
    ".."
  );


const OUTPUT_PATH =
  path.join(
    ROOT_DIR,
    "data",
    "art_notice_attachments.json"
  );


const TEMP_ROOT =
  path.join(
    ROOT_DIR,
    ".tmp",
    "art_notice_raw"
  );


const TARGET_ID =
  String(
    process.env.ART_NOTICE_ID ||
    ""
  ).trim();


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


const ALLOWED_EXTENSIONS = [
  ".hwp",
  ".hwpx",
  ".pdf"
];


const MAX_FILE_BYTES =
  15 * 1024 * 1024;


/* ============================================================
   BASIC
============================================================ */

function getExtension(
  fileName
) {

  const lower =
    String(
      fileName || ""
    )
      .trim()
      .toLowerCase();


  return (
    ALLOWED_EXTENSIONS.find(
      function (
        extension
      ) {

        return lower.endsWith(
          extension
        );
      }
    ) || ""
  );
}


function safeFileName(
  fileName
) {

  const base =
    path.basename(
      String(
        fileName || ""
      )
    );


  if (
    !base ||
    base === "." ||
    base === ".."
  ) {

    throw new Error(
      "Invalid file name"
    );
  }


  return base;
}


function sha256(
  buffer
) {

  return crypto
    .createHash(
      "sha256"
    )
    .update(
      buffer
    )
    .digest(
      "hex"
    );
}


function ensureConfig() {

  if (!TARGET_ID) {

    throw new Error(
      "ART_NOTICE_ID가 없습니다."
    );
  }


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
              "AXOO-B2G-GitHub-Bridge/1.0"
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

      const preview =
        text
          .slice(
            0,
            200
          )
          .replace(
            /\s+/g,
            " "
          );


      throw new Error(
        "Bridge JSON 응답이 아닙니다: " +
        preview
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
   LIST
============================================================ */

async function getFileList() {

  console.log(
    "Bridge LIST 요청"
  );


  const result =
    await callBridge({
      action:
        "list",

      researchId:
        TARGET_ID
    });


  if (
    !Array.isArray(
      result.files
    )
  ) {

    throw new Error(
      "Bridge files 응답이 올바르지 않습니다."
    );
  }


  const files =
    result.files.filter(
      function (
        file
      ) {

        return Boolean(
          getExtension(
            file.name
          )
        );
      }
    );


  if (
    files.length === 0
  ) {

    throw new Error(
      "01_공고문에 HWP/HWPX/PDF가 없습니다."
    );
  }


  return {
    projectId:
      result.projectId || "",

    projectTitle:
      result.projectTitle || "",

    files:
      files
  };
}


/* ============================================================
   DOWNLOAD ONE FILE
============================================================ */

async function downloadFile(
  fileInfo,
  targetDirectory
) {

  const fileName =
    safeFileName(
      fileInfo.name
    );


  const extension =
    getExtension(
      fileName
    );


  if (!extension) {

    throw new Error(
      "지원하지 않는 확장자: " +
      fileName
    );
  }


  const expectedSize =
    Number(
      fileInfo.size || 0
    );


  if (
    expectedSize >
    MAX_FILE_BYTES
  ) {

    throw new Error(
      "파일 크기 제한 초과: " +
      fileName
    );
  }


  console.log(
    "[DOWNLOAD]",
    fileName
  );


  const result =
    await callBridge({
      action:
        "file",

      researchId:
        TARGET_ID,

      fileName:
        fileName
    });


  if (
    !result.file ||
    result.file.encoding !==
      "base64" ||
    !result.file.data
  ) {

    throw new Error(
      "Bridge 파일 데이터가 올바르지 않습니다: " +
      fileName
    );
  }


  const buffer =
    Buffer.from(
      result.file.data,
      "base64"
    );


  if (
    buffer.length === 0
  ) {

    throw new Error(
      "빈 파일입니다: " +
      fileName
    );
  }


  if (
    buffer.length >
    MAX_FILE_BYTES
  ) {

    throw new Error(
      "다운로드 파일 크기 제한 초과: " +
      fileName
    );
  }


  if (
    result.file.size &&
    Number(
      result.file.size
    ) !==
      buffer.length
  ) {

    throw new Error(
      "파일 크기 검증 실패: " +
      fileName
    );
  }


  const actualHash =
    sha256(
      buffer
    );


  if (
    result.file.sha256 &&
    String(
      result.file.sha256
    ).toLowerCase() !==
      actualHash
  ) {

    throw new Error(
      "SHA256 검증 실패: " +
      fileName
    );
  }


  const localPath =
    path.join(
      targetDirectory,
      fileName
    );


  fs.writeFileSync(
    localPath,
    buffer
  );


  console.log(
    "  bytes:",
    buffer.length
  );


  return {
    name:
      fileName,

    extension:
      extension,

    mimeType:
      result.file.mimeType ||
      fileInfo.mimeType ||
      "",

    size:
      buffer.length,

    modifiedTime:
      fileInfo.modifiedTime ||
      "",

    sha256:
      actualHash,

    source:
      "apps_script_bridge",

    // Python extractor가 현재 URL 입력 구조라
    // 로컬 임시파일을 file:// URL로 전달한다.
    url:
      pathToFileURL(
        localPath
      ).href
  };
}


/* ============================================================
   MAIN
============================================================ */

async function main() {

  ensureConfig();


  console.log(
    "========================================"
  );

  console.log(
    "AXOO ART NOTICE DRIVE BRIDGE"
  );

  console.log(
    "Research ID:",
    TARGET_ID
  );

  console.log(
    "========================================"
  );


  const targetDirectory =
    path.join(
      TEMP_ROOT,
      TARGET_ID
    );


  fs.rmSync(
    targetDirectory,
    {
      recursive:
        true,

      force:
        true
    }
  );


  fs.mkdirSync(
    targetDirectory,
    {
      recursive:
        true
    }
  );


  const listing =
    await getFileList();


  console.log(
    "Project:",
    listing.projectId,
    listing.projectTitle
  );


  console.log(
    "Files:",
    listing.files.length
  );


  listing.files.forEach(
    function (
      file
    ) {

      console.log(
        " -",
        file.name,
        "|",
        file.size,
        "bytes"
      );
    }
  );


  const attachments =
    [];


  for (
    const fileInfo
    of listing.files
  ) {

    const attachment =
      await downloadFile(
        fileInfo,
        targetDirectory
      );


    attachments.push(
      attachment
    );
  }


  const output = [
    {
      researchId:
        TARGET_ID,

      projectId:
        listing.projectId,

      title:
        listing.projectTitle,

      source:
        "apps_script_bridge",

      sourceUrl:
        "",

      status:
        "ok",

      attachments:
        attachments
    }
  ];


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
    ) + "\n",
    "utf8"
  );


  console.log(
    ""
  );

  console.log(
    "========================================"
  );

  console.log(
    "Bridge download complete"
  );

  console.log(
    "Files:",
    attachments.length
  );

  console.log(
    "Runtime manifest:",
    path.relative(
      ROOT_DIR,
      OUTPUT_PATH
    )
  );

  console.log(
    "========================================"
  );
}


main().catch(
  function (
    error
  ) {

    console.error(
      ""
    );

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
