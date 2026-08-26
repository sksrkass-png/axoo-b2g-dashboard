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
  "1.2.0";

const SCORING_VERSION =
  "axoo_bid_fit_v6";


const NUM_OF_ROWS =
  999;

const LOOKBACK_DAYS =
  2;

const MAX_PAGES =
  20;

const FETCH_TIMEOUT_MS =
  25000;

const MAX_FETCH_ATTEMPTS =
  3;

const MAX_OUTPUT_ITEMS =
  60;


/*
  명시된 사업비가 이 금액보다 작으면
  후보 단계에서 바로 제외.
*/

const MIN_PROJECT_BUDGET =
  50000000;


const GRADE_ORDER = {
  S: 0,
  A: 1,
  B: 2,
  C: 3
};


/* =========================================================
   AXOO FIT v6

   핵심 원칙

   1. HARD FILTER를 먼저 통과해야 한다.
   2. 시각예술 관련성이 없는 사업은 제외한다.
   3. 사업비 5천만원 미만은 제외한다.
   4. 행사대행 / 시상식 / 팝업운영 등은 제외한다.
   5. 전시관·홍보관·부스 제작설치는 제외한다.
   6. 남은 사업만 S/A/B 적합도 평가.
========================================================= */


/* =========================================================
   VISUAL ART GATE

   아래 키워드 중 최소 1개가 제목에 있어야
   AXOO 후보 심사로 진입할 수 있다.

   단순 "콘텐츠", "행사", "디자인", "전시"만으로는
   통과시키지 않는다.
========================================================= */

const VISUAL_ART_KEYWORDS = [

  "시각예술",
  "시각 예술",

  "미디어아트",
  "미디어 아트",

  "미디어파사드",
  "미디어 파사드",

  "공공미술",
  "공공 미술",

  "미술작품",
  "미술 작품",

  "미술전시",
  "미술 전시",

  "예술전시",
  "예술 전시",

  "아트프로젝트",
  "아트 프로젝트",

  "아트전시",
  "아트 전시",

  "아티스트 협업",
  "작가 협업",
  "예술가 협업",

  "조형예술",
  "조형 예술",

  "조형물",
  "상징조형물",

  "벽화",
  "아트월",

  "전시기획",
  "전시 기획",

  "기획전시",
  "기획 전시",

  "전시연출",
  "전시 연출",

  "전시콘텐츠",
  "전시 콘텐츠",

  "전시 조성",
  "전시공간 조성",
  "전시 공간 조성",

  "공간연출",
  "공간 연출",

  "공간브랜딩",
  "공간 브랜딩",

  "공공디자인",
  "공공 디자인",

  "경관디자인",
  "경관 디자인",

  "환경디자인",
  "환경 디자인",

  "실감콘텐츠",
  "실감 콘텐츠",

  "인터랙티브 아트",
  "인터랙티브아트",

  "xr 콘텐츠",
  "ar 콘텐츠",
  "vr 콘텐츠"
];


/* =========================================================
   STRONG FIT CONCEPTS
========================================================= */

const STRONG_CONCEPTS = [

  {
    id: "media_art",
    label: "미디어아트",
    weight: 65,

    keywords: [
      "미디어아트",
      "미디어 아트"
    ]
  },

  {
    id: "media_facade",
    label: "미디어파사드",
    weight: 65,

    keywords: [
      "미디어파사드",
      "미디어 파사드"
    ]
  },

  {
    id: "public_art",
    label: "공공미술·미술작품",
    weight: 65,

    keywords: [
      "공공미술",
      "공공 미술",

      "미술작품",
      "미술 작품"
    ]
  },

  {
    id: "mural_sculpture",
    label: "벽화·조형물",
    weight: 60,

    keywords: [
      "벽화",
      "조형물",
      "상징조형물",
      "아트월"
    ]
  },

  {
    id: "exhibition_planning",
    label: "전시기획·전시연출",
    weight: 60,

    keywords: [
      "전시기획",
      "전시 기획",

      "기획전시",
      "기획 전시",

      "전시연출",
      "전시 연출"
    ]
  },

  {
    id: "exhibition_content",
    label: "전시 콘텐츠",
    weight: 60,

    keywords: [
      "전시콘텐츠",
      "전시 콘텐츠"
    ]
  },

  {
    id: "exhibition_build",
    label: "전시 조성·제작",
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
    label: "공간연출·공간브랜딩",
    weight: 60,

    keywords: [
      "공간연출",
      "공간 연출",

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

      "인터랙티브 아트",
      "인터랙티브아트",

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
    id: "artist_collaboration",
    label: "아티스트 협업",
    weight: 55,

    keywords: [
      "아티스트 협업",
      "작가 협업",
      "예술가 협업"
    ]
  }
];


/* =========================================================
   MEDIUM FIT
========================================================= */

const MEDIUM_CONCEPTS = [

  {
    id: "generic_exhibition",
    label: "전시",
    weight: 8,

    keywords: [
      "전시"
    ]
  },

  {
    id: "branding",
    label: "브랜딩",
    weight: 12,

    keywords: [
      "브랜딩",
      "브랜드 캠페인"
    ]
  },

  {
    id: "content_production",
    label: "콘텐츠 제작",
    weight: 10,

    keywords: [
      "콘텐츠 제작",
      "콘텐츠제작"
    ]
  },

  {
    id: "video_content",
    label: "영상 콘텐츠",
    weight: 8,

    keywords: [
      "영상콘텐츠",
      "영상 콘텐츠",

      "영상 제작",
      "영상제작"
    ]
  },

  {
    id: "festival",
    label: "페스티벌",
    weight: 5,

    keywords: [
      "페스티벌"
    ]
  }
];


/* =========================================================
   FIT PENALTY

   HARD FILTER까지는 아니지만
   사업의 본질이 기술/연구 쪽이면 감점한다.

   중요:
   "네트워크" 단독 키워드는 사용하지 않는다.

   예:
   "예술마실섬 네트워크 구축사업 미디어파사드 콘텐츠"
   같은 정상 사업을 잘못 죽이지 않기 위함.
========================================================= */

const HARD_NEGATIVE_KEYWORDS = [

  "연구용역",
  "연구 용역",

  "학술연구",
  "학술 연구",

  "실태조사",
  "실태 조사",

  "타당성 조사",

  "정보시스템",
  "정보 시스템",

  "시스템 유지보수",
  "시스템유지보수",

  "소프트웨어",

  "데이터베이스",

  "db 구축",
  "db구축",

  "전산",

  "서버",

  "보안",

  "감리",

  "안전진단",
  "정밀진단",

  "측량",

  "보험",

  "청소",

  "경비",

  "폐기물",

  "회계",

  "법률"
];


/* =========================================================
   CULTURE AGENCY

   등급을 올리는 용도가 아니라
   executionScore 참고값으로만 사용.
========================================================= */

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
   HARD FILTER STATISTICS
========================================================= */

function createFilterStats() {

  return {

    totalChecked: 0,

    passed: 0,

    budgetUnder50m: 0,

    eventAgency: 0,

    awardCeremony: 0,

    popupOperation: 0,

    experienceCenterBuild: 0,

    exhibitionFacilityBuild: 0,

    noVisualArt: 0
  };
}


/* =========================================================
   BASIC
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


  return raw.trim()
    ? JSON.parse(
        raw
      )
    : fallback;
}


function writeJson(
  filePath,
  value
) {

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


function text(
  value
) {

  return String(
    value == null
      ? ""
      : value
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function lower(
  value
) {

  return text(
    value
  ).toLowerCase();
}


function numeric(
  value
) {

  const n =
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
    n
  )
    ? n
    : 0;
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


function includesAny(
  source,
  keywords
) {

  const haystack =
    lower(
      source
    );


  return keywords.some(
    keyword =>
      haystack.includes(
        lower(
          keyword
        )
      )
  );
}


function matchedKeywords(
  source,
  keywords
) {

  const haystack =
    lower(
      source
    );


  return unique(
    keywords.filter(
      keyword =>
        haystack.includes(
          lower(
            keyword
          )
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


function shiftKoreaDate(
  days
) {

  const [
    year,
    month,
    day
  ] =
    koreaDateString()
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

  const match =
    text(
      value
    )
      .match(
        /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/
      );


  if (
    !match
  ) {

    return "";
  }


  return [

    match[1],

    String(
      match[2]
    )
      .padStart(
        2,
        "0"
      ),

    String(
      match[3]
    )
      .padStart(
        2,
        "0"
      )

  ].join("-");
}


function daysUntil(
  value
) {

  const target =
    dateOnly(
      value
    );


  if (
    !target
  ) {

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


function timestampValue(
  value
) {

  const raw =
    text(
      value
    );


  if (
    !raw
  ) {

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
   PROJECT BUDGET

   asignBdgtAmt가 "0"인 경우에도
   presmptPrce가 실제 금액일 수 있으므로
   유효한 값 중 가장 큰 금액을 사용한다.
========================================================= */

function getProjectBudget(
  item
) {

  const candidates = [

    numeric(
      item.asignBdgtAmt
    ),

    numeric(
      item.presmptPrce
    ),

    numeric(
      item.budgetAmount
    ),

    numeric(
      item.amount
    )
  ];


  const valid =
    candidates.filter(
      amount =>
        amount > 0
    );


  if (
    valid.length === 0
  ) {

    return 0;
  }


  return Math.max(
    ...valid
  );
}


/* =========================================================
   FETCH
========================================================= */

function sleep(
  ms
) {

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

      } catch (
        error
      ) {

        throw new Error(
          "JSON 응답이 아닙니다."
        );
      }


      const header =
        data
          ?.response
          ?.header;


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

function extractItems(
  data
) {

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


function extractTotalCount(
  data
) {

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

function isCancelledNotice(
  item
) {

  return includesAny(
    [

      item?.ntceKindNm,

      item?.chgNtceRsn,

      item?.bidNtceNm,

      item?.title

    ]
      .filter(
        Boolean
      )
      .join(" "),

    [
      "취소공고",
      "취소 공고"
    ]
  );
}


function noticeOrder(
  item
) {

  return numeric(
    item?.bidNtceOrd
  );
}


function noticeDateValue(
  item
) {

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


  const noNumber =
    [];


  items.forEach(
    item => {

      const noticeNo =
        text(
          item.bidNtceNo ||
          item.noticeNo
        );


      if (
        !noticeNo
      ) {

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


  const output =
    [];


  groups.forEach(
    group => {

      group.sort(
        (
          a,
          b
        ) =>

          noticeOrder(
            b
          ) -
          noticeOrder(
            a
          ) ||

          noticeDateValue(
            b
          ) -
          noticeDateValue(
            a
          )
      );


      const latest =
        group[0];


      if (
        !isCancelledNotice(
          latest
        )
      ) {

        output.push(
          latest
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

  return text(
    value
  )

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


      if (
        !titleKey
      ) {

        return;
      }


      const agencyKey =
        lower(
          item.dminsttNm ||
          item.demandAgency ||
          item.ntceInsttNm ||
          item.agency
        );


      const key =
        titleKey +
        "|" +
        agencyKey;


      const previous =
        map.get(
          key
        );


      if (
        !previous
      ) {

        map.set(
          key,
          item
        );

        return;
      }


      const previousDate =
        noticeDateValue(
          previous
        );


      const currentDate =
        noticeDateValue(
          item
        );


      if (
        currentDate >
        previousDate
      ) {

        map.set(
          key,
          item
        );

        return;
      }


      if (
        currentDate ===
          previousDate &&
        noticeOrder(
          item
        ) >
        noticeOrder(
          previous
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


  const all =
    [];


  let page =
    1;


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
   HARD FILTER
========================================================= */

function isEventAgencyProject(
  title
) {

  return includesAny(
    title,

    [
      "행사 대행",
      "행사대행",

      "행사 운영 대행",
      "행사운영 대행",

      "축제 대행",
      "축제대행",

      "이벤트 대행",
      "이벤트대행"
    ]
  );
}


function isAwardCeremonyProject(
  title
) {

  return includesAny(
    title,

    [
      "시상식",
      "시상 행사",
      "시상행사",
      "수상식"
    ]
  );
}


/*
  팝업스토어에 "운영"이 포함되면 제외.

  따라서:
  팝업스토어 조성 및 운영 → 제외
  팝업스토어 운영 → 제외

  반면:
  아트 팝업 공간 디자인 → 운영이 없으면
  다른 조건에 따라 검토 가능.
*/

function isPopupOperationProject(
  title
) {

  const popup =
    includesAny(
      title,

      [
        "팝업스토어",
        "팝업 스토어",
        "팝업"
      ]
    );


  if (
    !popup
  ) {

    return false;
  }


  return includesAny(
    title,

    [
      "운영",
      "운영대행",
      "운영 대행",

      "유치",

      "판매운영",
      "판매 운영",

      "매장운영",
      "매장 운영"
    ]
  );
}


/*
  체험관 구축/조성/설치/제작은 제외.
*/

function isExperienceCenterBuild(
  title
) {

  const facility =
    includesAny(
      title,

      [
        "체험관",

        "체험센터",
        "체험 센터"
      ]
    );


  if (
    !facility
  ) {

    return false;
  }


  return includesAny(
    title,

    [
      "구축",
      "조성",
      "설치",
      "제작",
      "시공"
    ]
  );
}


/*
  전시관·홍보관·전시부스·단체관 등
  하드웨어 디자인/설치형 사업 제외.
*/

function isExhibitionFacilityBuild(
  title
) {

  const facility =
    includesAny(
      title,

      [
        "전시관",
        "홍보관",

        "전시부스",
        "전시 부스",

        "홍보부스",
        "홍보 부스",

        "박람회부스",
        "박람회 부스",

        "단체관"
      ]
    );


  if (
    !facility
  ) {

    return false;
  }


  return includesAny(
    title,

    [
      "디자인",
      "제작",
      "설치",
      "시공",
      "구축",
      "조성"
    ]
  );
}


function evaluateHardFilter(
  item
) {

  const title =
    text(
      item.bidNtceNm ||
      item.title
    );


  const budget =
    getProjectBudget(
      item
    );


  /*
    명시 금액 5천만원 미만 → 제외

    budget=0은 API 미기재 가능성이 있으므로
    일단 다른 조건을 계속 심사.
  */

  if (
    budget > 0 &&
    budget <
      MIN_PROJECT_BUDGET
  ) {

    return {

      pass: false,

      code:
        "budget_under_50m",

      reason:
        "사업비 5천만원 미만",

      visualArtKeywords:
        []
    };
  }


  if (
    isEventAgencyProject(
      title
    )
  ) {

    return {

      pass: false,

      code:
        "event_agency",

      reason:
        "행사 대행 용역",

      visualArtKeywords:
        []
    };
  }


  if (
    isAwardCeremonyProject(
      title
    )
  ) {

    return {

      pass: false,

      code:
        "award_ceremony",

      reason:
        "시상식·시상행사",

      visualArtKeywords:
        []
    };
  }


  if (
    isPopupOperationProject(
      title
    )
  ) {

    return {

      pass: false,

      code:
        "popup_operation",

      reason:
        "팝업스토어 운영 사업",

      visualArtKeywords:
        []
    };
  }


  if (
    isExperienceCenterBuild(
      title
    )
  ) {

    return {

      pass: false,

      code:
        "experience_center_build",

      reason:
        "체험관 구축·조성 사업",

      visualArtKeywords:
        []
    };
  }


  if (
    isExhibitionFacilityBuild(
      title
    )
  ) {

    return {

      pass: false,

      code:
        "exhibition_facility_build",

      reason:
        "전시관·홍보관·부스 디자인/제작/설치 사업",

      visualArtKeywords:
        []
    };
  }


  const visualArtKeywords =
    matchedKeywords(
      title,
      VISUAL_ART_KEYWORDS
    );


  if (
    visualArtKeywords.length ===
      0
  ) {

    return {

      pass: false,

      code:
        "no_visual_art",

      reason:
        "시각예술 직접 관련성 없음",

      visualArtKeywords:
        []
    };
  }


  return {

    pass: true,

    code:
      "pass",

    reason:
      "",

    visualArtKeywords:
      visualArtKeywords
  };
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


      if (
        keywords.length ===
          0
      ) {

        return [];
      }


      return [

        {
          ...concept,
          keywords
        }
      ];
    }
  );
}


function getProcurementFit(
  item
) {

  const source =
    [

      item.pubPrcrmntLrgClsfcNm,

      item.pubPrcrmntMidClsfcNm,

      item.pubPrcrmntClsfcNm

    ]
      .filter(
        Boolean
      )
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

      score: 12,

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

      score: 8,

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
        "조형"
      ]
    )
  ) {

    return {

      score: 8,

      labels: [
        "미술·조형 관련 조달 분류"
      ]
    };
  }


  return {

    score: 0,

    labels: []
  };
}


function evaluateFit(
  item
) {

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


  const medium =
    matchConcepts(
      title,
      MEDIUM_CONCEPTS
    );


  const negatives =
    matchedKeywords(
      title,
      HARD_NEGATIVE_KEYWORDS
    );


  const procurement =
    getProcurementFit(
      item
    );


  let fitScore =
    0;


  const reasons =
    [];


  /*
    핵심 수행영역
  */

  if (
    strong.length
  ) {

    const weights =
      strong
        .map(
          concept =>
            concept.weight
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


    /*
      두 번째 핵심 영역이 있으면
      복합 프로젝트로 추가 인정.
    */

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
          concept =>
            concept.label
        )
        .join(", ")
    );
  }


  /*
    보조 키워드는 영향 작게.
  */

  if (
    medium.length
  ) {

    fitScore +=
      Math.min(
        15,

        medium.reduce(
          (
            sum,
            concept
          ) =>
            sum +
            concept.weight,

          0
        )
      );


    reasons.push(
      "보조 적합요소: " +
      medium
        .map(
          concept =>
            concept.label
        )
        .join(", ")
    );
  }


  /*
    나라장터 자체 분류는
    보조 증거로만 활용.
  */

  if (
    procurement.score
  ) {

    fitScore +=
      procurement.score;


    reasons.push(
      "조달 분류: " +
      procurement.labels.join(
        ", "
      )
    );
  }


  /*
    연구·시스템 등 비핵심 성격 감점.
  */

  if (
    negatives.length
  ) {

    fitScore -=
      25;


    reasons.push(
      "비핵심 용역 성격 감점: " +
      negatives.join(
        ", "
      )
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


  let grade =
    "C";


  /*
    S:
    핵심 수행영역 2개 이상 +
    FIT 85 이상
  */

  if (
    fitScore >= 85 &&
    strong.length >= 2 &&
    negatives.length === 0
  ) {

    grade =
      "S";


  /*
    A:
    핵심 수행영역 최소 1개 +
    FIT 60 이상
  */

  } else if (
    fitScore >= 60 &&
    strong.length >= 1 &&
    negatives.length === 0
  ) {

    grade =
      "A";


  /*
    B:
    시각예술 HARD FILTER는 통과했지만
    수행범위 추가 확인 필요.
  */

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
        concept =>
          concept.id
      ),

    strongFitLabels:
      strong.map(
        concept =>
          concept.label
      ),

    strongFitKeywords:
      unique(
        strong.flatMap(
          concept =>
            concept.keywords ||
            []
        )
      ),

    mediumFitConcepts:
      medium.map(
        concept =>
          concept.id
      ),

    mediumFitLabels:
      medium.map(
        concept =>
          concept.label
      ),

    mediumFitKeywords:
      unique(
        medium.flatMap(
          concept =>
            concept.keywords ||
            []
        )
      ),

    hardExcludeKeywords:
      negatives,

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

   중요:
   executionScore는 S/A/B 등급을 결정하지 않는다.

   예산 / 마감 / 협상계약 등은
   같은 FIT 사업 중 먼저 볼 순서를 정하는 용도.
========================================================= */

function evaluateExecution(
  item,
  deadline,
  budget
) {

  let score =
    0;


  const reasons =
    [];


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
    MIN_PROJECT_BUDGET
  ) {

    score +=
      12;

    reasons.push(
      "5천만원 이상"
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

  const concepts =
    new Set(
      fit.strongFitConcepts
    );


  if (
    concepts.has(
      "media_art"
    ) ||
    concepts.has(
      "media_facade"
    ) ||
    concepts.has(
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
    concepts.has(
      "public_art"
    ) ||
    concepts.has(
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
    concepts.has(
      "exhibition_planning"
    ) ||
    concepts.has(
      "exhibition_content"
    ) ||
    concepts.has(
      "exhibition_build"
    )
  ) {

    return {

      category:
        "exhibition",

      categoryLabel:
        "전시 콘텐츠"
    };
  }


  if (
    concepts.has(
      "space_creative"
    ) ||
    concepts.has(
      "public_design"
    ) ||
    concepts.has(
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
    concepts.has(
      "artist_collaboration"
    )
  ) {

    return {

      category:
        "arts_content_support",

      categoryLabel:
        "아티스트 협업"
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
    MIN_PROJECT_BUDGET
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

    return executionScore >= 55

      ? "우선 검토 — 수행범위·예산·참가자격 확인"

      : "AXOO 적합도 높음 — 과업지시서 확인 후 지원 판단";
  }


  return "시각예술 관련 인접 사업 — 과업 범위 확인";
}


function registerFilterFailure(
  stats,
  code
) {

  if (
    !stats
  ) {

    return;
  }


  if (
    code ===
    "budget_under_50m"
  ) {

    stats.budgetUnder50m +=
      1;


  } else if (
    code ===
    "event_agency"
  ) {

    stats.eventAgency +=
      1;


  } else if (
    code ===
    "award_ceremony"
  ) {

    stats.awardCeremony +=
      1;


  } else if (
    code ===
    "popup_operation"
  ) {

    stats.popupOperation +=
      1;


  } else if (
    code ===
    "experience_center_build"
  ) {

    stats.experienceCenterBuild +=
      1;


  } else if (
    code ===
    "exhibition_facility_build"
  ) {

    stats.exhibitionFacilityBuild +=
      1;


  } else if (
    code ===
    "no_visual_art"
  ) {

    stats.noVisualArt +=
      1;
  }
}


function normalizeItem(
  raw,
  filterStats
) {

  if (
    filterStats
  ) {

    filterStats.totalChecked +=
      1;
  }


  const hardFilter =
    evaluateHardFilter(
      raw
    );


  if (
    !hardFilter.pass
  ) {

    registerFilterFailure(
      filterStats,
      hardFilter.code
    );


    return null;
  }


  if (
    filterStats
  ) {

    filterStats.passed +=
      1;
  }


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
    getProjectBudget(
      raw
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


    budgetAmount:
      budget,


    daysLeft:
      left,


    /*
      S/A/B는 FIT 점수 기준.
    */

    score:
      fit.fitScore,


    fitScore:
      fit.fitScore,


    grade:
      fit.grade,


    /*
      실행조건 별도.
    */

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


    /*
      HARD FILTER 통과 근거
    */

    visualArtKeywords:
      hardFilter.visualArtKeywords,


    hardFilterPassed:
      true,


    hardFilterVersion:
      "axoo_hard_filter_v1",


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


    procurementFitLabels:
      fit.procurementFitLabels,


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

function isActive(
  item
) {

  const deadline =
    dateOnly(
      item.deadline ||
      item.bidClseDt ||
      item.opengDt
    );


  if (
    !deadline
  ) {

    return true;
  }


  return (
    daysUntil(
      deadline
    ) >= 0
  );
}


function isVisibleFit(
  item
) {

  return (
    item.grade === "S" ||
    item.grade === "A" ||
    item.grade === "B"
  );
}


function mergeItems(
  existing,
  discovered,
  filterStats
) {

  /*
    먼저 변경/취소/중복을 정리하고,
    그 다음 HARD FILTER를 적용.

    이렇게 해야 같은 공고의 여러 차수 때문에
    제외 통계가 부풀지 않는다.
  */

  const combined =
    dedupeSameProjects(
      collapseNoticeVersions(
        [
          ...existing,
          ...discovered
        ]
      )
    );


  return combined

    .map(
      item => {

        try {

          return normalizeItem(
            item,
            filterStats
          );

        } catch (
          error
        ) {

          console.warn(
            "[G2B] normalize skip:",
            error.message
          );


          return null;
        }
      }
    )

    .filter(
      Boolean
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
          gradeDiff !==
          0
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
          fitDiff !==
          0
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
          priorityDiff !==
          0
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
    "HARD FILTER: visual art + 50M+"
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


  const discovered =
    await collectRecentNotices();


  const filterStats =
    createFilterStats();


  const output =
    mergeItems(
      existing,
      discovered,
      filterStats
    );


  writeJson(
    DATA_FILE,
    output
  );


  updateDashboardMeta(
    output
  );


  const grades = {

    S: 0,
    A: 0,
    B: 0
  };


  output.forEach(
    item => {

      if (
        grades[
          item.grade
        ] !== undefined
      ) {

        grades[
          item.grade
        ] += 1;
      }
    }
  );


  console.log(
    ""
  );


  console.log(
    "========== HARD FILTER =========="
  );


  console.log(
    "심사 대상:",
    filterStats.totalChecked
  );


  console.log(
    "HARD FILTER 통과:",
    filterStats.passed
  );


  console.log(
    "5천만원 미만 제외:",
    filterStats.budgetUnder50m
  );


  console.log(
    "행사 대행 제외:",
    filterStats.eventAgency
  );


  console.log(
    "시상식 제외:",
    filterStats.awardCeremony
  );


  console.log(
    "팝업 운영 제외:",
    filterStats.popupOperation
  );


  console.log(
    "체험관 구축 제외:",
    filterStats.experienceCenterBuild
  );


  console.log(
    "전시관/부스 설치 제외:",
    filterStats.exhibitionFacilityBuild
  );


  console.log(
    "시각예술 관련 없음 제외:",
    filterStats.noVisualArt
  );


  console.log(
    "================================="
  );


  console.log(
    ""
  );


  console.log(
    "========== FINAL RESULT ========="
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
    grades.S
  );


  console.log(
    "A:",
    grades.A
  );


  console.log(
    "B:",
    grades.B
  );


  console.log(
    "C: 저장 안 함"
  );


  console.log(
    "================================="
  );


  console.log(
    "✅ G2B FIT v6 수집 완료"
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
