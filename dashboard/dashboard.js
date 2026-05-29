// NoStim — Dashboard Logic

const focusToggle = document.getElementById("focus-toggle");
const shieldToggle = document.getElementById("shield-toggle");
const focusStatus = document.getElementById("focus-status");
const shieldStatus = document.getElementById("shield-status");
const siteInput = document.getElementById("site-input");
const addBtn = document.getElementById("add-btn");
const sitesList = document.getElementById("sites-list");
const siteCount = document.getElementById("site-count");
const themePicker = document.getElementById("theme-picker");
const soundBtn = document.getElementById("sound-btn");
const tabElimStatus = document.getElementById("tab-elim-status");
const tabElimGear = document.getElementById("tab-elim-gear");
const tabElimToggle = document.getElementById("tab-elim-toggle");

let blockedSites = [];
let currentTheme = "default";
let soundEnabled = false;

// --- Init ---

async function init() {
  const state = await chrome.runtime.sendMessage({ type: "getState" });

  focusToggle.checked = !!state.focusModeEnabled;
  shieldToggle.checked = state.linkedinShieldEnabled !== false;
  blockedSites = state.blockedSites || [];
  currentTheme = state.theme || "medieval";
  soundEnabled = !!state.soundEnabled;

  applyTheme(currentTheme);
  updateSoundBtn();
  updateStatusLabels();
  renderSites();

  // Tab Eliminator
  const tabElimEnabled = !!state.tabEliminatorEnabled;
  tabElimToggle.checked = tabElimEnabled;
  updateTabElimStatus(tabElimEnabled);

}

init();

// --- Theme ---

function applyTheme(theme) {
  currentTheme = theme;
  applyThemeShared(theme);
  soundBtn.style.display = theme === "medieval" ? "block" : "none";
}

// Navigate in same tab
tabElimGear.addEventListener("click", (e) => {
  e.stopPropagation();
  window.location.href = chrome.runtime.getURL("tab-eliminator/tab-eliminator.html");
});

tabElimToggle.addEventListener("change", () => {
  toggleTabEliminator();
});

async function toggleTabEliminator() {
  await chrome.runtime.sendMessage({
    type: "toggleTabEliminator",
    enabled: tabElimToggle.checked
  });
  updateTabElimStatus(tabElimToggle.checked);
}

function updateTabElimStatus(enabled) {
  tabElimStatus.textContent = enabled ? "ON" : "OFF";
  tabElimStatus.classList.toggle("active", enabled);
}

themePicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".theme-btn");
  if (!btn) return;

  const theme = btn.dataset.pick;
  applyTheme(theme);
  chrome.runtime.sendMessage({ type: "setTheme", theme });
});

// --- Sound ---

function playSword() {
  new Audio(chrome.runtime.getURL("sounds/sword-draw.mp3")).play();
}

function updateSoundBtn() {
  soundBtn.classList.toggle("unmuted", soundEnabled);
}

soundBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  updateSoundBtn();
  chrome.runtime.sendMessage({ type: "setSoundEnabled", enabled: soundEnabled });
});

// --- Toggle Handlers ---

focusToggle.addEventListener("change", async () => {
  if (!focusToggle.checked && currentTheme === "medieval" && soundEnabled) {
    playSword();
  }
  await chrome.runtime.sendMessage({
    type: "toggleFocusMode",
    enabled: focusToggle.checked
  });
  updateStatusLabels();
});

shieldToggle.addEventListener("change", async () => {
  await chrome.runtime.sendMessage({
    type: "toggleLinkedInShield",
    enabled: shieldToggle.checked
  });
  updateStatusLabels();
});

function updateStatusLabels() {
  focusStatus.textContent = focusToggle.checked ? "ON" : "OFF";
  focusStatus.classList.toggle("active", focusToggle.checked);

  shieldStatus.textContent = shieldToggle.checked ? "ON" : "OFF";
  shieldStatus.classList.toggle("active", shieldToggle.checked);
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

  const count = blockedSites.length;
  siteCount.textContent = count === 1 ? "1 site blocked" : count + " sites blocked";
}

