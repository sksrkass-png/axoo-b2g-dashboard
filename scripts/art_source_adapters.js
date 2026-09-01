/* =========================================================
   AXOO ART SOURCE ADAPTERS

   목적
   ---------------------------------------------------------
   사이트마다 실제 공모 목록으로 진입하는 방식이 다르므로
   Generic Collector가 사용할 Request를 생성한다.

   지원 방식
   ---------------------------------------------------------
   1. GET
      일반 게시판 / 일반 URL

   2. POST FORM
      검색폼을 POST로 제출해야 하는 사이트

   현재 Adapter
   ---------------------------------------------------------
   - artnuri_art_commission
     → POST keyword search

   이 파일 자체는 네트워크 요청을 하지 않는다.
========================================================= */


/* =========================================================
   CONFIG
========================================================= */

const DEFAULT_MAX_REQUESTS =
  4;


/*
  건축물 미술작품 공모에 집중하기 위해
  너무 넓은 "미술작품 공모"는 사용하지 않는다.
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


  const headers = {

    ...(
      request.headers ||
      {}
    )
  };


  const body =
    request.body == null
      ? null
      : String(
          request.body
        );


  return {

    method:
      method,

    url:
      url,

    headers:
      headers,

    body:
      body,

    label:
      String(
        request.label ||
        ""
      )
  };
}


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
   ARTNURI POST ADAPTER
========================================================= */

function buildArtnuriRequests(
  source
) {

  if (
    !source ||
    !source.sourceUrl
  ) {

    return [];
  }


  /*
    FORM DIAGNOSTICS에서 확인된 실제 지원사업 검색폼:

    form name = frm
    method    = POST

    주요 필드:
    key=2301170002
    pageSetting
    recordCountPerPage=30
    pageIndex=1
    sw=<검색어>

    버튼:
    fn_egov_link_page(1)
  */


  const endpoint =
    canonicalUrl(
      "/crawler/info/search.do",
      source.sourceUrl
    );


  if (!endpoint) {

    return [];
  }


  return ARTNURI_SEARCH_TERMS
    .map(
      function (
        searchTerm
      ) {

        const params =
          new URLSearchParams();


        /*
          기존 FORM hidden fields
        */
        params.set(
          "docid",
          ""
        );


        params.set(
          "source",
          ""
        );


        params.set(
          "pageSetting",
          "1"
        );


        params.set(
          "sc_seNo",
          ""
        );


        params.set(
          "key",
          "2301170002"
        );


        params.set(
          "sc_orderBy",
          ""
        );


        params.set(
          "recordCountPerPage",
          "30"
        );


        params.set(
          "pageIndex",
          "1"
        );


        params.set(
          "sc_hash",
          ""
        );


        params.set(
          "sc_list",
          ""
        );


        params.set(
          "seNo",
          ""
        );


        /*
          실제 검색어 필드
        */
        params.set(
          "sw",
          searchTerm
        );


        return normalizeRequest(
          {

            method:
              "POST",

            url:
              endpoint,

            headers: {

              "Content-Type":
                "application/x-www-form-urlencoded",

              "Origin":
                "https://artnuri.or.kr",

              "Referer":
                source.sourceUrl
            },

            body:
              params.toString(),

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
   ADAPTER REGISTRY
========================================================= */

const SOURCE_ADAPTERS = {

  artnuri_art_commission: {

    id:
      "artnuri_post_keyword_search",

    label:
      "아트누리 POST 키워드 검색",

    mode:
      "post_keyword_search",

    buildRequests:
      buildArtnuriRequests
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
   BACKWARD COMPATIBILITY

   기존 Collector / Probe가 아직
   getSourceSeedUrls()를 호출하는 동안 깨지지 않도록 유지.

   POST Request의 경우 URL만 반환하면 실제 검색은 안 되므로,
   다음 단계에서 Collector / Probe를
   getSourceRequests() 방식으로 교체한다.
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
   SAFE REQUEST PRINT
========================================================= */

function describeRequest(
  request
) {

  if (!request) {

    return "";
  }


  let searchTerm =
    "";


  if (
    request.body
  ) {

    try {

      const params =
        new URLSearchParams(
          request.body
        );


      searchTerm =
        params.get(
          "sw"
        ) ||
        "";

    } catch (
      error
    ) {

      searchTerm =
        "";
    }
  }


  return [

    request.method,

    request.url,

    searchTerm
      ? "sw=" +
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
    "REQUESTS:",
    result.requests.length
  );


  result.requests.forEach(
    function (
      request,
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
        describeRequest(
          request
        )
      );
    }
  );


  console.log(
    ""
  );


  console.log(
    "===================================="
  );


  /*
    검증 1
    Adapter가 실제 적용되어야 한다.
  */
  if (
    !result.applied
  ) {

    console.error(
      "❌ ARTNURI ADAPTER NOT APPLIED"
    );


    process.exitCode =
      1;


    return;
  }


  /*
    검증 2
    검색어 수만큼 Request가 있어야 한다.
  */
  if (
    result.requests.length !==
    ARTNURI_SEARCH_TERMS.length
  ) {

    console.error(
      "❌ ARTNURI REQUEST COUNT TEST FAILED"
    );


    process.exitCode =
      1;


    return;
  }


  /*
    검증 3
    모두 POST여야 한다.
  */
  const everyRequestIsPost =
    result.requests.every(
      function (
        request
      ) {

        return (
          request.method ===
          "POST"
        );
      }
    );


  if (
    !everyRequestIsPost
  ) {

    console.error(
      "❌ ARTNURI POST METHOD TEST FAILED"
    );


    process.exitCode =
      1;


    return;
  }


  /*
    검증 4
    모든 POST body에 sw가 있어야 한다.
  */
  const everyRequestHasSearchWord =
    result.requests.every(
      function (
        request
      ) {

        try {

          const params =
            new URLSearchParams(
              request.body ||
              ""
            );


          return Boolean(
            params.get(
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
    !everyRequestHasSearchWord
  ) {

    console.error(
      "❌ ARTNURI SEARCH WORD TEST FAILED"
    );


    process.exitCode =
      1;


    return;
  }


  /*
    검증 5
    key와 pageIndex 확인
  */
  const everyRequestHasRequiredFields =
    result.requests.every(
      function (
        request
      ) {

        const params =
          new URLSearchParams(
            request.body ||
            ""
          );


        return (
          params.get(
            "key"
          ) ===
            "2301170002" &&
          params.get(
            "pageIndex"
          ) ===
            "1" &&
          params.get(
            "recordCountPerPage"
          ) ===
            "30"
        );
      }
    );


  if (
    !everyRequestHasRequiredFields
  ) {

    console.error(
      "❌ ARTNURI REQUIRED FIELD TEST FAILED"
    );


    process.exitCode =
      1;


    return;
  }


  console.log(
    "✅ ARTNURI POST ADAPTER SELF TEST PASSED"
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

  getSourceRequests,

  getSourceSeedUrls,

  describeSourceAdapter,

  describeRequest,

  buildArtnuriRequests

};
