const fs = require("fs");
const path = require("path");


/* =========================================================
   CONFIG
========================================================= */

const DATA_FILE = path.join(
  process.cwd(),
  "data",
  "b2g_opportunities.json"
);

const META_FILE = path.join(
  process.cwd(),
  "data",
  "dashboard_meta.json"
);

const API_URL =
  "https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServc";

const SERVICE_KEY =
  String(
    process.env.G2B_SERVICE_KEY || ""
  ).trim();

const COLLECTOR_VERSION =
  "1.0.0";

const SCORING_VERSION =
  "axoo_bid_fit_v4";

const NUM_OF_ROWS =
  999;

/*
  오늘 포함 최근 3일 공고를 다시 읽는다.

  매일 실행이 하루 빠져도
  다음 실행에서 놓친 공고를 복구하기 위함.
*/
const LOOKBACK_DAYS =
  2;

const MAX_PAGES =
  20;

const FETCH_TIMEOUT_MS =
  25000;

const MAX_FETCH_ATTEMPTS =
  3;

/*
  대시보드가 너무 무거워지지 않도록
  활성 후보 상위 80건까지만 유지.
*/
const MAX_OUTPUT_ITEMS =
  80;

const MIN_SCORE =
  40;


/* =========================================================
   AXOO KEYWORDS
========================================================= */

/*
  AXOO가 직접 실행하기 좋은 영역.
*/

const DIRECT_KEYWORDS = [

  "미디어아트",
  "미디어 아트",

  "공공미술",
  "공공 미술",

  "미술작품",
  "미술 작품",

  "아티스트",
  "작가",

  "전시기획",
  "전시 기획",

  "전시운영",
  "전시 운영",

  "전시연출",
  "전시 연출",

  "공간연출",
  "공간 연출",

  "공간디자인",
  "공간 디자인",

  "환경디자인",
  "환경 디자인",

  "시각디자인",
  "시각 디자인",

  "그래픽디자인",
  "그래픽 디자인",

  "팝업스토어",
  "팝업 스토어",
  "팝업",

  "브랜드 캠페인",

  "문화행사",
  "문화 행사",

  "축제",
  "페스티벌",

  "실감콘텐츠",
  "실감 콘텐츠",

  "인터랙티브",

  "미디어파사드",
  "미디어 파사드",

  "관광콘텐츠",
  "관광 콘텐츠",

  "체험콘텐츠",
  "체험 콘텐츠",

  "전시관",
  "홍보관",

  "콘텐츠 제작",

  "문화콘텐츠",
  "문화 콘텐츠"
];


/*
  직접 핏보다는 약하지만
  AXOO 프로젝트로 확장 가능한 키워드.
*/

const SUPPORT_KEYWORDS = [

  "전시",

  "디자인",

  "콘텐츠",

  "문화예술",
  "문화 예술",

  "예술",

  "관광",

  "홍보",

  "행사",

  "이벤트",

  "기획",

  "브랜딩",

  "공간",

  "조형물",

  "상징물",

  "포토존",

  "체험",

  "프로그램 운영",

  "홍보물",

  "영상콘텐츠",
  "영상 콘텐츠",

  "디지털콘텐츠",
  "디지털 콘텐츠",

  "AR",
  "VR",
  "XR",

  "IP",

  "굿즈",

  "기념품",

  "지역콘텐츠",
  "지역 콘텐츠",

  "도시재생",

  "지역축제",
  "지역 축제"
];


/*
  AXOO와 연결 가능성이 높은 기관 성격.
*/

const CULTURE_AGENCY_KEYWORDS = [

  "문화",
  "예술",
  "관광",
  "축제",
  "콘텐츠",
  "디자인",

  "미술관",
  "박물관",

  "문화재단",
  "관광재단",
  "문화원",

  "진흥원",
  "예술경영지원센터",

  "도시공사",
  "시설공단"
];


/*
  제목에 이 표현이 있으면 감점.

  단, DIRECT_KEYWORDS가 강하게 잡힌 경우에는
  완전 제외하지 않고 감점만 한다.
*/

const PENALTY_KEYWORDS = [

  "연구용역",
  "연구 용역",

  "학술연구",
  "학술 연구",

  "실태조사",
  "실태 조사",

  "타당성 조사",

  "시스템 구축",
  "시스템구축",

  "시스템 유지보수",
  "시스템유지보수",

  "정보시스템",
  "정보 시스템",

  "서버",
  "네트워크",

  "감리",

  "보험",

  "청소",
  "경비",

  "폐기물",

  "차량",

  "식자재",

  "시설물 유지관리",
  "시설물 유지 관리"
];


/*
  창작/전시/콘텐츠 신호가 전혀 없는데
  아래 표현만 있는 경우 강한 감점.
*/

const NON_CREATIVE_KEYWORDS = [

  "소프트웨어",
  "데이터베이스",
  "DB 구축",
  "DB구축",

  "전산",
  "보안",

  "회계",
  "법률",

  "교육훈련",
  "교육 훈련",

  "검사",
  "진단"
];


/* =========================================================
   BASIC HELPERS
========================================================= */

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
    fs.readFileSync(
      filePath,
      "utf8"
    );


  if (!raw.trim()) {

    return fallback;
  }


  return JSON.parse(
    raw
  );
}


function writeJson(
  filePath,
  data
) {

  fs.writeFileSync(
    filePath,

    JSON.stringify(
      data,
      null,
      2
    ) + "\n",

    "utf8"
  );
}


function text(
  value
) {

  return String(
    value || ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function unique(
  values
) {

  return [
    ...new Set(
      values.filter(
        Boolean
      )
    )
  ];
}


function numeric(
  value
) {

  const number =
    Number(
      String(
        value || ""
      )
        .replace(
          /,/g,
          ""
        )
    );


  return Number.isFinite(
    number
  )
    ? number
    : 0;
}


/* =========================================================
   KOREA DATE
========================================================= */

function getKoreaDateParts(
  date = new Date()
) {

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
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hourCycle:
          "h23"
      }
    )
      .formatToParts(
        date
      );


  const map = {};


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


  return map;
}


function koreaDateString(
  date = new Date()
) {

  const p =
    getKoreaDateParts(
      date
    );


  return (
    p.year +
    "-" +
    p.month +
    "-" +
    p.day
  );
}


function koreaTimestamp(
  date = new Date()
) {

  const p =
    getKoreaDateParts(
      date
    );


  return (
    p.year +
    "-" +
    p.month +
    "-" +
    p.day +
    " " +
    p.hour +
    ":" +
    p.minute
  );
}


function shiftKoreaDate(
  days
) {

  const current =
    koreaDateString();


  const [
    year,
    month,
    day
  ] =
    current
      .split("-")
      .map(
        Number
      );


  const utc =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + days,
        3,
        0,
        0
      )
    );


  return koreaDateString(
    utc
  );
}


function compactDateTime(
  dateString,
  endOfDay
) {

  return (
    dateString
      .replace(
        /-/g,
        ""
      ) +
    (
      endOfDay
        ? "2359"
        : "0000"
    )
  );
}


function dateOnly(
  value
) {

  const raw =
    text(
      value
    );


  if (!raw) {

    return "";
  }


  const match =
    raw.match(
      /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/
    );


  if (!match) {

    return "";
  }


  return [
    match[1],
    String(
      match[2]
    ).padStart(
      2,
      "0"
    ),
    String(
      match[3]
    ).padStart(
      2,
      "0"
    )
  ].join("-");
}


function daysUntil(
  target
) {

  const date =
    dateOnly(
      target
    );


  if (!date) {

    return 9999;
  }


  const today =
    koreaDateString();


  const targetMs =
    Date.parse(
      date +
      "T00:00:00+09:00"
    );


  const todayMs =
    Date.parse(
      today +
      "T00:00:00+09:00"
    );


  return Math.round(
    (
      targetMs -
      todayMs
    ) /
    86400000
  );
}


/* =========================================================
   FETCH
========================================================= */

function sleep(
  ms
) {

  return new Promise(
    function (
      resolve
    ) {

      setTimeout(
        resolve,
        ms
      );
    }
  );
}


async function fetchJson(
  pageNo,
  begin,
  end
) {

  let lastError =
    null;


  for (
    let attempt = 1;
    attempt <= MAX_FETCH_ATTEMPTS;
    attempt += 1
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

      const url =
        new URL(
          API_URL
        );


      url.searchParams.set(
        "serviceKey",
        SERVICE_KEY
      );

      url.searchParams.set(
        "pageNo",
        String(
          pageNo
        )
      );

      url.searchParams.set(
        "numOfRows",
        String(
          NUM_OF_ROWS
        )
      );

      url.searchParams.set(
        "type",
        "json"
      );

      /*
        1 = 등록일시 기준 조회
      */

      url.searchParams.set(
        "inqryDiv",
        "1"
      );

      url.searchParams.set(
        "inqryBgnDt",
        begin
      );

      url.searchParams.set(
        "inqryEndDt",
        end
      );


      const response =
        await fetch(
          url,
          {
            signal:
              controller.signal,

            headers: {
              "Accept":
                "application/json"
            }
          }
        );


      if (
        !response.ok
      ) {

        throw new Error(
          "HTTP " +
          response.status
        );
      }


      const raw =
        await response.text();


      let data;


      try {

        data =
          JSON.parse(
            raw
          );

      } catch (
        error
      ) {

        throw new Error(
          "JSON 응답이 아닙니다."
        );
      }


      const header =
        data &&
        data.response &&
        data.response.header;


      if (
        header &&
        String(
          header.resultCode
        ) !== "00"
      ) {

        throw new Error(
          "G2B API 오류 " +
          String(
            header.resultCode
          ) +
          ": " +
          String(
            header.resultMsg ||
            "unknown"
          )
        );
      }


      return data;

    } catch (
      error
    ) {

      lastError =
        error;


      if (
        attempt <
        MAX_FETCH_ATTEMPTS
      ) {

        console.log(
          "[G2B] API 재시도 " +
          attempt +
          "/" +
          MAX_FETCH_ATTEMPTS
        );


        await sleep(
          attempt *
          3000
        );
      }

    } finally {

      clearTimeout(
        timer
      );
    }
  }


  throw lastError ||
    new Error(
      "G2B API 호출 실패"
    );
}


/* =========================================================
   API RESPONSE
========================================================= */

function extractItems(
  data
) {

  const body =
    data &&
    data.response &&
    data.response.body;


  if (!body) {

    return [];
  }


  const items =
    body.items;


  if (
    Array.isArray(
      items
    )
  ) {

    return items;
  }


  if (
    items &&
    Array.isArray(
      items.item
    )
  ) {

    return items.item;
  }


  if (
    items &&
    items.item &&
    typeof items.item ===
      "object"
  ) {

    return [
      items.item
    ];
  }


  return [];
}


function extractTotalCount(
  data
) {

  const body =
    data &&
    data.response &&
    data.response.body;


  return numeric(
    body &&
    body.totalCount
  );
}


/* =========================================================
   COLLECT ALL PAGES
========================================================= */

async function collectRecentNotices() {

  const beginDate =
    shiftKoreaDate(
      -LOOKBACK_DAYS
    );


  const endDate =
    koreaDateString();


  const begin =
    compactDateTime(
      beginDate,
      false
    );


  const end =
    compactDateTime(
      endDate,
      true
    );


  console.log(
    "[G2B] 조회 기간:",
    beginDate,
    "~",
    endDate
  );


  const all =
    [];


  let page =
    1;


  while (
    page <=
    MAX_PAGES
  ) {

    console.log(
      "[G2B] page",
      page
    );


    const data =
      await fetchJson(
        page,
        begin,
        end
      );


    const items =
      extractItems(
        data
      );


    const totalCount =
      extractTotalCount(
        data
      );


    all.push(
      ...items
    );


    console.log(
      "[G2B] 수신:",
      items.length,
      "/ total:",
      totalCount
    );


    if (
      items.length === 0
    ) {

      break;
    }


    if (
      totalCount > 0 &&
      all.length >=
      totalCount
    ) {

      break;
    }


    if (
      items.length <
      NUM_OF_ROWS
    ) {

      break;
    }


    page += 1;
  }


  if (
    page >
    MAX_PAGES
  ) {

    console.log(
      "::warning::G2B 최대 페이지 안전 제한에 도달했습니다."
    );
  }


  return all;
}


/* =========================================================
   KEYWORD MATCH
========================================================= */

function includesKeyword(
  source,
  keyword
) {

  const haystack =
    String(
      source || ""
    )
      .toLowerCase();


  const needle =
    String(
      keyword || ""
    )
      .toLowerCase();


  return (
    needle &&
    haystack.includes(
      needle
    )
  );
}


function matchedList(
  source,
  keywords
) {

  return unique(
    keywords.filter(
      function (
        keyword
      ) {

        return includesKeyword(
          source,
          keyword
        );
      }
    )
  );
}


/* =========================================================
   CATEGORY
========================================================= */

function detectCategory(
  source
) {

  const rules = [

    {
      category:
        "public_art",

      label:
        "공공미술",

      keywords: [
        "공공미술",
        "미술작품",
        "조형물",
        "상징물",
        "조각"
      ]
    },

    {
      category:
        "media_art",

      label:
        "미디어아트",

      keywords: [
        "미디어아트",
        "미디어 아트",
        "미디어파사드",
        "인터랙티브",
        "실감콘텐츠",
        "실감 콘텐츠",
        "XR",
        "AR",
        "VR"
      ]
    },

    {
      category:
        "exhibition",

      label:
        "전시",

      keywords: [
        "전시",
        "전시관",
        "홍보관",
        "박람회"
      ]
    },

    {
      category:
        "festival",

      label:
        "문화행사",

      keywords: [
        "축제",
        "페스티벌",
        "문화행사",
        "문화 행사",
        "행사 운영",
        "행사운영"
      ]
    },

    {
      category:
        "design",

      label:
        "공공디자인",

      keywords: [
        "디자인",
        "공간연출",
        "공간 연출",
        "공간디자인",
        "환경디자인",
        "시각디자인",
        "그래픽디자인",
        "브랜딩"
      ]
    },

    {
      category:
        "tourism",

      label:
        "관광콘텐츠",

      keywords: [
        "관광",
        "관광콘텐츠",
        "관광 콘텐츠",
        "지역콘텐츠",
        "지역 콘텐츠"
      ]
    },

    {
      category:
        "arts_content_support",

      label:
        "예술·콘텐츠 지원사업",

      keywords: [
        "문화예술",
        "문화 예술",
        "예술",
        "아티스트",
        "작가",
        "문화콘텐츠",
        "문화 콘텐츠"
      ]
    }
  ];


  for (
    const rule of
    rules
  ) {

    const matched =
      rule.keywords.some(
        function (
          keyword
        ) {

          return includesKeyword(
            source,
            keyword
          );
        }
      );


    if (
      matched
    ) {

      return {
        category:
          rule.category,

        categoryLabel:
          rule.label
      };
    }
  }


  return {
    category:
      "general",

    categoryLabel:
      "기타"
  };
}


/* =========================================================
   SCORE
========================================================= */

function scoreItem(
  item
) {

  const title =
    text(
      item.bidNtceNm ||
      item.title
    );


  const agency =
    text(
      [
        item.ntceInsttNm,
        item.dminsttNm,
        item.agency,
        item.noticeAgency,
        item.demandAgency
      ]
        .filter(
          Boolean
        )
        .join(
          " "
        )
    );


  const source =
    title +
    " " +
    agency;


  const direct =
    matchedList(
      source,
      DIRECT_KEYWORDS
    );


  const support =
    matchedList(
      source,
      SUPPORT_KEYWORDS
    );


  const penalties =
    matchedList(
      title,
      PENALTY_KEYWORDS
    );


  const nonCreative =
    matchedList(
      title,
      NON_CREATIVE_KEYWORDS
    );


  const culturalAgency =
    matchedList(
      agency,
      CULTURE_AGENCY_KEYWORDS
    );


  let score =
    0;


  const reasons =
    [];


  /*
    직접 핏:
    최대 48점.
  */

  if (
    direct.length
  ) {

    const directScore =
      Math.min(
        48,
        direct.length *
        16
      );


    score +=
      directScore;


    reasons.push(
      "AXOO 직접 핏 키워드 포함"
    );
  }


  /*
    확장 핏:
    최대 24점.
  */

  if (
    support.length
  ) {

    const supportScore =
      Math.min(
        24,
        support.length *
        6
      );


    score +=
      supportScore;


    reasons.push(
      "문화·콘텐츠 관련 키워드 포함"
    );
  }


  /*
    문화/예술/관광 기관.
  */

  if (
    culturalAgency.length
  ) {

    score +=
      8;


    reasons.push(
      "문화·예술·관광 관련 기관"
    );
  }


  const budget =
    numeric(
      item.asignBdgtAmt ||
      item.presmptPrce ||
      item.budgetAmount
    );


  /*
    AXOO가 수행하기 좋은 프로젝트 규모.
  */

  if (
    budget >=
    300000000
  ) {

    score +=
      12;


    reasons.push(
      "3억원 이상 프로젝트"
    );

  } else if (
    budget >=
    100000000
  ) {

    score +=
      10;


    reasons.push(
      "1억원 이상 프로젝트"
    );

  } else if (
    budget >=
    30000000
  ) {

    score +=
      6;


    reasons.push(
      "예산 규모 검토 가능"
    );
  }


  const deadline =
    dateOnly(
      item.bidClseDt ||
      item.deadline ||
      item.deadlineDate
    );


  const left =
    daysUntil(
      deadline
    );


  if (
    left >= 4 &&
    left <= 14
  ) {

    score +=
      8;


    reasons.push(
      "실행 검토 가능한 마감 일정"
    );

  } else if (
    left >= 15 &&
    left <= 30
  ) {

    score +=
      5;


    reasons.push(
      "검토 준비 기간 충분"
    );

  } else if (
    left >= 0 &&
    left <= 3
  ) {

    score +=
      2;


    reasons.push(
      "마감 임박"
    );
  }


  const contract =
    text(
      item.cntrctCnclsMthdNm ||
      item.contractMethod
    );


  if (
    contract.includes(
      "협상"
    )
  ) {

    score +=
      7;


    reasons.push(
      "협상계약 방식"
    );
  }


  /*
    연구·IT·유지보수형 감점.
  */

  if (
    penalties.length
  ) {

    const penalty =
      Math.min(
        30,
        penalties.length *
        15
      );


    score -=
      penalty;


    reasons.push(
      "연구·시스템·유지관리 성격 감점"
    );
  }


  /*
    창작 직접 키워드가 전혀 없고
    IT/전산 성격이면 추가 감점.
  */

  if (
    direct.length === 0 &&
    nonCreative.length
  ) {

    score -=
      Math.min(
        30,
        nonCreative.length *
        15
      );


    reasons.push(
      "비창작 용역 성격 감점"
    );
  }


  score =
    Math.max(
      0,
      Math.min(
        100,
        score
      )
    );


  let grade =
    "C";


  if (
    score >= 85
  ) {

    grade =
      "S";

  } else if (
    score >= 70
  ) {

    grade =
      "A";

  } else if (
    score >= 55
  ) {

    grade =
      "B";
  }


  const category =
    detectCategory(
      source
    );


  return {
    score:
      score,

    grade:
      grade,

    directFitKeywords:
      direct,

    supportFitKeywords:
      support,

    penaltyKeywords:
      penalties,

    matchedKeywords:
      unique(
        [
          ...direct,
          ...support
        ]
      ),

    scoreReasons:
      unique(
        reasons
      ),

    category:
      category.category,

    categoryLabel:
      category.categoryLabel
  };
}


/* =========================================================
   NORMALIZE
========================================================= */

function projectScale(
  budget
) {

  if (
    budget >=
    300000000
  ) {

    return "대형";
  }


  if (
    budget >=
    50000000
  ) {

    return "중형";
  }


  if (
    budget > 0
  ) {

    return "소형";
  }


  return "금액 미확인";
}


function getRecommendedAction(
  grade,
  daysLeft
) {

  if (
    grade === "S"
  ) {

    return "최우선 검토 — 공고문·과업지시서·참가자격 즉시 확인";
  }


  if (
    grade === "A"
  ) {

    return "우선 검토 — 공고문 다운로드 후 수행범위·예산·자격 확인";
  }


  if (
    grade === "B"
  ) {

    return "조건 확인 후 지원 여부 검토";
  }


  if (
    daysLeft <= 3
  ) {

    return "마감 임박 — 적합성 확인 후 빠르게 판단";
  }


  return "낮은 우선순위로 참고 보관";
}


function normalizeItem(
  raw
) {

  const scoring =
    scoreItem(
      raw
    );


  const title =
    text(
      raw.bidNtceNm
    );


  const agency =
    text(
      raw.ntceInsttNm
    );


  const demandAgency =
    text(
      raw.dminsttNm
    );


  const deadline =
    dateOnly(
      raw.bidClseDt ||
      raw.opengDt
    );


  const posted =
    dateOnly(
      raw.bidNtceDt
    );


  const budget =
    numeric(
      raw.asignBdgtAmt ||
      raw.presmptPrce
    );


  const left =
    daysUntil(
      deadline
    );


  const sourceUrl =
    text(
      raw.bidNtceDtlUrl ||
      raw.ntceSpecDocUrl1 ||
      raw.ntceSpecDocUrl2 ||
      raw.ntceSpecDocUrl3 ||
      ""
    );


  return {

    ...raw,

    sourceType:
      "입찰공고",

    sourceUrl:
      sourceUrl,

    title:
      title,

    agency:
      agency,

    noticeAgency:
      agency,

    demandAgency:
      demandAgency,

    contractMethod:
      text(
        raw.cntrctCnclsMthdNm ||
        raw.bidMethdNm
      ),

    noticeNo:
      text(
        raw.bidNtceNo
      ),

    publishedDate:
      posted,

    postedDate:
      posted,

    noticeDate:
      posted,

    deadline:
      deadline,

    deadlineDate:
      deadline,

    opportunityStatus:
      left < 0
        ? "마감"
        : left <= 3
          ? "임박"
          : "진행중",

    projectScale:
      projectScale(
        budget
      ),

    score:
      scoring.score,

    grade:
      scoring.grade,

    category:
      scoring.category,

    categoryLabel:
      scoring.categoryLabel,

    matchedKeywords:
      scoring.matchedKeywords,

    matchedCategories: [
      scoring.category
    ],

    directFitKeywords:
      scoring.directFitKeywords,

    supportFitKeywords:
      scoring.supportFitKeywords,

    hardExcludeKeywords:
      [],

    nonAxooExhibitionPenaltyKeywords:
      scoring.penaltyKeywords,

    budgetAmount:
      budget,

    daysLeft:
      left,

    scoreReasons:
      scoring.scoreReasons,

    fitReason:
      scoring.scoreReasons.join(
        ". "
      ) +
      (
        budget
          ? ". 예산 " +
            budget.toLocaleString(
              "ko-KR"
            ) +
            "원."
          : ". 예산 미확인."
      ) +
      (
        left !== 9999
          ? " 마감까지 " +
            left +
            "일."
          : ""
      ) +
      " 최종 등급 " +
      scoring.grade +
      ".",

    recommendedAction:
      getRecommendedAction(
        scoring.grade,
        left
      ),

    scoringVersion:
      SCORING_VERSION,

    collectionSourceId:
      "g2b_bid_public_info_servc",

    collectionVersion:
      COLLECTOR_VERSION,

    collectedAt:
      koreaDateString(),

    updatedAt:
      koreaDateString()
  };
}


/* =========================================================
   MERGE
========================================================= */

function getKey(
  item
) {

  const no =
    text(
      item.bidNtceNo ||
      item.noticeNo
    );


  const order =
    text(
      item.bidNtceOrd ||
      "000"
    );


  if (
    no
  ) {

    return (
      no +
      "-" +
      order
    );
  }


  return [
    text(
      item.title ||
      item.bidNtceNm
    ),

    text(
      item.agency ||
      item.ntceInsttNm
    ),

    dateOnly(
      item.deadline ||
      item.bidClseDt
    )
  ].join(
    "|"
  );
}


function normalizeExisting(
  existing
) {

  return existing
    .map(
      function (
        item
      ) {

        try {

          return normalizeItem(
            item
          );

        } catch (
          error
        ) {

          return item;
        }
      }
    );
}


function mergeItems(
  existing,
  discovered
) {

  const byKey =
    new Map();


  /*
    기존 데이터 중 아직 마감되지 않은 것은 유지.
  */

  normalizeExisting(
    existing
  )
    .filter(
      function (
        item
      ) {

        const deadline =
          dateOnly(
            item.deadline ||
            item.bidClseDt
          );


        if (!deadline) {

          return true;
        }


        return (
          daysUntil(
            deadline
          ) >= 0
        );
      }
    )
    .forEach(
      function (
        item
      ) {

        const key =
          getKey(
            item
          );


        if (
          key
        ) {

          byKey.set(
            key,
            item
          );
        }
      }
    );


  /*
    이번 API에서 받은 최신 데이터는
    기존 데이터를 덮어쓴다.
  */

  discovered
    .map(
      normalizeItem
    )
    .forEach(
      function (
        item
      ) {

        const key =
          getKey(
            item
          );


        if (
          key
        ) {

          byKey.set(
            key,
            item
          );
        }
      }
    );


  return [
    ...byKey.values()
  ]

    /*
      마감 제거.
    */

    .filter(
      function (
        item
      ) {

        return (
          Number(
            item.daysLeft
          ) >= 0
        );
      }
    )

    /*
      AXOO 적합성 최소 기준.
    */

    .filter(
      function (
        item
      ) {

        return (
          Number(
            item.score || 0
          ) >=
          MIN_SCORE
        );
      }
    )

    /*
      적합도 → 마감일 순.
    */

    .sort(
      function (
        a,
        b
      ) {

        const scoreDiff =
          Number(
            b.score || 0
          ) -
          Number(
            a.score || 0
          );


        if (
          scoreDiff !== 0
        ) {

          return scoreDiff;
        }


        const aDays =
          Number(
            a.daysLeft || 9999
          );


        const bDays =
          Number(
            b.daysLeft || 9999
          );


        return (
          aDays -
          bDays
        );
      }
    )

    .slice(
      0,
      MAX_OUTPUT_ITEMS
    );
}


/* =========================================================
   DASHBOARD META
========================================================= */

function updateDashboardMeta(
  opportunities
) {

  const current =
    readJson(
      META_FILE,
      {}
    );


  const important =
    opportunities.filter(
      function (
        item
      ) {

        return (
          item.grade === "S" ||
          item.grade === "A"
        );
      }
    ).length;


  const output = {

    ...current,

    lastUpdatedAt:
      koreaTimestamp(),

    timezone:
      "KST",

    opportunityCount:
      opportunities.length,

    importantOpportunityCount:
      important
  };


  writeJson(
    META_FILE,
    output
  );
}


/* =========================================================
   MAIN
========================================================= */

async function main() {

  if (
    !SERVICE_KEY
  ) {

    throw new Error(
      "G2B_SERVICE_KEY GitHub Secret이 설정되지 않았습니다."
    );
  }


  console.log(
    "===================================="
  );

  console.log(
    "AXOO G2B COLLECTOR v" +
    COLLECTOR_VERSION
  );

  console.log(
    "API: 나라장터 입찰공고 용역조회"
  );

  console.log(
    "Scoring:",
    SCORING_VERSION
  );

  console.log(
    "===================================="
  );


  const existing =
    readJson(
      DATA_FILE,
      []
    );


  if (
    !Array.isArray(
      existing
    )
  ) {

    throw new Error(
      "data/b2g_opportunities.json 은 배열이어야 합니다."
    );
  }


  const raw =
    await collectRecentNotices();


  console.log(
    "[G2B] API 원본 공고:",
    raw.length
  );


  const output =
    mergeItems(
      existing,
      raw
    );


  writeJson(
    DATA_FILE,
    output
  );


  updateDashboardMeta(
    output
  );


  const counts = {
    S: 0,
    A: 0,
    B: 0,
    C: 0
  };


  output.forEach(
    function (
      item
    ) {

      if (
        counts[
          item.grade
        ] !== undefined
      ) {

        counts[
          item.grade
        ] += 1;
      }
    }
  );


  console.log(
    "------------------------------------"
  );

  console.log(
    "기존 후보:",
    existing.length
  );

  console.log(
    "최종 활성 후보:",
    output.length
  );

  console.log(
    "S:",
    counts.S
  );

  console.log(
    "A:",
    counts.A
  );

  console.log(
    "B:",
    counts.B
  );

  console.log(
    "C:",
    counts.C
  );

  console.log(
    "------------------------------------"
  );

  console.log(
    "✅ G2B 수집 완료"
  );

  console.log(
    "===================================="
  );
}


main()
  .catch(
    function (
      error
    ) {

      console.error(
        "[AXOO G2B COLLECTOR]",
        error
      );

      process.exitCode =
        1;
    }
  );
