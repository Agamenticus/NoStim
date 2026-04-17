// NoStim — Tab Eliminator Settings

const backBtn = document.getElementById("back-btn");
const tabElimToggle = document.getElementById("tab-elim-toggle");
const tabElimStatus = document.getElementById("tab-elim-status");
const daysInput = document.getElementById("days-input");
const preserveInput = document.getElementById("preserve-input");
const addPreserveBtn = document.getElementById("add-preserve-btn");
const preservedList = document.getElementById("preserved-list");
const closedCount = document.getElementById("closed-count");
const historyListEl = document.getElementById("history-list");

let preservedUrls = [];

// --- Init ---

async function init() {
  const state = await chrome.runtime.sendMessage({ type: "getState" });

  document.body.dataset.theme = state.theme || "medieval";
  tabElimToggle.checked = !!state.tabEliminatorEnabled;
  daysInput.value = state.tabEliminatorDays || 3;
  preservedUrls = state.preservedUrls || [];

  updateStatusLabel();
  renderPreservedUrls();

  // Load history
  const historyData = await chrome.runtime.sendMessage({ type: "getClosedTabsHistory" });
  const history = historyData.history || [];
  const count = history.length;
  closedCount.textContent = count + " today";
  renderHistory(history);
}

init();

// --- Back ---

backBtn.addEventListener("click", () => {
  window.location.href = chrome.runtime.getURL("dashboard/dashboard.html");
});

// --- Toggle ---

tabElimToggle.addEventListener("change", async () => {
  await chrome.runtime.sendMessage({
    type: "toggleTabEliminator",
    enabled: tabElimToggle.checked
  });
  updateStatusLabel();
});

function updateStatusLabel() {
  tabElimStatus.textContent = tabElimToggle.checked ? "ON" : "OFF";
  tabElimStatus.classList.toggle("active", tabElimToggle.checked);
}

// --- Days ---

daysInput.addEventListener("change", () => {
  let days = parseInt(daysInput.value, 10);
  if (isNaN(days) || days < 1) days = 1;
  if (days > 30) days = 30;
  daysInput.value = days;
  chrome.runtime.sendMessage({ type: "setTabEliminatorDays", days });
});

// --- Preserved URLs ---

addPreserveBtn.addEventListener("click", addPreservedUrl);
preserveInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addPreservedUrl();
});

async function addPreservedUrl() {
  const url = sanitizeDomain(preserveInput.value);
  if (!url) return;

  if (preservedUrls.includes(url)) {
    preserveInput.value = "";
    return;
  }

  await chrome.runtime.sendMessage({ type: "preserveUrl", url: url });
  preservedUrls.push(url);
  preserveInput.value = "";
  renderPreservedUrls();
}

async function removePreservedUrl(url) {
  await chrome.runtime.sendMessage({ type: "removePreservedUrl", url });
  preservedUrls = preservedUrls.filter((u) => u !== url);
  renderPreservedUrls();
}

function renderPreservedUrls() {
  preservedList.innerHTML = "";
  for (const url of preservedUrls) {
    const li = document.createElement("li");
    li.className = "site-pill";

    const label = document.createElement("span");
    label.textContent = url;

    const btn = document.createElement("button");
    btn.className = "remove-btn";
    btn.textContent = "\u00d7";
    btn.addEventListener("click", () => removePreservedUrl(url));

    li.appendChild(label);
    li.appendChild(btn);
    preservedList.appendChild(li);
  }
}

// --- History ---

function renderHistory(history) {
  historyListEl.innerHTML = "";
  if (history.length === 0) {
    historyListEl.innerHTML = '<p class="no-history">No tabs closed today</p>';
    return;
  }

  for (const entry of history.slice().reverse()) {
    const div = document.createElement("div");
    div.className = "history-item";

    const info = document.createElement("div");
    info.className = "history-info";

    const title = document.createElement("span");
    title.className = "history-title";
    title.textContent = entry.title;

    const meta = document.createElement("span");
    meta.className = "history-meta";
    const time = new Date(entry.closedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    meta.textContent = entry.url + " \u00b7 " + time;

    info.appendChild(title);
    info.appendChild(meta);

    const reopenBtn = document.createElement("button");
    reopenBtn.className = "reopen-btn";
    reopenBtn.textContent = "Reopen";
    reopenBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "reopenTab", url: entry.url });
      reopenBtn.textContent = "Opened";
      reopenBtn.disabled = true;
    });

    div.appendChild(info);
    div.appendChild(reopenBtn);
    historyListEl.appendChild(div);
  }
}
