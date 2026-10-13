const assert = require("assert");

const {
  API_ENDPOINTS
} = require("./collect_g2b_opportunities");


const operations = new Set(
  API_ENDPOINTS.map(endpoint => endpoint.operation)
);

[
  "getBidPblancListInfoServc",
  "getBidPblancListInfoThng",
  "getBidPblancListInfoCnstwk"
].forEach(operation => {
  assert(
    operations.has(operation),
    operation + " 조회가 전국 나라장터 수집 범위에 포함되어야 합니다."
  );
});

assert.strictEqual(
  operations.size,
  API_ENDPOINTS.length,
  "나라장터 수집 API가 중복 등록되면 안 됩니다."
);

console.log("✅ G2B collection coverage tests passed");
