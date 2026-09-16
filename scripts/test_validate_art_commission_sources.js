const assert = require("assert");

const {
  G2B_CHANNEL,
  validateAll
} = require("./validate_art_commission_sources");


function fakeResponse(status, url, redirected = false) {
  return {
    status,
    url,
    redirected,
    headers: {
      get(name) {
        return name === "content-type" ? "text/html; charset=utf-8" : "";
      }
    }
  };
}


const sources = [
  {
    id: "official-board",
    region: "대전",
    sourceName: "대전광역시 공고",
    sourceType: "official_notice",
    crawlMode: "board",
    sourceUrl: "https://example.test/notice"
  },
  {
    id: G2B_CHANNEL.id,
    region: G2B_CHANNEL.region,
    sourceName: G2B_CHANNEL.sourceName,
    sourceType: G2B_CHANNEL.sourceType,
    crawlMode: G2B_CHANNEL.crawlMode,
    sourceUrl: "https://example.test/g2b"
  },
  {
    id: "unreachable-board",
    region: "제주",
    sourceName: "제주 공고",
    sourceType: "official_notice",
    crawlMode: "board",
    sourceUrl: "https://example.test/fail"
  }
];


validateAll({
  sources,
  concurrency: 2,
  validatedAt: "2026-09-11",
  fetchImpl: async url => {
    if (url.includes("fail")) throw new Error("network unavailable");
    if (url.includes("g2b")) return fakeResponse(302, "https://example.test/g2b-final", true);
    return fakeResponse(200, url);
  }
})
  .then(report => {
    assert.strictEqual(report.channelCount, 3);
    assert.strictEqual(report.reachableCount, 2);
    assert.strictEqual(report.unreachableCount, 1);
    assert.strictEqual(report.channels[1].redirected, true);
    assert.strictEqual(report.channels[2].error, "network unavailable");
    console.log("✅ art commission source validation tests passed");
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
