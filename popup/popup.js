// NoStim — Popup Logic

const focusToggle = document.getElementById("focus-toggle");
const focusStatus = document.getElementById("focus-status");
const siteInput = document.getElementById("site-input");
const addBtn = document.getElementById("add-btn");
const sitesList = document.getElementById("sites-list");
const seeAllBtn = document.getElementById("see-all-btn");
const gearBtn = document.getElementById("gear-btn");
const paletteBtn = document.getElementById("palette-btn");
const themePicker = document.getElementById("theme-picker");
const tabStatus = document.getElementById("tab-status");
const preserveBtn = document.getElementById("preserve-btn");
const preserveBtnText = document.getElementById("preserve-btn-text");

let blockedSites = [];
let currentTheme = "default";
let soundEnabled = false;
let tabIsPreserved = false;

// --- Init ---

document.addEventListener("DOMContentLoaded", async () => {
  const state = await chrome.runtime.sendMessage({ type: "getState" });

  focusToggle.checked = !!state.focusModeEnabled;
  blockedSites = state.blockedSites || [];
  currentTheme = state.theme || "medieval";
  soundEnabled = !!state.soundEnabled;

  applyTheme(currentTheme);
  updateStatusLabel();
  renderSites();

  // Tab Eliminator status
  if (state.tabEliminatorEnabled) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const preservedUrls = state.preservedUrls || [];
    const days = state.tabEliminatorDays || 3;

    if (tab && tab.url) {
      let domain;
      try { domain = new URL(tab.url).hostname.replace(/^www\./, ""); } catch { domain = ""; }
      tabIsPreserved = preservedUrls.some((p) => domain === p || domain.endsWith("." + p));
    }

    updateTabStatus(days);
    preserveBtn.style.display = "flex";
    updatePreserveBtn();
  }

  requestAnimationFrame(() => {
    document.body.classList.add("ready");
  });
});

// --- Theme ---

function applyTheme(theme) {
  currentTheme = theme;
  applyThemeShared(theme);

  // Update preserve/spare text if visible
  if (preserveBtn.style.display !== "none") {
    updatePreserveBtn();
    if (tabStatus.style.display !== "none") {
      // Re-read days to update status text
      chrome.runtime.sendMessage({ type: "getState" }).then((s) => {
        updateTabStatus(s.tabEliminatorDays || 3);
      });
    }
  }
}

paletteBtn.addEventListener("click", () => {
  const visible = themePicker.style.display !== "none";
  themePicker.style.display = visible ? "none" : "flex";
});

themePicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".theme-btn");
  if (!btn) return;

  const theme = btn.dataset.pick;
  applyTheme(theme);
  themePicker.style.display = "none";
  chrome.runtime.sendMessage({ type: "setTheme", theme });
});

// --- Settings Page ---

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
}

gearBtn.addEventListener("click", openDashboard);
seeAllBtn.addEventListener("click", openDashboard);

// --- Tab Eliminator ---

function updateTabStatus(days) {
  tabStatus.style.display = "inline";
  if (tabIsPreserved) {
    tabStatus.textContent = currentTheme === "medieval" ? "Spared" : "Preserved";
    tabStatus.classList.add("preserved");
  } else {
    tabStatus.textContent = "Deletes in " + days + " day" + (days !== 1 ? "s" : "");
    tabStatus.classList.remove("preserved");
  }
}

function updatePreserveBtn() {
  if (tabIsPreserved) {
    preserveBtnText.textContent = currentTheme === "medieval" ? "Spared" : "Preserved";
    preserveBtn.classList.add("preserved");
  } else {
    preserveBtnText.textContent = currentTheme === "medieval" ? "Spare this tab" : "Preserve this tab";
    preserveBtn.classList.remove("preserved");
  }
}

preserveBtn.addEventListener("click", async () => {
  if (preserveBtn.disabled) return;
  preserveBtn.disabled = true;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) { preserveBtn.disabled = false; return; }

  let domain;
  try { domain = new URL(tab.url).hostname.replace(/^www\./, ""); } catch { return; }

  if (tabIsPreserved) {
    await chrome.runtime.sendMessage({ type: "removePreservedUrl", url: domain });
    tabIsPreserved = false;
  } else {
    await chrome.runtime.sendMessage({ type: "preserveUrl", url: tab.url });
    tabIsPreserved = true;
  }

  const state = await chrome.runtime.sendMessage({ type: "getState" });
  const days = state.tabEliminatorDays || 3;
  updateTabStatus(days);
  updatePreserveBtn();
  preserveBtn.disabled = false;
});

// --- Toggle Handler ---

focusToggle.addEventListener("change", async () => {
  if (!focusToggle.checked && currentTheme === "medieval" && soundEnabled) {
    new Audio(chrome.runtime.getURL("sounds/sword-draw.mp3")).play();
  }
  await chrome.runtime.sendMessage({
    type: "toggleFocusMode",
    enabled: focusToggle.checked
  });
  updateStatusLabel();
});

function updateStatusLabel() {
  focusStatus.textContent = focusToggle.checked ? "ON" : "OFF";
  focusStatus.classList.toggle("active", focusToggle.checked);
}

// --- Blocked Sites Management ---

addBtn.addEventListener("click", addSite);
siteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSite();
});

function addSite() {
  const site = sanitizeDomain(siteInput.value);
  if (!site) {
    if (siteInput.value.trim()) {
      siteInput.classList.add("invalid");
      setTimeout(() => siteInput.classList.remove("invalid"), 600);
    }
    return;
  }

  if (blockedSites.includes(site)) {
    siteInput.value = "";
    return;
  }

  blockedSites.push(site);
  siteInput.value = "";

  chrome.runtime.sendMessage({ type: "updateBlockedSites", sites: blockedSites });
  renderSites();
}

function removeSite(site) {
  blockedSites = blockedSites.filter((s) => s !== site);
  chrome.runtime.sendMessage({ type: "updateBlockedSites", sites: blockedSites });
  renderSites();
}

function renderSites() {
  sitesList.innerHTML = "";
  for (const site of blockedSites) {
    const li = document.createElement("li");
    li.className = "site-pill";

    const label = document.createElement("span");
    label.textContent = site;

    const btn = document.createElement("button");
    btn.className = "remove-btn";
    btn.textContent = "\u00d7";
    btn.addEventListener("click", () => removeSite(site));

    li.appendChild(label);
    li.appendChild(btn);
    sitesList.appendChild(li);
  }

  requestAnimationFrame(() => {
    seeAllBtn.style.display =
      sitesList.scrollHeight > sitesList.clientHeight ? "block" : "none";
  });
}
