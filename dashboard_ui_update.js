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
  let localSummaryData = [];
  let agencySummaryData = [];

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

    if (text.includes("나라장터")) return "나라장터";
    if (text.includes("서울시 입찰공고")) return "서울";
    if (text.includes("서울특별시")) return "서울";
    if (text.includes("서울")) return "서울";
    if (text.includes("경기")) return "경기도";
    if (text.includes("LH") || text.includes("SH")) return "LH/SH";

    return text || "-";
  }

  function normalizeRegion(value) {
    const text = safeText(value);

    if (text.includes("서울")) return "서울";
    if (text.includes("경기")) return "경기";
    if (text.includes("인천")) return "인천";
    if (text.includes("부산")) return "부산";
    if (text.includes("대전")) return "대전";
    if (text.includes("광주")) return "광주";
    if (text.includes("대구")) return "대구";
    if (text.includes("울산")) return "울산";
    if (text.includes("세종")) return "세종";
    if (text.includes("강원")) return "기타";
    if (text.includes("충청")) return "기타";
    if (text.includes("충북")) return "기타";
    if (text.includes("충남")) return "기타";
    if (text.includes("전라")) return "기타";
    if (text.includes("전북")) return "기타";
    if (text.includes("전남")) return "기타";
    if (text.includes("경상")) return "기타";
    if (text.includes("경북")) return "기타";
    if (text.includes("경남")) return "기타";
    if (text.includes("제주")) return "기타";

    return text || "기타";
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

  async function loadLocalSummaryData() {
    try {
      const response = await fetch(`data/local_projects.json?v=${Date.now()}`);

      if (!response.ok) return;

      const data = await response.json();

      if (Array.isArray(data)) {
        localSummaryData = data;
      }
    } catch (error) {
      console.warn("local summary load failed", error);
    }
  }

  async function loadAgencySummaryData() {
    try {
      const response = await fetch(`data/target_agencies.json?v=${Date.now()}`);

      if (!response.ok) return;

      const data = await response.json();

      if (Array.isArray(data)) {
        agencySummaryData = data;
      }
    } catch (error) {
      console.warn("agency summary load failed", error);
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

  function findLocalByTitle(title) {
    const targetTitle = compactText(title);

    if (!targetTitle) return null;

    return localSummaryData.find(item => {
      const itemTitle = compactText(
        item.title ||
        item.name ||
        item.projectName ||
        getFirstValue(item, [
          "title",
          "name",
          "projectName",
          "사업명",
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

  function findAgencyByTitle(title) {
    const targetTitle = compactText(title);

    if (!targetTitle) return null;

    return agencySummaryData.find(item => {
      const agencyName = compactText(
        item.agencyName ||
        item.name ||
        item.title ||
        getFirstValue(item, [
          "agencyName",
          "name",
          "title",
          "기관명"
        ])
      );

      if (!agencyName) return false;

      return (
        agencyName === targetTitle ||
        agencyName.includes(targetTitle) ||
        targetTitle.includes(agencyName)
      );
    }) || null;
  }

  function formatKrw(value) {
    const number = Number(value || 0);

    if (!number) return "-";

    if (number >= 100000000) {
      return `${(number / 100000000).toFixed(1).replace(".0", "")}억`;
    }

    if (number >= 10000) {
      return `${Math.round(number / 10000).toLocaleString()}만`;
    }

    return number.toLocaleString();
  }

  function getAgencyGrade(data) {
    return safeText(
      data?.grade ||
      data?.priorityGrade ||
      data?.targetGrade ||
      ""
    ).replace("등급", "");
  }

  function getAgencyRegion(data) {
    return normalizeRegion(
      data?.region ||
      data?.area ||
      data?.location ||
      data?.agencyRegion ||
      ""
    );
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
    const artCard = document.getElementById("metaArtCount")?.closest(".meta-card");
    const localCard = document.getElementById("metaLocalCount")?.closest(".meta-card");
    const agencyCard = document.getElementById("metaAgencyCount")?.closest(".meta-card");

    if (!opportunityCard || !artCard || !localCard || !agencyCard) return;

    const opportunityLabel = opportunityCard.querySelector(".meta-label");
    const artLabel = artCard.querySelector(".meta-label");
    const localLabel = localCard.querySelector(".meta-label");
    const agencyLabel = agencyCard.querySelector(".meta-label");

    if (opportunityLabel) opportunityLabel.textContent = "❤️나라장터 공고";
    if (artLabel) artLabel.textContent = "💙건축물 미술작품";
    if (localLabel) localLabel.textContent = "🧩로컬 프로젝트";
    if (agencyLabel) agencyLabel.textContent = "🎯기관 타깃";

    agencyCard.classList.remove("meta-card-dark");

    opportunityCard.dataset.tabTarget = "opportunities";
    artCard.dataset.tabTarget = "art";
    localCard.dataset.tabTarget = "local";
    agencyCard.dataset.tabTarget = "agencies";

    metaBar.appendChild(opportunityCard);
    metaBar.appendChild(artCard);
    metaBar.appendChild(localCard);
    metaBar.appendChild(agencyCard);

    [opportunityCard, artCard, localCard, agencyCard].forEach(card => {
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

      card.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();
        card.click();
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
    const localButton = tabs.querySelector('[data-tab="local"]');
    const agencyButton = tabs.querySelector('[data-tab="agencies"]');

    if (!opportunityButton || !artButton || !localButton || !agencyButton) return;

    opportunityButton.textContent = "❤️나라장터 공고";
    artButton.textContent = "💙건축물 미술작품";
    localButton.textContent = "🧩로컬 프로젝트";
    agencyButton.textContent = "🎯기관 타깃";

    tabs.appendChild(opportunityButton);
    tabs.appendChild(artButton);
    tabs.appendChild(localButton);
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
    document.querySelectorAll("#reviewFilter, #artReviewFilter, #localReviewFilter, #agencyReviewFilter").forEach(select => {
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
    document.querySelectorAll("#artTab .badge, #artTab .summary-source, #localTab .badge, #localTab .summary-source").forEach(element => {
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

      return text === "S등급" || text === "A등급" || text === "B등급" || text === "C등급";
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
      sourceUrl,
      attachmentUrl: ""
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
      sourceUrl: "",
      attachmentUrl: ""
    };
  }

  function getLocalSummary(card) {
    const title = safeText(card.querySelector("h2")?.textContent) || "제목 없음";
    const matchedItem = findLocalByTitle(title);

    const sourceRaw =
      getFirstValue(matchedItem, [
        "sourceName",
        "sourceType",
        "agencyName",
        "source"
      ]) ||
      getMetaValue(card, "출처") ||
      "로컬";

    const publishedRaw =
      getFirstValue(matchedItem, [
        "postedDate",
        "publishedDate",
        "postingDate",
        "noticeDate",
        "createdDate",
        "regDate",
        "게재일",
        "게시일",
        "등록일"
      ]) ||
      getMetaValue(card, "게재일") ||
      getMetaValue(card, "공개일") ||
      getMetaValue(card, "등록일") ||
      "";

    const deadlineRaw =
      getFirstValue(matchedItem, [
        "deadline",
        "deadlineDate",
        "closeDate",
        "endDate",
        "마감일"
      ]) ||
      getMetaValue(card, "마감일") ||
      getMetaValue(card, "마감") ||
      "";

    const sourceUrl =
      getFirstValue(matchedItem, [
        "sourcePageUrl",
        "sourceUrl",
        "url",
        "link",
        "originUrl",
        "detailUrl",
        "postUrl",
        "공고URL",
        "원문URL"
      ]);

    const attachmentUrl =
      getFirstValue(matchedItem, [
        "attachmentUrl",
        "fileUrl",
        "FILE_URL",
        "attachFileUrl",
        "첨부URL"
      ]);

    const publishedDate = formatDateOnly(publishedRaw);
    const deadlineDate = formatDateOnly(deadlineRaw);

    return {
      source: shortSourceName(sourceRaw) || "로컬",
      grade: getGradeText(card),
      title,
      period: publishedDate || "확인 필요",
      deadline: deadlineDate || "확인 필요",
      sourceUrl,
      attachmentUrl
    };
  }

  function getAgencySummary(card) {
    const title = safeText(card.querySelector("h2")?.textContent) || "기관명 없음";
    const matchedAgency = findAgencyByTitle(title);

    const badgeTexts = Array.from(card.querySelectorAll(".badge"))
      .map(badge => safeText(badge.textContent))
      .filter(Boolean);

    const regionFromCard = badgeTexts.find(text =>
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

    const region = matchedAgency ? getAgencyRegion(matchedAgency) : regionFromCard;

    const related =
      matchedAgency
        ? `관련 ${matchedAgency.relatedCount || 0}건`
        : safeText(card.querySelector(".score")?.textContent) ||
          getMetaValue(card, "관련 이력") ||
          "관련 이력 확인";

    return {
      source: "기관",
      grade: "",
      title,
      period: region,
      deadline: related,
      sourceUrl: "",
      attachmentUrl: ""
    };
  }

  function appendSourceButtons(body, data, existingLink) {
    const sourceUrl = data.sourceUrl || existingLink?.href || "";
    const attachmentUrl = data.attachmentUrl || "";

    if (!sourceUrl && !attachmentUrl) return;

    if (existingLink) {
      existingLink.style.display = "none";
    }

    const sourceViewBox = document.createElement("div");
    sourceViewBox.className = "source-view-box";

    const links = [];

    if (sourceUrl) {
      links.push(`
        <a class="source-view-link" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">
          공고 원문 보기
        </a>
      `);
    }

    if (attachmentUrl && attachmentUrl !== sourceUrl) {
      links.push(`
        <a class="source-view-link source-view-link-secondary" href="${attachmentUrl}" target="_blank" rel="noopener noreferrer">
          첨부파일 보기
        </a>
      `);
    }

    sourceViewBox.innerHTML = links.join("");
    body.appendChild(sourceViewBox);
  }

  function makeAccordion(card, type) {
    if (!card || card.dataset.accordionReady === "true") return;
    if (!card.querySelector("h2")) return;

    let data;

    if (type === "art") {
      data = getArtSummary(card);
    } else if (type === "agency") {
      data = getAgencySummary(card);
    } else if (type === "local") {
      data = getLocalSummary(card);
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

    if (type === "opportunity" || type === "local") {
      const existingLink = body.querySelector("a[href]");
      appendSourceButtons(body, data, existingLink);
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

    document.querySelectorAll("#localCards .card").forEach(card => {
      makeAccordion(card, "local");
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

  function updateLocalSummary() {
    const total = localSummaryData.length || document.getElementById("metaLocalCount")?.textContent || "0";

    const s = localSummaryData.filter(item => safeText(item.grade) === "S").length;
    const a = localSummaryData.filter(item => safeText(item.grade) === "A").length;
    const b = localSummaryData.filter(item => safeText(item.grade) === "B").length;

    setSummaryCard(0, "전체", total);
    setSummaryCard(1, "S등급", s);
    setSummaryCard(2, "A등급", a);
    setSummaryCard(3, "B등급", b);
  }

  function updateAgencySummary() {
    const total = agencySummaryData.length || document.getElementById("metaAgencyCount")?.textContent || "0";

    const priority = agencySummaryData.filter(item =>
      getAgencyGrade(item) === "S" || getAgencyGrade(item) === "A"
    ).length;

    const award = agencySummaryData.filter(item =>
      Number(item.awardCount || 0) > 0
    ).length;

    const plan = agencySummaryData.filter(item =>
      Number(item.orderPlanCount || 0) > 0
    ).length;

    setSummaryCard(0, "전체", total);
    setSummaryCard(1, "S/A등급", priority);
    setSummaryCard(2, "낙찰 있음", award);
    setSummaryCard(3, "발주계획", plan);
  }

  function updateSummaryByActiveTab() {
    const activeTab = getActiveTab();

    if (activeTab === "art") {
      updateArtSummary();
      return;
    }

    if (activeTab === "local") {
      updateLocalSummary();
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

    function renderAgencyFallbackCards() {
    const cards = document.getElementById("agencyCards");

    if (!cards) return;
    if (!Array.isArray(agencySummaryData) || !agencySummaryData.length) return;

    const currentText = safeText(cards.textContent);
    const hasRealAgencyTitle = Array.from(cards.querySelectorAll("h2, .summary-title")).some(element => {
      const text = safeText(element.textContent);

      return (
        text &&
        !text.includes("기관 타깃 데이터가 없습니다") &&
        !text.includes("조건에 맞는 기관 타깃이 없습니다")
      );
    });

    if (hasRealAgencyTitle && cards.dataset.fallbackRendered === "true") {
      return;
    }

    if (hasRealAgencyTitle && !currentText.includes("기관 타깃 데이터가 없습니다")) {
      return;
    }

    cards.innerHTML = "";

    agencySummaryData.forEach(item => {
      const card = document.createElement("article");
      card.className = "card";

      const keywords = Array.isArray(item.mainKeywords) ? item.mainKeywords : [];
      const evidenceSources = Array.isArray(item.evidenceSources) ? item.evidenceSources : [];

      const evidenceHtml = evidenceSources.length
        ? `
          <div class="evidence-box">
            <strong>근거 자료</strong>
            <div class="evidence-list">
              ${evidenceSources.slice(0, 4).map(source => {
                const sourceUrl = safeText(source.sourceUrl);

                return `
                  <div class="evidence-item">
                    <div class="evidence-main">
                      <span class="evidence-type">${safeText(source.sourceType)}</span>
                      <span class="evidence-title">${safeText(source.title)}</span>
                    </div>
                    <div class="evidence-sub">
                      <span>${formatKrw(source.amount)}</span>
                      <span>${safeText(source.date)}</span>
                      ${sourceUrl ? `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">원문 보기</a>` : ""}
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `
        : "";

      card.innerHTML = `
        <div class="card-top">
          <div class="badges">
            <span class="badge grade-b">${safeText(item.grade || "B")}등급</span>
            <span class="badge category">${safeText(item.agencyType || "기관")}</span>
            <span class="badge category">${safeText(item.region || "기타")}</span>
          </div>
          <div class="score">관련 ${safeText(item.relatedCount || 0)}건</div>
        </div>

        <h2>${safeText(item.agencyName || "기관명 없음")}</h2>

        <div class="meta">
          <div><span>기관유형</span>${safeText(item.agencyType || "-")}</div>
          <div><span>지역</span>${safeText(item.region || "-")}</div>
          <div><span>추정 규모</span>${formatKrw(item.estimatedAmount)}</div>
          <div><span>관련 이력</span>${safeText(item.relatedCount || 0)}건</div>
          <div><span>공고 이력</span>${safeText(item.bidCount || 0)}건</div>
          <div><span>계약 이력</span>${safeText(item.contractCount || 0)}건</div>
          <div><span>낙찰 이력</span>${safeText(item.awardCount || 0)}건</div>
          <div><span>발주계획</span>${safeText(item.orderPlanCount || 0)}건</div>
        </div>

        <div class="keywords">
          ${keywords.map(keyword => `<span class="keyword">${safeText(keyword)}</span>`).join("")}
        </div>

        <div class="reason">
          ${safeText(item.note || "기관 타깃 근거를 확인해 주세요.")}
        </div>

        <p class="action">제안 방향: ${safeText(item.recommendedProposal || "-")}</p>
        <p class="action">다음 액션: ${safeText(item.nextAction || "-")}</p>

        ${evidenceHtml}
      `;

      cards.appendChild(card);
    });

    cards.dataset.fallbackRendered = "true";

    const emptyMessage = document.getElementById("agencyEmptyMessage");

    if (emptyMessage) {
      emptyMessage.style.display = "none";
    }
  }
  
  function enhanceAgencyCards() {
    document.querySelectorAll("#agencyCards .card.card-as-accordion").forEach(card => {
      if (card.dataset.agencyMetricsReady === "true") return;

      const title = safeText(card.querySelector(".summary-title")?.textContent);
      const data = findAgencyByTitle(title);
      const body = card.querySelector(".accordion-body");

      if (!data || !body) return;

      const region = getAgencyRegion(data);
      const grade = getAgencyGrade(data);

      card.dataset.agencyRegion = region;
      card.dataset.agencyGrade = grade;
      card.dataset.agencyAwardCount = String(data.awardCount || 0);
      card.dataset.agencyPlanCount = String(data.orderPlanCount || 0);
      card.dataset.agencyRelatedCount = String(data.relatedCount || 0);

      const summaryPeriod = card.querySelector(".summary-period strong");
      const summaryRelated = card.querySelector(".summary-deadline strong");

      if (summaryPeriod) {
        summaryPeriod.textContent = region || "기타";
      }

      if (summaryRelated) {
        summaryRelated.textContent = `관련 ${data.relatedCount || 0}건`;
      }

      const box = document.createElement("div");
      box.className = "agency-insight-box";

      box.innerHTML = `
        <div class="agency-metric-grid">
          <div><span>입찰</span><strong>${data.bidCount || 0}건</strong></div>
          <div><span>계약</span><strong>${data.contractCount || 0}건</strong></div>
          <div><span>낙찰</span><strong>${data.awardCount || 0}건</strong></div>
          <div><span>발주계획</span><strong>${data.orderPlanCount || 0}건</strong></div>
        </div>
        <div class="agency-action-line">
          <strong>총 관련 규모 ${formatKrw(data.estimatedAmount)}</strong>
          <span>${data.nextAction || "모니터링 유지"}</span>
        </div>
      `;

      body.insertBefore(box, body.firstChild);
      card.dataset.agencyMetricsReady = "true";
    });
  }

  function filterAgencyCards() {
    const keyword = safeText(document.getElementById("agencySearchInput")?.value).toLowerCase();
    const regionFilter = document.getElementById("agencyRegionFilter")?.value || "all";
    const gradeFilter = document.getElementById("agencyGradeFilter")?.value || "all";
    const reviewFilter = document.getElementById("agencyReviewFilter")?.value || "all";
    const awardOnly = document.getElementById("agencyAwardOnly")?.checked || false;
    const planOnly = document.getElementById("agencyPlanOnly")?.checked || false;

    let visibleCount = 0;

    document.querySelectorAll("#agencyCards .card").forEach(card => {
      const title = safeText(card.querySelector(".summary-title")?.textContent || card.querySelector("h2")?.textContent);
      const data = findAgencyByTitle(title);

      const text = safeText(card.textContent).toLowerCase();
      const region = data ? getAgencyRegion(data) : safeText(card.dataset.agencyRegion || getMetaValue(card, "지역") || "기타");
      const grade = data ? getAgencyGrade(data) : safeText(card.dataset.agencyGrade || "");
      const awardCount = data ? Number(data.awardCount || 0) : Number(card.dataset.agencyAwardCount || 0);
      const planCount = data ? Number(data.orderPlanCount || 0) : Number(card.dataset.agencyPlanCount || 0);
      const reviewValue = card.querySelector(".review-select")?.value || "new";

      const matchKeyword = !keyword || text.includes(keyword);
      const matchRegion =
        regionFilter === "all" ||
        (regionFilter === "기타" ? region === "기타" : region.includes(regionFilter));
      const matchGrade = gradeFilter === "all" || grade === gradeFilter;
      const matchReview = reviewFilter === "all" || reviewValue === reviewFilter;
      const matchAward = !awardOnly || awardCount > 0;
      const matchPlan = !planOnly || planCount > 0;

      const visible = matchKeyword && matchRegion && matchGrade && matchReview && matchAward && matchPlan;

      card.style.display = visible ? "" : "none";

      if (visible) {
        visibleCount += 1;
      }
    });

    const emptyMessage = document.getElementById("agencyEmptyMessage");

    if (emptyMessage) {
      emptyMessage.style.display = visibleCount === 0 ? "block" : "none";
    }
  }

  function bindAgencyFilters() {
    const search = document.getElementById("agencySearchInput");
    const region = document.getElementById("agencyRegionFilter");
    const grade = document.getElementById("agencyGradeFilter");
    const review = document.getElementById("agencyReviewFilter");
    const awardOnly = document.getElementById("agencyAwardOnly");
    const planOnly = document.getElementById("agencyPlanOnly");

    if (!search || search.dataset.bound === "true") return;

    const handler = () => filterAgencyCards();

    search.addEventListener("input", handler);
    region?.addEventListener("change", handler);
    grade?.addEventListener("change", handler);
    review?.addEventListener("change", handler);
    awardOnly?.addEventListener("change", handler);
    planOnly?.addEventListener("change", handler);

    search.dataset.bound = "true";
    filterAgencyCards();
  }

  function applyDashboardPatch() {
    try {
      moveLastUpdateIntoHeader();
      setupMetaCards();
      setupTabs();
      setupReviewControls();
      updateSourceLabels();
      renderAgencyFallbackCards();
      setupAccordions();
      enhanceAgencyCards();
      removeCardTools();
      updateSummaryByActiveTab();
      syncMetaCardsWithActiveTab();
      bindArtFilters();
      filterArtCards();
      bindAgencyFilters();
      filterAgencyCards();
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
    await loadLocalSummaryData();
    await loadAgencySummaryData();

    applyDashboardPatch();
    schedulePatch();

    window.addEventListener("axoo:rendered", () => {
      setTimeout(applyDashboardPatch, 80);
      setTimeout(applyDashboardPatch, 250);
    });

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
