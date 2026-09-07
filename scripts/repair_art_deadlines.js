const fs = require("fs");
const path = require("path");


/* =========================================================
   AXOO B2G · MISSING ART DEADLINE REPAIR
   v1.0.0

   목적:
   - 원문에 접수/제출 마감일이 명확히 있는데
     기존 정규화기가 놓친 건축물 미술작품 공고를 보완한다.
   - 기존에 정상 마감일이 있는 레코드는 절대 덮어쓰지 않는다.
   - detailTextSample 안의 "접수/제출" 문맥 가까이에 있는
     날짜만 사용한다.

   대표 대응:
   "■ 작품접수
    - 일자 : 2026. 10. 02.(금) 14:00 까지(시간엄수)"
   → 2026-10-02
========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const VERSION =
  "axoo_art_deadline_repair_v1.0.0";


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


const CONTEXT_LENGTH =
  360;


const DEADLINE_MARKERS = [

  {
    label:
      "응모작품 접수일시",
    regex:
      /응모\s*작품\s*접수\s*일시/gi
  },

  {
    label:
      "작품 접수일시",
    regex:
      /작품\s*접수\s*일시/gi
  },

  {
    label:
      "작품 접수",
    regex:
      /작품\s*접수/gi
  },

  {
    label:
      "응모 접수",
    regex:
      /응모\s*접수/gi
  },

  {
    label:
      "접수 일시",
    regex:
      /접수\s*일시/gi
  },

  {
    label:
      "접수 일자",
    regex:
      /접수\s*일자/gi
  },

  {
    label:
      "접수 기간",
    regex:
      /접수\s*기간/gi
  },

  {
    label:
      "접수 마감",
    regex:
      /접수\s*마감/gi
  },

  {
    label:
      "작품 제출",
    regex:
      /작품\s*제출/gi
  },

  {
    label:
      "제출 일시",
    regex:
      /제출\s*일시/gi
  },

  {
    label:
      "제출 일자",
    regex:
      /제출\s*일자/gi
  },

  {
    label:
      "제출 기간",
    regex:
      /제출\s*기간/gi
  },

  {
    label:
      "제출 마감",
    regex:
      /제출\s*마감/gi
  },

  {
    label:
      "제출 기한",
    regex:
      /제출\s*기한/gi
  },

  {
    label:
      "신청 마감",
    regex:
      /신청\s*마감/gi
  },

  {
    label:
      "응모 마감",
    regex:
      /응모\s*마감/gi
  },

  {
    label:
      "마감일",
    regex:
      /마감\s*일/gi
  },

  {
    label:
      "마감기한",
    regex:
      /마감\s*기한/gi
  }
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

function decodeHtmlEntities(
  value
) {

  return String(
    value == null
      ? ""
      : value
  )
    .replace(
      /&nbsp;/gi,
      " "
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
      /&#(\d+);/g,
      function (
        _,
        code
      ) {

        return String.fromCharCode(
          Number(
            code
          )
        );
      }
    );
}


function cleanText(
  value
) {

  return decodeHtmlEntities(
    value
  )
    .replace(
      /\u00a0/g,
      " "
    )
    .replace(
      /[\t\r\n]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


/* =========================================================
   DATE
========================================================= */

function todayKst() {

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Seoul",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit"
      }
    )
      .formatToParts(
        new Date()
      );


  const map =
    {};


  parts.forEach(
    function (
      part
    ) {

      if (
        part.type !==
        "literal"
      ) {

        map[
          part.type
        ] =
          part.value;
      }
    }
  );


  return [
    map.year,
    map.month,
    map.day
  ].join(
    "-"
  );
}


function currentKstYear() {

  return Number(
    todayKst()
      .slice(
        0,
        4
      )
  );
}


function yearFromValue(
  value
) {

  const match =
    String(
      value || ""
    )
      .match(
        /(20\d{2})/
      );


  return match
    ? Number(
        match[1]
      )
    : currentKstYear();
}


function resolveYear(
  token,
  baseYear
) {

  const raw =
    String(
      token || ""
    ).trim();


  if (!raw) {

    return Number(
      baseYear ||
      currentKstYear()
    );
  }


  if (
    /^\d{4}$/.test(
      raw
    )
  ) {

    const year =
      Number(
        raw
      );


    return (
      year >= 2000 &&
      year <= 2100
    )
      ? year
      : null;
  }


  if (
    /^\d{2}$/.test(
      raw
    )
  ) {

    const base =
      Number(
        baseYear ||
        currentKstYear()
      );


    const century =
      Math.floor(
        base / 100
      ) * 100;


    let year =
      century +
      Number(
        raw
      );


    if (
      year - base >
      50
    ) {

      year -=
        100;
    }


    if (
      base - year >
      50
    ) {

      year +=
        100;
    }


    return (
      year >= 2000 &&
      year <= 2100
    )
      ? year
      : null;
  }


  return null;
}


function toIso(
  year,
  month,
  day
) {

  const y =
    Number(
      year
    );


  const m =
    Number(
      month
    );


  const d =
    Number(
      day
    );


  if (
    !Number.isFinite(
      y
    ) ||
    !Number.isFinite(
      m
    ) ||
    !Number.isFinite(
      d
    ) ||
    y < 2000 ||
    y > 2100 ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31
  ) {

    return "";
  }


  const date =
    new Date(
      Date.UTC(
        y,
        m - 1,
        d
      )
    );


  if (
    date.getUTCFullYear() !==
      y ||
    date.getUTCMonth() !==
      m - 1 ||
    date.getUTCDate() !==
      d
  ) {

    return "";
  }


  return [
    String(
      y
    ).padStart(
      4,
      "0"
    ),

    String(
      m
    ).padStart(
      2,
      "0"
    ),

    String(
      d
    ).padStart(
      2,
      "0"
    )
  ].join(
    "-"
  );
}


function findDateMatches(
  value,
  baseYear
) {

  const text =
    cleanText(
      value
    );


  const regex =
    /(?:(20\d{2}|\d{2})\s*(?:년\s*|[./-]\s*))?(\d{1,2})\s*(?:월\s*|[./-]\s*)(\d{1,2})\s*(?:일)?\.?/g;


  const matches =
    [];


  let match;


  while (
    (
      match =
        regex.exec(
          text
        )
    ) !==
    null
  ) {

    const year =
      resolveYear(
        match[1],
        baseYear
      );


    if (!year) {

      continue;
    }


    const iso =
      toIso(
        year,
        match[2],
        match[3]
      );


    if (!iso) {

      continue;
    }


    matches.push({
      value:
        iso,

      raw:
        match[0],

      start:
        match.index,

      end:
        regex.lastIndex,

      explicitYear:
        Boolean(
          match[1]
        ),

      year:
        year
    });
  }


  return matches;
}


function isRangeConnector(
  value
) {

  return (
    /[~∼～–—]|부터|에서|까지|\s-\s/
      .test(
        String(
          value || ""
        )
      )
  );
}


function chooseDateFromContext(
  context,
  baseYear
) {

  const dates =
    findDateMatches(
      context,
      baseYear
    );


  if (
    !dates.length
  ) {

    return null;
  }


  if (
    dates.length >=
    2
  ) {

    for (
      let index = 0;
      index <
        dates.length - 1;
      index += 1
    ) {

      const first =
        dates[
          index
        ];


      const second =
        dates[
          index + 1
        ];


      const between =
        context.slice(
          first.end,
          second.start
        );


      if (
        isRangeConnector(
          between
        )
      ) {

        let end =
          second.value;


        if (
          !second.explicitYear &&
          end <
            first.value
        ) {

          end =
            toIso(
              first.year + 1,
              Number(
                end.slice(
                  5,
                  7
                )
              ),
              Number(
                end.slice(
                  8,
                  10
                )
              )
            );
        }


        return {
          value:
            end,

          raw:
            second.raw,

          mode:
            "range_end"
        };
      }
    }
  }


  return {
    value:
      dates[0].value,

    raw:
      dates[0].raw,

    mode:
      "single_date"
  };
}


/* =========================================================
   DEADLINE EXTRACTION
========================================================= */

function findDeadlineCandidate(
  value,
  publishedDate
) {

  const text =
    cleanText(
      value
    );


  if (!text) {

    return null;
  }


  const baseYear =
    yearFromValue(
      publishedDate
    );


  for (
    const marker of
    DEADLINE_MARKERS
  ) {

    marker.regex.lastIndex =
      0;


    let match;


    while (
      (
        match =
          marker.regex.exec(
            text
          )
      ) !==
      null
    ) {

      const context =
        text.slice(
          match.index,
          match.index +
            CONTEXT_LENGTH
        );


      const candidate =
        chooseDateFromContext(
          context,
          baseYear
        );


      if (!candidate) {

        continue;
      }


      if (
        publishedDate &&
        candidate.value <
          publishedDate
      ) {

        continue;
      }


      return {
        value:
          candidate.value,

        raw:
          candidate.raw,

        mode:
          candidate.mode,

        marker:
          marker.label,

        context:
          context.slice(
            0,
            220
          )
      };
    }
  }


  return null;
}


/* =========================================================
   ITEM REPAIR
========================================================= */

function hasExistingDeadline(
  item
) {

  return Boolean(
    cleanText(
      item &&
      (
        item.deadline ||
        item.endDate ||
        item.closeDate
      )
    )
  );
}


function repairItem(
  item
) {

  if (
    !item ||
    typeof item !==
      "object"
  ) {

    return {
      changed:
        false,
      item:
        item,
      candidate:
        null
    };
  }


  if (
    hasExistingDeadline(
      item
    )
  ) {

    return {
      changed:
        false,
      item:
        item,
      candidate:
        null
    };
  }


  const publishedDate =
    cleanText(
      item.publishedDate ||
      item.postedDate ||
      item.noticeDate
    );


  const sources = [

    {
      source:
        "detailTextSample",
      text:
        item.detailTextSample
    },

    {
      source:
        "rawText",
      text:
        item.rawText
    },

    {
      source:
        "summary",
      text:
        item.summary
    },

    {
      source:
        "recommendedAction",
      text:
        item.recommendedAction
    }
  ];


  let candidate =
    null;


  let candidateSource =
    "";


  for (
    const source of
    sources
  ) {

    candidate =
      findDeadlineCandidate(
        source.text,
        publishedDate
      );


    if (
      candidate
    ) {

      candidateSource =
        source.source;

      break;
    }
  }


  if (!candidate) {

    return {
      changed:
        false,
      item:
        item,
      candidate:
        null
    };
  }


  const today =
    todayKst();


  const expired =
    candidate.value <
      today;


  const repaired = {
    ...item,

    deadline:
      candidate.value,

    endDate:
      candidate.value,

    deadlineSource:
      "deadline_repair_marker",

    deadlineKeyword:
      candidate.marker,

    deadlineRaw:
      candidate.raw,

    deadlineStatus:
      expired
        ? "마감"
        : "진행중",

    status:
      expired
        ? "마감"
        : "공모중",

    isExpired:
      expired,

    isStaleCandidate:
      false,

    staleReason:
      "",

    dateConfidence:
      "HIGH",

    deadlineRepairSource:
      candidateSource,

    deadlineRepairMode:
      candidate.mode,

    deadlineRepairVersion:
      VERSION,

    deadlineRepairedAt:
      today
  };


  return {
    changed:
      true,

    item:
      repaired,

    candidate:
      {
        ...candidate,
        source:
          candidateSource
      }
  };
}


/* =========================================================
   COLLECTION
========================================================= */

function repairCollection(
  items,
  label
) {

  const next =
    [];


  const repaired =
    [];


  items.forEach(
    function (
      item
    ) {

      const result =
        repairItem(
          item
        );


      next.push(
        result.item
      );


      if (
        result.changed
      ) {

        repaired.push({
          id:
            item.id || "",

          title:
            item.title || "",

          deadline:
            result.item.deadline,

          marker:
            result.candidate.marker,

          source:
            result.candidate.source,

          raw:
            result.candidate.raw
        });
      }
    }
  );


  return {
    label:
      label,

    items:
      next,

    repaired:
      repaired
  };
}


/* =========================================================
   SELF TEST
========================================================= */

function assertEqual(
  label,
  actual,
  expected
) {

  if (
    actual !==
      expected
  ) {

    throw new Error(
      label +
      " | expected=" +
      expected +
      " | actual=" +
      actual
    );
  }
}


function runSelfTest() {

  const published =
    "2026-09-07";


  const siheung =
    "시흥 대야1지구 공동주택 신축공사 미술작품 공모 공고 " +
    "구분 공모 작성자 관리자 등록일 2026-09-07 " +
    "■ 작품접수 - 일자 : 2026. 10. 02.(금) 14:00 까지(시간엄수) " +
    "- 방법 : mkb@mkbdev.co.kr";


  const siheungCandidate =
    findDeadlineCandidate(
      siheung,
      published
    );


  assertEqual(
    "시흥 공고 deadline",
    siheungCandidate &&
    siheungCandidate.value,
    "2026-10-02"
  );


  const rangeCandidate =
    findDeadlineCandidate(
      "작품 접수기간 : 2026. 09. 03. ~ 2026. 09. 25. 10:00 마감",
      "2026-09-03"
    );


  assertEqual(
    "기간형 deadline",
    rangeCandidate &&
    rangeCandidate.value,
    "2026-09-25"
  );


  const koreanCandidate =
    findDeadlineCandidate(
      "접수마감 : 2026년 9월 30일 18시",
      "2026-09-01"
    );


  assertEqual(
    "한글형 deadline",
    koreanCandidate &&
    koreanCandidate.value,
    "2026-09-30"
  );


  const noMarker =
    findDeadlineCandidate(
      "등록일 2026-09-07 작성자 관리자",
      "2026-09-07"
    );


  assertEqual(
    "등록일 단독은 미검출",
    noMarker,
    null
  );


  const existing =
    repairItem({
      title:
        "기존 마감일 보존 테스트",
      publishedDate:
        "2026-09-01",
      deadline:
        "2026-09-20",
      detailTextSample:
        "작품접수 일자 : 2026. 10. 02."
    });


  assertEqual(
    "기존 deadline 덮어쓰기 금지",
    existing.changed,
    false
  );


  console.log(
    "✅ ART DEADLINE REPAIR SELF TEST PASS"
  );

  console.log(
    "cases=5"
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
    repairCollection(
      live,
      "LIVE"
    );


  const archiveResult =
    repairCollection(
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
    "AXOO ART DEADLINE REPAIR"
  );

  console.log(
    "===================================="
  );

  console.log(
    "VERSION:",
    VERSION
  );

  console.log(
    "LIVE repaired:",
    liveResult.repaired.length
  );

  console.log(
    "ARCHIVE repaired:",
    archiveResult.repaired.length
  );


  const combined =
    new Map();


  liveResult.repaired
    .concat(
      archiveResult.repaired
    )
    .forEach(
      function (
        item
      ) {

        const key =
          (
            item.id || ""
          ) +
          "|" +
          (
            item.title || ""
          );


        if (
          !combined.has(
            key
          )
        ) {

          combined.set(
            key,
            item
          );
        }
      }
    );


  if (
    combined.size
  ) {

    console.log(
      ""
    );

    console.log(
      "보완된 마감일:"
    );


    Array.from(
      combined.values()
    ).forEach(
      function (
        item
      ) {

        console.log(
          "  ✅",
          item.title,
          "→",
          item.deadline,
          "| marker=" +
          item.marker,
          "| source=" +
          item.source
        );
      }
    );

  } else {

    console.log(
      "보완 대상 없음"
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
    liveResult.items
  );


  writeArray(
    ARCHIVE_FILE,
    archiveResult.items
  );


  console.log(
    ""
  );

  console.log(
    "✅ 누락 마감일 보완 완료"
  );
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {

  VERSION,

  DEADLINE_MARKERS,

  cleanText,

  findDateMatches,

  findDeadlineCandidate,

  repairItem,

  repairCollection,

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
      "[AXOO ART DEADLINE REPAIR]",
      error
    );

    process.exitCode =
      1;
  }
}
