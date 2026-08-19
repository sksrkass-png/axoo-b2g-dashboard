(function () {
  "use strict";

  const PRIORITY_URL = "data/priority_projects.json";
  const ART_URL = "data/art_commissions.json";
  const APPLICATION_URL = "data/application_projects.json";

  const GITHUB_EDIT_URL =
    "https://github.com/sksrkass-png/axoo-b2g-dashboard/edit/main/data/application_projects.json";

  let priorityProjects = [];
  let artProjects = [];
  let applicationProjects = [];

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

    return [
      match[1],
      String(match[2]).padStart(2, "0"),
      String(match[3]).padStart(2, "0")
    ].join("-");
  }

  function addDays(value, amount) {
    const dateText = normalizeDate(value);

    if (!dateText) {
      return "";
    }

    const [year, month, day] =
      dateText.split("-").map(Number);

    const date = new Date(
      year,
      month - 1,
      day
    );

    date.setDate(
      date.getDate() + amount
    );

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function todayString() {
    const now = new Date();

    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
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
      project.bidClseDt ||
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
      const url = String(value || "").trim();

      return (
        url.startsWith("https://") ||
        url.startsWith("http://")
      );
    });

    return found
      ? String(found).trim()
      : "";
  }

  function getGrade(project) {
    const explicit =
      String(project.grade || "")
        .toUpperCase()
        .trim();

    if (explicit) {
      return explicit;
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

    return "";
  }

  function getPriority(project, type) {
    /*
      건축물 미술작품은 등급 체계와 별개이므로
      기본 NORMAL로 등록.
    */
    if (type === "art") {
      return "NORMAL";
    }

    const grade = getGrade(project);

    if (
      grade === "S" ||
      grade === "A"
    ) {
      return "HIGH";
    }

    if (
      grade === "C" ||
      grade === "HOLD"
    ) {
      return "LOW";
    }

    return "NORMAL";
  }

  function getResearchId(project, type) {
    const existing =
      project.id ||
      project.bidNtceNo ||
      project.noticeNo ||
      project.noticeId ||
      project.sourceId;

    if (existing) {
      return String(existing);
    }

    /*
      건축물 미술작품 데이터는 별도 ID가
      없는 경우도 있으므로 제목+마감으로 생성.
    */
    return [
      type,
      normalizeText(getTitle(project)),
      getDeadline(project)
    ].join("::");
  }

  function getNextAction(project, type) {
    if (type === "art") {
      return (
        project.recommendedAction ||
        "공고문 확인 후 접수 기간, 설치 조건, 작품 규모, 제출 서류 검토"
      );
    }

    return (
      project.recommendedAction ||
      project.nextAction ||
      "공고문 및 지원 조건 확인"
    );
  }

  function nextProjectId(projects) {
    let max = 0;

    projects.forEach(function (project) {
      const match =
        String(project.id || "")
          .match(/^P26-(\d+)$/);

      if (!match) return;

      max = Math.max(
        max,
        Number(match[1])
      );
    });

    return (
      "P26-" +
      String(max + 1).padStart(3, "0")
    );
  }

  async function loadJson(url) {
    try {
      const response = await fetch(
        `${url}?v=${Date.now()}`
      );

      if (!response.ok) {
        throw new Error(
          `${url} load failed: ${response.status}`
        );
      }

      return normalizeArray(
        await response.json()
      );
    } catch (error) {
      console.error(
        "[AXOO Capture]",
        error
      );

      return [];
    }
  }

  async function loadAllData() {
    const [
      priority,
      art,
      applications
    ] = await Promise.all([
      loadJson(PRIORITY_URL),
      loadJson(ART_URL),
      loadJson(APPLICATION_URL)
    ]);

    priorityProjects = priority;
    artProjects = art;
    applicationProjects = applications;
  }

  function getCardTitle(card) {
    const element =
      card.querySelector(".accordion-body h2") ||
      card.querySelector("h2") ||
      card.querySelector(".summary-title");

    return element
      ? normalizeText(element.textContent)
      : "";
  }

  function findByTitle(list, title) {
    if (!title) {
      return null;
    }

    const exact =
      list.find(function (project) {
        return (
          normalizeText(getTitle(project)) ===
          title
        );
      });

    if (exact) {
      return exact;
    }

    return (
      list.find(function (project) {
        const projectTitle =
          normalizeText(
            getTitle(project)
          );

        return (
          projectTitle &&
          (
            title.includes(projectTitle) ||
            projectTitle.includes(title)
          )
        );
      }) ||
      null
    );
  }

  function findProjectByCard(card) {
    const title =
      getCardTitle(card);

    /*
      건축물 미술작품 탭
    */
    if (card.closest("#artCards")) {
      const project =
        findByTitle(
          artProjects,
          title
        );

      return project
        ? {
            project,
            type: "art"
          }
        : null;
    }

    /*
      벽화·조형물 / 전시 / 지원사업 /
      기타 AXOO 핏
    */
    const priority =
      findByTitle(
        priorityProjects,
        title
      );

    return priority
      ? {
          project: priority,
          type: "priority"
        }
      : null;
  }

  function alreadyExists(
    project,
    type,
    projects
  ) {
    const researchId =
      getResearchId(
        project,
        type
      );

    const title =
      normalizeText(
        getTitle(project)
      );

    const deadline =
      getDeadline(project);

    return projects.some(
      function (item) {
        if (
          researchId &&
          String(
            item.researchId || ""
          ) === researchId
        ) {
          return true;
        }

        return (
          normalizeText(item.title) ===
            title &&
          normalizeDate(item.deadline) ===
            deadline
        );
      }
    );
  }

  function createApplicationProject(
    project,
    type,
    existingProjects
  ) {
    const deadline =
      getDeadline(project);

    return {
      id: nextProjectId(
        existingProjects
      ),

      researchId:
        getResearchId(
          project,
          type
        ),

      title:
        getTitle(project) ||
        "프로젝트명 미정",

      institution:
        getAgency(project) ||
        "기관 미확인",

      status: "REVIEW",

      priority:
        getPriority(
          project,
          type
        ),

      owner: "",

      deadline,

      internalDeadline:
        deadline
          ? addDays(
              deadline,
              -1
            )
          : "",

      progress: 10,

      nextAction:
        getNextAction(
          project,
          type
        ),

      nextActionDue:
        todayString(),

      sourceUrl:
        getSourceUrl(project),

      driveUrl: ""
    };
  }

  async function copyText(text) {
    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(
        text
      );

      return;
    }

    const textarea =
      document.createElement(
        "textarea"
      );

    textarea.value = text;

    textarea.style.position =
      "fixed";

    textarea.style.left =
      "-9999px";

    document.body.appendChild(
      textarea
    );

    textarea.select();

    document.execCommand(
      "copy"
    );

    textarea.remove();
  }

  function showToast(
    message,
    type = "normal"
  ) {
    let toast =
      document.getElementById(
        "axooCaptureToast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "axooCaptureToast";

      document.body.appendChild(
        toast
      );
    }

    toast.className =
      "axoo-capture-toast";

    if (type === "error") {
      toast.classList.add(
        "error"
      );
    }

    toast.textContent =
      message;

    requestAnimationFrame(
      function () {
        toast.classList.add(
          "show"
        );
      }
    );

    clearTimeout(
      toast._timer
    );

    toast._timer =
      setTimeout(function () {
        toast.classList.remove(
          "show"
        );
      }, 4000);
  }

  async function handleCapture(
    button,
    card
  ) {
    if (button.disabled) {
      return;
    }

    /*
      사용자 클릭 순간 창을 먼저 열어
      팝업 차단을 줄입니다.
    */
    const githubWindow =
      window.open(
        "about:blank",
        "_blank"
      );

    button.disabled = true;

    button.textContent =
      "추가 준비 중...";

    try {
      /*
        카드가 새로 렌더링된 직후일 수도
        있으므로 최신 데이터를 다시 확보.
      */
      await loadAllData();

      const capture =
        findProjectByCard(card);

      if (!capture) {
        throw new Error(
          "해당 공고 데이터를 찾지 못했습니다."
        );
      }

      const {
        project,
        type
      } = capture;

      if (
        alreadyExists(
          project,
          type,
          applicationProjects
        )
      ) {
        if (githubWindow) {
          githubWindow.close();
        }

        button.disabled = true;

        button.classList.add(
          "added"
        );

        button.textContent =
          "✓ 지원 관리 등록됨";

        showToast(
          "이미 지원 관리에 등록된 프로젝트입니다."
        );

        return;
      }

      const newProject =
        createApplicationProject(
          project,
          type,
          applicationProjects
        );

      const nextProjects = [
        ...applicationProjects,
        newProject
      ];

      const json =
        JSON.stringify(
          nextProjects,
          null,
          2
        );

      await copyText(json);

      button.disabled = false;

      button.textContent =
        "✓ JSON 복사 완료";

      showToast(
        "지원 관리용 JSON을 복사했습니다. 열린 GitHub 화면에서 Ctrl+A → Ctrl+V → Commit 하면 됩니다."
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

      setTimeout(
        function () {
          button.textContent =
            "⭐ 지원 관리에 추가";
        },
        4500
      );
    } catch (error) {
      console.error(
        "[AXOO Capture]",
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
          "지원 관리 추가 중 오류가 발생했습니다.",
        "error"
      );
    }
  }

  function injectStyles() {
    if (
      document.getElementById(
        "axooProjectCaptureStyles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "axooProjectCaptureStyles";

    style.textContent = `
      .axoo-capture-actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 9px;
        margin-top: 12px;
      }

      .axoo-capture-actions > .link {
        margin: 0 !important;
      }

      .axoo-capture-button {
        appearance: none;
        min-height: 38px;
        padding: 0 15px;
        border: 1px solid #111;
        border-radius: 999px;
        background: #111;
        color: #fff;
        font: inherit;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
        transition:
          transform .15s ease,
          opacity .15s ease;
      }

      .axoo-capture-button:hover {
        transform:
          translateY(-1px);
      }

      .axoo-capture-button:disabled {
        opacity: .65;
        cursor: default;
        transform: none;
      }

      .axoo-capture-button.added {
        border-color: #b9dfc8;
        background: #eaf7ef;
        color: #087445;
      }

      .axoo-capture-toast {
        position: fixed;
        z-index: 99999;
        right: 24px;
        bottom: 24px;
        max-width:
          min(
            430px,
            calc(100vw - 32px)
          );
        padding: 14px 17px;
        border-radius: 13px;
        background: #111;
        color: #fff;
        font-size: 13px;
        font-weight: 800;
        line-height: 1.5;
        box-shadow:
          0 16px 45px
          rgba(0,0,0,.2);
        opacity: 0;
        transform:
          translateY(10px);
        pointer-events: none;
        transition:
          .2s ease;
      }

      .axoo-capture-toast.show {
        opacity: 1;
        transform:
          translateY(0);
      }

      .axoo-capture-toast.error {
        background: #b72e24;
      }

      @media (max-width: 640px) {
        .axoo-capture-actions {
          align-items: stretch;
          flex-direction: column;
        }

        .axoo-capture-actions > .link,
        .axoo-capture-button {
          width: 100%;
          box-sizing: border-box;
          text-align: center;
          justify-content: center;
        }

        .axoo-capture-toast {
          right: 16px;
          left: 16px;
          bottom: 16px;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function decorateCard(card) {
    if (
      card.dataset
        .axooCaptureReady ===
      "true"
    ) {
      return;
    }

    const isPriority =
      card.classList.contains(
        "priority-accordion-card"
      );

    const isArt =
      Boolean(
        card.closest("#artCards")
      );

    if (
      !isPriority &&
      !isArt
    ) {
      return;
    }

    /*
      건축물 미술작품의 빈 상태 카드에는
      review-box가 없으므로 버튼을 만들지 않음.
    */
    if (
      isArt &&
      !card.querySelector(
        ".review-box"
      )
    ) {
      return;
    }

    const body =
      isPriority
        ? card.querySelector(
            ".accordion-body"
          )
        : card;

    if (!body) {
      return;
    }

    let actions =
      body.querySelector(
        ".axoo-capture-actions"
      );

    if (!actions) {
      actions =
        document.createElement(
          "div"
        );

      actions.className =
        "axoo-capture-actions";

      const link =
        body.querySelector(
          "a.link"
        );

      if (link) {
        link.parentNode.insertBefore(
          actions,
          link
        );

        actions.appendChild(
          link
        );
      } else {
        body.appendChild(
          actions
        );
      }
    }

    const button =
      document.createElement(
        "button"
      );

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

    actions.appendChild(
      button
    );

    /*
      이미 application_projects.json에
      들어간 공고라면 즉시 등록 상태 표시.
    */
    const capture =
      findProjectByCard(card);

    if (
      capture &&
      alreadyExists(
        capture.project,
        capture.type,
        applicationProjects
      )
    ) {
      button.disabled = true;

      button.classList.add(
        "added"
      );

      button.textContent =
        "✓ 지원 관리 등록됨";
    }

    card.dataset
      .axooCaptureReady =
      "true";
  }

  function decorateAllCards() {
    document
      .querySelectorAll(
        ".priority-accordion-card"
      )
      .forEach(
        decorateCard
      );

    document
      .querySelectorAll(
        "#artCards > .card"
      )
      .forEach(
        decorateCard
      );
  }

  function watchDashboard() {
    /*
      기존 대시보드가 필터 변경 때
      카드를 다시 생성하므로 MutationObserver로
      새 카드에도 버튼 재부착.
    */
    const observer =
      new MutationObserver(
        function () {
          decorateAllCards();
        }
      );

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );

    /*
      app.js가 렌더 완료 시 발생시키는
      커스텀 이벤트에도 대응.
    */
    window.addEventListener(
      "axoo:rendered",
      decorateAllCards
    );
  }

  async function init() {
    injectStyles();

    await loadAllData();

    decorateAllCards();

    watchDashboard();
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }
})();
