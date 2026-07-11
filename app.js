let allItems = [];
let targetAgencies = [];
let artCommissions = [];
let localProjects = [];
let dashboardMeta = {};

const REVIEW_STORAGE_KEY = "axooB2GReviewStatus";

const categoryNames = {
  public_art: "공공미술",
  media_art: "미디어아트",
  exhibition: "전시",
  festival: "문화행사",
  design: "공공디자인",
  tourism: "관광콘텐츠",
  general: "기타"
};

const reviewStatusOptions = {
  new: "미검토",
  reviewing: "검토중",
  proposal: "제안 준비",
  hold: "보류",
  done: "제안 완료"
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

function plainText(value) {
  return String(value ?? "").trim();
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

function parseDateValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (raw.includes("-")) {
    const parsed = new Date(raw.replace(" ", "T"));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (/^\d{8}/.test(raw)) {
    const year = raw.slice(0, 4);
    const month = raw.slice(4, 6);
    const day = raw.slice(6, 8);
    const hour = raw.slice(8, 10) || "00";
    const minute = raw.slice(10, 12) || "00";
    const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function getDDay(value) {
  const targetDate = parseDateValue(value);

  if (!targetDate) {
    return {
      label: "마감일 확인 필요",
      className: "deadline-unknown",
      sortDays: 9999
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diff = targetDate.getTime() - today.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return {
      label: "마감",
      className: "deadline-closed",
      sortDays: 9998
    };
  }

  if (days === 0) {
    return {
      label: "D-DAY",
      className: "deadline-urgent",
      sortDays: 0
    };
  }

  if (days <= 3) {
    return {
      label: `D-${days}`,
      className: "deadline-urgent",
      sortDays: days
    };
  }

  if (days <= 7) {
    return {
      label: `D-${days}`,
      className: "deadline-soon",
      sortDays: days
    };
  }

  return {
    label: `D-${days}`,
    className: "deadline-normal",
    sortDays: days
  };
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

function getLocalReviewKey(item) {
  return `local-${item.sourceId || item.title || ""}-${item.deadline || ""}`;
}

function notifyRendered() {
  window.dispatchEvent(new Event("axoo:rendered"));
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
    if (select.dataset.reviewBound === "true") return;

    select.dataset.reviewBound = "true";

    select.addEventListener("change", event => {
      const key = event.target.dataset.reviewKey;
      const value = event.target.value;

      setReviewStatus(key, value);

      const activePanel = document.querySelector(".tab-panel.active");

      if (activePanel?.id === "artTab") {
        renderArtCards();
      } else if (activePanel?.id === "localTab") {
        renderLocalProjectCards();
      } else {
        renderOpportunityCards();
      }

      setTimeout(notifyRendered, 80);
    });
  });
}

function renderDashboardMeta() {
  const lastUpdatedAt = document.getElementById("lastUpdatedAt");
  const opportunityCount = document.getElementById("metaOpportunityCount");
  const agencyCount = document.getElementById("metaAgencyCount");
  const artCount = document.getElementById("metaArtCount");
  const localCount = document.getElementById("metaLocalCount");

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

  if (localCount) {
    localCount.textContent = dashboardMeta.localProjectCount ?? localProjects.length ?? 0;
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

function getOpportunityDeadlineValue(item) {
  return item.bidClseDt || item.bidNtceEndDt || item.opengDt || item.deadline || "";
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
  const deadlineInfo = getDDay(getOpportunityDeadlineValue(item));

  card.innerHTML = `
    <div class="card-top">
      <div class="badges">
        <span class="badge ${gradeClass}">${escapeHtml(safeText(item.grade))}등급</span>
        <span class="badge category">${escapeHtml(categoryLabel)}</span>
      </div>

      <div class="score-group">
        <div class="deadline-badge ${deadlineInfo.className}">${escapeHtml(deadlineInfo.label)}</div>
        <div class="score">${escapeHtml(safeText(item.score))}점</div>
      </div>
    </div>

    <h2>${escapeHtml(safeText(item.bidNtceNm))}</h2>

    <div class="meta">
      <div><span>공고기관</span>${escapeHtml(safeText(item.ntceInsttNm))}</div>
      <div><span>수요기관</span>${escapeHtml(safeText(item.dminsttNm))}</div>
      <div><span>계약방법</span>${escapeHtml(safeText(item.cntrctCnclsMthdNm))}</div>
      <div><span>예산</span>${escapeHtml(formatMoney(item.budgetAmount || item.asignBdgtAmt || item.presmptPrce))}</div>
      <div><span>마감/개찰</span>${escapeHtml(safeText(getOpportunityDeadlineValue(item)))}</div>
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

  filtered.sort((a, b) => {
    const aDeadline = getDDay(getOpportunityDeadlineValue(a)).sortDays;
    const bDeadline = getDDay(getOpportunityDeadlineValue(b)).sortDays;

    if (aDeadline !== bDeadline) return aDeadline - bDeadline;

    return (b.score || 0) - (a.score || 0);
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
  notifyRendered();
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

  notifyRendered();
}

function createArtCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  const keywords = Array.isArray(item.keywords) ? item.keywords : [];
  const sourceUrl = safeUrl(item.sourceUrl);
  const reviewKey = getArtReviewKey(item);
  const deadlineInfo = getDDay(item.deadline);

  card.innerHTML = `
    <div class="card-top">
      <div class="badges">
        <span class="badge grade-a">${escapeHtml(safeText(item.source))}</span>
        <span class="badge category">${escapeHtml(safeText(item.category))}</span>
        <span class="badge category">${escapeHtml(safeText(item.status))}</span>
      </div>

      <div class="score-group">
        <div class="deadline-badge ${deadlineInfo.className}">${escapeHtml(deadlineInfo.label)}</div>
        <div class="score">${escapeHtml(safeText(item.region))}</div>
      </div>
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

  filtered.sort((a, b) => {
    const aDeadline = getDDay(a.deadline).sortDays;
    const bDeadline = getDDay(b.deadline).sortDays;

    return aDeadline - bDeadline;
  });

  cards.innerHTML = "";

  if (!filtered.length) {
    cards.innerHTML = `
      <article class="card">
        <h2>조건에 맞는 건축물 미술작품 데이터가 없습니다.</h2>
        <p class="reason">검토 상태 필터를 전체 상태로 바꾸거나, engine Actions를 실행해 데이터를 동기화해 주세요.</p>
      </article>
    `;
    return;
  }

  filtered.forEach(item => {
    cards.appendChild(createArtCard(item));
  });

  bindReviewControls();
  notifyRendered();
}

function getLocalDeadlineValue(item) {
  return item.deadline || item.endDate || item.closeDate || "";
}

function createLocalProjectCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  const gradeClass = getGradeClass(item.grade);
  const keywords = Array.isArray(item.keywords) ? item.keywords : [];
  const sourceUrl = safeUrl(item.sourceUrl);
  const reviewKey = getLocalReviewKey(item);
  const deadlineInfo = getDDay(getLocalDeadlineValue(item));

  card.innerHTML = `
    <div class="card-top">
      <div class="badges">
        <span class="badge ${gradeClass}">${escapeHtml(safeText(item.grade))}등급</span>
        <span class="badge category">${escapeHtml(safeText(item.projectType))}</span>
        <span class="badge category">${escapeHtml(safeText(item.sourceName))}</span>
      </div>

      <div class="score-group">
        <div class="deadline-badge ${deadlineInfo.className}">${escapeHtml(deadlineInfo.label)}</div>
        <div class="score">${escapeHtml(safeText(item.score))}점</div>
      </div>
    </div>

    <h2>${escapeHtml(safeText(item.title))}</h2>

    <div class="meta">
      <div><span>출처</span>${escapeHtml(safeText(item.sourceName))}</div>
      <div><span>기관</span>${escapeHtml(safeText(item.agencyName))}</div>
      <div><span>담당부서</span>${escapeHtml(safeText(item.department))}</div>
      <div><span>유형</span>${escapeHtml(safeText(item.projectType))}</div>
      <div><span>게재일</span>${escapeHtml(safeText(item.postedDate))}</div>
      <div><span>마감일</span>${escapeHtml(safeText(item.deadline))}</div>
    </div>

    <div class="keywords">
      ${keywords.map(keyword => `<span class="keyword">${escapeHtml(keyword)}</span>`).join("")}
    </div>

    <div class="reason">
      ${escapeHtml(safeText(item.reason))}
    </div>

    <p class="action">추천 액션: ${escapeHtml(safeText(item.nextAction))}</p>

    ${createReviewControl(reviewKey)}

    ${sourceUrl ? `<a class="link" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">소스 보기</a>` : ""}
  `;

  return card;
}

function matchesDeadlineStatus(deadlineInfo, status) {
  if (status === "all") return true;

  if (status === "soon") {
    return deadlineInfo.sortDays >= 0 && deadlineInfo.sortDays <= 7;
  }

  if (status === "active") {
    return deadlineInfo.sortDays >= 0 && deadlineInfo.sortDays < 9998;
  }

  if (status === "closed") {
    return deadlineInfo.className === "deadline-closed";
  }

  if (status === "unknown") {
    return deadlineInfo.className === "deadline-unknown";
  }

  return true;
}

function renderLocalProjectCards() {
  const cards = document.getElementById("localCards");
  const empty = document.getElementById("localEmptyMessage");

  if (!cards) return;

  const searchValue = plainText(document.getElementById("localSearchInput")?.value).toLowerCase();
  const regionValue = document.getElementById("localRegionFilter")?.value || "all";
  const typeValue = document.getElementById("localTypeFilter")?.value || "all";
  const gradeValue = document.getElementById("localGradeFilter")?.value || "all";
  const reviewValue = document.getElementById("localReviewFilter")?.value || "all";
    const deadlineStatusValue = document.getElementById("localDeadlineStatusFilter")?.value || "active";

  const filtered = localProjects.filter(item => {
    const searchTarget = [
      item.title,
      item.sourceName,
      item.agencyName,
      item.department,
      item.projectType,
      item.region,
      ...(item.keywords || [])
    ].join(" ").toLowerCase();

    const reviewKey = getLocalReviewKey(item);
    const itemReviewStatus = getReviewStatus(reviewKey);
    const deadlineInfo = getDDay(getLocalDeadlineValue(item));

    const matchesSearch = !searchValue || searchTarget.includes(searchValue);
    const matchesRegion = regionValue === "all" || safeText(item.region).includes(regionValue);
    const matchesType = typeValue === "all" || item.projectType === typeValue;
    const matchesGrade = gradeValue === "all" || item.grade === gradeValue;
    const matchesReview = reviewValue === "all" || itemReviewStatus === reviewValue;
    const matchesDeadline = matchesDeadlineStatus(deadlineInfo, deadlineStatusValue);

    return matchesSearch && matchesRegion && matchesType && matchesGrade && matchesReview && matchesDeadline;
  });

  filtered.sort((a, b) => {
    const aDeadline = getDDay(getLocalDeadlineValue(a)).sortDays;
    const bDeadline = getDDay(getLocalDeadlineValue(b)).sortDays;

    if (aDeadline !== bDeadline) return aDeadline - bDeadline;

    return (b.score || 0) - (a.score || 0);
  });

  cards.innerHTML = "";

  filtered.forEach(item => {
    cards.appendChild(createLocalProjectCard(item));
  });

  if (empty) {
    empty.style.display = filtered.length ? "none" : "block";
  }

  bindReviewControls();
  notifyRendered();
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");

  const panels = {
    opportunities: document.getElementById("opportunitiesTab"),
    agencies: document.getElementById("agenciesTab"),
    art: document.getElementById("artTab"),
    local: document.getElementById("localTab")
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

      setTimeout(notifyRendered, 80);
    });
  });
}

async function init() {
  setupTabs();

  allItems = await loadJson("data/b2g_opportunities.json", []);
  targetAgencies = await loadJson("data/target_agencies.json", []);
  artCommissions = await loadJson("data/art_commissions.json", []);
  localProjects = await loadJson("data/local_projects.json", []);
  dashboardMeta = await loadJson("data/dashboard_meta.json", {});

  renderDashboardMeta();
  renderSummary(allItems);
  renderOpportunityCards();
  renderAgencyCards();
  renderArtCards();
  renderLocalProjectCards();

  const searchInput = document.getElementById("searchInput");
  const gradeFilter = document.getElementById("gradeFilter");
  const categoryFilter = document.getElementById("categoryFilter");
  const reviewFilter = document.getElementById("reviewFilter");
  const artReviewFilter = document.getElementById("artReviewFilter");

  const localSearchInput = document.getElementById("localSearchInput");
  const localRegionFilter = document.getElementById("localRegionFilter");
  const localTypeFilter = document.getElementById("localTypeFilter");
  const localGradeFilter = document.getElementById("localGradeFilter");
  const localReviewFilter = document.getElementById("localReviewFilter");
  const localDeadlineStatusFilter = document.getElementById("localDeadlineStatusFilter");

  if (searchInput) searchInput.addEventListener("input", renderOpportunityCards);
  if (gradeFilter) gradeFilter.addEventListener("change", renderOpportunityCards);
  if (categoryFilter) categoryFilter.addEventListener("change", renderOpportunityCards);
  if (reviewFilter) reviewFilter.addEventListener("change", renderOpportunityCards);
  if (artReviewFilter) artReviewFilter.addEventListener("change", renderArtCards);

  if (localSearchInput) localSearchInput.addEventListener("input", renderLocalProjectCards);
  if (localRegionFilter) localRegionFilter.addEventListener("change", renderLocalProjectCards);
  if (localTypeFilter) localTypeFilter.addEventListener("change", renderLocalProjectCards);
  if (localGradeFilter) localGradeFilter.addEventListener("change", renderLocalProjectCards);
  if (localReviewFilter) localReviewFilter.addEventListener("change", renderLocalProjectCards);
  if (localDeadlineStatusFilter) localDeadlineStatusFilter.addEventListener("change", renderLocalProjectCards);

  setTimeout(notifyRendered, 250);
}

document.addEventListener("DOMContentLoaded", init);
function getAgencyPatchReviewKey(item) {
  return `agency-${item.agencyName || item.sourceId || ""}-${item.region || ""}`;
}

bindReviewControls = function () {
  document.querySelectorAll(".review-select").forEach(select => {
    if (select.dataset.reviewBound === "true") return;

    select.dataset.reviewBound = "true";

    select.addEventListener("change", event => {
      const key = event.target.dataset.reviewKey;
      const value = event.target.value;

      setReviewStatus(key, value);

      const activePanel = document.querySelector(".tab-panel.active");

      if (activePanel?.id === "artTab") {
        renderArtCards();
      } else if (activePanel?.id === "localTab") {
        renderLocalProjectCards();
      } else if (activePanel?.id === "agenciesTab") {
        renderAgencyCards();
      } else {
        renderOpportunityCards();
      }

      setTimeout(notifyRendered, 120);
    });
  });
};

function createAgencyCardFixed(item) {
  const card = document.createElement("article");
  card.className = "card";

  card.dataset.agencyRegion = safeText(item.region || "기타");
  card.dataset.agencyGrade = safeText(item.grade || "C");
  card.dataset.agencyAwardCount = String(item.awardCount || 0);
  card.dataset.agencyPlanCount = String(item.orderPlanCount || 0);
  card.dataset.agencyRelatedCount = String(item.relatedCount || 0);

  const gradeClass = getGradeClass(item.grade);
  const keywords = Array.isArray(item.mainKeywords) ? item.mainKeywords : [];
  const evidenceSources = Array.isArray(item.evidenceSources) ? item.evidenceSources : [];
  const reviewKey = getAgencyPatchReviewKey(item);

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
        <span class="badge ${gradeClass}">${escapeHtml(safeText(item.grade || "C"))}등급</span>
        <span class="badge category">${escapeHtml(safeText(item.agencyType || "기관"))}</span>
        <span class="badge category">${escapeHtml(safeText(item.region || "기타"))}</span>
      </div>
      <div class="score">관련 ${escapeHtml(safeText(item.relatedCount || 0))}건</div>
    </div>

    <h2>${escapeHtml(safeText(item.agencyName || "기관명 없음"))}</h2>

    <div class="meta">
      <div><span>기관유형</span>${escapeHtml(safeText(item.agencyType || "-"))}</div>
      <div><span>지역</span>${escapeHtml(safeText(item.region || "-"))}</div>
      <div><span>추정 규모</span>${escapeHtml(formatMoney(item.estimatedAmount))}</div>
      <div><span>관련 이력</span>${escapeHtml(safeText(item.relatedCount || 0))}건</div>
      <div><span>공고 이력</span>${escapeHtml(safeText(item.bidCount || 0))}건</div>
      <div><span>계약 이력</span>${escapeHtml(safeText(item.contractCount || 0))}건</div>
      <div><span>낙찰 이력</span>${escapeHtml(safeText(item.awardCount || 0))}건</div>
      <div><span>발주계획</span>${escapeHtml(safeText(item.orderPlanCount || 0))}건</div>
    </div>

    <div class="keywords">
      ${keywords.map(keyword => `<span class="keyword">${escapeHtml(keyword)}</span>`).join("")}
    </div>

    <div class="reason">
      ${escapeHtml(safeText(item.note || "기관 타깃 근거를 확인해 주세요."))}
    </div>

    <p class="action">제안 방향: ${escapeHtml(safeText(item.recommendedProposal || "-"))}</p>
    <p class="action">다음 액션: ${escapeHtml(safeText(item.nextAction || "-"))}</p>

    ${createReviewControl(reviewKey)}

    ${evidenceHtml}
  `;

  return card;
}

function matchAgencyRegion(itemRegion, filterValue) {
  const region = safeText(itemRegion);

  if (filterValue === "all") return true;

  if (filterValue === "기타") {
    return (
      region.includes("기타") ||
      region.includes("전국") ||
      !["서울", "경기", "인천", "부산", "대전", "광주", "대구", "울산", "세종"].some(value => region.includes(value))
    );
  }

  return region.includes(filterValue);
}

renderAgencyCards = function () {
  const cards = document.getElementById("agencyCards");
  const empty = document.getElementById("agencyEmptyMessage");

  if (!cards) return;

  const searchValue = plainText(document.getElementById("agencySearchInput")?.value).toLowerCase();
  const regionValue = document.getElementById("agencyRegionFilter")?.value || "all";
  const gradeValue = document.getElementById("agencyGradeFilter")?.value || "all";
  const reviewValue = document.getElementById("agencyReviewFilter")?.value || "all";
  const awardOnly = document.getElementById("agencyAwardOnly")?.checked || false;
  const planOnly = document.getElementById("agencyPlanOnly")?.checked || false;

  const filtered = targetAgencies.filter(item => {
    const keywords = Array.isArray(item.mainKeywords) ? item.mainKeywords : [];

    const searchTarget = [
      item.agencyName,
      item.agencyType,
      item.region,
      item.note,
      item.recommendedProposal,
      item.nextAction,
      ...keywords
    ].join(" ").toLowerCase();

    const reviewKey = getAgencyPatchReviewKey(item);
    const itemReviewStatus = getReviewStatus(reviewKey);

    const matchesSearch = !searchValue || searchTarget.includes(searchValue);
    const matchesRegion = matchAgencyRegion(item.region, regionValue);
    const matchesGrade = gradeValue === "all" || item.grade === gradeValue;
    const matchesReview = reviewValue === "all" || itemReviewStatus === reviewValue;
    const matchesAward = !awardOnly || Number(item.awardCount || 0) > 0;
    const matchesPlan = !planOnly || Number(item.orderPlanCount || 0) > 0;

    return matchesSearch && matchesRegion && matchesGrade && matchesReview && matchesAward && matchesPlan;
  });

  const gradeOrder = {
    S: 0,
    A: 1,
    B: 2,
    C: 3
  };

  filtered.sort((a, b) => {
    const gradeDiff = (gradeOrder[a.grade] ?? 9) - (gradeOrder[b.grade] ?? 9);
    if (gradeDiff !== 0) return gradeDiff;

    return Number(b.estimatedAmount || 0) - Number(a.estimatedAmount || 0);
  });

  cards.innerHTML = "";

  filtered.forEach(item => {
    cards.appendChild(createAgencyCardFixed(item));
  });

  if (empty) {
    empty.style.display = filtered.length ? "none" : "block";
  }

  bindReviewControls();

  setTimeout(notifyRendered, 120);
};

function bindAgencyFilterControlsFixed() {
  const search = document.getElementById("agencySearchInput");
  const region = document.getElementById("agencyRegionFilter");
  const grade = document.getElementById("agencyGradeFilter");
  const review = document.getElementById("agencyReviewFilter");
  const awardOnly = document.getElementById("agencyAwardOnly");
  const planOnly = document.getElementById("agencyPlanOnly");

  if (search && search.dataset.appAgencyBound !== "true") {
    search.addEventListener("input", renderAgencyCards);
    search.dataset.appAgencyBound = "true";
  }

  if (region && region.dataset.appAgencyBound !== "true") {
    region.addEventListener("change", renderAgencyCards);
    region.dataset.appAgencyBound = "true";
  }

  if (grade && grade.dataset.appAgencyBound !== "true") {
    grade.addEventListener("change", renderAgencyCards);
    grade.dataset.appAgencyBound = "true";
  }

  if (review && review.dataset.appAgencyBound !== "true") {
    review.addEventListener("change", renderAgencyCards);
    review.dataset.appAgencyBound = "true";
  }

  if (awardOnly && awardOnly.dataset.appAgencyBound !== "true") {
    awardOnly.addEventListener("change", renderAgencyCards);
    awardOnly.dataset.appAgencyBound = "true";
  }

  if (planOnly && planOnly.dataset.appAgencyBound !== "true") {
    planOnly.addEventListener("change", renderAgencyCards);
    planOnly.dataset.appAgencyBound = "true";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    bindAgencyFilterControlsFixed();
    renderAgencyCards();
  }, 900);

  setTimeout(() => {
    bindAgencyFilterControlsFixed();
    renderAgencyCards();
  }, 2200);
});

/* =========================
   Agency Direct Render Patch
   기관 타깃 강제 렌더링 패치
   ========================= */

(function () {
  function agencyPatchEscape(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function agencyPatchText(value, fallback = "-") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function agencyPatchMoney(value) {
    const number = Number(value || 0);
    if (!number) return "금액 미공개";
    return number.toLocaleString("ko-KR") + "원";
  }

  function agencyPatchUrl(value) {
    const url = String(value ?? "").trim();
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return "";
  }

  function findAgencyPanel() {
    return (
      document.getElementById("agenciesTab") ||
      document.getElementById("agencyTab") ||
      document.querySelector('.tab-panel[data-tab="agencies"]') ||
      document.querySelector(".tab-panel.active")
    );
  }

  function ensureAgencyCardsBox() {
    let cards = document.getElementById("agencyCards");

    if (cards) return cards;

    const panel = findAgencyPanel();

    if (!panel) {
      let diagnostic = document.getElementById("agencyPatchDiagnostic");

      if (!diagnostic) {
        diagnostic = document.createElement("div");
        diagnostic.id = "agencyPatchDiagnostic";
        diagnostic.style.cssText = `
          margin: 16px;
          padding: 16px;
          border-radius: 14px;
          background: #fff1f0;
          border: 1px solid rgba(255, 59, 48, 0.35);
          color: #111;
          font-weight: 800;
          z-index: 9999;
        `;
        document.body.prepend(diagnostic);
      }

      diagnostic.textContent = "기관 타깃 패치 실행됨: agenciesTab 또는 agencyCards 영역을 찾지 못했습니다.";
      return null;
    }

    cards = document.createElement("div");
    cards.id = "agencyCards";
    cards.className = "cards agency-direct-cards";
    panel.appendChild(cards);

    return cards;
  }

  function createAgencyPatchCard(item) {
    const keywords = Array.isArray(item.mainKeywords) ? item.mainKeywords : [];
    const evidenceSources = Array.isArray(item.evidenceSources) ? item.evidenceSources : [];

    const evidenceHtml = evidenceSources.length
      ? `
        <div class="evidence-box">
          <strong>근거 자료</strong>
          <div class="evidence-list">
            ${evidenceSources.slice(0, 4).map(source => {
              const sourceUrl = agencyPatchUrl(source.sourceUrl);

              return `
                <div class="evidence-item">
                  <div class="evidence-main">
                    <span class="evidence-type">${agencyPatchEscape(agencyPatchText(source.sourceType))}</span>
                    <span class="evidence-title">${agencyPatchEscape(agencyPatchText(source.title))}</span>
                  </div>
                  <div class="evidence-sub">
                    <span>${agencyPatchEscape(agencyPatchMoney(source.amount))}</span>
                    <span>${agencyPatchEscape(agencyPatchText(source.date))}</span>
                    ${sourceUrl ? `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">원문 보기</a>` : ""}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `
      : "";

    return `
      <article class="card agency-direct-card" style="display:block;">
        <div class="card-top">
          <div class="badges">
            <span class="badge grade-b">${agencyPatchEscape(agencyPatchText(item.grade, "C"))}등급</span>
            <span class="badge category">${agencyPatchEscape(agencyPatchText(item.agencyType, "기관"))}</span>
            <span class="badge category">${agencyPatchEscape(agencyPatchText(item.region, "기타"))}</span>
          </div>
          <div class="score">관련 ${agencyPatchEscape(agencyPatchText(item.relatedCount, "0"))}건</div>
        </div>

        <h2>${agencyPatchEscape(agencyPatchText(item.agencyName, "기관명 없음"))}</h2>

        <div class="meta">
          <div><span>기관유형</span>${agencyPatchEscape(agencyPatchText(item.agencyType))}</div>
          <div><span>지역</span>${agencyPatchEscape(agencyPatchText(item.region))}</div>
          <div><span>추정 규모</span>${agencyPatchEscape(agencyPatchMoney(item.estimatedAmount))}</div>
          <div><span>관련 이력</span>${agencyPatchEscape(agencyPatchText(item.relatedCount, "0"))}건</div>
          <div><span>공고 이력</span>${agencyPatchEscape(agencyPatchText(item.bidCount, "0"))}건</div>
          <div><span>계약 이력</span>${agencyPatchEscape(agencyPatchText(item.contractCount, "0"))}건</div>
          <div><span>낙찰 이력</span>${agencyPatchEscape(agencyPatchText(item.awardCount, "0"))}건</div>
          <div><span>발주계획</span>${agencyPatchEscape(agencyPatchText(item.orderPlanCount, "0"))}건</div>
        </div>

        <div class="keywords">
          ${keywords.map(keyword => `<span class="keyword">${agencyPatchEscape(keyword)}</span>`).join("")}
        </div>

        <div class="reason">
          ${agencyPatchEscape(agencyPatchText(item.note, "기관 타깃 근거를 확인해 주세요."))}
        </div>

        <p class="action">제안 방향: ${agencyPatchEscape(agencyPatchText(item.recommendedProposal))}</p>
        <p class="action">다음 액션: ${agencyPatchEscape(agencyPatchText(item.nextAction))}</p>

        ${evidenceHtml}
      </article>
    `;
  }

  async function renderAgencyDirectly() {
    const cards = ensureAgencyCardsBox();

    if (!cards) return;

    cards.style.display = "grid";
    cards.style.visibility = "visible";
    cards.style.opacity = "1";

    cards.innerHTML = `
      <article class="card" style="display:block;">
        <h2>기관 타깃 데이터를 불러오는 중입니다.</h2>
        <p class="reason">target_agencies.json 직접 연결을 확인하고 있습니다.</p>
      </article>
    `;

    try {
      const response = await fetch(`data/target_agencies.json?v=${Date.now()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data) || !data.length) {
        cards.innerHTML = `
          <article class="card" style="display:block;">
            <h2>기관 타깃 데이터가 비어 있습니다.</h2>
            <p class="reason">target_agencies.json은 연결되었지만 배열 데이터가 없습니다.</p>
          </article>
        `;
        return;
      }

      cards.innerHTML = data.map(createAgencyPatchCard).join("");

      const emptyMessage = document.getElementById("agencyEmptyMessage");

      if (emptyMessage) {
        emptyMessage.style.display = "none";
      }

      console.log(`[AXOO] 기관 타깃 직접 렌더링 완료: ${data.length}건`);
    } catch (error) {
      cards.innerHTML = `
        <article class="card" style="display:block;">
          <h2>기관 타깃 데이터를 불러오지 못했습니다.</h2>
          <p class="reason">data/target_agencies.json 연결 또는 JSON 형식을 확인해야 합니다.</p>
          <p class="action">${agencyPatchEscape(error.message)}</p>
        </article>
      `;

      console.error("[AXOO] 기관 타깃 직접 렌더링 실패:", error);
    }
  }

  window.renderAgencyDirectly = renderAgencyDirectly;

  function scheduleAgencyDirectRender() {
    setTimeout(renderAgencyDirectly, 700);
    setTimeout(renderAgencyDirectly, 2200);
    setTimeout(renderAgencyDirectly, 4800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleAgencyDirectRender);
  } else {
    scheduleAgencyDirectRender();
  }
})();
