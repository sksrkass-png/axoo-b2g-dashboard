const {
  getRegionalSources,
  getNationalSources
} = require(
  "./art_commission_sources"
);

const {
  getSourceRequests,
  describeSourceAdapter
} = require(
  "./art_source_adapters"
);


/* =========================================================
   CONFIG
========================================================= */

const FETCH_TIMEOUT_MS =
  8000;


/* =========================================================
   SOURCE REGISTRY
========================================================= */

function loadAllSources() {

  const result =
    [];


  getRegionalSources()
    .forEach(
      function (
        region
      ) {

        region.sources.forEach(
          function (
            source
          ) {

            result.push({

              region: {

                id:
                  region.id,

                name:
                  region.name,

                fullName:
                  region.fullName
              },

              source:
                source
            });
          }
        );
      }
    );


  const nationalRegion = {

    id:
      "national",

    name:
      "전국",

    fullName:
      "전국 공통 백업"
  };


  getNationalSources()
    .forEach(
      function (
        source
      ) {

        result.push({

          region:
            nationalRegion,

          source:
            source
        });
      }
    );


  return result;
}


function findSource(
  sourceId
) {

  return loadAllSources()
    .find(
      function (
        entry
      ) {

        return (
          entry.source.id ===
          sourceId
        );
      }
    );
}


/* =========================================================
   FETCH
========================================================= */

async function fetchHtml(
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

          method:
            "GET",

          signal:
            controller.signal,

          redirect:
            "follow",

          headers: {

            "User-Agent":
              "Mozilla/5.0 (compatible; AXOO-B2G-JSProbe/1.0)",

            "Accept":
              "text/html,application/xhtml+xml,*/*",

            "Accept-Language":
              "ko-KR,ko;q=0.9,en;q=0.6"
          }
        }
      );


    return {

      status:
        response.status,

      ok:
        response.ok,

      finalUrl:
        response.url,

      html:
        await response.text()
    };


  } finally {

    clearTimeout(
      timer
    );
  }
}


/* =========================================================
   TEXT HELPERS
========================================================= */

function normalizeText(
  value
) {

  return String(
    value || ""
  )

    .replace(
      /\r/g,
      ""
    )

    .trim();
}


function printBlock(
  title,
  value
) {

  console.log(
    ""
  );


  console.log(
    "===================================="
  );


  console.log(
    title
  );


  console.log(
    "===================================="
  );


  console.log(
    value ||
    "(NOT FOUND)"
  );
}


/* =========================================================
   FUNCTION EXTRACTOR
========================================================= */

function extractFunction(
  html,
  functionName
) {

  const marker =
    "function " +
    functionName;


  const start =
    html.indexOf(
      marker
    );


  if (
    start <
    0
  ) {

    return "";
  }


  const braceStart =
    html.indexOf(
      "{",
      start
    );


  if (
    braceStart <
    0
  ) {

    return "";
  }


  let depth =
    0;


  let quote =
    "";


  let escaped =
    false;


  for (
    let index = braceStart;
    index < html.length;
    index++
  ) {

    const char =
      html[
        index
      ];


    if (
      quote
    ) {

      if (
        escaped
      ) {

        escaped =
          false;


        continue;
      }


      if (
        char ===
        "\\"
      ) {

        escaped =
          true;


        continue;
      }


      if (
        char ===
        quote
      ) {

        quote =
          "";
      }


      continue;
    }


    if (
      char ===
        "\"" ||
      char ===
        "'" ||
      char ===
        "`"
    ) {

      quote =
        char;


      continue;
    }


    if (
      char ===
      "{"
    ) {

      depth++;
    }


    if (
      char ===
      "}"
    ) {

      depth--;


      if (
        depth ===
        0
      ) {

        return html.slice(
          start,
          index + 1
        );
      }
    }
  }


  return "";
}


/* =========================================================
   CONTEXT EXTRACTOR
========================================================= */

function extractContexts(
  html,
  keyword,
  radius
) {

  const result =
    [];


  const lowerHtml =
    html.toLowerCase();


  const lowerKeyword =
    keyword.toLowerCase();


  let cursor =
    0;


  while (
    cursor <
    lowerHtml.length
  ) {

    const index =
      lowerHtml.indexOf(
        lowerKeyword,
        cursor
      );


    if (
      index <
      0
    ) {

      break;
    }


    const start =
      Math.max(
        0,
        index -
        radius
      );


    const end =
      Math.min(
        html.length,
        index +
        keyword.length +
        radius
      );


    const sample =
      normalizeText(
        html.slice(
          start,
          end
        )
      );


    if (
      sample &&
      !result.includes(
        sample
      )
    ) {

      result.push(
        sample
      );
    }


    if (
      result.length >=
      20
    ) {

      break;
    }


    cursor =
      index +
      keyword.length;
  }


  return result;
}


/* =========================================================
   SEARCH SCRIPT DIAGNOSTICS
========================================================= */

function printScriptDiagnostics(
  html
) {

  const functionNames = [

    "fn_egov_link_page",

    "searchCheck",

    "searchCheck2",

    "goSearch"

  ];


  functionNames.forEach(
    function (
      functionName
    ) {

      printBlock(
        "FUNCTION: " +
        functionName,

        extractFunction(
          html,
          functionName
        )
      );
    }
  );


  const keywords = [

    "frm.action",

    "frm.method",

    ".submit()",

    "document.frm",

    "$('#frm')",

    "$(\"#frm\")",

    "pageIndex",

    "recordCountPerPage",

    "sc_orderBy",

    "/crawler/info",

    "$.ajax",

    "ajax("

  ];


  keywords.forEach(
    function (
      keyword
    ) {

      const contexts =
        extractContexts(
          html,
          keyword,
          350
        );


      printBlock(
        "CONTEXT: " +
        keyword,

        contexts.length
          ? contexts.join(
              "\n\n-----\n\n"
            )
          : ""
      );
    }
  );
}


/* =========================================================
   FORM RAW HTML
========================================================= */

function extractRawForm(
  html,
  formName
) {

  const regex =
    new RegExp(
      "<form\\b[^>]*(?:name|id)=[\"']" +
      formName +
      "[\"'][^>]*>[\\s\\S]*?<\\/form>",
      "i"
    );


  const match =
    html.match(
      regex
    );


  if (!match) {

    return "";
  }


  /*
    Form 전체는 너무 길 수 있으므로
    시작부 12,000자까지만 출력.
    JS submit 구조 확인에는 충분하다.
  */
  return match[0]
    .slice(
      0,
      12000
    );
}


/* =========================================================
   PROBE
========================================================= */

async function probeSource(
  target
) {

  const source =
    target.source;


  const adapter =
    describeSourceAdapter(
      source
    );


  const requests =
    getSourceRequests(
      source,
      {
        maxRequests:
          3
      }
    );


  const firstRequest =
    requests[0];


  const pageUrl =
    firstRequest
      ? firstRequest.url
      : source.sourceUrl;


  console.log(
    ""
  );


  console.log(
    "===================================="
  );


  console.log(
    "AXOO ARTNURI SUBMIT JS PROBE"
  );


  console.log(
    "===================================="
  );


  console.log(
    "SOURCE ID:",
    source.id
  );


  console.log(
    "SOURCE:",
    source.sourceName
  );


  console.log(
    "ADAPTER:",
    adapter.adapterId
  );


  console.log(
    "GET:",
    pageUrl
  );


  const response =
    await fetchHtml(
      pageUrl
    );


  console.log(
    "HTTP:",
    response.status
  );


  console.log(
    "FINAL URL:",
    response.finalUrl
  );


  console.log(
    "HTML KB:",
    Math.round(
      Buffer.byteLength(
        response.html,
        "utf8"
      ) /
      1024
    )
  );


  if (
    !response.ok
  ) {

    throw new Error(
      "GET 진단 페이지 접근 실패: HTTP " +
      response.status
    );
  }


  printScriptDiagnostics(
    response.html
  );


  printBlock(
    "RAW FORM: frm",

    extractRawForm(
      response.html,
      "frm"
    )
  );


  console.log(
    ""
  );


  console.log(
    "===================================="
  );


  console.log(
    "PROBE COMPLETE"
  );


  console.log(
    "===================================="
  );


  console.log(
    "✅ 실제 fn_egov_link_page / form submit 구조 추출 완료"
  );
}


/* =========================================================
   RUN
========================================================= */

async function main() {

  const sourceId =
    String(
      process.argv[2] ||
      ""
    )
      .trim();


  if (!sourceId) {

    throw new Error(
      "SOURCE_ID가 필요합니다."
    );
  }


  const target =
    findSource(
      sourceId
    );


  if (!target) {

    throw new Error(
      "SOURCE ID를 찾을 수 없습니다: " +
      sourceId
    );
  }


  await probeSource(
    target
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
        "[AXOO ARTNURI JS PROBE]",
        error
      );


      process.exitCode =
        1;
    }
  );
