// NoStim — Blocked Page Logic

const params = new URLSearchParams(window.location.search);
const site = params.get("site") || "this site";

// --- Theme-specific copy (mirrors the popup's voice) ---
// dark, light and default share the clean copy; medieval & earth get character.
const CONTENT = {
  default: {
    title: "Stay focused",
    subtitle: "This site is blocked while Focus Mode is on.",
    streakLabel: "You've been focused for",
    siteNote: "Trying to reach ",
    breakLabel: "Take a 5-minute break",
    breakStarted: "Break started — back in 5 min",
  },
  medieval: {
    title: "Halt, traveler!",
    subtitle: "This path is forbidden while thy quest endures.",
    streakLabel: "Thou hast held the line for",
    siteNote: "Thou sought passage to ",
    breakLabel: "Rest at the tavern — 5 min",
    breakStarted: "The tavern welcomes thee — 5 min",
  },
  earth: {
    title: "Stay grounded",
    subtitle: "This one's on your blocklist. Take a breath and return to what matters.",
    streakLabel: "Grounded for",
    siteNote: "Trying to reach ",
    breakLabel: "Take a 5-minute breather",
    breakStarted: "Breather started — back in 5 min",
  },
};

const $ = (id) => document.getElementById(id);
let copy = CONTENT.default;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  copy = CONTENT[theme] || CONTENT.default;
  $("title").textContent = copy.title;
  $("subtitle").textContent = copy.subtitle;
  $("streak-label").textContent = copy.streakLabel;
  $("site-note").textContent = copy.siteNote;
  $("break-btn").textContent = copy.breakLabel;
}

$("site-name").textContent = site;

// --- Session timer ---
let timerInterval = null;

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0")
    : m + ":" + String(s).padStart(2, "0");
}

function startTimer(startTime) {
  function update() {
    const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    $("elapsed").textContent = formatElapsed(elapsed);
  }
  update();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(update, 1000);
}

// --- Init: read theme + start time together, then reveal (no FOUC) ---
// Always reveal the page, even if storage is unavailable (e.g. the extension
// was reloaded/updated while this tab was open → "context invalidated").
(async () => {
  let data = {};
  try {
    data = await chrome.storage.local.get(["theme", "focusModeStartTime"]);
  } catch (e) {
    // Fall back to defaults below.
  }
  applyTheme(data.theme || "medieval");
  startTimer(data.focusModeStartTime || Date.now());
  requestAnimationFrame(() => document.body.classList.add("ready"));
})();

// --- Break button ---
$("break-btn").addEventListener("click", async function () {
  this.disabled = true;
  this.textContent = copy.breakStarted;

  await chrome.runtime.sendMessage({ type: "takeBreak", site: site });

  // Validate site looks like a domain before navigating
  const domainPattern = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i;
  if (domainPattern.test(site)) {
    window.location.href = "https://" + site;
  }
});
