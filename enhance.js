const MEMO_STORAGE_KEY = "axooB2GCardMemos";

function getMemoStore() {
  try {
    return JSON.parse(localStorage.getItem(MEMO_STORAGE_KEY)) || {};
  } catch (error) {
    return {};
  }
}

function saveMemoStore(store) {
  localStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(store));
}

function getCardKey(card) {
  const panel = card.closest(".tab-panel");
  const panelId = panel ? panel.id : "dashboard";
  const title = card.querySelector("h2")?.textContent.trim() || "untitled";

  return `${panelId}-${title}`;
}

function getCardMetaText(card) {
  const metaItems = Array.from(card.querySelectorAll(".meta div"));

  return metaItems.map(item => {
    const label = item.querySelector("span")?.textContent.trim() || "";
    const value = item.textContent.replace(label, "").trim();

    return label ? `${label}: ${value}` : value;
  }).filter(Boolean).join("\n");
}

function buildCardCopyText(card, memoText) {
  const title = card.querySelector("h2")?.textContent.trim() || "";
  const badges = Array.from(card.querySelectorAll(".badge"))
    .map(badge => badge.textContent.trim())
    .filter(Boolean)
    .join(" / ");

  const score = card.querySelector(".score")?.textContent.trim() || "";
  const deadline = card.querySelector(".deadline-badge")?.textContent.trim() || "";
  const meta = getCardMetaText(card);

  const actions = Array.from(card.querySelectorAll(".action"))
    .map(action => action.textContent.trim())
    .filter(Boolean)
    .join("\n");

  const link = card.querySelector("a.link")?.href || "";

  return [
    `[AXOO B2G 검토 카드]`,
    "",
    `제목: ${title}`,
    badges ? `구분: ${badges}` : "",
    score ? `점수/정보: ${score}` : "",
    deadline ? `마감: ${deadline}` : "",
    "",
    meta,
    "",
    actions,
    "",
    memoText ? `담당자 메모: ${memoText}` : "",
    link ? `링크: ${link}` : ""
  ].filter(Boolean).join("\n");
}

function enhanceCard(card) {
  if (card.dataset.enhanced === "true") return;
  if (!card.querySelector("h2")) return;

  card.dataset.enhanced = "true";

  const key = getCardKey(card);
  const memoStore = getMemoStore();

  const tools = document.createElement("div");
  tools.className = "card-tools";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "copy-card-button";
  copyButton.textContent = "카드 정보 복사";

  const memo = document.createElement("textarea");
  memo.className = "card-memo";
  memo.placeholder = "담당자 메모를 입력하세요. 예: 담당자 확인 필요 / 제안서 검토 / 보류 사유";
  memo.value = memoStore[key] || "";

  memo.addEventListener("input", () => {
    const store = getMemoStore();
    store[key] = memo.value;
    saveMemoStore(store);
  });

  copyButton.addEventListener("click", async () => {
    const copyText = buildCardCopyText(card, memo.value.trim());

    try {
      await navigator.clipboard.writeText(copyText);

      copyButton.textContent = "복사 완료";
      copyButton.classList.add("copied");

      setTimeout(() => {
        copyButton.textContent = "카드 정보 복사";
        copyButton.classList.remove("copied");
      }, 1400);
    } catch (error) {
      alert("복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
    }
  });

  tools.appendChild(copyButton);
  tools.appendChild(memo);

  card.appendChild(tools);
}

function enhanceAllCards() {
  document
    .querySelectorAll("#opportunitiesTab .card, #agenciesTab .card, #artTab .card")
    .forEach(card => enhanceCard(card));
}

document.addEventListener("DOMContentLoaded", () => {
  enhanceAllCards();

  const target = document.querySelector("main") || document.body;

  const observer = new MutationObserver(() => {
    enhanceAllCards();
  });

  observer.observe(target, {
    childList: true,
    subtree: true
  });
});
