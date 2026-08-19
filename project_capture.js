(function () {
  "use strict";

  const PRIORITY_URL = "data/priority_projects.json";
  const ART_URL = "data/art_commissions.json";

  const APP_URL =
    "https://script.google.com/a/macros/axoocorp.com/s/AKfycbzLS5AW0DfLGIDersBlbL4IDEIhHqElPaaePi45bG5nrT6V_8FKwSjwta3lUS3VocW3/exec";

  const STORAGE_KEY =
    "axoo_b2g_registered_projects_v1";

  let priorityProjects = [];
  let artProjects = [];


  /* =========================================
     BASIC
  ========================================= */

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
    const text =
      String(value || "").trim();

    const match =
      text.match(
        /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/
      );

    if (!match) return "";

    return [
      match[1],
      String(match[2]).padStart(2, "0"),
      String(match[3]).padStart(2, "0")
    ].join("-");
  }


  /* =========================================
     PROJECT DATA
  ========================================= */

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
    const values = [
      project.sourceUrl,
      project.originalUrl,
      project.url,
      project.ntceSpecDocUrl1,
      project.documentUrl
    ];

    return (
      values.find(function (value) {
        const url =
          String(value || "").trim();

        return (
          url.startsWith("https://") ||
          url.startsWith("http://")
        );
      }) || ""
    );
  }


  function getResearchId(project, type) {
    const id =
      project.id ||
      project.bidNtceNo ||
      project.noticeNo ||
      project.noticeId ||
      project.sourceId;

    if (id) {
      return String(id);
    }

    return [
      type,
      normalizeText(getTitle(project)),
      getDeadline(project)
    ].join("::");
  }


  function getGrade(project) {
    const grade =
      String(project.grade || "")
        .toUpperCase()
        .trim();

    if (grade) return grade;

    const score =
      Number(
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
    if (type === "art") {
      return "NORMAL";
    }

    const grade =
      getGrade(project);

    if (
      grade === "S" ||
      grade === "A"
    ) {
      return "HIGH";
    }

    if (grade === "C") {
      return "LOW";
    }

    return "NORMAL";
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


  /* =========================================
     REGISTERED STATE
  ========================================= */

  function getRegisteredMap() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) return {};

      const parsed =
        JSON.parse(raw);

      return (
        parsed &&
        typeof parsed === "object"
      )
        ? parsed
        : {};

    } catch (error) {
      console.warn(
        "[AXOO Capture] storage read failed",
        error
      );

      return {};
    }
  }


  function saveRegisteredMap(map) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(map)
      );

    } catch (error) {
      console.warn(
        "[AXOO Capture] storage write failed",
        error
      );
    }
  }


  function isRegistered(researchId) {
    const map =
      getRegisteredMap();

    return Boolean(
      map[researchId] &&
      map[researchId].registered
    );
  }


  function markRegistered(
    researchId,
    data
  ) {
    if (!researchId) return;

    const map =
      getRegisteredMap();

    map[researchId] = {
      registered: true,

      projectId:
        data &&
        data.projectId
          ? data.projectId
          : "",

      status:
        data &&
        data.status
          ? data.status
          : "REVIEW",

      updatedAt:
        new Date().toISOString()
    };

    saveRegisteredMap(map);

    refreshButtonStates();
  }


  /* =========================================
     REGISTRATION CALLBACK
  ========================================= */

  function consumeRegistrationCallback() {
    try {
      const url =
        new URL(
          window.location.href
        );

      const researchId =
        url.searchParams.get(
          "registeredResearchId"
        );

      if (!researchId) {
        return;
      }

      const projectId =
        url.searchParams.get(
          "projectId"
        ) || "";

      const status =
        url.searchParams.get(
          "status"
        ) || "REVIEW";

      markRegistered(
        researchId,
        {
          projectId: projectId,
          status: status
        }
      );

      /*
        등록용 파라미터를 주소에서 제거.
      */
      url.searchParams.delete(
        "registeredResearchId"
      );

      url.searchParams.delete(
        "projectId"
      );

      url.searchParams.delete(
        "status"
      );

      window.history.replaceState(
        {},
        document.title,
        url.pathname +
        (
          url.search
            ? url.search
            : ""
        ) +
        url.hash
      );

    } catch (error) {
      console.warn(
        "[AXOO Capture] callback parse failed",
        error
      );
    }
  }


  /* =========================================
     DATA LOAD
  ========================================= */

  async function loadJson(url) {
    try {
      const response =
        await fetch(
          `${url}?v=${Date.now()}`
        );

      if (!response.ok) {
        throw new Error(
          `${url} load failed`
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


  async function loadData() {
    const [
      priority,
      art
    ] =
      await Promise.all([
        loadJson(PRIORITY_URL),
        loadJson(ART_URL)
      ]);

    priorityProjects =
      priority;

    artProjects =
      art;
  }


  /* =========================================
     CARD MATCH
  ========================================= */

  function getCardTitle(card) {
    const element =
      card.querySelector(
        ".accordion-body h2"
      ) ||
      card.querySelector("h2") ||
      card.querySelector("h3") ||
      card.querySelector(
        ".summary-title"
      );

    return element
      ? normalizeText(
          element.textContent
        )
      : "";
  }


  function findByTitle(
    list,
    title
  ) {
    if (!title) return null;

    return (
      list.find(function (project) {
        return (
          normalizeText(
            getTitle(project)
          ) === title
        );
      }) ||
      null
    );
  }


  function findProject(card) {
    const title =
      getCardTitle(card);

    if (
      card.closest("#artCards")
    ) {
      const project =
        findByTitle(
          artProjects,
          title
        );

      return project
        ? {
            project: project,
            type: "art"
          }
        : null;
    }

    const project =
      findByTitle(
        priorityProjects,
        title
      );

    return project
      ? {
          project: project,
          type: "priority"
        }
      : null;
  }


  /* =========================================
     ADD URL
  ========================================= */

  function buildAddUrl(
    project,
    type
  ) {
    const params =
      new URLSearchParams();

    params.set(
      "mode",
      "add"
    );

    params.set(
      "researchId",
      getResearchId(
        project,
        type
      )
    );

    params.set(
      "title",
      getTitle(project)
    );

    params.set(
      "institution",
      getAgency(project)
    );

    params.set(
      "deadline",
      getDeadline(project)
    );

    params.set(
      "priority",
      getPriority(
        project,
        type
      )
    );

    params.set(
      "nextAction",
      getNextAction(
        project,
        type
      )
    );

    params.set(
      "sourceUrl",
      getSourceUrl(project)
    );

    return (
      APP_URL +
      "?" +
      params.toString()
    );
  }


  /* =========================================
     BUTTON
  ========================================= */

  function setButtonState(
    button,
    researchId
  ) {
    const registered =
      isRegistered(researchId);

    const wantedText =
      registered
        ? "✓ 지원 관리 등록됨"
        : "⭐ 지원 관리에 추가";

    if (
      button.textContent !==
      wantedText
    ) {
      button.textContent =
        wantedText;
    }

    button.classList.toggle(
      "registered",
      registered
    );
  }


  function handleCapture(
    button,
    card
  ) {
    const capture =
      findProject(card);

    if (!capture) {
      alert(
        "공고 데이터를 찾지 못했습니다."
      );

      return;
    }

    const researchId =
      getResearchId(
        capture.project,
        capture.type
      );

    if (
      isRegistered(
        researchId
      )
    ) {
      window.open(
        APP_URL,
        "_blank"
      );

      return;
    }

    button.textContent =
      "지원 관리 열기...";

    window.open(
      buildAddUrl(
        capture.project,
        capture.type
      ),
      "_blank"
    );

    setTimeout(
      function () {
        setButtonState(
          button,
          researchId
        );
      },
      1500
    );
  }


  /* =========================================
     STORAGE SYNC
  ========================================= */

  function listenForStorageChanges() {
    window.addEventListener(
      "storage",
      function (event) {

        if (
          event.key !==
          STORAGE_KEY
        ) {
          return;
        }

        refreshButtonStates();
      }
    );
  }


  /* =========================================
     STYLE
  ========================================= */

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
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:9px;
        margin-top:12px;
      }

      .axoo-capture-actions > .link {
        margin:0 !important;
      }

      .axoo-capture-button {
        appearance:none;
        min-height:38px;
        padding:0 15px;
        border:1px solid #111;
        border-radius:999px;
        background:#111;
        color:#fff;
        font:inherit;
        font-size:12px;
        font-weight:900;
        cursor:pointer;
      }

      .axoo-capture-button:hover {
        opacity:.82;
      }

      .axoo-capture-button.registered {
        border-color:#d6d6d1;
        background:#f1f1ee;
        color:#555;
      }

      .axoo-capture-button.registered:hover {
        opacity:1;
        background:#e9e9e4;
      }

      @media (max-width:640px) {
        .axoo-capture-actions {
          flex-direction:column;
          align-items:stretch;
        }

        .axoo-capture-actions > .link,
        .axoo-capture-button {
          width:100%;
          text-align:center;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }


  /* =========================================
     CARD DECORATION
  ========================================= */

  function decorateCard(card) {
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

    if (
      isArt &&
      !card.querySelector(
        ".review-box"
      )
    ) {
      return;
    }

    const capture =
      findProject(card);

    if (!capture) {
      return;
    }

    const researchId =
      getResearchId(
        capture.project,
        capture.type
      );

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

      if (
        link &&
        link.parentNode
      ) {
        link.parentNode
          .insertBefore(
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

    let button =
      actions.querySelector(
        ".axoo-capture-button"
      );

    if (!button) {
      button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.className =
        "axoo-capture-button";

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
    }

    button.dataset.researchId =
      researchId;

    setButtonState(
      button,
      researchId
    );
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


  function refreshButtonStates() {
    document
      .querySelectorAll(
        ".axoo-capture-button[data-research-id]"
      )
      .forEach(
        function (button) {
          setButtonState(
            button,
            button.dataset.researchId
          );
        }
      );
  }


  /*
    MutationObserver 없음.
  */
  function scheduleSafeDecorations() {
    [
      250,
      700,
      1400,
      2600,
      4500
    ].forEach(
      function (delay) {
        setTimeout(
          decorateAllCards,
          delay
        );
      }
    );
  }


  /* =========================================
     INIT
  ========================================= */

  async function init() {
    consumeRegistrationCallback();

    injectStyles();

    listenForStorageChanges();

    await loadData();

    decorateAllCards();

    scheduleSafeDecorations();

    window.addEventListener(
      "axoo:rendered",
      function () {
        setTimeout(
          decorateAllCards,
          0
        );
      }
    );
  }


  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once:true
      }
    );

  } else {
    init();
  }

})();
