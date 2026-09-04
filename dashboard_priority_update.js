(function () {
  "use strict";

  const PRIORITY_DATA_URL = "data/priority_projects.json";

  const TAB_CONFIG = [
    {
      tab: "art",
      label: "건축물 미술작품",
      icon: "💙",
      type: "native"
    },
    {
      tab: "mural",
      label: "벽화 & 조형물",
      icon: "🧱",
      type: "priority",
      category: "mural_sculpture",
      description:
        "벽화, 옹벽 개선, 조형물, 공공미술, 포토존, 아트월 계열 공고를 모아봅니다.",
      sources: [
        "나라장터 입찰공고",
        "지자체·공공기관 공고",
        "AXOO 우선 키워드 분류"
      ]
    },
    {
      tab: "exhibition",
      label: "전시 콘텐츠 기획 운영",
      icon: "🖼️",
      type: "priority",
      category: "exhibition_content",
      description:
        "시각예술 전시, 전시연출, 전시물 제작, 실감콘텐츠, 미디어아트 계열 공고를 모아봅니다.",
      sources: [
        "나라장터 입찰공고",
        "전시·미디어아트 키워드 매칭",
        "AXOO 우선 검토 기준"
      ]
    },
    {
      tab: "support",
      label: "예술·콘텐츠 지원사업",
      icon: "✨",
      type: "priority",
      category: "arts_content_support",
      description:
        "AXOO가 실제 기업·법인·사업자로 검토할 수 있는 예술·콘텐츠 지원사업을 모아봅니다.",
      sources: [
        "KAMS · 예술경영지원센터",
        "ARKO · 한국문화예술위원회",
        "KCDF · 한국공예·디자인문화진흥원",
        "KOCCA · 한국콘텐츠진흥원"
      ]
    },
    {
      tab: "other",
      label: "기타 AXOO 핏",
      icon: "📂",
      type: "priority",
      category: "other",
      description:
        "비주얼 제작, 브랜딩, 영상 제작, 팝업, 굿즈 등 AXOO 서브 핏이 있는 기타 공고를 모아봅니다.",
      sources: [
        "나라장터 입찰공고",
        "지자체 개별 공고",
        "AXOO 서브 키워드 분류"
      ]
    },
    {
      tab: "agencies",
      label: "기관 타깃",
      icon: "🎯",
      type: "native"
    }
  ];

  const SUPPORT_SOURCE_FILTERS = [
    {
      code: "ALL",
      label: "전체"
    },
    {
      code: "KAMS",
      label: "KAMS"
    },
    {
      code: "ARKO",
      label: "ARKO"
    },
    {
      code: "KCDF",
      label: "KCDF"
    },
    {
      code: "KOCCA",
      label: "KOCCA"
    }
  ];

  const SUPPORT_QUICK_FILTERS = [
    {
      code: "ALL",
      label: "전체"
    },
    {
      code: "RECENT",
      label: "NEW·최근"
    },
    {
      code: "D7",
      label: "D-7 이내"
    },
    {
      code: "B_PLUS",
      label: "B 이상"
    }
  ];

  const GRADE_ORDER = {
    S: 0,
    A: 1,
    B: 2,
    C: 3,
    HOLD: 9
  };

  const state = {
    projects: [],
    loaded: false,
    currentTab: "art",
    supportSource: "ALL",
    supportQuick: "ALL",
    supportQuery: "",
    supportInteracted: false
  };

  function $(
    selector,
    root = document
  ) {
    return root.querySelector(
      selector
    );
  }

  function $all(
    selector,
    root = document
  ) {
    return Array.from(
      root.querySelectorAll(
        selector
      )
    );
  }

  function esc(value) {
    return String(
      value ?? ""
    ).replace(
      /[&<>"']/g,
      function (match) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
        }[match];
      }
    );
  }

  function formatCount(value) {
    return Number(
      value || 0
    ).toLocaleString(
      "ko-KR"
    );
  }

  function formatKrw(value) {
    const amount =
      Number(
        value || 0
      );

    if (!amount) {
      return "예산 미확인";
    }

    if (
      amount >= 100000000
    ) {
      const eok =
        amount / 100000000;

      return `${eok.toFixed(
        eok >= 10
          ? 0
          : 1
      )}억`;
    }

    if (
      amount >= 10000
    ) {
      return `${Math.round(
        amount / 10000
      ).toLocaleString(
        "ko-KR"
      )}만원`;
    }

    return `${amount.toLocaleString(
      "ko-KR"
    )}원`;
  }

  function compactDate(value) {
    const valueText =
      String(
        value || ""
      ).trim();

    if (!valueText) {
      return "확인 필요";
    }

    const match =
      valueText.match(
        /\d{4}[-.]\d{1,2}[-.]\d{1,2}/
      );

    return match
      ? match[0].replace(
          /\./g,
          "-"
        )
      : valueText;
  }

  function normalizeUrl(url) {
    const value =
      String(
        url || ""
      ).trim();

    if (!value) {
      return "";
    }

    if (
      value.startsWith(
        "http://"
      ) ||
      value.startsWith(
        "https://"
      )
    ) {
      return value;
    }

    return "";
  }

  /* =========================================================
     DATE
  ========================================================= */

  function getSeoulTodayKey() {
    const parts =
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            "Asia/Seoul",

          year:
            "numeric",

          month:
            "2-digit",

          day:
            "2-digit"
        }
      ).formatToParts(
        new Date()
      );

    const values =
      {};

    parts.forEach(
      function (part) {
        values[
          part.type
        ] =
          part.value;
      }
    );

    if (
      !values.year ||
      !values.month ||
      !values.day
    ) {
      return "";
    }

    return [
      values.year,
      values.month,
      values.day
    ].join("-");
  }

  function normalizeDateKey(value) {
    const raw =
      String(
        value || ""
      ).trim();

    const match =
      raw.match(
        /(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/
      );

    if (!match) {
      return "";
    }

    const year =
      Number(
        match[1]
      );

    const month =
      Number(
        match[2]
      );

    const day =
      Number(
        match[3]
      );

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return "";
    }

    return [
      String(year),

      String(month)
        .padStart(
          2,
          "0"
        ),

      String(day)
        .padStart(
          2,
          "0"
        )
    ].join("-");
  }

  function dateKeyToUtcTime(
    dateKey
  ) {
    const match =
      String(
        dateKey || ""
      ).match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

    if (!match) {
      return NaN;
    }

    return Date.UTC(
      Number(
        match[1]
      ),

      Number(
        match[2]
      ) - 1,

      Number(
        match[3]
      )
    );
  }

  function getDaysUntilDate(
    dateValue
  ) {
    const targetKey =
      normalizeDateKey(
        dateValue
      );

    const todayKey =
      getSeoulTodayKey();

    if (
      !targetKey ||
      !todayKey
    ) {
      return null;
    }

    const targetTime =
      dateKeyToUtcTime(
        targetKey
      );

    const todayTime =
      dateKeyToUtcTime(
        todayKey
      );

    if (
      !Number.isFinite(
        targetTime
      ) ||
      !Number.isFinite(
        todayTime
      )
    ) {
      return null;
    }

    return Math.round(
      (
        targetTime -
        todayTime
      ) /
      86400000
    );
  }

  function getDaysSinceDate(
    dateValue
  ) {
    const targetKey =
      normalizeDateKey(
        dateValue
      );

    const todayKey =
      getSeoulTodayKey();

    if (
      !targetKey ||
      !todayKey
    ) {
      return null;
    }

    const targetTime =
      dateKeyToUtcTime(
        targetKey
      );

    const todayTime =
      dateKeyToUtcTime(
        todayKey
      );

    if (
      !Number.isFinite(
        targetTime
      ) ||
      !Number.isFinite(
        todayTime
      )
    ) {
      return null;
    }

    return Math.round(
      (
        todayTime -
        targetTime
      ) /
      86400000
    );
  }

  /* =========================================================
     DATA
  ========================================================= */

  function getTabConfig(tab) {
    return TAB_CONFIG.find(
      function (item) {
        return (
          item.tab === tab
        );
      }
    );
  }

  function extractProjects(data) {
    if (
      Array.isArray(
        data
      )
    ) {
      return data;
    }

    if (
      data &&
      Array.isArray(
        data.projects
      )
    ) {
      return data.projects;
    }

    if (
      data &&
      Array.isArray(
        data.items
      )
    ) {
      return data.items;
    }

    if (
      data &&
      Array.isArray(
        data.data
      )
    ) {
      return data.data;
    }

    return [];
  }

  async function loadPriorityProjects() {
    if (
      state.loaded
    ) {
      return state.projects;
    }

    try {
      const response =
        await fetch(
          `${PRIORITY_DATA_URL}?v=${Date.now()}`
        );

      if (
        !response.ok
      ) {
        throw new Error(
          `priority_projects.json load failed: ${response.status}`
        );
      }

      const data =
        await response.json();

      state.projects =
        extractProjects(
          data
        );

      state.loaded =
        true;

      return state.projects;
    }

    catch (error) {
      console.warn(
        "[AXOO Priority] priority_projects.json load failed",
        error
      );

      state.projects =
        [];

      state.loaded =
        true;

      return state.projects;
    }
  }

  /* =========================================================
     PROJECT GETTERS
  ========================================================= */

  function getProjectCategory(project) {
    return (
      project.priorityCategory ||
      project.category ||
      project.categoryKey ||
      ""
    );
  }

  function getProjectScore(project) {
    return Number(
      project.score ||
      project.axooFitScore ||
      project.priorityScore ||
      0
    );
  }

  function getProjectGrade(project) {
    if (
      project.grade
    ) {
      return project.grade;
    }

    const score =
      getProjectScore(
        project
      );

    if (
      score >= 85
    ) {
      return "S";
    }

    if (
      score >= 70
    ) {
      return "A";
    }

    if (
      score >= 50
    ) {
      return "B";
    }

    return "C";
  }

  function getProjectAmount(project) {
    return Number(
      project.amount ||
      project.budget ||
      project.supportAmount ||
      project.budgetAmount ||
      project.asignBdgtAmt ||
      project.presmptPrce ||
      0
    );
  }

  function getProjectDeadline(project) {
    return (
      project.deadline ||
      project.endDate ||
      project.bidNtceEndDt ||
      project.deadlineDate ||
      project.closeDate ||
      ""
    );
  }

  function getProjectPublishedDate(
    project
  ) {
    return (
      project.publishedDate ||
      project.postedDate ||
      project.startDate ||
      project.bidNtceDt ||
      ""
    );
  }

  function getProjectAgency(project) {
    return (
      project.agency ||
      project.organization ||
      project.ntceInsttNm ||
      project.dminsttNm ||
      project.noticeAgency ||
      project.demandAgency ||
      "기관 미확인"
    );
  }

  function getSupportSourceCode(
    project
  ) {
    return String(
      project.sourceCode ||
      ""
    )
      .trim()
      .toUpperCase();
  }

  function getSupportSourceName(
    project
  ) {
    return (
      project.source ||
      project.organization ||
      project.agency ||
      "기관 미확인"
    );
  }

  function getProjectKeywords(
    project
  ) {
    let keywords =
      [];

    if (
      Array.isArray(
        project.matchedPriorityKeywords
      )
    ) {
      keywords =
        project.matchedPriorityKeywords;
    }

    else if (
      Array.isArray(
        project.matchedKeywords
      )
    ) {
      keywords =
        project.matchedKeywords;
    }

    else if (
      Array.isArray(
        project.keywords
      )
    ) {
      keywords =
        project.keywords;
    }

    else if (
      project.field
    ) {
      keywords =
        String(
          project.field
        )
          .split("/")
          .map(
            function (item) {
              return item.trim();
            }
          )
          .filter(
            Boolean
          );
    }

    return [
      ...new Set(
        keywords
          .map(
            function (item) {
              return String(
                item || ""
              ).trim();
            }
          )
          .filter(
            Boolean
          )
      )
    ];
  }

  function getSupportFieldLabel(
    project
  ) {
    const keywords =
      getProjectKeywords(
        project
      );

    if (
      keywords.length
    ) {
      return keywords
        .slice(
          0,
          3
        )
        .join(
          " · "
        );
    }

    if (
      project.field
    ) {
      return String(
        project.field
      );
    }

    return "지원사업";
  }

  function getAccordionCategoryLabel(
    project,
    tab
  ) {
    if (
      tab === "support"
    ) {
      return getSupportFieldLabel(
        project
      );
    }

    return (
      project.priorityCategoryLabel ||
      project.categoryLabel ||
      project.field ||
      "기타 AXOO 핏"
    );
  }

  function getSummarySourceLabel(
    project,
    tab
  ) {
    if (
      tab === "support"
    ) {
      return (
        getSupportSourceCode(
          project
        ) ||
        getSupportSourceName(
          project
        )
      );
    }

    return (
      project.sourceType ||
      project.source ||
      project.sourceName ||
      "출처 미확인"
    );
  }

  function getSummarySourceTitle(
    project,
    tab
  ) {
    if (
      tab === "support"
    ) {
      return getSupportSourceName(
        project
      );
    }

    return getSummarySourceLabel(
      project,
      tab
    );
  }

  /* =========================================================
     D-DAY
  ========================================================= */

  function getDeadlineStatus(
    project
  ) {
    const days =
      getDaysUntilDate(
        getProjectDeadline(
          project
        )
      );

    if (
      days === null
    ) {
      return {
        days: null,
        expired: false,
        urgent: false,
        label: "마감 확인"
      };
    }

    if (
      days < 0
    ) {
      return {
        days,
        expired: true,
        urgent: false,
        label: "마감 종료"
      };
    }

    if (
      days === 0
    ) {
      return {
        days,
        expired: false,
        urgent: true,
        label: "오늘 마감"
      };
    }

    if (
      days <= 3
    ) {
      return {
        days,
        expired: false,
        urgent: true,
        label:
          `D-${days} · 마감 임박`
      };
    }

    return {
      days,
      expired: false,
      urgent: false,
      label:
        `D-${days}`
    };
  }

  function isProjectDeadlineExpired(
    project
  ) {
    return getDeadlineStatus(
      project
    ).expired;
  }

  function renderDeadlineBadge(
    project
  ) {
    const status =
      getDeadlineStatus(
        project
      );

    if (
      status.days === null
    ) {
      return "";
    }

    const background =
      status.urgent
        ? "#171717"
        : "#f2f2f2";

    const color =
      status.urgent
        ? "#ffffff"
        : "#555555";

    const border =
      status.urgent
        ? "#171717"
        : "#dedede";

    return `
      <span
        style="
          display:inline-flex;
          align-items:center;
          justify-content:center;
          margin-top:5px;
          padding:4px 7px;
          border:1px solid ${border};
          border-radius:999px;
          background:${background};
          color:${color};
          font-size:10px;
          font-weight:700;
          line-height:1;
          white-space:nowrap;
        "
      >
        ${esc(
          status.label
        )}
      </span>
    `;
  }

  /* =========================================================
     RECENT / NEW
  ========================================================= */

  function getRecentStatus(
    project
  ) {
    const days =
      getDaysSinceDate(
        getProjectPublishedDate(
          project
        )
      );

    if (
      days === null ||
      days < 0
    ) {
      return {
        type: "",
        days: null,
        label: ""
      };
    }

    if (
      days <= 3
    ) {
      return {
        type: "new",
        days,
        label: "NEW"
      };
    }

    if (
      days <= 7
    ) {
      return {
        type: "recent",
        days,
        label: "최근 등록"
      };
    }

    return {
      type: "",
      days,
      label: ""
    };
  }

  function renderRecentBadge(
    project
  ) {
    const status =
      getRecentStatus(
        project
      );

    if (
      !status.type
    ) {
      return "";
    }

    if (
      status.type === "new"
    ) {
      return `
        <span
          title="최근 3일 이내 등록"
          style="
            display:inline-flex;
            align-items:center;
            margin-left:7px;
            padding:3px 6px;
            border:1px solid #b9e2c8;
            border-radius:999px;
            background:#eaf7ef;
            color:#166534;
            font-size:9px;
            font-weight:800;
            line-height:1;
            vertical-align:middle;
            white-space:nowrap;
          "
        >
          NEW
        </span>
      `;
    }

    return `
      <span
        title="최근 7일 이내 등록"
        style="
          display:inline-flex;
          align-items:center;
          margin-left:7px;
          padding:3px 6px;
          border:1px solid #dedede;
          border-radius:999px;
          background:#f5f5f5;
          color:#666666;
          font-size:9px;
          font-weight:700;
          line-height:1;
          vertical-align:middle;
          white-space:nowrap;
        "
      >
        최근 등록
      </span>
    `;
  }

  function countNewProjects(
    projects
  ) {
    return projects.filter(
      function (project) {
        return (
          getRecentStatus(
            project
          ).type === "new"
        );
      }
    ).length;
  }

  /* =========================================================
     SORT / BASE FILTER
  ========================================================= */

  function sortProjects(
    projects
  ) {
    return [
      ...projects
    ].sort(
      function (
        a,
        b
      ) {
        const gradeDiff =
          (
            GRADE_ORDER[
              getProjectGrade(a)
            ] ?? 9
          ) -
          (
            GRADE_ORDER[
              getProjectGrade(b)
            ] ?? 9
          );

        if (
          gradeDiff !== 0
        ) {
          return gradeDiff;
        }

        const scoreDiff =
          getProjectScore(b) -
          getProjectScore(a);

        if (
          scoreDiff !== 0
        ) {
          return scoreDiff;
        }

        const amountDiff =
          getProjectAmount(b) -
          getProjectAmount(a);

        if (
          amountDiff !== 0
        ) {
          return amountDiff;
        }

        return String(
          getProjectDeadline(a) ||
          "9999-99-99"
        ).localeCompare(
          String(
            getProjectDeadline(b) ||
            "9999-99-99"
          )
        );
      }
    );
  }

  function getDisplayProjectsByCategory(
    category
  ) {
    return sortProjects(
      state.projects.filter(
        function (project) {
          if (
            getProjectCategory(
              project
            ) !== category
          ) {
            return false;
          }

          if (
            project.isExcludedFromPriority === true
          ) {
            return false;
          }

          if (
            category ===
              "arts_content_support" &&
            isProjectDeadlineExpired(
              project
            )
          ) {
            return false;
          }

          return true;
        }
      )
    );
  }

  /* =========================================================
     SUPPORT SEARCH / QUICK FILTER
  ========================================================= */

  function filterSupportBySource(
    projects
  ) {
    if (
      state.supportSource === "ALL"
    ) {
      return projects;
    }

    return projects.filter(
      function (project) {
        return (
          getSupportSourceCode(
            project
          ) ===
          state.supportSource
        );
      }
    );
  }

  function getSupportSearchText(
    project
  ) {
    return [
      project.title,
      project.bidNtceNm,
      project.projectName,
      project.source,
      project.sourceCode,
      project.organization,
      project.agency,
      project.field,
      getSupportFieldLabel(
        project
      ),
      getProjectKeywords(
        project
      ).join(" "),
      project.gradeReason,
      project.axooFitReason
    ]
      .filter(
        Boolean
      )
      .join(" ")
      .toLowerCase();
  }

  function filterSupportByQuery(
    projects
  ) {
    const query =
      String(
        state.supportQuery ||
        ""
      )
        .trim()
        .toLowerCase();

    if (
      !query
    ) {
      return projects;
    }

    return projects.filter(
      function (project) {
        return getSupportSearchText(
          project
        ).includes(
          query
        );
      }
    );
  }

  function matchesSupportQuickFilter(
    project,
    code
  ) {
    if (
      code === "ALL"
    ) {
      return true;
    }

    if (
      code === "RECENT"
    ) {
      const type =
        getRecentStatus(
          project
        ).type;

      return (
        type === "new" ||
        type === "recent"
      );
    }

    if (
      code === "D7"
    ) {
      const days =
        getDeadlineStatus(
          project
        ).days;

      return (
        days !== null &&
        days >= 0 &&
        days <= 7
      );
    }

    if (
      code === "B_PLUS"
    ) {
      return [
        "S",
        "A",
        "B"
      ].includes(
        getProjectGrade(
          project
        )
      );
    }

    return true;
  }

  function filterSupportByQuick(
    projects,
    code = state.supportQuick
  ) {
    return projects.filter(
      function (project) {
        return matchesSupportQuickFilter(
          project,
          code
        );
      }
    );
  }

  function getSupportFilterContext() {
    const all =
      getDisplayProjectsByCategory(
        "arts_content_support"
      );

    const bySource =
      filterSupportBySource(
        all
      );

    const bySourceAndQuery =
      filterSupportByQuery(
        bySource
      );

    const final =
      filterSupportByQuick(
        bySourceAndQuery
      );

    return {
      all,
      bySource,
      bySourceAndQuery,
      final
    };
  }

  function getProjectsForTab(
    tab,
    category
  ) {
    if (
      tab !== "support"
    ) {
      return getDisplayProjectsByCategory(
        category
      );
    }

    return getSupportFilterContext()
      .final;
  }

  function getExcludedProjects() {
    return state.projects.filter(
      function (project) {
        return (
          project.isExcludedFromPriority === true
        );
      }
    );
  }

  function getExcludedProjectsByCategory(
    category
  ) {
    return state.projects.filter(
      function (project) {
        return (
          getProjectCategory(
            project
          ) === category &&
          project.isExcludedFromPriority === true
        );
      }
    );
  }

  function getExpiredProjectsByCategory(
    category
  ) {
    return state.projects.filter(
      function (project) {
        return (
          getProjectCategory(
            project
          ) === category &&
          project.isExcludedFromPriority !== true &&
          isProjectDeadlineExpired(
            project
          )
        );
      }
    );
  }

  function getPriorityCounts() {
    return {
      mural:
        getDisplayProjectsByCategory(
          "mural_sculpture"
        ).length,

      exhibition:
        getDisplayProjectsByCategory(
          "exhibition_content"
        ).length,

      support:
        getDisplayProjectsByCategory(
          "arts_content_support"
        ).length,

      other:
        getDisplayProjectsByCategory(
          "other"
        ).length,

      excluded:
        getExcludedProjects()
          .length
    };
  }

  /* =========================================================
     META
  ========================================================= */

  function updateTextById(
    id,
    value
  ) {
    const element =
      document.getElementById(
        id
      );

    if (
      element
    ) {
      element.textContent =
        value;
    }
  }

  function getLegacyArtCount() {
    const legacy =
      document.getElementById(
        "metaArtCount"
      );

    if (
      legacy &&
      legacy.textContent.trim()
    ) {
      return legacy.textContent
        .trim();
    }

    const artCards =
      document.getElementById(
        "artCards"
      );

    if (
      artCards
    ) {
      const count =
        artCards.querySelectorAll(
          ".card, article, details"
        ).length;

      if (
        count > 0
      ) {
        return formatCount(
          count
        );
      }
    }

    return "0";
  }

  function updateMetaCards() {
    const counts =
      getPriorityCounts();

    updateTextById(
      "priorityMetaArtCount",
      getLegacyArtCount()
    );

    updateTextById(
      "priorityMetaMuralCount",
      `${formatCount(
        counts.mural
      )}건`
    );

    updateTextById(
      "priorityMetaExhibitionCount",
      `${formatCount(
        counts.exhibition
      )}건`
    );

    updateTextById(
      "priorityMetaSupportCount",
      `${formatCount(
        counts.support
      )}건`
    );

    $all(
      ".meta-card[data-tab-target]"
    ).forEach(
      function (card) {
        const target =
          card.getAttribute(
            "data-tab-target"
          );

        const isActive =
          state.currentTab ===
          target;

        card.classList.toggle(
          "meta-card-active",
          isActive
        );

        card.classList.toggle(
          "meta-card-muted",
          !isActive
        );

        card.setAttribute(
          "role",
          "button"
        );

        card.setAttribute(
          "tabindex",
          "0"
        );

        card.onclick =
          function () {
            showTab(
              target
            );
          };

        card.onkeydown =
          function (event) {
            if (
              event.key === "Enter" ||
              event.key === " "
            ) {
              event.preventDefault();

              showTab(
                target
              );
            }
          };
      }
    );
  }

  /* =========================================================
     SUMMARY
  ========================================================= */

  function updateSummaryCounts(
    projects
  ) {
    const visibleProjects =
      Array.isArray(
        projects
      )
        ? projects
        : [];

    const total =
      visibleProjects.length;

    const sCount =
      visibleProjects.filter(
        function (item) {
          return (
            getProjectGrade(
              item
            ) === "S"
          );
        }
      ).length;

    const aCount =
      visibleProjects.filter(
        function (item) {
          return (
            getProjectGrade(
              item
            ) === "A"
          );
        }
      ).length;

    const bcCount =
      visibleProjects.filter(
        function (item) {
          const grade =
            getProjectGrade(
              item
            );

          return (
            grade === "B" ||
            grade === "C"
          );
        }
      ).length;

    updateTextById(
      "totalCount",
      formatCount(
        total
      )
    );

    updateTextById(
      "sCount",
      formatCount(
        sCount
      )
    );

    updateTextById(
      "aCount",
      formatCount(
        aCount
      )
    );

    updateTextById(
      "bCount",
      formatCount(
        bcCount
      )
    );
  }

  function updateArtSummaryCount() {
    const total =
      Number(
        String(
          getLegacyArtCount()
        ).replace(
          /[^0-9]/g,
          ""
        )
      ) || 0;

    updateTextById(
      "totalCount",
      formatCount(
        total
      )
    );

    updateTextById(
      "sCount",
      "-"
    );

    updateTextById(
      "aCount",
      "-"
    );

    updateTextById(
      "bCount",
      "-"
    );
  }

  /* =========================================================
     PANEL HELPERS
  ========================================================= */

  function getNativePanel(tab) {
    if (
      tab === "art"
    ) {
      return $("#artTab");
    }

    if (
      tab === "agencies"
    ) {
      return (
        $("#agenciesTab") ||
        $("#agencyTab")
      );
    }

    return null;
  }

  function getPriorityPanelId(
    tab
  ) {
    return `${tab}Tab`;
  }

  function getPriorityPanel(
    tab
  ) {
    return document.getElementById(
      getPriorityPanelId(
        tab
      )
    );
  }

  function getGradeClass(
    grade
  ) {
    return `priority-grade-${String(
      grade || "C"
    ).toLowerCase()}`;
  }

  function renderGradeBadge(
    project
  ) {
    const grade =
      getProjectGrade(
        project
      );

    const reason =
      project.gradeReason ||
      project.axooFitReason ||
      project.summary ||
      "등급 기준 정보 없음";

    return `
      <span class="priority-grade-wrap">

        <span
          class="priority-grade ${getGradeClass(
            grade
          )}"
        >
          ${esc(
            grade
          )}
        </span>

        <span class="priority-tooltip">

          <strong>
            왜 ${esc(
              grade
            )}등급인가?
          </strong>

          <em>
            ${esc(
              reason
            )}
          </em>

        </span>

      </span>
    `;
  }

  function renderKeywordTags(
    project
  ) {
    const keywords =
      getProjectKeywords(
        project
      );

    if (
      !keywords.length
    ) {
      return `
        <span class="keyword">
          키워드 미분류
        </span>
      `;
    }

    return keywords
      .slice(
        0,
        6
      )
      .map(
        function (keyword) {
          return `
            <span class="keyword">
              ${esc(
                keyword
              )}
            </span>
          `;
        }
      )
      .join("");
  }

  function renderSourceTags(
    sources
  ) {
    if (
      !Array.isArray(
        sources
      ) ||
      !sources.length
    ) {
      return "";
    }

    return `
      <div
        class="keywords"
        style="margin-top:16px;"
      >
        ${sources
          .map(
            function (source) {
              return `
                <span class="keyword">
                  ${esc(
                    source
                  )}
                </span>
              `;
            }
          )
          .join("")}
      </div>
    `;
  }

  /* =========================================================
     SUPPORT CONTROLS
  ========================================================= */

  function getSupportSourceCount(
    projects,
    code
  ) {
    if (
      code === "ALL"
    ) {
      return projects.length;
    }

    return projects.filter(
      function (project) {
        return (
          getSupportSourceCode(
            project
          ) === code
        );
      }
    ).length;
  }

  function renderSupportSourceFilters(
    allSupportProjects
  ) {
    return `
      <section
        class="support-source-filter-wrap"
        style="
          margin:18px 0 12px;
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        "
      >

        <strong
          style="
            font-size:13px;
            margin-right:4px;
          "
        >
          기관
        </strong>

        ${SUPPORT_SOURCE_FILTERS
          .map(
            function (item) {
              const active =
                state.supportSource ===
                item.code;

              const count =
                getSupportSourceCount(
                  allSupportProjects,
                  item.code
                );

              return `
                <button
                  type="button"

                  data-support-source="${esc(
                    item.code
                  )}"

                  aria-pressed="${
                    active
                      ? "true"
                      : "false"
                  }"

                  style="
                    appearance:none;
                    cursor:pointer;
                    border:1px solid ${
                      active
                        ? "#171717"
                        : "#d8d8d8"
                    };
                    background:${
                      active
                        ? "#171717"
                        : "#ffffff"
                    };
                    color:${
                      active
                        ? "#ffffff"
                        : "#444444"
                    };
                    border-radius:999px;
                    padding:8px 12px;
                    font:inherit;
                    font-size:12px;
                    font-weight:${
                      active
                        ? "700"
                        : "600"
                    };
                    line-height:1;
                  "
                >
                  ${esc(
                    item.label
                  )}
                  ${formatCount(
                    count
                  )}
                </button>
              `;
            }
          )
          .join("")}

      </section>
    `;
  }

  function getQuickFilterCount(
    projects,
    code
  ) {
    return filterSupportByQuick(
      projects,
      code
    ).length;
  }

  function renderSupportQuickControls(
    context
  ) {
    return `
      <section
        style="
          margin:0 0 20px;
          padding:14px;
          border:1px solid #e4e4e4;
          border-radius:14px;
          background:#fafafa;
        "
      >

        <div
          style="
            display:flex;
            align-items:center;
            gap:8px;
            flex-wrap:wrap;
            margin-bottom:10px;
          "
        >

          <strong
            style="
              font-size:13px;
              margin-right:4px;
            "
          >
            빠른 필터
          </strong>

          ${SUPPORT_QUICK_FILTERS
            .map(
              function (item) {
                const active =
                  state.supportQuick ===
                  item.code;

                const count =
                  getQuickFilterCount(
                    context.bySourceAndQuery,
                    item.code
                  );

                return `
                  <button
                    type="button"

                    data-support-quick="${esc(
                      item.code
                    )}"

                    aria-pressed="${
                      active
                        ? "true"
                        : "false"
                    }"

                    style="
                      appearance:none;
                      cursor:pointer;
                      border:1px solid ${
                        active
                          ? "#171717"
                          : "#d8d8d8"
                      };
                      background:${
                        active
                          ? "#171717"
                          : "#ffffff"
                      };
                      color:${
                        active
                          ? "#ffffff"
                          : "#444444"
                      };
                      border-radius:999px;
                      padding:8px 12px;
                      font:inherit;
                      font-size:12px;
                      font-weight:${
                        active
                          ? "700"
                          : "600"
                      };
                      line-height:1;
                    "
                  >
                    ${esc(
                      item.label
                    )}
                    ${formatCount(
                      count
                    )}
                  </button>
                `;
              }
            )
            .join("")}

        </div>

        <div
          style="
            display:flex;
            gap:8px;
            align-items:center;
          "
        >

          <input
            id="supportSearchInput"
            type="search"

            value="${esc(
              state.supportQuery
            )}"

            placeholder="공고명 · 기관 · 키워드 검색"

            autocomplete="off"

            style="
              width:100%;
              min-width:0;
              height:40px;
              padding:0 13px;
              border:1px solid #d8d8d8;
              border-radius:10px;
              background:#ffffff;
              color:#171717;
              font:inherit;
              font-size:13px;
              outline:none;
              box-sizing:border-box;
            "
          />

          <button
            type="button"

            data-support-reset="true"

            style="
              flex:0 0 auto;
              height:40px;
              padding:0 13px;
              border:1px solid #d8d8d8;
              border-radius:10px;
              background:#ffffff;
              color:#555555;
              font:inherit;
              font-size:12px;
              font-weight:700;
              cursor:pointer;
              white-space:nowrap;
            "
          >
            초기화
          </button>

        </div>

        <p
          style="
            margin:9px 2px 0;
            color:#777777;
            font-size:11px;
            line-height:1.5;
          "
        >
          기관 필터와 빠른 필터,
          검색어는 동시에 적용됩니다.
          검색 결과
          ${formatCount(
            context.final.length
          )}건.
        </p>

      </section>
    `;
  }

  function renderGradeGuide(
    tab
  ) {
    if (
      tab === "support"
    ) {
      return `
        <section
          class="grade-guide-box grade-guide-box-green"
        >

          <strong>
            지원사업 검토 기준
          </strong>

          <p>
            S는 즉시 검토,
            A는 높은 연계 가능성,
            B는 검토 가치가 있는 공고입니다.
            시각예술, 전시, 공간, 디자인,
            브랜드, 콘텐츠 제작,
            기업 협업과의 연결성을 우선합니다.
            공연·게임·애니메이션 등 단일 장르 중심 사업,
            교육생·참여자 모집,
            시상·결과발표형 공고는 우선순위에서 제외됩니다.
            게재 후 3일 이내 공고는 NEW,
            7일 이내 공고는 최근 등록으로 표시되며,
            마감된 공고는 한국시간 기준으로 자동 숨김 처리합니다.
          </p>

        </section>
      `;
    }

    return `
      <section
        class="grade-guide-box grade-guide-box-green"
      >

        <strong>
          등급 기준 안내
        </strong>

        <p>
          S는 즉시 검토,
          A는 제안 가능성 높음,
          B는 모니터링,
          C는 낮은 우선순위입니다.
          행사 운영대행, 폐기물, 청소,
          시설관리, 보험, 임차,
          시스템 유지보수 등은
          우선순위에서 제외됩니다.
          등급 배지에 마우스를 올리면
          세부 선정 기준을 확인할 수 있습니다.
        </p>

      </section>
    `;
  }

  /* =========================================================
     ACCORDION
  ========================================================= */

  function renderPriorityAccordion(
    project,
    tab
  ) {
    const title =
      project.title ||
      project.bidNtceNm ||
      project.projectName ||
      "제목 없음";

    const agency =
      getProjectAgency(
        project
      );

    const sourceLabel =
      getSummarySourceLabel(
        project,
        tab
      );

    const sourceTitle =
      getSummarySourceTitle(
        project,
        tab
      );

    const categoryLabel =
      getAccordionCategoryLabel(
        project,
        tab
      );

    const amount =
      formatKrw(
        getProjectAmount(
          project
        )
      );

    const published =
      compactDate(
        getProjectPublishedDate(
          project
        )
      );

    const deadline =
      compactDate(
        getProjectDeadline(
          project
        )
      );

    const nextAction =
      project.nextAction ||
      project.recommendedAction ||
      "검토";

    const gradeReason =
      project.gradeReason ||
      project.axooFitReason ||
      project.summary ||
      "등급 기준 정보 없음";

    const url =
      normalizeUrl(
        project.sourceUrl ||
        project.originalUrl ||
        project.url ||
        project.ntceSpecDocUrl1 ||
        ""
      );

    const bodyBadges =
      tab === "support"
        ? `
          <span class="badge category">
            ${esc(
              getSupportSourceCode(
                project
              ) ||
              "지원"
            )}
          </span>

          <span class="badge category">
            ${esc(
              agency
            )}
          </span>
        `
        : `
          <span class="badge category">
            ${esc(
              categoryLabel
            )}
          </span>

          <span class="badge category">
            ${esc(
              sourceLabel
            )}
          </span>
        `;

    return `
      <article
        class="card card-as-accordion priority-accordion-card"
      >

        <details class="accordion-card">

          <summary
            class="accordion-summary priority-accordion-summary"
          >

            <span class="summary-source-wrap">

              <em
                class="summary-source"
                title="${esc(
                  sourceTitle
                )}"
              >
                ${esc(
                  sourceLabel
                )}
              </em>

              ${renderGradeBadge(
                project
              )}

            </span>

            <span
              class="summary-title priority-summary-title"
            >

              <small>

                ${esc(
                  categoryLabel
                )}

                ${
                  tab === "support"
                    ? renderRecentBadge(
                        project
                      )
                    : ""
                }

              </small>

              ${esc(
                title
              )}

            </span>

            <span class="summary-period">

              <span>
                공고일
              </span>

              <strong>
                ${esc(
                  published
                )}
              </strong>

            </span>

            <span class="summary-deadline">

              <span>
                마감일
              </span>

              <strong>
                ${esc(
                  deadline
                )}
              </strong>

              ${
                tab === "support"
                  ? renderDeadlineBadge(
                      project
                    )
                  : ""
              }

            </span>

          </summary>

          <div class="accordion-body">

            <div class="card-top">

              <div class="badges">

                ${bodyBadges}

                ${
                  tab === "support"
                    ? renderRecentBadge(
                        project
                      )
                    : ""
                }

              </div>

              <div class="score-group">

                <span class="score">
                  ${esc(
                    nextAction
                  )}
                </span>

              </div>

            </div>

            <h2>
              ${esc(
                title
              )}
            </h2>

            <div class="meta">

              <div>

                <span>
                  기관
                </span>

                ${esc(
                  agency
                )}

              </div>

              <div>

                <span>
                  예산/지원금
                </span>

                ${esc(
                  amount
                )}

              </div>

              <div>

                <span>
                  공고일
                </span>

                ${esc(
                  published
                )}

              </div>

              <div>

                <span>
                  마감일
                </span>

                ${esc(
                  deadline
                )}

                ${
                  tab === "support"
                    ? renderDeadlineBadge(
                        project
                      )
                    : ""
                }

              </div>

            </div>

            <div class="keywords">

              ${renderKeywordTags(
                project
              )}

            </div>

            <div class="reason">

              <strong>
                검토 기준
              </strong>

              <br />

              ${esc(
                gradeReason
              )}

            </div>

            <p class="action">

              다음 액션:
              ${esc(
                nextAction
              )}

            </p>

            ${
              url
                ? `
                  <a
                    class="link"
                    href="${esc(
                      url
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    공고 보기
                  </a>
                `
                : `
                  <p class="empty-message-inline">
                    공고 링크가 없습니다.
                  </p>
                `
            }

          </div>

        </details>

      </article>
    `;
  }

  /* =========================================================
     PRIORITY PANEL
  ========================================================= */

  function renderPriorityPanel(
    tab,
    category
  ) {
    const config =
      getTabConfig(
        tab
      );

    const panel =
      getPriorityPanel(
        tab
      );

    if (
      !panel ||
      !config
    ) {
      return;
    }

    const allProjects =
      getDisplayProjectsByCategory(
        category
      );

    const supportContext =
      tab === "support"
        ? getSupportFilterContext()
        : null;

    const projects =
      tab === "support"
        ? supportContext.final
        : allProjects;

    const excludedCount =
      getExcludedProjectsByCategory(
        category
      ).length;

    const expiredCount =
      tab === "support"
        ? getExpiredProjectsByCategory(
            category
          ).length
        : 0;

    const newCount =
      tab === "support"
        ? countNewProjects(
            projects
          )
        : 0;

    let miniStatSmall =
      `우선순위 제외 ${formatCount(
        excludedCount
      )}건`;

    if (
      tab === "support"
    ) {
      miniStatSmall =
        `NEW ${formatCount(
          newCount
        )}건 · 전체 유효 ${formatCount(
          allProjects.length
        )}건 · 마감 종료 ${formatCount(
          expiredCount
        )}건 숨김`;
    }

    const secondHeader =
      tab === "support"
        ? "분야 / 공고명"
        : "카테고리 / 공고명";

    const firstHeader =
      tab === "support"
        ? "기관"
        : "출처";

    panel.innerHTML = `

      <section
        class="priority-panel-head priority-panel-head-green"
      >

        <div>

          <p class="priority-eyebrow">
            AXOO Priority KR v1.7
          </p>

          <h2>
            ${esc(
              config.icon
            )}
            ${esc(
              config.label
            )}
          </h2>

          <p>
            ${esc(
              config.description ||
              ""
            )}
          </p>

          ${renderSourceTags(
            config.sources
          )}

        </div>

        <div class="priority-mini-stat">

          <span>
            표시 공고
          </span>

          <strong>
            ${formatCount(
              projects.length
            )}건
          </strong>

          <small>
            ${miniStatSmall}
          </small>

        </div>

      </section>

      ${
        tab === "support"
          ? renderSupportSourceFilters(
              allProjects
            )
          : ""
      }

      ${
        tab === "support"
          ? renderSupportQuickControls(
              supportContext
            )
          : ""
      }

      ${renderGradeGuide(
        tab
      )}

      <div
        class="list-head priority-list-head"
      >

        <span class="list-source-grade">

          <em>
            ${esc(
              firstHeader
            )}
          </em>

          <em>
            등급
          </em>

        </span>

        <span>
          ${esc(
            secondHeader
          )}
        </span>

        <span>
          게재일
        </span>

        <span>
          마감일
        </span>

      </div>

      ${
        projects.length
          ? `
            <section
              class="cards priority-accordion-list"
            >

              ${projects
                .map(
                  function (project) {
                    return renderPriorityAccordion(
                      project,
                      tab
                    );
                  }
                )
                .join("")}

            </section>
          `
          : `
            <div class="priority-empty">

              ${
                tab === "support"
                  ? "현재 선택한 기관·빠른 필터·검색 조건에 맞는 진행 중 공고가 없습니다."
                  : "해당 기준에 맞는 진행 중 공고가 아직 없습니다."
              }

            </div>
          `
      }
    `;

    updateSummaryCounts(
      projects
    );
  }

  /* =========================================================
     TAB CONTROL
  ========================================================= */

  function hideAllPanels() {
    [
      "artTab",
      "muralTab",
      "exhibitionTab",
      "supportTab",
      "otherTab",
      "agenciesTab",
      "agencyTab",
      "opportunitiesTab",
      "localTab"
    ].forEach(
      function (id) {
        const panel =
          document.getElementById(
            id
          );

        if (
          panel
        ) {
          panel.classList.remove(
            "active"
          );

          panel.style.display =
            "none";
        }
      }
    );
  }

  function activateTabButton(
    tab
  ) {
    $all(
      ".tab-button"
    ).forEach(
      function (button) {
        const isActive =
          button.getAttribute(
            "data-tab"
          ) === tab;

        button.classList.toggle(
          "active",
          isActive
        );

        button.setAttribute(
          "aria-selected",
          isActive
            ? "true"
            : "false"
        );
      }
    );
  }

  function showNativeTab(tab) {
    const panel =
      getNativePanel(
        tab
      );

    if (
      !panel
    ) {
      return;
    }

    panel.classList.add(
      "active"
    );

    panel.style.display =
      "";

    if (
      tab === "art"
    ) {
      updateArtSummaryCount();
    }
  }

  function showTab(tab) {
    const config =
      getTabConfig(
        tab
      );

    if (
      !config
    ) {
      return;
    }

    state.currentTab =
      tab;

    hideAllPanels();

    activateTabButton(
      tab
    );

    if (
      config.type ===
      "priority"
    ) {
      renderPriorityPanel(
        tab,
        config.category
      );

      const panel =
        getPriorityPanel(
          tab
        );

      if (
        panel
      ) {
        panel.classList.add(
          "active"
        );

        panel.style.display =
          "";
      }
    }

    else {
      showNativeTab(
        tab
      );
    }

    updateMetaCards();
  }

  function setupTabButtons() {
    $all(
      ".tab-button"
    ).forEach(
      function (button) {
        const tab =
          button.getAttribute(
            "data-tab"
          );

        if (
          tab === "opportunities" ||
          tab === "local"
        ) {
          button.style.display =
            "none";

          return;
        }

        button.onclick =
          function (event) {
            event.preventDefault();

            event.stopPropagation();

            const nextTab =
              button.getAttribute(
                "data-tab"
              );

            if (
              nextTab
            ) {
              showTab(
                nextTab
              );
            }
          };
      }
    );
  }

  /* =========================================================
     ENSURE PANELS
  ========================================================= */

  function ensurePriorityPanels() {
    [
      "mural",
      "exhibition",
      "support",
      "other"
    ].forEach(
      function (tab) {
        let panel =
          getPriorityPanel(
            tab
          );

        if (
          panel
        ) {
          return;
        }

        panel =
          document.createElement(
            "section"
          );

        panel.id =
          getPriorityPanelId(
            tab
          );

        panel.className =
          "tab-panel priority-tab-panel";

        panel.style.display =
          "none";

        const agenciesPanel =
          $("#agenciesTab") ||
          $("#agencyTab");

        const main =
          $("main") ||
          document.body;

        if (
          agenciesPanel &&
          agenciesPanel.parentNode
        ) {
          agenciesPanel.parentNode
            .insertBefore(
              panel,
              agenciesPanel
            );
        }

        else {
          main.appendChild(
            panel
          );
        }
      }
    );
  }

  /* =========================================================
     TAB LAYOUT
  ========================================================= */

  function ensureTabLayout() {
    const tabs =
      $(".tabs");

    if (
      !tabs
    ) {
      return;
    }

    const desiredTabs = [
      {
        tab: "art",
        text:
          "💙 건축물 미술작품"
      },

      {
        tab: "mural",
        text:
          "🧱 벽화 & 조형물"
      },

      {
        tab: "exhibition",
        text:
          "🖼️ 전시 콘텐츠 기획 운영"
      },

      {
        tab: "support",
        text:
          "✨ 예술·콘텐츠 지원사업"
      },

      {
        tab: "other",
        text:
          "📂 기타 AXOO 핏"
      },

      {
        tab: "agencies",
        text:
          "🎯 기관 타깃"
      }
    ];

    desiredTabs.forEach(
      function (item) {
        let button =
          tabs.querySelector(
            `.tab-button[data-tab="${item.tab}"]`
          );

        if (
          !button
        ) {
          button =
            document.createElement(
              "button"
            );

          button.type =
            "button";

          button.className =
            "tab-button";

          button.setAttribute(
            "data-tab",
            item.tab
          );
        }

        button.textContent =
          item.text;

        button.style.display =
          "";

        tabs.appendChild(
          button
        );
      }
    );

    const opportunityButton =
      tabs.querySelector(
        '.tab-button[data-tab="opportunities"]'
      );

    const localButton =
      tabs.querySelector(
        '.tab-button[data-tab="local"]'
      );

    if (
      opportunityButton
    ) {
      opportunityButton.style.display =
        "none";
    }

    if (
      localButton
    ) {
      localButton.style.display =
        "none";
    }

    let separator =
      tabs.querySelector(
        ".priority-tab-separator"
      );

    if (
      !separator
    ) {
      separator =
        document.createElement(
          "span"
        );

      separator.className =
        "priority-tab-separator";

      separator.textContent =
        "참고";
    }

    const agenciesButton =
      tabs.querySelector(
        '.tab-button[data-tab="agencies"]'
      );

    if (
      agenciesButton
    ) {
      tabs.insertBefore(
        separator,
        agenciesButton
      );
    }
  }

  /* =========================================================
     META FALLBACK
  ========================================================= */

  function setupMetaFallback() {
    const metaBar =
      $(".meta-bar");

    if (
      !metaBar
    ) {
      return;
    }

    const requiredCards = [
      {
        id:
          "priorityMetaArtCount",

        label:
          "1. 건축물 미술작품",

        tab:
          "art"
      },

      {
        id:
          "priorityMetaMuralCount",

        label:
          "2. 벽화 & 조형물",

        tab:
          "mural"
      },

      {
        id:
          "priorityMetaExhibitionCount",

        label:
          "3. 전시 콘텐츠 기획 운영",

        tab:
          "exhibition"
      },

      {
        id:
          "priorityMetaSupportCount",

        label:
          "4. 예술·콘텐츠 지원사업",

        tab:
          "support"
      }
    ];

    const alreadyPriority =
      requiredCards.every(
        function (item) {
          return document.getElementById(
            item.id
          );
        }
      );

    if (
      alreadyPriority
    ) {
      return;
    }

    metaBar.innerHTML =
      "";

    requiredCards.forEach(
      function (item) {
        const card =
          document.createElement(
            "div"
          );

        card.className =
          "meta-card priority-meta-card";

        card.setAttribute(
          "data-tab-target",
          item.tab
        );

        card.innerHTML = `
          <div class="meta-label">
            ${esc(
              item.label
            )}
          </div>

          <div
            class="meta-value"
            id="${esc(
              item.id
            )}"
          >
            0
          </div>
        `;

        metaBar.appendChild(
          card
        );
      }
    );
  }

  /* =========================================================
     INIT
  ========================================================= */

  async function applyPriorityDashboard() {
    ensurePriorityPanels();

    ensureTabLayout();

    setupMetaFallback();

    await loadPriorityProjects();

    updateMetaCards();

    setupTabButtons();

    const activeButton =
      $(".tab-button.active");

    const activeTab =
      activeButton
        ? activeButton.getAttribute(
            "data-tab"
          )
        : "";

    if (
      !activeTab ||
      activeTab ===
        "opportunities" ||
      activeTab ===
        "local"
    ) {
      showTab(
        "art"
      );
    }

    else {
      showTab(
        activeTab
      );
    }
  }

  function schedulePatch() {
    let count =
      0;

    const timer =
      window.setInterval(
        function () {
          updateMetaCards();

          const config =
            getTabConfig(
              state.currentTab
            );

          const shouldSkipSupportRerender =
            state.currentTab ===
              "support" &&
            state.supportInteracted;

          if (
            config &&
            config.type ===
              "priority" &&
            !shouldSkipSupportRerender
          ) {
            renderPriorityPanel(
              config.tab,
              config.category
            );
          }

          count +=
            1;

          if (
            count >= 8
          ) {
            window.clearInterval(
              timer
            );
          }
        },
        700
      );
  }

  function rerenderSupportAndRestoreSearchFocus(
    selectionStart,
    selectionEnd
  ) {
    renderPriorityPanel(
      "support",
      "arts_content_support"
    );

    const input =
      document.getElementById(
        "supportSearchInput"
      );

    if (
      !input
    ) {
      return;
    }

    input.focus();

    if (
      typeof selectionStart ===
        "number" &&
      typeof selectionEnd ===
        "number" &&
      typeof input.setSelectionRange ===
        "function"
    ) {
      input.setSelectionRange(
        selectionStart,
        selectionEnd
      );
    }
  }

  /* =========================================================
     EVENTS
  ========================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    function () {

      applyPriorityDashboard();

      schedulePatch();

      document.addEventListener(
        "input",
        function (event) {

          const input =
            event.target.closest
              ? event.target.closest(
                  "#supportSearchInput"
                )
              : null;

          if (
            !input
          ) {
            return;
          }

          state.supportInteracted =
            true;

          state.supportQuery =
            input.value ||
            "";

          const selectionStart =
            input.selectionStart;

          const selectionEnd =
            input.selectionEnd;

          rerenderSupportAndRestoreSearchFocus(
            selectionStart,
            selectionEnd
          );
        },
        true
      );

      document.addEventListener(
        "click",
        function (event) {

          const sourceButton =
            event.target.closest(
              "[data-support-source]"
            );

          if (
            sourceButton
          ) {
            event.preventDefault();

            event.stopPropagation();

            state.supportInteracted =
              true;

            const source =
              String(
                sourceButton.getAttribute(
                  "data-support-source"
                ) ||
                "ALL"
              )
                .trim()
                .toUpperCase();

            state.supportSource =
              SUPPORT_SOURCE_FILTERS.some(
                function (item) {
                  return (
                    item.code ===
                    source
                  );
                }
              )
                ? source
                : "ALL";

            renderPriorityPanel(
              "support",
              "arts_content_support"
            );

            return;
          }

          const quickButton =
            event.target.closest(
              "[data-support-quick]"
            );

          if (
            quickButton
          ) {
            event.preventDefault();

            event.stopPropagation();

            state.supportInteracted =
              true;

            const quick =
              String(
                quickButton.getAttribute(
                  "data-support-quick"
                ) ||
                "ALL"
              )
                .trim()
                .toUpperCase();

            state.supportQuick =
              SUPPORT_QUICK_FILTERS.some(
                function (item) {
                  return (
                    item.code ===
                    quick
                  );
                }
              )
                ? quick
                : "ALL";

            renderPriorityPanel(
              "support",
              "arts_content_support"
            );

            return;
          }

          const resetButton =
            event.target.closest(
              "[data-support-reset]"
            );

          if (
            resetButton
          ) {
            event.preventDefault();

            event.stopPropagation();

            state.supportInteracted =
              true;

            state.supportSource =
              "ALL";

            state.supportQuick =
              "ALL";

            state.supportQuery =
              "";

            renderPriorityPanel(
              "support",
              "arts_content_support"
            );

            return;
          }

          const tabButton =
            event.target.closest(
              ".tab-button[data-tab]"
            );

          const metaCard =
            event.target.closest(
              ".meta-card[data-tab-target]"
            );

          const tab =
            tabButton
              ? tabButton.getAttribute(
                  "data-tab"
                )
              : metaCard
                ? metaCard.getAttribute(
                    "data-tab-target"
                  )
                : "";

          const priorityTabs = [
            "art",
            "mural",
            "exhibition",
            "support",
            "other",
            "agencies"
          ];

          if (
            !priorityTabs.includes(
              tab
            )
          ) {
            return;
          }

          event.preventDefault();

          event.stopPropagation();

          window.setTimeout(
            function () {
              showTab(
                tab
              );
            },
            0
          );

        },
        true
      );
    }
  );

})();
