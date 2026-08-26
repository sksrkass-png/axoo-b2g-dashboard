const fs = require("fs");
const path = require("path");


/* =========================================================
   CONFIG
========================================================= */

const G2B_FILE = path.join(
  process.cwd(),
  "data",
  "b2g_opportunities.json"
);

const PRIORITY_FILE = path.join(
  process.cwd(),
  "data",
  "priority_projects.json"
);

const BUILDER_VERSION =
  "priority_from_g2b_v1.0";


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

  if (!raw.trim()) {
    return fallback;
  }

  return JSON.parse(raw);
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


function text(value) {
  return String(
    value == null
      ? ""
      : value
  )
    .replace(/\s+/g, " ")
    .trim();
}


function number(value) {
  const result =
    Number(
      value || 0
    );

  return Number.isFinite(
    result
  )
    ? result
    : 0;
}


function unique(values) {
  return [
    ...new Set(
      values.filter(Boolean)
    )
  ];
}


/* =========================================================
   EXISTING PRIORITY DATA
========================================================= */

/*
  기존 priority_projects.json 안에는

  - 나라장터 데이터
  - 별도 지원사업 데이터

  가 함께 존재한다.

  나라장터 데이터만 새 G2B 결과로 교체하고
  지원사업 등 다른 데이터는 그대로 유지한다.
*/

function isG2bItem(item) {
  const sourceType =
    text(
      item.sourceType
    ).toLowerCase();

  const sourceId =
    text(
      item.collectionSourceId
    );

  if (
    sourceId ===
    "g2b_bid_public_info_servc"
  ) {
    return true;
  }

  if (
    sourceType.includes(
      "나라장터"
    )
  ) {
    return true;
  }

  if (
    text(
      item.bidNtceNo
    )
  ) {
    return true;
  }

  return false;
}


/* =========================================================
   PRIORITY CATEGORY
========================================================= */

function getSearchText(item) {
  return [
    item.title,
    item.bidNtceNm,

    item.category,
    item.categoryLabel,

    ...(Array.isArray(
      item.matchedKeywords
    )
      ? item.matchedKeywords
      : []),

    ...(Array.isArray(
      item.directFitKeywords
    )
      ? item.directFitKeywords
      : [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}


function detectPriorityCategory(item) {
  const category =
    text(
      item.category
    );

  const search =
    getSearchText(item);


  /*
    벽화 / 공공미술 / 조형물
  */

  const muralWords = [
    "벽화",
    "공공미술",
    "공공 미술",
    "미술작품",
    "미술 작품",
    "조형물",
    "상징물",
    "아트월"
  ];

  const isMural =
    category ===
      "public_art" ||
    muralWords.some(
      function (keyword) {
        return search.includes(
          keyword
        );
      }
    );


  if (isMural) {
    return {
      key:
        "mural_sculpture",

      label:
        "벽화 & 조형물",

      rank:
        1
    };
  }


  /*
    전시 / 미디어아트 / 콘텐츠 공간
  */

  const exhibitionWords = [
    "미디어아트",
    "미디어 아트",

    "미디어파사드",
    "미디어 파사드",

    "전시기획",
    "전시 기획",

    "전시운영",
    "전시 운영",

    "전시연출",
    "전시 연출",

    "전시관",
    "홍보관",

    "실감콘텐츠",
    "실감 콘텐츠",

    "인터랙티브"
  ];

  const isExhibition =
    category ===
      "media_art" ||
    category ===
      "exhibition" ||
    exhibitionWords.some(
      function (keyword) {
        return search.includes(
          keyword
        );
      }
    );


  if (isExhibition) {
    return {
      key:
        "exhibition_content",

      label:
        "전시 콘텐츠 기획 운영",

      rank:
        2
    };
  }


  /*
    나머지 AXOO 적합 공고
  */

  return {
    key:
      "other",

    label:
      "기타 AXOO 핏",

    rank:
      3
  };
}


/* =========================================================
   URL
========================================================= */

function getSourceUrl(item) {
  const candidates = [
    item.sourceUrl,
    item.bidNtceDtlUrl,
    item.originalUrl,
    item.url,
    item.ntceSpecDocUrl1
  ];

  return (
    candidates.find(
      function (value) {
        const url =
          text(value);

        return (
          url.startsWith(
            "https://"
          ) ||
          url.startsWith(
            "http://"
          )
        );
      }
    ) ||
    ""
  );
}


function getDocumentUrl(item) {
  const candidates = [
    item.ntceSpecDocUrl1,
    item.ntceSpecDocUrl2,
    item.ntceSpecDocUrl3,
    item.sourceUrl
  ];

  return (
    candidates.find(
      function (value) {
        const url =
          text(value);

        return (
          url.startsWith(
            "https://"
          ) ||
          url.startsWith(
            "http://"
          )
        );
      }
    ) ||
    ""
  );
}


/* =========================================================
   MAP G2B → PRIORITY
========================================================= */

function mapG2bItem(item) {
  const priority =
    detectPriorityCategory(
      item
    );

  const matched =
    unique([
      ...(Array.isArray(
        item.directFitKeywords
      )
        ? item.directFitKeywords
        : []),

      ...(Array.isArray(
        item.supportFitKeywords
      )
        ? item.supportFitKeywords
        : []),

      ...(Array.isArray(
        item.matchedKeywords
      )
        ? item.matchedKeywords
        : [])
    ]);


  const scoreReasons =
    Array.isArray(
      item.scoreReasons
    )
      ? item.scoreReasons
      : [];


  const title =
    text(
      item.title ||
      item.bidNtceNm
    );


  const agency =
    text(
      item.demandAgency ||
      item.dminsttNm ||
      item.agency ||
      item.ntceInsttNm ||
      item.noticeAgency
    );


  const noticeAgency =
    text(
      item.noticeAgency ||
      item.ntceInsttNm ||
      item.agency
    );


  const id =
    text(
      item.bidNtceNo ||
      item.noticeNo ||
      item.id
    );


  const amount =
    number(
      item.budgetAmount ||
      item.asignBdgtAmt ||
      item.presmptPrce ||
      item.amount
    );


  const deadline =
    text(
      item.deadline ||
      item.deadlineDate ||
      item.bidClseDt ||
      item.opengDt
    );


  const publishedDate =
    text(
      item.publishedDate ||
      item.postedDate ||
      item.bidNtceDt
    );


  const sourceUrl =
    getSourceUrl(
      item
    );


  const documentUrl =
    getDocumentUrl(
      item
    );


  return {
    id:
      id,

    bidNtceNo:
      id,

    sourceType:
      "나라장터 입찰공고",

    title:
      title,

    bidNtceNm:
      title,

    agency:
      agency,

    organization:
      agency,

    noticeAgency:
      noticeAgency,

    demandAgency:
      agency,

    amount:
      amount,

    budgetAmount:
      amount,

    deadline:
      deadline,

    deadlineDate:
      deadline,

    publishedDate:
      publishedDate,

    sourceUrl:
      sourceUrl,

    documentUrl:
      documentUrl,

    category:
      item.category ||
      "general",

    categoryLabel:
      item.categoryLabel ||
      "기타",

    priorityCategory:
      priority.key,

    priorityCategoryLabel:
      priority.label,

    priorityRank:
      priority.rank,

    matchedPriorityKeywords:
      matched,

    matchedKeywords:
      matched,

    isPriority:
      true,

    isExcludedFromPriority:
      false,

    exclusionReason:
      "",

    grade:
      text(
        item.grade
      ) ||
      "C",

    score:
      number(
        item.score
      ),

    gradeReason:
      text(
        item.fitReason
      ) ||
      scoreReasons.join(
        " · "
      ),

    nextAction:
      text(
        item.recommendedAction ||
        item.nextAction
      ) ||
      "공고문 및 지원 조건 확인",

    recommendedAction:
      text(
        item.recommendedAction ||
        item.nextAction
      ) ||
      "공고문 및 지원 조건 확인",

    contractMethod:
      text(
        item.contractMethod ||
        item.sucsfbidMthdNm ||
        item.cntrctCnclsMthdNm
      ),

    searchText:
      [
        title,
        agency,
        noticeAgency,
        priority.label,
        item.categoryLabel,
        ...matched
      ]
        .filter(Boolean)
        .join(" "),

    collectionSourceId:
      "g2b_bid_public_info_servc",

    collectionVersion:
      item.collectionVersion ||
      "",

    scoringVersion:
      item.scoringVersion ||
      "",

    priorityVersion:
      BUILDER_VERSION
  };
}


/* =========================================================
   SORT
========================================================= */

function gradeRank(grade) {
  const order = {
    S: 0,
    A: 1,
    B: 2,
    C: 3
  };

  return (
    order[
      text(grade)
        .toUpperCase()
    ] ??
    9
  );
}


function sortG2b(a, b) {
  const categoryDiff =
    number(
      a.priorityRank
    ) -
    number(
      b.priorityRank
    );

  if (
    categoryDiff !== 0
  ) {
    return categoryDiff;
  }


  const gradeDiff =
    gradeRank(
      a.grade
    ) -
    gradeRank(
      b.grade
    );

  if (
    gradeDiff !== 0
  ) {
    return gradeDiff;
  }


  const scoreDiff =
    number(
      b.score
    ) -
    number(
      a.score
    );

  if (
    scoreDiff !== 0
  ) {
    return scoreDiff;
  }


  return text(
    a.deadline
  ).localeCompare(
    text(
      b.deadline
    )
  );
}


/* =========================================================
   MAIN
========================================================= */

function main() {
  const opportunities =
    readJson(
      G2B_FILE,
      []
    );

  if (
    !Array.isArray(
      opportunities
    )
  ) {
    throw new Error(
      "data/b2g_opportunities.json 은 배열이어야 합니다."
    );
  }


  const existing =
    readJson(
      PRIORITY_FILE,
      []
    );

  if (
    !Array.isArray(
      existing
    )
  ) {
    throw new Error(
      "data/priority_projects.json 은 배열이어야 합니다."
    );
  }


  /*
    기존 지원사업 / 외부 데이터 보존
  */

  const preserved =
    existing.filter(
      function (item) {
        return !isG2bItem(
          item
        );
      }
    );


  /*
    최신 G2B 데이터 변환
  */

  const latestG2b =
    opportunities
      .map(
        mapG2bItem
      )
      .sort(
        sortG2b
      );


  const output = [
    ...preserved,
    ...latestG2b
  ];


  writeJson(
    PRIORITY_FILE,
    output
  );


  const counts = {
    mural_sculpture: 0,
    exhibition_content: 0,
    other: 0
  };


  latestG2b.forEach(
    function (item) {
      if (
        counts[
          item.priorityCategory
        ] !== undefined
      ) {
        counts[
          item.priorityCategory
        ] += 1;
      }
    }
  );


  console.log(
    "===================================="
  );

  console.log(
    "AXOO PRIORITY BUILDER"
  );

  console.log(
    BUILDER_VERSION
  );

  console.log(
    "------------------------------------"
  );

  console.log(
    "보존된 비-G2B 데이터:",
    preserved.length
  );

  console.log(
    "최신 G2B 후보:",
    latestG2b.length
  );

  console.log(
    "벽화 & 조형물:",
    counts.mural_sculpture
  );

  console.log(
    "전시 콘텐츠:",
    counts.exhibition_content
  );

  console.log(
    "기타 AXOO 핏:",
    counts.other
  );

  console.log(
    "최종 priority_projects:",
    output.length
  );

  console.log(
    "------------------------------------"
  );

  console.log(
    "✅ priority_projects.json 갱신 완료"
  );

  console.log(
    "===================================="
  );
}


main();
