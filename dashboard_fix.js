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

function renameAndReorderTabs() {
  const tabs = document.querySelector(".tabs");
  if (!tabs) return;

  const opportunityButton = tabs.querySelector('[data-tab="opportunities"]');
  const artButton = tabs.querySelector('[data-tab="art"]');
  const agencyButton = tabs.querySelector('[data-tab="agencies"]');

  if (!opportunityButton || !artButton || !agencyButton) return;
  if (tabs.dataset.reordered === "true") return;

  opportunityButton.textContent = "나라장터 공고";
  artButton.textContent = "건축물 미술작품";
  agencyButton.textContent = "기관 타깃";

  const separator = document.createElement("span");
  separator.className = "tab-separator";
  separator.textContent = "｜";

  tabs.innerHTML = "";
  tabs.appendChild(opportunityButton);
  tabs.appendChild(artButton);
  tabs.appendChild(separator);
  tabs.appendChild(agencyButton);

  tabs.dataset.reordered = "true";
}

function getCardSummaryData(card, type) {
  const title = card.querySelector("h2")?.textContent.trim() || "제목 없음";

  if (type === "opportunity") {
    return {
      source: "나라장터",
      title,
      period: getMetaValueFromCard(card, "마감") || "확인 필요",
      deadline: getMetaValueFromCard(card, "마감") || "확인 필요"
    };
  }

  return {
    source: card.querySelector(".badge")?.textContent.trim() || "공모 게시판",
    title,
    period: [
      getMetaValueFromCard(card, "공개일"),
      getMetaValueFromCard(card, "마감일")
    ].filter(Boolean).join(" ~ ") || "확인 필요",
    deadline: getMetaValueFromCard(card, "마감일") || "확인 필요"
  };
}

function makeAccordionCard(card, type) {
  if (card.dataset.accordionReady === "true") return;
  if (!card.querySelector("h2")) return;

  const data = getCardSummaryData(card, type);

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

function applyDashboardFixes() {
  renameAndReorderTabs();
  applyAccordionCards();
}

document.addEventListener("DOMContentLoaded", () => {
  applyDashboardFixes();

  const target = document.querySelector("main") || document.body;

  const observer = new MutationObserver(() => {
    applyDashboardFixes();
  });

  observer.observe(target, {
    childList: true,
    subtree: true
  });
});
