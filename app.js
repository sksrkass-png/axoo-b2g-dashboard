let allItems = [];
let targetAgencies = [];
let artCommissions = [];
let dashboardMeta = {};

const categoryNames = {
  public_art: "공공미술",
  media_art: "미디어아트",
  exhibition: "전시",
  festival: "문화행사",
  design: "공공디자인",
  tourism: "관광콘텐츠",
  general: "기타"
};

const REVIEW_STORAGE_KEY = "axooB2GReviewStatus";

const reviewStatusOptions = {
  new: "미검토",
  reviewing: "검토중",
  proposal: "제안 준비",
  hold: "보류",
  done: "처리 완료"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeText(value) {
  const text = String(value ?? "").trim();
  return text ? text : "-";
}

function safeUrl(value) {
  const url = String(value ?? "").trim();

  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  return "";
}

function formatMoney(value) {
  const number = Number(value || 0);

  if (!number) return "금액 미공개";

  return number.toLocaleString("ko-KR") + "원";
}

function getGradeClass(grade) {
  if (grade === "S") return "grade-s";
  if (grade === "A") return "grade-a";
  return "grade-b";
}

async function loadJson(path, fallback = []) {
  try {
    const response = await fetch(`${path}?v=${Date.now()}`);

    if (!response.ok) {
      console.warn("JSON load failed:", path, response.status);
      return fallback;
    }

    return await response.json();
  } catch (error) {
    console.error("JSON load error:", path, error);
    return fallback;
  }
}

function getReviewStore() {
  try {
    return JSON.parse(localStorage.getItem(REVIEW_STORAGE_KEY)) || {};
  } catch (error) {
    return {};
  }
}

function saveReviewStore(store) {
  localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(store));
}

function getReviewStatus(key) {
  const store = getReviewStore();
  return store[key] || "new";
}

function setReviewStatus(key, value) {
  const store = getReviewStore();
  store[key] = value;
  saveReviewStore(store);
}

function getOpportunityReviewKey(item) {
  return `opportunity-${item.bidNtceNo || item.bidNtceNm || ""}`;
}

function getArtReviewKey(item) {
  return `art-${item.bidNtceNo || item.title || ""}-${item.deadline || ""}`;
}

function createReviewControl(key) {
  const currentStatus = getReviewStatus(key);

  return `
    <div class="review-box">
      <span class="review-label">검토 상태</span>
      <select class="review-select" data-review-key="${escapeHtml(key)}">
        ${Object.entries(reviewStatusOptions).map(([value, label]) => `
          <option value="${escapeHtml(value)}" ${value === currentStatus ? "selected" : ""}>
            ${escapeHtml(label)}
          </option>
        `).join("")}
      </select>
    </div>
  `;
}

function bindReviewControls() {
  document.querySelectorAll(".review-select").forEach(select => {
    select.addEventListener("change", event => {
      const key = event.target.dataset.reviewKey;
      const value = event.target.value;
      setReviewStatus(key, value);
    });
  });
}

function renderDashboardMeta() {
  const lastUpdatedAt = document.getElementById("lastUpdatedAt");
  const opportunityCount = document.getElementById("metaOpportunityCount");
  const agencyCount = document.getElementById("metaAgencyCount");
  const artCount = document.getElementById("metaArtCount");

  if (lastUpdatedAt) {
    lastUpdatedAt.textContent = dashboardMeta.lastUpdatedAt
      ? `${dashboardMeta.lastUpdatedAt} ${dashboardMeta.timezone ? `(${dashboardMeta.timezone})` : ""}`
      : "-";
  }

  if (opportunityCount) {
    opportunityCount.textContent = dashboardMeta.opportunityCount ?? allItems.length ?? 0;
  }

  if (agencyCount) {
    agencyCount.textContent = dashboardMeta.agencyCount ?? targetAgencies.length ?? 0;
  }

  if (artCount) {
    artCount.textContent = dashboardMeta.artCommissionCount ?? artCommissions.length ?? 0;
  }
}

function renderSummary(items) {
  const totalCount = document.getElementById("totalCount");
  const sCount = document.getElementById("sCount");
  const aCount = document.getElementById("aCount");
  const bCount = document.getElementById("bCount");

  if (totalCount) totalCount.textContent = items.length;
  if (sCount) sCount.textContent = items.filter(item => item.grade === "S").length;
  if (aCount) aCount.textContent = items.filter(item => item.grade === "A").length;
  if (bCount) bCount.textContent = items.filter(item => item.grade === "B").length;
}

function getDocumentUrl(item) {
  return safeUrl(
    item.ntceSpecDocUrl1 ||
    item.ntceSpecDocUrl2 ||
    item.ntceSpecDocUrl3 ||
    item.sourceUrl ||
    ""
  );
}

function createOpportunityCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  const gradeClass = getGradeClass(item.grade);
  const categoryLabel = categoryNames[item.category] || "기타";
  const docUrl = getDocumentUrl(item);
  const keywords = Array.isArray(item.matchedKeywords) ? item.matchedKeywords : [];
  const reasons = Array.isArray(item.scoreReasons) ? item.scoreReasons : [];
  const reviewKey = getOpportunityReviewKey(item);

  card.innerHTML = `
    <div class="card-top">
      <div class="badges">
        <span class="badge ${gradeClass}">${escapeHtml(safeText(item.grade))}등급</span>
        <span class="badge category">${escapeHtml(categoryLabel)}</span>
      </div>
      <div class="score">${escapeHtml(safeText(item.score))}점</div>
    </div>

    <h2>${escapeHtml(safeText(item.bidNtceNm))}</h2>

    <div class="meta">
      <div><span>공고기관</span>${escapeHtml(safeText(item.ntceInsttNm))}</div>
      <div><span>수요기관</span>${escapeHtml(safeText(item.dminsttNm))}</div>
      <div><span>계약방법</span>${escapeHtml(safeText(item.cntrctCnclsMthdNm))}</div>
      <div><span>예산</span>${escapeHtml(formatMoney(item.budgetAmount || item.asignBdgtAmt || item.presmptPrce))}</div>
      <div><span>개찰일</span>${escapeHtml(safeText(item.opengDt))}</div>
      <div><span>공고번호</span>${escapeHtml(safeText(item.bidNtceNo))}</div>
    </div>

    <div class="keywords">
      ${keywords.map(keyword => `<span class="keyword">${escapeHtml(keyword)}</span>`).join("")}
    </div>

    <div class="reason">
      ${reasons.length ? reasons.map(reason => escapeHtml(reason)).join(" · ") : "점수 산정 사유 없음"}
    </div>

    <p class="action">추천 액션: ${escapeHtml(safeText(item.recommendedAction))}</p>

    ${createReviewControl(reviewKey)}

    ${docUrl ? `<a class="link" href="${docUrl}" target="_blank" rel="noopener noreferrer">공고문 보기</a>` : ""}
  `;

  return card;
}

function renderOpportunityCards() {
  const searchInput = document.getElementById("searchInput");
  const gradeFilter = document.getElementById("gradeFilter");
  const categoryFilter = document.getElementById("categoryFilter");
  const reviewFilter = document.getElementById("reviewFilter");
  const artReviewFilter = document.getElementById("artReviewFilter");

  const searchValue = searchInput ? searchInput.value.toLowerCase() : "";
  const gradeValue = gradeFilter ? gradeFilter.value : "all";
  const categoryValue = categoryFilter ? categoryFilter.value : "all";
  const reviewValue = reviewFilter ? reviewFilter.value : "all";

  const filtered = allItems.filter(item => {
    const searchTarget = [
      item.bidNtceNm,
      item.ntceInsttNm,
      item.dminsttNm,
      item.category,
      ...(item.matchedKeywords || [])
    ].join(" ").toLowerCase();

    const matchesSearch = searchTarget.includes(searchValue);
    const matchesGrade = gradeValue === "all" || item.grade === gradeValue;
    const matchesCategory = categoryValue === "all" || item.category === categoryValue;

    const reviewKey = getOpportunityReviewKey(item);
    const itemReviewStatus = getReviewStatus(reviewKey);
    const matchesReview = reviewValue === "all" || itemReviewStatus === reviewValue;

    return matchesSearch && matchesGrade && matchesCategory && matchesReview;
  });

  const cards = document.getElementById("cards");
  const empty = document.getElementById("emptyMessage");

  if (!cards) return;

  cards.innerHTML = "";

  filtered.forEach(item => {
    cards.appendChild(createOpportunityCard(item));
  });

  if (empty) {
    empty.style.display = filtered.length ? "none" : "block";
  }

  bindReviewControls();
}

function createAgencyCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  const gradeClass = getGradeClass(item.grade);
  const keywords = Array.isArray(item.mainKeywords) ? item.mainKeywords : [];
  const evidenceSources = Array.isArray(item.evidenceSources) ? item.evidenceSources : [];

  const evidenceHtml = evidenceSources.length
    ? `
      <div class="evidence-box">
        <strong>근거 자료</strong>
        <div class="evidence-list">
          ${evidenceSources.slice(0, 4).map(source => {
            const sourceUrl = safeUrl(source.sourceUrl);
            return `
              <div class="evidence-item">
                <div class="evidence-main">
                  <span class="evidence-type">${escapeHtml(safeText(source.sourceType))}</span>
                  <span class="evidence-title">${escapeHtml(safeText(source.title))}</span>
                </div>
                <div class="evidence-sub">
                  <span>${escapeHtml(formatMoney(source.amount))}</span>
                  <span>${escapeHtml(safeText(source.date))}</span>
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
        <span class="badge ${gradeClass}">${escapeHtml(safeText(item.grade))}등급</span>
        <span class="badge category">${escapeHtml(safeText(item.agencyType))}</span>
        <span class="badge category">${escapeHtml(safeText(item.region))}</span>
      </div>
      <div class="score">관련 ${escapeHtml(safeText(item.relatedCount))}건</div>
    </div>

    <h2>${escapeHtml(safeText(item.agencyName))}</h2>

    <div class="meta">
      <div><span>기관유형</span>${escapeHtml(safeText(item.agencyType))}</div>
      <div><span>지역</span>${escapeHtml(safeText(item.region))}</div>
      <div><span>추정 규모</span>${escapeHtml(formatMoney(item.estimatedAmount))}</div>
      <div><span>관련 이력</span>${escapeHtml(safeText(item.relatedCount))}건</div>
      <div><span>공고 이력</span>${escapeHtml(safeText(item.bidCount || 0))}건</div>
      <div><span>계약 이력</span>${escapeHtml(safeText(item.contractCount || 0))}건</div>
    </div>

    <div class="keywords">
      ${keywords.map(keyword => `<span class="keyword">${escapeHtml(keyword)}</span>`).join("")}
    </div>

    <div class="reason">
      ${escapeHtml(safeText(item.note))}
    </div>

    <p class="action">제안 방향: ${escapeHtml(safeText(item.recommendedProposal))}</p>
    <p class="action">다음 액션: ${escapeHtml(safeText(item.nextAction))}</p>

    ${evidenceHtml}
  `;

  return card;
}

function renderAgencyCards() {
  const cards = document.getElementById("agencyCards");
  if (!cards) return;

  cards.innerHTML = "";

  if (!targetAgencies.length) {
    cards.innerHTML = `
      <article class="card">
        <h2>기관 타깃 데이터가 없습니다.</h2>
        <p class="reason">engine Actions를 실행해 target_agencies.json을 생성/동기화해 주세요.</p>
      </article>
    `;
    return;
  }

  targetAgencies.forEach(item => {
    cards.appendChild(createAgencyCard(item));
  });
}

function createArtCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  const keywords = Array.isArray(item.keywords) ? item.keywords : [];
  const sourceUrl = safeUrl(item.sourceUrl);
  const reviewKey = getArtReviewKey(item);

  card.innerHTML = `
    <div class="card-top">
      <div class="badges">
        <span class="badge grade-a">${escapeHtml(safeText(item.source))}</span>
        <span class="badge category">${escapeHtml(safeText(item.category))}</span>
        <span class="badge category">${escapeHtml(safeText(item.status))}</span>
      </div>
      <div class="score">${escapeHtml(safeText(item.region))}</div>
    </div>

    <h2>${escapeHtml(safeText(item.title))}</h2>

    <div class="meta">
      <div><span>기관</span>${escapeHtml(safeText(item.agency))}</div>
      <div><span>지역</span>${escapeHtml(safeText(item.region))}</div>
      <div><span>공개일</span>${escapeHtml(safeText(item.publishedDate))}</div>
      <div><span>마감일</span>${escapeHtml(safeText(item.deadline))}</div>
      <div><span>예산</span>${escapeHtml(formatMoney(item.budget))}</div>
    </div>

    <div class="keywords">
      ${keywords.map(keyword => `<span class="keyword">${escapeHtml(keyword)}</span>`).join("")}
    </div>

    <p class="action">추천 액션: ${escapeHtml(safeText(item.recommendedAction))}</p>

    ${createReviewControl(reviewKey)}

    ${sourceUrl ? `<a class="link" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">소스 보기</a>` : ""}
  `;

  return card;
}

function renderArtCards() {
  const cards = document.getElementById("artCards");
  const artReviewFilter = document.getElementById("artReviewFilter");

  if (!cards) return;

  const reviewValue = artReviewFilter ? artReviewFilter.value : "all";

  const filtered = artCommissions.filter(item => {
    const reviewKey = getArtReviewKey(item);
    const itemReviewStatus = getReviewStatus(reviewKey);

    return reviewValue === "all" || itemReviewStatus === reviewValue;
  });

  cards.innerHTML = "";

  if (!filtered.length) {
    cards.innerHTML = `
      <article class="card">
        <h2>조건에 맞는 건축물 미술작품 데이터가 없습니다.</h2>
        <p class="reason">검토 상태 필터를 전체 상태로 바꾸거나, engine Actions를 실행해 art_commissions.json을 동기화해 주세요.</p>
      </article>
    `;
    return;
  }

  filtered.forEach(item => {
    cards.appendChild(createArtCard(item));
  });

  bindReviewControls();
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const panels = {
    opportunities: document.getElementById("opportunitiesTab"),
    agencies: document.getElementById("agenciesTab"),
    art: document.getElementById("artTab")
  };

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.tab;

      buttons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      Object.values(panels).forEach(panel => {
        if (panel) panel.classList.remove("active");
      });

      if (panels[target]) {
        panels[target].classList.add("active");
      }
    });
  });
}

async function init() {
  setupTabs();

  allItems = await loadJson("data/b2g_opportunities.json", []);
  targetAgencies = await loadJson("data/target_agencies.json", []);
  artCommissions = await loadJson("data/art_commissions.json", []);
  dashboardMeta = await loadJson("data/dashboard_meta.json", {});

  renderDashboardMeta();
  renderSummary(allItems);
  renderOpportunityCards();
  renderAgencyCards();
  renderArtCards();

  const searchInput = document.getElementById("searchInput");
  const gradeFilter = document.getElementById("gradeFilter");
  const categoryFilter = document.getElementById("categoryFilter");
  const reviewFilter = document.getElementById("reviewFilter");
  const artReviewFilter = document.getElementById("artReviewFilter");

  if (searchInput) searchInput.addEventListener("input", renderOpportunityCards);
  if (gradeFilter) gradeFilter.addEventListener("change", renderOpportunityCards);
  if (categoryFilter) categoryFilter.addEventListener("change", renderOpportunityCards);
  if (reviewFilter) reviewFilter.addEventListener("change", renderOpportunityCards);
  if (artReviewFilter) artReviewFilter.addEventListener("change", renderArtCards);
}

document.addEventListener("DOMContentLoaded", init);

