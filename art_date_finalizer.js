(function () {
  "use strict";

  const DATA_URL =
    "data/art_commissions.json";

  let artItems = [];


  /* =========================================
     BASIC
  ========================================= */

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }


  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function periodText(item) {
    const start =
      String(
        item.periodStart || ""
      ).trim();

    const end =
      String(
        item.periodEnd || ""
      ).trim();

    if (
      start &&
      end
    ) {
      if (start === end) {
        return start;
      }

      return (
        start +
        " ~ " +
        end
      );
    }

    if (start) {
      return start;
    }

    if (end) {
      return end;
    }

    return "확인 필요";
  }


  function confidenceText(item) {
    const value =
      String(
        item.dateConfidence || ""
      )
        .trim()
        .toUpperCase();

    if (value === "HIGH") {
      return "● 확인됨";
    }

    if (value === "MEDIUM") {
      return "● 부분 확인";
    }

    return "● 확인 필요";
  }


  /* =========================================
     D-DAY
  ========================================= */

  function koreaTodayISO() {
    const now =
      new Date(
        Date.now() +
        9 * 60 * 60 * 1000
      );

    return now
      .toISOString()
      .slice(0, 10);
  }


  function dayNumber(iso) {
    const match =
      String(iso || "")
        .match(
          /^(\d{4})-(\d{2})-(\d{2})$/
        );

    if (!match) {
      return null;
    }

    return Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );
  }


  function getDDay(deadline) {
    const target =
      dayNumber(deadline);

    const today =
      dayNumber(
        koreaTodayISO()
      );

    if (
      target === null ||
      today === null
    ) {
      return {
        label:
          "마감일 확인 필요",

        className:
          "deadline-unknown"
      };
    }

    const days =
      Math.round(
        (
          target -
          today
        ) /
        86400000
      );

    if (days < 0) {
      return {
        label:
          "마감",

        className:
          "deadline-closed"
      };
    }

    if (days === 0) {
      return {
        label:
          "D-DAY",

        className:
          "deadline-urgent"
      };
    }

    if (days <= 3) {
      return {
        label:
          "D-" + days,

        className:
          "deadline-urgent"
      };
    }

    if (days <= 7) {
      return {
        label:
          "D-" + days,

        className:
          "deadline-soon"
      };
    }

    return {
      label:
        "D-" + days,

      className:
        "deadline-normal"
    };
  }


  /* =========================================
     DATA
  ========================================= */

  async function loadData() {
    try {
      const response =
        await fetch(
          DATA_URL +
          "?dateFinal=" +
          Date.now()
        );

      if (!response.ok) {
        throw new Error(
          "art_commissions.json load failed"
        );
      }

      const data =
        await response.json();

      if (Array.isArray(data)) {
        artItems = data;
        return;
      }

      if (
        data &&
        Array.isArray(data.projects)
      ) {
        artItems =
          data.projects;
        return;
      }

      if (
        data &&
        Array.isArray(data.items)
      ) {
        artItems =
          data.items;
        return;
      }

      if (
        data &&
        Array.isArray(data.data)
      ) {
        artItems =
          data.data;
        return;
      }

      artItems = [];

    } catch (error) {
      console.warn(
        "[AXOO DATE FINALIZER]",
        error
      );

      artItems = [];
    }
  }


  function getCardTitle(card) {
    const heading =
      card.querySelector("h2") ||
      card.querySelector("h3") ||
      card.querySelector(
        ".summary-title"
      );

    return heading
      ? normalizeText(
          heading.textContent
        )
      : "";
  }


  function findItem(card) {
    const title =
      getCardTitle(card);

    if (!title) {
      return null;
    }

    return (
      artItems.find(
        function (item) {
          return (
            normalizeText(
              item.title ||
              item.bidNtceNm ||
              ""
            ) === title
          );
        }
      ) ||
      null
    );
  }


  /* =========================================
     META
  ========================================= */

  function findMetaRow(
    card,
    labels
  ) {
    const rows =
      Array.from(
        card.querySelectorAll(
          ".meta > div"
        )
      );

    for (
      const row of rows
    ) {
      const label =
        normalizeText(
          row.querySelector(
            "span"
          )?.textContent
        );

      if (
        labels.includes(label)
      ) {
        return row;
      }
    }

    return null;
  }


  function setMetaValue(
    card,
    labels,
    finalLabel,
    value
  ) {
    const meta =
      card.querySelector(
        ".meta"
      );

    if (!meta) {
      return;
    }

    let row =
      findMetaRow(
        card,
        labels
      );

    if (!row) {
      row =
        document.createElement(
          "div"
        );

      meta.appendChild(row);
    }

    row.innerHTML =
      "<span>" +
      escapeHtml(finalLabel) +
      "</span>" +
      escapeHtml(
        value || "-"
      );
  }


  /* =========================================
     CARD PATCH
  ========================================= */

  function patchCard(card) {
    const item =
      findItem(card);

    if (!item) {
      return;
    }

    const published =
      String(
        item.publishedDate || ""
      ).trim() ||
      "-";

    const period =
      periodText(item);

    const deadline =
      String(
        item.deadline ||
        item.periodEnd ||
        ""
      ).trim() ||
      "-";

    const confidence =
      confidenceText(item);


    /*
      공개일 → 공고일로 교체
    */
    setMetaValue(
      card,
      [
        "공개일",
        "공고일"
      ],
      "공고일",
      published
    );


    setMetaValue(
      card,
      [
        "공모기간",
        "접수기간"
      ],
      "공모기간",
      period
    );


    setMetaValue(
      card,
      [
        "마감일"
      ],
      "마감일",
      deadline
    );


    setMetaValue(
      card,
      [
        "날짜 확인",
        "날짜확인"
      ],
      "날짜 확인",
      confidence
    );


    /*
      D-DAY도 실제 deadline으로 재계산
    */
    const badge =
      card.querySelector(
        ".deadline-badge"
      );

    if (badge) {
      const dday =
        getDDay(
          deadline === "-"
            ? ""
            : deadline
        );

      badge.textContent =
        dday.label;

      [
        "deadline-unknown",
        "deadline-closed",
        "deadline-urgent",
        "deadline-soon",
        "deadline-normal"
      ].forEach(
        function (className) {
          badge.classList.remove(
            className
          );
        }
      );

      badge.classList.add(
        dday.className
      );
    }


    /*
      추천 액션의 공모기간도
      정규화 데이터 기준으로 확정
    */
    const action =
      card.querySelector(
        ".action"
      );

    if (action) {
      const baseAction =
        item.nextAction ||
        item.recommendedAction ||
        "공고 원문 확인 후 접수 기간, 설치 조건, 작품 규모, 제출 서류 검토";

      const cleanedAction =
        String(baseAction)
          .replace(
            /\s*\/\s*공모기간\s*:[^/]+$/i,
            ""
          )
          .trim();

      action.textContent =
        "추천 액션: " +
        cleanedAction +
        (
          period !==
          "확인 필요"
            ? " / 공모기간: " +
              period
            : ""
        );
    }


    card.dataset
      .dateFinalized =
      "true";
  }


  function patchAllCards() {
    document
      .querySelectorAll(
        "#artCards .card"
      )
      .forEach(
        patchCard
      );
  }


  /* =========================================
     SAFE RENDER TIMING
  ========================================= */

  function schedulePatches() {
    [
      0,
      200,
      500,
      900,
      1500,
      2500,
      4000
    ].forEach(
      function (delay) {
        setTimeout(
          patchAllCards,
          delay
        );
      }
    );
  }


  async function init() {
    await loadData();

    schedulePatches();

    window.addEventListener(
      "axoo:rendered",
      function () {
        setTimeout(
          patchAllCards,
          80
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
