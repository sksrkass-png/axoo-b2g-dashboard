(() => {
  "use strict";

  const DATA_URL = "data/art_commission_source_targets.json";

  const state = {
    targets: [],
    loaded: false,
    activeFilter: "all",
    isBound: false
  };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, match => {
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

  function normalizeUrl(value) {
    const url = String(value || "").trim();

    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;

    return "";
  }

  function getArtPanel() {
    return (
      document.getElementById("artTab") ||
      document.querySelector("[data-tab-panel='art']") ||
      document.querySelector(".tab-panel[data-tab='art']")
    );
  }

  function getEnabledTargets() {
    return state.targets.filter(target => target.enabled !== false);
  }

  async function loadTargets() {
    if (state.loaded) {
      return state.targets;
    }

    try {
      const response = await fetch(`${DATA_URL}?sourceUi=${Date.now()}`);

      if (!response.ok) {
        throw new Error(`source target json load failed: ${response.status}`);
      }

      const data = await response.json();

      state.targets = Array.isArray(data) ? data : [];
      state.loaded = true;

      return state.targets;
    } catch (error) {
      console.warn("[AXOO Art Source UI] load failed", error);

      state.targets = [];
      state.loaded = true;

      return state.targets;
    }
  }

  function injectStyle() {
    if (document.getElementById("artCommissionSourceUiStyle")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "artCommissionSourceUiStyle";

    style.textContent = `
      .nationwide-source-board {
        display: none !important;
      }

      .nationwide-source-inline {
        width: 100%;
        flex-basis: 100%;
        grid-column: 1 / -1;
        margin: 14px 0 14px;
        background: #f5fbf7;
        border: 1px solid #cfe8d8;
        border-radius: 20px;
        overflow: hidden;
      }

      .nationwide-source-inline summary {
        list-style: none;
        cursor: pointer;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 14px;
        align-items: center;
        padding: 16px 18px;
      }

      .nationwide-source-inline summary::-webkit-details-marker {
        display: none;
      }

      .nationwide-source-inline summary:hover {
        background: #edf8f1;
      }

      .source-inline-title {
        display: grid;
        gap: 5px;
      }

      .source-inline-title em {
        color: #00834f;
        font-style: normal;
        font-size: 11px;
        font-weight: 950;
        letter-spacing: 0.02em;
      }

      .source-inline-title strong {
        color: #111111;
        font-size: 18px;
        line-height: 1.2;
        font-weight: 950;
        letter-spacing: -0.045em;
      }

      .source-inline-title span {
        color: #5d5a54;
        font-size: 12px;
        line-height: 1.45;
        font-weight: 800;
      }

      .source-inline-stat {
        min-width: 138px;
        padding: 12px 14px;
        border-radius: 16px;
        background: #ffffff;
        border: 1px solid #d7eadf;
        text-align: left;
      }

      .source-inline-stat span {
        display: block;
        margin-bottom: 6px;
        color: #605b55;
        font-size: 11px;
        font-weight: 950;
      }

      .source-inline-stat strong {
        display: block;
        color: #006b3f;
        font-size: 24px;
        line-height: 1;
        font-weight: 950;
        letter-spacing: -0.05em;
      }

      .source-inline-stat small {
        display: block;
        margin-top: 6px;
        color: #6b665f;
        font-size: 11px;
        line-height: 1.35;
        font-weight: 900;
      }

      .nationwide-source-inline[open] summary {
        border-bottom: 1px solid #d7eadf;
        background: #edf8f1;
      }

      .source-inline-body {
        padding: 16px 18px 18px;
      }

      .source-stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin-bottom: 14px;
      }

      .source-stat-card {
        min-height: 72px;
        padding: 13px;
        border: 1px solid #e4eee7;
        border-radius: 16px;
        background: #ffffff;
      }

      .source-stat-card span {
        display: block;
        margin-bottom: 8px;
        color: #777;
        font-size: 11px;
        font-weight: 900;
      }

      .source-stat-card strong {
        display: block;
        color: #111;
        font-size: 22px;
        line-height: 1;
        font-weight: 950;
        letter-spacing: -0.04em;
      }

      .source-filter-row {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin: 0 0 14px;
      }

      .source-filter-button {
        appearance: none;
        min-height: 32px;
        border: 1px solid #d8e5dc;
        border-radius: 999px;
        background: #ffffff;
        color: #5f594f;
        padding: 0 11px;
        font-size: 11px;
        font-weight: 950;
        cursor: pointer;
      }

      .source-filter-button.active {
        background: #111111;
        border-color: #111111;
        color: #ffffff;
      }

      .source-table-wrap {
        width: 100%;
        overflow-x: auto;
        border: 1px solid #e4eee7;
        border-radius: 16px;
        background: #ffffff;
      }

      .source-table {
        width: 100%;
        min-width: 880px;
        border-collapse: collapse;
        background: #ffffff;
      }

      .source-table th,
      .source-table td {
        padding: 12px 13px;
        border-bottom: 1px solid #edf2ee;
        text-align: left;
        vertical-align: middle;
        font-size: 12px;
        line-height: 1.45;
      }

      .source-table th {
        color: #777;
        background: #f8fbf9;
        font-size: 11px;
        font-weight: 950;
        white-space: nowrap;
      }

      .source-table td {
        color: #222;
        font-weight: 800;
      }

      .source-table tr:last-child td {
        border-bottom: 0;
      }

      .source-priority-pill,
      .source-region-pill,
      .source-mode-pill {
        display: inline-flex;
        align-items: center;
        min-height: 26px;
        padding: 0 9px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 950;
        white-space: nowrap;
      }

      .source-priority-pill {
        background: #fff4f2;
        color: #ff3b30;
      }

      .source-region-pill {
        background: #edf8f1;
        color: #006b3f;
      }

      .source-mode-pill {
        background: #f4f1eb;
        color: #5f594f;
      }

      .source-link {
        color: #111111;
        font-weight: 950;
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .source-note {
        margin: 13px 0 0;
        color: #6f6961;
        font-size: 12px;
        line-height: 1.6;
        font-weight: 800;
      }

      .source-empty {
        padding: 16px;
        border-radius: 14px;
        background: #ffffff;
        color: #777;
        font-size: 12px;
        font-weight: 900;
      }

      @media (max-width: 860px) {
        .nationwide-source-inline summary {
          grid-template-columns: 1fr;
        }

        .source-inline-stat {
          min-width: 0;
        }

        .source-stats-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 560px) {
        .source-stats-grid {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function getSummaryCounts(targets) {
    const enabledTargets = targets.filter(target => target.enabled !== false);
    const priorityOneCount = enabledTargets.filter(target => Number(target.priority) === 1).length;
    const priorityTwoCount = enabledTargets.filter(target => Number(target.priority) === 2).length;
    const priorityThreeCount = enabledTargets.filter(target => Number(target.priority) === 3).length;

    const regionGroups = Array.from(
      new Set(
        enabledTargets
          .map(target => target.regionGroupLabel || target.regionGroup || "미분류")
          .filter(Boolean)
      )
    );

    return {
      total: enabledTargets.length,
      priorityOneCount,
      priorityTwoCount,
      priorityThreeCount,
      regionGroupCount: regionGroups.length
    };
  }

  function getFilterItems(targets) {
    const enabledTargets = targets.filter(target => target.enabled !== false);

    const regionGroups = Array.from(
      new Set(
        enabledTargets
          .map(target => target.regionGroupLabel || target.regionGroup || "미분류")
          .filter(Boolean)
      )
    );

    const baseFilters = [
      {
        label: "전체",
        value: "all"
      },
      {
        label: "1차 우선 반영",
        value: "priority:1"
      },
      {
        label: "2차 확장 반영",
        value: "priority:2"
      },
      {
        label: "3차 후보 검증",
        value: "priority:3"
      }
    ];

    const regionFilters = regionGroups.map(regionGroup => ({
      label: regionGroup,
      value: `regionGroup:${regionGroup}`
    }));

    return [...baseFilters, ...regionFilters];
  }

  function isTargetVisible(target) {
    if (target.enabled === false) return false;
    if (state.activeFilter === "all") return true;

    if (state.activeFilter.startsWith("priority:")) {
      const priority = state.activeFilter.replace("priority:", "");
      return String(target.priority) === priority;
    }

    if (state.activeFilter.startsWith("regionGroup:")) {
      const regionGroup = state.activeFilter.replace("regionGroup:", "");
      return String(target.regionGroupLabel || target.regionGroup || "미분류") === regionGroup;
    }

    return true;
  }

  function renderFilterButtons(targets) {
    return getFilterItems(targets)
      .map(filter => {
        const activeClass = state.activeFilter === filter.value ? "active" : "";

        return `
          <button
            type="button"
            class="source-filter-button ${activeClass}"
            data-art-source-filter="${esc(filter.value)}"
          >
            ${esc(filter.label)}
          </button>
        `;
      })
      .join("");
  }

  function renderRows(targets) {
    const visibleTargets = targets.filter(isTargetVisible);

    if (!visibleTargets.length) {
      return `
        <div class="source-empty">
          현재 필터에 맞는 전국 수집 소스가 없습니다.
        </div>
      `;
    }

    return `
      <div class="source-table-wrap">
        <table class="source-table">
          <thead>
            <tr>
              <th>우선순위</th>
              <th>권역</th>
              <th>지역</th>
              <th>출처</th>
              <th>수집 방식</th>
              <th>다음 액션</th>
            </tr>
          </thead>
          <tbody>
            ${visibleTargets.map(target => {
              const url = normalizeUrl(target.sourceUrl);
              const sourceName = target.sourceName || "출처명 없음";

              return `
                <tr>
                  <td>
                    <span class="source-priority-pill">
                      ${esc(target.priorityLabel || `${target.priority || "-"}차`)}
                    </span>
                  </td>
                  <td>
                    <span class="source-region-pill">
                      ${esc(target.regionGroupLabel || target.regionGroup || "미분류")}
                    </span>
                  </td>
                  <td>${esc(target.region || "-")}</td>
                  <td>
                    ${
                      url
                        ? `<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(sourceName)}</a>`
                        : esc(sourceName)
                    }
                  </td>
                  <td>
                    <span class="source-mode-pill">
                      ${esc(target.crawlStrategyLabel || target.crawlMode || "확인 필요")}
                    </span>
                  </td>
                  <td>${esc(target.recommendedAction || "수집 가능 여부 확인")}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function createBoardHtml(targets, wasOpen) {
    const counts = getSummaryCounts(targets);

    return `
      <details class="nationwide-source-inline" ${wasOpen ? "open" : ""}>
        <summary>
          <span class="source-inline-title">
            <em>ART COMMISSION SOURCE MAP</em>
            <strong>전국 수집 소스</strong>
            <span>
              서울·경기/LH·SH 외 인천, 부산, 대구, 울산, 강원, 전북, 전남 등 전국 공고 경로를 함께 관리합니다.
            </span>
          </span>

          <span class="source-inline-stat">
            <span>등록 소스</span>
            <strong>${formatCount(counts.total)}개</strong>
            <small>1차 ${formatCount(counts.priorityOneCount)}개 · ${formatCount(counts.regionGroupCount)}개 권역</small>
          </span>
        </summary>

        <div class="source-inline-body">
          <div class="source-stats-grid">
            <div class="source-stat-card">
              <span>전체 활성 소스</span>
              <strong>${formatCount(counts.total)}개</strong>
            </div>

            <div class="source-stat-card">
              <span>1차 우선 반영</span>
              <strong>${formatCount(counts.priorityOneCount)}개</strong>
            </div>

            <div class="source-stat-card">
              <span>2차 확장 반영</span>
              <strong>${formatCount(counts.priorityTwoCount)}개</strong>
            </div>

            <div class="source-stat-card">
              <span>3차 후보 검증</span>
              <strong>${formatCount(counts.priorityThreeCount)}개</strong>
            </div>
          </div>

          <div class="source-filter-row">
            ${renderFilterButtons(targets)}
          </div>

          ${renderRows(targets)}

          <p class="source-note">
            현재 단계는 “수집 소스 등록 및 자동 후보 수집”입니다. 이후 1차 우선 소스부터 검색 URL 구조를 고도화해
            공고명·기관·지역·공개일·마감일·원문 링크 정확도를 개선합니다.
          </p>
        </div>
      </details>
    `;
  }

  function findCriteriaGuide(panel) {
    const candidates = Array.from(panel.children);

    return candidates.find(element => {
      const text = element.textContent || "";

      return (
        text.includes("검토 기준 안내") ||
        text.includes("검토기준 안내") ||
        text.includes("건축물 미술작품 공모 공고문과 첨부파일") ||
        text.includes("지역, 일정, 설치 조건") ||
        text.includes("제출 방식, 작품 규모")
      );
    });
  }

  function renderBoard() {
    const panel = getArtPanel();

    if (!panel) return;

    const oldStandaloneBoards = panel.querySelectorAll(".nationwide-source-board");
    const oldInlineBoards = panel.querySelectorAll(".nationwide-source-inline");

    oldStandaloneBoards.forEach(board => {
      board.remove();
    });

    let wasOpen = false;

    oldInlineBoards.forEach(board => {
      if (board.open) {
        wasOpen = true;
      }

      board.remove();
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = createBoardHtml(getEnabledTargets(), wasOpen);

    const board = wrapper.firstElementChild;

    if (!board) return;

    const criteriaGuide = findCriteriaGuide(panel);

    if (criteriaGuide) {
      panel.insertBefore(board, criteriaGuide);
      return;
    }

    const intro = panel.querySelector(".native-tab-intro-wrap");

    if (intro) {
      intro.insertAdjacentElement("afterend", board);
      return;
    }

    const filters = panel.querySelector(".filters");
    const listHead = panel.querySelector(".list-head");

    if (filters) {
      panel.insertBefore(board, filters);
      return;
    }

    if (listHead) {
      panel.insertBefore(board, listHead);
      return;
    }

    panel.insertBefore(board, panel.firstChild);
  }

  async function applySourceBoard() {
    injectStyle();
    await loadTargets();
    renderBoard();
  }

  function bindEvents() {
    if (state.isBound) return;

    state.isBound = true;

    document.addEventListener("click", event => {
      const button = event.target.closest("[data-art-source-filter]");

      if (!button) return;

      event.preventDefault();

      state.activeFilter = button.getAttribute("data-art-source-filter") || "all";
      renderBoard();

      const board = document.querySelector(".nationwide-source-inline");

      if (board) {
        board.open = true;
      }
    });

    document.addEventListener("click", event => {
      const tabButton = event.target.closest(".tab-button[data-tab='art']");

      if (!tabButton) return;

      setTimeout(applySourceBoard, 220);
    });
  }

  function init() {
    bindEvents();
    applySourceBoard();

    setTimeout(applySourceBoard, 500);
    setTimeout(applySourceBoard, 1400);
  }

  window.addEventListener("axoo:rendered", () => {
    setTimeout(applySourceBoard, 160);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
