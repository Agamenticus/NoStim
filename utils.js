// NoStim — Shared Utilities

function sanitizeDomain(input) {
  let site = input.trim().toLowerCase();
  if (!site) return null;

  // Strip protocol, www prefix, paths
  site = site.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

  // Auto-append .com if no TLD present
  if (!site.includes(".")) {
    site += ".com";
  }

  // Fix common truncated TLDs (but NOT .co — it's a valid TLD)
  site = site
    .replace(/\.c$/, ".com")
    .replace(/\.or$/, ".org")
    .replace(/\.ne$/, ".net")
    .replace(/\.ed$/, ".edu");

  // Validate domain format
  const domainPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
  if (!domainPattern.test(site)) return null;

  return site;
}

// --- Theme config + shared application (popup + dashboard) ---

const themeText = {
  default:  { heading: "Blocked Sites", placeholder: "e.g. youtube" },
  medieval: { heading: "Forbidden Scrolls", placeholder: "e.g. cursed parchment" },
  dark:     { heading: "Blocked Sites", placeholder: "e.g. youtube" },
  light:    { heading: "Blocked Sites", placeholder: "e.g. youtube" },
  earth:    { heading: "Blocked Sites", placeholder: "e.g. youtube" },
};

const themeNames = {
  default:  { medieval: "Medieval", light: "Light", dark: "Dark", earth: "Earth", default: "Boring" },
  medieval: { medieval: "Medieval", light: "Holy", dark: "Shadow", earth: "Druid", default: "Peasant" },
};

// Apply the theme bits the popup and dashboard share: the data-theme attribute,
// the blocked-sites heading + input placeholder, and the theme picker's active
// state and per-theme button labels. Page-specific tails (preserve button on
// the popup, sound button on the dashboard) stay in each page's own applyTheme.
// Elements are looked up by ID, so pages lacking them simply no-op.
function applyThemeShared(theme) {
  document.body.dataset.theme = theme;

  const text = themeText[theme] || themeText.default;
  const heading = document.getElementById("sites-heading");
  const input = document.getElementById("site-input");
  if (heading) heading.textContent = text.heading;
  if (input) input.placeholder = text.placeholder;

  const names = themeNames[theme] || themeNames.default;
  const picker = document.getElementById("theme-picker");
  if (picker) {
    picker.querySelectorAll(".theme-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.pick === theme);
      const svg = btn.querySelector("svg");
      if (svg && names[btn.dataset.pick]) {
        svg.nextSibling.textContent = " " + names[btn.dataset.pick];
      }
    });
  }
}
