// NoStim — LinkedIn Shield Bridge (ISOLATED world)
// Reads toggle state from chrome.storage and signals the MAIN world script via DOM flag.
// Must run BEFORE linkedin-shield.js (listed first in manifest).

(async function () {
  try {
    const data = await chrome.storage.local.get("linkedinShieldEnabled");
    // Default to ON if not set — safer to block probes by default
    const enabled = data.linkedinShieldEnabled !== false;
    document.documentElement.dataset.focusguardShield = enabled ? "on" : "off";
  } catch (_) {
    // If storage read fails, default to ON
    document.documentElement.dataset.focusguardShield = "on";
  }
})();
