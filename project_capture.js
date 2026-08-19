(function () {
  "use strict";

  const PRIORITY_URL = "data/priority_projects.json";
  const APPLICATION_URL = "data/application_projects.json";

  const GITHUB_EDIT_URL =
    "https://github.com/sksrkass-png/axoo-b2g-dashboard/edit/main/data/application_projects.json";

  let priorityProjects = [];
  let applicationProjects = [];
  let priorityLoaded = false;

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

  function normalizeArray(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.projects)) return data.projects;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeDate(value) {
    const text = String(value || "").trim();

    if (!text || text === "9999-99-99") {
      return "";
    }

    const match = text.match(
      /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/
    );

    if (!match) {
      return "";
    }

    const year = match[1];
    const month = String(match[2]).padStart(2, "0");
    const day = String(match[3]).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function addDays(dateString, amount) {
    const normalized = normalizeDate(dateString);

    if (!normalized) {
      return "";
    }

    const parts = normalized.split("-").map(Number);

    const date = new Date(
      parts[0],
      parts[1] - 1,
      parts[2]
    );

    date.setDate(date.getDate() + amount);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function todayString() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getTitle(project) {
    return (
      project.title ||
      project.bidNtceNm ||
      project.projectName ||
      ""
    );
  }

  function getAgency(project) {
    return (
      project.agency ||
      project.organization ||
      project.ntceInsttNm ||
      project.dminsttNm ||
      project.noticeAgency ||
      project.demandAgency ||
      ""
    );
  }

  function getDeadline(project) {
    return normalizeDate(
      project.deadline ||
      project.endDate ||
      project.bidNtceEndDt ||
      project.deadlineDate ||
      project.closeDate ||
      ""
    );
  }

  function getSourceUrl(project) {
    const candidates = [
      project.sourceUrl,
      project.originalUrl,
      project.url,
      project.ntceSpecDocUrl1,
      project.documentUrl
    ];

    const found = candidates.find(function (value) {
      const text = String(value || "").trim();

      return (
        text.startsWith("https://") ||
        text.startsWith("http://")
      );
    });

    return found ? String(found).trim() : "";
  }

  function getResearchId(project) {
    return String(
      project.id ||
      project.bidNtceNo ||
      project.noticeId ||
      ""
    ).trim();
  }

  function getGrade(project) {
    const grade = String(project.grade || "").toUpperCase();

    if (grade) {
      return grade;
    }

    const score = Number(
      project.axooFitScore ||
      project.score ||
      project.priorityScore ||
      0
    );

    if (score >= 85) return "S";
    if (score >= 70) return "A";
    if (score >= 50) return "B";

    return "C";
  }

  function getPriority(project) {
    const grade = getGrade(project);

    if (grade === "S" || grade === "A") {
      return "HIGH";
    }

    if (grade === "C" || grade === "HOLD") {
      return "LOW";
    }

    return "NORMAL";
  }

  function getNextAction(project) {
    return (
      project.recommendedAction ||
      project.nextAction ||
      "공고문 및 지원 조건 확인"
    );
  }

  function nextProjectId(projects) {
    let max = 0;

    projects.forEach(function (project) {
      const match = String(project.id || "").match(
        /^P26-(\d+)$/
      );

      if (!match) return;

      max = Math.max(max, Number(match[1]));
    });

    return `P26-${String(max + 1).padStart(3, "0")}`;
  }

  async function loadPriorityProjects() {
    if (priorityLoaded) {
      return priorityProjects;
    }

    try {
      const response = await fetch(
        `${PRIORITY_URL}?v=${Date.now()}`
      );

      if (!response.ok) {
        throw new Error(
          `priority data load failed: ${response.status}`
        );
      }

      priorityProjects = normalizeArray(
        await response.json()
      );

      priorityLoaded = true;

      return priorityProjects;
    } catch (error) {
      console.error("[AXOO Capture] priority load error", error);

      priorityProjects = [];
      priorityLoaded = true;

      return [];
    }
  }

  async function loadApplicationProjects() {
    try {
      const response = await fetch(
        `${APPLICATION_URL}?v=${Date.now()}`
      );

      if (!response.ok) {
        throw new Error(
          `application data load failed: ${response.status}`
        );
      }

      applicationProjects = normalizeArray(
        await response.json()
      );

      return applicationProjects;
    } catch (error) {
      console.error(
        "[AXOO Capture] application load error",
        error
      );

      applicationProjects = [];

      return [];
    }
  }

  function findProjectByCard(card) {
    const titleElement =
      card.querySelector(".accordion-body h2") ||
      card.querySelector(".summary-title");

    if (!titleElement) {
      return null;
    }

    const cardTitle = normalizeText(
      titleElement.textContent
    );

    if (!cardTitle) {
      return null;
    }

    return (
      priorityProjects.find(function (project) {
        return (
          normalizeText(getTitle(project)) === cardTitle
        );
      }) ||
      priorityProjects.find(function (project) {
        const projectTitle = normalizeText(
          getTitle(project)
        );

        return (
          projectTitle &&
          (
            cardTitle.includes(projectTitle) ||
            projectTitle.includes(cardTitle)
          )
        );
      }) ||
      null
    );
  }

  function alreadyExists(project, projects) {
    const researchId = getResearchId(project);
    const title = normalizeText(getTitle(project));

    return projects.some(function (item) {
      if (
        researchId &&
        String(item.researchId || "") === researchId
      ) {
        return true;
      }

      return (
        title &&
        normalizeText(item.title) === title
      );
    });
  }

  function createApplicationProject(
    project,
    existingProjects
  ) {
    const deadline = getDeadline(project);

    return {
      id: nextProjectId(existingProjects),
      researchId: getResearchId(project),
      title: getTitle(project) || "프로젝트명 미정",
      institution: getAgency(project) || "기관 미확인",
      status: "REVIEW",
      priority: getPriority(project),
      owner: "",
      deadline: deadline,
      internalDeadline: deadline
        ? addDays(deadline, -1)
        : "",
      progress: 10,
      nextAction: getNextAction(project),
      nextActionDue: todayString(),
      sourceUrl: getSourceUrl(project),
      driveUrl: ""
    };
  }

  async function copyText(text) {
    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    document.execCommand("copy");

    textarea.remove();
  }

  function showToast(message, type) {
    let toast = document.getElementById(
      "axooCaptureToast"
    );

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "axooCaptureToast";
      document.body.appendChild(toast);
    }

    toast.className =
      "axoo-capture-toast " +
      (type === "error"
        ? "axoo-capture-toast-error"
        : "");

    toast.textContent = message;

    requestAnimationFrame(function () {
      toast.classList.add("show");
    });

    clearTimeout(toast._hideTimer);

    toast._hideTimer = setTimeout(function () {
      toast.classList.remove("show");
    }, 3600);
  }

  function injectStyles() {
    if (
      document.getElementById(
        "axooProjectCaptureStyles"
      )
    ) {
      return;
    }

    const style = document.createElement("style");

    style.id = "axooProjectCaptureStyles";

    style.textContent = `
      .axoo-capture-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-top: 12px;
      }

      .axoo-capture-actions .link {
        margin: 0;
      }

      .axoo-capture-button {
        appearance: none;
        border: 1px solid #111;
        background: #111;
        color: #fff;
        border-radius: 8px;
        padding: 9px 12px;
        font: inherit;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        transition:
          transform .16s ease,
          opacity .16s ease;
      }

      .axoo-capture-button:hover {
        transform: translateY(-1px);
      }

      .axoo-capture-button:disabled {
        opacity: .5;
        cursor: wait;
        transform: none;
      }

      .axoo-capture-button.added {
        background: #eaf7e8;
        color: #2f732d;
        border-color: #b8ddb4;
        cursor: default;
      }

      .axoo-capture-toast {
        position: fixed;
        z-index: 99999;
        right: 24px;
        bottom: 24px;
        max-width: min(420px, calc(100vw - 32px));
        padding: 14px 16px;
        border-radius: 12px;
        background: #111;
        color: #fff;
        font-size: 13px;
        font-weight: 700;
        line-height: 1.5;
        box-shadow:
          0 12px 40px rgba(0,0,0,.22);
        opacity: 0;
        transform: translateY(10px);
        pointer-events: none;
        transition:
          opacity .2s ease,
          transform .2s ease;
      }

      .axoo-capture-toast.show {
        opacity: 1;
        transform: translateY(0);
      }

      .axoo-capture-toast-error {
        background: #b52b22;
      }

      @media (max-width: 640px) {
        .axoo-capture-button {
          width: 100%;
        }

        .axoo-capture-actions .link {
          width: 100%;
          text-align: center;
        }

        .axoo-capture-toast {
          left: 16px;
          right: 16px;
          bottom: 16px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  async function handleCapture(button, card) {
    if (button.disabled) {
      return;
    }

    /*
      비동기 처리 후 window.open을 하면
      브라우저 팝업 차단에 걸릴 수 있으므로
      사용자 클릭 순간 빈 창을 먼저 엽니다.
    */
    const githubWindow = window.open(
      "about:blank",
      "_blank"
    );

    button.disabled = true;
    button.textContent = "추가 준비 중...";

    try {
      await loadPriorityProjects();

      const project = findProjectByCard(card);

      if (!project) {
        throw new Error(
          "해당 공고 데이터를 찾지 못했습니다."
        );
      }

      const existingProjects =
        await loadApplicationProjects();

      if (
        alreadyExists(
          project,
          existingProjects
        )
      ) {
        if (githubWindow) {
          githubWindow.close();
        }

        button.disabled = false;
        button.classList.add("added");
        button.textContent = "✓ 이미 지원 관리에 있음";

        showToast(
          "이미 지원 관리에 등록된 프로젝트입니다."
        );

        return;
      }

      const newProject =
        createApplicationProject(
          project,
          existingProjects
        );

      const nextProjects = [
        ...existingProjects,
        newProject
      ];

      const json = JSON.stringify(
        nextProjects,
        null,
        2
      );

      await copyText(json);

      button.disabled = false;
      button.textContent = "✓ JSON 복사 완료";

      showToast(
        "지원 관리 JSON을 복사했습니다. GitHub 편집창에서 Ctrl+A → Ctrl+V → Commit 하세요."
      );

      if (githubWindow) {
        githubWindow.location.href =
          GITHUB_EDIT_URL;
      } else {
        window.open(
          GITHUB_EDIT_URL,
          "_blank"
        );
      }

      setTimeout(function () {
        button.textContent =
          "⭐ 지원 관리에 추가";
      }, 4500);
    } catch (error) {
      console.error(
        "[AXOO Capture] capture error",
        error
      );

      if (githubWindow) {
        githubWindow.close();
      }

      button.disabled = false;
      button.textContent =
        "⭐ 지원 관리에 추가";

      showToast(
        error.message ||
          "지원 관리 추가 준비 중 오류가 발생했습니다.",
        "error"
      );
    }
  }

  function decorateCard(card) {
    if (
      card.dataset.axooCaptureReady === "true"
    ) {
      return;
    }

    const body = card.querySelector(
      ".accordion-body"
    );

    if (!body) {
      return;
    }

    const existingLink =
      body.querySelector("a.link");

    const actions =
      document.createElement("div");

    actions.className =
      "axoo-capture-actions";

    if (existingLink) {
      existingLink.parentNode.insertBefore(
        actions,
        existingLink
      );

      actions.appendChild(existingLink);
    } else {
      body.appendChild(actions);
    }

    const button =
      document.createElement("button");

    button.type = "button";
    button.className =
      "axoo-capture-button";

    button.textContent =
      "⭐ 지원 관리에 추가";

    button.addEventListener(
      "click",
      function (event) {
        event.preventDefault();
        event.stopPropagation();

        handleCapture(
          button,
          card
        );
      }
    );

    actions.appendChild(button);

    card.dataset.axooCaptureReady =
      "true";
  }

  function decorateAllCards() {
    document
      .querySelectorAll(
        ".priority-accordion-card"
      )
      .forEach(decorateCard);
  }

  function watchDashboard() {
    const observer =
      new MutationObserver(function () {
        decorateAllCards();
      });

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

  async function init() {
    injectStyles();

    await Promise.all([
      loadPriorityProjects(),
      loadApplicationProjects()
    ]);

    decorateAllCards();
    watchDashboard();
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }
})();
