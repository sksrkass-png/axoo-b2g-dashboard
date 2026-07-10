const UI_REVIEW_OPTIONS = [
  ["new", "미검토"],
  ["hold", "보류"],
  ["reviewing", "검토중"],
  ["proposal", "제안 준비"],
  ["done", "제안 완료"]
];

let artSummaryData = [];

function shortSourceName(value) {
  const text = String(value || "").trim();

  if (text.includes("서울")) return "서울";
  if (text.includes("경기")) return "경기";
  if (text.includes("LH") || text.includes("SH")) return "LH/SH";
  if (text.includes("나라장터")) return "나라장터";

  return text || "-";
}

function formatLastUpdated(value) {
  const text = String(value || "").trim();

  if (!text || text === "-") return "-";

  const match = text.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);

  if (!match) return text.replace("(KST)", "").trim();

  const [, , month, day, hour, minute] = match;

  return `${month}.${day} ${hour}:${minute}`;
}

function getMetaValueFromCard(card, labelText) {
  const items = Array.from(card.querySelectorAll(".meta div"));

  for (const item of items) {
    const label = item.querySelector("span")?.textContent.trim() || "";

    if (label.includes(labelText)) {
      return item.textContent.replace(label, "").trim();
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
    console.warn("art summary data load failed", error);
  }
}

function moveLastUpdateToHeader() {
  const headerInner = document.querySelector(".header-inner");
  const lastUpdateCard = document.querySelector(".meta-card-wide");

  if (!headerInner || !lastUpdateCard) return;

  if (!lastUpdateCard.classList.contains("header-update-card")) {
    lastUpdateCard.classList.add("header-update-card");
    headerInner.appendChild(lastUpdateCard);
  }

  const value = lastUpdateCard.querySelector("#lastUpdatedAt");

  if (value) {
    value.textContent = formatLastUpdated(value.textContent);
  }
}

function setupTopSummaryCards() {
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

  opportunityCard.dataset.tabTarget = "opportunities";
  artCard.dataset.tabTarget = "art";
  agencyCard.dataset.tabTarget = "agencies";

  agencyCard.classList.add("meta-card-dark");

  if (metaBar.dataset.uiReordered !== "true") {
    metaBar.innerHTML = "";
    metaBar.appendChild(opportunityCard);
    metaBar.appendChild(artCard);
    metaBar.appendChild(agencyCard);
    metaBar.dataset.uiReordered = "true";
  }

  [opportunityCard, artCard, agencyCard].forEach(card => {
    if (card.dataset.clickReady === "true") return;

    card.dataset.clickReady = "true";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");

    card.addEventListener("click", () => {
      const target = card.dataset.tabTarget;
      document.querySelector(`.tab-button[data-tab="${target}"]`)?.click();
    });
  });
}

function renameAndReorderTabs() {
  const tabs = document.querySelector(".tabs");

  if (!tabs) return;

  const opportunityButton = tabs.querySelector('[data-tab="opportunities"]');
  const artButton = tabs.querySelector('[data-tab="art"]');
  const agencyButton = tabs.querySelector('[data-tab="agencies"]');

  if (!opportunityButton || !artButton || !agencyButton) return;

  opportunityButton.textContent = "❤️나라장터 공고";
  artButton.textContent = "💙건축물 미술작품";
  agencyButton.textContent = "🎯기관 타깃";

  if (tabs.dataset.newOrder === "true") return;

  const separator = document.createElement("span");
  separator.className = "tab-separator";
  separator.textContent = "｜";

  tabs.innerHTML = "";
  tabs.appendChild(opportunityButton);
  tabs.appendChild(artButton);
  tabs.appendChild(separator);
  tabs.appendChild(agencyButton);

  tabs.dataset.newOrder = "true";
}

function rewriteReviewSelect(select) {
  if (!select) return;

  const current = select.value || "new";
  const allowedValues = UI_REVIEW_OPTIONS.map(option => option[0]);
  const nextValue = allowedValues.includes(current) ? current : "new";

  const currentSignature = Array.from(select.options).map(option => `${option.value}:${option.textContent}`).join("|");
  const nextSignature = UI_REVIEW_OPTIONS.map(option => `${option[0]}:${option[1]}`).join("|");

  if (currentSignature === nextSignature) return;

  select.innerHTML = UI_REVIEW_OPTIONS.map(([value, label]) => {
    return `<option value="${value}" ${value === nextValue ? "selected" : ""}>${label}</option>`;
  }).join("");
}

function rewriteReviewControls() {
  document.querySelectorAll("#reviewFilter, #artReviewFilter, .review-select").forEach(select => {
    rewriteReviewSelect(select);
  });
}

function updateSourceLabels() {
  document.querySelectorAll("#artTab .badge, #artTab .summary-source").forEach(element => {
    const original = element.textContent.trim();
    const short = shortSourceName(original);

    if (short && original !== short) {
      element.textContent = short;
    }
  });
}

function getOpportunitySummary(card) {
  return {
    source: "나라장터",
    title: card.querySelector("h2")?.textContent.trim() || "제목 없음",
    period: getMetaValueFromCard(card, "마감") || "확인 필요",
    deadline: getMetaValueFromCard(card, "마감") || "확인 필요"
  };
}

function getArtSummary(card) {
  const firstBadge = card.querySelector(".badge")?.textContent.trim() || "공모 게시판";
  const source = shortSourceName(firstBadge);
  const title = card.querySelector("h2")?.textContent.trim() || "제목 없음";
  const published = getMetaValueFromCard(card, "공개일");
  const deadline = getMetaValueFromCard(card, "마감일");

  return {
    source,
    title,
    period: [published, deadline].filter(Boolean).join(" ~ ") || "확인 필요",
    deadline: deadline || "확인 필요"
  };
}

function makeAccordionCard(card, type) {
  if (card.dataset.accordionReady === "true") return;
  if (!card.querySelector("h2")) return;

  const data = type === "opportunity"
    ? getOpportunitySummary(card)
    : getArtSummary(card);

  const originalChildren = Array.from(card.childNodes);

  const details = document.createElement("details");
  details.className = "accordion-card";

  const summary = document.createElement("summary");
  summary.className = "accordion-summary";

  summary.innerHTML = `
    <div class="summary-source">${data.source}</div>
    <div class="summary-title">${data.title}</div>
    <div class="summary-period">
      <span>게재기간</span>
      <strong>${data.period}</strong>
    </div>
    <div class="summary-deadline">
      <span>마감일</span>
      <strong>${data.deadline}</strong>
    </div>
    <div class="summary-toggle">펼치기</div>
  `;

  const body = document.createElement("div");
  body.className = "accordion-body";

  originalChildren.forEach(child => {
    body.appendChild(child);
  });

  details.appendChild(summary);
  details.appendChild(body);

  card.innerHTML = "";
  card.appendChild(details);
  card.classList.add("card-as-accordion");
  card.dataset.accordionReady = "true";

  details.addEventListener("toggle", () => {
    const toggle = summary.querySelector(".summary-toggle");

    if (toggle) {
      toggle.textContent = details.open ? "접기" : "펼치기";
    }
  });
}

function applyAccordionCards() {
  document.querySelectorAll("#opportunitiesTab .card").forEach(card => {
    makeAccordionCard(card, "opportunity");
  });

  document.querySelectorAll("#artTab .card").forEach(card => {
    makeAccordionCard(card, "art");
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
  const seoul = artSummaryData.filter(item => String(item.source || "").includes("서울")).length;
  const gyeonggi = artSummaryData.filter(item => String(item.source || "").includes("경기")).length;
  const lhsh = artSummaryData.filter(item => {
    const source = String(item.source || "");
    return source.includes("LH") || source.includes("SH");
  }).length;

  setSummaryCard(0, "전체", total);
  setSummaryCard(1, "서울시", seoul);
  setSummaryCard(2, "경기도", gyeonggi);
  setSummaryCard(3, "LH&SH", lhsh);
}

function updateAgencySummary() {
  const agencyCount = document.getElementById("metaAgencyCount")?.textContent || "0";

  setSummaryCard(0, "전체", agencyCount);
  setSummaryCard(1, "우선 검토", "-");
  setSummaryCard(2, "제안 가능", "-");
  setSummaryCard(3, "보류", "-");
}

function updateSummaryByActiveTab() {
  const activeButton = document.querySelector(".tab-button.active");
  const activeTab = activeButton?.dataset.tab;

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

function removeCardTools() {
  document.querySelectorAll(".card-tools").forEach(element => element.remove());
}

function applyUiUpdates() {
  moveLastUpdateToHeader();
  setupTopSummaryCards();
  renameAndReorderTabs();
  rewriteReviewControls();
  updateSourceLabels();
  applyAccordionCards();
  updateSummaryByActiveTab();
  removeCardTools();
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadArtSummaryData();

  applyUiUpdates();

  document.querySelectorAll(".tab-button").forEach(button => {
    button.addEventListener("click", () => {
      setTimeout(() => {
        updateSummaryByActiveTab();
        applyUiUpdates();
      }, 0);
    });
  });

  const target = document.querySelector("main") || document.body;

  const observer = new MutationObserver(() => {
    applyUiUpdates();
  });

  observer.observe(target, {
    childList: true,
    subtree: true
  });
});
