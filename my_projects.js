(function () {
  "use strict";

  const DATA_URL = "data/application_projects.json";

  const STATUS = {
    REVIEW: {
      label: "검토중",
      className: "status-review"
    },
    WORKING: {
      label: "작성중",
      className: "status-working"
    },
    REVIEW_REQUESTED: {
      label: "검토요청",
      className: "status-request"
    },
    READY: {
      label: "제출준비",
      className: "status-ready"
    },
    SUBMITTED: {
      label: "제출완료",
      className: "status-submitted"
    }
  };

  let projects = [];
  let currentFilter = "all";

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

  function normalizeProjects(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.projects)) return data.projects;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }

  function parseDate(value) {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  function formatDate(value) {
    const date = parseDate(value);

    if (!date) {
      return "미정";
    }

    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function getDDay(value) {
    const deadline = parseDate(value);

    if (!deadline) {
      return {
        text: "미정",
        className: "dday-normal",
        days: null
      };
    }

    const now = new Date();

    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const target = new Date(
      deadline.getFullYear(),
      deadline.getMonth(),
      deadline.getDate()
    );

    const diff = Math.ceil(
      (target.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
    );

    if (diff < 0) {
      return {
        text: "마감",
        className: "dday-closed",
        days: diff
      };
    }

    if (diff === 0) {
      return {
        text: "D-DAY",
        className: "dday-danger",
        days: 0
      };
    }

    if (diff <= 7) {
      return {
        text: `D-${diff}`,
        className: "dday-danger",
        days: diff
      };
    }

    return {
      text: `D-${diff}`,
      className: "dday-normal",
      days: diff
    };
  }

  function getStatus(project) {
    return STATUS[project.status] || {
      label: project.status || "검토중",
      className: "status-review"
    };
  }

  function getProgress(project) {
    const value = Number(project.progress || 0);
    return Math.max(0, Math.min(100, value));
  }

  function injectStyles() {
    if (document.getElementById("axooMyProjectsStyles")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "axooMyProjectsStyles";

    style.textContent = `
      .my-projects-nav-button {
        appearance: none;
        border: 1px solid rgba(255,255,255,.14);
        background: #111;
        color: #fff;
        border-radius: 999px;
        padding: 11px 18px;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        transition: .18s ease;
      }

      .my-projects-nav-button:hover {
        transform: translateY(-1px);
        border-color: rgba(255,255,255,.32);
      }

      .my-projects-nav-button.active {
        background: #111;
        color: #fff;
        box-shadow: 0 0 0 2px #7cff57 inset;
      }

      .my-projects-panel {
        display: none;
        padding: 24px 0 80px;
      }

      .my-projects-panel.active {
        display: block;
      }

      .my-projects-hero {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 28px;
      }

      .my-projects-eyebrow {
        margin: 0 0 8px;
        color: #70d64b;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .08em;
      }

      .my-projects-hero h2 {
        margin: 0;
        font-size: clamp(28px, 4vw, 44px);
        line-height: 1.05;
      }

      .my-projects-hero p {
        margin: 10px 0 0;
        color: #777;
        line-height: 1.55;
      }

      .my-projects-refresh {
        border: 1px solid #ddd;
        background: #fff;
        border-radius: 10px;
        padding: 10px 14px;
        cursor: pointer;
        font-weight: 700;
      }

      .my-projects-stats {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 20px;
      }

      .my-projects-stat {
        padding: 18px;
        border: 1px solid #e5e5e5;
        border-radius: 14px;
        background: #fff;
      }

      .my-projects-stat span {
        display: block;
        color: #888;
        font-size: 12px;
        font-weight: 700;
        margin-bottom: 7px;
      }

      .my-projects-stat strong {
        font-size: 28px;
        line-height: 1;
      }

      .my-projects-filterbar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 0 0 16px;
      }

      .my-projects-filter {
        border: 1px solid #ddd;
        background: #fff;
        color: #555;
        border-radius: 999px;
        padding: 8px 13px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
      }

      .my-projects-filter.active {
        background: #111;
        color: #fff;
        border-color: #111;
      }

      .my-projects-table {
        border-top: 1px solid #ddd;
      }

      .my-projects-head,
      .my-project-row-main {
        display: grid;
        grid-template-columns:
          110px
          minmax(240px, 2.2fr)
          minmax(130px, 1fr)
          90px
          90px
          minmax(180px, 1.4fr)
          100px;
        gap: 16px;
        align-items: center;
      }

      .my-projects-head {
        padding: 12px 16px;
        color: #888;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .03em;
        border-bottom: 1px solid #ddd;
      }

      .my-project-row {
        border-bottom: 1px solid #e5e5e5;
      }

      .my-project-row-main {
        width: 100%;
        padding: 18px 16px;
        border: 0;
        background: transparent;
        text-align: left;
        cursor: pointer;
        color: inherit;
        font: inherit;
      }

      .my-project-row-main:hover {
        background: rgba(0,0,0,.025);
      }

      .my-project-title {
        min-width: 0;
      }

      .my-project-title strong {
        display: block;
        font-size: 15px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .my-project-title small {
        display: block;
        margin-top: 5px;
        color: #999;
        font-size: 11px;
      }

      .my-project-muted {
        color: #666;
        font-size: 13px;
      }

      .my-status {
        display: inline-flex;
        justify-content: center;
        width: fit-content;
        padding: 6px 9px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 800;
      }

      .status-review {
        background: #eee;
        color: #555;
      }

      .status-working {
        background: #e8f2ff;
        color: #1767c0;
      }

      .status-request {
        background: #fff0db;
        color: #ad5d00;
      }

      .status-ready {
        background: #f0e8ff;
        color: #7044b7;
      }

      .status-submitted {
        background: #e7f7e6;
        color: #287029;
      }

      .my-project-dday {
        font-weight: 800;
        font-size: 13px;
      }

      .dday-danger {
        color: #e34234;
      }

      .dday-normal {
        color: #222;
      }

      .dday-closed {
        color: #aaa;
      }

      .my-progress {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .my-progress-track {
        flex: 1;
        height: 6px;
        border-radius: 999px;
        background: #e8e8e8;
        overflow: hidden;
      }

      .my-progress-track i {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: #111;
      }

      .my-progress strong {
        min-width: 34px;
        font-size: 11px;
      }

      .my-project-detail {
        display: none;
        padding: 0 16px 22px;
      }

      .my-project-row.open .my-project-detail {
        display: block;
      }

      .my-project-detail-inner {
        border-radius: 14px;
        background: #f6f6f3;
        padding: 22px;
      }

      .my-project-detail-top {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }

      .my-project-detail-box {
        padding: 14px;
        background: #fff;
        border-radius: 10px;
      }

      .my-project-detail-box span {
        display: block;
        color: #999;
        font-size: 11px;
        font-weight: 700;
        margin-bottom: 5px;
      }

      .my-project-detail-box strong {
        font-size: 13px;
      }

      .my-next-action {
        margin-top: 14px;
        padding: 18px;
        background: #111;
        color: #fff;
        border-radius: 12px;
      }

      .my-next-action span {
        display: block;
        color: #9fa49d;
        font-size: 11px;
        font-weight: 800;
        margin-bottom: 7px;
        letter-spacing: .05em;
      }

      .my-next-action strong {
        font-size: 18px;
      }

      .my-next-action small {
        display: block;
        margin-top: 6px;
        color: #c7c7c7;
      }

      .my-project-links {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 14px;
      }

      .my-project-link {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 9px 12px;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 9px;
        color: #111;
        text-decoration: none;
        font-size: 12px;
        font-weight: 800;
      }

      .my-project-link:hover {
        border-color: #999;
      }

      .my-projects-empty {
        text-align: center;
        padding: 70px 20px;
        border: 1px dashed #ccc;
        border-radius: 16px;
        color: #777;
      }

      .my-projects-empty strong {
        display: block;
        color: #222;
        font-size: 20px;
        margin-bottom: 8px;
      }

      @media (max-width: 980px) {
        .my-projects-stats {
          grid-template-columns: repeat(2, 1fr);
        }

        .my-projects-head {
          display: none;
        }

        .my-project-row-main {
          grid-template-columns: 90px 1fr 70px;
          gap: 10px;
        }

        .my-project-row-main > *:nth-child(3),
        .my-project-row-main > *:nth-child(5),
        .my-project-row-main > *:nth-child(6) {
          display: none;
        }

        .my-project-detail-top {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 600px) {
        .my-projects-hero {
          align-items: flex-start;
          flex-direction: column;
        }

        .my-projects-stats {
          grid-template-columns: repeat(2, 1fr);
        }

        .my-project-row-main {
          padding: 15px 4px;
        }

        .my-project-detail {
          padding-left: 0;
          padding-right: 0;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createNavigation() {
    const tabs = document.querySelector(".tabs");

    if (!tabs || document.getElementById("myProjectsToggle")) {
      return;
    }

    const button = document.createElement("button");

    button.id = "myProjectsToggle";
    button.className = "my-projects-nav-button";
    button.type = "button";
    button.textContent = "⭐ 지원 관리";

    tabs.appendChild(button);

    button.addEventListener("click", function () {
      showMyProjects();
    });

    document.querySelectorAll(".tab-button").forEach(function (tabButton) {
      tabButton.addEventListener("click", function () {
        hideMyProjects();
      });
    });
  }

  function createPanel() {
    if (document.getElementById("myProjectsPanel")) {
      return;
    }

    const main = document.querySelector("main.container");

    if (!main) {
      return;
    }

    const panel = document.createElement("section");

    panel.id = "myProjectsPanel";
    panel.className = "my-projects-panel";

    main.appendChild(panel);
  }

  async function loadProjects() {
    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`);

      if (!response.ok) {
        throw new Error(
          `application_projects.json load failed: ${response.status}`
        );
      }

      const data = await response.json();

      projects = normalizeProjects(data);

      render();
    } catch (error) {
      console.error("[AXOO MY PROJECTS]", error);

      const panel = document.getElementById("myProjectsPanel");

      if (panel) {
        panel.innerHTML = `
          <div class="my-projects-empty">
            <strong>지원 프로젝트 데이터를 불러오지 못했습니다.</strong>
            <span>data/application_projects.json 파일을 확인해 주세요.</span>
          </div>
        `;
      }
    }
  }

  function getCounts() {
    const active = projects.filter(function (project) {
      return project.status !== "SUBMITTED";
    }).length;

    const review = projects.filter(function (project) {
      return project.status === "REVIEW_REQUESTED";
    }).length;

    const submitted = projects.filter(function (project) {
      return project.status === "SUBMITTED";
    }).length;

    const due7 = projects.filter(function (project) {
      if (project.status === "SUBMITTED") return false;

      const dday = getDDay(project.deadline);

      return (
        dday.days !== null &&
        dday.days >= 0 &&
        dday.days <= 7
      );
    }).length;

    return {
      active,
      review,
      submitted,
      due7
    };
  }

  function getFilteredProjects() {
    if (currentFilter === "all") {
      return projects;
    }

    if (currentFilter === "active") {
      return projects.filter(function (project) {
        return project.status !== "SUBMITTED";
      });
    }

    if (currentFilter === "review") {
      return projects.filter(function (project) {
        return project.status === "REVIEW_REQUESTED";
      });
    }

    if (currentFilter === "due7") {
      return projects.filter(function (project) {
        const dday = getDDay(project.deadline);

        return (
          project.status !== "SUBMITTED" &&
          dday.days !== null &&
          dday.days >= 0 &&
          dday.days <= 7
        );
      });
    }

    if (currentFilter === "submitted") {
      return projects.filter(function (project) {
        return project.status === "SUBMITTED";
      });
    }

    return projects;
  }

  function renderProject(project) {
    const status = getStatus(project);
    const dday = getDDay(project.deadline);
    const progress = getProgress(project);

    const sourceUrl =
      typeof project.sourceUrl === "string"
        ? project.sourceUrl.trim()
        : "";

    const driveUrl =
      typeof project.driveUrl === "string"
        ? project.driveUrl.trim()
        : "";

    return `
      <article class="my-project-row">
        <button class="my-project-row-main" type="button">
          <span>
            <span class="my-status ${esc(status.className)}">
              ${esc(status.label)}
            </span>
          </span>

          <span class="my-project-title">
            <strong>${esc(project.title || "프로젝트명 미정")}</strong>
            <small>${esc(project.priority || "NORMAL")}</small>
          </span>

          <span class="my-project-muted">
            ${esc(project.institution || "기관 미정")}
          </span>

          <span class="my-project-dday ${esc(dday.className)}">
            ${esc(dday.text)}
          </span>

          <span class="my-project-muted">
            ${esc(project.owner || "-")}
          </span>

          <span class="my-project-muted">
            ${esc(project.nextAction || "다음 할 일 미정")}
          </span>

          <span class="my-progress">
            <span class="my-progress-track">
              <i style="width:${progress}%"></i>
            </span>
            <strong>${progress}%</strong>
          </span>
        </button>

        <div class="my-project-detail">
          <div class="my-project-detail-inner">

            <div class="my-project-detail-top">
              <div class="my-project-detail-box">
                <span>공식 마감</span>
                <strong>${esc(project.deadline || "미정")}</strong>
              </div>

              <div class="my-project-detail-box">
                <span>내부 마감</span>
                <strong>${esc(project.internalDeadline || "미정")}</strong>
              </div>

              <div class="my-project-detail-box">
                <span>담당</span>
                <strong>${esc(project.owner || "-")}</strong>
              </div>

              <div class="my-project-detail-box">
                <span>프로젝트 ID</span>
                <strong>${esc(project.id || "-")}</strong>
              </div>
            </div>

            <div class="my-next-action">
              <span>NEXT ACTION</span>
              <strong>
                ${esc(project.nextAction || "다음 할 일 미정")}
              </strong>
              <small>
                DUE ${esc(formatDate(project.nextActionDue))}
              </small>
            </div>

            ${
              sourceUrl || driveUrl
                ? `
                  <div class="my-project-links">
                    ${
                      sourceUrl
                        ? `
                          <a
                            class="my-project-link"
                            href="${esc(sourceUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            🔗 공고 원문
                          </a>
                        `
                        : ""
                    }

                    ${
                      driveUrl
                        ? `
                          <a
                            class="my-project-link"
                            href="${esc(driveUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            📁 프로젝트 폴더
                          </a>
                        `
                        : ""
                    }
                  </div>
                `
                : ""
            }

          </div>
        </div>
      </article>
    `;
  }

  function render() {
    const panel = document.getElementById("myProjectsPanel");

    if (!panel) {
      return;
    }

    const counts = getCounts();
    const filteredProjects = getFilteredProjects();

    panel.innerHTML = `
      <div class="my-projects-hero">
        <div>
          <p class="my-projects-eyebrow">AXOO B2G PROJECT CONTROL</p>
          <h2>지원 프로젝트</h2>
          <p>
            지원하기로 결정한 공공 프로젝트의 상태와
            다음 행동만 간단하게 관리합니다.
          </p>
        </div>

        <button
          id="myProjectsRefresh"
          class="my-projects-refresh"
          type="button"
        >
          ↻ 새로고침
        </button>
      </div>

      <section class="my-projects-stats">
        <div class="my-projects-stat">
          <span>ACTIVE</span>
          <strong>${counts.active}</strong>
        </div>

        <div class="my-projects-stat">
          <span>D-7</span>
          <strong>${counts.due7}</strong>
        </div>

        <div class="my-projects-stat">
          <span>검토 요청</span>
          <strong>${counts.review}</strong>
        </div>

        <div class="my-projects-stat">
          <span>제출 완료</span>
          <strong>${counts.submitted}</strong>
        </div>
      </section>

      <div class="my-projects-filterbar">
        <button
          class="my-projects-filter ${currentFilter === "all" ? "active" : ""}"
          data-my-filter="all"
        >
          전체
        </button>

        <button
          class="my-projects-filter ${currentFilter === "active" ? "active" : ""}"
          data-my-filter="active"
        >
          진행 중
        </button>

        <button
          class="my-projects-filter ${currentFilter === "review" ? "active" : ""}"
          data-my-filter="review"
        >
          검토 필요
        </button>

        <button
          class="my-projects-filter ${currentFilter === "due7" ? "active" : ""}"
          data-my-filter="due7"
        >
          D-7
        </button>

        <button
          class="my-projects-filter ${currentFilter === "submitted" ? "active" : ""}"
          data-my-filter="submitted"
        >
          제출 완료
        </button>
      </div>

      ${
        filteredProjects.length
          ? `
            <section class="my-projects-table">
              <div class="my-projects-head">
                <span>STATUS</span>
                <span>PROJECT</span>
                <span>기관</span>
                <span>마감</span>
                <span>담당</span>
                <span>NEXT ACTION</span>
                <span>진행</span>
              </div>

              ${filteredProjects.map(renderProject).join("")}
            </section>
          `
          : `
            <div class="my-projects-empty">
              <strong>아직 등록된 지원 프로젝트가 없습니다.</strong>
              <span>
                지원하기로 결정한 공모가 생기면 이곳에 표시됩니다.
              </span>
            </div>
          `
      }
    `;

    panel.querySelectorAll(".my-project-row-main").forEach(function (row) {
      row.addEventListener("click", function () {
        row.closest(".my-project-row").classList.toggle("open");
      });
    });

    panel.querySelectorAll("[data-my-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        currentFilter = button.getAttribute("data-my-filter") || "all";
        render();
      });
    });

    const refresh = document.getElementById("myProjectsRefresh");

    if (refresh) {
      refresh.addEventListener("click", loadProjects);
    }
  }

  function showMyProjects() {
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
      panel.classList.remove("active");
      panel.style.display = "none";
    });

    const summary = document.querySelector(".summary-panel");

    if (summary) {
      summary.style.display = "none";
    }

    document.querySelectorAll(".tab-button").forEach(function (button) {
      button.classList.remove("active");
    });

    const panel = document.getElementById("myProjectsPanel");
    const toggle = document.getElementById("myProjectsToggle");

    if (panel) {
      panel.classList.add("active");
    }

    if (toggle) {
      toggle.classList.add("active");
    }

    loadProjects();
  }

  function hideMyProjects() {
    const panel = document.getElementById("myProjectsPanel");
    const toggle = document.getElementById("myProjectsToggle");
    const summary = document.querySelector(".summary-panel");

    if (panel) {
      panel.classList.remove("active");
    }

    if (toggle) {
      toggle.classList.remove("active");
    }

    if (summary) {
      summary.style.display = "";
    }
  }

  function init() {
    injectStyles();
    createNavigation();
    createPanel();
    loadProjects();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
