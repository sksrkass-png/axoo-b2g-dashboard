(function () {
  "use strict";

  const PRIORITY_URL =
    "data/priority_projects.json";

  const ART_URL =
    "data/art_commissions.json";

  const APP_URL =
    "https://script.google.com/a/macros/axoocorp.com/s/AKfycbzLS5AW0DfLGIDersBlbL4IDEIhHqElPaaePi45bG5nrT6V_8FKwSjwta3lUS3VocW3/exec";

  const STORAGE_KEY =
    "axoo_b2g_registered_projects_v1";

  let priorityProjects = [];
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
    const text =
      String(value || "")
        .trim();

    const match =
      text.match(
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
      REVIEW: "검토중",
      WORKING: "작성중",
      REVIEW_REQUESTED: "검토요청",
      READY: "제출준비",
      SUBMITTED: "제출완료"
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
     PROJECT DATA
  ===================================================== */

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
      project.periodEnd ||
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


  function getResearchId(
    project,
    type
  ) {
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
      normalizeText(
        getTitle(project)
      ),
      getDeadline(project)
    ].join("::");
  }


  function getGrade(project) {
    const grade =
      String(
        project.grade || ""
      )
        .toUpperCase()
        .trim();

    if (grade) {
      return grade;
    }

    const score =
      Number(
        project.axooFitScore ||
        project.score ||
        project.priorityScore ||
        0
      );

    if (score >= 85) {
      return "S";
    }

    if (score >= 70) {
      return "A";
    }

    if (score >= 50) {
      return "B";
    }

    return "";
  }


  function getPriority(
    project,
    type
  ) {
    if (
      type === "art"
    ) {
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

    if (
      grade === "C"
    ) {
      return "LOW";
    }

    return "NORMAL";
  }


  function getNextAction(
    project,
    type
  ) {
    if (
      type === "art"
    ) {
      return (
        project.recommendedAction ||
        project.nextAction ||
        "공고문 확인 후 접수 기간, 설치 조건, 작품 규모, 제출 서류 검토"
      );
    }

    return (
      project.recommendedAction ||
      project.nextAction ||
      "공고문 및 지원 조건 확인"
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
        "[AXOO B2G] localStorage read error",
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
        "[AXOO B2G] localStorage save error",
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
      data.progress !==
        undefined &&
      data.progress !==
        null &&
      data.progress !== ""
    ) {
      progress =
        clampProgress(
          data.progress
        );
    }

    map[researchId] = {
      registered: true,

      projectId:
        (
          data &&
          data.projectId !==
            undefined
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
          data.updatedAt !==
            undefined
        )
          ? String(
              data.updatedAt ||
              ""
            )
          : String(
              previous
                .sheetUpdatedAt ||
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
        "[AXOO B2G] registration callback error",
        error
      );
    }
  }


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
              "Google Sheet에서 등록된 지원 프로젝트를 찾지 못했습니다."
            );
          },
          200
        );
      }

    } catch (error) {
      console.warn(
        "[AXOO B2G] sync callback error",
        error
      );
    }
  }


  /* =====================================================
     DATA LOAD
  ===================================================== */

  async function loadJson(url) {
    try {
      const response =
        await fetch(
          url +
          "?v=" +
          Date.now()
        );

      if (!response.ok) {
        throw new Error(
          url +
          " load failed"
        );
      }

      return normalizeArray(
        await response.json()
      );

    } catch (error) {
      console.error(
        "[AXOO B2G]",
        error
      );

      return [];
    }
  }


  async function loadData() {
    const results =
      await Promise.all([
        loadJson(
          PRIORITY_URL
        ),

        loadJson(
          ART_URL
        )
      ]);

    priorityProjects =
      results[0];

    artProjects =
      results[1];
  }


  /* =====================================================
     CARD MATCH
  ===================================================== */

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
    if (!title) {
      return null;
    }

    return (
      list.find(
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


  function findProject(card) {
    const title =
      getCardTitle(card);

    if (
      card.closest(
        "#artCards"
      )
    ) {
      const project =
        findByTitle(
          artProjects,
          title
        );

      return project
        ? {
            project:
              project,

            type:
              "art"
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
          project:
            project,

          type:
            "priority"
        }
      : null;
  }


  /* =====================================================
     URL
  ===================================================== */

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


  /*
    최신 리서치 정보를
    Apps Script의 sync 모드로 함께 전달한다.

    Apps Script 쪽에서는
    기존 프로젝트를 찾은 뒤
    기관 / 공식마감 / NEXT ACTION /
    공고 URL을 최신값으로 갱신하게 된다.
  */
  function buildSyncUrl(
    project,
    type
  ) {
    const researchId =
      getResearchId(
        project,
        type
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


    /*
      localStorage에 Project ID가 있으면
      가장 정확하게 해당 행을 찾도록 전달.
    */
    if (
      state.projectId
    ) {
      params.set(
        "projectId",
        state.projectId
      );
    }


    /*
      프로젝트 식별용
    */
    params.set(
      "title",
      getTitle(project)
    );


    /*
      최신 리서치 정보
    */
    params.set(
      "institution",
      getAgency(project)
    );

    params.set(
      "deadline",
      getDeadline(project)
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


    /*
      필요할 경우 Apps Script에서
      우선순위도 참고 가능.
    */
    params.set(
      "priority",
      getPriority(
        project,
        type
      )
    );


    return (
      APP_URL +
      "?" +
      params.toString()
    );
  }


  /* =====================================================
     BUTTON TEXT
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
        "⭐ 지원 관리에 추가"
      );
    }

    const label =
      state.statusLabel ||
      statusLabel(
        state.status
      );

    const hasProgress =
      state.progress !==
        undefined &&
      state.progress !==
        null &&
      state.progress !== "";

    if (
      label &&
      hasProgress
    ) {
      return (
        "✓ 지원 관리 등록됨 · " +
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
        "✓ 지원 관리 등록됨 · " +
        label
      );
    }

    return (
      "✓ 지원 관리 등록됨"
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

    button.hidden =
      false;

    button.textContent =
      registered
        ? "↻ 상태 동기화"
        : "↻ 지원 상태 확인";
  }


  /* =====================================================
     BUTTON ACTION
  ===================================================== */

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
        setCaptureButtonState(
          button,
          researchId
        );
      },
      1200
    );
  }


  /*
    등록 여부와 무관하게
    Apps Script에서 Sheet 검색.

    동시에 GitHub의 최신
    공고 데이터도 전달한다.
  */
  function handleSync(
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

    button.textContent =
      "동기화 중...";

    window.location.href =
      buildSyncUrl(
        capture.project,
        capture.type
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

      .axoo-capture-button,
      .axoo-sync-button {
        appearance:none;
        min-height:38px;
        padding:0 15px;
        border-radius:999px;
        font:inherit;
        font-size:12px;
        font-weight:900;
        cursor:pointer;
      }

      .axoo-capture-button {
        border:1px solid #111;
        background:#111;
        color:#fff;
      }

      .axoo-capture-button:hover {
        opacity:.82;
      }

      .axoo-capture-button.registered {
        border-color:#d6d6d1;
        background:#f1f1ee;
        color:#444;
      }

      .axoo-capture-button.registered:hover {
        opacity:1;
        background:#e9e9e4;
      }

      .axoo-sync-button {
        border:1px solid #d6d6d1;
        background:#fff;
        color:#111;
      }

      .axoo-sync-button:hover {
        border-color:#111;
        background:#111;
        color:#fff;
      }

      @media (max-width:640px) {
        .axoo-capture-actions {
          flex-direction:column;
          align-items:stretch;
        }

        .axoo-capture-actions > .link,
        .axoo-capture-button,
        .axoo-sync-button {
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
     DECORATE CARD
  ===================================================== */

  function decorateCard(card) {
    const isPriority =
      card.classList.contains(
        "priority-accordion-card"
      );

    const isArt =
      Boolean(
        card.closest(
          "#artCards"
        )
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


    /* 지원 관리 버튼 */

    let captureButton =
      actions.querySelector(
        ".axoo-capture-button"
      );

    if (!captureButton) {
      captureButton =
        document.createElement(
          "button"
        );

      captureButton.type =
        "button";

      captureButton.className =
        "axoo-capture-button";

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
    }

    captureButton.dataset
      .researchId =
      researchId;

    setCaptureButtonState(
      captureButton,
      researchId
    );


    /* 상태 확인 / 동기화 버튼 */

    let syncButton =
      actions.querySelector(
        ".axoo-sync-button"
      );

    if (!syncButton) {
      syncButton =
        document.createElement(
          "button"
        );

      syncButton.type =
        "button";

      syncButton.className =
        "axoo-sync-button";

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
    }

    syncButton.dataset
      .researchId =
      researchId;

    setSyncButtonState(
      syncButton,
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
          setCaptureButtonState(
            button,
            button.dataset
              .researchId
          );
        }
      );

    document
      .querySelectorAll(
        ".axoo-sync-button[data-research-id]"
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
    MutationObserver는 사용하지 않는다.
    기존 페이지 정지 문제 방지.
  */
  function scheduleSafeDecorations() {
    [
      200,
      500,
      900,
      1500,
      2500,
      4000
    ].forEach(
      function (delay) {
        setTimeout(
          decorateAllCards,
          delay
        );
      }
    );
  }


  /* =====================================================
     INIT
  ===================================================== */

  async function init() {
    /*
      Apps Script에서 GitHub로
      돌아왔을 때 URL callback 처리
    */
    consumeRegistrationCallback();
    consumeSyncCallback();

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
        once: true
      }
    );

  } else {
    init();
  }

})();
