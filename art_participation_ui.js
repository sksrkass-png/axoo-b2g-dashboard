(() => {
  "use strict";


  // =========================================================
  // AXOO B2G
  // ART PARTICIPATION UI v1.0
  //
  // DATA
  // - data/art_participation_index.json
  // - data/art_participation_schema.json
  //
  // PURPOSE
  // - 건축물 미술작품 카드에
  //   AXOO 참여방식 표시
  //
  // - 참여방식 필터
  // - AXOO 참여 우선순위 정렬
  // - 판정 근거 표시
  //
  // SAFE LAYER
  // - app.js 수정 없음
  // - dashboard_priority_update.js 수정 없음
  // - art_commissions.json 수정 없음
  // =========================================================


  const INDEX_URL =
    "data/art_participation_index.json";


  const SCHEMA_URL =
    "data/art_participation_schema.json";


  const STORAGE_KEY =
    "axoo_art_entry_preferences_v1";


  const state = {

    index:
      null,

    schema:
      null,

    loaded:
      false,

    filter:
      "ALL",

    sort:
      "DEFAULT",

    controlsBound:
      false
  };


  // =========================================================
  // BASIC
  // =========================================================


  function esc(
    value
  ) {

    return String(
      value ?? ""
    ).replace(
      /[&<>"']/g,

      function (
        match
      ) {

        return {

          "&":
            "&amp;",

          "<":
            "&lt;",

          ">":
            "&gt;",

          "\"":
            "&quot;",

          "'":
            "&#039;"

        }[
          match
        ];
      }
    );
  }


  function normalizeTitle(
    value
  ) {

    return String(
      value || ""
    )
      .normalize(
        "NFKC"
      )
      .toLowerCase()
      .trim()
      .replace(
        /[^\p{L}\p{N}]+/gu,
        ""
      );
  }


  async function loadJson(
    url,
    fallback
  ) {

    try {

      const response =
        await fetch(
          `${url}?axooEntry=${Date.now()}`
        );


      if (
        !response.ok
      ) {

        throw new Error(
          `${url} HTTP ${response.status}`
        );
      }


      return await response.json();

    } catch (
      error
    ) {

      console.warn(
        "[AXOO Art Entry UI] JSON load failed",
        url,
        error
      );


      return fallback;
    }
  }


  // =========================================================
  // PREFERENCES
  // =========================================================


  function loadPreferences() {

    try {

      const raw =
        window.localStorage.getItem(
          STORAGE_KEY
        );


      if (
        !raw
      ) {

        return;
      }


      const saved =
        JSON.parse(
          raw
        );


      const allowedFilters = [
        "ALL",
        "DIRECT",
        "JOINT",
        "PROXY",
        "ARTIST_ONLY",
        "CHECK",
        "BLOCKED"
      ];


      if (
        allowedFilters.includes(
          saved.filter
        )
      ) {

        state.filter =
          saved.filter;
      }


      if (
        [
          "DEFAULT",
          "ENTRY"
        ].includes(
          saved.sort
        )
      ) {

        state.sort =
          saved.sort;
      }

    } catch (
      error
    ) {

      console.warn(
        "[AXOO Art Entry UI] preference load failed",
        error
      );
    }
  }


  function savePreferences() {

    try {

      window.localStorage.setItem(

        STORAGE_KEY,

        JSON.stringify({

          filter:
            state.filter,

          sort:
            state.sort
        })
      );

    } catch (
      error
    ) {

      console.warn(
        "[AXOO Art Entry UI] preference save failed",
        error
      );
    }
  }


  // =========================================================
  // DATA
  // =========================================================


  async function loadData() {

    if (
      state.loaded
    ) {

      return;
    }


    const [
      index,
      schema
    ] =
      await Promise.all([

        loadJson(
          INDEX_URL,
          null
        ),

        loadJson(
          SCHEMA_URL,
          null
        )
      ]);


    state.index =
      index;


    state.schema =
      schema;


    state.loaded =
      Boolean(
        index &&
        schema
      );


    if (
      !state.loaded
    ) {

      console.warn(
        "[AXOO Art Entry UI] participation data unavailable"
      );
    }
  }


  // =========================================================
  // SCHEMA
  // =========================================================


  function getModeLabel(
    mode
  ) {

    if (
      !state.schema
    ) {

      return mode;
    }


    return (
      state.schema
        ?.axoo_entry_mode
        ?.labels
        ?.[mode]
      ||
      mode
    );
  }


  function getModeIcon(
    mode
  ) {

    if (
      !state.schema
    ) {

      return "";
    }


    return (
      state.schema
        ?.axoo_entry_mode
        ?.icons
        ?.[mode]
      ||
      ""
    );
  }


  function getConfidenceLabel(
    value
  ) {

    return (
      state.schema
        ?.participation_confidence
        ?.labels
        ?.[value]
      ||
      value
      ||
      ""
    );
  }


  // =========================================================
  // MATCH
  // =========================================================


  function getTitleGroup(
    title
  ) {

    if (
      !state.index
    ) {

      return null;
    }


    const key =
      normalizeTitle(
        title
      );


    if (
      !key
    ) {

      return null;
    }


    return (
      state.index
        ?.byTitle
        ?.[key]
      ||
      null
    );
  }


  function getParticipation(
    title
  ) {

    const group =
      getTitleGroup(
        title
      );


    if (
      !group ||
      !group.participation
    ) {

      return null;
    }


    return {
      group,
      participation:
        group.participation
    };
  }


  // =========================================================
  // STYLE
  // =========================================================


  function injectStyle() {

    if (
      document.getElementById(
        "axooArtEntryStyle"
      )
    ) {

      return;
    }


    const style =
      document.createElement(
        "style"
      );


    style.id =
      "axooArtEntryStyle";


    style.textContent = `

      /* ================================================
         AXOO ENTRY FILTER
      ================================================ */

      #artEntryFilter,
      #artEntrySort {
        min-width: 150px;
      }


      /* ================================================
         ENTRY BADGE
      ================================================ */

      .axoo-entry-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
        font-weight: 900;
      }

      .axoo-entry-direct {
        background: #eaf2ff !important;
        color: #1457c7 !important;
        border-color: #bfd4ff !important;
      }

      .axoo-entry-joint {
        background: #f3edff !important;
        color: #7146bd !important;
        border-color: #d9c5ff !important;
      }

      .axoo-entry-proxy {
        background: #eaf8ef !important;
        color: #147943 !important;
        border-color: #bde3ca !important;
      }

      .axoo-entry-artist_only {
        background: #f3f3f1 !important;
        color: #55514c !important;
        border-color: #ddd9d3 !important;
      }

      .axoo-entry-check {
        background: #fff7db !important;
        color: #856600 !important;
        border-color: #ead88e !important;
      }

      .axoo-entry-blocked {
        background: #232323 !important;
        color: #ffffff !important;
        border-color: #232323 !important;
      }

      .axoo-entry-unanalysed {
        background: #f6f6f4 !important;
        color: #8a867f !important;
        border-color: #e4e1dc !important;
      }


      /* ================================================
         EVIDENCE
      ================================================ */

      .axoo-entry-evidence {
        margin: 12px 0 0;
        padding: 10px 12px;
        border: 1px solid #ece8e1;
        border-radius: 12px;
        background: #faf9f7;
        color: #625e58;
        font-size: 11px;
        line-height: 1.55;
      }

      .axoo-entry-evidence strong {
        display: inline-block;
        margin-right: 7px;
        color: #111111;
        font-size: 10px;
        font-weight: 950;
        letter-spacing: 0.04em;
      }

      .axoo-entry-evidence span {
        font-weight: 850;
      }

      .axoo-entry-evidence p {
        display: -webkit-box;
        margin: 5px 0 0;
        overflow: hidden;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        color: #746f68;
      }


      /* ================================================
         EMPTY
      ================================================ */

      .axoo-entry-empty {
        grid-column: 1 / -1;
      }


      @media (max-width: 720px) {

        #artEntryFilter,
        #artEntrySort {
          width: 100%;
          min-width: 0;
        }

      }
    `;


    document.head.appendChild(
      style
    );
  }


  // =========================================================
  // CONTROLS
  // =========================================================


  function buildFilterHtml() {

    const modes = [
      "DIRECT",
      "JOINT",
      "PROXY",
      "ARTIST_ONLY",
      "CHECK",
      "BLOCKED"
    ];


    return `
      <select
        id="artEntryFilter"
        aria-label="AXOO 참여방식 선택"
      >
        <option value="ALL">
          전체 참여방식
        </option>

        ${modes.map(
          function (
            mode
          ) {

            return `
              <option value="${esc(mode)}">
                ${esc(
                  `${getModeIcon(mode)} ${getModeLabel(mode)}`
                )}
              </option>
            `;
          }
        ).join("")}

      </select>
    `;
  }


  function buildSortHtml() {

    return `
      <select
        id="artEntrySort"
        aria-label="건축물 미술작품 정렬 선택"
      >
        <option value="DEFAULT">
          마감순
        </option>

        <option value="ENTRY">
          AXOO 참여 우선순
        </option>
      </select>
    `;
  }


  function ensureControls() {

    const filters =
      document.querySelector(
        "#artTab .research-filters"
      )
      ||
      document.querySelector(
        "#artTab .filters"
      );


    if (
      !filters
    ) {

      return;
    }


    if (
      !document.getElementById(
        "artEntryFilter"
      )
    ) {

      filters.insertAdjacentHTML(
        "beforeend",
        buildFilterHtml()
      );
    }


    if (
      !document.getElementById(
        "artEntrySort"
      )
    ) {

      filters.insertAdjacentHTML(
        "beforeend",
        buildSortHtml()
      );
    }


    const filter =
      document.getElementById(
        "artEntryFilter"
      );


    const sort =
      document.getElementById(
        "artEntrySort"
      );


    if (
      filter
    ) {

      filter.value =
        state.filter;
    }


    if (
      sort
    ) {

      sort.value =
        state.sort;
    }


    if (
      state.controlsBound
    ) {

      return;
    }


    state.controlsBound =
      true;


    if (
      filter
    ) {

      filter.addEventListener(
        "change",

        function () {

          state.filter =
            filter.value
            ||
            "ALL";


          savePreferences();


          applyUI();
        }
      );
    }


    if (
      sort
    ) {

      sort.addEventListener(
        "change",

        function () {

          state.sort =
            sort.value
            ||
            "DEFAULT";


          savePreferences();


          if (
            state.sort ===
              "DEFAULT" &&
            typeof window.renderArtCards ===
              "function"
          ) {

            window.renderArtCards();

            return;
          }


          applyUI();
        }
      );
    }
  }


  // =========================================================
  // CARD
  // =========================================================


  function isNativeEmptyCard(
    card
  ) {

    const title =
      card.querySelector(
        "h2"
      )
      ?.textContent
      ?.trim()
      ||
      "";


    return (
      title.includes(
        "조건에 맞는 건축물 미술작품 데이터가 없습니다"
      )
      ||
      title.includes(
        "건축물 미술작품 데이터가 없습니다"
      )
    );
  }


  function removeOldEntryUi(
    card
  ) {

    card
      .querySelectorAll(
        ".axoo-entry-badge"
      )
      .forEach(
        function (
          element
        ) {

          element.remove();
        }
      );


    card
      .querySelectorAll(
        ".axoo-entry-evidence"
      )
      .forEach(
        function (
          element
        ) {

          element.remove();
        }
      );
  }


  function createEntryBadge(
    mode
  ) {

    const badge =
      document.createElement(
        "span"
      );


    badge.className = [
      "badge",
      "axoo-entry-badge",
      `axoo-entry-${String(
        mode
      ).toLowerCase()}`
    ].join(
      " "
    );


    badge.textContent = [
      getModeIcon(
        mode
      ),

      getModeLabel(
        mode
      )
    ]
      .filter(
        Boolean
      )
      .join(
        " "
      );


    return badge;
  }


  function createUnanalysedBadge() {

    const badge =
      document.createElement(
        "span"
      );


    badge.className =
      "badge axoo-entry-badge axoo-entry-unanalysed";


    badge.textContent =
      "참여방식 미분석";


    return badge;
  }


  function createEvidence(
    participation
  ) {

    const wrapper =
      document.createElement(
        "div"
      );


    wrapper.className =
      "axoo-entry-evidence";


    const mode =
      participation
        .primary_axoo_entry_mode
      ||
      "CHECK";


    const confidence =
      getConfidenceLabel(
        participation
          .participation_confidence
      );


    const evidence =
      String(
        participation
          .participation_evidence
        ||
        ""
      ).trim();


    wrapper.innerHTML = `
      <strong>AXOO ENTRY</strong>

      <span>
        ${esc(
          getModeLabel(
            mode
          )
        )}
        ${confidence
          ? ` · ${esc(confidence)}`
          : ""}
      </span>

      ${evidence
        ? `<p>${esc(evidence)}</p>`
        : ""}
    `;


    return wrapper;
  }


  function decorateCard(
    card
  ) {

    if (
      isNativeEmptyCard(
        card
      )
    ) {

      return {
        matched:
          false,

        placeholder:
          true,

        mode:
          "UNANALYSED",

        modes:
          [],

        priority:
          999
      };
    }


    removeOldEntryUi(
      card
    );


    const title =
      card.querySelector(
        "h2"
      )
      ?.textContent
      ?.trim()
      ||
      "";


    const matched =
      getParticipation(
        title
      );


    const badges =
      card.querySelector(
        ".badges"
      );


    if (
      !matched
    ) {

      if (
        badges
      ) {

        badges.appendChild(
          createUnanalysedBadge()
        );
      }


      card.dataset.axooEntry =
        "UNANALYSED";


      card.dataset.axooEntryPriority =
        "85";


      return {

        matched:
          false,

        placeholder:
          false,

        mode:
          "UNANALYSED",

        modes:
          [],

        priority:
          85
      };
    }


    const participation =
      matched.participation;


    const primaryMode =
      participation
        .primary_axoo_entry_mode
      ||
      "CHECK";


    const modes =
      Array.isArray(
        participation
          .axoo_entry_mode
      )

        ? participation
            .axoo_entry_mode

        : [
            primaryMode
          ];


    const priority =
      Number(
        participation
          .entry_sort_priority
      );


    if (
      badges
    ) {

      const badge =
        createEntryBadge(
          primaryMode
        );


      const evidence =
        String(
          participation
            .participation_evidence
          ||
          ""
        ).trim();


      const confidence =
        getConfidenceLabel(
          participation
            .participation_confidence
        );


      badge.title =
        [
          getModeLabel(
            primaryMode
          ),

          confidence
            ? `신뢰도: ${confidence}`
            : "",

          evidence
        ]
          .filter(
            Boolean
          )
          .join(
            "\n"
          );


      badges.appendChild(
        badge
      );
    }


    const meta =
      card.querySelector(
        ".meta"
      );


    if (
      meta
    ) {

      meta.insertAdjacentElement(
        "afterend",
        createEvidence(
          participation
        )
      );
    }


    card.dataset.axooEntry =
      primaryMode;


    card.dataset.axooEntryModes =
      modes.join(
        ","
      );


    card.dataset.axooEntryPriority =
      Number.isFinite(
        priority
      )

        ? String(
            priority
          )

        : "80";


    return {

      matched:
        true,

      placeholder:
        false,

      mode:
        primaryMode,

      modes,

      priority:
        Number.isFinite(
          priority
        )
          ? priority
          : 80
    };
  }


  // =========================================================
  // FILTER
  // =========================================================


  function matchesEntryFilter(
    card
  ) {

    if (
      state.filter ===
      "ALL"
    ) {

      return true;
    }


    const modes =
      String(
        card.dataset
          .axooEntryModes
        ||
        ""
      )
        .split(
          ","
        )
        .filter(
          Boolean
        );


    if (
      modes.length
    ) {

      return modes.includes(
        state.filter
      );
    }


    return (
      card.dataset
        .axooEntry
      ===
      state.filter
    );
  }


  // =========================================================
  // SORT
  // =========================================================


  function sortByEntry(
    container,
    cards
  ) {

    if (
      state.sort !==
      "ENTRY"
    ) {

      return;
    }


    const sortable =
      cards.filter(
        function (
          card
        ) {

          return !isNativeEmptyCard(
            card
          );
        }
      );


    sortable.forEach(
      function (
        card,
        index
      ) {

        card.dataset
          .axooOriginalIndex =
          String(
            index
          );
      }
    );


    sortable.sort(
      function (
        a,
        b
      ) {

        const aPriority =
          Number(
            a.dataset
              .axooEntryPriority
            ||
            85
          );


        const bPriority =
          Number(
            b.dataset
              .axooEntryPriority
            ||
            85
          );


        if (
          aPriority !==
          bPriority
        ) {

          return (
            aPriority -
            bPriority
          );
        }


        return (
          Number(
            a.dataset
              .axooOriginalIndex
            ||
            0
          )
          -
          Number(
            b.dataset
              .axooOriginalIndex
            ||
            0
          )
        );
      }
    );


    sortable.forEach(
      function (
        card
      ) {

        container.appendChild(
          card
        );
      }
    );
  }


  // =========================================================
  // EMPTY
  // =========================================================


  function removeEntryEmpty() {

    document
      .querySelectorAll(
        ".axoo-entry-empty"
      )
      .forEach(
        function (
          element
        ) {

          element.remove();
        }
      );
  }


  function renderEntryEmpty(
    container
  ) {

    const card =
      document.createElement(
        "article"
      );


    card.className =
      "card axoo-entry-empty";


    card.innerHTML = `
      <h2>
        선택한 AXOO 참여방식에 맞는 공모가 없습니다.
      </h2>

      <p class="reason">
        참여방식 필터를 전체로 변경하거나 다른 참여 구조를 선택해 주세요.
      </p>
    `;


    container.appendChild(
      card
    );
  }


  // =========================================================
  // APPLY
  // =========================================================


  function applyUI() {

    if (
      !state.loaded
    ) {

      return;
    }


    injectStyle();

    ensureControls();

    removeEntryEmpty();


    const container =
      document.getElementById(
        "artCards"
      );


    if (
      !container
    ) {

      return;
    }


    const cards =
      Array.from(
        container.querySelectorAll(
          ":scope > article.card"
        )
      );


    if (
      !cards.length
    ) {

      return;
    }


    let visibleCount =
      0;


    cards.forEach(
      function (
        card
      ) {

        const result =
          decorateCard(
            card
          );


        if (
          result.placeholder
        ) {

          return;
        }


        const visible =
          matchesEntryFilter(
            card
          );


        card.style.display =
          visible
            ? ""
            : "none";


        if (
          visible
        ) {

          visibleCount +=
            1;
        }
      }
    );


    sortByEntry(
      container,
      cards
    );


    const hasRealCards =
      cards.some(
        function (
          card
        ) {

          return !isNativeEmptyCard(
            card
          );
        }
      );


    if (
      hasRealCards &&
      visibleCount === 0
    ) {

      renderEntryEmpty(
        container
      );
    }
  }


  // =========================================================
  // EVENTS
  // =========================================================


  function bindEvents() {

    window.addEventListener(
      "axoo:rendered",

      function () {

        setTimeout(
          applyUI,
          80
        );
      }
    );


    document.addEventListener(
      "click",

      function (
        event
      ) {

        const artTab =
          event.target.closest(
            ".tab-button[data-tab='art']"
          );


        if (
          !artTab
        ) {

          return;
        }


        setTimeout(
          applyUI,
          180
        );
      }
    );
  }


  // =========================================================
  // INIT
  // =========================================================


  async function init() {

    loadPreferences();

    injectStyle();

    bindEvents();

    await loadData();


    if (
      !state.loaded
    ) {

      return;
    }


    applyUI();


    // app.js 데이터 fetch 완료 시점 대비
    setTimeout(
      applyUI,
      350
    );


    setTimeout(
      applyUI,
      900
    );


    setTimeout(
      applyUI,
      1600
    );
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
