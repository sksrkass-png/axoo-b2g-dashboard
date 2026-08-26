(function () {
  "use strict";


  /* =====================================================
     CONFIG

     PROJECT CONTROL은
     건축물 미술작품 공모만 연결한다.
  ===================================================== */

  const ART_URL =
    "data/art_commissions.json";

  const APP_URL =
    "https://script.google.com/a/macros/axoocorp.com/s/AKfycbzLS5AW0DfLGIDersBlbL4IDEIhHqElPaaePi45bG5nrT6V_8FKwSjwta3lUS3VocW3/exec";

  const STORAGE_KEY =
    "axoo_b2g_registered_art_projects_v2";

  let artProjects = [];


  /* =====================================================
     BASIC
  ===================================================== */

  function normalizeArray(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (
      data &&
      Array.isArray(data.projects)
    ) {
      return data.projects;
    }

    if (
      data &&
      Array.isArray(data.items)
    ) {
      return data.items;
    }

    if (
      data &&
      Array.isArray(data.data)
    ) {
      return data.data;
    }

    return [];
  }


  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }


  function normalizeDate(value) {
    const raw =
      String(value || "")
        .trim();

    const match =
      raw.match(
        /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/
      );

    if (!match) {
      return "";
    }

    return [
      match[1],
      String(match[2])
        .padStart(2, "0"),
      String(match[3])
        .padStart(2, "0")
    ].join("-");
  }


  function clampProgress(value) {
    const number =
      Number(value);

    if (
      !Number.isFinite(number)
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(
        100,
        Math.round(number)
      )
    );
  }


  function statusLabel(status) {
    const map = {
      REVIEW:
        "검토중",

      WORKING:
        "작성중",

      REVIEW_REQUESTED:
        "검토요청",

      READY:
        "제출준비",

      SUBMITTED:
        "제출완료",

      ARCHIVED:
        "보관"
    };

    const key =
      String(status || "")
        .toUpperCase()
        .trim();

    return (
      map[key] ||
      key
    );
  }


  /* =====================================================
     ART PROJECT DATA
  ===================================================== */

  function getTitle(project) {
    return (
      project.title ||
      project.noticeTitle ||
      project.projectName ||
      ""
    );
  }


  function getAgency(project) {
    return (
      project.agency ||
      project.organization ||
      project.institution ||
      project.source ||
      ""
    );
  }


  function getDeadline(project) {
    return normalizeDate(
      project.deadline ||
      project.periodEnd ||
      project.endDate ||
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
      project.detailUrl,
      project.noticeUrl
    ];

    return (
      values.find(
        function (value) {
          const url =
            String(value || "")
              .trim();

          return (
            url.startsWith(
              "https://"
            ) ||
            url.startsWith(
              "http://"
            )
          );
        }
      ) ||
      ""
    );
  }


  /*
    RESEARCH_ID는 건축물 미술작품의
    원본 리서치 ID를 그대로 사용.

    기존 Sheet와 연결할 때
    가장 중요한 식별값이다.
  */

  function getResearchId(project) {
    const id =
      project.id ||
      project.noticeId ||
      project.sourceId ||
      project.researchId;

    if (id) {
      return String(id);
    }

    return [
      "art",
      normalizeText(
        getTitle(project)
      ),
      getDeadline(project)
    ].join("::");
  }


  function getPriority() {
    /*
      Project Control 등록 시
      최초 기본 우선순위.

      필요하면 Sheet에서
      HIGH / NORMAL / LOW로 조정.
    */

    return "NORMAL";
  }


  function getNextAction(project) {
    return (
      project.recommendedAction ||
      project.nextAction ||
      "공고문 확인 후 접수기간, 설치조건, 작품규모, 참가자격 및 제출서류 검토"
    );
  }


  /* =====================================================
     LOCAL STORAGE
  ===================================================== */

  function getRegisteredMap() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        return {};
      }

      const parsed =
        JSON.parse(raw);

      return (
        parsed &&
        typeof parsed ===
          "object"
      )
        ? parsed
        : {};

    } catch (error) {
      console.warn(
        "[AXOO PROJECT CONTROL] localStorage read error",
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
        "[AXOO PROJECT CONTROL] localStorage save error",
        error
      );
    }
  }


  function getRegisteredState(
    researchId
  ) {
    const map =
      getRegisteredMap();

    return (
      map[researchId] ||
      null
    );
  }


  function isRegistered(
    researchId
  ) {
    const state =
      getRegisteredState(
        researchId
      );

    return Boolean(
      state &&
      state.registered
    );
  }


  function markRegistered(
    researchId,
    data
  ) {
    if (!researchId) {
      return;
    }

    const map =
      getRegisteredMap();

    const previous =
      map[researchId] ||
      {};

    const nextStatus =
      (
        data &&
        data.status
      ) ||
      previous.status ||
      "REVIEW";

    let progress =
      previous.progress;

    if (
      data &&
      data.progress !== undefined &&
      data.progress !== null &&
      data.progress !== ""
    ) {
      progress =
        clampProgress(
          data.progress
        );
    }

    map[researchId] = {
      registered:
        true,

      projectId:
        (
          data &&
          data.projectId !== undefined
        )
          ? String(
              data.projectId ||
              ""
            )
          : String(
              previous.projectId ||
              ""
            ),

      status:
        nextStatus,

      statusLabel:
        (
          data &&
          data.statusLabel
        )
          ? String(
              data.statusLabel
            )
          : (
              previous.statusLabel ||
              statusLabel(
                nextStatus
              )
            ),

      progress:
        progress,

      sheetUpdatedAt:
        (
          data &&
          data.updatedAt !== undefined
        )
          ? String(
              data.updatedAt ||
              ""
            )
          : String(
              previous.sheetUpdatedAt ||
              ""
            ),

      syncedAt:
        data &&
        data.synced
          ? new Date()
              .toISOString()
          : String(
              previous.syncedAt ||
              ""
            ),

      updatedAt:
        new Date()
          .toISOString()
    };

    saveRegisteredMap(map);

    refreshButtonStates();
  }


  function markNotRegistered(
    researchId
  ) {
    if (!researchId) {
      return;
    }

    const map =
      getRegisteredMap();

    delete map[researchId];

    saveRegisteredMap(map);

    refreshButtonStates();
  }


  /* =====================================================
     CALLBACK
  ===================================================== */

  function cleanUrlParams(
    url,
    names
  ) {
    names.forEach(
      function (name) {
        url.searchParams.delete(
          name
        );
      }
    );

    window.history
      .replaceState(
        {},
        document.title,
        url.pathname +
        (
          url.search ||
          ""
        ) +
        url.hash
      );
  }


  /*
    Apps Script에서
    프로젝트 생성 후 돌아왔을 때 처리.
  */

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

      markRegistered(
        researchId,
        {
          projectId:
            url.searchParams.get(
              "projectId"
            ) || "",

          status:
            url.searchParams.get(
              "status"
            ) ||
            "REVIEW"
        }
      );

      cleanUrlParams(
        url,
        [
          "registeredResearchId",
          "projectId",
          "status"
        ]
      );

    } catch (error) {
      console.warn(
        "[AXOO PROJECT CONTROL] registration callback error",
        error
      );
    }
  }


  /*
    Apps Script에서
    Google Sheet 상태 확인 후
    돌아왔을 때 처리.
  */

  function consumeSyncCallback() {
    try {
      const url =
        new URL(
          window.location.href
        );

      if (
        url.searchParams.get(
          "syncResult"
        ) !== "1"
      ) {
        return;
      }

      const found =
        url.searchParams.get(
          "syncFound"
        ) === "1";

      const researchId =
        url.searchParams.get(
          "researchId"
        ) || "";

      if (
        found &&
        researchId
      ) {
        markRegistered(
          researchId,
          {
            projectId:
              url.searchParams.get(
                "projectId"
              ) || "",

            status:
              url.searchParams.get(
                "status"
              ) ||
              "REVIEW",

            statusLabel:
              url.searchParams.get(
                "statusLabel"
              ) || "",

            progress:
              url.searchParams.get(
                "progress"
              ),

            updatedAt:
              url.searchParams.get(
                "updatedAt"
              ) || "",

            synced:
              true
          }
        );

      } else if (
        researchId
      ) {
        markNotRegistered(
          researchId
        );
      }

      cleanUrlParams(
        url,
        [
          "syncResult",
          "syncFound",
          "researchId",
          "projectId",
          "status",
          "statusLabel",
          "progress",
          "updatedAt"
        ]
      );

      if (!found) {
        setTimeout(
          function () {
            alert(
              "Project Control에서 등록된 건축물 미술작품 프로젝트를 찾지 못했습니다."
            );
          },
          200
        );
      }

    } catch (error) {
      console.warn(
        "[AXOO PROJECT CONTROL] sync callback error",
        error
      );
    }
  }


  /* =====================================================
     DATA LOAD

     중요:
     priority_projects.json을 로드하지 않는다.

     즉 나라장터 / 전시 콘텐츠 /
     일반 지원사업은 Project Control과
     완전히 분리된다.
  ===================================================== */

  async function loadArtProjects() {
    try {
      const response =
        await fetch(
          ART_URL +
          "?v=" +
          Date.now()
        );

      if (!response.ok) {
        throw new Error(
          "art_commissions.json load failed"
        );
      }

      artProjects =
        normalizeArray(
          await response.json()
        );

    } catch (error) {
      console.error(
        "[AXOO PROJECT CONTROL]",
        error
      );

      artProjects = [];
    }
  }


  /* =====================================================
     CARD MATCH
  ===================================================== */

  function getCardTitle(card) {
    const element =
      card.querySelector(
        ".summary-title"
      ) ||
      card.querySelector(
        ".accordion-body h2"
      ) ||
      card.querySelector(
        ".accordion-body h3"
      ) ||
      card.querySelector(
        "h2"
      ) ||
      card.querySelector(
        "h3"
      );

    return element
      ? normalizeText(
          element.textContent
        )
      : "";
  }


  function findArtProject(card) {
    /*
      안전장치:
      #artCards 안의 카드가 아니면
      절대 프로젝트 컨트롤 대상으로 보지 않는다.
    */

    if (
      !card.closest(
        "#artCards"
      )
    ) {
      return null;
    }

    const title =
      getCardTitle(card);

    if (!title) {
      return null;
    }

    return (
      artProjects.find(
        function (project) {
          return (
            normalizeText(
              getTitle(project)
            ) === title
          );
        }
      ) ||
      null
    );
  }


  /* =====================================================
     APPS SCRIPT URL
  ===================================================== */

  function buildAddUrl(project) {
    const params =
      new URLSearchParams();

    params.set(
      "mode",
      "add"
    );

    params.set(
      "researchId",
      getResearchId(
        project
      )
    );

    params.set(
      "title",
      getTitle(
        project
      )
    );

    params.set(
      "institution",
      getAgency(
        project
      )
    );

    params.set(
      "deadline",
      getDeadline(
        project
      )
    );

    params.set(
      "priority",
      getPriority()
    );

    params.set(
      "nextAction",
      getNextAction(
        project
      )
    );

    params.set(
      "sourceUrl",
      getSourceUrl(
        project
      )
    );

    return (
      APP_URL +
      "?" +
      params.toString()
    );
  }


  function buildSyncUrl(project) {
    const researchId =
      getResearchId(
        project
      );

    const state =
      getRegisteredState(
        researchId
      ) || {};

    const params =
      new URLSearchParams();

    params.set(
      "mode",
      "sync"
    );

    params.set(
      "researchId",
      researchId
    );

    if (
      state.projectId
    ) {
      params.set(
        "projectId",
        state.projectId
      );
    }

    params.set(
      "title",
      getTitle(
        project
      )
    );

    params.set(
      "institution",
      getAgency(
        project
      )
    );

    params.set(
      "deadline",
      getDeadline(
        project
      )
    );

    params.set(
      "nextAction",
      getNextAction(
        project
      )
    );

    params.set(
      "sourceUrl",
      getSourceUrl(
        project
      )
    );

    params.set(
      "priority",
      getPriority()
    );

    return (
      APP_URL +
      "?" +
      params.toString()
    );
  }


  /* =====================================================
     BUTTON STATE
  ===================================================== */

  function getCaptureButtonText(
    researchId
  ) {
    const state =
      getRegisteredState(
        researchId
      );

    if (
      !state ||
      !state.registered
    ) {
      return (
        "⭐ 프로젝트 컨트롤에 추가"
      );
    }

    const label =
      state.statusLabel ||
      statusLabel(
        state.status
      );

    const hasProgress =
      state.progress !== undefined &&
      state.progress !== null &&
      state.progress !== "";

    if (
      label &&
      hasProgress
    ) {
      return (
        "✓ 프로젝트 등록됨 · " +
        label +
        " · " +
        clampProgress(
          state.progress
        ) +
        "%"
      );
    }

    if (label) {
      return (
        "✓ 프로젝트 등록됨 · " +
        label
      );
    }

    return (
      "✓ 프로젝트 컨트롤 등록됨"
    );
  }


  function setCaptureButtonState(
    button,
    researchId
  ) {
    const registered =
      isRegistered(
        researchId
      );

    button.textContent =
      getCaptureButtonText(
        researchId
      );

    button.classList.toggle(
      "registered",
      registered
    );
  }


  function setSyncButtonState(
    button,
    researchId
  ) {
    const registered =
      isRegistered(
        researchId
      );

    button.textContent =
      registered
        ? "↻ 프로젝트 상태 동기화"
        : "↻ 프로젝트 등록 확인";
  }


  /* =====================================================
     BUTTON ACTION
  ===================================================== */

  function handleCapture(
    button,
    card
  ) {
    const project =
      findArtProject(
        card
      );

    if (!project) {
      alert(
        "건축물 미술작품 공고 데이터를 찾지 못했습니다."
      );

      return;
    }

    const researchId =
      getResearchId(
        project
      );

    /*
      이미 등록된 프로젝트라면
      새 프로젝트를 중복 생성하지 않고
      기존 Project Control을 연다.
    */

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
      "프로젝트 컨트롤 열기...";

    window.open(
      buildAddUrl(
        project
      ),
      "_blank"
    );

    setTimeout(
      function () {
        setCaptureButtonState(
          button,
          researchId
        );
      },
      1200
    );
  }


  function handleSync(
    button,
    card
  ) {
    const project =
      findArtProject(
        card
      );

    if (!project) {
      alert(
        "건축물 미술작품 공고 데이터를 찾지 못했습니다."
      );

      return;
    }

    button.textContent =
      "동기화 중...";

    window.location.href =
      buildSyncUrl(
        project
      );
  }


  /* =====================================================
     STORAGE EVENT
  ===================================================== */

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


  /* =====================================================
     STYLE
  ===================================================== */

  function injectStyles() {
    if (
      document.getElementById(
        "axooProjectControlStyles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "axooProjectControlStyles";

    style.textContent = `
      .axoo-project-control-actions {
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:9px;
        margin-top:14px;
      }

      .axoo-project-control-actions > .link {
        margin:0 !important;
      }

      .axoo-project-control-button,
      .axoo-project-sync-button {
        appearance:none;
        min-height:38px;
        padding:0 15px;
        border-radius:999px;
        font:inherit;
        font-size:12px;
        font-weight:900;
        cursor:pointer;
      }

      .axoo-project-control-button {
        border:1px solid #111;
        background:#111;
        color:#fff;
      }

      .axoo-project-control-button:hover {
        opacity:.82;
      }

      .axoo-project-control-button.registered {
        border-color:#d6d6d1;
        background:#f1f1ee;
        color:#444;
      }

      .axoo-project-control-button.registered:hover {
        opacity:1;
        background:#e9e9e4;
      }

      .axoo-project-sync-button {
        border:1px solid #d6d6d1;
        background:#fff;
        color:#111;
      }

      .axoo-project-sync-button:hover {
        border-color:#111;
        background:#111;
        color:#fff;
      }

      @media (max-width:640px) {
        .axoo-project-control-actions {
          flex-direction:column;
          align-items:stretch;
        }

        .axoo-project-control-actions > .link,
        .axoo-project-control-button,
        .axoo-project-sync-button {
          width:100%;
          text-align:center;
        }
      }
    `;

    document.head
      .appendChild(
        style
      );
  }


  /* =====================================================
     DECORATE ART CARD

     핵심 안전장치:
     #artCards 내부에만 버튼을 생성한다.

     priority-accordion-card,
     exhibitionTab,
     muralTab,
     otherTab에는
     절대 버튼을 생성하지 않는다.
  ===================================================== */

  function decorateArtCard(card) {
    if (
      !card.closest(
        "#artCards"
      )
    ) {
      return;
    }

    const project =
      findArtProject(
        card
      );

    if (!project) {
      return;
    }

    const researchId =
      getResearchId(
        project
      );

    /*
      이미 만들어졌으면
      중복 생성하지 않는다.
    */

    if (
      card.querySelector(
        ".axoo-project-control-actions"
      )
    ) {
      return;
    }

    const actions =
      document.createElement(
        "div"
      );

    actions.className =
      "axoo-project-control-actions";


    /*
      기존 공고 보기 버튼이 있으면
      같은 액션 영역 안으로 이동.
    */

    const existingLink =
      card.querySelector(
        "a.link"
      );

    if (
      existingLink &&
      existingLink.parentNode
    ) {
      existingLink.parentNode
        .insertBefore(
          actions,
          existingLink
        );

      actions.appendChild(
        existingLink
      );

    } else {
      card.appendChild(
        actions
      );
    }


    /*
      PROJECT CONTROL 등록 버튼
    */

    const captureButton =
      document.createElement(
        "button"
      );

    captureButton.type =
      "button";

    captureButton.className =
      "axoo-project-control-button";

    captureButton.dataset
      .researchId =
      researchId;

    captureButton
      .addEventListener(
        "click",
        function (event) {
          event.preventDefault();
          event.stopPropagation();

          handleCapture(
            captureButton,
            card
          );
        }
      );

    actions.appendChild(
      captureButton
    );

    setCaptureButtonState(
      captureButton,
      researchId
    );


    /*
      PROJECT CONTROL 상태 확인
    */

    const syncButton =
      document.createElement(
        "button"
      );

    syncButton.type =
      "button";

    syncButton.className =
      "axoo-project-sync-button";

    syncButton.dataset
      .researchId =
      researchId;

    syncButton
      .addEventListener(
        "click",
        function (event) {
          event.preventDefault();
          event.stopPropagation();

          handleSync(
            syncButton,
            card
          );
        }
      );

    actions.appendChild(
      syncButton
    );

    setSyncButtonState(
      syncButton,
      researchId
    );
  }


  function decorateAllArtCards() {
    document
      .querySelectorAll(
        "#artCards > .card"
      )
      .forEach(
        decorateArtCard
      );
  }


  function refreshButtonStates() {
    document
      .querySelectorAll(
        ".axoo-project-control-button[data-research-id]"
      )
      .forEach(
        function (button) {
          setCaptureButtonState(
            button,
            button.dataset
              .researchId
          );
        }
      );

    document
      .querySelectorAll(
        ".axoo-project-sync-button[data-research-id]"
      )
      .forEach(
        function (button) {
          setSyncButtonState(
            button,
            button.dataset
              .researchId
          );
        }
      );
  }


  /*
    기존 대시보드 렌더 타이밍이 여러 단계라
    MutationObserver 대신 안전하게
    몇 차례만 재검사한다.
  */

  function scheduleSafeDecorations() {
    [
      150,
      350,
      700,
      1200,
      2000,
      3500
    ].forEach(
      function (delay) {
        setTimeout(
          decorateAllArtCards,
          delay
        );
      }
    );
  }


  /* =====================================================
     INIT
  ===================================================== */

  async function init() {
    consumeRegistrationCallback();
    consumeSyncCallback();

    injectStyles();

    listenForStorageChanges();

    await loadArtProjects();

    decorateAllArtCards();

    scheduleSafeDecorations();

    /*
      app.js / art UI에서
      데이터 재렌더 후 보내는 이벤트 대응.
    */

    window.addEventListener(
      "axoo:rendered",
      function () {
        setTimeout(
          decorateAllArtCards,
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
        once: true
      }
    );

  } else {
    init();
  }

})();
