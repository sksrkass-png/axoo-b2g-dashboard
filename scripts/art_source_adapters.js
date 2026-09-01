/* =========================================================
   AXOO ART SOURCE ADAPTERS

   목적
   ---------------------------------------------------------
   Generic Collector가 단순 sourceUrl만 방문해서는
   실제 공모 목록을 찾을 수 없는 사이트를 위한
   Source별 진입 URL Adapter.

   구조
   ---------------------------------------------------------
   SOURCE
   → ADAPTER 확인
   → 검색/게시판 Seed URL 생성
   → Generic Collector가 Seed URL부터 탐색

   주의
   ---------------------------------------------------------
   이 파일 자체는 네트워크 요청을 하지 않는다.
   LIVE / ARCHIVE 데이터도 수정하지 않는다.
========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const DEFAULT_MAX_SEEDS =
  4;


/*
  아트누리는 일반적인 "미술작품 공모"까지 검색하면
  건축물 미술작품과 관계없는 순수미술 공모가
  다수 섞일 수 있다.

  따라서 건축물 미술작품 공모 Recall을 위한
  상대적으로 강한 검색어만 사용한다.
*/
const ARTNURI_SEARCH_TERMS = [

  "건축물 미술작품",

  "건축물 미술작품 공모",

  "미술작품 제작 설치"

];


/* =========================================================
   URL HELPERS
========================================================= */

function canonicalUrl(
  value,
  baseUrl
) {

  try {

    const url =
      new URL(
        value,
        baseUrl
      );


    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {

      return "";
    }


    url.hash =
      "";


    return url.toString();


  } catch (
    error
  ) {

    return "";
  }
}


function uniqueUrls(
  values
) {

  const result =
    [];


  const seen =
    new Set();


  values.forEach(
    function (
      value
    ) {

      const url =
        canonicalUrl(
          value,
          value
        );


      if (
        !url ||
        seen.has(
          url
        )
      ) {

        return;
      }


      seen.add(
        url
      );


      result.push(
        url
      );
    }
  );


  return result;
}


/* =========================================================
   DEFAULT ADAPTER
========================================================= */

function buildDefaultSeeds(
  source
) {

  if (
    !source ||
    !source.sourceUrl
  ) {

    return [];
  }


  return [
    source.sourceUrl
  ];
}


/* =========================================================
   ARTNURI ADAPTER
========================================================= */

function buildArtnuriSeeds(
  source
) {

  if (
    !source ||
    !source.sourceUrl
  ) {

    return [];
  }


  const seeds =
    [];


  ARTNURI_SEARCH_TERMS.forEach(
    function (
      searchTerm
    ) {

      try {

        const url =
          new URL(
            source.sourceUrl
          );


        /*
          아트누리 지원사업 찾기 페이지 식별값
        */
        url.searchParams.set(
          "key",
          "2301170002"
        );


        /*
          항상 첫 검색 결과 페이지부터 시작
        */
        url.searchParams.set(
          "pageIndex",
          "1"
        );


        /*
          가능한 한 한 번에 많은 결과 확인
        */
        url.searchParams.set(
          "recordCountPerPage",
          "30"
        );


        /*
          리스트 표시 기본값
        */
        url.searchParams.set(
          "pageSetting",
          "1"
        );


        /*
          실제 검색어
        */
        url.searchParams.set(
          "sw",
          searchTerm
        );


        seeds.push(
          url.toString()
        );


      } catch (
        error
      ) {

        console.warn(
          "[ARTNURI ADAPTER]",
          searchTerm,
          error.message
        );
      }
    }
  );


  return uniqueUrls(
    seeds
  );
}


/* =========================================================
   ADAPTER REGISTRY
========================================================= */

const SOURCE_ADAPTERS = {

  artnuri_art_commission: {

    id:
      "artnuri_keyword_search",

    label:
      "아트누리 키워드 검색",

    mode:
      "keyword_search",

    buildSeeds:
      buildArtnuriSeeds
  }

};


/* =========================================================
   ADAPTER LOOKUP
========================================================= */

function getSourceAdapter(
  source
) {

  if (
    !source ||
    !source.id
  ) {

    return null;
  }


  return (
    SOURCE_ADAPTERS[
      source.id
    ] ||
    null
  );
}


function hasSourceAdapter(
  source
) {

  return Boolean(
    getSourceAdapter(
      source
    )
  );
}


/* =========================================================
   SEED BUILDER
========================================================= */

function getSourceSeedUrls(
  source,
  options
) {

  const config =
    options || {};


  const maxSeeds =
    Number(
      config.maxSeeds ||
      DEFAULT_MAX_SEEDS
    );


  const adapter =
    getSourceAdapter(
      source
    );


  let seeds;


  if (
    adapter &&
    typeof adapter.buildSeeds ===
      "function"
  ) {

    seeds =
      adapter.buildSeeds(
        source
      );


  } else {

    seeds =
      buildDefaultSeeds(
        source
      );
  }


  return uniqueUrls(
    seeds
  )
    .slice(
      0,
      maxSeeds
    );
}


/* =========================================================
   DESCRIPTION
========================================================= */

function describeSourceAdapter(
  source
) {

  const adapter =
    getSourceAdapter(
      source
    );


  if (!adapter) {

    return {

      applied:
        false,

      adapterId:
        "default",

      adapterLabel:
        "기본 Source URL",

      mode:
        source &&
        source.crawlMode
          ? source.crawlMode
          : "generic_board_discovery",

      seedUrls:
        getSourceSeedUrls(
          source
        )
    };
  }


  return {

    applied:
      true,

    adapterId:
      adapter.id,

    adapterLabel:
      adapter.label,

    mode:
      adapter.mode,

    seedUrls:
      getSourceSeedUrls(
        source
      )
  };
}


/* =========================================================
   SELF TEST
========================================================= */

function runSelfTest() {

  const sampleSource = {

    id:
      "artnuri_art_commission",

    sourceName:
      "아트누리 지원사업·공모 검색",

    sourceUrl:
      "https://artnuri.or.kr/crawler/info/search.do",

    crawlMode:
      "keyword_search"
  };


  const result =
    describeSourceAdapter(
      sampleSource
    );


  console.log(
    ""
  );

  console.log(
    "===================================="
  );

  console.log(
    "AXOO ART SOURCE ADAPTER TEST"
  );

  console.log(
    "===================================="
  );


  console.log(
    "SOURCE:",
    sampleSource.id
  );


  console.log(
    "ADAPTER:",
    result.adapterId
  );


  console.log(
    "APPLIED:",
    result.applied
  );


  console.log(
    "MODE:",
    result.mode
  );


  console.log(
    "SEEDS:",
    result.seedUrls.length
  );


  result.seedUrls.forEach(
    function (
      url,
      index
    ) {

      console.log(
        ""
      );


      console.log(
        "#" +
        (
          index +
          1
        )
      );


      console.log(
        url
      );
    }
  );


  console.log(
    ""
  );

  console.log(
    "===================================="
  );


  if (
    !result.applied ||
    result.seedUrls.length !==
      ARTNURI_SEARCH_TERMS.length
  ) {

    console.error(
      "❌ ARTNURI ADAPTER SELF TEST FAILED"
    );


    process.exitCode =
      1;


    return;
  }


  const everySeedHasSearchWord =
    result.seedUrls.every(
      function (
        value
      ) {

        try {

          const url =
            new URL(
              value
            );


          return Boolean(
            url.searchParams.get(
              "sw"
            )
          );


        } catch (
          error
        ) {

          return false;
        }
      }
    );


  if (
    !everySeedHasSearchWord
  ) {

    console.error(
      "❌ ARTNURI SEARCH PARAMETER TEST FAILED"
    );


    process.exitCode =
      1;


    return;
  }


  console.log(
    "✅ ARTNURI ADAPTER SELF TEST PASSED"
  );
}


/* =========================================================
   START
========================================================= */

if (
  require.main ===
  module
) {

  runSelfTest();
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {

  SOURCE_ADAPTERS,

  ARTNURI_SEARCH_TERMS,

  getSourceAdapter,

  hasSourceAdapter,

  getSourceSeedUrls,

  describeSourceAdapter,

  buildArtnuriSeeds

};
