(function () {
  "use strict";

  const SUPPORT_APP_URL =
    "https://script.google.com/a/macros/axoocorp.com/s/AKfycbzLS5AW0DfLGIDersBlbL4IDEIhHqElPaaePi45bG5nrT6V_8FKwSjwta3lUS3VocW3/exec";

  function injectStyles() {
    if (document.getElementById("axooSupportNavStyles")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "axooSupportNavStyles";

    style.textContent = `
      .my-projects-nav-button {
        appearance: none;
        border: 1px solid rgba(255,255,255,.14);
        background: #111;
        color: #fff;
        border-radius: 999px;
        padding: 11px 18px;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
        white-space: nowrap;
        transition:
          transform .18s ease,
          opacity .18s ease;
      }

      .my-projects-nav-button:hover {
        transform: translateY(-1px);
        opacity: .82;
      }
    `;

    document.head.appendChild(style);
  }

  function createSupportButton() {
    const tabs = document.querySelector(".tabs");

    if (!tabs) {
      return;
    }

    const existing =
      document.getElementById("myProjectsToggle");

    if (existing) {
      existing.remove();
    }

    const button =
      document.createElement("button");

    button.id = "myProjectsToggle";
    button.type = "button";
    button.className =
      "my-projects-nav-button";

    button.textContent =
      "⭐ 지원 관리";

    button.title =
      "AXOO 지원 프로젝트 관리 열기";

    button.addEventListener(
      "click",
      function () {
        window.open(
          SUPPORT_APP_URL,
          "_blank",
          "noopener"
        );
      }
    );

    tabs.appendChild(button);
  }

  function removeOldPanel() {
    const panel =
      document.getElementById(
        "myProjectsPanel"
      );

    if (panel) {
      panel.remove();
    }
  }

  function init() {
    injectStyles();
    removeOldPanel();
    createSupportButton();
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
