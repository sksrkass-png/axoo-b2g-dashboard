(() => {
  "use strict";

  const ART_DATA_URL = "data/art_commissions.json";

  const LEGACY_SELECTORS = [
    ".native-tab-intro-wrap",
    ".nationwide-source-inline",
    ".nationwide-source-board"
  ];

  let artData = [];
  let scheduled = false;
  let applying = false;


  /* =====================================================
     BASIC
  ===================================================== */

  function esc(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      ch => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[ch]
    );
  }


  function clean(
    value,
    fallback = "-"
  ) {
    const result =
      String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();

    return result || fallback;
  }


  function normalizeTitle(value) {
    return clean(
      value,
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
  }


  function setText(
    element,
    value
  ) {
    if (!element) {
      return;
    }

    const next =
      String(value);

    if (
      element.textContent !==
      next
    ) {
      element.textContent =
        next;
    }
  }


  /* =====================================================
     DATA
  ===================================================== */

  async function loadArtData() {
    try {
      const response =
        await fetch(
          `${ART_DATA_URL}?ui2=${Date.now()}`
        );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      artData =
        Array.isArray(data)
          ? data
          : [];

    } catch (error) {
      console.warn(
        "[AXOO UI v2] art data load failed",
        error
      );
    }
  }


  /* =====================================================
     LEGACY UI CLEANUP
  ===================================================== */

  function ensureRuntimeStyle() {
    if (
      document.getElementById(
        "axooDashboardUiV2RuntimeStyle"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "axooDashboardUiV2RuntimeStyle";

    style.textContent = `
      .native-tab-intro-wrap,
      .nationwide-source-inline,
      .nationwide-source-board {
        display: none !important;
      }
    `;

    document.head.appendChild(
      style
    );
  }


  function removeLegacyUi() {
    LEGACY_SELECTORS.forEach(
      selector => {

        document
          .querySelectorAll(
            selector
          )
          .forEach(
            node =>
              node.remove()
          );
      }
    );
  }


  /* =====================================================
     ACTIVE TAB
  ===================================================== */

  function getActiveTab() {
    return (
      document
        .querySelector(
          ".tab-button.active[data-tab]"
        )
        ?.dataset
        ?.tab ||
      "art"
    );
  }


  function getActivePanel() {
    return document
      .getElementById(
        `${getActiveTab()}Tab`
      );
  }


  /* =====================================================
     META
  ===================================================== */

  function getMetaValue(
    card,
    labels
  ) {
    const wanted =
      Array.isArray(labels)
        ? labels
        : [labels];

    const rows =
      card.querySelectorAll(
        ".meta div"
      );

    for (
      const row of rows
    ) {
      const labelNode =
        row.querySelector(
          "span"
        );

      const label =
        clean(
          labelNode?.textContent,
          ""
        );

      if (
        !wanted.includes(
          label
        )
      ) {
        continue;
      }

      return clean(
        clean(
          row.textContent,
          ""
        ).replace(
          label,
          ""
        ),
        "-"
      );
    }

    return "-";
  }


  /* =====================================================
     CARD
  ===================================================== */

  function getCardTitle(card) {
    return clean(
      card
        .querySelector(
          ".accordion-body h2"
        )
        ?.textContent ||

      card
        .querySelector(
          ".accordion-body h3"
        )
        ?.textContent ||

      card
        .querySelector(
          "h2"
        )
        ?.textContent ||

      card
        .querySelector(
          "h3"
        )
        ?.textContent,

      "제목 없음"
    );
  }


  function isEmptyCard(card) {
    const title =
      getCardTitle(
        card
      );

    return [
      "데이터가 없습니다",
      "조건에 맞는",
      "불러오는 중"
    ].some(
      keyword =>
        title.includes(
          keyword
        )
    );
  }


  function getGradeFromDom(
    card
  ) {
    const values = [
      card
        .querySelector(
          ".priority-grade"
        )
        ?.textContent,

      card
        .querySelector(
          ".summary-grade"
        )
        ?.textContent,

      ...Array
        .from(
          card.querySelectorAll(
            ".badge"
          )
        )
        .map(
          node =>
            node.textContent
        )
    ]
      .map(
        value =>
          clean(
            value,
            ""
          )
      );

    for (
      const value of
      values
    ) {
      const match =
        value.match(
          /\b(S|A|B|C)\b/i
        );

      if (match) {
        return match[1]
          .toUpperCase();
      }
    }

    return "";
  }


  /* =====================================================
     ART MATCH
  ===================================================== */

  function findArtItem(card) {
    const title =
      normalizeTitle(
        getCardTitle(
          card
        )
      );

    if (!title) {
      return null;
    }

    return (
      artData.find(
        item =>
          normalizeTitle(
            item.title ||
            item.noticeTitle ||
            item.projectName
          ) ===
          title
      ) ||
      null
    );
  }


  function getGrade(card) {
    const domGrade =
      getGradeFromDom(
        card
      );

    if (domGrade) {
      return domGrade;
    }

    const item =
      findArtItem(
        card
      );

    return clean(
      item?.grade,
      ""
    )
      .toUpperCase();
  }


  /* =====================================================
     SOURCE
  ===================================================== */

  function normalizeSource(value) {
    const source =
      clean(
        value,
        "-"
      );

    const regions = [
      "서울",
      "부산",
      "대구",
      "인천",
      "광주",
      "대전",
      "울산",
      "세종",
      "경기",
      "강원",
      "충북",
      "충남",
      "전북",
      "전남",
      "경북",
      "경남",
      "제주"
    ];

    for (
      const region of
      regions
    ) {
      if (
        source.includes(
          region
        )
      ) {
        return region;
      }
    }

    return source;
  }


  /* =====================================================
     SUMMARY DATA
  ===================================================== */

  function buildArtSummary(
    card
  ) {
    const item =
      findArtItem(
        card
      );

    const source =
      normalizeSource(
        item?.region ||

        getMetaValue(
          card,
          [
            "지역",
            "기관"
          ]
        ) ||

        card
          .querySelector(
            ".badge"
          )
          ?.textContent
      );

    return {
      source:
        source,

      grade:
        getGrade(
          card
        ),

      title:
        getCardTitle(
          card
        ),

      periodLabel:
        "공고일",

      period:
        clean(
          item?.publishedDate ||
          item?.postedDate ||

          getMetaValue(
            card,
            [
              "공고일",
              "공개일"
            ]
          )
        ),

      deadlineLabel:
        "마감일",

      deadline:
        clean(
          item?.deadline ||
          item?.periodEnd ||
          item?.endDate ||

          getMetaValue(
            card,
            "마감일"
          )
        )
    };
  }


  function buildGenericSummary(
    card,
    tab
  ) {
    if (
      tab ===
      "agencies"
    ) {
      return {
        source:
          clean(
            getMetaValue(
              card,
              [
                "기관유형",
                "구분"
              ]
            )
          ),

        grade:
          getGrade(
            card
          ),

        title:
          getCardTitle(
            card
          ),

        periodLabel:
          "지역",

        period:
          clean(
            getMetaValue(
              card,
              "지역"
            )
          ),

        deadlineLabel:
          "관련 이력",

        deadline:
          clean(
            card
              .querySelector(
                ".score"
              )
              ?.textContent
          )
      };
    }


    if (
      tab ===
      "local"
    ) {
      return {
        source:
          clean(
            getMetaValue(
              card,
              [
                "공고기관",
                "출처"
              ]
            )
          ),

        grade:
          getGrade(
            card
          ),

        title:
          getCardTitle(
            card
          ),

        periodLabel:
          "계약방법",

        period:
          clean(
            getMetaValue(
              card,
              "계약방법"
            )
          ),

        deadlineLabel:
          "마감 / 개찰",

        deadline:
          clean(
            getMetaValue(
              card,
              [
                "마감/개찰",
                "마감 / 개찰"
              ]
            )
          )
      };
    }


    return {
      source:
        tab ===
        "opportunities"
          ? "나라장터"
          : clean(
              card
                .querySelector(
                  ".badge"
                )
                ?.textContent
            ),

      grade:
        getGrade(
          card
        ),

      title:
        getCardTitle(
          card
        ),

      periodLabel:
        "게재기간",

      period:
        clean(
          getMetaValue(
            card,
            [
              "게재기간",
              "게재일",
              "공고일"
            ]
          )
        ),

      deadlineLabel:
        "마감일",

      deadline:
        clean(
          getMetaValue(
            card,
            [
              "마감일",
              "마감/개찰"
            ]
          )
        )
    };
  }


  function getSummary(
    card,
    tab
  ) {
    return (
      tab === "art"
        ? buildArtSummary(
            card
          )
        : buildGenericSummary(
            card,
            tab
          )
    );
  }


  /* =====================================================
     ACCORDION
  ===================================================== */

  function convertCardToAccordion(
    card,
    tab
  ) {
    if (
      !card ||
      isEmptyCard(
        card
      ) ||
      card.classList.contains(
        "card-as-accordion"
      )
    ) {
      return;
    }

    const info =
      getSummary(
        card,
        tab
      );

    const details =
      document.createElement(
        "details"
      );

    const body =
      document.createElement(
        "div"
      );

    details.className =
      "accordion-card";

    body.className =
      "accordion-body";


    while (
      card.firstChild
    ) {
      body.appendChild(
        card.firstChild
      );
    }


    details.innerHTML = `
      <summary class="accordion-summary">

        <span class="summary-source-wrap">

          <span class="summary-source">
            ${esc(info.source)}
          </span>

          ${
            info.grade
              ? `
                <span class="summary-grade">
                  ${esc(info.grade)}
                </span>
              `
              : ""
          }

        </span>


        <span class="summary-title">
          ${esc(info.title)}
        </span>


        <span class="summary-period">

          <span>
            ${esc(info.periodLabel)}
          </span>

          <strong>
            ${esc(info.period)}
          </strong>

        </span>


        <span class="summary-deadline">

          <span>
            ${esc(info.deadlineLabel)}
          </span>

          <strong>
            ${esc(info.deadline)}
          </strong>

        </span>

      </summary>
    `;


    details.appendChild(
      body
    );


    if (
      tab ===
      "art"
    ) {
      details.open =
        false;
    }


    card.classList.add(
      "card-as-accordion"
    );

    card.appendChild(
      details
    );
  }


  function setupAccordions() {
    const map = {
      art:
        "artCards",

      opportunities:
        "cards",

      local:
        "localCards",

      agencies:
        "agencyCards"
    };


    Object.entries(
      map
    ).forEach(
      (
        [
          tab,
          id
        ]
      ) => {

        const container =
          document.getElementById(
            id
          );

        if (!container) {
          return;
        }


        Array
          .from(
            container.children
          )
          .forEach(
            card => {

              if (
                card.classList
                  ?.contains(
                    "card"
                  )
              ) {
                convertCardToAccordion(
                  card,
                  tab
                );
              }
            }
          );
      }
    );
  }


  /* =====================================================
     ART LIST HEAD
  ===================================================== */

  function normalizeArtListHead() {
    const head =
      document.querySelector(
        "#artTab .list-head"
      );

    if (!head) {
      return;
    }


    const html = `
      <span class="list-source-grade">
        <em>출처</em>
        <em>우선순위</em>
      </span>

      <span>
        공모명
      </span>

      <span>
        공고일
      </span>

      <span>
        마감일
      </span>
    `;


    if (
      head.innerHTML
        .replace(
          /\s+/g,
          " "
        )
        .trim() !==

      html
        .replace(
          /\s+/g,
          " "
        )
        .trim()
    ) {
      head.innerHTML =
        html;
    }
  }


  /* =====================================================
     DATE
  ===================================================== */

  function parseDate(value) {
    const raw =
      clean(
        value,
        ""
      );

    const match =
      raw.match(
        /(20\d{2})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/
      );

    if (!match) {
      return null;
    }


    const date =
      new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      );


    return (
      Number.isNaN(
        date.getTime()
      )
        ? null
        : date
    );
  }


  function getDeadlineDays(
    card
  ) {
    const item =
      findArtItem(
        card
      );


    const raw =
      item?.deadline ||

      card
        .querySelector(
          ".summary-deadline strong"
        )
        ?.textContent ||

      getMetaValue(
        card,
        [
          "마감일",
          "마감/개찰",
          "마감 / 개찰"
        ]
      );


    const deadline =
      parseDate(
        raw
      );

    if (!deadline) {
      return null;
    }


    const today =
      new Date();


    today.setHours(
      0,
      0,
      0,
      0
    );


    deadline.setHours(
      0,
      0,
      0,
      0
    );


    return Math.ceil(
      (
        deadline.getTime() -
        today.getTime()
      ) /
      86400000
    );
  }


  /* =====================================================
     TODAY KPI
  ===================================================== */

  function getVisibleCards() {
    const panel =
      getActivePanel();

    if (!panel) {
      return [];
    }


    return Array
      .from(
        panel.querySelectorAll(
          ".card, .priority-accordion-card, .priority-project-card"
        )
      )
      .filter(
        card => {

          if (
            isEmptyCard(
              card
            )
          ) {
            return false;
          }


          const style =
            window.getComputedStyle(
              card
            );


          return (
            style.display !==
              "none" &&

            style.visibility !==
              "hidden"
          );
        }
      );
  }


  function updateToday() {
    const labels = [
      [
        "진행중",
        "ACTIVE"
      ],

      [
        "마감임박",
        "D-7"
      ],

      [
        "HIGH",
        "PRIORITY"
      ],

      [
        "검토중",
        "REVIEW"
      ]
    ];


    document
      .querySelectorAll(
        ".today-grid .summary-card"
      )
      .forEach(
        (
          card,
          index
        ) => {

          const config =
            labels[
              index
            ];

          if (!config) {
            return;
          }


          setText(
            card.querySelector(
              "span"
            ),
            config[0]
          );


          setText(
            card.querySelector(
              "small"
            ),
            config[1]
          );
        }
      );


    const cards =
      getVisibleCards();


    const soon =
      cards.filter(
        card => {

          const days =
            getDeadlineDays(
              card
            );

          return (
            days !== null &&
            days >= 0 &&
            days <= 7
          );
        }
      ).length;


    const high =
      cards.filter(
        card =>
          [
            "S",
            "A"
          ].includes(
            getGrade(
              card
            )
          )
      ).length;


    const reviewing =
      cards.filter(
        card =>
          card
            .querySelector(
              ".review-select"
            )
            ?.value ===
          "reviewing"
      ).length;


    setText(
      document.getElementById(
        "totalCount"
      ),
      cards.length
    );


    setText(
      document.getElementById(
        "sCount"
      ),
      soon
    );


    setText(
      document.getElementById(
        "aCount"
      ),
      high
    );


    setText(
      document.getElementById(
        "bCount"
      ),
      reviewing
    );
  }


  /* =====================================================
     APPLY
  ===================================================== */

  function applyV2() {
    if (applying) {
      return;
    }

    applying =
      true;


    try {
      ensureRuntimeStyle();

      removeLegacyUi();

      normalizeArtListHead();

      setupAccordions();

      updateToday();

    } finally {
      applying =
        false;
    }
  }


  function scheduleApply(
    delay = 80
  ) {
    if (scheduled) {
      return;
    }


    scheduled =
      true;


    setTimeout(
      () => {

        scheduled =
          false;

        applyV2();

      },
      delay
    );
  }


  /* =====================================================
     EVENTS
  ===================================================== */

  function bindEvents() {
    document.addEventListener(
      "click",
      event => {

        if (
          event.target.closest(
            ".tab-button[data-tab]"
          ) ||

          event.target.closest(
            ".meta-card[data-tab-target]"
          )
        ) {
          scheduleApply(
            120
          );

          setTimeout(
            applyV2,
            350
          );
        }
      }
    );


    document.addEventListener(
      "input",
      event => {

        if (
          event.target.closest(
            ".filters"
          )
        ) {
          scheduleApply(
            160
          );
        }
      }
    );


    document.addEventListener(
      "change",
      event => {

        if (
          event.target.closest(
            ".filters"
          ) ||

          event.target
            .classList
            .contains(
              "review-select"
            )
        ) {
          scheduleApply(
            160
          );
        }
      }
    );


    window.addEventListener(
      "axoo:rendered",
      () => {

        scheduleApply(
          80
        );


        setTimeout(
          applyV2,
          260
        );
      }
    );
  }


  /* =====================================================
     OBSERVER
  ===================================================== */

  function startObserver() {
    if (
      window
        .__axooUiV2Observer
    ) {
      return;
    }


    const observer =
      new MutationObserver(
        mutations => {

          const added =
            mutations.some(
              mutation =>
                mutation.type ===
                  "childList" &&
                mutation
                  .addedNodes
                  .length >
                  0
            );


          if (added) {
            scheduleApply(
              90
            );
          }
        }
      );


    observer.observe(
      document.body,
      {
        childList:
          true,

        subtree:
          true
      }
    );


    window
      .__axooUiV2Observer =
      observer;
  }


  /* =====================================================
     INIT
  ===================================================== */

  async function init() {
    ensureRuntimeStyle();

    bindEvents();

    startObserver();


    await loadArtData();


    applyV2();


    [
      350,
      900,
      1800,
      4000,
      7000
    ].forEach(
      delay =>
        setTimeout(
          applyV2,
          delay
        )
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
