(function () {
  "use strict";

  const PRIORITY_DATA_URL = "data/dashboard/priority_projects.json";

  const TAB_CONFIG = [
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
      type: "priority",
      category: "mural_sculpture"
    },
    {
      tab: "exhibition",
      label: "전시 콘텐츠 기획 운영",
      icon: "🖼️",
      type: "priority",
      category: "exhibition_content"
    },
    {
      tab: "other",
      label: "기타 전체 공고",
      icon: "📂",
      type: "priority",
      category: "other"
    },
    {
      tab: "agencies",
      label: "기관 타깃",
      icon: "🎯",
      type: "native"
    }
  ];

  const GRADE_ORDER = {
    S: 0,
    A: 1,
    B: 2,
    C: 3,
    HOLD: 9
  };

  const state = {
    projects: [],
    loaded: false,
    currentTab: "art"
  };

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (match) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[match];
    });
  }

  function formatCount(value) {
    return Number(value || 0).toLocaleString("ko-KR");
  }

  function formatKrw(value) {
    const amount = Number(value || 0);

    if (!amount) {
      return "예산 미확인";
    }

    if (amount >= 100000000) {
      const eok = amount / 100000000;
      return `${eok.toFixed(eok >= 10 ? 0 : 1)}억`;
    }

    if (amount >= 10000) {
      return `${Math.round(amount / 10000).toLocaleString("ko-KR")}만원`;
    }

    return `${amount.toLocaleString("ko-KR")}원`;
  }

  function compactDate(value) {
    const text = String(value || "").trim();

    if (!text) {
      return "확인 필요";
    }

    const match = text.match(/\d{4}[-.]\d{1,2}[-.]\d{1,2}/);

    if (match) {
      return match[0].replace(/\./g, "-");
    }

    return text;
  }

  function normalizeUrl(url) {
    const text = String(url || "").trim();

    if (!text) {
      return "";
    }

    return text;
  }

  function getTabConfig(tab) {
    return TAB_CONFIG.find(function (item) {
      return item.tab === tab;
    });
  }

  function getNativePanel(tab) {
    if (tab === "art") {
      return $("#artTab");
    }

    if (tab === "agencies") {
      return $("#agenciesTab") || $("#agencyTab");
    }

    return null;
  }

  function getPriorityPanelId(tab) {
    return `${tab}Tab`;
  }

  function getPriorityPanel(tab) {
    return document.getElementById(getPriorityPanelId(tab));
  }

  async function loadPriorityProjects() {
    if (state.loaded) {
      return state.projects;
    }

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
      console.warn("[AXOO Priority] priority_projects.json load failed", error);

      state.projects = [];
      state.loaded = true;

      return state.projects;
    }
  }

  function getDisplayProjectsByCategory(category) {
    return state.projects
      .filter(function (project) {
        return (
          project.priorityCategory === category &&
          project.isExcludedFromPriority !== true
        );
      })
      .sort(function (a, b) {
        const gradeDiff =
          (GRADE_ORDER[a.grade || "C"] ?? 9) -
          (GRADE_ORDER[b.grade || "C"] ?? 9);

        if (gradeDiff !== 0) {
          return gradeDiff;
        }

        const amountDiff = Number(b.amount || 0) - Number(a.amount || 0);

        if (amountDiff !== 0) {
          return amountDiff;
        }

        return String(a.deadline || "9999-99-99").localeCompare(
          String(b.deadline || "9999-99-99")
        );
      });
  }

  function getExcludedProjects() {
    return state.projects.filter(function (project) {
      return project.isExcludedFromPriority === true;
    });
  }

  function getPriorityCounts() {
    return {
      mural: getDisplayProjectsByCategory("mural_sculpture").length,
      exhibition: getDisplayProjectsByCategory("exhibition_content").length,
      other: getDisplayProjectsByCategory("other").length,
      excluded: getExcludedProjects().length
    };
  }

  function updateTextById(id, text) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = text;
    }
  }

  function getLegacyArtCount() {
    const legacy = document.getElementById("metaArtCount");

    if (legacy && legacy.textContent.trim()) {
      return legacy.textContent.trim();
    }

    const artCards = document.getElementById("artCards");

    if (artCards) {
      const count = artCards.querySelectorAll(".card, article").length;

      if (count > 0) {
        return formatCount(count);
      }
    }

    return "0";
  }

  function updateMetaCards() {
    const counts = getPriorityCounts();

    updateTextById("priorityMetaArtCount", getLegacyArtCount());
    updateTextById("priorityMetaMuralCount", `${formatCount(counts.mural)}건`);
    updateTextById("priorityMetaExhibitionCount", `${formatCount(counts.exhibition)}건`);
    updateTextById("priorityMetaOtherCount", `${formatCount(counts.other)}건`);

    $all(".meta-card[data-tab-target]").forEach(function (card) {
      const target = card.getAttribute("data-tab-target");

      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");

      card.onclick = function () {
        showTab(target);
      };

      card.onkeydown = function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          showTab(target);
        }
      };
    });
  }

  function updateSummaryCounts(projects) {
    const visibleProjects = Array.isArray(projects) ? projects : [];

    const total = visibleProjects.length;
    const sCount = visibleProjects.filter(function (item) {
      return item.grade === "S";
    }).length;
    const aCount = visibleProjects.filter(function (item) {
      return item.grade === "A";
    }).length;
    const bcCount = visibleProjects.filter(function (item) {
      return item.grade === "B" || item.grade === "C";
    }).length;

    updateTextById("totalCount", formatCount(total));
    updateTextById("sCount", formatCount(sCount));
    updateTextById("aCount", formatCount(aCount));
    updateTextById("bCount", formatCount(bcCount));
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

    return keywords
      .slice(0, 5)
      .map(function (keyword) {
        return `<span class="priority-tag">${esc(keyword)}</span>`;
      })
      .join("");
  }

  function renderProjectCard(project) {
    const grade = project.grade || "C";
    const gradeReason = project.gradeReason || "등급 기준 정보 없음";
    const url = normalizeUrl(project.sourceUrl);
    const title = project.title || "제목 없음";
    const agency = project.agency || "기관 미확인";
    const sourceType = project.sourceType || "출처 미확인";
    const amount = formatKrw(project.amount);
    const published = compactDate(project.publishedDate);
    const deadline = compactDate(project.deadline);
    const nextAction = project.nextAction || "검토";
    const categoryLabel = project.priorityCategoryLabel || "기타 전체 공고";

    return `
      <article class="priority-project-card">
        <div class="priority-card-head">
          <div class="priority-head-left">
            <span class="priority-source">${esc(sourceType)}</span>
            <span class="priority-category-label">${esc(categoryLabel)}</span>
          </div>

          <span
            class="priority-grade ${getGradeClass(grade)}"
            title="${esc(gradeReason)}"
            aria-label="${esc(gradeReason)}"
          >${esc(grade)}</span>
        </div>

        <h3 class="priority-title">${esc(title)}</h3>

        <div class="priority-meta-grid">
          <div>
            <span>기관</span>
            <strong>${esc(agency)}</strong>
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
          <span>${esc(nextAction)}</span>
          ${
            url
              ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">공고 보기</a>`
              : `<em>링크 없음</em>`
          }
        </div>
      </article>
    `;
  }

  function renderPriorityPanel(tab, category) {
    const config = getTabConfig(tab);
    const panel = getPriorityPanel(tab);

    if (!panel || !config) {
      return;
    }

    const projects = getDisplayProjectsByCategory(category);
    const excludedCount = getExcludedProjects().length;

    panel.innerHTML = `
      <div class="priority-panel-head">
        <div>
          <p class="priority-eyebrow">AXOO Priority KR v1.1</p>
          <h2>${esc(config.icon)} ${esc(config.label)}</h2>
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

    updateSummaryCounts(projects);
  }

  function hideAllPanels() {
    [
      "artTab",
      "muralTab",
      "exhibitionTab",
      "otherTab",
      "agenciesTab",
      "agencyTab",
      "opportunitiesTab",
      "localTab"
    ].forEach(function (id) {
      const panel = document.getElementById(id);

      if (panel) {
        panel.classList.remove("active");
        panel.style.display = "none";
      }
    });
  }

  function activateTabButton(tab) {
    $all(".tab-button").forEach(function (button) {
      const isActive = button.getAttribute("data-tab") === tab;

      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  function showNativeTab(tab) {
    const panel = getNativePanel(tab);

    if (!panel) {
      return;
    }

    panel.classList.add("active");
    panel.style.display = "";

    if (tab === "art") {
      const total = Number(String(getLegacyArtCount()).replace(/[^0-9]/g, "")) || 0;
      updateTextById("totalCount", formatCount(total));
      updateTextById("sCount", "-");
      updateTextById("aCount", "-");
      updateTextById("bCount", "-");
    }
  }

  function showTab(tab) {
    const config = getTabConfig(tab);

    if (!config) {
      return;
    }

    state.currentTab = tab;

    hideAllPanels();
    activateTabButton(tab);

    if (config.type === "priority") {
      renderPriorityPanel(tab, config.category);

      const panel = getPriorityPanel(tab);

      if (panel) {
        panel.classList.add("active");
        panel.style.display = "";
      }

      return;
    }

    showNativeTab(tab);
  }

  function setupTabButtons() {
    $all(".tab-button").forEach(function (button) {
      const tab = button.getAttribute("data-tab");

      if (tab === "opportunities" || tab === "local") {
        button.style.display = "none";
        return;
      }

      button.addEventListener("click", function (event) {
        event.preventDefault();

        const nextTab = button.getAttribute("data-tab");

        if (nextTab) {
          showTab(nextTab);
        }
      });
    });
  }

  function ensurePriorityPanels() {
    ["mural", "exhibition", "other"].forEach(function (tab) {
      let panel = getPriorityPanel(tab);

      if (panel) {
        return;
      }

      panel = document.createElement("section");
      panel.id = getPriorityPanelId(tab);
      panel.className = "tab-panel priority-tab-panel";
      panel.style.display = "none";

      const agenciesPanel = $("#agenciesTab") || $("#agencyTab");
      const main = $("main") || document.body;

      if (agenciesPanel && agenciesPanel.parentNode) {
        agenciesPanel.parentNode.insertBefore(panel, agenciesPanel);
      } else {
        main.appendChild(panel);
      }
    });
  }

  function ensureTabLayout() {
    const tabs = $(".tabs");

    if (!tabs) {
      return;
    }

    const desiredTabs = [
      {
        tab: "art",
        text: "💙 건축물 미술작품"
      },
      {
        tab: "mural",
        text: "🧱 벽화 & 조형물"
      },
      {
        tab: "exhibition",
        text: "🖼️ 전시 콘텐츠 기획 운영"
      },
      {
        tab: "other",
        text: "📂 기타 전체 공고"
      },
      {
        tab: "agencies",
        text: "🎯 기관 타깃"
      }
    ];

    desiredTabs.forEach(function (item) {
      let button = tabs.querySelector(`.tab-button[data-tab="${item.tab}"]`);

      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "tab-button";
        button.setAttribute("data-tab", item.tab);
      }

      button.textContent = item.text;
      button.style.display = "";
      tabs.appendChild(button);
    });

    const opportunityButton = tabs.querySelector('.tab-button[data-tab="opportunities"]');
    const localButton = tabs.querySelector('.tab-button[data-tab="local"]');

    if (opportunityButton) {
      opportunityButton.style.display = "none";
    }

    if (localButton) {
      localButton.style.display = "none";
    }

    let separator = tabs.querySelector(".priority-tab-separator");

    if (!separator) {
      separator = document.createElement("span");
      separator.className = "priority-tab-separator";
      separator.textContent = "참고";
    }

    const agenciesButton = tabs.querySelector('.tab-button[data-tab="agencies"]');

    if (agenciesButton) {
      tabs.insertBefore(separator, agenciesButton);
    }
  }

  function setupMetaFallback() {
    const metaBar = $(".meta-bar");

    if (!metaBar) {
      return;
    }

    const requiredCards = [
      {
        id: "priorityMetaArtCount",
        label: "1. 건축물 미술작품",
        tab: "art"
      },
      {
        id: "priorityMetaMuralCount",
        label: "2. 벽화 & 조형물",
        tab: "mural"
      },
      {
        id: "priorityMetaExhibitionCount",
        label: "3. 전시 콘텐츠 기획 운영",
        tab: "exhibition"
      },
      {
        id: "priorityMetaOtherCount",
        label: "기타 전체 공고",
        tab: "other"
      }
    ];

    const alreadyPriority = requiredCards.every(function (item) {
      return document.getElementById(item.id);
    });

    if (alreadyPriority) {
      return;
    }

    metaBar.innerHTML = "";

    requiredCards.forEach(function (item) {
      const card = document.createElement("div");
      card.className = "meta-card priority-meta-card";
      card.setAttribute("data-tab-target", item.tab);

      card.innerHTML = `
        <div class="meta-label">${esc(item.label)}</div>
        <div class="meta-value" id="${esc(item.id)}">0</div>
      `;

      metaBar.appendChild(card);
    });
  }

  async function applyPriorityDashboard() {
    ensurePriorityPanels();
    ensureTabLayout();
    setupMetaFallback();

    await loadPriorityProjects();

    updateMetaCards();
    setupTabButtons();

    const activeButton = $(".tab-button.active");
    const activeTab = activeButton ? activeButton.getAttribute("data-tab") : "";

    if (!activeTab || activeTab === "opportunities" || activeTab === "local") {
      showTab("art");
    } else {
      showTab(activeTab);
    }
  }

  function schedulePatch() {
    let count = 0;

    const timer = window.setInterval(function () {
      updateMetaCards();

      if (state.currentTab === "mural" || state.currentTab === "exhibition" || state.currentTab === "other") {
        const config = getTabConfig(state.currentTab);

        if (config && config.type === "priority") {
          renderPriorityPanel(config.tab, config.category);
        }
      }

      count += 1;

      if (count >= 12) {
        window.clearInterval(timer);
      }
    }, 600);
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyPriorityDashboard();
    schedulePatch();

    document.addEventListener("click", function (event) {
      const button = event.target.closest(".tab-button");

      if (!button) {
        return;
      }

      const tab = button.getAttribute("data-tab");

      if (!tab || tab === "opportunities" || tab === "local") {
        return;
      }

      window.setTimeout(function () {
        showTab(tab);
      }, 80);
    });
  });
})();
