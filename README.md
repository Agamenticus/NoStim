# NoStim

Stay focused by blocking distracting sites. No stim lock in.

## Features

### Focus Mode
Toggle-controlled site blocker. Add sites like youtube.com, reddit.com, or instagram.com to your block list. When Focus Mode is on, navigating to any blocked site shows a "Stay focused" interception page with a session timer and optional 5-minute break button.

### LinkedIn Shield
Prevents LinkedIn from detecting your installed browser extensions. LinkedIn scans for 6,000+ extensions using fetch probes, DOM spectroscopy, and fingerprinting endpoints. NoStim intercepts all three vectors:
- Overrides `fetch()` and `XMLHttpRequest` to silently reject `chrome-extension://` probes
- Sanitizes DOM elements that reference extension URLs
- Blocks requests to `li.protechts.net`, `merchantpool1.linkedin.com`, and `/sensorCollect` endpoints

### Tab Eliminator
Automatically closes tabs that haven't been active in a configurable number of days (default: 3). Pinned tabs and preserved URLs are always safe. Closed tabs are logged with a reopen option.

### Themes
Five visual themes: Medieval (default), Light, Dark, Earth, and Boring. The Medieval theme uses the MedievalSharp font with flavor text throughout ("Forbidden Scrolls", "Spare this tab", etc.).

## Install

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select this folder
5. Click the NoStim icon in your toolbar to get started

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save settings locally on your device |
| `declarativeNetRequest` | Block fingerprinting endpoints and redirect blocked sites |
| `tabs` | Track tab activity for Tab Eliminator, identify current tab for Preserve |
| `alarms` | Schedule periodic tab cleanup and break timers |
| `<all_urls>` | Redirect any user-configured blocked site to the interception page |

All data stays local. No analytics, no tracking, no external servers.

## File Structure

```
├── manifest.json                  # Extension manifest (MV3)
├── background.js                  # Service worker
├── utils.js                       # Shared domain sanitization
├── themes.css                     # CSS custom properties for all themes
├── content-scripts/
│   ├── linkedin-shield.js         # MAIN world — patches fetch/XHR
│   └── linkedin-shield-bridge.js  # ISOLATED world — reads toggle state
├── popup/                         # Toolbar popup (320px dropdown)
├── dashboard/                     # Full-page settings
├── tab-eliminator/                # Tab Eliminator settings page
├── blocked/                       # Focus mode interception page
├── icons/                         # Extension icons
└── sounds/                        # Theme audio
```
