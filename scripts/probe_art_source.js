const {
  getRegionalSources,
  getNationalSources
} = require(
  "./art_commission_sources"
);

const {
  isCandidateTitle,
  cleanText,
  extractAnchors,
  followScore,
  canonicalUrl
} = require(
  "./collect_remaining_art_commissions"
);

const {
  getSourceSeedUrls,
  describeSourceAdapter
} = require(
  "./art_source_adapters"
);


/* =========================================================
   CONFIG
========================================================= */

const FETCH_TIMEOUT_MS =
  8000;

const MAX_SEEDS_PER_SOURCE =
  3;

const MAX_LABEL_SAMPLES =
  10;

const MAX_NAV_SAMPLES =
  10;

const MAX_CANDIDATE_SAMPLES =
  10;

const MAX_FORM_SAMPLES =
  10;

const MAX_FIELD_SAMPLES =
  80;

const MAX_SCRIPT_SAMPLES =
  20;


const PRIMARY_KEYWORDS = [
  "미술작품",
  "공공미술"
];

const ACTION_KEYWORDS = [
  "공모",
  "제작",
  "설치",
  "신축",
  "공동주택"
];


/* =========================================================
   HELPERS
========================================================= */

function hasAnyKeyword(
  text,
  keywords
) {

  return keywords.some(
    function (
      keyword
    ) {

      return String(
        text || ""
      ).includes(
        keyword
      );
    }
  );
}


function sameOrigin(
  first,
  second
) {

  try {

    return (
      new URL(
        first
      ).origin ===
      new URL(
        second
      ).origin
    );


  } catch (
    error
  ) {

    return false;
  }
}


function formatBoolean(
  value
) {

  return value
    ? "YES"
    : "NO";
}


function decodeAttribute(
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
    );
}


function getAttribute(
  text,
  name
) {

  const regex =
    new RegExp(
      name +
      "\\s*=\\s*[\"']([^\"']*)[\"']",
      "i"
    );


  const match =
    String(
      text || ""
    ).match(
      regex
    );


  return match
    ? decodeAttribute(
        match[1]
      )
    : "";
}


function shorten(
  value,
  maxLength
) {

  const text =
    String(
      value || ""
    )

      .replace(
        /\s+/g,
        " "
      )

      .trim();


  if (
    text.length <=
    maxLength
  ) {

    return text;
  }


  return (
    text.slice(
      0,
      maxLength
    ) +
    "..."
  );
}


/* =========================================================
   SOURCE REGISTRY
========================================================= */

function loadAllSources() {

  const result =
    [];


  const regional =
    getRegionalSources();


  regional.forEach(
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
   SOURCE LIST
========================================================= */

function printSourceList() {

  const sources =
    loadAllSources();


  console.log(
    ""
  );

  console.log(
    "===================================="
  );

  console.log(
    "AXOO ART SOURCE LIST"
  );

  console.log(
    "===================================="
  );


  sources.forEach(
    function (
      entry
    ) {

      const adapterInfo =
        describeSourceAdapter(
          entry.source
        );


      console.log(
        entry.source.id
      );


      console.log(
        "   지역:",
        entry.region.name
      );


      console.log(
        "   소스:",
        entry.source.sourceName
      );


      console.log(
        "   URL:",
        entry.source.sourceUrl
      );


      console.log(
        "   Adapter:",
        adapterInfo.adapterId
      );


      console.log(
        "   Seeds:",
        adapterInfo.seedUrls.length
      );


      console.log(
        ""
      );
    }
  );


  console.log(
    "TOTAL:",
    sources.length
  );


  console.log(
    "===================================="
  );
}


/* =========================================================
   FETCH
========================================================= */

async function fetchPage(
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


  const startedAt =
    Date.now();


  try {

    const response =
      await fetch(
        url,
        {

          signal:
            controller.signal,

          redirect:
            "follow",

          headers: {

            "User-Agent":
              "Mozilla/5.0 (compatible; AXOO-B2G-SourceProbe/1.2)",

            "Accept":
              "text/html,application/xhtml+xml,*/*",

            "Accept-Language":
              "ko-KR,ko;q=0.9,en;q=0.6"
          }
        }
      );


    const html =
      await response.text();


    return {

      ok:
        response.ok,

      status:
        response.status,

      statusText:
        response.statusText,

      finalUrl:
        response.url,

      contentType:
        response.headers.get(
          "content-type"
        ) || "",

      elapsedMs:
        Date.now() -
        startedAt,

      html:
        html
    };


  } finally {

    clearTimeout(
      timer
    );
  }
}


/* =========================================================
   FORM DIAGNOSTICS
========================================================= */

function extractFormDiagnostics(
  html,
  pageUrl
) {

  const forms =
    [];


  const formRegex =
    /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;


  let formMatch;


  while (
    (
      formMatch =
        formRegex.exec(
          html
        )
    ) !== null &&
    forms.length <
      MAX_FORM_SAMPLES
  ) {

    const attrs =
      formMatch[1] ||
      "";


    const body =
      formMatch[2] ||
      "";


    const method =
      (
        getAttribute(
          attrs,
          "method"
        ) ||
        "GET"
      )
        .toUpperCase();


    const rawAction =
      getAttribute(
        attrs,
        "action"
      );


    const action =
      rawAction
        ? canonicalUrl(
            rawAction,
            pageUrl
          )
        : pageUrl;


    const form = {

      id:
        getAttribute(
          attrs,
          "id"
        ),

      name:
        getAttribute(
          attrs,
          "name"
        ),

      method:
        method,

      action:
        action,

      onsubmit:
        getAttribute(
          attrs,
          "onsubmit"
        ),

      fields:
        []
    };


    const fieldRegex =
      /<(input|select|textarea|button)\b([^>]*)>/gi;


    let fieldMatch;


    while (
      (
        fieldMatch =
          fieldRegex.exec(
            body
          )
      ) !== null &&
      form.fields.length <
        MAX_FIELD_SAMPLES
    ) {

      const tag =
        String(
          fieldMatch[1] ||
          ""
        )
          .toLowerCase();


      const fieldAttrs =
        fieldMatch[2] ||
        "";


      const field = {

        tag:
          tag,

        type:
          getAttribute(
            fieldAttrs,
            "type"
          ),

        name:
          getAttribute(
            fieldAttrs,
            "name"
          ),

        id:
          getAttribute(
            fieldAttrs,
            "id"
          ),

        value:
          getAttribute(
            fieldAttrs,
            "value"
          ),

        placeholder:
          getAttribute(
            fieldAttrs,
            "placeholder"
          ),

        onclick:
          getAttribute(
            fieldAttrs,
            "onclick"
          )
      };


      /*
        검색 구조 분석에 의미 있는 필드만 출력
      */
      if (
        field.name ||
        field.id ||
        field.placeholder ||
        field.onclick ||
        field.type ===
          "submit"
      ) {

        form.fields.push(
          field
        );
      }
    }


    forms.push(
      form
    );
  }


  return forms;
}


/* =========================================================
   SCRIPT DIAGNOSTICS
========================================================= */

function extractSearchScriptSamples(
  html
) {

  const result =
    [];


  const patterns = [

    /function\s+[A-Za-z0-9_$]*(search|Search|srch|Srch)[A-Za-z0-9_$]*\s*\([^)]*\)\s*\{[\s\S]{0,1600}?\}/g,

    /(?:search|Search|srch|Srch)[A-Za-z0-9_$]*\s*=\s*function\s*\([^)]*\)\s*\{[\s\S]{0,1600}?\}/g,

    /(?:onclick|onsubmit)\s*=\s*["'][^"']*(?:search|Search|srch|Srch)[^"']*["']/g,

    /(?:ajax|fetch|\$\.ajax)[\s\S]{0,500}?(?:search|crawler|info)[\s\S]{0,1000}?/gi

  ];


  patterns.forEach(
    function (
      regex
    ) {

      const matches =
        html.match(
          regex
        ) ||
        [];


      matches.forEach(
        function (
          match
        ) {

          const sample =
            shorten(
              match,
              1600
            );


          if (
            !sample ||
            result.includes(
              sample
            )
          ) {

            return;
          }


          if (
            result.length >=
            MAX_SCRIPT_SAMPLES
          ) {

            return;
          }


          result.push(
            sample
          );
        }
      );
    }
  );


  return result;
}


/* =========================================================
   ANALYZE
========================================================= */

function analyzePage(
  source,
  seedUrl,
  fetchResult
) {

  const html =
    fetchResult.html ||
    "";


  const pageUrl =
    fetchResult.finalUrl ||
    seedUrl;


  const rawAnchors =
    (
      html.match(
        /<a\b/gi
      ) || []
    ).length;


  const javascriptAnchors =
    (
      html.match(
        /href\s*=\s*["']\s*javascript:/gi
      ) || []
    ).length;


  const anchors =
    extractAnchors(
      html,
      pageUrl
    );


  const allowedAnchors =
    anchors.filter(
      function (
        anchor
      ) {

        return (
          sameOrigin(
            source.sourceUrl,
            anchor.url
          ) ||
          sameOrigin(
            pageUrl,
            anchor.url
          )
        );
      }
    );


  const primaryAnchors =
    allowedAnchors.filter(
      function (
        anchor
      ) {

        return hasAnyKeyword(
          cleanText(
            anchor.label
          ),
          PRIMARY_KEYWORDS
        );
      }
    );


  const actionAnchors =
    allowedAnchors.filter(
      function (
        anchor
      ) {

        return hasAnyKeyword(
          cleanText(
            anchor.label
          ),
          ACTION_KEYWORDS
        );
      }
    );


  const candidateAnchors =
    allowedAnchors.filter(
      function (
        anchor
      ) {

        return isCandidateTitle(
          anchor.label
        );
      }
    );


  const navigationAnchors =
    allowedAnchors

      .filter(
        function (
          anchor
        ) {

          return (
            followScore(
              anchor
            ) > 0
          );
        }
      )

      .sort(
        function (
          first,
          second
        ) {

          return (
            followScore(
              second
            ) -
            followScore(
              first
            )
          );
        }
      );


  const relatedLabels =
    [];


  allowedAnchors.forEach(
    function (
      anchor
    ) {

      const label =
        cleanText(
          anchor.label
        );


      if (!label) {

        return;
      }


      if (
        !/미술|예술|작품|공모|공고|고시|art/i.test(
          label
        )
      ) {

        return;
      }


      if (
        relatedLabels.includes(
          label
        )
      ) {

        return;
      }


      if (
        relatedLabels.length >=
        MAX_LABEL_SAMPLES
      ) {

        return;
      }


      relatedLabels.push(
        label
      );
    }
  );


  return {

    seedUrl:
      seedUrl,

    pageUrl:
      pageUrl,

    htmlBytes:
      Buffer.byteLength(
        html,
        "utf8"
      ),

    rawAnchors:
      rawAnchors,

    parsedAnchors:
      anchors.length,

    javascriptAnchors:
      javascriptAnchors,

    allowedAnchors:
      allowedAnchors.length,

    primaryAnchors:
      primaryAnchors,

    actionAnchors:
      actionAnchors,

    candidateAnchors:
      candidateAnchors,

    navigationAnchors:
      navigationAnchors,

    relatedLabels:
      relatedLabels,

    forms:
      extractFormDiagnostics(
        html,
        pageUrl
      ),

    searchScripts:
      extractSearchScriptSamples(
        html
      )
  };
}


/* =========================================================
   FORM PRINT
========================================================= */

function printFormDiagnostics(
  forms
) {

  console.log(
    ""
  );

  console.log(
    "------------------------------------"
  );

  console.log(
    "FORM DIAGNOSTICS"
  );

  console.log(
    "------------------------------------"
  );


  console.log(
    "FORMS:",
    forms.length
  );


  forms.forEach(
    function (
      form,
      index
    ) {

      console.log(
        ""
      );


      console.log(
        "FORM #" +
        (
          index +
          1
        )
      );


      console.log(
        "   id:",
        form.id ||
        "-"
      );


      console.log(
        "   name:",
        form.name ||
        "-"
      );


      console.log(
        "   method:",
        form.method
      );


      console.log(
        "   action:",
        form.action ||
        "-"
      );


      console.log(
        "   onsubmit:",
        form.onsubmit ||
        "-"
      );


      console.log(
        "   fields:",
        form.fields.length
      );


      form.fields.forEach(
        function (
          field
        ) {

          console.log(
            "      -",
            [
              "tag=" +
                (
                  field.tag ||
                  "-"
                ),

              "type=" +
                (
                  field.type ||
                  "-"
                ),

              "name=" +
                (
                  field.name ||
                  "-"
                ),

              "id=" +
                (
                  field.id ||
                  "-"
                ),

              "value=" +
                (
                  field.value ||
                  "-"
                ),

              "placeholder=" +
                (
                  field.placeholder ||
                  "-"
                ),

              "onclick=" +
                (
                  field.onclick ||
                  "-"
                )
            ].join(
              " | "
            )
          );
        }
      );
    }
  );
}


/* =========================================================
   SCRIPT PRINT
========================================================= */

function printScriptDiagnostics(
  samples
) {

  console.log(
    ""
  );

  console.log(
    "------------------------------------"
  );

  console.log(
    "SEARCH SCRIPT DIAGNOSTICS"
  );

  console.log(
    "------------------------------------"
  );


  console.log(
    "SAMPLES:",
    samples.length
  );


  samples.forEach(
    function (
      sample,
      index
    ) {

      console.log(
        ""
      );


      console.log(
        "SCRIPT #" +
        (
          index +
          1
        )
      );


      console.log(
        sample
      );
    }
  );
}


/* =========================================================
   SEED RESULT
========================================================= */

function printSeedResult(
  index,
  seedUrl,
  fetchResult,
  analysis
) {

  const originChanged =
    !sameOrigin(
      seedUrl,
      fetchResult.finalUrl
    );


  console.log(
    ""
  );

  console.log(
    "------------------------------------"
  );

  console.log(
    "SEED #" +
    (
      index +
      1
    )
  );

  console.log(
    "------------------------------------"
  );


  console.log(
    "SEED URL:",
    seedUrl
  );


  console.log(
    "FINAL URL:",
    fetchResult.finalUrl
  );


  console.log(
    "ORIGIN CHANGED:",
    formatBoolean(
      originChanged
    )
  );


  console.log(
    "HTTP:",
    fetchResult.status,
    fetchResult.statusText
  );


  console.log(
    "CONTENT TYPE:",
    fetchResult.contentType
  );


  console.log(
    "TIME:",
    fetchResult.elapsedMs +
      "ms"
  );


  console.log(
    "HTML KB:",
    Math.round(
      analysis.htmlBytes /
      1024
    )
  );


  console.log(
    "RAW <a>:",
    analysis.rawAnchors
  );


  console.log(
    "PARSED <a>:",
    analysis.parsedAnchors
  );


  console.log(
    "JAVASCRIPT HREF:",
    analysis.javascriptAnchors
  );


  console.log(
    "ALLOWED ORIGIN:",
    analysis.allowedAnchors
  );


  console.log(
    "PRIMARY KEYWORD:",
    analysis.primaryAnchors.length
  );


  console.log(
    "ACTION KEYWORD:",
    analysis.actionAnchors.length
  );


  console.log(
    "CANDIDATE:",
    analysis.candidateAnchors.length
  );


  console.log(
    "NAVIGATION:",
    analysis.navigationAnchors.length
  );


  if (
    analysis.relatedLabels.length >
    0
  ) {

    console.log(
      ""
    );


    console.log(
      "RELATED LABEL SAMPLE:"
    );


    analysis.relatedLabels
      .forEach(
        function (
          label
        ) {

          console.log(
            "   -",
            label
          );
        }
      );
  }


  if (
    analysis.candidateAnchors.length >
    0
  ) {

    console.log(
      ""
    );


    console.log(
      "🎯 CANDIDATE SAMPLE:"
    );


    analysis.candidateAnchors

      .slice(
        0,
        MAX_CANDIDATE_SAMPLES
      )

      .forEach(
        function (
          anchor
        ) {

          console.log(
            "   -",
            anchor.label
          );


          console.log(
            "     ",
            anchor.url
          );
        }
      );
  }
}


/* =========================================================
   COMBINED RESULT
========================================================= */

function buildCombinedResult(
  analyses
) {

  const candidateMap =
    new Map();


  let htmlBytes =
    0;

  let rawAnchors =
    0;

  let parsedAnchors =
    0;

  let javascriptAnchors =
    0;

  let allowedAnchors =
    0;

  let primaryAnchors =
    0;

  let actionAnchors =
    0;

  let navigationAnchors =
    0;


  analyses.forEach(
    function (
      analysis
    ) {

      htmlBytes +=
        analysis.htmlBytes;

      rawAnchors +=
        analysis.rawAnchors;

      parsedAnchors +=
        analysis.parsedAnchors;

      javascriptAnchors +=
        analysis.javascriptAnchors;

      allowedAnchors +=
        analysis.allowedAnchors;

      primaryAnchors +=
        analysis.primaryAnchors.length;

      actionAnchors +=
        analysis.actionAnchors.length;

      navigationAnchors +=
        analysis.navigationAnchors.length;


      analysis.candidateAnchors
        .forEach(
          function (
            anchor
          ) {

            if (
              !candidateMap.has(
                anchor.url
              )
            ) {

              candidateMap.set(
                anchor.url,
                anchor
              );
            }
          }
        );
    }
  );


  return {

    htmlBytes:
      htmlBytes,

    rawAnchors:
      rawAnchors,

    parsedAnchors:
      parsedAnchors,

    javascriptAnchors:
      javascriptAnchors,

    allowedAnchors:
      allowedAnchors,

    primaryAnchors:
      primaryAnchors,

    actionAnchors:
      actionAnchors,

    candidateAnchors:
      Array.from(
        candidateMap.values()
      ),

    navigationAnchors:
      navigationAnchors
  };
}


/* =========================================================
   INTERPRETATION
========================================================= */

function printInterpretation(
  successfulSeeds,
  failedSeeds,
  combined
) {

  console.log(
    ""
  );

  console.log(
    "===================================="
  );

  console.log(
    "PROBE SUMMARY"
  );

  console.log(
    "===================================="
  );


  console.log(
    "SUCCESSFUL SEEDS:",
    successfulSeeds
  );


  console.log(
    "FAILED SEEDS:",
    failedSeeds
  );


  console.log(
    "HTML KB:",
    Math.round(
      combined.htmlBytes /
      1024
    )
  );


  console.log(
    "RAW <a>:",
    combined.rawAnchors
  );


  console.log(
    "PARSED <a>:",
    combined.parsedAnchors
  );


  console.log(
    "JAVASCRIPT HREF:",
    combined.javascriptAnchors
  );


  console.log(
    "ALLOWED ORIGIN:",
    combined.allowedAnchors
  );


  console.log(
    "PRIMARY KEYWORD:",
    combined.primaryAnchors
  );


  console.log(
    "ACTION KEYWORD:",
    combined.actionAnchors
  );


  console.log(
    "UNIQUE CANDIDATE:",
    combined.candidateAnchors.length
  );


  console.log(
    "NAVIGATION:",
    combined.navigationAnchors
  );


  console.log(
    ""
  );

  console.log(
    "===================================="
  );

  console.log(
    "PROBE INTERPRETATION"
  );

  console.log(
    "===================================="
  );


  if (
    successfulSeeds ===
    0
  ) {

    console.log(
      "❌ 모든 Seed URL 접근에 실패했습니다."
    );


  } else if (
    combined.primaryAnchors ===
      0
  ) {

    console.log(
      "⚠️ 검색 Seed GET 파라미터로는 검색 결과가 반영되지 않습니다."
    );


    console.log(
      "→ FORM DIAGNOSTICS의 method/action/name을 기준으로 실제 검색 요청을 구현하세요."
    );


  } else if (
    combined.candidateAnchors.length >
      0
  ) {

    console.log(
      "✅ 실제 공모 후보 탐지에 성공했습니다."
    );


  } else {

    console.log(
      "ℹ️ 관련 결과는 있으나 Candidate Filter를 추가 확인해야 합니다."
    );
  }


  console.log(
    "===================================="
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


  const region =
    target.region;


  const adapterInfo =
    describeSourceAdapter(
      source
    );


  const seedUrls =
    getSourceSeedUrls(
      source,
      {
        maxSeeds:
          MAX_SEEDS_PER_SOURCE
      }
    );


  console.log(
    ""
  );

  console.log(
    "===================================="
  );

  console.log(
    "AXOO ART SOURCE PROBE"
  );

  console.log(
    "===================================="
  );


  console.log(
    "SOURCE ID:",
    source.id
  );


  console.log(
    "REGION:",
    region.name
  );


  console.log(
    "SOURCE:",
    source.sourceName
  );


  console.log(
    "SOURCE URL:",
    source.sourceUrl
  );


  console.log(
    "ADAPTER APPLIED:",
    formatBoolean(
      adapterInfo.applied
    )
  );


  console.log(
    "ADAPTER ID:",
    adapterInfo.adapterId
  );


  console.log(
    "SEED COUNT:",
    seedUrls.length
  );


  const analyses =
    [];


  let successfulSeeds =
    0;


  let failedSeeds =
    0;


  for (
    let index = 0;
    index < seedUrls.length;
    index++
  ) {

    const seedUrl =
      seedUrls[
        index
      ];


    try {

      const fetchResult =
        await fetchPage(
          seedUrl
        );


      successfulSeeds++;


      const analysis =
        analyzePage(
          source,
          seedUrl,
          fetchResult
        );


      analyses.push(
        analysis
      );


      printSeedResult(
        index,
        seedUrl,
        fetchResult,
        analysis
      );


      /*
        첫 Seed에서만 FORM / SCRIPT 구조 출력.
        동일 페이지 구조가 반복되므로 로그 폭주 방지.
      */
      if (
        index ===
        0
      ) {

        printFormDiagnostics(
          analysis.forms
        );


        printScriptDiagnostics(
          analysis.searchScripts
        );
      }


    } catch (
      error
    ) {

      failedSeeds++;


      console.log(
        ""
      );


      console.log(
        "SEED #" +
        (
          index +
          1
        ) +
        " FAILED"
      );


      console.log(
        "URL:",
        seedUrl
      );


      console.log(
        "ERROR:",
        error.name,
        "|",
        error.message
      );
    }
  }


  const combined =
    buildCombinedResult(
      analyses
    );


  printInterpretation(
    successfulSeeds,
    failedSeeds,
    combined
  );


  if (
    successfulSeeds ===
    0
  ) {

    process.exitCode =
      1;
  }
}


/* =========================================================
   RUN
========================================================= */

async function main() {

  const argument =
    String(
      process.argv[2] ||
      ""
    ).trim();


  if (
    !argument ||
    argument ===
      "--list"
  ) {

    printSourceList();


    return;
  }


  const target =
    findSource(
      argument
    );


  if (!target) {

    console.error(
      "❌ SOURCE ID를 찾을 수 없습니다:",
      argument
    );


    process.exitCode =
      1;


    return;
  }


  console.log(
    ""
  );


  console.log(
    "🔎 SOURCE PROBE START"
  );


  console.log(
    "SOURCE ID:",
    target.source.id
  );


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
        "[AXOO ART SOURCE PROBE]",
        error
      );


      process.exitCode =
        1;
    }
  );
