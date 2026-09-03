/* =========================================================
   AXOO ART SOURCE ADAPTERS

   목적
   ---------------------------------------------------------
   사이트마다 실제 공모 목록으로 진입하는 방식이 다르므로
   Generic Collector / Probe가 사용할 Request를 생성한다.

   현재 Adapter
   ---------------------------------------------------------
   - artnuri_art_commission
     → 실제 frm submit 방식과 동일한 GET 검색

   - daejeon_city_notice
     → 대전광역시 게시판 제목 검색 GET seed 생성

   - gangwon_notice
     → 강원특별자치도 공고/고시 + 강원특별자치도보를 함께 감시
========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const DEFAULT_MAX_REQUESTS =
  4;


const ARTNURI_KEY =
  "2301170002";


const ARTNURI_SEARCH_TERMS = [

  "건축물 미술작품",

  "건축물 미술작품 공모",

  "미술작품 제작 설치"

];


const DAEJEON_SEARCH_CONDITION =
  "TITLE";


const DAEJEON_SEARCH_TERMS = [

  "미술작품",

  "건축물 미술작품",

  "미술작품 공모"

];


const GANGWON_DOBO_URL =
  "https://state.gwd.go.kr/portal/bulletin/dobo";


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


/* =========================================================
   REQUEST NORMALIZE
========================================================= */

function normalizeRequest(
  request,
  fallbackUrl
) {

  if (!request) {

    return null;
  }


  const method =
    String(
      request.method ||
      "GET"
    )
      .trim()
      .toUpperCase();


  const url =
    canonicalUrl(
      request.url ||
      fallbackUrl,
      fallbackUrl
    );


  if (!url) {

    return null;
  }


  return {

    method:
      method,

    url:
      url,

    headers: {

      ...(
        request.headers ||
        {}
      )
    },

    body:
      request.body == null
        ? null
        : String(
            request.body
          ),

    label:
      String(
        request.label ||
        ""
      )
  };
}


/* =========================================================
   UNIQUE
========================================================= */

function uniqueRequests(
  requests
) {

  const result =
    [];


  const seen =
    new Set();


  requests.forEach(
    function (
      request
    ) {

      if (!request) {

        return;
      }


      const key = [

        request.method,

        request.url,

        request.body ||
        ""

      ].join(
        "::"
      );


      if (
        seen.has(
          key
        )
      ) {

        return;
      }


      seen.add(
        key
      );


      result.push(
        request
      );
    }
  );


  return result;
}


/* =========================================================
   DEFAULT REQUEST
========================================================= */

function buildDefaultRequests(
  source
) {

  if (
    !source ||
    !source.sourceUrl
  ) {

    return [];
  }


  const request =
    normalizeRequest(
      {

        method:
          "GET",

        url:
          source.sourceUrl,

        label:
          "기본 Source URL"
      },
      source.sourceUrl
    );


  return request
    ? [
        request
      ]
    : [];
}


/* =========================================================
   ARTNURI ENDPOINT
========================================================= */

function getArtnuriEndpoint(
  source
) {

  if (
    !source ||
    !source.sourceUrl
  ) {

    return "";
  }


  return canonicalUrl(
    "search.do",
    source.sourceUrl
  );
}


/* =========================================================
   ARTNURI GET FORM ADAPTER
========================================================= */

function buildArtnuriRequests(
  source
) {

  const endpoint =
    getArtnuriEndpoint(
      source
    );


  if (!endpoint) {

    return [];
  }


  return ARTNURI_SEARCH_TERMS
    .map(
      function (
        searchTerm
      ) {

        const url =
          new URL(
            endpoint
          );


        url.searchParams.set(
          "docid",
          ""
        );


        url.searchParams.set(
          "source",
          ""
        );


        url.searchParams.set(
          "pageSetting",
          "1"
        );


        url.searchParams.set(
          "sc_seNo",
          ""
        );


        url.searchParams.set(
          "key",
          ARTNURI_KEY
        );


        url.searchParams.set(
          "sc_orderBy",
          ""
        );


        url.searchParams.set(
          "recordCountPerPage",
          "30"
        );


        url.searchParams.set(
          "pageIndex",
          "1"
        );


        url.searchParams.set(
          "sc_hash",
          ""
        );


        url.searchParams.set(
          "sc_list",
          ""
        );


        url.searchParams.set(
          "seNo",
          ""
        );


        url.searchParams.set(
          "sw",
          searchTerm
        );


        return normalizeRequest(
          {

            method:
              "GET",

            url:
              url.toString(),

            headers: {

              "Referer":
                source.sourceUrl
            },

            body:
              null,

            label:
              "아트누리 검색: " +
              searchTerm
          },
          endpoint
        );
      }
    )
    .filter(
      Boolean
    );
}


/* =========================================================
   DAEJEON TITLE SEARCH ADAPTER
========================================================= */

function getDaejeonSearchEndpoint(
  source
) {

  if (
    !source ||
    !source.sourceUrl
  ) {

    return "";
  }


  const endpoint =
    canonicalUrl(
      source.sourceUrl,
      source.sourceUrl
    );


  if (!endpoint) {

    return "";
  }


  try {

    const url =
      new URL(
        endpoint
      );


    if (
      !/\/boardNormalList\.do$/i.test(
        url.pathname
      )
    ) {

      return "";
    }


    return url.toString();


  } catch (
    error
  ) {

    return "";
  }
}


function buildDaejeonRequests(
  source
) {

  const endpoint =
    getDaejeonSearchEndpoint(
      source
    );


  if (!endpoint) {

    return buildDefaultRequests(
      source
    );
  }


  return DAEJEON_SEARCH_TERMS
    .map(
      function (
        searchTerm
      ) {

        const url =
          new URL(
            endpoint
          );


        url.searchParams.set(
          "pageIndex",
          "1"
        );


        url.searchParams.set(
          "searchCondition",
          DAEJEON_SEARCH_CONDITION
        );


        url.searchParams.set(
          "searchKeyword",
          searchTerm
        );


        return normalizeRequest(
          {

            method:
              "GET",

            url:
              url.toString(),

            headers: {

              "Referer":
                source.sourceUrl
            },

            body:
              null,

            label:
              "대전 제목 검색: " +
              searchTerm
          },
          endpoint
        );
      }
    )
    .filter(
      Boolean
    );
}


/* =========================================================
   GANGWON NOTICE + DOBO ADAPTER
========================================================= */

function buildGangwonRequests(
  source
) {

  if (
    !source ||
    !source.sourceUrl
  ) {

    return [];
  }


  const primaryRequest =
    normalizeRequest(
      {

        method:
          "GET",

        url:
          source.sourceUrl,

        label:
          "강원특별자치도 공고·고시"
      },
      source.sourceUrl
    );


  const doboRequest =
    normalizeRequest(
      {

        method:
          "GET",

        url:
          GANGWON_DOBO_URL,

        headers: {

          "Referer":
            source.sourceUrl
        },

        label:
          "강원특별자치도보"
      },
      source.sourceUrl
    );


  return [

    primaryRequest,

    doboRequest

  ].filter(
    Boolean
  );
}


/* =========================================================
   ADAPTER REGISTRY
========================================================= */

const SOURCE_ADAPTERS = {

  artnuri_art_commission: {

    id:
      "artnuri_get_form_search",

    label:
      "아트누리 GET Form 검색",

    mode:
      "get_form_search",

    buildRequests:
      buildArtnuriRequests
  },


  daejeon_city_notice: {

    id:
      "daejeon_title_search",

    label:
      "대전광역시 게시판 제목 검색",

    mode:
      "get_title_search",

    buildRequests:
      buildDaejeonRequests
  },


  gangwon_notice: {

    id:
      "gangwon_notice_plus_dobo",

    label:
      "강원 공고·고시 + 강원특별자치도보",

    mode:
      "multi_seed_board",

    buildRequests:
      buildGangwonRequests
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
   REQUEST BUILDER
========================================================= */

function getSourceRequests(
  source,
  options
) {

  const config =
    options ||
    {};


  const maxRequests =
    Number(
      config.maxRequests ||
      DEFAULT_MAX_REQUESTS
    );


  const adapter =
    getSourceAdapter(
      source
    );


  let requests;


  if (
    adapter &&
    typeof adapter.buildRequests ===
      "function"
  ) {

    requests =
      adapter.buildRequests(
        source
      );


  } else {

    requests =
      buildDefaultRequests(
        source
      );
  }


  return uniqueRequests(
    requests
  )
    .slice(
      0,
      maxRequests
    );
}


/* =========================================================
   SEED URL COMPATIBILITY
========================================================= */

function getSourceSeedUrls(
  source,
  options
) {

  const requests =
    getSourceRequests(
      source,
      {

        maxRequests:
          options &&
          options.maxSeeds
            ? options.maxSeeds
            : DEFAULT_MAX_REQUESTS
      }
    );


  return requests.map(
    function (
      request
    ) {

      return request.url;
    }
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


  const requests =
    getSourceRequests(
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

      requestCount:
        requests.length,

      requests:
        requests,

      seedUrls:
        requests.map(
          function (
            request
          ) {

            return request.url;
          }
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

    requestCount:
      requests.length,

    requests:
      requests,

    seedUrls:
      requests.map(
        function (
          request
        ) {

          return request.url;
        }
      )
  };
}


/* =========================================================
   REQUEST DESCRIPTION
========================================================= */

function describeRequest(
  request
) {

  if (!request) {

    return "";
  }


  let searchTerm =
    "";


  try {

    const url =
      new URL(
        request.url
      );


    searchTerm =
      url.searchParams.get(
        "sw"
      ) ||
      url.searchParams.get(
        "searchKeyword"
      ) ||
      "";


  } catch (
    error
  ) {

    searchTerm =
      "";
  }


  return [

    request.method,

    request.url,

    searchTerm
      ? "search=" +
        searchTerm
      : ""

  ]
    .filter(
      Boolean
    )
    .join(
      " | "
    );
}


/* =========================================================
   SELF TEST HELPERS
========================================================= */

function assertSelfTest(
  condition,
  message
) {

  if (
    condition
  ) {

    return;
  }


  throw new Error(
    message
  );
}


/* =========================================================
   ARTNURI SELF TEST
========================================================= */

function testArtnuriAdapter() {

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


  assertSelfTest(
    result.applied,
    "ARTNURI ADAPTER NOT APPLIED"
  );


  assertSelfTest(
    result.requests.length ===
      ARTNURI_SEARCH_TERMS.length,
    "ARTNURI REQUEST COUNT TEST FAILED"
  );


  assertSelfTest(
    result.requests.every(
      function (
        request
      ) {

        return (
          request.method ===
          "GET"
        );
      }
    ),
    "ARTNURI GET METHOD TEST FAILED"
  );


  assertSelfTest(
    result.requests.every(
      function (
        request
      ) {

        const url =
          new URL(
            request.url
          );


        return (
          url.searchParams.get(
            "key"
          ) ===
            ARTNURI_KEY &&

          url.searchParams.get(
            "pageSetting"
          ) ===
            "1" &&

          url.searchParams.get(
            "recordCountPerPage"
          ) ===
            "30" &&

          url.searchParams.get(
            "pageIndex"
          ) ===
            "1" &&

          Boolean(
            url.searchParams.get(
              "sw"
            )
          )
        );
      }
    ),
    "ARTNURI QUERY PARAM TEST FAILED"
  );


  console.log(
    "✅ ARTNURI GET FORM ADAPTER SELF TEST PASSED"
  );
}


/* =========================================================
   DAEJEON SELF TEST
========================================================= */

function testDaejeonAdapter() {

  const sampleSource = {

    id:
      "daejeon_city_notice",

    sourceName:
      "대전광역시 고시공고·부서 게시판",

    sourceUrl:
      "https://www.daejeon.go.kr/drh/depart/board/boardNormalList.do?boardId=normal_0167&menuSeq=1453",

    crawlMode:
      "board"
  };


  const result =
    describeSourceAdapter(
      sampleSource
    );


  assertSelfTest(
    result.applied,
    "DAEJEON ADAPTER NOT APPLIED"
  );


  assertSelfTest(
    result.requests.length ===
      DAEJEON_SEARCH_TERMS.length,
    "DAEJEON REQUEST COUNT TEST FAILED"
  );


  assertSelfTest(
    result.requests.every(
      function (
        request
      ) {

        const url =
          new URL(
            request.url
          );


        return (
          request.method ===
            "GET" &&

          url.searchParams.get(
            "boardId"
          ) ===
            "normal_0167" &&

          url.searchParams.get(
            "menuSeq"
          ) ===
            "1453" &&

          url.searchParams.get(
            "pageIndex"
          ) ===
            "1" &&

          url.searchParams.get(
            "searchCondition"
          ) ===
            DAEJEON_SEARCH_CONDITION &&

          Boolean(
            url.searchParams.get(
              "searchKeyword"
            )
          )
        );
      }
    ),
    "DAEJEON QUERY PARAM TEST FAILED"
  );


  console.log(
    "✅ DAEJEON TITLE SEARCH ADAPTER SELF TEST PASSED"
  );
}


/* =========================================================
   GANGWON SELF TEST
========================================================= */

function testGangwonAdapter() {

  const sampleSource = {

    id:
      "gangwon_notice",

    sourceName:
      "강원특별자치도 고시공고",

    sourceUrl:
      "https://state.gwd.go.kr/portal/bulletin/notification",

    crawlMode:
      "board"
  };


  const result =
    describeSourceAdapter(
      sampleSource
    );


  assertSelfTest(
    result.applied,
    "GANGWON ADAPTER NOT APPLIED"
  );


  assertSelfTest(
    result.requests.length ===
      2,
    "GANGWON REQUEST COUNT TEST FAILED"
  );


  const urls =
    result.requests.map(
      function (
        request
      ) {

        return request.url;
      }
    );


  assertSelfTest(
    urls.some(
      function (
        url
      ) {

        return url.includes(
          "/portal/bulletin/notification"
        );
      }
    ),
    "GANGWON PRIMARY NOTICE SEED MISSING"
  );


  assertSelfTest(
    urls.some(
      function (
        url
      ) {

        return url.includes(
          "/portal/bulletin/dobo"
        );
      }
    ),
    "GANGWON DOBO SEED MISSING"
  );


  console.log(
    "✅ GANGWON NOTICE + DOBO ADAPTER SELF TEST PASSED"
  );
}


/* =========================================================
   SELF TEST
========================================================= */

function runSelfTest() {

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


  try {

    testArtnuriAdapter();


    testDaejeonAdapter();


    testGangwonAdapter();


    console.log(
      "------------------------------------"
    );


    console.log(
      "✅ ALL SOURCE ADAPTER SELF TESTS PASSED"
    );


  } catch (
    error
  ) {

    console.error(
      "❌ SOURCE ADAPTER SELF TEST FAILED"
    );


    console.error(
      error.message
    );


    process.exitCode =
      1;
  }
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


  ARTNURI_KEY,

  ARTNURI_SEARCH_TERMS,


  DAEJEON_SEARCH_CONDITION,

  DAEJEON_SEARCH_TERMS,


  GANGWON_DOBO_URL,


  getSourceAdapter,

  hasSourceAdapter,

  getSourceRequests,

  getSourceSeedUrls,

  describeSourceAdapter,

  describeRequest,


  buildDefaultRequests,

  buildArtnuriRequests,

  getArtnuriEndpoint,


  buildDaejeonRequests,

  getDaejeonSearchEndpoint,


  buildGangwonRequests

};
