const fs = require("fs");
const path = require("path");

const {
  loadSourceTargets
} = require("./art_commission_sources");


/* =========================================================
   SOURCE LINK VALIDATION

   등록된 지자체·개발공사·전국 채널을 실제 HTTP 요청으로 점검한다.
   수집 실패와 링크 오류를 구분하기 위해, HTTP 상태·최종 URL·응답
   콘텐츠 유형을 데이터 파일로 남긴다. 일부 공공기관의 차단은
   경고로 기록하되 전체 수집을 중단시키지는 않는다.
========================================================= */

const OUTPUT_FILE = path.join(
  process.cwd(),
  "data",
  "art_commission_source_validation.json"
);

const TIMEOUT_MS = 15000;
const CONCURRENCY = 6;

const G2B_CHANNEL = {
  id: "g2b_architectural_art",
  region: "전국",
  sourceName: "나라장터 건축물 미술작품",
  sourceType: "national_procurement",
  sourceUrl: "https://www.g2b.go.kr",
  crawlMode: "dataset_import",
  enabled: true
};


function todayKst() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));

  return [values.year, values.month, values.day].join("-");
}


function validationChannels() {
  const sources = loadSourceTargets().filter(source => source && source.enabled !== false);
  const hasG2b = sources.some(source => source.id === G2B_CHANNEL.id);

  return hasG2b ? sources : sources.concat(G2B_CHANNEL);
}


function safeFinalUrl(value, fallback) {
  try {
    const url = new URL(value || fallback);

    Array.from(url.searchParams.keys()).forEach(key => {
      if (/key|token|session|bodydata/i.test(key)) {
        url.searchParams.delete(key);
      }
    });

    return url.toString();
  } catch (error) {
    return fallback;
  }
}


async function validateChannel(source, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs || TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetchImpl(source.sourceUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "AXOO-B2G-Art-Source-Validator/1.0"
      }
    });

    const status = Number(response.status || 0);
    const reachable = status >= 200 && status < 400;

    return {
      id: source.id,
      region: source.region,
      sourceName: source.sourceName,
      sourceType: source.sourceType,
      crawlMode: source.crawlMode,
      configuredUrl: source.sourceUrl,
      finalUrl: safeFinalUrl(response.url, source.sourceUrl),
      reachable,
      status,
      redirected: Boolean(response.redirected),
      contentType: response.headers && response.headers.get("content-type") || "",
      elapsedMs: Date.now() - startedAt,
      error: ""
    };
  } catch (error) {
    return {
      id: source.id,
      region: source.region,
      sourceName: source.sourceName,
      sourceType: source.sourceType,
      crawlMode: source.crawlMode,
      configuredUrl: source.sourceUrl,
      finalUrl: "",
      reachable: false,
      status: 0,
      redirected: false,
      contentType: "",
      elapsedMs: Date.now() - startedAt,
      error: error && error.name === "AbortError" ? "timeout" : String(error && error.message || error)
    };
  } finally {
    clearTimeout(timeout);
  }
}


async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}


async function validateAll(options = {}) {
  const sources = options.sources || validationChannels();
  const results = await mapWithConcurrency(
    sources,
    options.concurrency || CONCURRENCY,
    source => validateChannel(source, options)
  );
  const reachableCount = results.filter(result => result.reachable).length;

  return {
    validatedAt: options.validatedAt || todayKst(),
    channelCount: results.length,
    reachableCount,
    unreachableCount: results.length - reachableCount,
    channels: results
  };
}


function writeReport(report) {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2) + "\n", "utf8");
}


if (require.main === module) {
  validateAll()
    .then(report => {
      writeReport(report);
      console.log("검증 채널:", report.channelCount);
      console.log("직접 연결 성공:", report.reachableCount);
      console.log("직접 연결 실패:", report.unreachableCount);

      report.channels
        .filter(channel => !channel.reachable)
        .forEach(channel => {
          console.log(
            "::warning title=공고 소스 연결 확인 필요::" +
            channel.region + " | " + channel.sourceName + " | " +
            (channel.error || "HTTP " + channel.status)
          );
        });
    })
    .catch(error => {
      console.error("[AXOO SOURCE VALIDATOR]", error);
      process.exitCode = 1;
    });
}


module.exports = {
  G2B_CHANNEL,
  validationChannels,
  safeFinalUrl,
  validateChannel,
  validateAll
};
