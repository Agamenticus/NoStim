// NoStim — LinkedIn Shield (MAIN world)
// Intercepts fetch/XHR to block chrome-extension:// probes and
// sanitizes the DOM to defeat LinkedIn's extension fingerprinting.

(function () {
  "use strict";

  // The shield is checked at CALL TIME, not once at startup. The bridge
  // (ISOLATED world) reads chrome.storage asynchronously, so the flag may not
  // be set yet when this MAIN-world script runs at document_start. Reading it
  // per-call means: we default to ON before the flag lands (safer — block
  // probes), and we genuinely honor an OFF toggle once the bridge sets it
  // (which happens long before LinkedIn's scanner fires). Runs in every frame
  // (all_frames) so subframe / fresh-realm probes can't dodge the override.
  function shieldOn() {
    return document.documentElement.dataset.focusguardShield !== "off";
  }

  // --- 1. Override fetch() ---
  const originalFetch = window.fetch;
  window.fetch = function (resource, init) {
    const url =
      resource instanceof Request ? resource.url : String(resource);
    if (shieldOn() && url.startsWith("chrome-extension://")) {
      return Promise.reject(new TypeError("Failed to fetch"));
    }
    return originalFetch.apply(this, arguments);
  };

  // --- 2. Override XMLHttpRequest ---
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (shieldOn() && String(url).startsWith("chrome-extension://")) {
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

    if (!shieldOn()) return; // honor the OFF toggle

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
