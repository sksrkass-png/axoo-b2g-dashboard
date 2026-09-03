const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
  getRegionalSources,
  getNationalSources
} = require("./art_commission_sources");

const {
  getSourceSeedUrls,
  describeSourceAdapter
} = require("./art_source_adapters");

const {
  inferTargetArtRegionFromValues
} = require("./art_region_scope");

const {
  extractArtDetail,
  mergeArtDetailIntoItem
} = require("./art_detail_extractor");


/* =========================================================
   CONFIG
========================================================= */

const DATA_FILE = path.join(
  process.cwd(),
  "data",
  "art_commissions.json"
);

const ARCHIVE_FILE = path.join(
  process.cwd(),
  "data",
  "art_commissions_archive.json"
);

const SPECIALIZED_REGION_IDS = new Set([
  "seoul",
  "gyeonggi",
  "incheon",
  "busan"
]);

const COLLECTION_VERSION =
  "nationwide-generic-1.5.0";

const FETCH_TIMEOUT_MS =
  12000;

const FETCH_MAX_ATTEMPTS =
  2;

const FETCH_RETRY_DELAY_MS =
  800;

const MAX_PAGES_PER_SOURCE =
  4;

const MAX_SOURCES_PER_REGION =
  2;

const MAX_SOURCE_BUDGET_MS =
  25000;

const MAX_DEPTH =
  2;

const MAX_SEEDS_PER_SOURCE =
  3;

const CHEONGJU_SOURCE_ID =
  "chungbuk_notice";

const CHEONGJU_SEARCH_TERMS = [
  "미술작품",
  "건축물 미술작품",
  "미술작품 제작 설치"
];


/* =========================================================
   KEYWORDS
========================================================= */

const PRIMARY_KEYWORDS = [
  "미술작품",
  "공공미술"
];

const ACTION_KEYWORDS = [
  "공모",
  "제작",
  "설치",
  "신축",
  "공동주택"
];

const EXCLUDE_KEYWORDS = [
  "선정결과",
  "선정 결과",
  "공모결과",
  "공모 결과",
  "결과공고",
  "결과 공고",
  "심의결과",
  "심의 결과",
  "심의위원",
  "위원 모집",
  "회의록",
  "조례",
  "규칙",
  "행정예고",
  "제도 안내",
  "업무 안내",
  "설치완료",
  "설치 완료",
  "준공"
];

const NAVIGATION_KEYWORDS = [
  "공고",
  "고시",
  "알림",
  "소식",
  "게시판",
  "문화",
  "예술",
  "미술",
  "공모",
  "notice",
  "board",
  "bbs",
  "announce",
  "announcement",
  "gosi",
  "gonggo",
  "culture",
  "art"
];


/* =========================================================
   JSON
========================================================= */

function readArray(
  filePath
) {

  if (
    !fs.existsSync(
      filePath
    )
  ) {

    return [];
  }

  const raw =
    fs
      .readFileSync(
        filePath,
        "utf8"
      )
      .trim();

  if (!raw) {

    return [];
  }

  const parsed =
    JSON.parse(
      raw
    );

  if (
    !Array.isArray(
      parsed
    )
  ) {

    throw new Error(
      filePath +
      " 은 배열 형식이어야 합니다."
    );
  }

  return parsed;
}


function writeArray(
  filePath,
  items
) {

  fs.writeFileSync(
    filePath,
    JSON.stringify(
      items,
      null,
      2
    ) + "\n",
    "utf8"
  );
}


/* =========================================================
   TEXT
========================================================= */

function decodeHtmlEntities(
  value
) {

  return String(
    value || ""
  )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      "\""
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&#(\d+);/g,
      function (
        _,
        code
      ) {

        return String.fromCharCode(
          Number(code)
        );
      }
    );
}


function cleanText(
  value
) {

  return decodeHtmlEntities(
    value
  )
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )
    .replace(
      /<[^>]*>/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


/* =========================================================
   DATE
========================================================= */

function todayKst() {

  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Seoul",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit"
      }
    );

  const parts =
    formatter
      .formatToParts(
        new Date()
      );

  const values =
    {};

  parts.forEach(
    function (
      part
    ) {

      values[
        part.type
      ] =
        part.value;
    }
  );

  return (
    values.year +
    "-" +
    values.month +
    "-" +
    values.day
  );
}


/* =========================================================
   URL
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

    Array.from(
      url.searchParams.keys()
    ).forEach(
      function (
        key
      ) {

        if (
          key
            .toLowerCase()
            .startsWith(
              "utm_"
            )
        ) {

          url.searchParams.delete(
            key
          );
        }
      }
    );

    return url.toString();

  } catch (
    error
  ) {

    return "";
  }
}


function sameOrigin(
  first,
  second
) {

  try {

    return (
      new URL(
        first
      ).origin ===
      new URL(
        second
      ).origin
    );

  } catch (
    error
  ) {

    return false;
  }
}


/* =========================================================
   CHEONGJU E-MINWON HELPERS
========================================================= */

function isCheongjuEminwonListUrl(
  value
) {

  try {

    const url =
      new URL(
        value
      );

    return (
      url.hostname ===
        "www.cheongju.go.kr" &&
      /\/www\/selectEminwonNoticeList\.do$/i.test(
        url.pathname
      )
    );

  } catch (
    error
  ) {

    return false;
  }
}


function buildCheongjuSearchSeedUrls(
  source,
  seedUrls
) {

  if (
    !source ||
    source.id !==
      CHEONGJU_SOURCE_ID
  ) {

    return seedUrls;
  }

  const base =
    seedUrls[0] ||
    source.sourceUrl;

  if (
    !base ||
    !isCheongjuEminwonListUrl(
      base
    )
  ) {

    return seedUrls;
  }

  const result =
    [];

  CHEONGJU_SEARCH_TERMS.forEach(
    function (
      term
    ) {

      const url =
        new URL(
          base
        );

      url.searchParams.set(
        "key",
        url.searchParams.get(
          "key"
        ) ||
        "281"
      );

      url.searchParams.set(
        "notAncmtSeCd",
        url.searchParams.get(
          "notAncmtSeCd"
        ) ||
        ""
      );

      url.searchParams.set(
        "pageIndex",
        "1"
      );

      url.searchParams.set(
        "searchCnd",
        "all"
      );

      url.searchParams.set(
        "searchKrwd",
        term
      );

      result.push(
        url.toString()
      );
    }
  );

  return result.slice(
    0,
    MAX_SEEDS_PER_SOURCE
  );
}


function buildCheongjuPostBody(
  value
) {

  const url =
    new URL(
      value
    );

  const params =
    new URLSearchParams();

  [
    "key",
    "notAncmtSeCd",
    "pageIndex",
    "searchCnd",
    "searchKrwd",
    "nowDongGn"
  ].forEach(
    function (
      key
    ) {

      if (
        url.searchParams.has(
          key
        )
      ) {

        params.set(
          key,
          url.searchParams.get(
            key
          ) ||
          ""
        );
      }
    }
  );

  if (
    !params.has(
      "key"
    )
  ) {

    params.set(
      "key",
      "281"
    );
  }

  if (
    !params.has(
      "notAncmtSeCd"
    )
  ) {

    params.set(
      "notAncmtSeCd",
      ""
    );
  }

  if (
    !params.has(
      "pageIndex"
    )
  ) {

    params.set(
      "pageIndex",
      "1"
    );
  }

  if (
    !params.has(
      "searchCnd"
    )
  ) {

    params.set(
      "searchCnd",
      "all"
    );
  }

  if (
    !params.has(
      "searchKrwd"
    )
  ) {

    params.set(
      "searchKrwd",
      "미술작품"
    );
  }

  if (
    !params.has(
      "nowDongGn"
    )
  ) {

    params.set(
      "nowDongGn",
      ""
    );
  }

  return params.toString();
}


function extractCheongjuManagementNo(
  rowHtml
) {

  const decoded =
    decodeHtmlEntities(
      rowHtml
    );

  const patterns = [
    /notAncmtMgtNo[^0-9]{0,100}([0-9]{4,})/i,
    /notAncmtMgtNo(?:=|%3D)([0-9]{4,})/i,
    /selectEminwonNoticeView\.do[\s\S]{0,400}?notAncmtMgtNo(?:=|%3D)([0-9]{4,})/i,
    /(?:fn|go|select|view)[A-Za-z0-9_]*\s*\(\s*['"]([0-9]{5,})['"]/i
  ];

  for (
    const pattern of
    patterns
  ) {

    const match =
      decoded.match(
        pattern
      );

    if (
      match &&
      match[1]
    ) {

      return match[1];
    }
  }

  return "";
}


function extractCheongjuNoticeType(
  rowHtml,
  pageUrl
) {

  const decoded =
    decodeHtmlEntities(
      rowHtml
    );

  const patterns = [
    /notAncmtSeCd[^0-9]{0,60}([0-9]{2})/i,
    /notAncmtSeCd(?:=|%3D)([0-9]{2})/i
  ];

  for (
    const pattern of
    patterns
  ) {

    const match =
      decoded.match(
        pattern
      );

    if (
      match &&
      match[1]
    ) {

      return match[1];
    }
  }

  try {

    return (
      new URL(
        pageUrl
      ).searchParams.get(
        "notAncmtSeCd"
      ) ||
      ""
    );

  } catch (
    error
  ) {

    return "";
  }
}


function chooseCheongjuRowLabel(
  rowHtml
) {

  const labels =
    [];

  const regex =
    /<a\b[^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while (
    (
      match =
        regex.exec(
          rowHtml
        )
    ) !==
    null
  ) {

    const label =
      cleanText(
        match[1]
      );

    if (
      !label ||
      /^\d+$/.test(
        label
      )
    ) {

      continue;
    }

    labels.push(
      label
    );
  }

  const candidate =
    labels.find(
      function (
        label
      ) {

        return isCandidateTitle(
          label
        );
      }
    );

  if (
    candidate
  ) {

    return candidate;
  }

  const artworkLabel =
    labels.find(
      function (
        label
      ) {

        return /미술작품|공공미술/i.test(
          label
        );
      }
    );

  if (
    artworkLabel
  ) {

    return artworkLabel;
  }

  return labels
    .sort(
      function (
        first,
        second
      ) {

        return (
          second.length -
          first.length
        );
      }
    )[0] ||
    "";
}


function extractCheongjuEminwonAnchors(
  html,
  pageUrl
) {

  if (
    !isCheongjuEminwonListUrl(
      pageUrl
    )
  ) {

    return [];
  }

  const result =
    [];

  const rowRegex =
    /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;

  let rowMatch;

  while (
    (
      rowMatch =
        rowRegex.exec(
          html
        )
    ) !==
    null
  ) {

    const rowHtml =
      rowMatch[0];

    const managementNo =
      extractCheongjuManagementNo(
        rowHtml
      );

    if (
      !managementNo
    ) {

      continue;
    }

    const label =
      chooseCheongjuRowLabel(
        rowHtml
      );

    if (
      !label
    ) {

      continue;
    }

    const noticeType =
      extractCheongjuNoticeType(
        rowHtml,
        pageUrl
      );

    const listUrl =
      new URL(
        pageUrl
      );

    const detailUrl =
      new URL(
        "/www/selectEminwonNoticeView.do",
        listUrl.origin
      );

    detailUrl.searchParams.set(
      "key",
      listUrl.searchParams.get(
        "key"
      ) ||
      "281"
    );

    detailUrl.searchParams.set(
      "nowDongGn",
      ""
    );

    detailUrl.searchParams.set(
      "notAncmtSeCd",
      noticeType
    );

    detailUrl.searchParams.set(
      "notAncmtMgtNo",
      managementNo
    );

    result.push({
      url:
        detailUrl.toString(),
      label:
        label,
      attrs:
        "cheongju-eminwon-resolved"
    });
  }

  return result;
}


function uniqueAnchors(
  anchors
) {

  const result =
    [];

  const seen =
    new Set();

  anchors.forEach(
    function (
      anchor
    ) {

      if (
        !anchor ||
        !anchor.url
      ) {

        return;
      }

      const key =
        anchor.url +
        "::" +
        (
          anchor.label ||
          ""
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
        anchor
      );
    }
  );

  return result;
}


/* =========================================================
   ID
========================================================= */

function stableId(
  sourceUrl
) {

  const hash =
    crypto
      .createHash(
        "sha1"
      )
      .update(
        sourceUrl
      )
      .digest(
        "hex"
      )
      .slice(
        0,
        12
      );

  return (
    "nationwide-art-commission-" +
    hash
  );
}


/* =========================================================
   TITLE FILTER
========================================================= */

function hasAnyKeyword(
  text,
  keywords
) {

  return keywords.some(
    function (
      keyword
    ) {

      return String(
        text || ""
      ).includes(
        keyword
      );
    }
  );
}


function isCandidateTitle(
  value
) {

  const title =
    cleanText(
      value
    );

  if (
    !title ||
    title.length <
      4
  ) {

    return false;
  }

  if (
    hasAnyKeyword(
      title,
      EXCLUDE_KEYWORDS
    )
  ) {

    return false;
  }

  if (
    !hasAnyKeyword(
      title,
      PRIMARY_KEYWORDS
    )
  ) {

    return false;
  }

  if (
    !hasAnyKeyword(
      title,
      ACTION_KEYWORDS
    )
  ) {

    return false;
  }

  return true;
}


/* =========================================================
   HTML LINK
========================================================= */

function extractAnchors(
  html,
  pageUrl
) {

  const result =
    [];

  const regex =
    /<a\b([^>]*)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;

  let match;

  while (
    (
      match =
        regex.exec(
          html
        )
    ) !==
    null
  ) {

    const href =
      decodeHtmlEntities(
        match[2]
      );

    if (
      !href ||
      href.startsWith(
        "#"
      ) ||
      href
        .toLowerCase()
        .startsWith(
          "javascript:"
        ) ||
      href
        .toLowerCase()
        .startsWith(
          "mailto:"
        )
    ) {

      continue;
    }

    const url =
      canonicalUrl(
        href,
        pageUrl
      );

    if (
      !url
    ) {

      continue;
    }

    result.push({
      url:
        url,
      label:
        cleanText(
          match[4]
        ),
      attrs:
        cleanText(
          (
            match[1] ||
            ""
          ) +
          " " +
          (
            match[3] ||
            ""
          )
        )
    });
  }

  const cheongjuAnchors =
    extractCheongjuEminwonAnchors(
      html,
      pageUrl
    );

  return uniqueAnchors(
    result.concat(
      cheongjuAnchors
    )
  );
}


/* =========================================================
   NAVIGATION
========================================================= */

function followScore(
  anchor
) {

  const target =
    (
      anchor.label +
      " " +
      anchor.url +
      " " +
      anchor.attrs
    )
      .toLowerCase();

  let score =
    0;

  NAVIGATION_KEYWORDS.forEach(
    function (
      keyword
    ) {

      if (
        target.includes(
          keyword.toLowerCase()
        )
      ) {

        score +=
          10;
      }
    }
  );

  if (
    isCandidateTitle(
      anchor.label
    )
  ) {

    score +=
      100;
  }

  return score;
}


/* =========================================================
   FETCH
========================================================= */

function sleep(
  ms
) {

  return new Promise(
    function (
      resolve
    ) {

      setTimeout(
        resolve,
        ms
      );
    }
  );
}


function buildFetchOptions(
  url,
  signal
) {

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (compatible; AXOO-B2G-NationwideCollector/1.5)",
    "Accept":
      "text/html,application/xhtml+xml,*/*",
    "Accept-Language":
      "ko-KR,ko;q=0.9,en;q=0.6"
  };

  const options = {
    signal:
      signal,
    redirect:
      "follow",
    headers:
      headers
  };

  if (
    isCheongjuEminwonListUrl(
      url
    )
  ) {

    options.method =
      "POST";

    options.body =
      buildCheongjuPostBody(
        url
      );

    options.headers = {
      ...headers,
      "Content-Type":
        "application/x-www-form-urlencoded; charset=UTF-8",
      "Referer":
        "https://www.cheongju.go.kr/www/selectEminwonNoticeList.do?key=281"
    };
  }

  return options;
}


async function fetchText(
  url
) {

  let lastError =
    null;

  for (
    let attempt = 1;
    attempt <=
      FETCH_MAX_ATTEMPTS;
    attempt++
  ) {

    const controller =
      new AbortController();

    const timer =
      setTimeout(
        function () {

          controller.abort();

        },
        FETCH_TIMEOUT_MS
      );

    try {

      const response =
        await fetch(
          url,
          buildFetchOptions(
            url,
            controller.signal
          )
        );

      if (
        !response.ok
      ) {

        throw new Error(
          "HTTP " +
          response.status
        );
      }

      return {
        html:
          await response.text(),
        finalUrl:
          response.url
      };

    } catch (
      error
    ) {

      lastError =
        error;

      if (
        attempt <
        FETCH_MAX_ATTEMPTS
      ) {

        console.log(
          "   ↻ FETCH RETRY" +
          " | attempt=" +
          (
            attempt +
            1
          ) +
          "/" +
          FETCH_MAX_ATTEMPTS +
          " | " +
          url
        );

        await sleep(
          FETCH_RETRY_DELAY_MS
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
      "FETCH FAILED"
    )
  );
}


/* =========================================================
   REGION INFERENCE
========================================================= */

function isNationalRegion(
  region
) {

  return Boolean(
    region &&
    region.name ===
      "전국"
  );
}


function extractRegionEvidenceSnippets(
  html,
  title
) {

  const text =
    cleanText(
      html
    );

  if (
    !text
  ) {

    return [];
  }

  const snippets =
    [];

  function pushSnippet(
    value
  ) {

    const normalized =
      String(
        value || ""
      )
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    if (
      !normalized ||
      snippets.includes(
        normalized
      )
    ) {

      return;
    }

    snippets.push(
      normalized
    );
  }

  const normalizedTitle =
    cleanText(
      title
    );

  if (
    normalizedTitle
  ) {

    const titleIndex =
      text.indexOf(
        normalizedTitle
      );

    if (
      titleIndex >=
      0
    ) {

      pushSnippet(
        text.slice(
          Math.max(
            0,
            titleIndex -
              400
          ),
          Math.min(
            text.length,
            titleIndex +
              normalizedTitle.length +
              2200
          )
        )
      );
    }
  }

  const markers = [
    "사업지역",
    "사업 지역",
    "소재지",
    "설치장소",
    "설치 장소",
    "주소",
    "공고기관",
    "공고 기관",
    "주관기관",
    "주관 기관",
    "주최기관",
    "주최 기관",
    "시행기관",
    "시행 기관"
  ];

  markers.forEach(
    function (
      marker
    ) {

      let cursor =
        0;

      let count =
        0;

      while (
        cursor <
          text.length &&
        count <
          2
      ) {

        const index =
          text.indexOf(
            marker,
            cursor
          );

        if (
          index <
          0
        ) {

          break;
        }

        pushSnippet(
          text.slice(
            Math.max(
              0,
              index -
                100
            ),
            Math.min(
              text.length,
              index +
                marker.length +
                500
            )
          )
        );

        cursor =
          index +
          marker.length;

        count++;
      }
    }
  );

  return snippets;
}


function resolveCandidateRegion(
  sourceRegion,
  title,
  detailEvidence
) {

  const originalRegion =
    sourceRegion || {
      id:
        "national",
      name:
        "전국",
      fullName:
        "전국 공통 백업"
    };

  if (
    !isNationalRegion(
      originalRegion
    )
  ) {

    return {
      region:
        originalRegion,
      inferred:
        false,
      method:
        "source_registry"
    };
  }

  const titleRegion =
    inferTargetArtRegionFromValues(
      [
        title
      ]
    );

  if (
    titleRegion
  ) {

    return {
      region:
        titleRegion,
      inferred:
        true,
      method:
        "title"
    };
  }

  const evidenceValues =
    Array.isArray(
      detailEvidence
    )
      ? detailEvidence
      : (
          detailEvidence
            ? [
                detailEvidence
              ]
            : []
        );

  const detailRegion =
    inferTargetArtRegionFromValues(
      evidenceValues
    );

  if (
    detailRegion
  ) {

    return {
      region:
        detailRegion,
      inferred:
        true,
      method:
        "detail"
    };
  }

  return {
    region:
      originalRegion,
    inferred:
      false,
    method:
      "unresolved"
  };
}


/* =========================================================
   ITEM
========================================================= */

function buildItem(
  sourceRegion,
  source,
  title,
  sourceUrl,
  options
) {

  const config =
    options ||
    {};

  const today =
    todayKst();

  const nationalSource =
    isNationalRegion(
      sourceRegion
    );

  const resolution =
    config.regionResolution ||
    resolveCandidateRegion(
      sourceRegion,
      title,
      []
    );

  const resolvedRegion =
    resolution.region ||
    sourceRegion;

  const resolved =
    Boolean(
      resolvedRegion &&
      resolvedRegion.name &&
      resolvedRegion.name !==
        "전국"
    );

  return {
    id:
      stableId(
        sourceUrl
      ),
    category:
      "건축물 미술작품",
    categoryLabel:
      "건축물 미술작품",
    status:
      "마감일 확인 필요",
    source:
      source.sourceName,
    sourceName:
      source.sourceName,
    sourceType:
      source.sourceType,
    agency:
      source.sourceName,
    organization:
      source.sourceName,
    title:
      cleanText(
        title
      ),
    region:
      (
        resolvedRegion &&
        resolvedRegion.name
      ) ||
      "전국",
    regionId:
      (
        resolvedRegion &&
        resolvedRegion.id
      ) ||
      "",
    regionFullName:
      (
        resolvedRegion &&
        resolvedRegion.fullName
      ) ||
      "",
    sourceRegion:
      (
        sourceRegion &&
        sourceRegion.name
      ) ||
      "",
    sourceRegionId:
      (
        sourceRegion &&
        sourceRegion.id
      ) ||
      "",
    regionInferred:
      resolution.inferred ===
      true,
    regionInferenceSource:
      resolution.method,
    regionInferenceStatus:
      resolved
        ? "resolved"
        : "unresolved",
    regionGroup:
      source.regionGroup ||
      "",
    regionGroupLabel:
      source.regionGroupLabel ||
      "",
    sourceUrl:
      sourceUrl,
    originalUrl:
      sourceUrl,
    url:
      sourceUrl,
    rawSourcePageUrl:
      source.sourceUrl,
    publishedDate:
      "",
    postedDate:
      "",
    periodStart:
      "",
    periodEnd:
      "",
    deadline:
      "",
    endDate:
      "",
    budget:
      "",
    amount:
      "",
    amountNumeric:
      null,
    location:
      "",
    installationLocation:
      "",
    eligibility:
      "",
    detailExtractionStatus:
      "pending",
    detailExtractionCount:
      0,
    detailExtractionVersion:
      "",
    detailExtractionEvidence:
      {},
    keywords: [
      "건축물 미술작품",
      "미술작품 공모"
    ],
    matchedKeywords: [
      "미술작품",
      "공모"
    ],
    crawlMode:
      source.crawlMode ||
      "generic_board_discovery",
    priority:
      source.priority ||
      3,
    priorityLabel:
      source.priorityLabel ||
      "전국 자동수집",
    fitReason:
      nationalSource
        ? (
            resolved
              ? "전국 공통 소스에서 발견된 후보이며 공고 제목 또는 상세정보를 기준으로 실제 지역을 자동 판별했습니다."
              : "전국 공통 소스에서 건축물 미술작품 공모 키워드가 확인된 후보이며 실제 지역은 추가 확인이 필요합니다."
          )
        : "광역시·도 공식 소스에서 건축물 미술작품 공모 키워드가 확인된 후보입니다.",
    summary:
      "공고 원문에서 마감일, 참가자격, 작품비, 설치조건을 확인해야 합니다.",
    nextAction:
      "공고 원문 확인 후 마감일, 제출 방식, 설치 조건을 검토하세요.",
    recommendedAction:
      "공고 원문 확인 후 마감일, 제출 방식, 설치 조건을 검토하세요.",
    score:
      80,
    grade:
      "A",
    isExpired:
      false,
    isStaleCandidate:
      false,
    deadlineStatus:
      "마감일 확인 필요",
    collectedAt:
      today,
    updatedAt:
      today,
    collectionSourceId:
      source.id,
    collectionVersion:
      COLLECTION_VERSION
  };
}


/* =========================================================
   DETAIL ENRICHMENT
========================================================= */

function enrichNationalItemRegionFromDetail(
  item,
  sourceRegion,
  html
) {

  if (
    !item ||
    !isNationalRegion(
      sourceRegion
    )
  ) {

    return item;
  }

  if (
    item.regionInferenceStatus ===
      "resolved" &&
    item.regionInferenceSource ===
      "title"
  ) {

    return item;
  }

  const evidence =
    extractRegionEvidenceSnippets(
      html,
      item.title
    );

  const resolution =
    resolveCandidateRegion(
      sourceRegion,
      item.title,
      evidence
    );

  if (
    !resolution.region ||
    resolution.region.name ===
      "전국"
  ) {

    return item;
  }

  return {
    ...item,
    region:
      resolution.region.name,
    regionId:
      resolution.region.id,
    regionFullName:
      resolution.region.fullName,
    regionInferred:
      true,
    regionInferenceSource:
      resolution.method,
    regionInferenceStatus:
      "resolved",
    fitReason:
      "전국 공통 소스에서 발견된 후보이며 공고 제목 또는 상세정보를 기준으로 실제 지역을 자동 판별했습니다."
  };
}


function enrichItemFromDetailPage(
  item,
  sourceRegion,
  html,
  pageUrl
) {

  if (
    !item
  ) {

    return item;
  }

  const detail =
    extractArtDetail(
      html,
      {
        sourceUrl:
          pageUrl,
        title:
          item.title
      }
    );

  let enriched =
    mergeArtDetailIntoItem(
      item,
      detail
    );

  if (
    isNationalRegion(
      sourceRegion
    )
  ) {

    enriched =
      enrichNationalItemRegionFromDetail(
        enriched,
        sourceRegion,
        html
      );
  }

  return enriched;
}


/* =========================================================
   SOURCE CRAWL + ADAPTER + DIAGNOSTICS
========================================================= */

async function crawlSource(
  region,
  source
) {

  const startedAt =
    Date.now();

  const adapterInfo =
    describeSourceAdapter(
      source
    );

  let seedUrls =
    getSourceSeedUrls(
      source,
      {
        maxSeeds:
          MAX_SEEDS_PER_SOURCE
      }
    );

  seedUrls =
    buildCheongjuSearchSeedUrls(
      source,
      seedUrls
    );

  if (
    seedUrls.length ===
    0
  ) {

    return {
      sourceId:
        source.id,
      sourceName:
        source.sourceName,
      region:
        region.name,
      accessOk:
        false,
      pagesFetched:
        0,
      items:
        []
    };
  }

  console.log(
    "   🧩 ADAPTER" +
    " | id=" +
    adapterInfo.adapterId +
    " | applied=" +
    adapterInfo.applied +
    " | mode=" +
    adapterInfo.mode +
    " | seeds=" +
    seedUrls.length
  );

  if (
    source.id ===
    CHEONGJU_SOURCE_ID
  ) {

    console.log(
      "   🧩 CHEONGJU E-MINWON" +
      " | transport=POST-search" +
      " | jsResolver=enabled" +
      " | seeds=" +
      seedUrls.length
    );
  }

  if (
    adapterInfo.applied ||
    source.id ===
      CHEONGJU_SOURCE_ID
  ) {

    seedUrls.forEach(
      function (
        seedUrl,
        index
      ) {

        console.log(
          "      SEED #" +
          (
            index +
            1
          ) +
          ": " +
          seedUrl
        );
      }
    );
  }

  const queue =
    seedUrls.map(
      function (
        seedUrl
      ) {

        return {
          url:
            seedUrl,
          depth:
            0,
          seed:
            true,
          candidateDetail:
            false
        };
      }
    );

  const queued =
    new Set(
      seedUrls
    );

  const visited =
    new Set();

  const found =
    new Map();

  let pagesFetched =
    0;

  const diagnostics = {
    seedCount:
      seedUrls.length,
    htmlBytes:
      0,
    rawAnchors:
      0,
    extractedAnchors:
      0,
    javascriptAnchors:
      0,
    resolvedJavascriptAnchors:
      0,
    sameOriginAnchors:
      0,
    primaryKeywordAnchors:
      0,
    actionKeywordAnchors:
      0,
    candidateAnchors:
      0,
    navigationCandidates:
      0,
    redirectedPages:
      0,
    detailPages:
      0,
    detailExtracted:
      0,
    deadlineExtracted:
      0,
    agencyExtracted:
      0,
    amountExtracted:
      0,
    locationExtracted:
      0,
    eligibilityExtracted:
      0,
    sampleLabels:
      new Set()
  };

  while (
    queue.length &&
    pagesFetched <
      MAX_PAGES_PER_SOURCE &&
    (
      Date.now() -
      startedAt
    ) <
      MAX_SOURCE_BUDGET_MS
  ) {

    const current =
      queue.shift();

    if (
      !current ||
      visited.has(
        current.url
      )
    ) {

      continue;
    }

    visited.add(
      current.url
    );

    let fetchResult;

    try {

      fetchResult =
        await fetchText(
          current.url
        );

      pagesFetched++;

    } catch (
      error
    ) {

      console.warn(
        "   ⚠️ FETCH",
        current.url,
        error.message
      );

      continue;
    }

    const html =
      fetchResult.html ||
      "";

    const finalUrl =
      canonicalUrl(
        fetchResult.finalUrl ||
          current.url,
        current.url
      ) ||
      current.url;

    if (
      finalUrl !==
      current.url
    ) {

      diagnostics.redirectedPages++;
    }

    diagnostics.htmlBytes +=
      Buffer.byteLength(
        html,
        "utf8"
      );

    diagnostics.rawAnchors +=
      (
        html.match(
          /<a\b/gi
        ) ||
        []
      ).length;

    diagnostics.javascriptAnchors +=
      (
        html.match(
          /href\s*=\s*["']\s*javascript:/gi
        ) ||
        []
      ).length;

    let candidateKey =
      null;

    if (
      found.has(
        current.url
      )
    ) {

      candidateKey =
        current.url;

    } else if (
      found.has(
        finalUrl
      )
    ) {

      candidateKey =
        finalUrl;
    }

    if (
      candidateKey
    ) {

      diagnostics.detailPages++;

      const previousItem =
        found.get(
          candidateKey
        );

      const enrichedItem =
        enrichItemFromDetailPage(
          previousItem,
          region,
          html,
          finalUrl
        );

      found.set(
        candidateKey,
        enrichedItem
      );

      if (
        enrichedItem.detailExtractionCount >
        0
      ) {

        diagnostics.detailExtracted++;
      }

      if (
        enrichedItem.deadline
      ) {

        diagnostics.deadlineExtracted++;
      }

      if (
        enrichedItem.agency &&
        enrichedItem.agency !==
          source.sourceName
      ) {

        diagnostics.agencyExtracted++;
      }

      if (
        enrichedItem.amount
      ) {

        diagnostics.amountExtracted++;
      }

      if (
        enrichedItem.location
      ) {

        diagnostics.locationExtracted++;
      }

      if (
        enrichedItem.eligibility
      ) {

        diagnostics.eligibilityExtracted++;
      }

      if (
        previousItem.region ===
          "전국" &&
        enrichedItem.region !==
          "전국"
      ) {

        console.log(
          "   📍 REGION RESOLVED" +
          " | " +
          enrichedItem.region +
          " | " +
          enrichedItem.title
        );
      }

      console.log(
        "   📄 DETAIL" +
        " | fields=" +
        enrichedItem.detailExtractionCount +
        " | deadline=" +
        (
          enrichedItem.deadline ||
          "-"
        ) +
        " | agency=" +
        (
          enrichedItem.agency ||
          "-"
        ) +
        " | amount=" +
        (
          enrichedItem.amount ||
          "-"
        ) +
        " | location=" +
        (
          enrichedItem.location ||
          "-"
        )
      );
    }

    const anchors =
      extractAnchors(
        html,
        finalUrl
      );

    diagnostics.extractedAnchors +=
      anchors.length;

    diagnostics.resolvedJavascriptAnchors +=
      anchors.filter(
        function (
          anchor
        ) {

          return (
            anchor.attrs ===
            "cheongju-eminwon-resolved"
          );
        }
      ).length;

    anchors.forEach(
      function (
        anchor
      ) {

        const originAllowed =
          sameOrigin(
            source.sourceUrl,
            anchor.url
          ) ||
          sameOrigin(
            finalUrl,
            anchor.url
          );

        if (
          !originAllowed
        ) {

          return;
        }

        diagnostics.sameOriginAnchors++;

        const label =
          cleanText(
            anchor.label
          );

        if (
          diagnostics.sampleLabels.size <
            5 &&
          /미술|예술|작품|공모|art/i.test(
            label
          )
        ) {

          diagnostics.sampleLabels.add(
            label
          );
        }

        if (
          hasAnyKeyword(
            label,
            PRIMARY_KEYWORDS
          )
        ) {

          diagnostics.primaryKeywordAnchors++;
        }

        if (
          hasAnyKeyword(
            label,
            ACTION_KEYWORDS
          )
        ) {

          diagnostics.actionKeywordAnchors++;
        }

        if (
          !isCandidateTitle(
            label
          )
        ) {

          return;
        }

        diagnostics.candidateAnchors++;

        if (
          !found.has(
            anchor.url
          )
        ) {

          const regionResolution =
            resolveCandidateRegion(
              region,
              label,
              []
            );

          const item =
            buildItem(
              region,
              source,
              label,
              anchor.url,
              {
                regionResolution:
                  regionResolution
              }
            );

          found.set(
            anchor.url,
            item
          );

          if (
            isNationalRegion(
              region
            )
          ) {

            if (
              item.region !==
                "전국"
            ) {

              console.log(
                "   📍 REGION FROM TITLE" +
                " | " +
                item.region +
                " | " +
                item.title
              );

            } else {

              console.log(
                "   📍 REGION PENDING" +
                " | " +
                item.title
              );
            }
          }
        }

        if (
          !visited.has(
            anchor.url
          ) &&
          !queued.has(
            anchor.url
          )
        ) {

          queued.add(
            anchor.url
          );

          queue.unshift({
            url:
              anchor.url,
            depth:
              current.depth +
              1,
            seed:
              false,
            candidateDetail:
              true
          });
        }
      }
    );

    if (
      current.depth >=
      MAX_DEPTH
    ) {

      continue;
    }

    const followCandidates =
      anchors
        .filter(
          function (
            anchor
          ) {

            const originAllowed =
              sameOrigin(
                source.sourceUrl,
                anchor.url
              ) ||
              sameOrigin(
                finalUrl,
                anchor.url
              );

            if (
              !originAllowed
            ) {

              return false;
            }

            if (
              visited.has(
                anchor.url
              ) ||
              queued.has(
                anchor.url
              )
            ) {

              return false;
            }

            return (
              followScore(
                anchor
              ) >
              0
            );
          }
        )
        .sort(
          function (
            first,
            second
          ) {

            return (
              followScore(
                second
              ) -
              followScore(
                first
              )
            );
          }
        );

    diagnostics.navigationCandidates +=
      followCandidates.length;

    followCandidates
      .slice(
        0,
        MAX_PAGES_PER_SOURCE
      )
      .forEach(
        function (
          anchor
        ) {

          queued.add(
            anchor.url
          );

          queue.push({
            url:
              anchor.url,
            depth:
              current.depth +
              1,
            seed:
              false,
            candidateDetail:
              false
          });
        }
      );
  }

  const finalItems =
    Array.from(
      found.values()
    );

  const resolvedRegions =
    finalItems.filter(
      function (
        item
      ) {

        return (
          item.region &&
          item.region !==
            "전국"
        );
      }
    ).length;

  const unresolvedRegions =
    finalItems.filter(
      function (
        item
      ) {

        return (
          item.region ===
          "전국"
        );
      }
    ).length;

  if (
    pagesFetched >
    0
  ) {

    console.log(
      "   🔎 DIAG" +
      " | seeds=" +
      diagnostics.seedCount +
      " | htmlKB=" +
      Math.round(
        diagnostics.htmlBytes /
        1024
      ) +
      " | rawA=" +
      diagnostics.rawAnchors +
      " | parsedA=" +
      diagnostics.extractedAnchors +
      " | jsHref=" +
      diagnostics.javascriptAnchors +
      " | jsResolved=" +
      diagnostics.resolvedJavascriptAnchors +
      " | sameOrigin=" +
      diagnostics.sameOriginAnchors +
      " | primary=" +
      diagnostics.primaryKeywordAnchors +
      " | action=" +
      diagnostics.actionKeywordAnchors +
      " | candidate=" +
      diagnostics.candidateAnchors +
      " | nav=" +
      diagnostics.navigationCandidates +
      " | redirects=" +
      diagnostics.redirectedPages +
      " | detailPages=" +
      diagnostics.detailPages +
      " | detailExtracted=" +
      diagnostics.detailExtracted +
      " | deadline=" +
      diagnostics.deadlineExtracted +
      " | agency=" +
      diagnostics.agencyExtracted +
      " | amount=" +
      diagnostics.amountExtracted +
      " | location=" +
      diagnostics.locationExtracted +
      " | eligibility=" +
      diagnostics.eligibilityExtracted +
      " | regionResolved=" +
      resolvedRegions +
      " | regionPending=" +
      unresolvedRegions
    );

    if (
      diagnostics.sampleLabels.size >
      0
    ) {

      console.log(
        "   🔎 LABEL SAMPLE:"
      );

      Array.from(
        diagnostics.sampleLabels
      ).forEach(
        function (
          label
        ) {

          console.log(
            "      -",
            label
          );
        }
      );
    }
  }

  return {
    sourceId:
      source.id,
    sourceName:
      source.sourceName,
    region:
      region.name,
    accessOk:
      pagesFetched >
      0,
    pagesFetched:
      pagesFetched,
    items:
      finalItems
  };
}


/* =========================================================
   DATA MERGE
========================================================= */

function itemUrl(
  item
) {

  const value =
    item &&
    (
      item.sourceUrl ||
      item.originalUrl ||
      item.url ||
      ""
    );

  return canonicalUrl(
    value,
    value
  );
}


function chooseRegionMetadata(
  item,
  previous
) {

  const itemResolved =
    Boolean(
      item &&
      item.region &&
      item.region !==
        "전국"
    );

  const previousResolved =
    Boolean(
      previous &&
      previous.region &&
      previous.region !==
        "전국"
    );

  const chosen =
    itemResolved
      ? item
      : (
          previousResolved
            ? previous
            : item
        );

  return {
    region:
      (
        chosen &&
        chosen.region
      ) ||
      "전국",
    regionId:
      (
        chosen &&
        chosen.regionId
      ) ||
      "",
    regionFullName:
      (
        chosen &&
        chosen.regionFullName
      ) ||
      "",
    sourceRegion:
      (
        item &&
        item.sourceRegion
      ) ||
      (
        previous &&
        previous.sourceRegion
      ) ||
      "",
    sourceRegionId:
      (
        item &&
        item.sourceRegionId
      ) ||
      (
        previous &&
        previous.sourceRegionId
      ) ||
      "",
    regionInferred:
      Boolean(
        chosen &&
        chosen.regionInferred
      ),
    regionInferenceSource:
      (
        chosen &&
        chosen.regionInferenceSource
      ) ||
      "",
    regionInferenceStatus:
      (
        chosen &&
        chosen.regionInferenceStatus
      ) ||
      (
        (
          chosen &&
          chosen.region &&
          chosen.region !==
            "전국"
        )
          ? "resolved"
          : "unresolved"
      )
  };
}


function chooseDetailValue(
  freshValue,
  previousValue
) {

  if (
    freshValue !==
      undefined &&
    freshValue !==
      null &&
    freshValue !==
      ""
  ) {

    return freshValue;
  }

  if (
    previousValue !==
      undefined &&
    previousValue !==
      null
  ) {

    return previousValue;
  }

  return "";
}


function applyDetailMetadata(
  result,
  item,
  previous
) {

  result.deadline =
    chooseDetailValue(
      item.deadline,
      previous &&
      previous.deadline
    );

  result.endDate =
    chooseDetailValue(
      item.endDate,
      previous &&
      previous.endDate
    );

  result.publishedDate =
    chooseDetailValue(
      item.publishedDate,
      previous &&
      previous.publishedDate
    );

  result.postedDate =
    chooseDetailValue(
      item.postedDate,
      previous &&
      previous.postedDate
    );

  result.agency =
    chooseDetailValue(
      item.agency,
      previous &&
      previous.agency
    );

  result.organization =
    chooseDetailValue(
      item.organization,
      previous &&
      previous.organization
    );

  result.amount =
    chooseDetailValue(
      item.amount,
      previous &&
      previous.amount
    );

  result.budget =
    chooseDetailValue(
      item.budget,
      previous &&
      previous.budget
    );

  result.amountNumeric =
    (
      item.amountNumeric !==
        undefined &&
      item.amountNumeric !==
        null
    )
      ? item.amountNumeric
      : (
          previous &&
          previous.amountNumeric !==
            undefined
            ? previous.amountNumeric
            : null
        );

  result.location =
    chooseDetailValue(
      item.location,
      previous &&
      previous.location
    );

  result.installationLocation =
    chooseDetailValue(
      item.installationLocation,
      previous &&
      previous.installationLocation
    );

  result.eligibility =
    chooseDetailValue(
      item.eligibility,
      previous &&
      previous.eligibility
    );

  result.detailExtractionStatus =
    chooseDetailValue(
      item.detailExtractionStatus,
      previous &&
      previous.detailExtractionStatus
    );

  result.detailExtractionCount =
    (
      item.detailExtractionCount !==
        undefined
    )
      ? item.detailExtractionCount
      : (
          previous &&
          previous.detailExtractionCount
        ) ||
        0;

  result.detailExtractionVersion =
    chooseDetailValue(
      item.detailExtractionVersion,
      previous &&
      previous.detailExtractionVersion
    );

  result.detailExtractionEvidence =
    (
      item.detailExtractionEvidence &&
      Object.keys(
        item.detailExtractionEvidence
      ).length >
        0
    )
      ? item.detailExtractionEvidence
      : (
          previous &&
          previous.detailExtractionEvidence
        ) ||
        {};

  return result;
}


function mergeData(
  discovered
) {

  const live =
    readArray(
      DATA_FILE
    );

  const archive =
    readArray(
      ARCHIVE_FILE
    );

  const today =
    todayKst();

  const expiredUrls =
    new Set(
      archive
        .filter(
          function (
            item
          ) {

            return (
              item &&
              item.isExpired ===
                true
            );
          }
        )
        .map(
          itemUrl
        )
        .filter(
          Boolean
        )
    );

  const liveByUrl =
    new Map();

  const liveWithoutUrl =
    [];

  live.forEach(
    function (
      item
    ) {

      if (
        !item
      ) {

        return;
      }

      const url =
        itemUrl(
          item
        );

      if (
        url
      ) {

        liveByUrl.set(
          url,
          item
        );

      } else {

        liveWithoutUrl.push(
          item
        );
      }
    }
  );

  discovered.forEach(
    function (
      item
    ) {

      const url =
        itemUrl(
          item
        );

      if (
        !url
      ) {

        return;
      }

      if (
        expiredUrls.has(
          url
        ) &&
        !liveByUrl.has(
          url
        )
      ) {

        return;
      }

      const previous =
        liveByUrl.get(
          url
        );

      if (
        previous
      ) {

        const regionMetadata =
          chooseRegionMetadata(
            item,
            previous
          );

        const mergedItem = {
          ...item,
          ...previous,
          title:
            item.title ||
            previous.title,
          source:
            item.source,
          sourceName:
            item.sourceName,
          sourceType:
            item.sourceType,
          ...regionMetadata,
          collectionSourceId:
            item.collectionSourceId,
          collectionVersion:
            item.collectionVersion,
          updatedAt:
            today
        };

        applyDetailMetadata(
          mergedItem,
          item,
          previous
        );

        liveByUrl.set(
          url,
          mergedItem
        );

      } else {

        liveByUrl.set(
          url,
          item
        );
      }
    }
  );

  const archiveByUrl =
    new Map();

  const archiveWithoutUrl =
    [];

  archive.forEach(
    function (
      item
    ) {

      if (
        !item
      ) {

        return;
      }

      const url =
        itemUrl(
          item
        );

      if (
        url
      ) {

        archiveByUrl.set(
          url,
          item
        );

      } else {

        archiveWithoutUrl.push(
          item
        );
      }
    }
  );

  discovered.forEach(
    function (
      item
    ) {

      const url =
        itemUrl(
          item
        );

      if (
        !url
      ) {

        return;
      }

      const previous =
        archiveByUrl.get(
          url
        );

      const regionMetadata =
        chooseRegionMetadata(
          item,
          previous
        );

      const mergedItem = {
        ...item,
        ...(previous || {}),
        title:
          item.title ||
          (
            previous &&
            previous.title
          ) ||
          "",
        source:
          item.source,
        sourceName:
          item.sourceName,
        sourceType:
          item.sourceType,
        ...regionMetadata,
        collectionSourceId:
          item.collectionSourceId,
        collectionVersion:
          item.collectionVersion,
        archiveFirstSeenAt:
          (
            previous &&
            previous.archiveFirstSeenAt
          ) ||
          today,
        archiveLastSeenAt:
          today,
        archiveIsCurrent:
          true,
        collectedAt:
          (
            previous &&
            previous.collectedAt
          ) ||
          today,
        updatedAt:
          today
      };

      applyDetailMetadata(
        mergedItem,
        item,
        previous
      );

      archiveByUrl.set(
        url,
        mergedItem
      );
    }
  );

  const nextLive =
    Array.from(
      liveByUrl.values()
    )
      .concat(
        liveWithoutUrl
      );

  const nextArchive =
    Array.from(
      archiveByUrl.values()
    )
      .concat(
        archiveWithoutUrl
      );

  writeArray(
    DATA_FILE,
    nextLive
  );

  writeArray(
    ARCHIVE_FILE,
    nextArchive
  );

  return {
    liveCount:
      nextLive.length,
    archiveCount:
      nextArchive.length
  };
}


/* =========================================================
   SOURCE GROUP RUNNER
========================================================= */

async function runSourceGroup(
  options
) {

  const sources =
    options.sources ||
    [];

  const region =
    options.region;

  const discovered =
    options.discovered;

  const counters =
    options.counters;

  for (
    const source of
    sources
  ) {

    console.log(
      "   SOURCE:",
      source.sourceName
    );

    try {

      const result =
        await crawlSource(
          region,
          source
        );

      if (
        result.accessOk
      ) {

        counters.success++;

        console.log(
          "   ✅ ACCESS OK" +
          " | pages=" +
          result.pagesFetched +
          " | items=" +
          result.items.length
        );

      } else {

        counters.failed++;

        console.log(
          "   ❌ ACCESS FAILED" +
          " | pages=0" +
          " | items=0"
        );
      }

      if (
        result.items.length >
        0
      ) {

        console.log(
          "   🎯 ITEMS FOUND:",
          result.items.length
        );

        discovered.push(
          ...result.items
        );
      }

    } catch (
      error
    ) {

      counters.failed++;

      console.warn(
        "   ⚠️ SOURCE FAILED:",
        source.sourceName,
        "|",
        error.message
      );
    }
  }
}


/* =========================================================
   RUN
========================================================= */

async function main() {

  const registry =
    getRegionalSources();

  const targetRegions =
    registry.filter(
      function (
        region
      ) {

        return (
          !SPECIALIZED_REGION_IDS.has(
            region.id
          )
        );
      }
    );

  const nationalSources =
    getNationalSources();

  console.log(
    ""
  );

  console.log(
    "===================================="
  );

  console.log(
    "AXOO REMAINING REGION COLLECTOR"
  );

  console.log(
    "===================================="
  );

  console.log(
    "VERSION:",
    COLLECTION_VERSION
  );

  console.log(
    "대상 지역:",
    targetRegions.length
  );

  console.log(
    "전국 백업 소스:",
    nationalSources.length
  );

  const discovered =
    [];

  const counters = {
    success:
      0,
    failed:
      0
  };

  for (
    const region of
    targetRegions
  ) {

    console.log(
      ""
    );

    console.log(
      "▶",
      region.fullName
    );

    const sources =
      region.sources.slice(
        0,
        MAX_SOURCES_PER_REGION
      );

    if (
      sources.length ===
      0
    ) {

      console.log(
        "   ⚠️ 등록된 소스 없음"
      );

      continue;
    }

    await runSourceGroup({
      sources:
        sources,
      region:
        region,
      discovered:
        discovered,
      counters:
        counters
    });
  }

  const nationalRegion = {
    id:
      "national",
    name:
      "전국",
    fullName:
      "전국 공통 백업"
  };

  console.log(
    ""
  );

  console.log(
    "▶ 전국 공통 백업"
  );

  if (
    nationalSources.length ===
    0
  ) {

    console.log(
      "   ⚠️ 등록된 전국 공통 소스 없음"
    );

  } else {

    await runSourceGroup({
      sources:
        nationalSources,
      region:
        nationalRegion,
      discovered:
        discovered,
      counters:
        counters
    });
  }

  const unique =
    new Map();

  discovered.forEach(
    function (
      item
    ) {

      const url =
        itemUrl(
          item
        );

      if (
        url &&
        !unique.has(
          url
        )
      ) {

        unique.set(
          url,
          item
        );
      }
    }
  );

  const items =
    Array.from(
      unique.values()
    );

  const nationalItems =
    items.filter(
      function (
        item
      ) {

        return (
          item.sourceRegion ===
          "전국"
        );
      }
    );

  const nationalResolved =
    nationalItems.filter(
      function (
        item
      ) {

        return (
          item.region &&
          item.region !==
            "전국"
        );
      }
    ).length;

  const nationalPending =
    nationalItems.filter(
      function (
        item
      ) {

        return (
          item.region ===
          "전국"
        );
      }
    ).length;

  const detailEnriched =
    items.filter(
      function (
        item
      ) {

        return (
          item.detailExtractionCount >
          0
        );
      }
    ).length;

  const deadlineEnriched =
    items.filter(
      function (
        item
      ) {

        return Boolean(
          item.deadline
        );
      }
    ).length;

  const amountEnriched =
    items.filter(
      function (
        item
      ) {

        return Boolean(
          item.amount
        );
      }
    ).length;

  const merged =
    mergeData(
      items
    );

  console.log(
    ""
  );

  console.log(
    "===================================="
  );

  console.log(
    "REMAINING REGION SUMMARY"
  );

  console.log(
    "===================================="
  );

  console.log(
    "지역:",
    targetRegions.length
  );

  console.log(
    "전국 백업 소스:",
    nationalSources.length
  );

  console.log(
    "성공 소스:",
    counters.success
  );

  console.log(
    "실패 소스:",
    counters.failed
  );

  console.log(
    "신규/발견 후보:",
    items.length
  );

  console.log(
    "상세정보 추출 후보:",
    detailEnriched
  );

  console.log(
    "마감일 추출:",
    deadlineEnriched
  );

  console.log(
    "작품비 추출:",
    amountEnriched
  );

  console.log(
    "전국 후보 실제 지역 판별:",
    nationalResolved
  );

  console.log(
    "전국 후보 지역 미확정:",
    nationalPending
  );

  console.log(
    "LIVE:",
    merged.liveCount
  );

  console.log(
    "ARCHIVE:",
    merged.archiveCount
  );

  console.log(
    "===================================="
  );

  if (
    counters.failed >
    0
  ) {

    console.log(
      "::warning title=일부 미술작품 수집 소스 접근 실패::" +
      counters.failed +
      "개 소스 접근에 실패했지만 나머지 수집은 완료했습니다."
    );
  }

  if (
    nationalPending >
    0
  ) {

    console.log(
      "::warning title=전국 백업 후보 지역 미확정::" +
      nationalPending +
      "개 후보는 지역을 확신할 수 없어 전국 상태로 유지했습니다."
    );
  }

  console.log(
    ""
  );

  console.log(
    "✅ 남은 13개 지역 + 전국 공통 백업 수집 완료"
  );
}


/* =========================================================
   START
========================================================= */

if (
  require.main ===
  module
) {

  main()
    .catch(
      function (
        error
      ) {

        console.error(
          "[AXOO REMAINING COLLECTOR]",
          error
        );

        process.exitCode =
          1;
      }
    );
}


/* =========================================================
   TEST EXPORT
========================================================= */

module.exports = {
  isCandidateTitle,
  cleanText,
  extractAnchors,
  followScore,
  canonicalUrl,
  crawlSource,
  resolveCandidateRegion,
  extractRegionEvidenceSnippets,
  enrichNationalItemRegionFromDetail,
  enrichItemFromDetailPage,
  buildItem,
  isCheongjuEminwonListUrl,
  buildCheongjuSearchSeedUrls,
  buildCheongjuPostBody,
  extractCheongjuManagementNo,
  extractCheongjuEminwonAnchors
};
