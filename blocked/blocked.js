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
    cooldownLabel: "Available in",
  },
  medieval: {
    title: "Halt, traveler!",
    subtitle: "This path is forbidden while thy quest endures.",
    streakLabel: "Thou hast held the line for",
    siteNote: "Thou sought passage to ",
    breakLabel: "Rest at the tavern — 5 min",
    breakStarted: "The tavern welcomes thee — 5 min",
    cooldownLabel: "The innkeeper arrives in",
  },
  earth: {
    title: "Stay grounded",
    subtitle: "This one's on your blocklist. Take a breath and return to what matters.",
    streakLabel: "Grounded for",
    siteNote: "Trying to reach ",
    breakLabel: "Take a 5-minute breather",
    breakStarted: "Breather started — back in 5 min",
    cooldownLabel: "Ready in",
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
  // Button text is owned by the cooldown logic (countdown → action label).
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

// --- Friction: cooldown before the break button unlocks ---
// The button stays disabled for COOLDOWN_MS. On the medieval theme an innkeeper
// walks in from the left (appearing after INNKEEPER_DELAY_MS) and tucks behind
// the button just as it unlocks. Wall-clock based so a throttled/background
// tab can't desync the timer; resets on reload (reloading only adds friction).
const COOLDOWN_MS = 20000;
const INNKEEPER_DELAY_MS = 5000;

const breakBtn = $("break-btn");
const innkeeper = $("innkeeper");
const innkeeperSprite = $("innkeeper-sprite");
const prefersReducedMotion =
  !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

let cooldownInterval = null;
let stepInterval = null;
let unlocked = false;

function fmtCountdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function startCooldown() {
  unlocked = false;
  breakBtn.disabled = true;
  const start = Date.now();

  function tick() {
    const remaining = COOLDOWN_MS - (Date.now() - start);
    if (remaining <= 0) {
      unlockBreak();
      return;
    }
    breakBtn.textContent = copy.cooldownLabel + " " + fmtCountdown(remaining);
  }
  tick();
  cooldownInterval = setInterval(tick, 250);

  // Walking innkeeper is medieval-only and motion-gated.
  if (document.documentElement.dataset.theme !== "medieval") return;
  if (prefersReducedMotion) {
    placeInnkeeperStanding();
  } else {
    setTimeout(startInnkeeperWalk, INNKEEPER_DELAY_MS);
  }
}

function unlockBreak() {
  if (unlocked) return;
  unlocked = true;
  if (cooldownInterval) {
    clearInterval(cooldownInterval);
    cooldownInterval = null;
  }
  stopInnkeeper();
  breakBtn.disabled = false;
  breakBtn.textContent = copy.breakLabel;
}

function startInnkeeperWalk() {
  if (unlocked) return; // cooldown already elapsed (e.g. very fast/virtual clock)
  const walkMs = COOLDOWN_MS - INNKEEPER_DELAY_MS;
  // Pin the off-screen start, force a reflow, then transition to centered so
  // the browser actually animates rather than jumping straight to the end.
  innkeeper.style.transition = "none";
  innkeeper.style.transform = "translateX(calc(-50% - 54vw))";
  innkeeper.style.opacity = "1";
  void innkeeper.offsetWidth;
  innkeeper.style.transition = "transform " + walkMs + "ms linear";
  innkeeper.style.transform = "translateX(-50%)";

  // Two-frame walk cycle: alternate stride + a small bob so he reads as walking.
  let toggle = false;
  stepInterval = setInterval(() => {
    toggle = !toggle;
    innkeeperSprite.classList.toggle("step", toggle);
    innkeeperSprite.classList.toggle("bob", toggle);
  }, 280);
}

function stopInnkeeper() {
  if (stepInterval) {
    clearInterval(stepInterval);
    stepInterval = null;
  }
  // Settle into a standing pose (feet-together frame), no bob.
  innkeeperSprite.classList.remove("bob");
  innkeeperSprite.classList.add("step");
}

function placeInnkeeperStanding() {
  // Reduced-motion: no walk-in — he's simply present, standing behind the button.
  innkeeper.style.transition = "none";
  innkeeper.style.transform = "translateX(-50%)";
  innkeeper.style.opacity = "1";
  innkeeperSprite.classList.add("step");
}

// --- Break button ---
breakBtn.addEventListener("click", async function () {
  if (!unlocked || this.disabled) return;
  this.disabled = true;
  this.textContent = copy.breakStarted;

  await chrome.runtime.sendMessage({ type: "takeBreak", site: site });

  // Validate site looks like a domain before navigating
  const domainPattern = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i;
  if (domainPattern.test(site)) {
    window.location.href = "https://" + site;
  }
});

// --- Init: read theme + start time together, then reveal (no FOUC) ---
// Declared last so all cooldown state/consts above are initialized before the
// init path can call startCooldown() (even on the synchronous no-storage path).
// Always reveal the page, even if storage is unavailable (e.g. the extension
// was reloaded/updated while this tab was open → "context invalidated").
(async () => {
  let data = {};
  try {
    if (window.chrome && chrome.storage && chrome.storage.local) {
      data = await chrome.storage.local.get(["theme", "focusModeStartTime"]);
    }
  } catch (e) {
    // Fall back to defaults below.
  }
  applyTheme(data.theme || "medieval");
  startTimer(data.focusModeStartTime || Date.now());
  requestAnimationFrame(() => document.body.classList.add("ready"));
  startCooldown();
})();
