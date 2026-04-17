# Privacy Policy — NoStim

**Last updated: April 17, 2026**

## Data Collection

NoStim does **not** collect, transmit, or share any personal data. All data stays on your device.

## What We Store Locally

NoStim uses `chrome.storage.local` (your browser's local storage) to save your preferences:

- Focus mode on/off state
- Your blocked sites list
- Theme preference
- Tab Eliminator settings (idle threshold, preserved URLs)
- Tab activity timestamps (used only to determine idle tabs)
- Today's closed tab history (URLs and titles of tabs auto-closed by Tab Eliminator)

This data **never leaves your browser**. It is not synced, uploaded, or shared with any server, third party, or analytics service.

## LinkedIn Shield

The LinkedIn Shield feature blocks LinkedIn's extension fingerprinting by intercepting network requests on linkedin.com pages. It does **not** read, collect, or store any LinkedIn data. It only prevents outbound fingerprinting probes.

## Permissions

- **storage**: Save your settings locally.
- **declarativeNetRequest**: Block fingerprinting endpoints and redirect blocked sites.
- **tabs**: Track tab activity for Tab Eliminator and identify the current tab for the Preserve feature.
- **alarms**: Schedule periodic tab cleanup checks.
- **host_permissions (`<all_urls>`)**: Required so the distraction blocker can redirect any user-configured site to the blocked page. Only sites you explicitly add to your block list are affected.

## Third-Party Services

NoStim uses **no** third-party services, analytics, tracking, or external APIs. The only external request is loading the MedievalSharp font from Google Fonts for the Medieval theme.

## Changes

If this policy changes, the update will be included in the extension update with a new version number.

## Contact

For questions about this policy, open an issue at the project's GitHub repository.
