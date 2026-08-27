const fs = require("fs");
const path = require("path");


// ========================================================
// AXOO B2G
// 건축물 미술작품 공고 첨부파일 URL 수집기
//
// INPUT
// data/art_commissions_archive.json
//
// OUTPUT
// data/art_notice_attachments.json
//
// TEST
// ART_NOTICE_ID=external-10a9592b4d5eec3a
// ========================================================


const ROOT_DIR =
  path.resolve(
    __dirname,
    ".."
  );


const ARCHIVE_PATH =
  path.join(
    ROOT_DIR,
    "data",
    "art_commissions_archive.json"
  );


const OUTPUT_PATH =
  path.join(
    ROOT_DIR,
    "data",
    "art_notice_attachments.json"
  );


const TARGET_ID =
  String(
    process.env.ART_NOTICE_ID ||
    ""
  ).trim();


const ALLOWED_EXTENSIONS = [
  ".hwp",
  ".hwpx",
  ".pdf"
];


// --------------------------------------------------------
// 기본 유틸
// --------------------------------------------------------

function decodeHtml(
  value
) {

  return String(
    value || ""
  )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      "\""
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    )
    .replace(
      /&nbsp;/gi,
      " "
    );
}



function stripTags(
  value
) {

  return decodeHtml(
    String(
      value || ""
    )
      .replace(
        /<br\s*\/?>/gi,
        "\n"
      )
      .replace(
        /<[^>]+>/g,
        " "
      )
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}



function getExtension(
  fileName
) {

  const lower =
    String(
      fileName || ""
    )
      .toLowerCase()
      .trim();


  return ALLOWED_EXTENSIONS.find(
    function (
      ext
    ) {

      return lower.endsWith(
        ext
      );
    }
  ) || "";
}



function normalizeUrl(
  href,
  baseUrl
) {

  if (
    !href
  ) {

    return "";
  }


  try {

    return new URL(
      decodeHtml(
        href
      ),
      baseUrl
    ).toString();

  } catch (
    error
  ) {

    return "";
  }
}



function uniqueAttachments(
  attachments
) {

  const seen =
    new Set();


  return attachments.filter(
    function (
      item
    ) {

      const key =
        [
          item.name,
          item.url
        ].join(
          "||"
        );


      if (
        seen.has(
          key
        )
      ) {

        return false;
      }


      seen.add(
        key
      );


      return true;
    }
  );
}


// --------------------------------------------------------
// HTML에서 첨부파일 검색
// --------------------------------------------------------

function extractAnchorAttachments(
  html,
  pageUrl
) {

  const result = [];


  const anchorRegex =
    /<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;


  let match;


  while (
    (
      match =
        anchorRegex.exec(
          html
        )
    )
  ) {

    const href =
      match[2];


    const label =
      stripTags(
        match[4]
      );


    const extension =
      getExtension(
        label
      ) ||
      getExtension(
        href
      );


    if (
      !extension
    ) {

      continue;
    }


    const url =
      normalizeUrl(
        href,
        pageUrl
      );


    if (
      !url
    ) {

      continue;
    }


    result.push({
      name:
        label ||
        path.basename(
          new URL(
            url
          ).pathname
        ),

      extension:
        extension,

      url:
        url
    });
  }


  return result;
}



function extractScriptAttachments(
  html,
  pageUrl
) {

  const result = [];


  /*
    경기도 사이트 예:

    previewAjax(
      'https://www.gg.go.kr/publicart/cmmn/download.do?idx=...',
      '공모지침서.hwp'
    )
  */


  const scriptRegex =
    /(?:previewAjax|preListen)\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+\.(?:hwp|hwpx|pdf))['"]/gi;


  let match;


  while (
    (
      match =
        scriptRegex.exec(
          html
        )
    )
  ) {

    const url =
      normalizeUrl(
        match[1],
        pageUrl
      );


    const name =
      decodeHtml(
        match[2]
      ).trim();


    const extension =
      getExtension(
        name
      );


    if (
      !url ||
      !extension
    ) {

      continue;
    }


    result.push({
      name:
        name,

      extension:
        extension,

      url:
        url
    });
  }


  return result;
}



function extractAttachments(
  html,
  pageUrl
) {

  return uniqueAttachments([
    ...extractAnchorAttachments(
      html,
      pageUrl
    ),

    ...extractScriptAttachments(
      html,
      pageUrl
    )
  ])
    .sort(
      function (
        a,
        b
      ) {

        return a.name.localeCompare(
          b.name,
          "ko"
        );
      }
    );
}


// --------------------------------------------------------
// 페이지 요청
// --------------------------------------------------------

async function fetchHtml(
  url
) {

  const response =
    await fetch(
      url,
      {
        redirect:
          "follow",

        headers: {
          "User-Agent":
            "Mozilla/5.0 AXOO-B2G-Research/1.0",

          "Accept":
            "text/html,application/xhtml+xml",

          "Accept-Language":
            "ko-KR,ko;q=0.9,en;q=0.8"
        }
      }
    );


  if (
    !response.ok
  ) {

    throw new Error(
      "HTTP " +
      response.status +
      " " +
      response.statusText
    );
  }


  return await response.text();
}


// --------------------------------------------------------
// Main
// --------------------------------------------------------

async function main() {

  if (
    !fs.existsSync(
      ARCHIVE_PATH
    )
  ) {

    throw new Error(
      "Archive not found: " +
      ARCHIVE_PATH
    );
  }


  const archive =
    JSON.parse(
      fs.readFileSync(
        ARCHIVE_PATH,
        "utf8"
      )
    );


  let targets =
    archive.filter(
      function (
        item
      ) {

        return Boolean(
          item &&
          item.id &&
          (
            item.sourceUrl ||
            item.url ||
            item.originalUrl
          )
        );
      }
    );


  // LIVE/current 공고 우선
  targets =
    targets.filter(
      function (
        item
      ) {

        return item.archiveIsCurrent !==
          false;
      }
    );


  // 특정 공고 테스트
  if (
    TARGET_ID
  ) {

    targets =
      targets.filter(
        function (
          item
        ) {

          return item.id ===
            TARGET_ID;
        }
      );
  }


  console.log(
    "========================================"
  );

  console.log(
    "AXOO ART NOTICE ATTACHMENT EXTRACTOR"
  );

  console.log(
    "Targets:",
    targets.length
  );

  console.log(
    "========================================"
  );


  const output = [];


  for (
    const item
    of targets
  ) {

    const sourceUrl =
      item.sourceUrl ||
      item.originalUrl ||
      item.url;


    console.log(
      "\n[NOTICE]",
      item.id
    );

    console.log(
      item.title
    );


    try {

      const html =
        await fetchHtml(
          sourceUrl
        );


      const attachments =
        extractAttachments(
          html,
          sourceUrl
        );


      console.log(
        "Attachments:",
        attachments.length
      );


      attachments.forEach(
        function (
          attachment
        ) {

          console.log(
            " -",
            attachment.name
          );
        }
      );


      output.push({
        researchId:
          item.id,

        title:
          item.title || "",

        source:
          item.source || "",

        sourceUrl:
          sourceUrl,

        status:
          attachments.length
            ? "ok"
            : "no_attachments",

        attachments:
          attachments
      });

    } catch (
      error
    ) {

      console.error(
        "ERROR:",
        error.message
      );


      output.push({
        researchId:
          item.id,

        title:
          item.title || "",

        source:
          item.source || "",

        sourceUrl:
          sourceUrl,

        status:
          "fetch_error",

        error:
          error.message,

        attachments: []
      });
    }
  }


  output.sort(
    function (
      a,
      b
    ) {

      return a.researchId.localeCompare(
        b.researchId
      );
    }
  );


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
    "\n========================================"
  );

  console.log(
    "Saved:"
  );

  console.log(
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
      error
    );

    process.exit(
      1
    );
  }
);
