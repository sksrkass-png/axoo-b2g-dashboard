/**
 * ============================================================
 * AXOO B2G
 * NATIONWIDE ART COMMISSION REGION SCOPE
 * ============================================================
 *
 * 대표 요청 기준
 *
 * 대한민국 전국 단위 검색
 * 제주특별자치도 제외
 *
 * 이 파일을 전국 공공미술 공고 수집의
 * Geographic Single Source of Truth로 사용한다.
 * ============================================================
 */


const TARGET_ART_REGIONS = [

  {
    id: "seoul",
    name: "서울",
    fullName: "서울특별시"
  },

  {
    id: "busan",
    name: "부산",
    fullName: "부산광역시"
  },

  {
    id: "daegu",
    name: "대구",
    fullName: "대구광역시"
  },

  {
    id: "incheon",
    name: "인천",
    fullName: "인천광역시"
  },

  {
    id: "gwangju",
    name: "광주",
    fullName: "광주광역시"
  },

  {
    id: "daejeon",
    name: "대전",
    fullName: "대전광역시"
  },

  {
    id: "ulsan",
    name: "울산",
    fullName: "울산광역시"
  },

  {
    id: "sejong",
    name: "세종",
    fullName: "세종특별자치시"
  },

  {
    id: "gyeonggi",
    name: "경기",
    fullName: "경기도"
  },

  {
    id: "gangwon",
    name: "강원",
    fullName: "강원특별자치도"
  },

  {
    id: "chungbuk",
    name: "충북",
    fullName: "충청북도"
  },

  {
    id: "chungnam",
    name: "충남",
    fullName: "충청남도"
  },

  {
    id: "jeonbuk",
    name: "전북",
    fullName: "전북특별자치도"
  },

  {
    id: "jeonnam",
    name: "전남",
    fullName: "전라남도"
  },

  {
    id: "gyeongbuk",
    name: "경북",
    fullName: "경상북도"
  },

  {
    id: "gyeongnam",
    name: "경남",
    fullName: "경상남도"
  }

];


/*
 * ------------------------------------------------------------
 * 명시적 제외 지역
 * ------------------------------------------------------------
 */

const EXCLUDED_ART_REGIONS = [

  "제주",

  "제주도",

  "제주특별자치도"

];


/*
 * ------------------------------------------------------------
 * TARGET ID
 * ------------------------------------------------------------
 */

const TARGET_ART_REGION_IDS =
  TARGET_ART_REGIONS.map(
    function (region) {

      return region.id;
    }
  );


/*
 * ------------------------------------------------------------
 * 제주 여부
 * ------------------------------------------------------------
 */

function isExcludedArtRegion(
  value
) {

  const text =
    String(
      value || ""
    )
      .trim()
      .replace(
        /\s+/g,
        ""
      );


  if (!text) {

    return false;
  }


  return EXCLUDED_ART_REGIONS.some(
    function (region) {

      return (
        text.includes(
          region
        )
      );
    }
  );
}


/*
 * ------------------------------------------------------------
 * 공고 데이터 제주 여부
 * ------------------------------------------------------------
 */

function isExcludedArtNotice(
  item
) {

  if (!item) {

    return false;
  }


  const values = [

    item.region,

    item.agency,

    item.institution,

    item.title,

    item.address,

    item.location

  ];


  return values.some(
    function (value) {

      return isExcludedArtRegion(
        value
      );
    }
  );
}


/*
 * ------------------------------------------------------------
 * 전국 검색 대상 여부
 * ------------------------------------------------------------
 */

function isTargetArtRegion(
  value
) {

  const text =
    String(
      value || ""
    )
      .trim();


  if (!text) {

    return false;
  }


  if (
    isExcludedArtRegion(
      text
    )
  ) {

    return false;
  }


  return TARGET_ART_REGIONS.some(
    function (region) {

      return (

        text ===
          region.name ||

        text ===
          region.fullName ||

        text ===
          region.id ||

        text.includes(
          region.fullName
        )

      );
    }
  );
}


/*
 * ------------------------------------------------------------
 * EXPORT
 * ------------------------------------------------------------
 */

module.exports = {

  TARGET_ART_REGIONS,

  TARGET_ART_REGION_IDS,

  EXCLUDED_ART_REGIONS,

  isExcludedArtRegion,

  isExcludedArtNotice,

  isTargetArtRegion

};
