(() => {
  "use strict";

  const DATA_URL = "data/art_commission_source_targets.json";
  const VALIDATION_URL = "data/art_commission_source_validation.json";

  const state = {
    targets: [],
    validation: {
      channels: [],
      validatedAt: ""
    },
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
    const targets = state.targets.filter(target => target.enabled !== false);
    const targetIds = new Set(targets.map(target => target.id));
    const validationChannels = Array.isArray(state.validation.channels)
      ? state.validation.channels
      : [];

    const withValidation = targets.map(target => ({
      ...target,
      validation: validationChannels.find(channel => channel.id === target.id) || null
    }));

    // 나라장터는 API 기반 import 채널이므로 source target JSON에는 넣지 않는다.
    // 검증 결과에만 존재하는 이 채널도 대시보드의 실제 판단 근거로 표시한다.
    validationChannels
      .filter(channel => channel && channel.id && !targetIds.has(channel.id))
      .forEach(channel => {
        withValidation.push({
          id: channel.id,
          enabled: true,
          priority: 1,
          priorityLabel: "전국 보조 수집",
          region: channel.region || "전국",
          regionGroup: "national",
          regionGroupLabel: "전국",
          sourceName: channel.sourceName,
          sourceType: channel.sourceType,
          sourceUrl: channel.configuredUrl || channel.finalUrl || "",
          crawlMode: channel.crawlMode,
          crawlStrategyLabel: "나라장터 데이터 import",
          recommendedAction: "건축물 미술작품·미술장식품 제작·설치 공고만 선별 반영",
          validation: channel
        });
      });

    return withValidation;
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

      try {
        const validationResponse = await fetch(`${VALIDATION_URL}?sourceUi=${Date.now()}`);
        const validationData = validationResponse.ok ? await validationResponse.json() : {};

        state.validation = {
          channels: Array.isArray(validationData.channels) ? validationData.channels : [],
          validatedAt: validationData.validatedAt || ""
        };
      } catch (validationError) {
        console.warn("[AXOO Art Source UI] validation load failed", validationError);
      }

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

      .source-validation-pill {
        display: inline-flex;
        align-items: center;
        min-height: 26px;
        padding: 0 9px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 950;
        white-space: nowrap;
      }

      .source-validation-pill.ok {
        background: #e7f8ed;
        color: #007640;
      }

      .source-validation-pill.redirect {
        background: #fff4df;
        color: #9a5a00;
      }

      .source-validation-pill.warning {
        background: #fff0ef;
        color: #c4372b;
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

    const connectedCount = enabledTargets.filter(target => target.validation?.reachable).length;
    const issueCount = enabledTargets.filter(target => target.validation && !target.validation.reachable).length;

    return {
      total: enabledTargets.length,
      priorityOneCount,
      priorityTwoCount,
      priorityThreeCount,
      regionGroupCount: regionGroups.length,
      connectedCount,
      issueCount
    };
  }

  function getValidationPresentation(target) {
    const validation = target.validation;

    if (!validation) {
      return { label: "검증 대기", className: "warning", title: "검증 결과 파일을 아직 읽지 못했습니다." };
    }

    if (!validation.reachable) {
      return {
        label: "연결 확인 필요",
        className: "warning",
        title: validation.error || `HTTP ${validation.status || 0}`
      };
    }

    if (validation.redirected) {
      return { label: "연결 확인 · 경로 변경", className: "redirect", title: validation.finalUrl || "" };
    }

    return { label: "연결 확인됨", className: "ok", title: validation.finalUrl || "" };
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
      { label: "전체", value: "all" },
      { label: "1차 우선 반영", value: "priority:1" },
      { label: "2차 확장 반영", value: "priority:2" },
      { label: "3차 후보 검증", value: "priority:3" }
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
              <th>연결 상태</th>
              <th>수집 방식</th>
              <th>다음 액션</th>
            </tr>
          </thead>
          <tbody>
            ${visibleTargets.map(target => {
              const url = normalizeUrl(target.sourceUrl);
              const sourceName = target.sourceName || "출처명 없음";
              const validation = getValidationPresentation(target);

              return `
                <tr>
                  <td>
                    <span class="source-priority-pill">
                      ${esc(target.priorityLabel || `${target.priority || "-"}차`)}
                    </span>
                  </td>
                  <td>
                    <span class="source-validation-pill ${esc(validation.className)}" title="${esc(validation.title)}">
                      ${esc(validation.label)}
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
              지자체·개발공사·아트누리·LH·나라장터를 함께 감시하고, 실제 연결 상태를 기준으로 수집 신뢰도를 판단합니다.
            </span>
          </span>

          <span class="source-inline-stat">
            <span>등록 소스</span>
            <strong>${formatCount(counts.total)}개</strong>
            <small>연결 ${formatCount(counts.connectedCount)}개 · 확인 필요 ${formatCount(counts.issueCount)}개</small>
          </span>
        </summary>

        <div class="source-inline-body">
          <div class="source-stats-grid">
            <div class="source-stat-card">
              <span>전체 활성 소스</span>
              <strong>${formatCount(counts.total)}개</strong>
            </div>

            <div class="source-stat-card">
              <span>연결 확인됨</span>
              <strong>${formatCount(counts.connectedCount)}개</strong>
            </div>

            <div class="source-stat-card">
              <span>연결 확인 필요</span>
              <strong>${formatCount(counts.issueCount)}개</strong>
            </div>

            <div class="source-stat-card">
              <span>전국 권역</span>
              <strong>${formatCount(counts.regionGroupCount)}개</strong>
            </div>
          </div>

          <div class="source-filter-row">
            ${renderFilterButtons(targets)}
          </div>

          ${renderRows(targets)}

          <p class="source-note">
            상태는 매일 수집 전 실제 URL 응답으로 갱신됩니다. “연결 확인됨”은 링크 도달 여부이며,
            실제 공고 여부는 이어지는 후보 수집·제목 필터·원문 분석을 거쳐 판단합니다.
          </p>
        </div>
      </details>
    `;
  }

  function findIntroCard(panel) {
    const candidates = Array.from(panel.children);

    return candidates.find(element => {
      const text = element.textContent || "";

      return (
        text.includes("AXOO PUBLIC ART TRACK") ||
        text.includes("건축물 미술작품") &&
        text.includes("서울·경기·인천")
      );
    });
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
      if (board.open) wasOpen = true;
      board.remove();
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = createBoardHtml(getEnabledTargets(), wasOpen);

    const board = wrapper.firstElementChild;

    if (!board) return;

    const introCard = findIntroCard(panel);
    const criteriaGuide = findCriteriaGuide(panel);

    if (introCard) {
      introCard.insertAdjacentElement("afterend", board);
      return;
    }

    if (criteriaGuide) {
      panel.insertBefore(board, criteriaGuide);
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
