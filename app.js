let allItems = [];
let targetAgencies = [];
let artCommissions = [];

const categoryNames = {
  public_art: "공공미술",
  media_art: "미디어아트",
  exhibition: "전시",
  festival: "문화행사",
  design: "공공디자인",
  tourism: "관광콘텐츠",
  general: "기타"
};

function formatMoney(value) {
  const number = Number(value || 0);

  if (!number) return "금액 미공개";

  return number.toLocaleString("ko-KR") + "원";
}

function safeText(value) {
  return value && String(value).trim() ? String(value) : "-";
}

function getDocumentUrl(item) {
  return item.ntceSpecDocUrl1 || item.ntceSpecDocUrl2 || "";
}

function renderSummary(items) {
  document.getElementById("totalCount").textContent = items.length;
  document.getElementById("sCount").textContent = items.filter(item => item.grade === "S").length;
  document.getElementById("aCount").textContent = items.filter(item => item.grade === "A").length;
  document.getElementById("bCount").textContent = items.filter(item => item.grade === "B").length;
}

function getGradeClass(grade) {
  if (grade === "S") return "grade-s";
  if (grade === "A") return "grade-a";
  return "grade-b";
}

function createOpportunityCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  const gradeClass = getGradeClass(item.grade);
  const categoryLabel = categoryNames[item.category] || "기타";
  const docUrl = getDocumentUrl(item);

  const keywords = Array.isArray(item.matchedKeywords) ? item.matchedKeywords : [];
  const reasons = Array.isArray(item.scoreReasons) ? item.scoreReasons : [];

  card.innerHTML = `
    <div class="card-top">
      <div class="badges">
        <span class="badge ${gradeClass}">${safeText(item.grade)}등급</span>
        <span class="badge category">${categoryLabel}</span>
      </div>
      <div class="score">${safeText(item.score)}점</div>
    </div>

    <h2>${safeText(item.bidNtceNm)}</h2>

    <div class="meta">
      <div><span>공고기관</span>${safeText(item.ntceInsttNm)}</div>
      <div><span>수요기관</span>${safeText(item.dminsttNm)}</div>
      <div><span>계약방법</span>${safeText(item.cntrctCnclsMthdNm)}</div>
      <div><span>예산</span>${formatMoney(item.budgetAmount || item.asignBdgtAmt || item.presmptPrce)}</div>
      <div><span>개찰일</span>${safeText(item.opengDt)}</div>
      <div><span>공고번호</span>${safeText(item.bidNtceNo)}</div>
    </div>

    <div class="keywords">
      ${keywords.map(keyword => `<span class="keyword">${keyword}</span>`).join("")}
    </div>

    <div class="reason">
      ${reasons.length ? reasons.join(" · ") : "점수 산정 사유 없음"}
    </div>

    <p class="action">추천 액션: ${safeText(item.recommendedAction)}</p>

    ${docUrl ? `<a class="link" href="${docUrl}" target="_blank" rel="noopener noreferrer">공고문 보기</a>` : ""}
  `;

  return card;
}

function renderOpportunityCards() {
  const searchValue = document.getElementById("searchInput").value.toLowerCase();
  const gradeValue = document.getElementById("gradeFilter").value;
  const categoryValue = document.getElementById("categoryFilter").value;

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

    return matchesSearch && matchesGrade && matchesCategory;
  });

  const cards = document.getElementById("cards");
  const empty = document.getElementById("emptyMessage");

  cards.innerHTML = "";

  filtered.forEach(item => {
    cards.appendChild(createOpportunityCard(item));
  });

  empty.style.display = filtered.length ? "none" : "block";
}

function createAgencyCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  const gradeClass = getGradeClass(item.grade);
  const keywords = Array.isArray(item.mainKeywords) ? item.mainKeywords : [];

  card.innerHTML = `
    <div class="card-top">
      <div class="badges">
        <span class="badge ${gradeClass}">${safeText(item.grade)}등급</span>
        <span class="badge category">${safeText(item.agencyType)}</span>
        <span class="badge category">${safeText(item.region)}</span>
      </div>
      <div class="score">관련 ${safeText(item.relatedCount)}건</div>
    </div>

    <h2>${safeText(item.agencyName)}</h2>

    <div class="meta">
      <div><span>기관유형</span>${safeText(item.agencyType)}</div>
      <div><span>지역</span>${safeText(item.region)}</div>
      <div><span>추정 규모</span>${formatMoney(item.estimatedAmount)}</div>
      <div><span>관련 이력</span>${safeText(item.relatedCount)}건</div>
    </div>

    <div class="keywords">
      ${keywords.map(keyword => `<span class="keyword">${keyword}</span>`).join("")}
    </div>

    <div class="reason">
      ${safeText(item.note)}
    </div>

    <p class="action">제안 방향: ${safeText(item.recommendedProposal)}</p>
    <p class="action">다음 액션: ${safeText(item.nextAction)}</p>
  `;

  return card;
}

function renderAgencyCards() {
  const cards = document.getElementById("agencyCards");
  cards.innerHTML = "";

  targetAgencies.forEach(item => {
    cards.appendChild(createAgencyCard(item));
  });
}

function createArtCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  const keywords = Array.isArray(item.keywords) ? item.keywords : [];

  card.innerHTML = `
    <div class="card-top">
      <div class="badges">
        <span class="badge grade-a">${safeText(item.source)}</span>
        <span class="badge category">${safeText(item.category)}</span>
        <span class="badge category">${safeText(item.status)}</span>
      </div>
      <div class="score">${safeText(item.region)}</div>
    </div>

    <h2>${safeText(item.title)}</h2>

    <div class="meta">
      <div><span>기관</span>${safeText(item.agency)}</div>
      <div><span>지역</span>${safeText(item.region)}</div>
      <div><span>공개일</span>${safeText(item.publishedDate)}</div>
      <div><span>예산</span>${formatMoney(item.budget)}</div>
    </div>

    <div class="keywords">
      ${keywords.map(keyword => `<span class="keyword">${keyword}</span>`).join("")}
    </div>

    <p class="action">추천 액션: ${safeText(item.recommendedAction)}</p>

    ${item.sourceUrl ? `<a class="link" href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer">소스 보기</a>` : ""}
  `;

  return card;
}

function renderArtCards() {
  const cards = document.getElementById("artCards");
  cards.innerHTML = "";

  artCommissions.forEach(item => {
    cards.appendChild(createArtCard(item));
  });
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

      Object.values(panels).forEach(panel => panel.classList.remove("active"));
      panels[target].classList.add("active");
    });
  });
}

async function loadJson(path, fallback = []) {
  try {
    const response = await fetch(path);
    if (!response.ok) return fallback;
    return await response.json();
  } catch (error) {
    console.error(path, error);
    return fallback;
  }
}

async function init() {
  setupTabs();

  allItems = await loadJson("data/b2g_opportunities.json", []);
  targetAgencies = await loadJson("data/target_agencies.json", []);
  artCommissions = await loadJson("data/art_commissions.json", []);

  renderSummary(allItems);
  renderOpportunityCards();
  renderAgencyCards();
  renderArtCards();

  document.getElementById("searchInput").addEventListener("input", renderOpportunityCards);
  document.getElementById("gradeFilter").addEventListener("change", renderOpportunityCards);
  document.getElementById("categoryFilter").addEventListener("change", renderOpportunityCards);
}

init();
