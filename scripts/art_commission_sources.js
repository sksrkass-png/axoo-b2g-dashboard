const fs = require("fs");
const path = require("path");

const {
  TARGET_ART_REGIONS
} = require("./art_region_scope");


/* =========================================================
   FILES
========================================================= */

const SOURCE_FILE =
  path.join(
    process.cwd(),
    "data",
    "art_commission_source_targets.json"
  );


const OVERRIDE_FILE =
  path.join(
    process.cwd(),
    "data",
    "art_commission_source_overrides.json"
  );


/* =========================================================
   SOURCE TYPE ORDER
========================================================= */

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


function readJson(
  filePath,
  fallback
) {

  if (
    !fs.existsSync(
      filePath
    )
  ) {

    return fallback;
  }


  const raw =
    fs
      .readFileSync(
        filePath,
        "utf8"
      )
      .trim();


  if (!raw) {

    return fallback;
  }


  return JSON.parse(
    raw
  );
}


/* =========================================================
   BASE SOURCES
========================================================= */

function loadBaseSourceTargets() {

  const parsed =
    readJson(
      SOURCE_FILE,
      []
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


/* =========================================================
   OVERRIDES
========================================================= */

function loadSourceOverrides() {

  const parsed =
    readJson(
      OVERRIDE_FILE,
      {}
    );


  if (
    !parsed ||
    Array.isArray(
      parsed
    ) ||
    typeof parsed !==
      "object"
  ) {

    throw new Error(
      "art_commission_source_overrides.json 형식이 객체가 아닙니다."
    );
  }


  return parsed;
}


/* =========================================================
   APPLY OVERRIDE
========================================================= */

function applySourceOverrides(
  targets
) {

  const overrides =
    loadSourceOverrides();


  return targets.map(
    function (
      source
    ) {

      if (
        !source ||
        !source.id
      ) {

        return source;
      }


      const override =
        overrides[
          source.id
        ];


      if (
        !override
      ) {

        return source;
      }


      return {

        ...source,

        ...override,

        id:
          source.id,

        overrideApplied:
          true,

        baseSourceUrl:
          source.sourceUrl,

        sourceUrl:
          override.sourceUrl ||
          source.sourceUrl

      };
    }
  );
}


/* =========================================================
   FINAL SOURCE TARGETS
========================================================= */

function loadSourceTargets() {

  return applySourceOverrides(
    loadBaseSourceTargets()
  );
}


/* =========================================================
   SOURCE TYPE RANK
========================================================= */

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
                source &&
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
          source &&
          source.enabled !== false &&
          clean(
            source.region
          ) ===
            "전국"
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
          region.sources.length ===
          0
        );
      }
    );


  const overrides =
    loadSourceOverrides();


  const appliedOverrideSources =
    loadSourceTargets()
      .filter(
        function (
          source
        ) {

          return (
            source &&
            source.overrideApplied ===
              true
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
      getNationalSources(),

    overrideCount:
      Object.keys(
        overrides
      ).length,

    appliedOverrideCount:
      appliedOverrideSources.length,

    appliedOverrideSources:
      appliedOverrideSources
  };
}


/* =========================================================
   PRINT
========================================================= */

function printSummary(
  result
) {

  console.log("");

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

          const overrideLabel =
            source.overrideApplied
              ? " | OVERRIDE"
              : "";


          console.log(
            "   - " +
            source.sourceName +
            " | " +
            source.sourceType +
            " | priority=" +
            source.priority +
            overrideLabel
          );


          console.log(
            "     " +
            source.sourceUrl
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


  console.log(
    "등록 Override:",
    result.overrideCount
  );


  console.log(
    "적용 Override:",
    result.appliedOverrideCount
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


  if (
    result.overrideCount !==
    result.appliedOverrideCount
  ) {

    console.log(
      "⚠️ 일부 Override ID가 기존 Source Registry와 일치하지 않습니다."
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


    if (
      result.overrideCount !==
      result.appliedOverrideCount
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

  loadBaseSourceTargets,

  loadSourceOverrides,

  applySourceOverrides,

  loadSourceTargets,

  getRegionalSources,

  getNationalSources,

  validateRegionalSources

};
