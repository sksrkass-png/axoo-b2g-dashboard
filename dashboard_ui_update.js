(() => {
  const DATA_PATHS = {
    opportunities: "data/b2g_opportunities.json",
    agencies: "data/target_agencies.json",
    art: "data/art_commissions.json",
    local: "data/local_projects.json"
  };

  const TAB_INTRO_CONFIG = {
    opportunities: {
      eyebrow: "AXOO B2G ENGINE",
      title: "나라장터 우선 검토 공고",
      description:
        "나라장터 입찰공고를 기준으로 AXOO와 연결 가능한 공고를 우선 검토합니다.",
      criteria:
        "키워드 매칭, 사업 성격, 예산 규모, 제안 가능성을 기준으로 우선 검토 공고를 정리합니다.",
      sources: ["나라장터 입찰공고", "나라장터 발주계획", "AXOO Fit 키워드 엔진"],
      countLabel: "표시 공고"
    },
    art: {
      eyebrow: "AXOO PUBLIC ART TRACK",
      title: "건축물 미술작품",
      description:
        "건축물 미술작품 설치공모를 중심으로 서울·경기·인천 등 주요 권역 공고를 모아봅니다.",
      criteria:
        "건축물 미술작품 공모 공고문과 첨부파일을 기준으로 지역, 일정, 설치 조건, 제출 방식, 작품 규모를 검토합니다.",
      sources: ["서울시/서울주택도시계열 공고", "경기권 공공기관 공고", "공고문·첨부파일 직접 확인"],
      countLabel: "표시 공고"
    },
    local: {
      eyebrow: "AXOO LOCAL PROJECT FEED",
      title: "로컬·지자체 공고",
      description:
        "지자체 및 산하기관 개별 공고 중 AXOO와 연결 가능성이 있는 프로젝트를 모아봅니다.",
      criteria:
        "계약방법, 예산, 지역, 프로젝트 유형, 마감 일정을 기준으로 실무 대응 가능 공고를 우선 검토합니다.",
      sources: ["지자체 개별 홈페이지", "공공기관 공고 게시판", "수의·용역·운영 공고 수집 데이터"],
      countLabel: "표시 공고"
    },
    agencies: {
      eyebrow: "AXOO TARGET AGENCY MAP",
      title: "기관 타깃",
      description:
        "AXOO와 접점이 높은 기관들을 지역·유형·관련 이력 기준으로 정리한 기관 타깃 뷰입니다.",
      criteria:
        "관련 공고 수, 발주계획, 낙찰/계약 이력, 추정 규모를 기준으로 제안 우선순위를 검토합니다.",
      sources: ["나라장터 계약/낙찰/계획 데이터", "기관별 공고 이력", "AXOO 내부 우선순위 기준"],
      countLabel: "표시 기관"
    }
  };

  const summaryData = {
    opportunities: [],
    agencies: [],
    art: [],
    local: []
  };

  const cardContainerIds = {
    opportunities: "cards",
    agencies: "agencyCards",
    art: "artCards",
    local: "localCards"
  };

  function safeText(value, fallback = "-") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function compactWhitespace(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function extractDateOnlyList(value) {
    const text = safeText(value, "");
    const dates = [];

    if (!text) return dates;

    const compactPattern = /\b(20\d{2})(\d{2})(\d{2})(?:\d{2}\d{2}(?:\d{2})?)?\b/g;
    const separatedPattern = /(20\d{2})\s*(?:년|[-./])\s*(\d{1,2})\s*(?:월|[-./])\s*(\d{1,2})/g;

    let compactMatch;

    while ((compactMatch = compactPattern.exec(text)) !== null) {
      dates.push(`${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`);
    }

    let separatedMatch;

    while ((separatedMatch = separatedPattern.exec(text)) !== null) {
      const year = separatedMatch[1];
      const month = String(separatedMatch[2]).padStart(2, "0");
      const day = String(separatedMatch[3]).padStart(2, "0");

      dates.push(`${year}-${month}-${day}`);
    }

    return Array.from(new Set(dates));
  }

  function formatDateOnly(value) {
    const dates = extractDateOnlyList(value);
    return dates[0] || "-";
  }

  function formatDateRange(startValue, endValue) {
    const startDate = formatDateOnly(startValue);
    const endDate = formatDateOnly(endValue);

    if (startDate !== "-" && endDate !== "-" && startDate !== endDate) {
      return `${startDate} ~ ${endDate}`;
    }

    if (startDate !== "-") return startDate;
    if (endDate !== "-") return endDate;

    return "-";
  }

  function getCompactContractMethod(value) {
    const text = safeText(value, "");

    if (!text || text === "-") return "확인 필요";
    if (text.includes("협상에 의한 계약")) return "협상계약";
    if (text.includes("제한경쟁")) return "제한경쟁";
    if (text.includes("일반경쟁")) return "일반경쟁";
    if (text.includes("수의계약")) return "수의계약";
    if (text.includes("전자입찰")) return "전자입찰";
    if (text.includes("방문제출")) return "방문제출";

    return text.split("/")[0].trim();
  }

  function getCompactArtSource(value) {
    const text = safeText(value, "");

    if (!text || text === "-") return "-";
    if (text.includes("경기")) return "경기도";
    if (text.includes("서울")) return "서울시";
    if (text.includes("인천")) return "인천시";

    return text;
  }

  async function loadJson(path, fallback = []) {
    try {
      const response = await fetch(`${path}?ui=${Date.now()}`);

      if (!response.ok) {
        console.warn("[AXOO UI] JSON load failed:", path, response.status);
        return fallback;
      }

      return await response.json();
    } catch (error) {
      console.warn("[AXOO UI] JSON load error:", path, error);
      return fallback;
    }
  }

  async function loadSummaryData() {
    const [opportunities, agencies, art, local] = await Promise.all([
      loadJson(DATA_PATHS.opportunities, []),
      loadJson(DATA_PATHS.agencies, []),
      loadJson(DATA_PATHS.art, []),
      loadJson(DATA_PATHS.local, [])
    ]);

    summaryData.opportunities = Array.isArray(opportunities) ? opportunities : [];
    summaryData.agencies = Array.isArray(agencies) ? agencies : [];
    summaryData.art = Array.isArray(art) ? art : [];
    summaryData.local = Array.isArray(local) ? local : [];
  }

  function getActiveTabKey() {
    const activeButton = document.querySelector(".tab-button.active");

    if (activeButton?.dataset?.tab) {
      return activeButton.dataset.tab;
    }

    const activePanel = document.querySelector(".tab-panel.active");

    if (!activePanel) return "opportunities";
    if (activePanel.id === "agenciesTab") return "agencies";
    if (activePanel.id === "artTab") return "art";
    if (activePanel.id === "localTab") return "local";

    return "opportunities";
  }

  function getMetaCardMap() {
    return {
      opportunities: document.getElementById("metaOpportunityCount")?.closest(".meta-card"),
      art: document.getElementById("metaArtCount")?.closest(".meta-card"),
      local: document.getElementById("metaLocalCount")?.closest(".meta-card"),
      agencies: document.getElementById("metaAgencyCount")?.closest(".meta-card")
    };
  }

  function activateTab(tabKey) {
    const button = document.querySelector(`.tab-button[data-tab="${tabKey}"]`);

    if (button) {
      button.click();
    }

    setTimeout(() => {
      updateMetaCardState();
      updateSummaryByActiveTab();
      updateRequestedListHeadLabels();
      setupAccordions();
      ensureNativeTabIntros();
    }, 160);
  }

  function setupMetaCards() {
    const cardMap = getMetaCardMap();

    Object.entries(cardMap).forEach(([tabKey, card]) => {
      if (!card) return;

      card.dataset.tabTarget = tabKey;
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");

      if (card.dataset.metaBound === "true") return;

      card.dataset.metaBound = "true";

      card.addEventListener("click", () => {
        activateTab(tabKey);
      });

      card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateTab(tabKey);
        }
      });
    });

    updateMetaCardState();
  }

  function updateMetaCardState() {
    const activeTab = getActiveTabKey();
    const cardMap = getMetaCardMap();

    Object.entries(cardMap).forEach(([tabKey, card]) => {
      if (!card) return;

      card.classList.toggle("meta-card-active", tabKey === activeTab);
      card.classList.toggle("meta-card-muted", tabKey !== activeTab);
    });
  }

  function setupTabButtons() {
    document.querySelectorAll(".tab-button").forEach(button => {
      if (button.dataset.uiBound === "true") return;

      button.dataset.uiBound = "true";

      button.addEventListener("click", () => {
        setTimeout(() => {
          updateMetaCardState();
          updateSummaryByActiveTab();
          updateRequestedListHeadLabels();
          setupAccordions();
          ensureNativeTabIntros();
        }, 160);
      });
    });
  }

  function updateRequestedListHeadLabels() {
    const opportunitiesPanel = document.getElementById("opportunitiesTab");
    const opportunitiesHead = opportunitiesPanel?.querySelector(".list-head");

    if (opportunitiesHead) {
      opportunitiesHead.innerHTML = `
        <span class="list-source-grade">
          <em>출처</em>
          <em>등급</em>
        </span>
        <span>공고명</span>
        <span>게재기간</span>
        <span>마감일</span>
      `;
    }

    const artPanel = document.getElementById("artTab");
    const artHead = artPanel?.querySelector(".list-head");

    if (artHead) {
      artHead.innerHTML = `
        <span class="list-source-grade">
          <em>출처</em>
          <em></em>
        </span>
        <span>공고명</span>
        <span>공개일</span>
        <span>마감일</span>
      `;
    }

    const localPanel = document.getElementById("localTab");
    const localHead = localPanel?.querySelector(".list-head");

    if (localHead) {
      localHead.innerHTML = `
        <span class="list-source-grade">
          <em>공고기관</em>
          <em>등급</em>
        </span>
        <span>공고명</span>
        <span>계약방법</span>
        <span>마감/개찰</span>
      `;
    }
  }

  function getMetaValue(card, label) {
    const items = Array.from(card.querySelectorAll(".meta div"));

    for (const item of items) {
      const span = item.querySelector("span");
      const spanText = safeText(span?.textContent, "");

      if (spanText === label) {
        return safeText(item.textContent.replace(spanText, ""));
      }
    }

    return "-";
  }

  function getFirstBadgeText(card) {
    return safeText(card.querySelector(".badge")?.textContent);
  }

  function getTitleText(card) {
    return safeText(card.querySelector("h2")?.textContent, "제목 없음");
  }

  function isEmptyCard(card) {
    const title = getTitleText(card);

    return (
      title.includes("데이터가 없습니다") ||
      title.includes("조건에 맞는") ||
      title.includes("불러오는 중")
    );
  }

  function findDataByTitle(tabKey, title) {
    const normalizedTitle = compactWhitespace(title);

    return summaryData[tabKey].find(item => {
      const itemTitle = compactWhitespace(
        item.bidNtceNm ||
        item.title ||
        item.agencyName ||
        ""
      );

      return itemTitle === normalizedTitle;
    }) || null;
  }

  function getOpportunityPublishPeriod(card) {
    const title = getTitleText(card);
    const data = findDataByTitle("opportunities", title);

    const startValue = (
      data?.publishedDate ||
      data?.postedDate ||
      data?.noticeDate ||
      data?.bidNtceDt ||
      data?.bidNtceBgnDt ||
      data?.bidNtceBgn ||
      getMetaValue(card, "게재일")
    );

    const endValue = (
      data?.deadlineDate ||
      data?.deadline ||
      data?.bidClseDt ||
      data?.bidNtceEndDt ||
      getMetaValue(card, "마감/개찰")
    );

    return formatDateRange(startValue, endValue);
  }

  function getOpportunityDeadlineDate(card) {
    const title = getTitleText(card);
    const data = findDataByTitle("opportunities", title);

    const deadlineValue = (
      data?.deadlineDate ||
      data?.deadline ||
      data?.bidClseDt ||
      data?.bidClseDate ||
      data?.bidNtceEndDt ||
      getMetaValue(card, "마감/개찰")
    );

    return formatDateOnly(deadlineValue);
  }

  function getSourceGradeInfo(card, tabKey) {
    const grade = getFirstBadgeText(card);

    if (tabKey === "opportunities") {
      return {
        source: "나라장터",
        grade
      };
    }

    if (tabKey === "agencies") {
      return {
        source: getMetaValue(card, "기관유형"),
        grade
      };
    }

    if (tabKey === "art") {
      return {
        source: getCompactArtSource(getFirstBadgeText(card)),
        grade: ""
      };
    }

    if (tabKey === "local") {
      return {
        source: getMetaValue(card, "공고기관") || getMetaValue(card, "출처") || "로컬공고",
        grade
      };
    }

    return {
      source: "-",
      grade
    };
  }

  function getPeriodDeadlineInfo(card, tabKey) {
    if (tabKey === "opportunities") {
      return {
        periodLabel: "게재기간",
        period: getOpportunityPublishPeriod(card),
        deadlineLabel: "마감일",
        deadline: getOpportunityDeadlineDate(card)
      };
    }

    if (tabKey === "agencies") {
      return {
        periodLabel: "지역",
        period: getMetaValue(card, "지역"),
        deadlineLabel: "관련 이력",
        deadline: safeText(card.querySelector(".score")?.textContent)
      };
    }

    if (tabKey === "art") {
      return {
        periodLabel: "공개일",
        period: formatDateOnly(getMetaValue(card, "공개일")),
        deadlineLabel: "마감일",
        deadline: formatDateOnly(getMetaValue(card, "마감일"))
      };
    }

    if (tabKey === "local") {
      return {
        periodLabel: "계약방법",
        period: getCompactContractMethod(getMetaValue(card, "계약방법")),
        deadlineLabel: "마감/개찰",
        deadline: formatDateOnly(getMetaValue(card, "마감/개찰")) || getMetaValue(card, "마감/개찰")
      };
    }

    return {
      periodLabel: "기간",
      period: "-",
      deadlineLabel: "마감",
      deadline: "-"
    };
  }

  function createAccordionSummary(card, tabKey) {
    const sourceGrade = getSourceGradeInfo(card, tabKey);
    const periodDeadline = getPeriodDeadlineInfo(card, tabKey);
    const title = getTitleText(card);

    const sourceGradeHtml = sourceGrade.grade
      ? `
        <span class="summary-source-wrap">
          <span class="summary-source">${sourceGrade.source}</span>
          <span class="summary-grade">${sourceGrade.grade}</span>
        </span>
      `
      : `
        <span class="summary-source-wrap">
          <span class="summary-source">${sourceGrade.source}</span>
        </span>
      `;

    return `
      <summary class="accordion-summary">
        ${sourceGradeHtml}

        <span class="summary-title">${title}</span>

        <span class="summary-period">
          <span>${periodDeadline.periodLabel}</span>
          <strong>${periodDeadline.period}</strong>
        </span>

        <span class="summary-deadline">
          <span>${periodDeadline.deadlineLabel}</span>
          <strong>${periodDeadline.deadline}</strong>
        </span>
      </summary>
    `;
  }

  function convertCardToAccordion(card, tabKey) {
    if (!card || card.classList.contains("card-as-accordion")) {
      const existingDetails = card?.querySelector("details.accordion-card");

      if (tabKey === "art" && existingDetails) {
        existingDetails.removeAttribute("open");
        existingDetails.open = false;
      }

      return;
    }

    if (isEmptyCard(card)) return;

    const summaryHtml = createAccordionSummary(card, tabKey);

    const details = document.createElement("details");
    details.className = "accordion-card";

    if (tabKey === "art") {
      details.removeAttribute("open");
      details.open = false;
    }

    const body = document.createElement("div");
    body.className = "accordion-body";

    while (card.firstChild) {
      body.appendChild(card.firstChild);
    }

    details.innerHTML = summaryHtml;
    details.appendChild(body);

    if (tabKey === "art") {
      details.removeAttribute("open");
      details.open = false;
    }

    card.classList.add("card-as-accordion");
    card.appendChild(details);
  }

  function setupAccordions() {
    Object.entries(cardContainerIds).forEach(([tabKey, containerId]) => {
      const container = document.getElementById(containerId);

      if (!container) return;

      Array.from(container.querySelectorAll(".card")).forEach(card => {
        convertCardToAccordion(card, tabKey);
      });
    });
  }

  function setupReviewSelects() {
    const preferredOrder = ["all", "new", "reviewing", "proposal", "hold", "done"];

    document.querySelectorAll("select[id$='ReviewFilter']").forEach(select => {
      if (select.dataset.reviewOrderFixed === "true") return;

      const options = Array.from(select.options);
      const sorted = preferredOrder
        .map(value => options.find(option => option.value === value))
        .filter(Boolean);

      options.forEach(option => {
        if (!sorted.includes(option)) sorted.push(option);
      });

      select.innerHTML = "";
      sorted.forEach(option => select.appendChild(option));

      select.dataset.reviewOrderFixed = "true";
    });
  }

  function getVisibleCards(tabKey) {
    const containerId = cardContainerIds[tabKey];
    const container = document.getElementById(containerId);

    if (!container) return [];

    return Array.from(container.querySelectorAll(".card"))
      .filter(card => !isEmptyCard(card))
      .filter(card => {
        const style = window.getComputedStyle(card);
        return style.display !== "none" && style.visibility !== "hidden";
      });
  }

  function getGradeFromCard(card) {
    const text = safeText(
      card.querySelector(".summary-grade")?.textContent ||
      card.querySelector(".badge")?.textContent,
      ""
    );

    if (text.includes("S")) return "S";
    if (text.includes("A")) return "A";
    if (text.includes("B")) return "B";
    if (text.includes("C")) return "C";

    return "";
  }

  function setSummaryLabels(labels) {
    const summaryCards = Array.from(document.querySelectorAll(".summary-card span"));

    labels.forEach((label, index) => {
      if (summaryCards[index]) {
        summaryCards[index].textContent = label;
      }
    });
  }

  function updateSummaryNumbers(numbers) {
    const totalCount = document.getElementById("totalCount");
    const sCount = document.getElementById("sCount");
    const aCount = document.getElementById("aCount");
    const bCount = document.getElementById("bCount");

    if (totalCount) totalCount.textContent = numbers.total;
    if (sCount) sCount.textContent = numbers.first;
    if (aCount) aCount.textContent = numbers.second;
    if (bCount) bCount.textContent = numbers.third;
  }

  function updateSummaryByActiveTab() {
    const activeTab = getActiveTabKey();
    const visibleCards = getVisibleCards(activeTab);

    if (activeTab === "art") {
      setSummaryLabels(["현재 표시", "서울", "경기", "기타"]);

      const seoulCount = visibleCards.filter(card => card.textContent.includes("서울")).length;
      const gyeonggiCount = visibleCards.filter(card => card.textContent.includes("경기")).length;
      const otherCount = Math.max(visibleCards.length - seoulCount - gyeonggiCount, 0);

      updateSummaryNumbers({
        total: visibleCards.length,
        first: seoulCount,
        second: gyeonggiCount,
        third: otherCount
      });

      return;
    }

    setSummaryLabels(["현재 표시", "S등급", "A등급", "B/C등급"]);

    const sCount = visibleCards.filter(card => getGradeFromCard(card) === "S").length;
    const aCount = visibleCards.filter(card => getGradeFromCard(card) === "A").length;
    const bcCount = visibleCards.filter(card => {
      const grade = getGradeFromCard(card);
      return grade === "B" || grade === "C";
    }).length;

    updateSummaryNumbers({
      total: visibleCards.length,
      first: sCount,
      second: aCount,
      third: bcCount
    });
  }

  function updateMetaCountsFromData() {
    const opportunityCount = document.getElementById("metaOpportunityCount");
    const agencyCount = document.getElementById("metaAgencyCount");
    const artCount = document.getElementById("metaArtCount");
    const localCount = document.getElementById("metaLocalCount");

    if (opportunityCount && opportunityCount.textContent === "0") {
      opportunityCount.textContent = summaryData.opportunities.length;
    }

    if (agencyCount && agencyCount.textContent === "0") {
      agencyCount.textContent = summaryData.agencies.length;
    }

    if (artCount && artCount.textContent === "0") {
      artCount.textContent = summaryData.art.length;
    }

    if (localCount && localCount.textContent === "0") {
      localCount.textContent = summaryData.local.length;
    }
  }

  function getPanelByTabKey(tabKey) {
    if (tabKey === "opportunities") return document.getElementById("opportunitiesTab");
    if (tabKey === "art") return document.getElementById("artTab");
    if (tabKey === "local") return document.getElementById("localTab");
    if (tabKey === "agencies") return document.getElementById("agenciesTab");

    return null;
  }

  function getTabDisplayCount(tabKey) {
    const visibleCards = getVisibleCards(tabKey);

    if (visibleCards.length > 0) {
      return visibleCards.length;
    }

    const data = summaryData[tabKey];

    return Array.isArray(data) ? data.length : 0;
  }

  function renderSourceTags(sources) {
    if (!Array.isArray(sources) || !sources.length) return "";

    return `
      <div class="keywords" style="margin-top: 16px;">
        ${sources.map(source => `<span class="keyword">${source}</span>`).join("")}
      </div>
    `;
  }

  function createNativeTabIntroHtml(tabKey) {
    const config = TAB_INTRO_CONFIG[tabKey];
    if (!config) return "";

    const count = getTabDisplayCount(tabKey);

    return `
      <div class="native-tab-intro-wrap">
        <section class="priority-panel-head priority-panel-head-green">
          <div>
            <p class="priority-eyebrow">${config.eyebrow}</p>
            <h2>${config.title}</h2>
            <p>${config.description}</p>
            ${renderSourceTags(config.sources)}
          </div>

          <div class="priority-mini-stat">
            <span>${config.countLabel}</span>
            <strong>${count}건</strong>
            <small>출처 ${config.sources.length}종 기준</small>
          </div>
        </section>

        <section class="grade-guide-box grade-guide-box-green">
          <strong>검토 기준 안내</strong>
          <p>${config.criteria}</p>
        </section>
      </div>
    `;
  }

  function ensureNativeTabIntro(tabKey) {
    const panel = getPanelByTabKey(tabKey);
    if (!panel) return;

    const existing = panel.querySelector(".native-tab-intro-wrap");
    if (existing) existing.remove();

    const wrapper = document.createElement("div");
    wrapper.innerHTML = createNativeTabIntroHtml(tabKey);

    if (wrapper.firstElementChild) {
      panel.insertBefore(wrapper.firstElementChild, panel.firstChild);
    }
  }

  function ensureNativeTabIntros() {
    ["opportunities", "art", "local", "agencies"].forEach(ensureNativeTabIntro);
  }

  function bindFilterRefresh() {
    const filterSelectors = [
      "#searchInput",
      "#gradeFilter",
      "#categoryFilter",
      "#reviewFilter",
      "#agencySearchInput",
      "#agencyRegionFilter",
      "#agencyGradeFilter",
      "#agencyReviewFilter",
      "#agencyAwardOnly",
      "#agencyPlanOnly",
      "#artSearchInput",
      "#artSourceFilter",
      "#artReviewFilter",
      "#localSearchInput",
      "#localRegionFilter",
      "#localTypeFilter",
      "#localGradeFilter",
      "#localReviewFilter",
      "#localDeadlineStatusFilter"
    ];

    filterSelectors.forEach(selector => {
      const element = document.querySelector(selector);

      if (!element || element.dataset.uiRefreshBound === "true") return;

      const eventName = element.tagName === "INPUT" && element.type === "text" ? "input" : "change";

      element.dataset.uiRefreshBound = "true";

      element.addEventListener(eventName, () => {
        setTimeout(() => {
          updateRequestedListHeadLabels();
          setupAccordions();
          updateSummaryByActiveTab();
          ensureNativeTabIntros();
        }, 180);
      });
    });
  }

  function applyDashboardPatch() {
    setupMetaCards();
    setupTabButtons();
    setupReviewSelects();
    updateRequestedListHeadLabels();
    setupAccordions();
    updateMetaCountsFromData();
    updateMetaCardState();
    updateSummaryByActiveTab();
    ensureNativeTabIntros();
    bindFilterRefresh();
  }

  async function initDashboardUiUpdate() {
    await loadSummaryData();

    applyDashboardPatch();

    setTimeout(applyDashboardPatch, 400);
    setTimeout(applyDashboardPatch, 1200);
  }

  window.addEventListener("axoo:rendered", () => {
    setTimeout(applyDashboardPatch, 100);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDashboardUiUpdate);
  } else {
    initDashboardUiUpdate();
  }
})();
