(function () {
  "use strict";

  const PRIORITY_DATA_URL = "data/dashboard/priority_projects.json";

  const CATEGORY_TABS = [
    {
      tab: "art",
      label: "건축물 미술작품",
      icon: "💙",
      type: "native"
    },
    {
      tab: "mural",
      label: "벽화 & 조형물",
      icon: "🧱",
      category: "mural_sculpture",
      type: "priority"
    },
    {
      tab: "exhibition",
      label: "전시 콘텐츠 기획 운영",
      icon: "🖼️",
      category: "exhibition_content",
      type: "priority"
    },
    {
      tab: "other",
      label: "기타 전체 공고",
      icon: "📂",
      category: "other",
      type: "priority"
    },
    {
      tab: "agencies",
      label: "기관 타깃",
      icon: "🎯",
      type: "native",
      separated: true
    }
  ];

  const state = {
    projects: [],
    loaded: false
  };

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, match => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[match]));
  }

  function formatCount(value) {
    const number = Number(value || 0);
    return number.toLocaleString("ko-KR");
  }

  function formatKrw(value) {
    const amount = Number(value || 0);

    if (!amount) return "예산 미확인";

    if (amount >= 100000000) {
      const eok = amount / 100000000;
      return `${eok.toFixed(eok >= 10 ? 0 : 1)}억`;
    }

    if (amount >= 10000) {
      return `${Math.round(amount / 10000).toLocaleString("ko-KR")}만원`;
    }

    return `${amount.toLocaleString("ko-KR")}원`;
  }

  function normalizeUrl(url) {
    const text = String(url || "").trim();

    if (!text) return "";

    return text;
  }

  async function loadPriorityProjects() {
    if (state.loaded) return state.projects;

    try {
      const response = await fetch(`${PRIORITY_DATA_URL}?v=${Date.now()}`);

      if (!response.ok) {
        throw new Error(`priority_projects.json load failed: ${response.status}`);
      }

      const data = await response.json();

      state.projects = Array.isArray(data) ? data : [];
      state.loaded = true;

      return state.projects;
    } catch (error) {
      console.warn("priority projects load failed", error);

      state.projects = [];
      state.loaded = true;

      return state.projects;
    }
  }

  function getProjectsByCategory(category) {
    return state.projects.filter(project => {
      return project.priorityCategory === category && project.isExcludedFromPriority !== true;
    });
  }

  function getExcludedProjects() {
    return state.projects.filter(project => project.isExcludedFromPriority === true);
  }

  function getGradeClass(grade) {
    return `priority-grade-${String(grade || "C").toLowerCase()}`;
  }

  function renderKeywordTags(project) {
    const keywords = Array.isArray(project.matchedPriorityKeywords)
      ? project.matchedPriorityKeywords
      : [];

    if (!keywords.length) {
      return `<span class="priority-tag muted">키워드 미분류</span>`;
    }

    return keywords.slice(0, 4).map(keyword => {
      return `<span class="priority-tag">${esc(keyword)}</span>`;
    }).join("");
  }

  function renderProjectCard(project) {
    const url = normalizeUrl(project.sourceUrl);
    const grade = project.grade || "C";
    const gradeReason = project.gradeReason || "등급 기준 정보 없음";
    const amount = formatKrw(project.amount);
    const deadline = project.deadline || "마감일 미확인";
    const published = project.publishedDate || "공고일 미확인";
    const sourceType = project.sourceType || "출처 미확인";

    return `
      <article class="priority-project-card">
        <div class="priority-card-head">
          <span class="priority-source">${esc(sourceType)}</span>
          <span
            class="priority-grade ${getGradeClass(grade)}"
            title="${esc(gradeReason)}"
            aria-label="${esc(gradeReason)}"
          >${esc(grade)}</span>
        </div>

        <h3 class="priority-title">${esc(project.title || "제목 없음")}</h3>

        <div class="priority-meta-grid">
          <div>
            <span>기관</span>
            <strong>${esc(project.agency || "기관 미확인")}</strong>
          </div>
          <div>
            <span>예산</span>
            <strong>${esc(amount)}</strong>
          </div>
          <div>
            <span>공고일</span>
            <strong>${esc(published)}</strong>
          </div>
          <div>
            <span>마감</span>
            <strong>${esc(deadline)}</strong>
          </div>
        </div>

        <div class="priority-tags">
          ${renderKeywordTags(project)}
        </div>

        <div class="priority-reason">
          <strong>등급 기준</strong>
          <p>${esc(gradeReason)}</p>
        </div>

        <div class="priority-actions">
          <span>${esc(project.nextAction || "검토")}</span>
          ${
            url
              ? `<a href="${esc(url)}" target="_blank" rel="noopener">공고 보기</a>`
              : `<em>링크 없음</em>`
          }
        </div>
      </article>
    `;
  }

  function renderPriorityPanel(tab, category) {
    const panel = ensurePriorityPanel(tab);
    const projects = getProjectsByCategory(category);
    const excludedCount = getExcludedProjects().length;

    panel.innerHTML = `
      <div class="priority-panel-head">
        <div>
          <p class="priority-eyebrow">AXOO Priority KR v1</p>
          <h2>${esc(getTabLabel(tab))}</h2>
          <p>
            나라장터와 로컬 프로젝트를 통합해 AXOO 우선순위 기준으로 분류했습니다.
            행사 운영대행성 공고는 우선순위에서 제외됩니다.
          </p>
        </div>
        <div class="priority-mini-stat">
          <span>표시 공고</span>
          <strong>${formatCount(projects.length)}건</strong>
          <small>보류 제외 ${formatCount(excludedCount)}건</small>
        </div>
      </div>

      <div class="grade-guide-box">
        <strong>등급 기준</strong>
        <p>
          등급은 AXOO 제안 가능성 기준입니다.
          S는 즉시 검토, A는 제안 가능성 높음, B는 모니터링,
          C는 낮은 우선순위, HOLD는 행사 운영대행성 제외 공고입니다.
          등급 배지에 마우스를 올리면 세부 선정 기준을 볼 수 있습니다.
        </p>
      </div>

      ${
        projects.length
          ? `<div class="priority-card-grid">${projects.map(renderProjectCard).join("")}</div>`
          : `<div class="priority-empty">해당 기준에 맞는 공고가 아직 없습니다.</div>`
      }
    `;
  }

  function getTabLabel(tab) {
    const item = CATEGORY_TABS.find(entry => entry.tab === tab);
    return item ? `${item.icon} ${item.label}` : tab;
  }

  function ensurePriorityPanel(tab) {
    const id = `${tab}Tab`;
    let panel = document.getElementById(id);

    if (panel) return panel;

    panel = document.createElement("section");
    panel.id = id;
    panel.className = "tab-panel priority-tab-panel";
    panel.style.display = "none";

    const existingPanel =
      document.getElementById("opportunitiesTab") ||
      document.getElementById("artTab") ||
      document.getElementById("agenciesTab");

    const parent =
      existingPanel?.parentElement ||
      document.querySelector("main") ||
      document.body;

    parent.appendChild(panel);

    return panel;
  }

  function ensureTabButton(entry) {
    const tabs = document.querySelector(".tabs");

    if (!tabs) return null;

    let button = tabs.querySelector(`.tab-button[data-tab="${entry.tab}"]`);

    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "tab-button";
      button.dataset.tab = entry.tab;
      tabs.appendChild(button);
    }

    button.textContent = `${entry.icon} ${entry.label}`;
    button.style.display = "";

    return button;
  }

  function hideOldTabs() {
    const tabs = document.querySelector(".tabs");

    if (!tabs) return;

    const oldOpportunity = tabs.querySelector('.tab-button[data-tab="opportunities"]');
    const oldLocal = tabs.querySelector('.tab-button[data-tab="local"]');

    if (oldOpportunity) oldOpportunity.style.display = "none";
    if (oldLocal) oldLocal.style.display = "none";
  }

  function setupTabs() {
    const tabs = document.querySelector(".tabs");

    if (!tabs) return;

    hideOldTabs();

    const orderedButtons = [];

    CATEGORY_TABS.forEach(entry => {
      const button = ensureTabButton(entry);

      if (!button) return;

      button.dataset.priorityReady = "true";

      button.onclick = event => {
        event.preventDefault();
        showTab(entry.tab);
      };

      orderedButtons.push({
        entry,
        button
      });
    });

    const separator = ensureAgencySeparator();

    orderedButtons.forEach(({ entry, button }) => {
      if (entry.separated && separator) {
        tabs.appendChild(separator);
      }

      tabs.appendChild(button);
    });
  }

  function ensureAgencySeparator() {
    const tabs = document.querySelector(".tabs");

    if (!tabs) return null;

    let separator = tabs.querySelector(".priority-tab-separator");

    if (!separator) {
      separator = document.createElement("span");
      separator.className = "priority-tab-separator";
      separator.textContent = "참고";
    }

    return separator;
  }

  function getNativePanel(tab) {
    if (tab === "art") return document.getElementById("artTab");

    if (tab === "agencies") {
      return (
        document.getElementById("agenciesTab") ||
        document.getElementById("agencyTab")
      );
    }

    return null;
  }

  function hideAllPanels() {
    [
      "opportunitiesTab",
      "localTab",
      "artTab",
      "agenciesTab",
      "agencyTab",
      "muralTab",
      "exhibitionTab",
      "otherTab"
    ].forEach(id => {
      const panel = document.getElementById(id);

      if (panel) {
        panel.style.display = "none";
      }
    });
  }

  function showTab(tab) {
    const buttons = $all(".tab-button");

    buttons.forEach(button => {
      button.classList.toggle("active", button.dataset.tab === tab);
    });

    hideAllPanels();

    const entry = CATEGORY_TABS.find(item => item.tab === tab);

    if (!entry) return;

    if (entry.type === "priority") {
      renderPriorityPanel(entry.tab, entry.category);

      const panel = document.getElementById(`${entry.tab}Tab`);
      if (panel) panel.style.display = "";

      return;
    }

    const panel = getNativePanel(tab);

    if (panel) {
      panel.style.display = "";
    }
  }

  function createMetaCard(id, label, value, targetTab) {
    const card = document.createElement("article");

    card.className = "meta-card priority-meta-card";
    card.dataset.tabTarget = targetTab;
    card.innerHTML = `
      <span class="meta-label">${esc(label)}</span>
      <strong class="meta-value" id="${esc(id)}">${esc(value)}</strong>
    `;

    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");

    card.addEventListener("click", () => {
      showTab(targetTab);
    });

    return card;
  }

  function setupMetaCards() {
    const metaBar = document.querySelector(".meta-bar");

    if (!metaBar) return;

    const artCount = document.getElementById("metaArtCount")?.textContent || "0";
    const muralCount = getProjectsByCategory("mural_sculpture").length;
    const exhibitionCount = getProjectsByCategory("exhibition_content").length;
    const otherCount = getProjectsByCategory("other").length;

    metaBar.innerHTML = "";

    metaBar.appendChild(
      createMetaCard(
        "priorityMetaArtCount",
        "1. 건축물 미술작품",
        artCount,
        "art"
      )
    );

    metaBar.appendChild(
      createMetaCard(
        "priorityMetaMuralCount",
        "2. 벽화 & 조형물",
        `${formatCount(muralCount)}건`,
        "mural"
      )
    );

    metaBar.appendChild(
      createMetaCard(
        "priorityMetaExhibitionCount",
        "3. 전시 콘텐츠 기획 운영",
        `${formatCount(exhibitionCount)}건`,
        "exhibition"
      )
    );

    metaBar.appendChild(
      createMetaCard(
        "priorityMetaOtherCount",
        "기타 전체 공고",
        `${formatCount(otherCount)}건`,
        "other"
      )
    );
  }

  async function applyPriorityDashboard() {
    await loadPriorityProjects();

    setupTabs();
    setupMetaCards();

    const active = document.querySelector(".tab-button.active")?.dataset.tab;

    if (!active || active === "opportunities" || active === "local") {
      showTab("art");
    }
  }

  function schedulePriorityPatch() {
    let count = 0;

    const timer = setInterval(() => {
      applyPriorityDashboard();

      count += 1;

      if (count >= 18) {
        clearInterval(timer);
      }
    }, 450);
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyPriorityDashboard();
    schedulePriorityPatch();

    document.addEventListener("click", event => {
      if (event.target.closest(".tab-button")) {
        setTimeout(applyPriorityDashboard, 160);
      }
    });
  });
})();
