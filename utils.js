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
