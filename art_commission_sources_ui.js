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
    return document.getElementById("artTab");
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
        margin: 18px 0 22px;
        background: #ffffff;
        border: 1px solid var(--line, #e3ddd3);
        border-radius: 24px;
        overflow: hidden;
        box-shadow: var(--shadow-soft, 0 1px 0 rgba(17, 17, 17, 0.03));
      }

      .nationwide-source-board summary {
        list-style: none;
        cursor: pointer;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 16px;
        align-items: center;
        padding: 22px 24px;
      }

      .nationwide-source-board summary::-webkit-details-marker {
        display: none;
      }

      .nationwide-source-board summary:hover {
        background: #faf8f4;
      }

      .source-summary-title {
        display: grid;
        gap: 7px;
      }

      .source-summary-title em {
        color: #00834f;
        font-style: normal;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 0.02em;
      }

      .source-summary-title strong {
        color: #111111;
        font-size: 23px;
        line-height: 1.2;
        font-weight: 950;
        letter-spacing: -0.05em;
      }

      .source-summary-title span {
        color: #5d5a54;
        font-size: 14px;
        line-height: 1.55;
        font-weight: 800;
      }

      .source-summary-stat {
        min-width: 174px;
        padding: 18px 20px;
        border-radius: 20px;
        background: #edf8f1;
        border: 1px solid #d5ebdc;
        text-align: left;
      }

      .source-summary-stat span {
        display: block;
        margin-bottom: 8px;
        color: #605b55;
        font-size: 12px;
        font-weight: 900;
      }

      .source-summary-stat strong {
        display: block;
        color: #006b3f;
        font-size: 30px;
        line-height: 1;
        font-weight: 950;
        letter-spacing: -0.05em;
      }

      .source-summary-stat small {
        display: block;
        margin-top: 8px;
        color: #6b665f;
        font-size: 12px;
        line-height: 1.35;
        font-weight: 900;
      }

      .nationwide-source-board[open] summary {
        border-bottom: 1px solid var(--line-soft, #eee4d8);
        background: #faf8f4;
      }

      .source-board-body {
        padding: 22px 24px 24px;
      }

      .source-stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 16px;
      }

      .source-stat-card {
        min-height: 86px;
        padding: 15px;
        border: 1px solid var(--line-soft, #eee4d8);
        border-radius: 18px;
        background: #faf8f4;
      }

      .source-stat-card span {
        display: block;
        margin-bottom: 10px;
        color: #777;
        font-size: 12px;
        font-weight: 900;
      }

      .source-stat-card strong {
        display: block;
        color: #111;
        font-size: 25px;
        line-height: 1;
        font-weight: 950;
        letter-spacing: -0.04em;
      }

      .source-filter-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 2px 0 16px;
      }

      .source-filter-button {
        appearance: none;
        min-height: 34px;
        border: 1px solid var(--line, #e3ddd3);
        border-radius: 999px;
        background: #ffffff;
        color: #5f594f;
        padding: 0 12px;
        font-size: 12px;
        font-weight: 900;
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
        border: 1px solid var(--line-soft, #eee4d8);
        border-radius: 18px;
      }

      .source-table {
        width: 100%;
        min-width: 900px;
        border-collapse: collapse;
        background: #ffffff;
      }

      .source-table th,
      .source-table td {
        padding: 13px 14px;
        border-bottom: 1px solid var(--line-soft, #eee4d8);
        text-align: left;
        vertical-align: middle;
        font-size: 13px;
        line-height: 1.45;
      }

      .source-table th {
        color: #777;
        background: #faf8f4;
        font-size: 12px;
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
        min-height: 28px;
        padding: 0 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 950;
        white-space: nowrap;
      }

      .source-priority-pill {
        background: #fff4f2;
        color: var(--red, #ff3b30);
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
        margin: 14px 0 0;
        color: #6f6961;
        font-size: 12px;
        line-height: 1.6;
        font-weight: 800;
      }

      .source-empty {
        padding: 18px;
        border-radius: 16px;
        background: #faf8f4;
        color: #777;
        font-size: 13px;
        font-weight: 900;
      }

      @media (max-width: 860px) {
        .nationwide-source-board summary {
          grid-template-columns: 1fr;
        }

        .source-summary-stat {
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
      <details class="nationwide-source-board" ${wasOpen ? "open" : ""}>
        <summary>
          <span class="source-summary-title">
            <em>ART COMMISSION SOURCE MAP</em>
            <strong>전국 건축물 미술작품 수집 소스</strong>
            <span>
              서울·경기/LH·SH 외에도 인천, 부산, 대구, 울산, 강원, 전북, 전남 등 전국 공고 경로를 등록하고,
              이후 실제 공고 수집 크롤러와 연결합니다.
            </span>
          </span>

          <span class="source-summary-stat">
            <span>등록 소스</span>
            <strong>${formatCount(counts.total)}개</strong>
            <small>1차 우선 ${formatCount(counts.priorityOneCount)}개 · ${formatCount(counts.regionGroupCount)}개 권역</small>
          </span>
        </summary>

        <div class="source-board-body">
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
            현재 단계는 “수집 소스 등록”입니다. 다음 단계에서 1차 우선 소스부터 실제 게시판 URL 구조를 확인하고,
            공고명·기관·지역·공개일·마감일·원문 링크를 건축물 미술작품 탭의 실제 카드 데이터로 연결합니다.
          </p>
        </div>
      </details>
    `;
  }

  function renderBoard() {
    const panel = getArtPanel();

    if (!panel) return;

    const oldBoard = panel.querySelector(".nationwide-source-board");
    const wasOpen = oldBoard ? oldBoard.open : false;

    if (oldBoard) {
      oldBoard.remove();
    }

    const wrapper = document.createElement("div");
    wrapper.innerHTML = createBoardHtml(getEnabledTargets(), wasOpen);

    const board = wrapper.firstElementChild;

    if (!board) return;

    const intro = panel.querySelector(".native-tab-intro-wrap");
    const filters = panel.querySelector(".filters");
    const listHead = panel.querySelector(".list-head");

    if (intro) {
      intro.insertAdjacentElement("afterend", board);
      return;
    }

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

      const board = document.querySelector(".nationwide-source-board");

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
