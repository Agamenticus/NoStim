// NoStim — Blocked Page Logic

const params = new URLSearchParams(window.location.search);
const site = params.get("site") || "this site";

document.getElementById("site-name").textContent = site;

// Session timer (single interval, cleared on visibility change)
let timerInterval = null;

async function startTimer() {
  const data = await chrome.storage.local.get("focusModeStartTime");
  const startTime = data.focusModeStartTime || Date.now();

  function update() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const mins = Math.floor((elapsed % 3600) / 60);
    const secs = elapsed % 60;

    let display;
    if (hours > 0) {
      display = hours + ":" + String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
    } else {
      display = mins + ":" + String(secs).padStart(2, "0");
    }
    document.getElementById("elapsed").textContent = display;
  }

  update();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(update, 1000);
}

startTimer();

// Break button
document.getElementById("break-btn").addEventListener("click", async function () {
  this.disabled = true;
  this.textContent = "Break started — 5 minutes";

  await chrome.runtime.sendMessage({ type: "takeBreak", site: site });

  // Validate site looks like a domain before navigating
  const domainPattern = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i;
  if (domainPattern.test(site)) {
    window.location.href = "https://" + site;
  }
});
