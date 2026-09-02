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

   아트누리 확인 결과
   ---------------------------------------------------------
   fn_egov_link_page(v) {
     $("#seNo").val($("#sc_seNo").val());
     $('#pageSetting').val("1");
     f.pageIndex.value = v;
     f.action = "search.do";
     f.method = "get";
     f.submit();
   }

   따라서 POST는 사용하지 않는다.
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

        /*
          실제 frm GET submit과 최대한 동일하게 구성한다.

          확인된 hidden fields:
          - docid
          - source
          - pageSetting
          - sc_seNo
          - key
          - sc_orderBy
          - recordCountPerPage
          - pageIndex
          - sc_hash
          - sc_list
          - seNo
          - sw

          체크되지 않은 checkbox는 브라우저 submit 시
          전송되지 않으므로 넣지 않는다.
        */

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


        /*
          fn_egov_link_page에서
          seNo = sc_seNo 로 복사됨.
          현재 둘 다 빈 값.
        */
        url.searchParams.set(
          "seNo",
          ""
        );


        /*
          실제 검색어
        */
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


  /*
    Adapter 적용
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
    3개 검색어
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
    전부 GET
  */
  const allGet =
    result.requests.every(
      function (
        request
      ) {

        return (
          request.method ===
          "GET"
        );
      }
    );


  if (!allGet) {

    console.error(
      "❌ ARTNURI GET METHOD TEST FAILED"
    );


    process.exitCode =
      1;


    return;
  }


  /*
    실제 form 주요 query 확인
  */
  const requiredParamsOk =
    result.requests.every(
      function (
        request
      ) {

        try {

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


        } catch (
          error
        ) {

          return false;
        }
      }
    );


  if (
    !requiredParamsOk
  ) {

    console.error(
      "❌ ARTNURI QUERY PARAM TEST FAILED"
    );


    process.exitCode =
      1;


    return;
  }


  console.log(
    ""
  );


  console.log(
    "✅ ARTNURI GET FORM ADAPTER SELF TEST PASSED"
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

  ARTNURI_KEY,

  ARTNURI_SEARCH_TERMS,

  getSourceAdapter,

  hasSourceAdapter,

  getSourceRequests,

  getSourceSeedUrls,

  describeSourceAdapter,

  describeRequest,

  buildArtnuriRequests,

  getArtnuriEndpoint

};
