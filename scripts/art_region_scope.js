/**
 * ============================================================
 * AXOO B2G
 * NATIONWIDE ART COMMISSION REGION SCOPE
 * ============================================================
 *
 * 대한민국 17개 광역시·도
 * 건축물 미술작품 공모 전국 수집 기준
 *
 * 이 파일을 전국 공공미술 공고 수집의
 * Geographic Single Source of Truth로 사용한다.
 *
 * 핵심 원칙
 * ------------------------------------------------------------
 * 1. 광역시·도 공식명 우선
 * 2. 구 명칭(강원도 / 전라북도 등)도 지원
 * 3. 짧은 지역명은 공식명 검사 이후 사용
 * 4. 광주광역시 vs 경기도 광주시 오판 방지
 * 5. 확신할 수 없는 경우 null 반환
 * ============================================================
 */


/* ============================================================
   REGION DEFINITIONS
============================================================ */

const TARGET_ART_REGIONS = [

  {
    id: "seoul",
    name: "서울",
    fullName: "서울특별시",
    aliases: [
      "서울특별시",
      "서울시",
      "서울"
    ]
  },

  {
    id: "busan",
    name: "부산",
    fullName: "부산광역시",
    aliases: [
      "부산광역시",
      "부산시",
      "부산"
    ]
  },

  {
    id: "daegu",
    name: "대구",
    fullName: "대구광역시",
    aliases: [
      "대구광역시",
      "대구시",
      "대구"
    ]
  },

  {
    id: "incheon",
    name: "인천",
    fullName: "인천광역시",
    aliases: [
      "인천광역시",
      "인천시",
      "인천"
    ]
  },

  {
    id: "gwangju",
    name: "광주",
    fullName: "광주광역시",
    aliases: [
      "광주광역시"
    ]
  },

  {
    id: "daejeon",
    name: "대전",
    fullName: "대전광역시",
    aliases: [
      "대전광역시",
      "대전시",
      "대전"
    ]
  },

  {
    id: "ulsan",
    name: "울산",
    fullName: "울산광역시",
    aliases: [
      "울산광역시",
      "울산시",
      "울산"
    ]
  },

  {
    id: "sejong",
    name: "세종",
    fullName: "세종특별자치시",
    aliases: [
      "세종특별자치시",
      "세종시",
      "세종"
    ]
  },

  {
    id: "gyeonggi",
    name: "경기",
    fullName: "경기도",
    aliases: [
      "경기도",
      "경기"
    ]
  },

  {
    id: "gangwon",
    name: "강원",
    fullName: "강원특별자치도",
    aliases: [
      "강원특별자치도",
      "강원도",
      "강원"
    ]
  },

  {
    id: "chungbuk",
    name: "충북",
    fullName: "충청북도",
    aliases: [
      "충청북도",
      "충북"
    ]
  },

  {
    id: "chungnam",
    name: "충남",
    fullName: "충청남도",
    aliases: [
      "충청남도",
      "충남"
    ]
  },

  {
    id: "jeonbuk",
    name: "전북",
    fullName: "전북특별자치도",
    aliases: [
      "전북특별자치도",
      "전라북도",
      "전북"
    ]
  },

  {
    id: "jeonnam",
    name: "전남",
    fullName: "전라남도",
    aliases: [
      "전라남도",
      "전남"
    ]
  },

  {
    id: "gyeongbuk",
    name: "경북",
    fullName: "경상북도",
    aliases: [
      "경상북도",
      "경북"
    ]
  },

  {
    id: "gyeongnam",
    name: "경남",
    fullName: "경상남도",
    aliases: [
      "경상남도",
      "경남"
    ]
  },

  {
    id: "jeju",
    name: "제주",
    fullName: "제주특별자치도",
    aliases: [
      "제주특별자치도",
      "제주도",
      "제주"
    ]
  }

];


/* ============================================================
   TARGET IDS
============================================================ */

const TARGET_ART_REGION_IDS =
  TARGET_ART_REGIONS.map(
    function (
      region
    ) {

      return region.id;
    }
  );


/* ============================================================
   NORMALIZE
============================================================ */

function normalizeArtRegionText(
  value
) {

  return String(
    value || ""
  )
    .trim()
    .replace(
      /\s+/g,
      ""
    )
    .replace(
      /[(){}\[\],.:;·ㆍ]/g,
      ""
    )
    .toLowerCase();
}


/* ============================================================
   REGION BY ID
============================================================ */

function getTargetArtRegionById(
  regionId
) {

  const targetId =
    normalizeArtRegionText(
      regionId
    );


  if (!targetId) {

    return null;
  }


  return (
    TARGET_ART_REGIONS.find(
      function (
        region
      ) {

        return (
          normalizeArtRegionText(
            region.id
          ) ===
          targetId
        );
      }
    ) ||
    null
  );
}


/* ============================================================
   EXACT REGION VALUE
============================================================ */

function findExactTargetArtRegion(
  value
) {

  const text =
    normalizeArtRegionText(
      value
    );


  if (!text) {

    return null;
  }


  return (
    TARGET_ART_REGIONS.find(
      function (
        region
      ) {

        const exactValues = [

          region.id,

          region.name,

          region.fullName

        ].concat(
          region.aliases ||
          []
        );


        return exactValues.some(
          function (
            candidate
          ) {

            return (
              normalizeArtRegionText(
                candidate
              ) ===
              text
            );
          }
        );
      }
    ) ||
    null
  );
}


/* ============================================================
   STRONG / OFFICIAL MATCH

   짧은 "서울", "광주"보다
   "서울특별시", "광주광역시", "경기도" 등을 먼저 본다.
============================================================ */

function findStrongTargetArtRegion(
  value
) {

  const text =
    normalizeArtRegionText(
      value
    );


  if (!text) {

    return null;
  }


  const strongAliases = [

    {
      id: "seoul",
      values: [
        "서울특별시",
        "서울시"
      ]
    },

    {
      id: "busan",
      values: [
        "부산광역시",
        "부산시"
      ]
    },

    {
      id: "daegu",
      values: [
        "대구광역시",
        "대구시"
      ]
    },

    {
      id: "incheon",
      values: [
        "인천광역시",
        "인천시"
      ]
    },

    {
      id: "gwangju",
      values: [
        "광주광역시"
      ]
    },

    {
      id: "daejeon",
      values: [
        "대전광역시",
        "대전시"
      ]
    },

    {
      id: "ulsan",
      values: [
        "울산광역시",
        "울산시"
      ]
    },

    {
      id: "sejong",
      values: [
        "세종특별자치시",
        "세종시"
      ]
    },

    {
      id: "gyeonggi",
      values: [
        "경기도"
      ]
    },

    {
      id: "gangwon",
      values: [
        "강원특별자치도",
        "강원도"
      ]
    },

    {
      id: "chungbuk",
      values: [
        "충청북도"
      ]
    },

    {
      id: "chungnam",
      values: [
        "충청남도"
      ]
    },

    {
      id: "jeonbuk",
      values: [
        "전북특별자치도",
        "전라북도"
      ]
    },

    {
      id: "jeonnam",
      values: [
        "전라남도"
      ]
    },

    {
      id: "gyeongbuk",
      values: [
        "경상북도"
      ]
    },

    {
      id: "gyeongnam",
      values: [
        "경상남도"
      ]
    },

    {
      id: "jeju",
      values: [
        "제주특별자치도",
        "제주도"
      ]
    }

  ];


  for (
    const entry of
    strongAliases
  ) {

    const matched =
      entry.values.some(
        function (
          alias
        ) {

          return text.includes(
            normalizeArtRegionText(
              alias
            )
          );
        }
      );


    if (matched) {

      return getTargetArtRegionById(
        entry.id
      );
    }
  }


  return null;
}


/* ============================================================
   AMBIGUITY GUARDS
============================================================ */

function isAmbiguousGwangjuText(
  value
) {

  const text =
    normalizeArtRegionText(
      value
    );


  if (!text) {

    return false;
  }


  /*
    광주광역시는 명확하므로 ambiguous 아님.
  */
  if (
    text.includes(
      normalizeArtRegionText(
        "광주광역시"
      )
    )
  ) {

    return false;
  }


  /*
    경기도 광주시
  */
  if (
    text.includes(
      normalizeArtRegionText(
        "경기도광주"
      )
    )
  ) {

    return true;
  }


  /*
    "광주시" 단독은
    광주광역시와 경기도 광주시 중 확정할 수 없다.
  */
  if (
    text.includes(
      normalizeArtRegionText(
        "광주시"
      )
    )
  ) {

    return true;
  }


  return false;
}


/* ============================================================
   SHORT REGION MATCH
============================================================ */

function findShortTargetArtRegion(
  value
) {

  const text =
    normalizeArtRegionText(
      value
    );


  if (!text) {

    return null;
  }


  /*
    광주는 별도 처리.
    "광주"라는 단어만 있다고 광주광역시로
    확정하지 않는다.
  */
  if (
    isAmbiguousGwangjuText(
      value
    )
  ) {

    /*
      경기도가 동시에 있다면 경기 확정.
    */
    if (
      text.includes(
        normalizeArtRegionText(
          "경기도"
        )
      )
    ) {

      return getTargetArtRegionById(
        "gyeonggi"
      );
    }


    return null;
  }


  const shortAliases = [

    ["서울", "seoul"],

    ["부산", "busan"],

    ["대구", "daegu"],

    ["인천", "incheon"],

    ["대전", "daejeon"],

    ["울산", "ulsan"],

    ["세종", "sejong"],

    ["경기", "gyeonggi"],

    ["강원", "gangwon"],

    ["충북", "chungbuk"],

    ["충남", "chungnam"],

    ["전북", "jeonbuk"],

    ["전남", "jeonnam"],

    ["경북", "gyeongbuk"],

    ["경남", "gyeongnam"],

    ["제주", "jeju"]

  ];


  for (
    const entry of
    shortAliases
  ) {

    const alias =
      normalizeArtRegionText(
        entry[0]
      );


    if (
      text.includes(
        alias
      )
    ) {

      return getTargetArtRegionById(
        entry[1]
      );
    }
  }


  /*
    "광주" 단독은 보수적으로 null.
    광주광역시는 Strong Match에서 이미 처리됨.
  */

  return null;
}


/* ============================================================
   REGION LOOKUP

   우선순위:
   1. exact
   2. strong official name
   3. short alias
============================================================ */

function findTargetArtRegion(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return null;
  }


  const exact =
    findExactTargetArtRegion(
      value
    );


  if (exact) {

    return exact;
  }


  const strong =
    findStrongTargetArtRegion(
      value
    );


  if (strong) {

    return strong;
  }


  return findShortTargetArtRegion(
    value
  );
}


/* ============================================================
   MULTI-VALUE INFERENCE

   title → agency → organization → address 등
   여러 텍스트 후보를 순서대로 검사할 때 사용.
============================================================ */

function inferTargetArtRegionFromValues(
  values
) {

  const list =
    Array.isArray(
      values
    )
      ? values
      : [
          values
        ];


  for (
    const value of
    list
  ) {

    const region =
      findTargetArtRegion(
        value
      );


    if (region) {

      return region;
    }
  }


  return null;
}


/* ============================================================
   TARGET REGION CHECK
============================================================ */

function isTargetArtRegion(
  value
) {

  return Boolean(
    findTargetArtRegion(
      value
    )
  );
}


/* ============================================================
   NOTICE REGION CHECK
============================================================ */

function isTargetArtNotice(
  item
) {

  if (!item) {

    return false;
  }


  const region =
    inferTargetArtRegionFromValues(
      [

        item.region,

        item.regionName,

        item.regionLabel,

        item.agency,

        item.organization,

        item.institution,

        item.title,

        item.address,

        item.location

      ]
    );


  return Boolean(
    region
  );
}


/* ============================================================
   EXPORT
============================================================ */

module.exports = {

  TARGET_ART_REGIONS,

  TARGET_ART_REGION_IDS,

  normalizeArtRegionText,

  getTargetArtRegionById,

  findExactTargetArtRegion,

  findStrongTargetArtRegion,

  findShortTargetArtRegion,

  findTargetArtRegion,

  inferTargetArtRegionFromValues,

  isTargetArtRegion,

  isTargetArtNotice

};
