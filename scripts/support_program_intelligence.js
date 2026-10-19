"use strict";

const BUSINESS_AREAS = [
  {
    code: "exhibition_space",
    label: "전시·공간",
    keywords: [
      "전시", "전시기획", "전시 기획", "공간", "공간디자인", "공간 디자인",
      "아트페어", "갤러리", "팝업", "쇼케이스", "박람회"
    ]
  },
  {
    code: "public_art_design",
    label: "공공미술·디자인",
    keywords: [
      "공공미술", "공공 미술", "공공예술", "공공 예술", "조형", "조형물",
      "설치미술", "설치 미술", "벽화", "공예", "공공디자인", "공공 디자인"
    ]
  },
  {
    code: "digital_media",
    label: "미디어아트·기술",
    keywords: [
      "미디어아트", "미디어 아트", "미디어파사드", "미디어 파사드", "실감콘텐츠",
      "실감 콘텐츠", "인터랙티브", "예술기술", "예술 기술", "문화기술", "문화 기술",
      "인공지능", "ai", "xr", "vr", "ar", "메타버스", "신기술"
    ]
  },
  {
    code: "content_brand",
    label: "콘텐츠 제작·브랜딩",
    keywords: [
      "콘텐츠", "콘텐츠 제작", "제작지원", "제작 지원", "브랜드", "브랜딩",
      "디자인개발", "디자인 개발", "문화상품", "문화 상품", "제품개발", "제품 개발",
      "영상", "홍보", "프로모션"
    ]
  },
  {
    code: "business_distribution",
    label: "사업화·유통",
    keywords: [
      "사업화", "유통", "전시유통", "전시 유통", "창업", "예술기업", "예술 기업",
      "예술산업", "예술 산업", "크라우드펀딩", "투자", "판로", "마케팅"
    ]
  },
  {
    code: "collaboration_global",
    label: "협업·해외진출",
    keywords: [
      "협업", "콜라보레이션", "기업협력", "기업 협력", "기업연계", "기업 연계",
      "수요기업", "수요 기업", "공급기업", "공급 기업", "해외진출", "해외 진출",
      "글로벌", "국제교류", "국제 협력", "파트너사"
    ]
  }
];

const HARD_EXCLUDE_PATTERNS = [
  /선정\s*결과/i,
  /결과\s*발표/i,
  /심사\s*결과/i,
  /채용/i,
  /교육생\s*모집/i,
  /수강생\s*모집/i,
  // Office tenancy is not an AXOO art-project grant or commission.
  /입주\s*기업\s*모집/i,
  /신규\s*입주\s*기업/i,
  /후보자?\s*추천/i
];

const COMPANY_ELIGIBILITY_PATTERNS = [
  /기업/i,
  /법인/i,
  /사업자/i,
  /단체/i,
  /기관/i,
  /컨소시엄/i
];

const INDIVIDUAL_ONLY_PATTERNS = [
  /개인만\s*(?:신청|지원|참여)/i,
  /개인에\s*한함/i,
  /개인\s*예술가만/i
];

const DELIVERY_PATTERNS = [
  /기획/i,
  /제작/i,
  /설치/i,
  /운영/i,
  /디자인/i,
  /콘텐츠/i,
  /프로젝트/i
];

const COMMERCIAL_PATTERNS = [
  /지원금/i,
  /사업화/i,
  /유통/i,
  /판로/i,
  /투자/i,
  /해외/i,
  /마케팅/i,
  /프로모션/i
];

const DOWNRANK_PATTERNS = [
  /공연/i,
  /연극/i,
  /뮤지컬/i,
  /무용/i,
  /국악/i,
  /음악/i,
  /문학/i,
  /웹툰/i,
  /게임/i,
  /애니메이션/i,
  /방송/i,
  /영화/i,
  /출판/i
];

function cleanText(value) {
  return String(value == null ? "" : value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  return String(value == null ? "" : value)
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function htmlToText(html) {
  // AXOO_EVIDENCE_QA_V1: Ignore global menus, headers, and footer text.
  const raw = String(html == null ? "" : html);
  const cleaned = raw
    .replace(/<head\b[\s\S]*?<\/head>/gi, " ")
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const main = cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const body = main ? main[1] : cleaned;
  return cleanText(decodeEntities(
    body.replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(?:p|div|li|tr|h[1-6]|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  ));
}

function extractLabelWindow(text, labels, length = 360, stopLabels = []) {
  const source = cleanText(text);
  let best = "";
  for (const label of labels) {
    const index = source.indexOf(label);
    if (index < 0) continue;
    const window = source.slice(index + label.length, index + length);
    let end = window.length;
    for (const stop of stopLabels) {
      const at = window.indexOf(stop);
      if (at >= 0 && at < end) end = at;
    }
    const candidate = cleanText(label + " " + window.slice(0, end));
    if (candidate.length > label.length + 2 && candidate.length > best.length) best = candidate;
  }
  return best;
}

function parseMoneyAmount(value) {
  const source = cleanText(value);
  const matches = [
    ...source.matchAll(/(?:최대|총|지원금|지원규모|사업비|금액)?\s*([0-9][0-9,.]*)\s*(억원|천만원|백만원|만원|원)/gi)
  ];

  const multipliers = {
    억원: 100000000,
    천만원: 10000000,
    백만원: 1000000,
    만원: 10000,
    원: 1
  };

  return matches.reduce((highest, match) => {
    const raw = Number(String(match[1]).replaceAll(",", ""));
    const amount = Number.isFinite(raw) ? raw * (multipliers[match[2]] || 1) : 0;
    return amount > highest && amount <= 100000000000 ? amount : highest;
  }, 0);
}

function extractSupportDetail(html) {
  const text = htmlToText(html);
  const eligibility = extractLabelWindow(
    text, ["지원대상", "신청자격", "지원자격", "공모대상", "신청대상", "모집대상"],
    420, [" 지역 ", " 신청기간", " 사업유형", " 온라인신청", " 첨부파일", " 지원내용", " 신청방법", " 접수방법"]
  );
  const supportDetails = extractLabelWindow(
    text, ["지원내용", "지원규모", "사업내용", "지원분야", "사업목적", "공모내용"],
    520, [" 신청방법", " 접수방법", " 제출서류", " 신청기간", " 지원대상", " 신청자격", " 첨부파일"]
  );
  const application = extractLabelWindow(
    text, ["신청방법", "접수방법", "제출서류", "신청기간", "접수기간"],
    360, [" 지원대상", " 지원내용", " 첨부파일", " 지원자격", " 사업유형"]
  );
  return {
    detailText: text.slice(0, 12000),
    // Do not claim the site's menu text is a support-program description.
    detailSummary: supportDetails,
    eligibility,
    supportDetails,
    application,
    supportAmount: parseMoneyAmount(supportDetails)
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function findMatches(source, values) {
  const normalized = cleanText(source).toLowerCase();
  return unique(values.filter(value => {
    const keyword = value.toLowerCase();
    // AI / XR / VR / AR must match as tokens, not portions of English words.
    if (/^[a-z]{1,3}$/.test(keyword)) {
      return new RegExp("(^|[^a-z0-9])" + keyword + "(?=$|[^a-z0-9])").test(normalized);
    }
    return normalized.includes(keyword);
  }));
}

function classifyBusinessAreas(value, titleValue = "") {
  const source = cleanText(value);
  const ranked = BUSINESS_AREAS.map(area => ({
    code: area.code,
    label: area.label,
    keywords: findMatches(source, area.keywords),
    titleKeywords: findMatches(titleValue, area.keywords)
  }))
    .filter(area => area.keywords.length)
    .sort((a, b) =>
      (b.titleKeywords.length * 3 + b.keywords.length) -
      (a.titleKeywords.length * 3 + a.keywords.length)
    );

  if (!ranked.length) {
    return [{ code: "other", label: "기타", keywords: [] }];
  }

  return ranked.slice(0, 3);
}

function hasAnyPattern(source, patterns) {
  return patterns.some(pattern => pattern.test(source));
}

function countPatternMatches(source, patterns) {
  return patterns.reduce((count, pattern) => count + (pattern.test(source) ? 1 : 0), 0);
}

function analyzeSupportProgram({
  title = "",
  detailText = "",
  eligibility = "",
  supportDetails = "",
  sourceCode = ""
} = {}) {
  // Full website text is not reliable scoring evidence; use explicit sections.
  const combined = cleanText([title, eligibility, supportDetails].join(" "));
  const categorySource = combined;
  const areas = classifyBusinessAreas(categorySource, title);
  const matchedKeywords = unique(areas.flatMap(area => area.keywords));
  const hardExcluded = hasAnyPattern(title, HARD_EXCLUDE_PATTERNS);
  // Only positive eligibility statements can establish a plausible corporate applicant.
  const eligibilityBody = cleanText(eligibility.replace(/^(?:지원대상|신청자격|지원자격|공모대상|신청대상|모집대상)\s*[:：]?/, ""));
  const companyEligible = eligibilityBody.length >= 5 &&
    hasAnyPattern(eligibilityBody.slice(0, 160), COMPANY_ELIGIBILITY_PATTERNS);
  const individualOnly = hasAnyPattern(eligibility, INDIVIDUAL_ONLY_PATTERNS);
  const deliveryMatches = countPatternMatches(combined, DELIVERY_PATTERNS);
  const commercialMatches = countPatternMatches(combined, COMMERCIAL_PATTERNS);
  const downrankMatches = countPatternMatches(`${title} ${supportDetails}`, DOWNRANK_PATTERNS);
  const hasDetail = cleanText(detailText).length >= 90 &&
    (cleanText(supportDetails).length >= 20 || eligibilityBody.length >= 16);

  const relevance = Math.min(38, areas[0].code === "other" ? 8 : 20 + matchedKeywords.length * 3);
  const eligibilityScore = individualOnly ? 0 : companyEligible ? 18 : 8;
  const executionScore = Math.min(18, deliveryMatches * 4);
  const businessScore = Math.min(16, commercialMatches * 3);
  const evidenceScore = hasDetail ? 10 : 3;
  const penalty = Math.min(55, downrankMatches * 22 + (individualOnly ? 25 : 0));

  let score = relevance + eligibilityScore + executionScore + businessScore + evidenceScore - penalty;
  if (hardExcluded) score = Math.min(score, 35);
  if (!hasDetail) score = Math.min(score, 69);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const grade = score >= 85 ? "S" : score >= 70 ? "A" : score >= 55 ? "B" : "C";
  const fitVerdict =
    grade === "S" ? "최우선 검토" :
      grade === "A" ? "적합도 높음" :
        grade === "B" ? "조건부 검토" : "낮은 적합도";

  const evidence = [];
  if (areas[0].code !== "other") evidence.push(`${areas[0].label} 사업영역과 연결`);
  if (companyEligible) evidence.push("기업·법인·단체 참여 단서(자격 재확인 필요)");
  if (deliveryMatches) evidence.push("기획·제작·운영 수행역량 활용 가능");
  if (commercialMatches) evidence.push("사업화·유통·지원금 요소 확인");
  if (individualOnly) evidence.push("개인 전용 가능성 있어 자격 재확인 필요");
  if (downrankMatches) evidence.push("AXOO 비핵심 장르 비중으로 감점");
  if (!hasDetail) evidence.push("상세 본문 부족으로 보수적 평가");

  const reason = `${fitVerdict}: ${evidence.slice(0, 4).join(" · ") || "상세 자격과 수행범위 확인 필요"}`;

  return {
    score,
    grade,
    fitVerdict,
    reason,
    matchedKeywords,
    businessArea: areas[0].code,
    businessAreaLabel: areas[0].label,
    businessAreas: areas.map(area => ({ code: area.code, label: area.label })),
    scoreBreakdown: [
      { code: "relevance", label: "사업영역", score: relevance, maxScore: 38 },
      { code: "eligibility", label: "지원자격", score: eligibilityScore, maxScore: 18 },
      { code: "execution", label: "수행역량", score: executionScore, maxScore: 18 },
      { code: "business", label: "사업성", score: businessScore, maxScore: 16 },
      { code: "evidence", label: "상세근거", score: evidenceScore, maxScore: 10 },
      { code: "penalty", label: "감점", score: -penalty, maxScore: 0 }
    ],
    scoreReasons: evidence,
    analysisConfidence: hasDetail ? "high" : "low",
    analysisBasis: hasDetail ? "상세 공고문" : "공고 제목",
    companyEligible,
    individualOnly,
    isExcluded: hardExcluded,
    hardExcludeMatches: hardExcluded ? ["결과·채용·교육 등 비지원 공고"] : [],
    negativeMatches: downrankMatches ? ["비핵심 장르"] : [],
    sourceCode
  };
}

module.exports = {
  BUSINESS_AREAS,
  analyzeSupportProgram,
  classifyBusinessAreas,
  extractSupportDetail,
  htmlToText,
  parseMoneyAmount
};
