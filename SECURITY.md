# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in NoStim, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email the maintainer directly or use GitHub's private vulnerability reporting feature on this repository.

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response timeline

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 1 week
- **Fix**: As soon as possible, depending on severity

## Security Design

### Data handling
- All user data is stored locally via `chrome.storage.local`
- No data is transmitted to any external server
- No analytics, tracking, or telemetry

### Content scripts
- LinkedIn Shield runs in the `MAIN` world to intercept page-level APIs
- The extension declares **no** `web_accessible_resources` to remain invisible to fingerprinting scanners
- DOM sanitization is throttled via `requestAnimationFrame` to prevent performance impact

### Permissions
- `<all_urls>` host permission is required for the distraction blocker to redirect any user-configured site
- `tabs` permission is used solely for Tab Eliminator idle tracking and identifying the active tab
- All permissions are documented in the [Privacy Policy](PRIVACY_POLICY.md)

### Extension integrity
- No remote code execution — all scripts are bundled locally
- No `eval()`, `Function()`, or dynamic script loading
- No inline scripts in HTML files (MV3 CSP compliant)
- No `unsafe-eval` in Content Security Policy
