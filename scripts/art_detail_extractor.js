/**
 * ============================================================
 * AXOO B2G
 * ART COMMISSION DETAIL EXTRACTOR
 * ============================================================
 *
 * 건축물 미술작품 공모 상세페이지에서
 * Project Control에 필요한 핵심 데이터를 추출한다.
 *
 * 우선 추출 필드
 * ------------------------------------------------------------
 * 1. deadline       접수/제출/신청 마감일
 * 2. publishedDate  공고일/게시일/등록일
 * 3. agency         공고/주관/시행 기관
 * 4. amount         작품비/사업비/예정금액
 * 5. location       설치장소/사업위치/소재지
 * 6. eligibility    참가/응모/신청 자격
 *
 * 설계 원칙
 * ------------------------------------------------------------
 * - 날짜가 보인다고 무조건 마감일로 사용하지 않는다.
 * - 라벨/문맥이 있는 값만 우선 채택한다.
 * - 날짜 범위는 마지막 날짜를 deadline으로 본다.
 * - 종료일의 연도/월이 생략되면 시작일 기준으로 상속한다.
 * - 추출 근거(raw/evidence)를 함께 보존한다.
 * - 확신할 수 없는 값은 빈 문자열로 둔다.
 * - 네트워크 요청은 하지 않는다.
 * ============================================================
 */


/* ============================================================
   LABEL DEFINITIONS
============================================================ */

const DEADLINE_LABELS = [
  "접수마감",
  "접수 마감",

  "접수일시",
  "접수 일시",

  "접수기간",
  "접수 기간",

  "제출마감",
  "제출 마감",

  "제출일시",
  "제출 일시",

  "제출기간",
  "제출 기간",

  "신청마감",
  "신청 마감",

  "신청일시",
  "신청 일시",

  "신청기간",
  "신청 기간",

  "응모마감",
  "응모 마감",

  "응모일시",
  "응모 일시",

  "응모기간",
  "응모 기간",

  "공모기간",
  "공모 기간",

  "마감일",
  "마감 일자",
  "마감"
];


const PUBLISHED_DATE_LABELS = [
  "공고일",
  "공고 일자",
  "게시일",
  "게시 일자",
  "등록일",
  "등록 일자",
  "작성일",
  "작성 일자"
];


const AGENCY_LABELS = [
  "공고기관",
  "공고 기관",
  "주관기관",
  "주관 기관",
  "시행기관",
  "시행 기관",
  "발주기관",
  "발주 기관",
  "주최기관",
  "주최 기관",
  "사업시행자",
  "사업 시행자"
];


const AMOUNT_LABELS = [
  "미술작품비",
  "미술 작품비",
  "작품비",
  "작품 제작비",
  "작품제작비",
  "제작설치비",
  "제작 설치비",
  "사업비",
  "총사업비",
  "총 사업비",
  "예정금액",
  "예정 금액",
  "추정금액",
  "추정 금액",
  "설치비"
];


const LOCATION_LABELS = [
  "설치장소",
  "설치 장소",
  "설치위치",
  "설치 위치",
  "사업위치",
  "사업 위치",
  "사업대상지",
  "사업 대상지",
  "대상지",
  "소재지",
  "위치"
];


const ELIGIBILITY_LABELS = [
  "참가자격",
  "참가 자격",
  "응모자격",
  "응모 자격",
  "신청자격",
  "신청 자격",
  "지원자격",
  "지원 자격"
];


/* ============================================================
   HTML ENTITY
============================================================ */

function decodeHtmlEntities(
  value
) {

  return String(
    value || ""
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

        const number =
          Number(
            code
          );


        if (
          !Number.isFinite(
            number
          )
        ) {

          return "";
        }


        return String.fromCharCode(
          number
        );
      }
    );
}


/* ============================================================
   TEXT NORMALIZE
============================================================ */

function normalizeInlineText(
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
      /\s+/g,
      " "
    )

    .trim();
}


/*
  HTML을 단순 한 줄 텍스트로 만들지 않고
  테이블/문단/리스트 등의 경계를 줄바꿈으로 보존한다.
*/
function htmlToLines(
  html
) {

  let value =
    String(
      html || ""
    );


  value =
    value

      .replace(
        /<script[\s\S]*?<\/script>/gi,
        " "
      )

      .replace(
        /<style[\s\S]*?<\/style>/gi,
        " "
      )

      .replace(
        /<!--[\s\S]*?-->/g,
        " "
      );


  value =
    value.replace(
      /<(br|\/p|\/div|\/li|\/tr|\/td|\/th|\/dt|\/dd|\/h[1-6]|\/section|\/article)>/gi,
      "\n"
    );


  value =
    value.replace(
      /<(p|div|li|tr|td|th|dt|dd|h[1-6]|section|article)\b[^>]*>/gi,
      "\n"
    );


  value =
    value.replace(
      /<[^>]+>/g,
      " "
    );


  value =
    decodeHtmlEntities(
      value
    );


  return value

    .split(
      /\r?\n/
    )

    .map(
      function (
        line
      ) {

        return normalizeInlineText(
          line
        );
      }
    )

    .filter(
      Boolean
    );
}


function htmlToText(
  html
) {

  return htmlToLines(
    html
  ).join(
    "\n"
  );
}


/* ============================================================
   DATE PARSING
============================================================ */

function pad2(
  value
) {

  return String(
    value
  ).padStart(
    2,
    "0"
  );
}


function isValidDateParts(
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
    !Number.isInteger(y) ||
    !Number.isInteger(m) ||
    !Number.isInteger(d)
  ) {

    return false;
  }


  if (
    y < 2000 ||
    y > 2100 ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31
  ) {

    return false;
  }


  const date =
    new Date(
      Date.UTC(
        y,
        m - 1,
        d
      )
    );


  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() ===
      m - 1 &&
    date.getUTCDate() === d
  );
}


function formatDate(
  year,
  month,
  day
) {

  if (
    !isValidDateParts(
      year,
      month,
      day
    )
  ) {

    return "";
  }


  return (
    String(
      year
    ) +
    "-" +
    pad2(
      month
    ) +
    "-" +
    pad2(
      day
    )
  );
}


/*
  완전한 날짜 지원 형식

  2026.09.15
  2026-09-15
  2026/09/15

  2026년 9월 15일
  2026 년 9 월 15 일
*/
function extractDates(
  value
) {

  const text =
    normalizeInlineText(
      value
    );


  const found =
    [];


  const seen =
    new Set();


  const patterns = [

    /((20\d{2}))\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/g,

    /((20\d{2}))\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?/g

  ];


  patterns.forEach(
    function (
      regex
    ) {

      let match;


      while (
        (
          match =
            regex.exec(
              text
            )
        ) !== null
      ) {

        const date =
          formatDate(
            match[2],
            match[3],
            match[4]
          );


        if (
          !date ||
          seen.has(
            date
          )
        ) {

          continue;
        }


        seen.add(
          date
        );


        found.push({

          date:
            date,

          raw:
            match[0],

          index:
            match.index
        });
      }
    }
  );


  return found.sort(
    function (
      a,
      b
    ) {

      return (
        a.index -
        b.index
      );
    }
  );
}


/* ============================================================
   DATE RANGE
============================================================ */

/*
  실제 공공기관 공고에서 자주 사용되는 형태:

  2026 년 8 월 10 일 ~ 8 월 29 일
  2026년 8월 10일 ~ 8월 29일
  2026.08.10 ~ 08.29
  2026-08-10 ~ 08-29

  시작일에는 연도가 있고
  종료일에는 연도가 생략된 경우를 처리한다.
*/
function extractInheritedRangeEndDate(
  value
) {

  const text =
    normalizeInlineText(
      value
    );


  if (!text) {

    return null;
  }


  /*
    한국어 날짜

    2026 년 8 월 10 일 ~ 8 월 29 일
  */
  const koreanRange =
    text.match(
      /(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?\s*(?:~|～|−|-|부터|에서)\s*(?:(20\d{2})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일?/
    );


  if (
    koreanRange
  ) {

    const startYear =
      Number(
        koreanRange[1]
      );


    const endYear =
      koreanRange[4]
        ? Number(
            koreanRange[4]
          )
        : startYear;


    const endMonth =
      Number(
        koreanRange[5]
      );


    const endDay =
      Number(
        koreanRange[6]
      );


    const date =
      formatDate(
        endYear,
        endMonth,
        endDay
      );


    if (
      date
    ) {

      return {

        date:
          date,

        raw:
          koreanRange[0],

        source:
          "inherited_korean_range"
      };
    }
  }


  /*
    숫자형 날짜

    2026.08.10 ~ 08.29
    2026-08-10 ~ 08-29
    2026/08/10 ~ 08/29
  */
  const numericRange =
    text.match(
      /(20\d{2})\s*([.\-/])\s*(\d{1,2})\s*\2\s*(\d{1,2})\s*(?:~|～|−|-)\s*(?:(20\d{2})\s*([.\-/])\s*)?(\d{1,2})\s*[.\-/]\s*(\d{1,2})/
    );


  if (
    numericRange
  ) {

    const startYear =
      Number(
        numericRange[1]
      );


    const endYear =
      numericRange[5]
        ? Number(
            numericRange[5]
          )
        : startYear;


    const endMonth =
      Number(
        numericRange[7]
      );


    const endDay =
      Number(
        numericRange[8]
      );


    const date =
      formatDate(
        endYear,
        endMonth,
        endDay
      );


    if (
      date
    ) {

      return {

        date:
          date,

        raw:
          numericRange[0],

        source:
          "inherited_numeric_range"
      };
    }
  }


  /*
    종료일에서 월까지 생략된 형태

    2026년 8월 10일 ~ 29일
  */
  const koreanDayOnly =
    text.match(
      /(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?\s*(?:~|～|−|-|부터|에서)\s*(\d{1,2})\s*일/
    );


  if (
    koreanDayOnly
  ) {

    const date =
      formatDate(
        Number(
          koreanDayOnly[1]
        ),
        Number(
          koreanDayOnly[2]
        ),
        Number(
          koreanDayOnly[4]
        )
      );


    if (
      date
    ) {

      return {

        date:
          date,

        raw:
          koreanDayOnly[0],

        source:
          "inherited_korean_day_only"
      };
    }
  }


  return null;
}


/* ============================================================
   LABEL MATCH
============================================================ */

function normalizeLabelCompare(
  value
) {

  return String(
    value || ""
  )
    .replace(
      /\s+/g,
      ""
    )
    .replace(
      /[:：]/g,
      ""
    )
    .trim();
}


function lineContainsLabel(
  line,
  label
) {

  return normalizeLabelCompare(
    line
  ).includes(
    normalizeLabelCompare(
      label
    )
  );
}


/*
  라벨이 들어 있는 줄을 찾고,
  다음 줄까지 Evidence로 함께 사용한다.
*/
function findLabelEvidence(
  lines,
  labels,
  options
) {

  const config =
    options ||
    {};


  const nextLineCount =
    Number.isInteger(
      config.nextLineCount
    )
      ? config.nextLineCount
      : 2;


  const result =
    [];


  lines.forEach(
    function (
      line,
      index
    ) {

      const matchedLabel =
        labels.find(
          function (
            label
          ) {

            return lineContainsLabel(
              line,
              label
            );
          }
        );


      if (
        !matchedLabel
      ) {

        return;
      }


      const evidenceLines = [
        line
      ];


      for (
        let offset = 1;
        offset <=
          nextLineCount;
        offset++
      ) {

        if (
          lines[
            index +
            offset
          ]
        ) {

          evidenceLines.push(
            lines[
              index +
              offset
            ]
          );
        }
      }


      result.push({

        label:
          matchedLabel,

        line:
          line,

        lineIndex:
          index,

        evidence:
          evidenceLines.join(
            " "
          )
      });
    }
  );


  return result;
}


/* ============================================================
   DEADLINE
============================================================ */

function extractDeadline(
  lines
) {

  const evidence =
    findLabelEvidence(
      lines,
      DEADLINE_LABELS,
      {
        nextLineCount:
          2
      }
    );


  for (
    const item of
    evidence
  ) {

    /*
      1순위:
      종료일에서 연도/월이 생략된 기간 표현을 먼저 처리한다.
    */
    const inheritedRangeEnd =
      extractInheritedRangeEndDate(
        item.evidence
      );


    if (
      inheritedRangeEnd
    ) {

      return {

        value:
          inheritedRangeEnd.date,

        raw:
          inheritedRangeEnd.raw,

        label:
          item.label,

        evidence:
          item.evidence,

        confidence:
          "high",

        dateSource:
          inheritedRangeEnd.source
      };
    }


    /*
      2순위:
      완전한 날짜가 1개 이상 존재할 경우
      마지막 날짜를 마감일로 사용한다.
    */
    const dates =
      extractDates(
        item.evidence
      );


    if (
      dates.length ===
      0
    ) {

      continue;
    }


    const selected =
      dates[
        dates.length -
        1
      ];


    return {

      value:
        selected.date,

      raw:
        selected.raw,

      label:
        item.label,

      evidence:
        item.evidence,

      confidence:
        "high",

      dateSource:
        dates.length >
          1
          ? "full_date_range"
          : "full_date"
    };
  }


  return emptyExtraction();
}


/* ============================================================
   PUBLISHED DATE
============================================================ */

function extractPublishedDate(
  lines
) {

  const evidence =
    findLabelEvidence(
      lines,
      PUBLISHED_DATE_LABELS,
      {
        nextLineCount:
          1
      }
    );


  for (
    const item of
    evidence
  ) {

    const dates =
      extractDates(
        item.evidence
      );


    if (
      dates.length ===
      0
    ) {

      continue;
    }


    const selected =
      dates[0];


    return {

      value:
        selected.date,

      raw:
        selected.raw,

      label:
        item.label,

      evidence:
        item.evidence,

      confidence:
        "high"
    };
  }


  return emptyExtraction();
}


/* ============================================================
   LABELED TEXT VALUE
============================================================ */

function stripLeadingLabel(
  value,
  label
) {

  let result =
    normalizeInlineText(
      value
    );


  const escaped =
    String(
      label
    )
      .replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )
      .replace(
        /\s+/g,
        "\\s*"
      );


  const regex =
    new RegExp(
      "^\\s*" +
      escaped +
      "\\s*[:：]?\\s*",
      "i"
    );


  result =
    result.replace(
      regex,
      ""
    );


  return result.trim();
}


/*
  같은 줄에 값이 있으면 그 값을 우선 사용.
  라벨만 있는 줄이면 다음 줄 사용.
*/
function extractLabeledText(
  lines,
  labels,
  options
) {

  const config =
    options ||
    {};


  const maxLength =
    Number.isInteger(
      config.maxLength
    )
      ? config.maxLength
      : 300;


  for (
    let index = 0;
    index <
      lines.length;
    index++
  ) {

    const line =
      lines[index];


    const matchedLabel =
      labels.find(
        function (
          label
        ) {

          return lineContainsLabel(
            line,
            label
          );
        }
      );


    if (
      !matchedLabel
    ) {

      continue;
    }


    let value =
      stripLeadingLabel(
        line,
        matchedLabel
      );


    if (
      !value ||
      value === line
    ) {

      const colonIndex =
        line.search(
          /[:：]/
        );


      if (
        colonIndex >=
        0
      ) {

        value =
          normalizeInlineText(
            line.slice(
              colonIndex +
              1
            )
          );
      }
    }


    if (
      !value &&
      lines[
        index +
        1
      ]
    ) {

      value =
        normalizeInlineText(
          lines[
            index +
            1
          ]
        );
    }


    if (
      !value
    ) {

      continue;
    }


    if (
      value.length >
      maxLength
    ) {

      value =
        value.slice(
          0,
          maxLength
        ).trim();
    }


    return {

      value:
        value,

      raw:
        value,

      label:
        matchedLabel,

      evidence:
        line +
        (
          lines[
            index +
            1
          ]
            ? " " +
              lines[
                index +
                1
              ]
            : ""
        ),

      confidence:
        "high"
    };
  }


  return emptyExtraction();
}


/* ============================================================
   MONEY
============================================================ */

function normalizeNumberString(
  value
) {

  return String(
    value || ""
  ).replace(
    /,/g,
    ""
  );
}


function parseKoreanMoney(
  value
) {

  const text =
    normalizeInlineText(
      value
    );


  if (
    !text
  ) {

    return null;
  }


  /*
    1억 5,000만원
    2억
    3,500만원
    50만원
  */
  const eokMatch =
    text.match(
      /(\d+(?:\.\d+)?)\s*억(?:\s*(\d[\d,]*(?:\.\d+)?)\s*만)?\s*원?/
    );


  if (
    eokMatch
  ) {

    const eok =
      Number(
        normalizeNumberString(
          eokMatch[1]
        )
      );


    const man =
      eokMatch[2]
        ? Number(
            normalizeNumberString(
              eokMatch[2]
            )
          )
        : 0;


    if (
      Number.isFinite(
        eok
      ) &&
      Number.isFinite(
        man
      )
    ) {

      return Math.round(
        eok *
          100000000 +
        man *
          10000
      );
    }
  }


  const manMatch =
    text.match(
      /(\d[\d,]*(?:\.\d+)?)\s*만\s*원/
    );


  if (
    manMatch
  ) {

    const man =
      Number(
        normalizeNumberString(
          manMatch[1]
        )
      );


    if (
      Number.isFinite(
        man
      )
    ) {

      return Math.round(
        man *
        10000
      );
    }
  }


  const wonMatch =
    text.match(
      /(\d[\d,]*)\s*원/
    );


  if (
    wonMatch
  ) {

    const won =
      Number(
        normalizeNumberString(
          wonMatch[1]
        )
      );


    if (
      Number.isFinite(
        won
      )
    ) {

      return Math.round(
        won
      );
    }
  }


  return null;
}


function extractAmount(
  lines
) {

  const evidence =
    findLabelEvidence(
      lines,
      AMOUNT_LABELS,
      {
        nextLineCount:
          2
      }
    );


  for (
    const item of
    evidence
  ) {

    const amount =
      parseKoreanMoney(
        item.evidence
      );


    if (
      amount === null
    ) {

      continue;
    }


    return {

      value:
        String(
          amount
        ),

      numericValue:
        amount,

      raw:
        item.evidence,

      label:
        item.label,

      evidence:
        item.evidence,

      confidence:
        "high"
    };
  }


  return {
    ...emptyExtraction(),
    numericValue:
      null
  };
}


/* ============================================================
   EMPTY RESULT
============================================================ */

function emptyExtraction() {

  return {

    value:
      "",

    raw:
      "",

    label:
      "",

    evidence:
      "",

    confidence:
      "none"
  };
}


/* ============================================================
   MAIN EXTRACTION
============================================================ */

function extractArtDetail(
  html,
  options
) {

  const config =
    options ||
    {};


  const lines =
    htmlToLines(
      html
    );


  const deadline =
    extractDeadline(
      lines
    );


  const publishedDate =
    extractPublishedDate(
      lines
    );


  const agency =
    extractLabeledText(
      lines,
      AGENCY_LABELS,
      {
        maxLength:
          180
      }
    );


  const amount =
    extractAmount(
      lines
    );


  const location =
    extractLabeledText(
      lines,
      LOCATION_LABELS,
      {
        maxLength:
          300
      }
    );


  const eligibility =
    extractLabeledText(
      lines,
      ELIGIBILITY_LABELS,
      {
        maxLength:
          500
      }
    );


  const extractedCount = [

    deadline.value,

    publishedDate.value,

    agency.value,

    amount.value,

    location.value,

    eligibility.value

  ].filter(
    Boolean
  ).length;


  return {

    deadline:
      deadline.value,

    endDate:
      deadline.value,

    publishedDate:
      publishedDate.value,

    postedDate:
      publishedDate.value,

    agency:
      agency.value,

    organization:
      agency.value,

    amount:
      amount.value,

    amountNumeric:
      amount.numericValue,

    budget:
      amount.value,

    location:
      location.value,

    installationLocation:
      location.value,

    eligibility:
      eligibility.value,


    detailExtractionStatus:
      extractedCount >
        0
        ? "extracted"
        : "empty",

    detailExtractionCount:
      extractedCount,

    detailExtractionVersion:
      "art-detail-1.1.0",


    extraction: {

      deadline:
        deadline,

      publishedDate:
        publishedDate,

      agency:
        agency,

      amount:
        amount,

      location:
        location,

      eligibility:
        eligibility
    },


    diagnostics: {

      lineCount:
        lines.length,

      sourceUrl:
        String(
          config.sourceUrl ||
          ""
        ),

      title:
        String(
          config.title ||
          ""
        )
    }
  };
}


/* ============================================================
   ITEM MERGE HELPER
============================================================ */

function mergeArtDetailIntoItem(
  item,
  detail
) {

  const previous =
    item ||
    {};


  const extracted =
    detail ||
    {};


  return {

    ...previous,

    deadline:
      extracted.deadline ||
      previous.deadline ||
      "",

    endDate:
      extracted.endDate ||
      previous.endDate ||
      "",

    publishedDate:
      extracted.publishedDate ||
      previous.publishedDate ||
      "",

    postedDate:
      extracted.postedDate ||
      previous.postedDate ||
      "",

    agency:
      extracted.agency ||
      previous.agency ||
      "",

    organization:
      extracted.organization ||
      previous.organization ||
      "",

    amount:
      extracted.amount ||
      previous.amount ||
      "",

    amountNumeric:
      extracted.amountNumeric !==
        null &&
      extracted.amountNumeric !==
        undefined
        ? extracted.amountNumeric
        : (
            previous.amountNumeric !==
              undefined
              ? previous.amountNumeric
              : null
          ),

    budget:
      extracted.budget ||
      previous.budget ||
      "",

    location:
      extracted.location ||
      previous.location ||
      "",

    installationLocation:
      extracted.installationLocation ||
      previous.installationLocation ||
      "",

    eligibility:
      extracted.eligibility ||
      previous.eligibility ||
      "",

    detailExtractionStatus:
      extracted.detailExtractionStatus ||
      previous.detailExtractionStatus ||
      "",

    detailExtractionCount:
      extracted.detailExtractionCount !==
        undefined
        ? extracted.detailExtractionCount
        : (
            previous.detailExtractionCount ||
            0
          ),

    detailExtractionVersion:
      extracted.detailExtractionVersion ||
      previous.detailExtractionVersion ||
      "",

    detailExtractionEvidence:
      extracted.extraction ||
      previous.detailExtractionEvidence ||
      {}
  };
}


/* ============================================================
   SELF TEST
============================================================ */

function runSelfTest() {

  const fixture = `
    <!doctype html>

    <html lang="ko">

    <body>

      <h1>
        2026-03 대전광역시 건축물 미술작품 제작·설치 공모
      </h1>

      <table>

        <tr>
          <th>공고일</th>
          <td>2026. 09. 01.</td>
        </tr>

        <tr>
          <th>공고기관</th>
          <td>대전광역시</td>
        </tr>

        <tr>
          <th>접수기간</th>
          <td>
            2026. 09. 10. ~ 2026. 09. 25.
          </td>
        </tr>

        <tr>
          <th>작품 제작비</th>
          <td>
            1억 5,000만원
          </td>
        </tr>

        <tr>
          <th>설치장소</th>
          <td>
            대전광역시 유성구 장대동 501
          </td>
        </tr>

        <tr>
          <th>참가자격</th>
          <td>
            공고일 현재 관련 법령에 따른 자격을 갖춘 작가
          </td>
        </tr>

      </table>

    </body>

    </html>
  `;


  /*
    실제 경기도 공공미술 페이지에서 확인된 표현 구조를
    네트워크 없이 재현한다.

    접수일시 :
    2026 년 8 월 10 일 ~ 8 월 29 일
  */
  const liveLikeFixture = `
    <!doctype html>

    <html lang="ko">

    <body>

      <h1>
        남양주왕숙2A-1 신축공사 內 미술작품 제작 및 설치 공모 공고
      </h1>

      <p>
        등록일 2026-08-10
      </p>

      <p>
        접수일시 : 2026 년 8 월 10 일 ~ 8 월 29 일
      </p>

    </body>

    </html>
  `;


  const result =
    extractArtDetail(
      fixture,
      {
        sourceUrl:
          "https://example.com/detail/1",

        title:
          "2026-03 대전광역시 건축물 미술작품 제작·설치 공모"
      }
    );


  const liveLikeResult =
    extractArtDetail(
      liveLikeFixture,
      {
        sourceUrl:
          "https://example.com/detail/live-like",

        title:
          "남양주왕숙2A-1 신축공사 內 미술작품 제작 및 설치 공모 공고"
      }
    );


  const tests = [

    [
      "deadline",
      result.deadline,
      "2026-09-25"
    ],

    [
      "publishedDate",
      result.publishedDate,
      "2026-09-01"
    ],

    [
      "agency",
      result.agency,
      "대전광역시"
    ],

    [
      "amountNumeric",
      result.amountNumeric,
      150000000
    ],

    [
      "location",
      result.location,
      "대전광역시 유성구 장대동 501"
    ],

    [
      "eligibility",
      result.eligibility,
      "공고일 현재 관련 법령에 따른 자격을 갖춘 작가"
    ],

    [
      "live-like 접수일시 연도 생략 종료일",
      liveLikeResult.deadline,
      "2026-08-29"
    ]

  ];


  let pass =
    0;


  let fail =
    0;


  console.log(
    ""
  );


  console.log(
    "===================================="
  );


  console.log(
    "AXOO ART DETAIL EXTRACTOR SELF TEST"
  );


  console.log(
    "===================================="
  );


  tests.forEach(
    function (
      test
    ) {

      const name =
        test[0];

      const actual =
        test[1];

      const expected =
        test[2];


      if (
        actual ===
        expected
      ) {

        pass++;


        console.log(
          "✅ PASS |",
          name,
          "|",
          actual
        );


      } else {

        fail++;


        console.log(
          "❌ FAIL |",
          name
        );


        console.log(
          "   expected:",
          expected
        );


        console.log(
          "   actual:",
          actual
        );
      }
    }
  );


  console.log(
    ""
  );


  console.log(
    "PASS:",
    pass
  );


  console.log(
    "FAIL:",
    fail
  );


  console.log(
    "TOTAL:",
    pass +
    fail
  );


  if (
    fail >
    0
  ) {

    process.exitCode =
      1;


    console.log(
      "❌ ART DETAIL EXTRACTOR SELF TEST FAILED"
    );


    return;
  }


  console.log(
    "✅ ART DETAIL EXTRACTOR SELF TEST PASSED"
  );
}


/* ============================================================
   START
============================================================ */

if (
  require.main ===
  module
) {

  runSelfTest();
}


/* ============================================================
   EXPORT
============================================================ */

module.exports = {

  DEADLINE_LABELS,

  PUBLISHED_DATE_LABELS,

  AGENCY_LABELS,

  AMOUNT_LABELS,

  LOCATION_LABELS,

  ELIGIBILITY_LABELS,

  decodeHtmlEntities,

  normalizeInlineText,

  htmlToLines,

  htmlToText,

  extractDates,

  extractInheritedRangeEndDate,

  findLabelEvidence,

  extractDeadline,

  extractPublishedDate,

  extractLabeledText,

  parseKoreanMoney,

  extractAmount,

  extractArtDetail,

  mergeArtDetailIntoItem

};
