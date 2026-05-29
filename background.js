// NoStim — Background Service Worker

const LINKEDIN_BLOCK_RULES = [
  {
    id: 1,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: "||li.protechts.net",
      resourceTypes: ["sub_frame", "script", "xmlhttprequest", "image", "ping", "other"]
    }
  },
  {
    id: 2,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: "||merchantpool1.linkedin.com",
      resourceTypes: ["script", "xmlhttprequest", "sub_frame", "image", "ping", "other"]
    }
  },
  {
    id: 3,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: "*/sensorCollect*",
      resourceTypes: ["xmlhttprequest", "ping", "other"]
    }
  }
];

// Distraction rules start at ID 100 to avoid collisions with LinkedIn rules
const DISTRACTION_RULE_OFFSET = 100;

// --- Initialization ---

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get([
    "focusModeEnabled",
    "blockedSites",
    "linkedinShieldEnabled",
    "theme",
    "soundEnabled",
    "tabEliminatorEnabled",
    "tabEliminatorDays",
    "preservedUrls",
    "tabLastActive",
    "closedTabsHistory"
  ]);

  const defaults = {};
  if (data.focusModeEnabled === undefined) defaults.focusModeEnabled = false;
  if (data.blockedSites === undefined)
    defaults.blockedSites = [
      "youtube.com",
      "instagram.com",
      "reddit.com",
      "tiktok.com"
    ];
  if (data.linkedinShieldEnabled === undefined)
    defaults.linkedinShieldEnabled = true;
  if (data.theme === undefined) defaults.theme = "medieval";
  if (data.soundEnabled === undefined) defaults.soundEnabled = false;
  if (data.tabEliminatorEnabled === undefined) defaults.tabEliminatorEnabled = false;
  if (data.tabEliminatorDays === undefined) defaults.tabEliminatorDays = 3;
  if (data.preservedUrls === undefined) defaults.preservedUrls = [];
  if (data.tabLastActive === undefined) defaults.tabLastActive = {};
  if (data.closedTabsHistory === undefined) defaults.closedTabsHistory = [];

  if (Object.keys(defaults).length > 0) {
    await chrome.storage.local.set(defaults);
  }

  await syncAllRules();
  await initTabEliminator();
});

chrome.runtime.onStartup.addListener(async () => {
  await syncAllRules();
  await initTabEliminator();
});

async function syncAllRules() {
  const data = await chrome.storage.local.get([
    "focusModeEnabled",
    "blockedSites",
    "linkedinShieldEnabled"
  ]);

  await updateLinkedInRules(data.linkedinShieldEnabled !== false);

  if (data.focusModeEnabled) {
    await updateDistractionRules(data.blockedSites || []);
  } else {
    await clearDistractionRules();
  }
}

// --- LinkedIn Shield Rules ---

async function updateLinkedInRules(enabled) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const linkedinIds = existing
    .filter((r) => r.id >= 1 && r.id < DISTRACTION_RULE_OFFSET)
    .map((r) => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: linkedinIds,
    addRules: enabled ? LINKEDIN_BLOCK_RULES : []
  });
}

// --- Distraction Blocker Rules ---

async function updateDistractionRules(sites) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const distractionIds = existing
    .filter((r) => r.id >= DISTRACTION_RULE_OFFSET)
    .map((r) => r.id);

  const newRules = [];

  if (sites.length > 0) {
    // Exempt our own extension pages from the redirect rules below. The block
    // page carries the site in its query (?site=reddit.com), which would
    // otherwise re-match "||reddit.com" and Chrome aborts the self-redirect as
    // ERR_BLOCKED_BY_CLIENT. A higher-priority allow rule wins, so the block
    // page (and any extension page) always loads.
    newRules.push({
      id: DISTRACTION_RULE_OFFSET,
      priority: 2,
      action: { type: "allow" },
      condition: {
        urlFilter: "|chrome-extension://" + chrome.runtime.id + "/",
        resourceTypes: ["main_frame"]
      }
    });

    sites.forEach((site, i) => {
      newRules.push({
        id: DISTRACTION_RULE_OFFSET + 1 + i,
        priority: 1,
        action: {
          type: "redirect",
          redirect: {
            extensionPath:
              "/blocked/blocked.html?site=" + encodeURIComponent(site)
          }
        },
        condition: {
          urlFilter: "||" + site,
          resourceTypes: ["main_frame"]
        }
      });
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: distractionIds,
    addRules: newRules
  });
}

async function clearDistractionRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const distractionIds = existing
    .filter((r) => r.id >= DISTRACTION_RULE_OFFSET)
    .map((r) => r.id);

  if (distractionIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: distractionIds
    });
  }
}

// --- Tab Eliminator ---

async function initTabEliminator() {
  const data = await chrome.storage.local.get([
    "tabEliminatorEnabled",
    "tabLastActive"
  ]);

  if (!data.tabEliminatorEnabled) {
    await chrome.alarms.clear("tabEliminator");
    return;
  }

  // Create hourly alarm
  chrome.alarms.create("tabEliminator", { periodInMinutes: 60 });

  // Seed timestamps for tabs that don't have one
  const allTabs = await chrome.tabs.query({});
  const tabLastActive = data.tabLastActive || {};
  const existingTabIds = new Set(allTabs.map((t) => String(t.id)));

  // Add missing tabs
  for (const tab of allTabs) {
    if (!tabLastActive[tab.id]) {
      tabLastActive[tab.id] = Date.now();
    }
  }

  // Prune stale entries
  for (const id of Object.keys(tabLastActive)) {
    if (!existingTabIds.has(id)) {
      delete tabLastActive[id];
    }
  }

  await chrome.storage.local.set({ tabLastActive });
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function runTabCleanup() {
  const data = await chrome.storage.local.get([
    "tabEliminatorEnabled",
    "tabEliminatorDays",
    "preservedUrls",
    "tabLastActive",
    "closedTabsHistory"
  ]);

  if (!data.tabEliminatorEnabled) return;

  const thresholdMs = (data.tabEliminatorDays || 3) * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const preservedUrls = data.preservedUrls || [];
  const tabLastActive = data.tabLastActive || {};

  // Clean history: keep only today's entries
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  let closedTabsHistory = (data.closedTabsHistory || []).filter(
    (e) => e.closedAt >= todayStart.getTime()
  );

  const allTabs = await chrome.tabs.query({});

  // Group by window for last-tab safety
  const tabsByWindow = {};
  for (const tab of allTabs) {
    if (!tabsByWindow[tab.windowId]) tabsByWindow[tab.windowId] = [];
    tabsByWindow[tab.windowId].push(tab);
  }

  const tabsToClose = [];

  for (const tab of allTabs) {
    if (tab.pinned) continue;
    if (tab.active) continue;
    if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) continue;

    const tabDomain = extractDomain(tab.url);
    if (preservedUrls.some((p) => tabDomain === p || tabDomain.endsWith("." + p))) continue;

    const lastActive = tabLastActive[tab.id];
    if (!lastActive) continue;
    if (now - lastActive < thresholdMs) continue;

    // Don't close the last unpinned tab in a window
    const windowTabs = tabsByWindow[tab.windowId];
    const remainingUnpinned = windowTabs.filter(
      (t) => !t.pinned && !tabsToClose.some((c) => c.id === t.id)
    );
    if (remainingUnpinned.length <= 1) continue;

    tabsToClose.push(tab);
  }

  for (const tab of tabsToClose) {
    closedTabsHistory.push({
      url: tab.url,
      title: tab.title || tab.url,
      closedAt: now
    });
    delete tabLastActive[tab.id];
  }

  if (tabsToClose.length > 0) {
    await chrome.tabs.remove(tabsToClose.map((t) => t.id));

    // Show badge with count of closed tabs
    chrome.action.setBadgeBackgroundColor({ color: "#f44336" });
    chrome.action.setBadgeText({ text: String(tabsToClose.length) });
    // Clear badge after 30 seconds
    chrome.alarms.create("clearBadge", { delayInMinutes: 0.5 });
  }

  // Cap history at 100 entries
  if (closedTabsHistory.length > 100) {
    closedTabsHistory = closedTabsHistory.slice(-100);
  }

  try {
    await chrome.storage.local.set({ tabLastActive, closedTabsHistory });
  } catch (err) {
    // Storage quota exceeded — trim history aggressively and retry
    closedTabsHistory = closedTabsHistory.slice(-20);
    await chrome.storage.local.set({ tabLastActive, closedTabsHistory });
  }
}

// Track tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const data = await chrome.storage.local.get([
    "tabEliminatorEnabled",
    "tabLastActive"
  ]);
  if (!data.tabEliminatorEnabled) return;

  const tabLastActive = data.tabLastActive || {};
  tabLastActive[activeInfo.tabId] = Date.now();
  await chrome.storage.local.set({ tabLastActive });
});

// Clean up closed tab entries
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const data = await chrome.storage.local.get("tabLastActive");
  const tabLastActive = data.tabLastActive || {};
  delete tabLastActive[tabId];
  await chrome.storage.local.set({ tabLastActive });
});

// Alarm handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "tabEliminator") {
    await runTabCleanup();
  } else if (alarm.name === "clearBadge") {
    chrome.action.setBadgeText({ text: "" });
  } else if (alarm.name.startsWith("breakEnd_")) {
    const current = await chrome.storage.local.get([
      "blockedSites",
      "focusModeEnabled"
    ]);
    if (current.focusModeEnabled) {
      await updateDistractionRules(current.blockedSites || []);
    }
  }
});

// --- Message Handling ---

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message || "Unknown error" }));
  return true; // Required for async sendResponse
});

async function handleMessage(msg) {
  switch (msg.type) {
    case "getState":
      return chrome.storage.local.get([
        "focusModeEnabled",
        "focusModeStartTime",
        "blockedSites",
        "linkedinShieldEnabled",
        "theme",
        "soundEnabled",
        "tabEliminatorEnabled",
        "tabEliminatorDays",
        "preservedUrls",
        "closedTabsHistory"
      ]);

    case "setTheme":
      await chrome.storage.local.set({ theme: msg.theme });
      return { success: true };

    case "setSoundEnabled":
      await chrome.storage.local.set({ soundEnabled: msg.enabled });
      return { success: true };

    case "toggleFocusMode": {
      const updates = { focusModeEnabled: msg.enabled };
      if (msg.enabled) {
        updates.focusModeStartTime = Date.now();
        const data = await chrome.storage.local.get("blockedSites");
        await updateDistractionRules(data.blockedSites || []);
      } else {
        updates.focusModeStartTime = null;
        await clearDistractionRules();
      }
      await chrome.storage.local.set(updates);
      return { success: true };
    }

    case "toggleLinkedInShield":
      await chrome.storage.local.set({
        linkedinShieldEnabled: msg.enabled
      });
      await updateLinkedInRules(msg.enabled);
      return { success: true };

    case "updateBlockedSites": {
      await chrome.storage.local.set({ blockedSites: msg.sites });
      const data = await chrome.storage.local.get("focusModeEnabled");
      if (data.focusModeEnabled) {
        await updateDistractionRules(msg.sites);
      }
      return { success: true };
    }

    case "takeBreak": {
      const data = await chrome.storage.local.get([
        "blockedSites",
        "focusModeEnabled"
      ]);
      if (!data.focusModeEnabled) return { success: true };

      const sites = data.blockedSites || [];
      const filtered = sites.filter((s) => s !== msg.site);
      await updateDistractionRules(filtered);

      // Use chrome.alarms instead of setTimeout (survives worker suspension)
      chrome.alarms.create("breakEnd_" + msg.site, { delayInMinutes: 5 });

      return { success: true };
    }

    // --- Tab Eliminator Messages ---

    case "toggleTabEliminator": {
      await chrome.storage.local.set({ tabEliminatorEnabled: msg.enabled });
      if (msg.enabled) {
        await initTabEliminator();
      } else {
        await chrome.alarms.clear("tabEliminator");
      }
      return { success: true };
    }

    case "setTabEliminatorDays":
      await chrome.storage.local.set({ tabEliminatorDays: msg.days });
      return { success: true };

    case "preserveUrl": {
      const data = await chrome.storage.local.get("preservedUrls");
      const urls = data.preservedUrls || [];
      // Accept both full URLs and bare domains
      const domain = msg.url.includes("://") ? extractDomain(msg.url) : msg.url.replace(/^www\./, "");
      if (domain && !urls.includes(domain)) {
        urls.push(domain);
        await chrome.storage.local.set({ preservedUrls: urls });
      }
      return { success: true, domain };
    }

    case "removePreservedUrl": {
      const data = await chrome.storage.local.get("preservedUrls");
      const urls = (data.preservedUrls || []).filter((u) => u !== msg.url);
      await chrome.storage.local.set({ preservedUrls: urls });
      return { success: true };
    }

    case "getClosedTabsHistory": {
      const data = await chrome.storage.local.get("closedTabsHistory");
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const history = (data.closedTabsHistory || []).filter(
        (e) => e.closedAt >= todayStart.getTime()
      );
      return { history };
    }

    case "reopenTab":
      await chrome.tabs.create({ url: msg.url });
      return { success: true };

    default:
      return { error: "Unknown message type" };
  }
}
