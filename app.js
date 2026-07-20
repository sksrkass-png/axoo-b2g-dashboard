let allItems = [];
let targetAgencies = [];
let artCommissions = [];
let localProjects = [];
let dashboardMeta = {};

const REVIEW_STORAGE_KEY = "axooB2GReviewStatus";

const categoryNames = {
  arts_content_support: "예술·콘텐츠 지원사업",
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

const gradeOrder = {
  S: 0,
  A: 1,
  B: 2,
  C: 3
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
    const firstDate = raw.split("/")[0].trim();
    const parsed = new Date(firstDate.replace(" ", "T"));

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
  if (grade === "B") return "grade-b";
  if (grade === "C") return "grade-c";

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
  return `opportunity-${item.bidNtceNo || item.noticeNo || item.bidNtceNm || item.title || ""}`;
}

function getAgencyReviewKey(item) {
  return `agency-${item.agencyName || ""}-${item.region || ""}`;
}

function getArtReviewKey(item) {
  return `art-${item.bidNtceNo || item.title || ""}-${item.deadline || ""}`;
}

function getLocalReviewKey(item) {
  return `local-${item.noticeNo || item.sourceId || item.title || ""}-${item.deadline || ""}`;
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

      if (activePanel?.id === "agenciesTab") {
        renderAgencyCards();
      } else if (activePanel?.id === "artTab") {
        renderArtCards();
      } else if (activePanel?.id === "localTab") {
        renderLocalProjectCards();
      } else {
        renderOpportunityCards();
      }

      setTimeout(notifyRendered, 120);
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
      ? `최근 업데이트 : ${dashboardMeta.lastUpdatedAt}${dashboardMeta.timezone ? ` (${dashboardMeta.timezone})` : ""}`
      : "최근 업데이트 : -";
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
  if (bCount) bCount.textContent = items.filter(item => item.grade === "B" || item.grade === "C").length;
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
  return item.bidClseDt || item.bidNtceEndDt || item.opengDt || item.deadline || item.deadlineDate || "";
}

function createOpportunityCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  const gradeClass = getGradeClass(item.grade);
  const categoryLabel = categoryNames[item.category] || item.categoryLabel || "기타";
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
      </div>const categoryLabel =
            item.categoryLabel ||
            categoryNames[item.category] ||
            (item.category === "arts_content_support" ? "예술·콘텐츠 지원사업" : "기타");
    </div>

    <h2>${escapeHtml(safeText(item.bidNtceNm || item.title))}</h2>

    <div class="meta">
      <div><span>공고기관</span>${escapeHtml(safeText(item.ntceInsttNm || item.noticeAgency || item.agency))}</div>
      <div><span>수요기관</span>${escapeHtml(safeText(item.dminsttNm || item.demandAgency))}</div>
      <div><span>계약방법</span>${escapeHtml(safeText(item.cntrctCnclsMthdNm || item.bidMethdNm || item.contractMethod))}</div>
      <div><span>예산</span>${escapeHtml(formatMoney(item.budgetAmount || item.asignBdgtAmt || item.presmptPrce))}</div>
      <div><span>마감/개찰</span>${escapeHtml(safeText(getOpportunityDeadlineValue(item)))}</div>
      <div><span>공고번호</span>${escapeHtml(safeText(item.bidNtceNo || item.noticeNo))}</div>
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
      item.title,
      item.ntceInsttNm,
      item.dminsttNm,
      item.category,
      item.categoryLabel,
      ...(item.matchedKeywords || [])
    ].join(" ").toLowerCase();

    const reviewKey = getOpportunityReviewKey(item);
    const itemReviewStatus = getReviewStatus(reviewKey);

    const matchesSearch = !searchValue || searchTarget.includes(searchValue);
    const matchesGrade = gradeValue === "all" || item.grade === gradeValue;
    const matchesCategory = categoryValue === "all" || item.category === categoryValue;
    const matchesReview = reviewValue === "all" || itemReviewStatus === reviewValue;

    return matchesSearch && matchesGrade && matchesCategory && matchesReview;
  });

  filtered.sort((a, b) => {
    const gradeDiff = (gradeOrder[a.grade] ?? 9) - (gradeOrder[b.grade] ?? 9);

    if (gradeDiff !== 0) return gradeDiff;

    const aDeadline = getDDay(getOpportunityDeadlineValue(a)).sortDays;
    const bDeadline = getDDay(getOpportunityDeadlineValue(b)).sortDays;

    if (aDeadline !== bDeadline) return aDeadline - bDeadline;

    return Number(b.score || 0) - Number(a.score || 0);
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

function matchAgencyRegion(itemRegion, filterValue) {
  const region = safeText(itemRegion);

  if (filterValue === "all") return true;

  if (filterValue === "기타") {
    const majorRegions = ["서울", "경기", "인천", "부산", "대전", "광주", "대구", "울산", "세종"];

    return (
      region.includes("기타") ||
      region.includes("전국") ||
      !majorRegions.some(value => region.includes(value))
    );
  }

  return region.includes(filterValue);
}

function createAgencyCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  card.dataset.agencyName = safeText(item.agencyName);
  card.dataset.agencyRegion = safeText(item.region);
  card.dataset.agencyGrade = safeText(item.grade);
  card.dataset.agencyAwardCount = String(item.awardCount || 0);
  card.dataset.agencyPlanCount = String(item.orderPlanCount || 0);
  card.dataset.agencyRelatedCount = String(item.relatedCount || 0);

  const gradeClass = getGradeClass(item.grade);
  const keywords = Array.isArray(item.mainKeywords) ? item.mainKeywords : [];
  const evidenceSources = Array.isArray(item.evidenceSources) ? item.evidenceSources : [];
  const reviewKey = getAgencyReviewKey(item);

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

function renderAgencyCards() {
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

    const reviewKey = getAgencyReviewKey(item);
    const itemReviewStatus = getReviewStatus(reviewKey);

    const matchesSearch = !searchValue || searchTarget.includes(searchValue);
    const matchesRegion = matchAgencyRegion(item.region, regionValue);
    const matchesGrade = gradeValue === "all" || item.grade === gradeValue;
    const matchesReview = reviewValue === "all" || itemReviewStatus === reviewValue;
    const matchesAward = !awardOnly || Number(item.awardCount || 0) > 0;
    const matchesPlan = !planOnly || Number(item.orderPlanCount || 0) > 0;

    return matchesSearch && matchesRegion && matchesGrade && matchesReview && matchesAward && matchesPlan;
  });

  filtered.sort((a, b) => {
    const gradeDiff = (gradeOrder[a.grade] ?? 9) - (gradeOrder[b.grade] ?? 9);

    if (gradeDiff !== 0) return gradeDiff;

    return Number(b.estimatedAmount || 0) - Number(a.estimatedAmount || 0);
  });

  cards.innerHTML = "";

  if (!targetAgencies.length) {
    cards.innerHTML = `
      <article class="card">
        <h2>기관 타깃 데이터가 없습니다.</h2>
        <p class="reason">engine Actions를 실행해 target_agencies.json을 생성/동기화해 주세요.</p>
      </article>
    `;

    if (empty) empty.style.display = "none";

    notifyRendered();
    return;
  }

  filtered.forEach(item => {
    cards.appendChild(createAgencyCard(item));
  });

  if (empty) {
    empty.style.display = filtered.length ? "none" : "block";
  }

  bindReviewControls();
  notifyRendered();
}

function getArtSourceValue(item) {
  return item.source || item.region || item.agency || "";
}

function getArtSourceLabel(item) {
  return item.source || item.region || "공고 출처";
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
        <span class="badge category">${escapeHtml(safeText(getArtSourceLabel(item)))}</span>
        <span class="badge category">${escapeHtml(safeText(item.category || "건축물 미술작품"))}</span>
        <span class="badge category">${escapeHtml(safeText(item.status || "공모"))}</span>
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
      <div><span>예산</span>공고문 참조</div>
      <div><span>확인 방식</span>공고문/첨부파일 확인</div>
    </div>

    <div class="keywords">
      ${keywords.map(keyword => `<span class="keyword">${escapeHtml(keyword)}</span>`).join("")}
    </div>

    <div class="reason">
      건축물 미술작품 공모는 공고문과 첨부파일 기준으로 세부 예산, 접수 방식, 제출 서류를 확인해 주세요.
    </div>

    <p class="action">추천 액션: 공고문 확인 후 접수 기간, 설치 조건, 작품 규모, 제출 서류 검토</p>

    ${createReviewControl(reviewKey)}

    ${sourceUrl ? `<a class="link" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">공고문 보기</a>` : ""}
  `;

  return card;
}

function renderArtCards() {
  const cards = document.getElementById("artCards");
  const artSearchInput = document.getElementById("artSearchInput");
  const artSourceFilter = document.getElementById("artSourceFilter");
  const artReviewFilter = document.getElementById("artReviewFilter");

  if (!cards) return;

  const searchValue = plainText(artSearchInput?.value).toLowerCase();
  const sourceValue = artSourceFilter?.value || "all";
  const reviewValue = artReviewFilter?.value || "all";

  const filtered = artCommissions.filter(item => {
    const keywords = Array.isArray(item.keywords) ? item.keywords : [];

    const searchTarget = [
      item.title,
      item.agency,
      item.region,
      item.source,
      item.category,
      item.status,
      ...keywords
    ].join(" ").toLowerCase();

    const sourceTarget = getArtSourceValue(item);
    const reviewKey = getArtReviewKey(item);
    const itemReviewStatus = getReviewStatus(reviewKey);

    const matchesSearch = !searchValue || searchTarget.includes(searchValue);
    const matchesSource = sourceValue === "all" || sourceTarget.includes(sourceValue);
    const matchesReview = reviewValue === "all" || itemReviewStatus === reviewValue;

    return matchesSearch && matchesSource && matchesReview;
  });

  filtered.sort((a, b) => {
    const aDeadline = getDDay(a.deadline).sortDays;
    const bDeadline = getDDay(b.deadline).sortDays;

    if (aDeadline !== bDeadline) return aDeadline - bDeadline;

    return String(b.publishedDate || "").localeCompare(String(a.publishedDate || ""));
  });

  cards.innerHTML = "";

  if (!filtered.length) {
    cards.innerHTML = `
      <article class="card">
        <h2>조건에 맞는 건축물 미술작품 데이터가 없습니다.</h2>
        <p class="reason">검색어와 필터를 초기화하거나, engine Actions를 실행해 데이터를 동기화해 주세요.</p>
      </article>
    `;

    notifyRendered();
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

function getLocalDeadlineAndOpeningValue(item) {
  return item.deadlineAndOpening || item.deadline || item.openingDate || item.endDate || item.closeDate || "";
}

function getLocalProjectTypeValue(item) {
  return item.projectType || item.type || item.category || "기타";
}

function getLocalSourceUrl(item) {
  return safeUrl(item.sourceUrl || item.sourcePageUrl || item.rawSourcePageUrl || item.attachmentUrl || "");
}

function getLocalNoticeAgencyValue(item) {
  return item.noticeAgency || item.agencyName || item.sourceName || "서울특별시";
}

function getLocalDemandAgencyValue(item) {
  return item.demandAgency || item.agencyName || item.department || "확인 필요";
}

function getLocalContractMethodValue(item) {
  return item.contractMethod || "확인 필요";
}

function getCompactContractMethod(value) {
  const text = safeText(value);

  if (!text || text === "-") return "확인 필요";
  if (text.includes("협상에 의한 계약")) return "협상계약";
  if (text.includes("제한경쟁")) return "제한경쟁";
  if (text.includes("일반경쟁")) return "일반경쟁";
  if (text.includes("수의계약")) return "수의계약";
  if (text.includes("전자입찰")) return "전자입찰";
  if (text.includes("방문제출")) return "방문제출";

  return text.split("/")[0].trim();
}

function getLocalNoticeNoValue(item) {
  return item.noticeNo || item.sourceId || "";
}

function setupLocalProjectDefaultFilter() {
  const deadlineFilter = document.getElementById("localDeadlineStatusFilter");

  if (!deadlineFilter) return;
  if (deadlineFilter.dataset.defaultInitialized === "true") return;

  deadlineFilter.value = "all";
  deadlineFilter.dataset.defaultInitialized = "true";
}

function createLocalProjectCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  const gradeClass = getGradeClass(item.grade);
  const projectType = getLocalProjectTypeValue(item);
  const sourceUrl = getLocalSourceUrl(item);
  const reviewKey = getLocalReviewKey(item);
  const deadlineInfo = getDDay(getLocalDeadlineValue(item));

  const keywords = [
    ...(Array.isArray(item.directFitKeywords) ? item.directFitKeywords : []),
    ...(Array.isArray(item.supportFitKeywords) ? item.supportFitKeywords : []),
    ...(Array.isArray(item.keywords) ? item.keywords : [])
  ].filter(Boolean);

  const uniqueKeywords = Array.from(new Set(keywords)).slice(0, 8);

  const noticeAgency = getLocalNoticeAgencyValue(item);
  const demandAgency = getLocalDemandAgencyValue(item);
  const fullContractMethod = getLocalContractMethodValue(item);
  const compactContractMethod = getCompactContractMethod(fullContractMethod);
  const deadlineAndOpening = getLocalDeadlineAndOpeningValue(item);
  const noticeNo = getLocalNoticeNoValue(item);
  const reasonText = item.fitReason || item.reason || "AXOO Fit 산정 사유를 확인해 주세요.";

  card.innerHTML = `
    <div class="card-top">
      <div class="badges">
        <span class="badge ${gradeClass}">${escapeHtml(safeText(item.grade))}등급</span>
        <span class="badge category">${escapeHtml(safeText(projectType))}</span>
        ${item.opportunityStatus ? `<span class="badge category">${escapeHtml(item.opportunityStatus)}</span>` : ""}
        ${item.projectScale ? `<span class="badge category">${escapeHtml(item.projectScale)}</span>` : ""}
      </div>

      <div class="score-group">
        <div class="deadline-badge ${deadlineInfo.className}">${escapeHtml(deadlineInfo.label)}</div>
        <div class="score">${escapeHtml(safeText(item.score))}점</div>
      </div>
    </div>

    <h2>${escapeHtml(safeText(item.title))}</h2>

    <div class="meta">
      <div><span>공고기관</span>${escapeHtml(safeText(noticeAgency))}</div>
      <div><span>수요기관</span>${escapeHtml(safeText(demandAgency))}</div>
      <div><span>계약방법</span>${escapeHtml(safeText(compactContractMethod))}</div>
      <div><span>예산</span>${escapeHtml(formatMoney(item.budget))}</div>
      <div><span>마감/개찰</span>${escapeHtml(safeText(deadlineAndOpening))}</div>
      <div><span>공고번호</span>${escapeHtml(safeText(noticeNo))}</div>
    </div>

    <div class="keywords">
      ${uniqueKeywords.map(keyword => `<span class="keyword">${escapeHtml(keyword)}</span>`).join("")}
    </div>

    <div class="reason">
      ${escapeHtml(reasonText)}
    </div>

    <p class="action">추천 액션: ${escapeHtml(safeText(item.nextAction))}</p>
    <p class="action">계약방법 상세: ${escapeHtml(safeText(fullContractMethod))}</p>

    ${createReviewControl(reviewKey)}

    ${sourceUrl ? `<a class="link" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">원문 보기</a>` : ""}
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
  const deadlineStatusFilter = document.getElementById("localDeadlineStatusFilter");
  const deadlineStatusValue = deadlineStatusFilter?.value || "all";

  const filtered = localProjects.filter(item => {
    const projectType = getLocalProjectTypeValue(item);
    const reviewKey = getLocalReviewKey(item);
    const itemReviewStatus = getReviewStatus(reviewKey);
    const deadlineInfo = getDDay(getLocalDeadlineValue(item));

    const keywords = [
      ...(Array.isArray(item.directFitKeywords) ? item.directFitKeywords : []),
      ...(Array.isArray(item.supportFitKeywords) ? item.supportFitKeywords : []),
      ...(Array.isArray(item.keywords) ? item.keywords : [])
    ];

    const searchTarget = [
      item.title,
      item.sourceName,
      item.agencyName,
      item.noticeAgency,
      item.demandAgency,
      item.department,
      item.contractMethod,
      item.noticeNo,
      item.opportunityStatus,
      item.projectScale,
      projectType,
      item.region,
      ...keywords
    ].join(" ").toLowerCase();

    const matchesSearch = !searchValue || searchTarget.includes(searchValue);
    const matchesRegion = regionValue === "all" || safeText(item.region).includes(regionValue);
    const matchesType = typeValue === "all" || projectType === typeValue;
    const matchesGrade = gradeValue === "all" || item.grade === gradeValue;
    const matchesReview = reviewValue === "all" || itemReviewStatus === reviewValue;
    const matchesDeadline = matchesDeadlineStatus(deadlineInfo, deadlineStatusValue);

    return matchesSearch && matchesRegion && matchesType && matchesGrade && matchesReview && matchesDeadline;
  });

  filtered.sort((a, b) => {
    const gradeDiff = (gradeOrder[a.grade] ?? 9) - (gradeOrder[b.grade] ?? 9);

    if (gradeDiff !== 0) return gradeDiff;

    const aDeadline = getDDay(getLocalDeadlineValue(a)).sortDays;
    const bDeadline = getDDay(getLocalDeadlineValue(b)).sortDays;

    if (aDeadline !== bDeadline) return aDeadline - bDeadline;

    return Number(b.score || 0) - Number(a.score || 0);
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

      setTimeout(() => {
        if (target === "agencies") {
          renderAgencyCards();
        } else if (target === "art") {
          renderArtCards();
        } else if (target === "local") {
          renderLocalProjectCards();
        } else {
          renderOpportunityCards();
        }

        notifyRendered();
      }, 80);
    });
  });
}

function bindFilterControls() {
  const searchInput = document.getElementById("searchInput");
  const gradeFilter = document.getElementById("gradeFilter");
  const categoryFilter = document.getElementById("categoryFilter");
  const reviewFilter = document.getElementById("reviewFilter");

  const agencySearchInput = document.getElementById("agencySearchInput");
  const agencyRegionFilter = document.getElementById("agencyRegionFilter");
  const agencyGradeFilter = document.getElementById("agencyGradeFilter");
  const agencyReviewFilter = document.getElementById("agencyReviewFilter");
  const agencyAwardOnly = document.getElementById("agencyAwardOnly");
  const agencyPlanOnly = document.getElementById("agencyPlanOnly");

  const artSearchInput = document.getElementById("artSearchInput");
  const artSourceFilter = document.getElementById("artSourceFilter");
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

  if (agencySearchInput) agencySearchInput.addEventListener("input", renderAgencyCards);
  if (agencyRegionFilter) agencyRegionFilter.addEventListener("change", renderAgencyCards);
  if (agencyGradeFilter) agencyGradeFilter.addEventListener("change", renderAgencyCards);
  if (agencyReviewFilter) agencyReviewFilter.addEventListener("change", renderAgencyCards);
  if (agencyAwardOnly) agencyAwardOnly.addEventListener("change", renderAgencyCards);
  if (agencyPlanOnly) agencyPlanOnly.addEventListener("change", renderAgencyCards);

  if (artSearchInput) artSearchInput.addEventListener("input", renderArtCards);
  if (artSourceFilter) artSourceFilter.addEventListener("change", renderArtCards);
  if (artReviewFilter) artReviewFilter.addEventListener("change", renderArtCards);

  if (localSearchInput) localSearchInput.addEventListener("input", renderLocalProjectCards);
  if (localRegionFilter) localRegionFilter.addEventListener("change", renderLocalProjectCards);
  if (localTypeFilter) localTypeFilter.addEventListener("change", renderLocalProjectCards);
  if (localGradeFilter) localGradeFilter.addEventListener("change", renderLocalProjectCards);
  if (localReviewFilter) localReviewFilter.addEventListener("change", renderLocalProjectCards);
  if (localDeadlineStatusFilter) localDeadlineStatusFilter.addEventListener("change", renderLocalProjectCards);
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
  setupLocalProjectDefaultFilter();

  renderOpportunityCards();
  renderAgencyCards();
  renderArtCards();
  renderLocalProjectCards();

  bindFilterControls();

  setTimeout(notifyRendered, 250);
}

document.addEventListener("DOMContentLoaded", init);
