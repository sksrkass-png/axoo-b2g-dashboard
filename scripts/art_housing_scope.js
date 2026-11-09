/* AXOO B2G: housing-only building artwork notice policy (Node + GitHub Pages). */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.AxooHousingArt = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  function text(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function compact(value) {
    return text(value).toLowerCase().replace(/[\s·ㆍ:：,，.。/\\()[\]{}_\-–—'’‘“”]/g, "");
  }

  function titleOf(item) {
    return text(item && (item.title || item.bidNtceNm || item.noticeTitle));
  }

  function getExclusionKeys(item) {
    if (!item || typeof item !== "object") return [];
    const keys = [];
    const url = text(item.sourceUrl || item.originalUrl || item.bidNtceUrl || item.url)
      .replace(/\/+$/, "").toLowerCase();
    const notice = text(item.bidNtceNo || item.noticeNo);
    const id = text(item.id);
    if (url) keys.push("url:" + url);
    if (notice) keys.push("notice:" + notice.toLowerCase());
    if (id) keys.push("id:" + id.toLowerCase());
    if (!keys.length) {
      keys.push("fallback:" + compact(titleOf(item)) + ":" +
        compact(item.agency || item.ntceInsttNm) + ":" +
        text(item.publishedDate || item.bidNtceDt));
    }
    return keys;
  }

  function exclusionSet(exclusions) {
    const entries = Array.isArray(exclusions) ? exclusions
      : (exclusions && Array.isArray(exclusions.excluded) ? exclusions.excluded : []);
    const result = new Set();
    entries.forEach(entry => {
      if (typeof entry === "string") result.add(entry);
      else if (entry && typeof entry === "object") {
        (Array.isArray(entry.keys) ? entry.keys : [entry.key])
          .filter(Boolean).forEach(key => result.add(String(key)));
      }
    });
    return result;
  }

  function isExcluded(item, exclusions) {
    const blocked = exclusions instanceof Set ? exclusions : exclusionSet(exclusions);
    return getExclusionKeys(item).some(key => blocked.has(key));
  }

  const NON_HOUSING_THEMES = [
    /지역\s*농\s*특산물/, /농특산물/, /한우\s*테마/, /우주\s*항공\s*테마/,
    /테마\s*거리/, /테마\s*공원/, /민속\s*시장/, /민속\s*5일장/,
    /관광\s*경관/, /관광\s*명소화/, /도시\s*재생/, /골목\s*상권/,
    /소상공인/, /축제/, /트리\s*설치/, /성탄/, /야생화\s*마을/,
    /전시\s*온실/, /전시관/, /박물관/, /병원/, /청사/, /도매\s*시장/,
    /녹지\s*공간/, /서당골천/, /본관\s*잔디/, /학생회관/, /변전소\s*조형물/
  ];

  const HOUSING_TERMS = [
    /공동\s*주택/, /공공\s*주택/, /임대\s*주택/, /민간\s*임대/,
    /주택\s*건설/, /주택\s*신축/, /주택\s*재개발/, /지역\s*주택\s*조합/,
    /가로\s*주택\s*정비/, /주택\s*재건축/, /재건축\s*정비/,
    /아파트/, /빌라/, /주상\s*복합/, /주거\s*복합/, /주거\s*단지/,
    /주거\s*시설/, /\bapt\b/i, /\d+\s*단지/,
    /(?:^|[^a-z])[a-z]\s*-?\s*\d{1,3}\s*(?:bl|블록|블럭)(?=$|[^a-z])/i,
    /\b\d{1,3}\s*(?:bl|블록|블럭)(?=$|[^a-z])/i,
    /(?:왕숙|고덕|창릉|운정|대장|당수|장항|옥정|월암|화양|금토|풍무역세권)\s*[a-z]?\s*-?\s*\d+/i
  ];

  const APARTMENT_BRANDS = [
    "푸르지오", "힐스테이트", "래미안", "롯데캐슬", "e편한세상",
    "자이", "더샵", "아이파크", "서한이다음", "시티프라디움",
    "수자인", "호반써밋", "우미린", "포레나", "두산위브",
    "서희스타힐스", "디에트르", "센트레빌", "리슈빌",
    "하이니티", "아테라", "반도유보라", "한라비발디"
  ];

  function evaluate(item) {
    const title = titleOf(item);
    if (!title) return { allowed: false, reason: "missing_title" };

    // Never trust synthesized "categoryLabel" or "keywords" as proof of legal scope.
    // Likewise, detailTextSample can contain unrelated Previous/Next notices in site navigation.
    const context = [
      title,
      item.projectName,
      item.location,
      item.installationLocation,
      item.rawText,
      item.ntceSpecFileNm1,
      item.ntceSpecFileNm2,
      item.ntceSpecFileNm3,
      item.ntceSpecFileNm4,
      item.ntceSpecFileNm5
    ].map(text).filter(Boolean).join(" ");
    const isArt = /미술\s*작품|미술\s*장식|조각\s*작품|공공\s*미술/i.test(title);
    const officialSource = /^(?:gyeonggi_public_art|lh_notice|sh_notice|seoul_public_art|incheon_city_art_commission|busan_city_art_commission|daejeon_city_notice)$/.test(
      text(item.collectionSourceId)
    );
    const isOfficialSculpture = officialSource && /조형물|조각/.test(title);
    if (!isArt && !isOfficialSculpture) return { allowed: false, reason: "not_artwork_notice" };

    // Strong negative subject indicators take precedence over incidental "building art" wording.
    if (NON_HOUSING_THEMES.some(re => re.test(title))) {
      return { allowed: false, reason: "non_residential_theme" };
    }

    const housingSubject = HOUSING_TERMS.some(re => re.test(context)) ||
      APARTMENT_BRANDS.some(brand => context.includes(brand)) ||
      (text(item.collectionSourceId) === "lh_notice" && /미술\s*작품\s*공모/.test(title));
    if (!housingSubject) return { allowed: false, reason: "no_residential_evidence" };

    return { allowed: true, reason: "housing_building_art" };
  }

  function isHousingArtCommission(item) {
    return evaluate(item).allowed;
  }

  function filterItems(items, exclusions) {
    const blocked = exclusions instanceof Set ? exclusions : exclusionSet(exclusions);
    return (Array.isArray(items) ? items : [])
      .filter(item => item && isHousingArtCommission(item) && !isExcluded(item, blocked));
  }

  return {
    titleOf, getExclusionKeys, exclusionSet, isExcluded,
    evaluate, isHousingArtCommission, filterItems
  };
});
