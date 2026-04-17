# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NoStim** is a Chrome extension (MV3) with two core features:

1. **LinkedIn Extension Fingerprint Blocker** — Prevents LinkedIn from detecting installed browser extensions via its "BrowserGate" scanning techniques.
2. **Distraction Blocker (Stim Tab Guard)** — A toggleable focus mode that blocks user-defined distracting websites with a clean interception page.

No build system — vanilla JavaScript, load unpacked in Chrome.

## How LinkedIn's Extension Scanning Works

LinkedIn uses THREE detection methods we counter:

### Method 1: Active Extension Detection (AED) — fetch() probing

LinkedIn's JS bundle contains 6,000+ Chrome extension IDs paired with known `web_accessible_resources` paths. On every page load, it fires fetch requests like:

```
fetch("chrome-extension://cjpalhdlnbpafiamejdnhcphjbkeiagm/web_accessible_resources/noop.txt")
```

If fetch succeeds → extension is installed. LinkedIn tests every extension via `Promise.allSettled()`.

**How to block**: Intercept fetch/XHR calls to `chrome-extension://` URLs from LinkedIn's page context. Override `fetch()` and `XMLHttpRequest` on LinkedIn pages to silently reject requests targeting `chrome-extension://` protocol.

### Method 2: DOM Spectroscopy — scanning for extension artifacts

LinkedIn walks the entire DOM looking for elements/attributes containing `chrome-extension://` URL strings.

**How to block**: Use a `MutationObserver` to sanitize/remove `chrome-extension://` references from DOM attributes and text nodes before LinkedIn's scan reads them.

### Method 3: Device/Browser Fingerprinting

LinkedIn collects 48+ browser fingerprint data points (CPU cores, memory, screen resolution, timezone, etc.) sent alongside extension data.

**How to block**: Optionally spoof/randomize fingerprintable APIs on LinkedIn pages. Secondary feature — focus on extension detection blocking first.

### Detection Endpoints to Block

Block via `declarativeNetRequest`:
- `li.protechts.net` (HUMAN Security iframe — hidden 0x0 pixel iframe)
- `merchantpool1.linkedin.com` (Merchant Pool script)
- URLs containing `/sensorCollect`

### Important Technical Detail

The scanning script lives in a Webpack chunk (~2.7 MB), loads on every LinkedIn page visit, uses `requestIdleCallback` to defer scanning, and can operate in parallel or sequential mode.

## Architecture

### Extension Components

```
nostim/
├── manifest.json              # MV3 manifest
├── background.js              # Service worker: manages state, declarativeNetRequest rules
├── content-scripts/
│   ├── linkedin-shield.js         # MAIN world script — patches fetch/XHR on linkedin.com
│   ├── linkedin-shield-bridge.js  # ISOLATED world script — reads toggle state, signals MAIN
│   └── distraction-blocker.js     # Content script for blocked sites — shows block page
├── popup/
│   ├── popup.html             # Toggle UI + blocked sites manager
│   ├── popup.js               # Popup logic
│   └── popup.css              # Popup styles (dark theme, toggle switch like an ad blocker)
├── blocked/
│   └── blocked.html           # Full-page "you're in focus mode" interception page
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── CLAUDE.md                  # This file
└── README.md
```

### How the Parts Connect

```
popup.js ──chrome.storage──►  background.js (reads toggle state, blocked URLs list)
                                  │
                                  ├──►  linkedin-shield.js (injected on linkedin.com/*)
                                  │     Overrides fetch() and XHR to block chrome-extension:// probes
                                  │     Runs MutationObserver to sanitize DOM spectroscopy targets
                                  │     Blocks fingerprinting endpoints via declarativeNetRequest
                                  │
                                  └──►  distraction-blocker.js (injected on user-defined blocked sites)
                                       When focus mode is ON: redirects to blocked.html
                                       When focus mode is OFF: does nothing
```

### State Management

All state lives in `chrome.storage.local` (NOT in service worker variables — they get wiped on suspend):

```javascript
{
  focusModeEnabled: true/false,     // Is distraction blocker active
  focusModeStartTime: null/number,  // Timestamp when focus mode was last enabled (for session timer)
  blockedSites: [                   // User-configured blocked URLs
    "youtube.com",
    "instagram.com",
    "reddit.com",
    "tiktok.com"
  ]
}
```

**Note**: There is NO toggle for LinkedIn protection. It is always active whenever the extension is installed. The content script runs unconditionally on LinkedIn pages via the manifest's `content_scripts` declaration. If you don't want the protection, you uninstall the extension.

## Feature 1: LinkedIn Extension Fingerprint Blocker

### Content Script: `linkedin-shield.js`

Runs on: `*://*.linkedin.com/*`
Run at: `document_start` (MUST run before LinkedIn's scripts execute)
World: `MAIN` (must run in the page's JS context to intercept fetch/XHR)

### Toggle-awareness

Because `linkedin-shield.js` runs in the `MAIN` world, it cannot directly access `chrome.storage`. It needs a companion content script running in the `ISOLATED` world that reads the toggle state and communicates it via `window.postMessage` or a DOM flag (e.g., a data attribute on `<html>`). The MAIN world script checks this flag before activating its overrides.

**Architecture for toggle support:**

1. `linkedin-shield-bridge.js` (ISOLATED world, `document_start`) — reads `chrome.storage.local` for `linkedinShieldEnabled`, posts the state to the page via `window.postMessage` or sets `document.documentElement.dataset.nostimShield = "on"/"off"`
2. `linkedin-shield.js` (MAIN world, `document_start`) — reads the flag and conditionally patches fetch/XHR

**Important**: The bridge script must run BEFORE the main script. List it first in the manifest's content_scripts array. Since both run at `document_start`, the bridge (ISOLATED) executes first and sets the flag synchronously before the MAIN world script reads it.

**Fallback behavior**: If the flag is missing (e.g., storage hasn't loaded yet), default to shield ON — it's safer to block probes by default than to miss them.

### Core defense — Override fetch()

```javascript
// Intercept fetch() to block chrome-extension:// probes
const originalFetch = window.fetch;
window.fetch = function(resource, init) {
  const url = (resource instanceof Request) ? resource.url : String(resource);
  if (url.startsWith('chrome-extension://')) {
    return Promise.reject(new TypeError('Failed to fetch'));
  }
  return originalFetch.apply(this, arguments);
};
```

### Core defense — Override XMLHttpRequest

Same pattern: intercept `open()` and reject requests targeting `chrome-extension://` URLs.

### DOM Spectroscopy defense — MutationObserver

Watch for DOM mutations and strip `chrome-extension://` references from element attributes and text content before LinkedIn's spectroscopy scanner reads them.

### Fingerprint endpoint blocking

Use `declarativeNetRequest` rules in background.js to block requests to:
- `li.protechts.net`
- `merchantpool1.linkedin.com`
- URLs containing `/sensorCollect`

### Important Considerations

- The content script MUST run at `document_start` to patch fetch/XHR before LinkedIn's bundle loads
- Use `"world": "MAIN"` in manifest to inject into the page context (not the isolated extension world)
- Our OWN extension should NOT declare any `web_accessible_resources` — this keeps us invisible to scanners
- Do not inject any DOM elements with `chrome-extension://` references into LinkedIn pages

## Feature 2: Distraction Blocker (Stim Tab Guard)

### How It Works

1. User adds URLs to block list via popup (e.g., youtube.com, instagram.com)
2. User toggles "Focus Mode" on via the popup toggle switch
3. When focus mode is ON:
   - Use `declarativeNetRequest` to dynamically add/remove redirect rules
   - Any navigation to a blocked domain gets redirected to `blocked.html`
   - `blocked.html` shows a clean "You're in focus mode" message with a timer
4. When focus mode is OFF:
   - All blocking rules are removed
   - Normal browsing resumes

### Dynamic Rule Management

Use `chrome.declarativeNetRequest.updateDynamicRules()` to add/remove blocking rules. Each blocked site gets a rule like:

```javascript
{
  id: ruleId,
  priority: 1,
  action: { type: "redirect", redirect: { extensionPath: "/blocked/blocked.html" } },
  condition: {
    urlFilter: "||youtube.com",
    resourceTypes: ["main_frame"]
  }
}
```

### Popup UI Design

Dark theme with:
- **Two toggle switches** at the top (like uBlock Origin slider):
  - **Focus Mode** toggle — controls distraction blocking. Status text: "Focus Mode: ON/OFF" with color coding (green = on, muted = off)
  - **LinkedIn Shield** toggle — controls extension fingerprint protection. Status text: "LinkedIn Shield: ON/OFF"
- Below the toggles: a list of blocked sites with ability to add/remove URLs
- "Add site" input field with a + button
- Each blocked site shown as a pill/tag with an × to remove

### Blocked Page (`blocked.html`)

A clean, full-page interception screen:
- Centered message: "Stay focused!" or similar
- Shows which site was blocked
- Shows how long focus mode has been active
- Optional: a "Take a 5-minute break" button that temporarily allows the site
- Dark theme consistent with the popup

## Manifest Configuration

```json
{
  "manifest_version": 3,
  "name": "NoStim",
  "version": "1.0.0",
  "description": "Block LinkedIn extension fingerprinting and stay focused by blocking distracting sites.",
  "permissions": [
    "storage",
    "declarativeNetRequest",
    "activeTab"
  ],
  "host_permissions": [
    "*://*.linkedin.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["*://*.linkedin.com/*"],
      "js": ["content-scripts/linkedin-shield-bridge.js"],
      "run_at": "document_start",
      "world": "ISOLATED"
    },
    {
      "matches": ["*://*.linkedin.com/*"],
      "js": ["content-scripts/linkedin-shield.js"],
      "run_at": "document_start",
      "world": "MAIN"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

**Critical**: Do NOT add `web_accessible_resources` to this manifest. Our extension must be invisible to fingerprinting scanners.

## Key MV3 Rules — Must Follow

- **No inline scripts**: All JS in separate .js files. No `onclick=""` in HTML.
- **No remote code**: Cannot load scripts from CDNs. Everything bundled locally.
- **No persistent background**: Service worker suspends when idle. All state in `chrome.storage`.
- **Return true in async message listeners**: Required for async `sendResponse`.
- **Minimal permissions**: Only request what we use.
- **CSP**: MV3 default is strict. No `unsafe-eval`.

## Common Pitfalls

1. `linkedin-shield.js` must use `"world": "MAIN"` — The default ISOLATED world cannot intercept the page's `fetch()` calls.
2. `linkedin-shield.js` must run at `document_start` — If it runs later, LinkedIn's scanning script may have already executed.
3. Don't store state in service worker variables — Use `chrome.storage.local`. The worker suspends at any time.
4. Dynamic declarativeNetRequest rules have ID limits — Chrome allows up to 5,000 dynamic rules. Track rule IDs carefully.
5. `blocked.html` needs to be a valid redirect target — `declarativeNetRequest` redirect actions require the target to be part of the extension.
6. The popup is destroyed on close — Don't run long tasks from popup.js. Delegate to the service worker.
7. Test on actual LinkedIn — Open DevTools console on linkedin.com. Before our extension: hundreds of red `chrome-extension://` fetch errors. After: those should be silently caught by our override.

## Testing Checklist

### LinkedIn Shield
- [ ] Open LinkedIn with extension loaded
- [ ] Open DevTools Console — confirm NO visible `chrome-extension://` fetch errors
- [ ] Check Network tab — no requests to `li.protechts.net` or `/sensorCollect`
- [ ] Verify LinkedIn still functions normally (login, feed, messaging)
- [ ] Confirm our extension has NO web_accessible_resources exposed

### Distraction Blocker
- [ ] Toggle focus mode ON in popup
- [ ] Navigate to blocked site → should see blocked.html
- [ ] Toggle focus mode OFF → blocked site loads normally
- [ ] Add new site to block list → immediately blocked when focus mode is on
- [ ] Remove site from block list → no longer blocked
- [ ] Close/reopen browser → state persists
- [ ] Blocked page shows correct site name and session timer

### General
- [ ] Extension icon reflects state (on/off indicator)
- [ ] No errors in service worker console
- [ ] No performance impact on normal browsing
- [ ] Popup state persists across opens/closes
