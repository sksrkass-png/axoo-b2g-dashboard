let allItems = [];

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

function createCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  const gradeClass = item.grade === "S" ? "grade-s" : item.grade === "A" ? "grade-a" : "grade-b";
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

function renderCards() {
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
    cards.appendChild(createCard(item));
  });

  empty.style.display = filtered.length ? "none" : "block";
}

async function init() {
  try {
    const response = await fetch("data/b2g_opportunities.json");
    allItems = await response.json();

    renderSummary(allItems);
    renderCards();

    document.getElementById("searchInput").addEventListener("input", renderCards);
    document.getElementById("gradeFilter").addEventListener("change", renderCards);
    document.getElementById("categoryFilter").addEventListener("change", renderCards);
  } catch (error) {
    console.error(error);
    document.getElementById("cards").innerHTML = `
      <article class="card">
        <h2>데이터를 불러오지 못했습니다.</h2>
        <p>data/b2g_opportunities.json 파일이 있는지 확인해 주세요.</p>
      </article>
    `;
  }
}

init();
