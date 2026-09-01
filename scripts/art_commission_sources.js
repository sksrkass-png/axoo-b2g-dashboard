const fs = require("fs");
const path = require("path");

const {
  TARGET_ART_REGIONS
} = require("./art_region_scope");


/* =========================================================
   CONFIG
========================================================= */

const SOURCE_FILE =
  path.join(
    process.cwd(),
    "data",
    "art_commission_source_targets.json"
  );


const PREFERRED_SOURCE_TYPES = [
  "official_portal",
  "official_board",
  "official_notice",
  "local_art_portal",
  "public_corporation",
  "national_portal"
];


/* =========================================================
   HELPERS
========================================================= */

function clean(value) {

  return String(
    value == null
      ? ""
      : value
  ).trim();
}


function loadSourceTargets() {

  if (
    !fs.existsSync(
      SOURCE_FILE
    )
  ) {

    throw new Error(
      "art_commission_source_targets.json 파일을 찾을 수 없습니다."
    );
  }


  const parsed =
    JSON.parse(
      fs.readFileSync(
        SOURCE_FILE,
        "utf8"
      )
    );


  if (
    !Array.isArray(
      parsed
    )
  ) {

    throw new Error(
      "art_commission_source_targets.json 형식이 배열이 아닙니다."
    );
  }


  return parsed;
}


function sourceTypeRank(
  sourceType
) {

  const index =
    PREFERRED_SOURCE_TYPES.indexOf(
      clean(
        sourceType
      )
    );


  return index === -1
    ? 999
    : index;
}


/* =========================================================
   REGION SOURCES
========================================================= */

function getRegionalSources() {

  const targets =
    loadSourceTargets();


  return TARGET_ART_REGIONS.map(
    function (
      region
    ) {

      const sources =
        targets
          .filter(
            function (
              source
            ) {

              return (
                source.enabled !== false &&
                clean(
                  source.region
                ) ===
                  region.name
              );
            }
          )
          .sort(
            function (
              a,
              b
            ) {

              const priorityDiff =
                Number(
                  a.priority || 999
                ) -
                Number(
                  b.priority || 999
                );


              if (
                priorityDiff !== 0
              ) {

                return priorityDiff;
              }


              return (
                sourceTypeRank(
                  a.sourceType
                ) -
                sourceTypeRank(
                  b.sourceType
                )
              );
            }
          );


      return {

        id:
          region.id,

        name:
          region.name,

        fullName:
          region.fullName,

        sources:
          sources
      };
    }
  );
}


/* =========================================================
   NATIONAL SOURCES
========================================================= */

function getNationalSources() {

  return loadSourceTargets()
    .filter(
      function (
        source
      ) {

        return (
          source.enabled !== false &&
          clean(
            source.region
          ) === "전국"
        );
      }
    )
    .sort(
      function (
        a,
        b
      ) {

        return (
          Number(
            a.priority || 999
          ) -
          Number(
            b.priority || 999
          )
        );
      }
    );
}


/* =========================================================
   VALIDATION
========================================================= */

function validateRegionalSources() {

  const registry =
    getRegionalSources();


  const missing =
    registry.filter(
      function (
        region
      ) {

        return (
          region.sources.length === 0
        );
      }
    );


  return {

    totalRegions:
      registry.length,

    readyRegions:
      registry.length -
      missing.length,

    missingRegions:
      missing.map(
        function (
          region
        ) {

          return region.name;
        }
      ),

    registry:
      registry,

    nationalSources:
      getNationalSources()
  };
}


/* =========================================================
   PRINT
========================================================= */

function printSummary(
  result
) {

  console.log(
    ""
  );

  console.log(
    "===================================="
  );

  console.log(
    "AXOO ART COMMISSION SOURCE REGISTRY"
  );

  console.log(
    "===================================="
  );


  result.registry.forEach(
    function (
      region
    ) {

      console.log(
        (
          region.sources.length
            ? "✅ "
            : "❌ "
        ) +
        region.name +
        " | sources=" +
        region.sources.length
      );


      region.sources.forEach(
        function (
          source
        ) {

          console.log(
            "   - " +
            source.sourceName +
            " | " +
            source.sourceType +
            " | priority=" +
            source.priority
          );
        }
      );
    }
  );


  console.log(
    "------------------------------------"
  );

  console.log(
    "지역:",
    result.readyRegions +
      "/" +
      result.totalRegions
  );


  console.log(
    "전국 공통 소스:",
    result.nationalSources.length
  );


  if (
    result.missingRegions.length
  ) {

    console.log(
      "누락 지역:",
      result.missingRegions.join(
        ", "
      )
    );

  } else {

    console.log(
      "✅ 17개 시도 Source Registry 준비 완료"
    );
  }


  console.log(
    "===================================="
  );
}


/* =========================================================
   RUN
========================================================= */

if (
  require.main === module
) {

  try {

    const result =
      validateRegionalSources();


    printSummary(
      result
    );


    if (
      result.missingRegions.length
    ) {

      process.exitCode =
        1;
    }


  } catch (
    error
  ) {

    console.error(
      "[AXOO SOURCE REGISTRY]",
      error
    );


    process.exitCode =
      1;
  }
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {

  loadSourceTargets,

  getRegionalSources,

  getNationalSources,

  validateRegionalSources
};
