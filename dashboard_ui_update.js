(() => {
  const DATA_PATHS = {
    opportunities: "data/b2g_opportunities.json",
    agencies: "data/target_agencies.json",
    art: "data/art_commissions.json",
    local: "data/local_projects.json"
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
      setupAccordions();
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
          setupAccordions();
        }, 160);
      });
    });
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
        source: getFirstBadgeText(card),
        grade: ""
      };
    }

    if (tabKey === "local") {
      return {
        source: getMetaValue(card, "출처"),
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
        periodLabel: "마감/개찰",
        period: getMetaValue(card, "마감/개찰"),
        deadlineLabel: "상태",
        deadline: safeText(card.querySelector(".deadline-badge")?.textContent)
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
        period: getMetaValue(card, "공개일"),
        deadlineLabel: "마감일",
        deadline: getMetaValue(card, "마감일")
      };
    }

    if (tabKey === "local") {
      return {
        periodLabel: "게재일",
        period: getMetaValue(card, "게재일"),
        deadlineLabel: "마감일",
        deadline: getMetaValue(card, "마감일")
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
    if (!card || card.classList.contains("card-as-accordion")) return;
    if (isEmptyCard(card)) return;

    const summaryHtml = createAccordionSummary(card, tabKey);

    const details = document.createElement("details");
    details.className = "accordion-card";
    details.open = false;

    const body = document.createElement("div");
    body.className = "accordion-body";

    while (card.firstChild) {
      body.appendChild(card.firstChild);
    }

    details.innerHTML = summaryHtml;
    details.appendChild(body);

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
          setupAccordions();
          updateSummaryByActiveTab();
        }, 180);
      });
    });
  }

  function applyDashboardPatch() {
    setupMetaCards();
    setupTabButtons();
    setupReviewSelects();
    setupAccordions();
    updateMetaCountsFromData();
    updateMetaCardState();
    updateSummaryByActiveTab();
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
