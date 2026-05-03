// src/content/index.js

(() => {
  "use strict";

  const DEBUG = true;
  const BOOT_FLAG = "__RWC_CONTENT_STARTED__";

  init();

  function init() {
    if (!isChatGptPage()) return;

    if (window[BOOT_FLAG]) {
      log("Content script already started.");
      return;
    }

    window[BOOT_FLAG] = true;

    log("Content entrypoint loaded.", {
      url: window.location.href,
      title: document.title
    });

    if (window.RWC_CAPTURE && typeof window.RWC_CAPTURE.start === "function") {
      window.RWC_CAPTURE.start();
      log("Capture controller started.");
    } else {
      log("Capture controller not loaded yet.");
    }
  }

  function isChatGptPage() {
    return (
      window.location.hostname === "chatgpt.com" ||
      window.location.hostname === "chat.openai.com"
    );
  }

  function log(message, data) {
    if (!DEBUG) return;

    if (data !== undefined) {
      console.log(`[RWC] ${message}`, data);
    } else {
      console.log(`[RWC] ${message}`);
    }
  }
})();