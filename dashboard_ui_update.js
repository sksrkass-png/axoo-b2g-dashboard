(function () {
  const REVIEW_OPTIONS = [
    ["new", "미검토"],
    ["hold", "보류"],
    ["reviewing", "검토중"],
    ["proposal", "제안 준비"],
    ["done", "제안 완료"]
  ];

  let artSummaryData = [];
  let opportunitySummaryData = [];

  function safeText(value) {
    return String(value || "").trim();
  }

  function compactText(value) {
    return safeText(value)
      .replace(/\[재공고\]/g, "")
      .replace(/\[긴급\]/g, "")
      .replace(/[「」『』"']/g, "")
      .replace(/\s+/g, "")
      .trim();
  }

  function formatDateOnly(value) {
    const text = safeText(value);

    if (!text || text === "-") return "";

    const compact = text.match(/\b(20\d{2})(\d{2})(\d{2})\b/);
    if (compact) {
      return `${compact[1]}-${compact[2]}-${compact[3]}`;
    }

    const compactLong = text.match(/\b(20\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\b/);
    if (compactLong) {
      return `${compactLong[1]}-${compactLong[2]}-${compactLong[3]}`;
    }

    const match = text.match(/(20\d{2})[-./년\s]*(\d{1,2})[-./월\s]*(\d{1,2})/);

    if (!match) return "";

    const year = match[1];
    const month = String(match[2]).padStart(2, "0");
    const day = String(match[3]).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function formatLastUpdated(value) {
    const text = safeText(value)
      .replace("최근 업데이트 :", "")
      .replace("(KST)", "")
      .trim();

    if (!text || text === "-") return "최근 업데이트 : -";

    const dateOnly = formatDateOnly(text);
    const timeMatch = text.match(/(\d{1,2}):(\d{2})/);

    if (!dateOnly) return `최근 업데이트 : ${text}`;

    const dateMatch = dateOnly.match(/20\d{2}-(\d{2})-(\d{2})/);

    if (!dateMatch) return `최근 업데이트 : ${dateOnly}`;

    const month = dateMatch[1];
    const day = dateMatch[2];

    if (timeMatch) {
      return `최근 업데이트 : ${month}.${day} ${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
    }

    return `최근 업데이트 : ${month}.${day}`;
  }

  function shortSourceName(value) {
    const text = safeText(value);

    if (text.includes("서울")) return "서울";
    if (text.includes("경기")) return "경기도";
    if (text.includes("LH") || text.includes("SH")) return "LH/SH";
    if (text.includes("나라장터")) return "나라장터";

    return text || "-";
  }

  function getMetaValue(card, labelKeyword) {
    const metaItems = Array.from(card.querySelectorAll(".meta div"));

    for (const item of metaItems) {
      const label = safeText(item.querySelector("span")?.textContent);

      if (label.includes(labelKeyword)) {
        return safeText(item.textContent.replace(label, ""));
      }
    }

    return "";
  }

  function getFirstValue(object, keys) {
    if (!object) return "";

    const sources = [
      object,
      object.raw,
      object.original,
      object.data,
      object.bid,
      object.meta,
      object.source,
      object.originalItem
    ].filter(Boolean);

    for (const source of sources) {
      for (const key of keys) {
        const value = source[key];

        if (value !== undefined && value !== null && safeText(value)) {
          return value;
        }
      }
    }

    return "";
  }

  async function loadArtSummaryData() {
    try {
      const response = await fetch(`data/art_commissions.json?v=${Date.now()}`);

      if (!response.ok) return;

      const data = await response.json();

      if (Array.isArray(data)) {
        artSummaryData = data;
      }
    } catch (error) {
      console.warn("art summary load failed", error);
    }
  }

  async function loadOpportunitySummaryData() {
    try {
      const response = await fetch(`data/b2g_opportunities.json?v=${Date.now()}`);

      if (!response.ok) return;

      const data = await response.json();

      if (Array.isArray(data)) {
        opportunitySummaryData = data;
      }
    } catch (error) {
      console.warn("opportunity summary load failed", error);
    }
  }

  function findOpportunityByTitle(title) {
    const targetTitle = compactText(title);

    if (!targetTitle) return null;

    return opportunitySummaryData.find(item => {
      const itemTitle = compactText(
        item.title ||
        item.bidNtceNm ||
        item.bidName ||
        item.noticeName ||
        item.name ||
        item.공고명 ||
        getFirstValue(item, [
          "title",
          "bidNtceNm",
          "bidName",
          "noticeName",
          "name",
          "공고명"
        ])
      );

      if (!itemTitle) return false;

      return (
        itemTitle === targetTitle ||
        itemTitle.includes(targetTitle) ||
        targetTitle.includes(itemTitle)
      );
    }) || null;
  }

  function moveLastUpdateIntoHeader() {
    const lastUpdatedAt = document.getElementById("lastUpdatedAt");

    if (!lastUpdatedAt) return;

    lastUpdatedAt.textContent = formatLastUpdated(lastUpdatedAt.textContent);
  }

  function getActiveTab() {
    return document.querySelector(".tab-button.active")?.dataset.tab || "opportunities";
  }

  function setupMetaCards() {
    const metaBar = document.querySelector(".meta-bar");

    if (!metaBar) return;

    const opportunityCard = document.getElementById("metaOpportunityCount")?.closest(".meta-card");
    const agencyCard = document.getElementById("metaAgencyCount")?.closest(".meta-card");
    const artCard = document.getElementById("metaArtCount")?.closest(".meta-card");

    if (!opportunityCard || !agencyCard || !artCard) return;

    const opportunityLabel = opportunityCard.querySelector(".meta-label");
    const artLabel = artCard.querySelector(".meta-label");
    const agencyLabel = agencyCard.querySelector(".meta-label");

    if (opportunityLabel) opportunityLabel.textContent = "❤️나라장터 공고";
    if (artLabel) artLabel.textContent = "💙건축물 미술작품";
    if (agencyLabel) agencyLabel.textContent = "🎯기관 타깃";

    agencyCard.classList.remove("meta-card-dark");

    opportunityCard.dataset.tabTarget = "opportunities";
    artCard.dataset.tabTarget = "art";
    agencyCard.dataset.tabTarget = "agencies";

    metaBar.appendChild(opportunityCard);
    metaBar.appendChild(artCard);
    metaBar.appendChild(agencyCard);

    [opportunityCard, artCard, agencyCard].forEach(card => {
      if (card.dataset.clickReady === "true") return;

      card.dataset.clickReady = "true";
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");

      card.addEventListener("click", () => {
        const target = card.dataset.tabTarget;
        document.querySelector(`.tab-button[data-tab="${target}"]`)?.click();

        setTimeout(applyDashboardPatch, 80);
        setTimeout(applyDashboardPatch, 250);
      });
    });
  }

  function syncMetaCardsWithActiveTab() {
    const activeTab = getActiveTab();
    const cards = document.querySelectorAll(".meta-card[data-tab-target]");

    cards.forEach(card => {
      const isActive = card.dataset.tabTarget === activeTab;

      card.classList.toggle("meta-card-active", isActive);
      card.classList.toggle("meta-card-muted", !isActive);
    });
  }

  function setupTabs() {
    const tabs = document.querySelector(".tabs");

    if (!tabs) return;

    const opportunityButton = tabs.querySelector('[data-tab="opportunities"]');
    const artButton = tabs.querySelector('[data-tab="art"]');
    const agencyButton = tabs.querySelector('[data-tab="agencies"]');

    if (!opportunityButton || !artButton || !agencyButton) return;

    opportunityButton.textContent = "❤️나라장터 공고";
    artButton.textContent = "💙건축물 미술작품";
    agencyButton.textContent = "🎯기관 타깃";

    tabs.appendChild(opportunityButton);
    tabs.appendChild(artButton);
    tabs.appendChild(agencyButton);
  }

  function rewriteReviewFilter(select) {
    if (!select) return;

    const currentValue = select.value || "all";
    const allOptions = [["all", "전체 상태"], ...REVIEW_OPTIONS];
    const allowedValues = allOptions.map(option => option[0]);
    const nextValue = allowedValues.includes(currentValue) ? currentValue : "all";

    select.innerHTML = allOptions.map(([value, label]) => {
      return `<option value="${value}" ${value === nextValue ? "selected" : ""}>${label}</option>`;
    }).join("");
  }

  function rewriteReviewSelect(select) {
    if (!select) return;

    const currentValue = select.value || "new";
    const allowedValues = REVIEW_OPTIONS.map(option => option[0]);
    const nextValue = allowedValues.includes(currentValue) ? currentValue : "new";

    select.innerHTML = REVIEW_OPTIONS.map(([value, label]) => {
      return `<option value="${value}" ${value === nextValue ? "selected" : ""}>${label}</option>`;
    }).join("");
  }

  function setupReviewControls() {
    document.querySelectorAll("#reviewFilter, #artReviewFilter").forEach(select => {
      if (select.dataset.reviewUpdated === "true") return;

      rewriteReviewFilter(select);
      select.dataset.reviewUpdated = "true";
    });

    document.querySelectorAll(".review-select").forEach(select => {
      if (select.dataset.reviewUpdated === "true") return;

      rewriteReviewSelect(select);
      select.dataset.reviewUpdated = "true";
    });
  }

  function updateSourceLabels() {
    document.querySelectorAll("#artTab .badge, #artTab .summary-source").forEach(element => {
      const original = safeText(element.textContent);
      const shortened = shortSourceName(original);

      if (shortened && original !== shortened) {
        element.textContent = shortened;
      }
    });
  }

  function getGradeText(card) {
    const gradeBadge = Array.from(card.querySelectorAll(".badge")).find(element => {
      const text = safeText(element.textContent);

      return text === "S등급" || text === "A등급" || text === "B등급";
    });

    return gradeBadge ? safeText(gradeBadge.textContent) : "";
  }

  function getOpportunitySummary(card) {
    const title = safeText(card.querySelector("h2")?.textContent) || "제목 없음";
    const matchedItem = findOpportunityByTitle(title);

    const publishedRaw =
      getFirstValue(matchedItem, [
        "publishedDate",
        "postedDate",
        "postingDate",
        "noticeDate",
        "noticeStartDate",
        "bidNtceDt",
        "bidNtceDate",
        "bidNtceBgn",
        "bidNtceBgnDt",
        "bidNtceBgnDate",
        "bidNtceRegDt",
        "bidBeginDt",
        "bidBeginDate",
        "bidBegin",
        "ntceDt",
        "ntceDate",
        "regDate",
        "regDt",
        "createdAt",
        "createdDate",
        "공고일",
        "게시일",
        "등록일",
        "게재일"
      ]) ||
      getMetaValue(card, "게재일") ||
      getMetaValue(card, "공고일") ||
      getMetaValue(card, "등록일") ||
      "";

    const deadlineRaw =
      getFirstValue(matchedItem, [
        "deadline",
        "deadlineDate",
        "bidClseDt",
        "bidClseDate",
        "bidClseDtStr",
        "closeDate",
        "endDate",
        "마감일"
      ]) ||
      getMetaValue(card, "마감일") ||
      getMetaValue(card, "마감") ||
      "";

    const sourceUrl =
      getFirstValue(matchedItem, [
        "sourceUrl",
        "url",
        "link",
        "originUrl",
        "detailUrl",
        "bidNtceDtlUrl",
        "bidDetailUrl",
        "bidNtceUrl",
        "ntceUrl",
        "공고URL",
        "원문URL"
      ]);

    const publishedDate = formatDateOnly(publishedRaw);
    const deadlineDate = formatDateOnly(deadlineRaw);

    return {
      source: "나라장터",
      grade: getGradeText(card),
      title,
      period: publishedDate || "공고일 확인 필요",
      deadline: deadlineDate || "확인 필요",
      sourceUrl
    };
  }

  function getArtSummary(card) {
    const title = safeText(card.querySelector("h2")?.textContent) || "제목 없음";

    const badgeTexts = Array.from(card.querySelectorAll(".badge"))
      .map(badge => safeText(badge.textContent))
      .filter(Boolean);

    const sourceRaw = badgeTexts.find(text =>
      text.includes("서울") ||
      text.includes("경기") ||
      text.includes("LH") ||
      text.includes("SH")
    ) || badgeTexts[0] || "공모";

    const source = shortSourceName(sourceRaw);

    const publishedRaw =
      getMetaValue(card, "게재기간") ||
      getMetaValue(card, "공개일") ||
      getMetaValue(card, "등록일") ||
      getMetaValue(card, "공고일") ||
      "";

    const deadlineRaw =
      getMetaValue(card, "마감일") ||
      getMetaValue(card, "마감") ||
      "";

    const publishedDate = formatDateOnly(publishedRaw);
    const deadlineDate = formatDateOnly(deadlineRaw);

    return {
      source,
      grade: "",
      title,
      period: publishedDate || "확인 필요",
      deadline: deadlineDate || "확인 필요",
      sourceUrl: ""
    };
  }

  function getAgencySummary(card) {
    const title = safeText(card.querySelector("h2")?.textContent) || "기관명 없음";

    const badgeTexts = Array.from(card.querySelectorAll(".badge"))
      .map(badge => safeText(badge.textContent))
      .filter(Boolean);

    const region = badgeTexts.find(text =>
      text.includes("서울") ||
      text.includes("경기") ||
      text.includes("부산") ||
      text.includes("인천") ||
      text.includes("대전") ||
      text.includes("광주") ||
      text.includes("대구") ||
      text.includes("울산") ||
      text.includes("세종")
    ) || getMetaValue(card, "지역") || "지역 확인";

    const related =
      safeText(card.querySelector(".score")?.textContent) ||
      getMetaValue(card, "관련 이력") ||
      "관련 이력 확인";

    return {
      source: "기관",
      grade: "",
      title,
      period: region,
      deadline: related,
      sourceUrl: ""
    };
  }

  function makeAccordion(card, type) {
    if (!card || card.dataset.accordionReady === "true") return;
    if (!card.querySelector("h2")) return;

    let data;

    if (type === "art") {
      data = getArtSummary(card);
    } else if (type === "agency") {
      data = getAgencySummary(card);
    } else {
      data = getOpportunitySummary(card);
    }

    const originalNodes = Array.from(card.childNodes);

    const details = document.createElement("details");
    details.className = "accordion-card";

    const summary = document.createElement("summary");
    summary.className = "accordion-summary";

    summary.innerHTML = `
      <div class="summary-source-wrap">
        <span class="summary-source">${data.source}</span>
        ${data.grade ? `<span class="summary-grade">${data.grade}</span>` : ""}
      </div>
      <div class="summary-title">${data.title}</div>
      <div class="summary-period">
        <span>${type === "agency" ? "지역" : "게재기간"}</span>
        <strong>${data.period}</strong>
      </div>
      <div class="summary-deadline">
        <span>${type === "agency" ? "관련" : "마감일"}</span>
        <strong>${data.deadline}</strong>
      </div>
    `;

    const body = document.createElement("div");
    body.className = "accordion-body";

    originalNodes.forEach(node => {
      body.appendChild(node);
    });

    if (type === "opportunity") {
      const existingLink = body.querySelector("a[href]");
      const sourceUrl = data.sourceUrl || existingLink?.href || "";

      if (sourceUrl) {
        if (existingLink) {
          existingLink.style.display = "none";
        }

        const sourceViewBox = document.createElement("div");
        sourceViewBox.className = "source-view-box";

        sourceViewBox.innerHTML = `
          <a class="source-view-link" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">
            소스보기
          </a>
        `;

        body.appendChild(sourceViewBox);
      }
    }

    details.appendChild(summary);
    details.appendChild(body);

    card.innerHTML = "";
    card.appendChild(details);
    card.classList.add("card-as-accordion");
    card.dataset.accordionReady = "true";

    details.addEventListener("toggle", () => {
      updateSourceLabels();
    });
  }

  function setupAccordions() {
    document.querySelectorAll("#cards .card").forEach(card => {
      makeAccordion(card, "opportunity");
    });

    document.querySelectorAll("#artCards .card").forEach(card => {
      makeAccordion(card, "art");
    });

    document.querySelectorAll("#agencyCards .card").forEach(card => {
      makeAccordion(card, "agency");
    });
  }

  function removeCardTools() {
    document.querySelectorAll(".card-tools").forEach(element => {
      element.remove();
    });
  }

  function setSummaryCard(index, label, value) {
    const cards = document.querySelectorAll(".summary-card");
    const card = cards[index];

    if (!card) return;

    const labelElement = card.querySelector("span");
    const valueElement = card.querySelector("strong");

    if (labelElement) labelElement.textContent = label;
    if (valueElement) valueElement.textContent = value;
  }

  function updateOpportunitySummary() {
    const total = document.getElementById("totalCount")?.textContent || "0";
    const s = document.getElementById("sCount")?.textContent || "0";
    const a = document.getElementById("aCount")?.textContent || "0";
    const b = document.getElementById("bCount")?.textContent || "0";

    setSummaryCard(0, "전체", total);
    setSummaryCard(1, "S등급", s);
    setSummaryCard(2, "A등급", a);
    setSummaryCard(3, "B등급", b);
  }

  function updateArtSummary() {
    const total = artSummaryData.length;

    const seoul = artSummaryData.filter(item => {
      const source = safeText(item.source);
      return source.includes("서울");
    }).length;

    const gyeonggi = artSummaryData.filter(item => {
      const source = safeText(item.source);
      return source.includes("경기");
    }).length;

    const lhsh = artSummaryData.filter(item => {
      const source = safeText(item.source);
      return source.includes("LH") || source.includes("SH");
    }).length;

    setSummaryCard(0, "전체", total);
    setSummaryCard(1, "서울", seoul);
    setSummaryCard(2, "경기도", gyeonggi);
    setSummaryCard(3, "LH/SH", lhsh);
  }

  function updateAgencySummary() {
    const agencyCount = document.getElementById("metaAgencyCount")?.textContent || "0";

    setSummaryCard(0, "전체", agencyCount);
    setSummaryCard(1, "우선 검토", "-");
    setSummaryCard(2, "제안 가능", "-");
    setSummaryCard(3, "보류", "-");
  }

  function updateSummaryByActiveTab() {
    const activeTab = getActiveTab();

    if (activeTab === "art") {
      updateArtSummary();
      return;
    }

    if (activeTab === "agencies") {
      updateAgencySummary();
      return;
    }

    updateOpportunitySummary();
  }

  function filterArtCards() {
    const keyword = safeText(document.getElementById("artSearchInput")?.value).toLowerCase();
    const source = document.getElementById("artSourceFilter")?.value || "all";
    const review = document.getElementById("artReviewFilter")?.value || "all";

    document.querySelectorAll("#artCards .card").forEach(card => {
      const text = safeText(card.textContent).toLowerCase();
      const sourceText = safeText(
        card.querySelector(".summary-source")?.textContent ||
        card.querySelector(".badge")?.textContent
      );

      const reviewValue = card.querySelector(".review-select")?.value || "new";

      const matchKeyword = !keyword || text.includes(keyword);
      const matchSource = source === "all" || sourceText.includes(source);
      const matchReview = review === "all" || reviewValue === review;

      card.style.display = matchKeyword && matchSource && matchReview ? "" : "none";
    });
  }

  function bindArtFilters() {
    const search = document.getElementById("artSearchInput");
    const source = document.getElementById("artSourceFilter");
    const review = document.getElementById("artReviewFilter");

    if (!search || search.dataset.bound === "true") return;

    const handler = () => filterArtCards();

    search.addEventListener("input", handler);
    source?.addEventListener("change", handler);
    review?.addEventListener("change", handler);

    search.dataset.bound = "true";
    filterArtCards();
  }

  function applyDashboardPatch() {
    try {
      moveLastUpdateIntoHeader();
      setupMetaCards();
      setupTabs();
      setupReviewControls();
      updateSourceLabels();
      setupAccordions();
      removeCardTools();
      updateSummaryByActiveTab();
      syncMetaCardsWithActiveTab();
      bindArtFilters();
      filterArtCards();
    } catch (error) {
      console.warn("dashboard ui patch failed", error);
    }
  }

  function schedulePatch() {
    let count = 0;

    const timer = setInterval(() => {
      applyDashboardPatch();

      count += 1;

      if (count >= 12) {
        clearInterval(timer);
      }
    }, 350);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await loadArtSummaryData();
    await loadOpportunitySummaryData();

    applyDashboardPatch();
    schedulePatch();

    document.addEventListener("click", event => {
      if (event.target.closest(".tab-button")) {
        setTimeout(applyDashboardPatch, 120);
        setTimeout(applyDashboardPatch, 400);
      }
    });

    document.addEventListener("input", event => {
      if (event.target.closest(".filters")) {
        setTimeout(applyDashboardPatch, 250);
      }
    });

    document.addEventListener("change", event => {
      if (event.target.closest(".filters")) {
        setTimeout(applyDashboardPatch, 250);
      }
    });
  });
})();
