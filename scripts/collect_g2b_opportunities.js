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
  String(process.env.G2B_SERVICE_KEY || "").trim();

const COLLECTOR_VERSION = "1.0.1";
const SCORING_VERSION = "axoo_bid_fit_v4.1";

const NUM_OF_ROWS = 999;
const LOOKBACK_DAYS = 2;
const MAX_PAGES = 20;

const FETCH_TIMEOUT_MS = 25000;
const MAX_FETCH_ATTEMPTS = 3;

const MAX_OUTPUT_ITEMS = 80;
const MIN_SCORE = 40;


/* =========================================================
   AXOO KEYWORDS
========================================================= */

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
  "문화 콘텐츠",

  "굿즈 디자인",
  "굿즈 제작",

  "전시 조성",
  "행사장 조성"
];


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
  "지역 축제",

  "캠페인"
];


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
   BASIC
========================================================= */

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const raw =
    fs.readFileSync(filePath, "utf8");

  if (!raw.trim()) {
    return fallback;
  }

  return JSON.parse(raw);
}


function writeJson(filePath, data) {
  fs.writeFileSync(
    filePath,
    JSON.stringify(data, null, 2) + "\n",
    "utf8"
  );
}


function text(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}


function unique(values) {
  return [
    ...new Set(
      values.filter(Boolean)
    )
  ];
}


function numeric(value) {
  const number =
    Number(
      String(value || "")
        .replace(/,/g, "")
    );

  return Number.isFinite(number)
    ? number
    : 0;
}


/* =========================================================
   DATE
========================================================= */

function getKoreaDateParts(date = new Date()) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }
    ).formatToParts(date);

  const map = {};

  parts.forEach(part => {
    if (part.type !== "literal") {
      map[part.type] =
        part.value;
    }
  });

  return map;
}


function koreaDateString(date = new Date()) {
  const p =
    getKoreaDateParts(date);

  return (
    p.year +
    "-" +
    p.month +
    "-" +
    p.day
  );
}


function koreaTimestamp(date = new Date()) {
  const p =
    getKoreaDateParts(date);

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


function shiftKoreaDate(days) {
  const current =
    koreaDateString();

  const [year, month, day] =
    current
      .split("-")
      .map(Number);

  const utc =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + days,
        3
      )
    );

  return koreaDateString(utc);
}


function compactDateTime(
  dateString,
  endOfDay
) {
  return (
    dateString.replace(/-/g, "") +
    (
      endOfDay
        ? "2359"
        : "0000"
    )
  );
}


function dateOnly(value) {
  const raw =
    text(value);

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
    String(match[2]).padStart(2, "0"),
    String(match[3]).padStart(2, "0")
  ].join("-");
}


function daysUntil(target) {
  const date =
    dateOnly(target);

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
    (targetMs - todayMs) /
    86400000
  );
}


function timestampValue(value) {
  const raw =
    text(value);

  if (!raw) {
    return 0;
  }

  const parsed =
    Date.parse(
      raw.replace(
        " ",
        "T"
      ) + (
        /[zZ]|[+-]\d\d:\d\d$/.test(raw)
          ? ""
          : "+09:00"
      )
    );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}


/* =========================================================
   FETCH
========================================================= */

function sleep(ms) {
  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );
}


async function fetchJson(
  pageNo,
  begin,
  end
) {
  let lastError = null;

  for (
    let attempt = 1;
    attempt <= MAX_FETCH_ATTEMPTS;
    attempt += 1
  ) {
    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () => controller.abort(),
        FETCH_TIMEOUT_MS
      );

    try {
      const url =
        new URL(API_URL);

      url.searchParams.set(
        "serviceKey",
        SERVICE_KEY
      );

      url.searchParams.set(
        "pageNo",
        String(pageNo)
      );

      url.searchParams.set(
        "numOfRows",
        String(NUM_OF_ROWS)
      );

      url.searchParams.set(
        "type",
        "json"
      );

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
              Accept:
                "application/json"
            }
          }
        );

      if (!response.ok) {
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
          JSON.parse(raw);
      } catch (error) {
        throw new Error(
          "JSON 응답이 아닙니다."
        );
      }

      const header =
        data?.response?.header;

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

    } catch (error) {
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
          attempt * 3000
        );
      }

    } finally {
      clearTimeout(timer);
    }
  }

  throw (
    lastError ||
    new Error(
      "G2B API 호출 실패"
    )
  );
}


/* =========================================================
   RESPONSE
========================================================= */

function extractItems(data) {
  const body =
    data?.response?.body;

  if (!body) {
    return [];
  }

  const items =
    body.items;

  if (Array.isArray(items)) {
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
    items?.item &&
    typeof items.item ===
      "object"
  ) {
    return [
      items.item
    ];
  }

  return [];
}


function extractTotalCount(data) {
  return numeric(
    data?.response?.body?.totalCount
  );
}


/* =========================================================
   NOTICE STATE
========================================================= */

function isCancelledNotice(item) {
  const source =
    [
      item?.ntceKindNm,
      item?.chgNtceRsn,
      item?.bidNtceNm,
      item?.title
    ]
      .filter(Boolean)
      .join(" ");

  return (
    source.includes(
      "취소공고"
    ) ||
    source.includes(
      "취소 공고"
    )
  );
}


function noticeOrder(item) {
  return numeric(
    item?.bidNtceOrd
  );
}


function noticeDateValue(item) {
  return timestampValue(
    item?.bidNtceDt ||
    item?.rgstDt ||
    item?.updatedAt
  );
}


/*
  동일 입찰공고번호의
  000 / 001 / 002를 하나로 정리.

  가장 최신 차수가 취소공고라면
  해당 공고번호 전체를 제거한다.
*/

function collapseNoticeVersions(items) {
  const groups =
    new Map();

  const withoutNo = [];

  items.forEach(item => {
    const no =
      text(
        item.bidNtceNo ||
        item.noticeNo
      );

    if (!no) {
      withoutNo.push(item);
      return;
    }

    if (!groups.has(no)) {
      groups.set(
        no,
        []
      );
    }

    groups.get(no).push(item);
  });

  const output = [];

  groups.forEach(group => {
    group.sort((a, b) => {
      const orderDiff =
        noticeOrder(b) -
        noticeOrder(a);

      if (orderDiff !== 0) {
        return orderDiff;
      }

      return (
        noticeDateValue(b) -
        noticeDateValue(a)
      );
    });

    const latest =
      group[0];

    if (
      !isCancelledNotice(
        latest
      )
    ) {
      output.push(latest);
    }
  });

  return [
    ...output,
    ...withoutNo.filter(
      item =>
        !isCancelledNotice(item)
    )
  ];
}


function canonicalProjectTitle(value) {
  return text(value)

    .replace(
      /\[\s*(재공고|변경공고|취소공고)\s*\]/gi,
      ""
    )

    .replace(
      /\(\s*(재공고|변경공고|취소공고)\s*\)/gi,
      ""
    )

    .replace(
      /^\s*\(재공고\)\s*/gi,
      ""
    )

    .replace(
      /^\s*재공고\s*/gi,
      ""
    )

    .replace(
      /\s+/g,
      " "
    )

    .trim()
    .toLowerCase();
}


/*
  취소 후 새 공고번호로 다시 올라온 경우에도
  동일 사업 카드가 두 개 남지 않도록 정리.
*/

function dedupeSameProjects(items) {
  const map =
    new Map();

  items.forEach(item => {
    const title =
      canonicalProjectTitle(
        item.bidNtceNm ||
        item.title
      );

    const agency =
      text(
        item.dminsttNm ||
        item.demandAgency ||
        item.ntceInsttNm ||
        item.agency
      )
        .toLowerCase();

    const key =
      title +
      "|" +
      agency;

    if (!title) {
      return;
    }

    const previous =
      map.get(key);

    if (!previous) {
      map.set(
        key,
        item
      );

      return;
    }

    const previousTime =
      noticeDateValue(
        previous
      );

    const nextTime =
      noticeDateValue(
        item
      );

    if (
      nextTime >
      previousTime
    ) {
      map.set(
        key,
        item
      );

      return;
    }

    if (
      nextTime ===
      previousTime &&
      noticeOrder(item) >
      noticeOrder(previous)
    ) {
      map.set(
        key,
        item
      );
    }
  });

  return [
    ...map.values()
  ];
}


/* =========================================================
   COLLECT
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

  const all = [];

  let page = 1;

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
      extractItems(data);

    const totalCount =
      extractTotalCount(data);

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
      items.length === 0 ||
      (
        totalCount > 0 &&
        all.length >=
        totalCount
      ) ||
      items.length <
        NUM_OF_ROWS
    ) {
      break;
    }

    page += 1;
  }

  const before =
    all.length;

  const collapsed =
    collapseNoticeVersions(
      all
    );

  const deduped =
    dedupeSameProjects(
      collapsed
    );

  console.log(
    "[G2B] 원본:",
    before
  );

  console.log(
    "[G2B] 취소·변경 차수 정리 후:",
    collapsed.length
  );

  console.log(
    "[G2B] 동일 사업 중복 정리 후:",
    deduped.length
  );

  return deduped;
}


/* =========================================================
   KEYWORDS
========================================================= */

function includesKeyword(
  source,
  keyword
) {
  const haystack =
    String(
      source || ""
    ).toLowerCase();

  const needle =
    String(
      keyword || ""
    ).toLowerCase();

  return (
    Boolean(needle) &&
    haystack.includes(needle)
  );
}


function matchedList(
  source,
  keywords
) {
  return unique(
    keywords.filter(
      keyword =>
        includesKeyword(
          source,
          keyword
        )
    )
  );
}


/* =========================================================
   CATEGORY
========================================================= */

function detectCategory(source) {
  const rules = [
    {
      category:
        "media_art",

      label:
        "미디어아트",

      keywords: [
        "미디어아트",
        "미디어 아트",
        "미디어파사드",
        "미디어 파사드",
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
        "exhibition",

      label:
        "전시",

      keywords: [
        "전시",
        "전시관",
        "홍보관",
        "박람회",
        "팝업스토어",
        "팝업 스토어",
        "팝업"
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
        "브랜딩",
        "굿즈"
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
    const rule of rules
  ) {
    if (
      rule.keywords.some(
        keyword =>
          includesKeyword(
            source,
            keyword
          )
      )
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

function scoreItem(item) {
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
        .filter(Boolean)
        .join(" ")
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

  let score = 0;

  const reasons = [];


  /*
    핵심 직접 핏
  */

  if (direct.length) {
    score +=
      Math.min(
        54,
        direct.length * 18
      );

    reasons.push(
      "AXOO 직접 핏 키워드 포함"
    );
  }


  /*
    2개 이상의 직접 핏이 겹치면
    프로젝트 적합성이 높다고 판단.
  */

  if (
    direct.length >= 2
  ) {
    score += 8;

    reasons.push(
      "복수 핵심 서비스 영역과 일치"
    );
  }


  /*
    확장 핏
  */

  if (support.length) {
    score +=
      Math.min(
        20,
        support.length * 5
      );

    reasons.push(
      "문화·콘텐츠 관련 키워드 포함"
    );
  }


  if (
    culturalAgency.length
  ) {
    score += 8;

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

  if (
    budget >=
    300000000
  ) {
    score += 12;

    reasons.push(
      "3억원 이상 프로젝트"
    );

  } else if (
    budget >=
    100000000
  ) {
    score += 10;

    reasons.push(
      "1억원 이상 프로젝트"
    );

  } else if (
    budget >=
    30000000
  ) {
    score += 6;

    reasons.push(
      "예산 규모 검토 가능"
    );
  }


  const deadline =
    dateOnly(
      item.bidClseDt ||
      item.opengDt ||
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
    score += 8;

    reasons.push(
      "실행 검토 가능한 마감 일정"
    );

  } else if (
    left >= 15 &&
    left <= 30
  ) {
    score += 5;

    reasons.push(
      "검토 준비 기간 충분"
    );

  } else if (
    left >= 0 &&
    left <= 3
  ) {
    score += 1;

    reasons.push(
      "마감 임박"
    );
  }


  /*
    낙찰 방식까지 확인.
  */

  const contractSource =
    text(
      [
        item.sucsfbidMthdNm,
        item.cntrctCnclsMthdNm,
        item.bidMethdNm,
        title
      ]
        .filter(Boolean)
        .join(" ")
    );

  if (
    contractSource.includes(
      "협상"
    )
  ) {
    score += 8;

    reasons.push(
      "협상에 의한 계약"
    );
  }


  if (
    penalties.length
  ) {
    score -=
      Math.min(
        30,
        penalties.length * 15
      );

    reasons.push(
      "연구·시스템·유지관리 성격 감점"
    );
  }


  if (
    direct.length === 0 &&
    nonCreative.length
  ) {
    score -=
      Math.min(
        30,
        nonCreative.length * 15
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


  let grade = "C";

  if (
    score >= 85
  ) {
    grade = "S";

  } else if (
    score >= 65
  ) {
    grade = "A";

  } else if (
    score >= 50
  ) {
    grade = "B";
  }


  const category =
    detectCategory(source);


  return {
    score,
    grade,

    directFitKeywords:
      direct,

    supportFitKeywords:
      support,

    culturalAgencyKeywords:
      culturalAgency,

    penaltyKeywords:
      penalties,

    matchedKeywords:
      unique([
        ...direct,
        ...support
      ]),

    scoreReasons:
      unique(reasons),

    category:
      category.category,

    categoryLabel:
      category.categoryLabel
  };
}


/* =========================================================
   NORMALIZE
========================================================= */

function projectScale(budget) {
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


function normalizeItem(raw) {
  const scoring =
    scoreItem(raw);

  const title =
    text(
      raw.bidNtceNm ||
      raw.title
    );

  const agency =
    text(
      raw.ntceInsttNm ||
      raw.agency
    );

  const demandAgency =
    text(
      raw.dminsttNm ||
      raw.demandAgency
    );

  const deadline =
    dateOnly(
      raw.bidClseDt ||
      raw.opengDt ||
      raw.deadline
    );

  const posted =
    dateOnly(
      raw.bidNtceDt ||
      raw.publishedDate
    );

  const budget =
    numeric(
      raw.asignBdgtAmt ||
      raw.presmptPrce ||
      raw.budgetAmount
    );

  const left =
    daysUntil(deadline);

  const sourceUrl =
    text(
      raw.bidNtceDtlUrl ||
      raw.bidNtceUrl ||
      raw.sourceUrl ||
      raw.ntceSpecDocUrl1 ||
      ""
    );

  const contractMethod =
    text(
      raw.sucsfbidMthdNm ||
      raw.cntrctCnclsMthdNm ||
      raw.bidMethdNm ||
      raw.contractMethod
    );

  return {
    ...raw,

    sourceType:
      "입찰공고",

    sourceUrl,

    title,

    agency,

    noticeAgency:
      agency,

    demandAgency,

    contractMethod,

    noticeNo:
      text(
        raw.bidNtceNo ||
        raw.noticeNo
      ),

    publishedDate:
      posted,

    postedDate:
      posted,

    noticeDate:
      posted,

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

    culturalAgencyKeywords:
      scoring.culturalAgencyKeywords,

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
      raw.collectedAt ||
      koreaDateString(),

    updatedAt:
      koreaDateString()
  };
}


/* =========================================================
   QUALITY GATE
========================================================= */

function isMeaningfulCandidate(item) {
  const direct =
    Array.isArray(
      item.directFitKeywords
    )
      ? item.directFitKeywords
      : [];

  const support =
    Array.isArray(
      item.supportFitKeywords
    )
      ? item.supportFitKeywords
      : [];

  const cultureAgency =
    Array.isArray(
      item.culturalAgencyKeywords
    )
      ? item.culturalAgencyKeywords
      : [];

  /*
    1. 핵심 키워드 최소 1개
       또는

    2. 확장 키워드 2개 이상 +
       문화 관련 기관

    둘 중 하나는 만족해야 한다.
  */

  return (
    direct.length >= 1 ||
    (
      support.length >= 2 &&
      cultureAgency.length >= 1
    )
  );
}


/* =========================================================
   MERGE
========================================================= */

function mergeItems(
  existing,
  discovered
) {
  const normalizedExisting =
    existing
      .map(item => {
        try {
          return normalizeItem(
            item
          );
        } catch (error) {
          return item;
        }
      });


  const normalizedNew =
    discovered.map(
      normalizeItem
    );


  /*
    기존 v1.0.0 데이터까지 포함해
    취소 / 변경 차수 중복을 다시 청소.
  */

  const combined =
    collapseNoticeVersions([
      ...normalizedExisting,
      ...normalizedNew
    ]);


  const deduped =
    dedupeSameProjects(
      combined
    );


  return deduped

    .filter(
      item =>
        !isCancelledNotice(
          item
        )
    )

    .filter(item => {
      const deadline =
        dateOnly(
          item.deadline ||
          item.bidClseDt ||
          item.opengDt
        );

      return (
        !deadline ||
        daysUntil(deadline) >= 0
      );
    })

    .filter(
      isMeaningfulCandidate
    )

    .filter(
      item =>
        Number(
          item.score || 0
        ) >=
        MIN_SCORE
    )

    .sort((a, b) => {
      const gradeOrder = {
        S: 0,
        A: 1,
        B: 2,
        C: 3
      };

      const gradeDiff =
        (
          gradeOrder[a.grade] ??
          9
        ) -
        (
          gradeOrder[b.grade] ??
          9
        );

      if (
        gradeDiff !== 0
      ) {
        return gradeDiff;
      }

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

      return (
        Number(
          a.daysLeft ?? 9999
        ) -
        Number(
          b.daysLeft ?? 9999
        )
      );
    })

    .slice(
      0,
      MAX_OUTPUT_ITEMS
    );
}


/* =========================================================
   META
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
      item =>
        item.grade === "S" ||
        item.grade === "A"
    ).length;

  writeJson(
    META_FILE,
    {
      ...current,

      lastUpdatedAt:
        koreaTimestamp(),

      timezone:
        "KST",

      opportunityCount:
        opportunities.length,

      importantOpportunityCount:
        important
    }
  );
}


/* =========================================================
   MAIN
========================================================= */

async function main() {
  if (!SERVICE_KEY) {
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


  output.forEach(item => {
    if (
      counts[item.grade] !==
      undefined
    ) {
      counts[item.grade] += 1;
    }
  });


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
  .catch(error => {
    console.error(
      "[AXOO G2B COLLECTOR]",
      error
    );

    process.exitCode = 1;
  });
