const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(process.cwd(), "data", "b2g_opportunities.json");
const META_FILE = path.join(process.cwd(), "data", "dashboard_meta.json");
const API_URL =
  "https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServc";
const SERVICE_KEY = String(process.env.G2B_SERVICE_KEY || "").trim();

const COLLECTOR_VERSION = "1.1.0";
const SCORING_VERSION = "axoo_bid_fit_v5";
const NUM_OF_ROWS = 999;
const LOOKBACK_DAYS = 2;
const MAX_PAGES = 20;
const FETCH_TIMEOUT_MS = 25000;
const MAX_FETCH_ATTEMPTS = 3;
const MAX_OUTPUT_ITEMS = 60;
const GRADE_ORDER = { S: 0, A: 1, B: 2, C: 3 };

/*
  FIT v5 핵심 원칙
  1) S/A는 AXOO 핵심 수행영역이 제목에 명확해야 함.
  2) 예산/마감/협상계약/기관은 등급을 올리지 않음.
  3) B는 인접 검토, C는 파일에서 제거.
*/

const STRONG_CONCEPTS = [
  {
    id: "media_art",
    label: "미디어아트",
    weight: 65,
    keywords: ["미디어아트", "미디어 아트"]
  },
  {
    id: "media_facade",
    label: "미디어파사드",
    weight: 65,
    keywords: ["미디어파사드", "미디어 파사드"]
  },
  {
    id: "public_art",
    label: "공공미술·미술작품",
    weight: 65,
    keywords: ["공공미술", "공공 미술", "미술작품", "미술 작품"]
  },
  {
    id: "mural_sculpture",
    label: "벽화·조형물",
    weight: 60,
    keywords: ["벽화", "조형물", "상징조형물", "상징물", "아트월"]
  },
  {
    id: "exhibition_planning",
    label: "전시기획·전시연출",
    weight: 60,
    keywords: [
      "전시기획",
      "전시 기획",
      "전시연출",
      "전시 연출",
      "전시디자인",
      "전시 디자인"
    ]
  },
  {
    id: "exhibition_build",
    label: "전시 조성·제작·설치",
    weight: 58,
    keywords: [
      "전시 조성",
      "전시공간 조성",
      "전시 공간 조성",
      "전시물 제작",
      "전시물 설치",
      "전시 제작",
      "전시 설치"
    ]
  },
  {
    id: "space_creative",
    label: "공간연출·공간디자인",
    weight: 60,
    keywords: [
      "공간연출",
      "공간 연출",
      "공간디자인",
      "공간 디자인",
      "공간브랜딩",
      "공간 브랜딩",
      "vmd"
    ]
  },
  {
    id: "immersive",
    label: "실감·인터랙티브 콘텐츠",
    weight: 60,
    keywords: [
      "실감콘텐츠",
      "실감 콘텐츠",
      "인터랙티브",
      "xr 콘텐츠",
      "ar 콘텐츠",
      "vr 콘텐츠"
    ]
  },
  {
    id: "public_design",
    label: "공공·경관·환경디자인",
    weight: 60,
    keywords: [
      "공공디자인",
      "공공 디자인",
      "경관디자인",
      "경관 디자인",
      "환경디자인",
      "환경 디자인"
    ]
  },
  {
    id: "visual_design",
    label: "시각·그래픽디자인",
    weight: 40,
    keywords: [
      "시각디자인",
      "시각 디자인",
      "그래픽디자인",
      "그래픽 디자인"
    ]
  },
  {
    id: "goods_design",
    label: "굿즈 디자인·제작",
    weight: 40,
    keywords: ["굿즈 디자인", "굿즈 제작"]
  },
  {
    id: "artist_collab",
    label: "아티스트 협업",
    weight: 50,
    keywords: ["아티스트 협업", "작가 협업", "예술가 협업"]
  }
];

const MEDIUM_CONCEPTS = [
  {
    id: "generic_exhibition",
    label: "전시",
    weight: 10,
    keywords: ["전시"]
  },
  {
    id: "branding",
    label: "브랜딩",
    weight: 15,
    keywords: ["브랜딩", "브랜드 캠페인"]
  },
  {
    id: "content_production",
    label: "콘텐츠 제작",
    weight: 10,
    keywords: ["콘텐츠 제작", "콘텐츠제작"]
  },
  {
    id: "video_content",
    label: "영상 콘텐츠",
    weight: 8,
    keywords: ["영상콘텐츠", "영상 콘텐츠", "영상 제작", "영상제작"]
  },
  {
    id: "festival_event",
    label: "축제·페스티벌",
    weight: 6,
    keywords: ["축제", "페스티벌"]
  },
  {
    id: "goods",
    label: "굿즈·기념품",
    weight: 8,
    keywords: ["굿즈", "기념품"]
  },
  {
    id: "tourism_content",
    label: "관광 콘텐츠",
    weight: 8,
    keywords: ["관광콘텐츠", "관광 콘텐츠"]
  },
  {
    id: "experience_content",
    label: "체험 콘텐츠",
    weight: 10,
    keywords: ["체험콘텐츠", "체험 콘텐츠", "체험형 콘텐츠"]
  }
];

const HARD_NEGATIVE_KEYWORDS = [
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

  "소프트웨어",
  "데이터베이스",
  "db 구축",
  "db구축",
  "전산",
  "서버",
  "네트워크",
  "보안",

  "감리",
  "안전진단",
  "정밀진단",
  "검사 용역",
  "측량",

  "보험",
  "청소",
  "경비",
  "폐기물",
  "식자재",
  "차량 임차",
  "버스 임차",

  "회계",
  "법률",

  "교육 용역",
  "교육운영",
  "교육 운영",
  "연수 운영"
];

const GENERIC_OPERATION_KEYWORDS = [
  "행사 운영",
  "행사운영",
  "행사 대행",
  "행사대행",

  "축제 운영",
  "축제운영",

  "홍보 대행",
  "홍보대행",

  "sns 운영",
  "채널 운영",
  "홈페이지 운영"
];

const CULTURE_AGENCY_KEYWORDS = [
  "문화재단",
  "관광재단",
  "문화산업진흥원",
  "콘텐츠진흥원",
  "예술경영지원센터",

  "미술관",
  "박물관",
  "문화원",

  "문화",
  "예술",
  "관광",
  "콘텐츠"
];


/* =========================================================
   BASIC
========================================================= */

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;

  const raw = fs.readFileSync(
    filePath,
    "utf8"
  );

  return raw.trim()
    ? JSON.parse(raw)
    : fallback;
}


function writeJson(filePath, value) {
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      value,
      null,
      2
    ) + "\n",
    "utf8"
  );
}


function text(value) {
  return String(
    value == null
      ? ""
      : value
  )
    .replace(/\s+/g, " ")
    .trim();
}


function lower(value) {
  return text(value)
    .toLowerCase();
}


function numeric(value) {
  const n = Number(
    String(value || "")
      .replace(/,/g, "")
  );

  return Number.isFinite(n)
    ? n
    : 0;
}


function unique(values) {
  return [
    ...new Set(
      values.filter(Boolean)
    )
  ];
}


function includesAny(
  source,
  keywords
) {
  const haystack =
    lower(source);

  return keywords.some(
    keyword =>
      haystack.includes(
        lower(keyword)
      )
  );
}


function matchedKeywords(
  source,
  keywords
) {
  const haystack =
    lower(source);

  return unique(
    keywords.filter(
      keyword =>
        haystack.includes(
          lower(keyword)
        )
    )
  );
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
    part => {
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


function shiftKoreaDate(days) {
  const [
    y,
    m,
    d
  ] =
    koreaDateString()
      .split("-")
      .map(Number);

  return koreaDateString(
    new Date(
      Date.UTC(
        y,
        m - 1,
        d + days,
        3,
        0,
        0
      )
    )
  );
}


function compactDateTime(
  dateString,
  endOfDay
) {
  return (
    dateString
      .replace(/-/g, "") +
    (
      endOfDay
        ? "2359"
        : "0000"
    )
  );
}


function dateOnly(value) {
  const match =
    text(value)
      .match(
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


function daysUntil(value) {
  const target =
    dateOnly(value);

  if (!target) {
    return 9999;
  }

  const targetMs =
    Date.parse(
      target +
      "T00:00:00+09:00"
    );

  const todayMs =
    Date.parse(
      koreaDateString() +
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


function timestampValue(value) {
  const raw =
    text(value);

  if (!raw) {
    return 0;
  }

  const normalized =
    raw.replace(
      " ",
      "T"
    );

  const parsed =
    Date.parse(
      /[zZ]|[+-]\d\d:\d\d$/.test(
        normalized
      )
        ? normalized
        : normalized +
          "+09:00"
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


/* =========================================================
   FETCH
========================================================= */

function sleep(ms) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
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
    attempt <=
      MAX_FETCH_ATTEMPTS;
    attempt += 1
  ) {

    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () =>
          controller.abort(),
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

      } catch (_) {

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
          header.resultCode +
          ": " +
          (
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

  throw (
    lastError ||
    new Error(
      "G2B API 호출 실패"
    )
  );
}


function extractItems(data) {
  const items =
    data
      ?.response
      ?.body
      ?.items;

  if (
    Array.isArray(
      items
    )
  ) {
    return items;
  }

  if (
    Array.isArray(
      items?.item
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
    data
      ?.response
      ?.body
      ?.totalCount
  );
}


/* =========================================================
   NOTICE CLEANUP
========================================================= */

function isCancelledNotice(item) {
  return includesAny(
    [
      item?.ntceKindNm,
      item?.chgNtceRsn,
      item?.bidNtceNm,
      item?.title
    ]
      .filter(Boolean)
      .join(" "),

    [
      "취소공고",
      "취소 공고"
    ]
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


function collapseNoticeVersions(
  items
) {
  const groups =
    new Map();

  const noNumber = [];

  items.forEach(
    item => {
      const noticeNo =
        text(
          item.bidNtceNo ||
          item.noticeNo
        );

      if (!noticeNo) {
        noNumber.push(
          item
        );

        return;
      }

      if (
        !groups.has(
          noticeNo
        )
      ) {
        groups.set(
          noticeNo,
          []
        );
      }

      groups
        .get(
          noticeNo
        )
        .push(
          item
        );
    }
  );

  const output = [];

  groups.forEach(
    group => {

      group.sort(
        (
          a,
          b
        ) =>
          noticeOrder(b) -
          noticeOrder(a) ||
          noticeDateValue(b) -
          noticeDateValue(a)
      );

      if (
        !isCancelledNotice(
          group[0]
        )
      ) {
        output.push(
          group[0]
        );
      }
    }
  );

  return [
    ...output,
    ...noNumber.filter(
      item =>
        !isCancelledNotice(
          item
        )
    )
  ];
}


function canonicalProjectTitle(
  value
) {
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


function dedupeSameProjects(
  items
) {
  const map =
    new Map();

  items.forEach(
    item => {

      const titleKey =
        canonicalProjectTitle(
          item.bidNtceNm ||
          item.title
        );

      const agencyKey =
        lower(
          item.dminsttNm ||
          item.demandAgency ||
          item.ntceInsttNm ||
          item.agency
        );

      if (!titleKey) {
        return;
      }

      const key =
        titleKey +
        "|" +
        agencyKey;

      const previous =
        map.get(
          key
        );

      if (
        !previous ||
        noticeDateValue(
          item
        ) >
        noticeDateValue(
          previous
        ) ||
        (
          noticeDateValue(
            item
          ) ===
          noticeDateValue(
            previous
          ) &&
          noticeOrder(
            item
          ) >
          noticeOrder(
            previous
          )
        )
      ) {
        map.set(
          key,
          item
        );
      }
    }
  );

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

  const all = [];

  let page = 1;

  console.log(
    "[G2B] 조회 기간:",
    beginDate,
    "~",
    endDate
  );

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
    all.length
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
   FIT
========================================================= */

function matchConcepts(
  source,
  concepts
) {
  return concepts.flatMap(
    concept => {

      const keywords =
        matchedKeywords(
          source,
          concept.keywords
        );

      return keywords.length
        ? [
            {
              ...concept,
              keywords
            }
          ]
        : [];
    }
  );
}


function detectPopupBuild(title) {

  const hasPopup =
    includesAny(
      title,
      [
        "팝업스토어",
        "팝업 스토어",
        "팝업"
      ]
    );

  const hasBuild =
    includesAny(
      title,
      [
        "조성",
        "디자인",
        "연출",
        "공간",
        "제작",
        "설치"
      ]
    );

  return (
    hasPopup &&
    hasBuild
  )
    ? {
        id:
          "popup_build",

        label:
          "팝업 공간 조성·디자인",

        weight:
          62,

        keywords: [
          "팝업",
          "조성/디자인/연출"
        ]
      }
    : null;
}


function detectExhibitionFacility(
  title
) {

  const hasFacility =
    includesAny(
      title,
      [
        "전시관",
        "홍보관",
        "체험관"
      ]
    );

  const hasCreative =
    includesAny(
      title,
      [
        "조성",
        "디자인",
        "연출",
        "전시",
        "콘텐츠",
        "제작",
        "설치"
      ]
    );

  return (
    hasFacility &&
    hasCreative
  )
    ? {
        id:
          "exhibition_facility",

        label:
          "전시관·홍보관 조성",

        weight:
          55,

        keywords: [
          "전시관/홍보관",
          "조성/콘텐츠"
        ]
      }
    : null;
}


function detectPopupOperation(
  title
) {

  const hasPopup =
    includesAny(
      title,
      [
        "팝업스토어",
        "팝업 스토어",
        "팝업"
      ]
    );

  const hasOperation =
    includesAny(
      title,
      [
        "운영",
        "유치"
      ]
    );

  const hasBuild =
    includesAny(
      title,
      [
        "조성",
        "디자인",
        "연출",
        "공간",
        "제작",
        "설치"
      ]
    );

  return (
    hasPopup &&
    hasOperation &&
    !hasBuild
  );
}


function getProcurementFit(item) {

  const source =
    [
      item.pubPrcrmntLrgClsfcNm,
      item.pubPrcrmntMidClsfcNm,
      item.pubPrcrmntClsfcNm
    ]
      .filter(Boolean)
      .join(" ");

  if (
    includesAny(
      source,
      [
        "전시회기획및대행서비스",
        "전시회 기획",
        "전시기획"
      ]
    )
  ) {
    return {
      score:
        12,

      strong:
        true,

      labels: [
        "전시회 기획·대행 서비스"
      ]
    };
  }

  if (
    includesAny(
      source,
      [
        "디자인서비스",
        "디자인 서비스",
        "전시서비스"
      ]
    )
  ) {
    return {
      score:
        10,

      strong:
        true,

      labels: [
        "디자인·전시 서비스 분류"
      ]
    };
  }

  if (
    includesAny(
      source,
      [
        "미술",
        "조형",
        "전시"
      ]
    )
  ) {
    return {
      score:
        8,

      strong:
        true,

      labels: [
        "미술·전시 관련 조달 분류"
      ]
    };
  }

  return {
    score:
      0,

    strong:
      false,

    labels:
      []
  };
}


function evaluateFit(item) {

  const title =
    text(
      item.bidNtceNm ||
      item.title
    );

  const strong =
    matchConcepts(
      title,
      STRONG_CONCEPTS
    );

  const popupBuild =
    detectPopupBuild(
      title
    );

  const facility =
    detectExhibitionFacility(
      title
    );

  if (
    popupBuild &&
    !strong.some(
      x =>
        x.id ===
        popupBuild.id
    )
  ) {
    strong.push(
      popupBuild
    );
  }

  if (
    facility &&
    !strong.some(
      x =>
        x.id ===
        facility.id
    )
  ) {
    strong.push(
      facility
    );
  }

  const medium =
    matchConcepts(
      title,
      MEDIUM_CONCEPTS
    );

  const hardNegatives =
    matchedKeywords(
      title,
      HARD_NEGATIVE_KEYWORDS
    );

  const genericOperations =
    matchedKeywords(
      title,
      GENERIC_OPERATION_KEYWORDS
    );

  const procurement =
    getProcurementFit(
      item
    );

  let fitScore = 0;

  const reasons = [];

  if (
    strong.length
  ) {

    const weights =
      strong
        .map(
          x =>
            x.weight
        )
        .sort(
          (
            a,
            b
          ) =>
            b - a
        );

    fitScore +=
      weights[0] ||
      0;

    if (
      weights[1]
    ) {
      fitScore +=
        Math.min(
          28,
          weights[1] *
          0.45
        );
    }

    if (
      weights[2]
    ) {
      fitScore +=
        Math.min(
          10,
          weights[2] *
          0.2
        );
    }

    reasons.push(
      "핵심 수행영역: " +
      strong
        .map(
          x =>
            x.label
        )
        .join(", ")
    );
  }

  if (
    medium.length
  ) {

    fitScore +=
      Math.min(
        18,
        medium.reduce(
          (
            sum,
            x
          ) =>
            sum +
            x.weight,
          0
        )
      );

    reasons.push(
      "보조 적합요소: " +
      medium
        .map(
          x =>
            x.label
        )
        .join(", ")
    );
  }

  if (
    detectPopupOperation(
      title
    )
  ) {

    fitScore +=
      22;

    reasons.push(
      "팝업 운영형 사업 — 공간 조성·디자인 명시 없음"
    );
  }

  if (
    procurement.score
  ) {

    fitScore +=
      procurement.score;

    reasons.push(
      "조달 분류: " +
      procurement.labels
        .join(", ")
    );
  }

  if (
    genericOperations.length &&
    strong.length === 0
  ) {

    fitScore -=
      12;

    reasons.push(
      "단순 행사·홍보 운영 성격 감점"
    );
  }

  if (
    hardNegatives.length
  ) {

    fitScore =
      strong.length === 0
        ? Math.min(
            fitScore,
            15
          )
        : fitScore -
          25;

    reasons.push(
      "비핵심 용역 성격 감점: " +
      hardNegatives
        .join(", ")
    );
  }

  fitScore =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          fitScore
        )
      )
    );

  let grade = "C";

  if (
    fitScore >= 85 &&
    strong.length >= 2 &&
    !hardNegatives.length
  ) {

    grade =
      "S";

  } else if (
    fitScore >= 60 &&
    strong.length >= 1 &&
    !hardNegatives.length
  ) {

    grade =
      "A";

  } else if (
    fitScore >= 35
  ) {

    grade =
      "B";
  }

  return {
    fitScore:
      fitScore,

    grade:
      grade,

    strongFitConcepts:
      strong.map(
        x =>
          x.id
      ),

    strongFitLabels:
      strong.map(
        x =>
          x.label
      ),

    strongFitKeywords:
      unique(
        strong.flatMap(
          x =>
            x.keywords ||
            []
        )
      ),

    mediumFitConcepts:
      medium.map(
        x =>
          x.id
      ),

    mediumFitLabels:
      medium.map(
        x =>
          x.label
      ),

    mediumFitKeywords:
      unique(
        medium.flatMap(
          x =>
            x.keywords ||
            []
        )
      ),

    hardExcludeKeywords:
      hardNegatives,

    genericOperationKeywords:
      genericOperations,

    procurementFitLabels:
      procurement.labels,

    fitReasons:
      unique(
        reasons
      )
  };
}


/* =========================================================
   EXECUTION SCORE
========================================================= */

function evaluateExecution(
  item,
  deadline,
  budget
) {

  let score = 0;

  const reasons = [];

  const left =
    daysUntil(
      deadline
    );

  const contract =
    text(
      item.sucsfbidMthdNm ||
      item.cntrctCnclsMthdNm ||
      item.bidMethdNm ||
      item.contractMethod
    );

  const agency =
    text(
      item.dminsttNm ||
      item.demandAgency ||
      item.ntceInsttNm ||
      item.agency
    );

  if (
    budget >=
    300000000
  ) {

    score +=
      25;

    reasons.push(
      "3억원 이상"
    );

  } else if (
    budget >=
    100000000
  ) {

    score +=
      20;

    reasons.push(
      "1억원 이상"
    );

  } else if (
    budget >=
    30000000
  ) {

    score +=
      12;

    reasons.push(
      "3천만원 이상"
    );
  }

  if (
    left >= 7 &&
    left <= 21
  ) {

    score +=
      25;

    reasons.push(
      "검토·제안 준비기간 적정"
    );

  } else if (
    left >= 4 &&
    left <= 30
  ) {

    score +=
      18;

    reasons.push(
      "검토 가능한 마감 일정"
    );

  } else if (
    left >= 0 &&
    left <= 3
  ) {

    score +=
      5;

    reasons.push(
      "마감 임박"
    );
  }

  if (
    contract.includes(
      "협상"
    )
  ) {

    score +=
      25;

    reasons.push(
      "협상에 의한 계약"
    );
  }

  if (
    includesAny(
      agency,
      CULTURE_AGENCY_KEYWORDS
    )
  ) {

    score +=
      10;

    reasons.push(
      "문화·예술·관광·콘텐츠 관련 기관"
    );
  }

  if (
    numeric(
      item.techAbltEvlRt
    ) >=
    80
  ) {

    score +=
      15;

    reasons.push(
      "기술평가 비중 80% 이상"
    );
  }

  return {
    executionScore:
      Math.max(
        0,
        Math.min(
          100,
          score
        )
      ),

    executionReasons:
      unique(
        reasons
      )
  };
}


/* =========================================================
   CATEGORY
========================================================= */

function detectCategory(
  item,
  fit
) {

  const c =
    new Set(
      fit.strongFitConcepts
    );

  const title =
    lower(
      item.bidNtceNm ||
      item.title
    );

  if (
    c.has(
      "media_art"
    ) ||
    c.has(
      "media_facade"
    ) ||
    c.has(
      "immersive"
    )
  ) {
    return {
      category:
        "media_art",

      categoryLabel:
        "미디어아트"
    };
  }

  if (
    c.has(
      "public_art"
    ) ||
    c.has(
      "mural_sculpture"
    )
  ) {
    return {
      category:
        "public_art",

      categoryLabel:
        "공공미술"
    };
  }

  if (
    c.has(
      "exhibition_planning"
    ) ||
    c.has(
      "exhibition_build"
    ) ||
    c.has(
      "exhibition_facility"
    )
  ) {
    return {
      category:
        "exhibition",

      categoryLabel:
        "전시"
    };
  }

  if (
    c.has(
      "space_creative"
    ) ||
    c.has(
      "public_design"
    ) ||
    c.has(
      "visual_design"
    )
  ) {
    return {
      category:
        "design",

      categoryLabel:
        "공간·공공디자인"
    };
  }

  if (
    c.has(
      "popup_build"
    ) ||
    title.includes(
      "팝업"
    )
  ) {
    return {
      category:
        "exhibition",

      categoryLabel:
        "팝업·공간"
    };
  }

  if (
    c.has(
      "artist_collab"
    )
  ) {
    return {
      category:
        "arts_content_support",

      categoryLabel:
        "아티스트 협업"
    };
  }

  if (
    c.has(
      "goods_design"
    )
  ) {
    return {
      category:
        "design",

      categoryLabel:
        "굿즈·IP"
    };
  }

  return {
    category:
      "general",

    categoryLabel:
      "인접 검토"
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


function recommendedAction(
  grade,
  executionScore
) {

  if (
    grade === "S"
  ) {
    return "최우선 검토 — 공고문·과업지시서·참가자격 즉시 확인";
  }

  if (
    grade === "A"
  ) {

    return (
      executionScore >=
      55
    )
      ? "우선 검토 — 수행범위·예산·참가자격 확인"
      : "적합도 높음 — 실행조건 확인 후 지원 여부 결정";
  }

  return "인접 영역 — 과업 범위를 읽고 AXOO 수행 가능 여부 확인";
}


function normalizeItem(raw) {

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
      raw.deadline ||
      raw.deadlineDate
    );

  const posted =
    dateOnly(
      raw.bidNtceDt ||
      raw.publishedDate ||
      raw.postedDate
    );

  const budget =
    numeric(
      raw.asignBdgtAmt ||
      raw.presmptPrce ||
      raw.budgetAmount
    );

  const left =
    daysUntil(
      deadline
    );

  const fit =
    evaluateFit(
      raw
    );

  const execution =
    evaluateExecution(
      raw,
      deadline,
      budget
    );

  const category =
    detectCategory(
      raw,
      fit
    );

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

  const priorityScore =
    Math.round(
      fit.fitScore *
      0.8 +
      execution.executionScore *
      0.2
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
      fit.fitScore,

    fitScore:
      fit.fitScore,

    grade:
      fit.grade,

    executionScore:
      execution.executionScore,

    priorityScore:
      priorityScore,

    category:
      category.category,

    categoryLabel:
      category.categoryLabel,

    matchedCategories: [
      category.category
    ],

    strongFitConcepts:
      fit.strongFitConcepts,

    strongFitLabels:
      fit.strongFitLabels,

    strongFitKeywords:
      fit.strongFitKeywords,

    mediumFitConcepts:
      fit.mediumFitConcepts,

    mediumFitLabels:
      fit.mediumFitLabels,

    mediumFitKeywords:
      fit.mediumFitKeywords,

    matchedKeywords:
      unique([
        ...fit.strongFitKeywords,
        ...fit.mediumFitKeywords
      ]),

    directFitKeywords:
      fit.strongFitKeywords,

    supportFitKeywords:
      fit.mediumFitKeywords,

    hardExcludeKeywords:
      fit.hardExcludeKeywords,

    genericOperationKeywords:
      fit.genericOperationKeywords,

    procurementFitLabels:
      fit.procurementFitLabels,

    budgetAmount:
      budget,

    daysLeft:
      left,

    scoreReasons:
      fit.fitReasons,

    executionReasons:
      execution.executionReasons,

    fitReason:
      fit.fitReasons.join(
        ". "
      ) +
      ". AXOO FIT " +
      fit.fitScore +
      "점 / " +
      fit.grade +
      "등급." +
      (
        execution.executionReasons.length
          ? " 실행조건 " +
            execution.executionScore +
            "점 (" +
            execution.executionReasons.join(
              ", "
            ) +
            ")."
          : ""
      ),

    recommendedAction:
      recommendedAction(
        fit.grade,
        execution.executionScore
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
   MERGE
========================================================= */

function isActive(item) {

  const deadline =
    dateOnly(
      item.deadline ||
      item.bidClseDt ||
      item.opengDt
    );

  return (
    !deadline ||
    daysUntil(
      deadline
    ) >= 0
  );
}


function isVisibleFit(item) {

  return (
    item.grade === "S" ||
    item.grade === "A" ||
    item.grade === "B"
  );
}


function mergeItems(
  existing,
  discovered
) {

  const combined =
    [
      ...existing,
      ...discovered
    ]
      .map(
        item => {

          try {

            return normalizeItem(
              item
            );

          } catch (error) {

            console.warn(
              "[G2B] normalize skip:",
              error.message
            );

            return null;
          }
        }
      )
      .filter(Boolean);

  return dedupeSameProjects(
    collapseNoticeVersions(
      combined
    )
  )

    .filter(
      item =>
        !isCancelledNotice(
          item
        )
    )

    .filter(
      isActive
    )

    .filter(
      isVisibleFit
    )

    .sort(
      (
        a,
        b
      ) => {

        const gradeDiff =
          (
            GRADE_ORDER[
              a.grade
            ] ??
            9
          ) -
          (
            GRADE_ORDER[
              b.grade
            ] ??
            9
          );

        if (
          gradeDiff
        ) {
          return gradeDiff;
        }

        const fitDiff =
          numeric(
            b.fitScore ||
            b.score
          ) -
          numeric(
            a.fitScore ||
            a.score
          );

        if (
          fitDiff
        ) {
          return fitDiff;
        }

        const priorityDiff =
          numeric(
            b.priorityScore
          ) -
          numeric(
            a.priorityScore
          );

        if (
          priorityDiff
        ) {
          return priorityDiff;
        }

        return (
          numeric(
            a.daysLeft ??
            9999
          ) -
          numeric(
            b.daysLeft ??
            9999
          )
        );
      }
    )

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
    "Scoring: " +
    SCORING_VERSION
  );

  console.log(
    "등급 기준: AXOO FIT only / 실행조건 별도"
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
    B: 0
  };

  output.forEach(
    item => {

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
    "최종 표시 후보:",
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
    "C: 저장 안 함"
  );

  console.log(
    "------------------------------------"
  );

  console.log(
    "✅ G2B FIT v5 수집 완료"
  );

  console.log(
    "===================================="
  );
}


main()
  .catch(
    error => {

      console.error(
        "[AXOO G2B COLLECTOR]",
        error
      );

      process.exitCode =
        1;
    }
  );
