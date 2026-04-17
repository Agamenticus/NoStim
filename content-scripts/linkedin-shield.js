// NoStim — LinkedIn Shield (MAIN world)
// Intercepts fetch/XHR to block chrome-extension:// probes and
// sanitizes the DOM to defeat LinkedIn's extension fingerprinting.

(function () {
  "use strict";

  // Read toggle flag set by the bridge script (ISOLATED world).
  // Default to ON if missing — safer to block than to miss probes.
  const flag = document.documentElement.dataset.focusguardShield;
  if (flag === "off") return;

  // --- 1. Override fetch() ---
  const originalFetch = window.fetch;
  window.fetch = function (resource, init) {
    const url =
      resource instanceof Request ? resource.url : String(resource);
    if (url.startsWith("chrome-extension://")) {
      return Promise.reject(new TypeError("Failed to fetch"));
    }
    return originalFetch.apply(this, arguments);
  };

  // --- 2. Override XMLHttpRequest ---
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (String(url).startsWith("chrome-extension://")) {
      // Store a flag so send() becomes a no-op that fires an error event
      this._focusguardBlocked = true;
      // Still call original open with a safe URL so internal state is valid
      return originalOpen.call(this, method, "about:blank");
    }
    return originalOpen.apply(this, arguments);
  };

  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    if (this._focusguardBlocked) {
      // Simulate a network error
      Object.defineProperty(this, "status", { value: 0 });
      Object.defineProperty(this, "readyState", { value: 4 });
      this.dispatchEvent(new Event("error"));
      return;
    }
    return originalSend.apply(this, arguments);
  };

  // --- 3. DOM Spectroscopy Defense — MutationObserver ---
  const EXTENSION_PATTERN = /chrome-extension:\/\//;

  function sanitizeNode(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const attrs = node.attributes;
      for (let i = attrs.length - 1; i >= 0; i--) {
        if (EXTENSION_PATTERN.test(attrs[i].value)) {
          node.removeAttribute(attrs[i].name);
        }
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      if (EXTENSION_PATTERN.test(node.textContent)) {
        node.textContent = node.textContent.replace(
          /chrome-extension:\/\/[^\s"'<>]*/g,
          ""
        );
      }
    }
  }

  let pendingMutations = [];
  let flushScheduled = false;

  function flushMutations() {
    const batch = pendingMutations;
    pendingMutations = [];
    flushScheduled = false;

    for (const mutation of batch) {
      for (const added of mutation.addedNodes) {
        sanitizeNode(added);
        if (added.nodeType === Node.ELEMENT_NODE) {
          const walker = document.createTreeWalker(
            added,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
          );
          let current;
          while ((current = walker.nextNode())) {
            sanitizeNode(current);
          }
        }
      }
      if (
        mutation.type === "attributes" &&
        mutation.target.nodeType === Node.ELEMENT_NODE
      ) {
        const val = mutation.target.getAttribute(mutation.attributeName);
        if (val && EXTENSION_PATTERN.test(val)) {
          mutation.target.removeAttribute(mutation.attributeName);
        }
      }
    }
  }

  const observer = new MutationObserver((mutations) => {
    pendingMutations.push(...mutations);
    if (!flushScheduled) {
      flushScheduled = true;
      requestAnimationFrame(flushMutations);
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: false
  });
})();
