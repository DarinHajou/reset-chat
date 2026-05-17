// src/content/capture-controller.js

(() => {
  "use strict";

  const CONFIG = globalThis.RWC_CONFIG;
  const HASH = globalThis.RWC_HASH;
  const DOM_ADAPTER = globalThis.RWC_DOM_ADAPTER;

  if (!CONFIG) {
    console.warn("[RWC] Capture controller missing RWC_CONFIG.");
    return;
  }

  if (!HASH) {
    console.warn("[RWC] Capture controller missing RWC_HASH.");
    return;
  }

  if (!DOM_ADAPTER) {
    console.warn("[RWC] Capture controller missing RWC_DOM_ADAPTER.");
    return;
  }

  let observer = null;
  let scanTimer = null;
  let started = false;
  let lastBatchHash = "";

  function start() {
    if (started) return;

    started = true;

    log("Capture controller started.");

    scheduleScan("initial");

    observer = new MutationObserver(() => {
      scheduleScan("mutation");
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    window.addEventListener("beforeunload", handleBeforeUnload);
  }

  function stop() {
    if (!started) return;

    started = false;

    clearTimeout(scanTimer);
    scanTimer = null;

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    window.removeEventListener("beforeunload", handleBeforeUnload);

    log("Capture controller stopped.");
  }

  function handleBeforeUnload() {
    captureNow("beforeunload");
  }

  function scheduleScan(reason) {
    clearTimeout(scanTimer);

    scanTimer = setTimeout(() => {
      captureNow(reason);
    }, CONFIG.capture.scanDebounceMs);
  }

  async function captureNow(reason) {
    if (!started && reason !== "manual") return;

  const loadedMessages = DOM_ADAPTER.readLoadedMessages();

    if (!loadedMessages.length) {
      log("No loaded messages found.", { reason });
      return;
    }

    const capturedAt = new Date().toISOString();
    const conversation = getConversationMeta();

    const messages = loadedMessages.map((message) => {
      return normalizeCapturedMessage(message, conversation, capturedAt);
    });

    const batchHash = HASH.hashString(
      messages
        .map((message) => {
          return [
            message.id,
            message.textHash,
            message.codeHash,
            message.index,
            message.role
          ].join(":");
        })
        .join("|")
    );

    if (batchHash === lastBatchHash) {
      return;
    }

    lastBatchHash = batchHash;

    const response = await sendToBackground({
      type: CONFIG.messages.captured,
      payload: {
        reason,
        capturedAt,
        conversation,
        messages
      }
    });

    log("Captured visible messages.", {
      reason,
      loaded: messages.length,
      stored: response?.stored ?? null,
      total: response?.total ?? null
    });
  }

  function normalizeCapturedMessage(rawMessage, conversation, capturedAt) {
    const text = String(rawMessage.text || "").trim();
    const codeBlocks = Array.isArray(rawMessage.codeBlocks)
      ? rawMessage.codeBlocks
      : [];

    const codeText = codeBlocks
      .map((block) => block.text || "")
      .join("\n---\n");

    const textHash = HASH.hashString(text);
    const codeHash = HASH.hashString(codeText);

    return {
      id: createMessageId({
        conversationId: conversation.id,
        index: rawMessage.index,
        role: rawMessage.role,
        textHash,
        codeHash
      }),

      conversationId: conversation.id,

      role: rawMessage.role || "unknown",
      roleConfidence: rawMessage.roleConfidence || 0,
      index: rawMessage.index,

      text,
      codeBlocks,

      textHash,
      codeHash,

      sourceUrl: window.location.href,
      capturedAt,
      updatedAt: capturedAt
    };
  }

  function createMessageId(parts) {
  return [
    "msg",
    parts.conversationId,
    String(parts.index).padStart(4, "0"),
    parts.role || "unknown",
    parts.textHash || "no_text",
    parts.codeHash || "no_code"
  ].join("_");
}

  function getConversationMeta() {
    return {
      id: getConversationId(),
      url: window.location.href,
      title: getConversationTitle(),
      host: window.location.hostname
    };
  }

  function getConversationId() {
    const path = window.location.pathname || "/";
    const match = path.match(/\/c\/([a-zA-Z0-9-]+)/);

    if (match?.[1]) {
      return `chatgpt_${match[1]}`;
    }

    return `chatgpt_${HASH.hashString(window.location.origin + path).slice(0, 16)}`;
  }

  function getConversationTitle() {
    const title = document.title || "";

    return (
      title
        .replace(/\s*[-|]\s*ChatGPT\s*$/i, "")
        .trim() ||
      "Untitled ChatGPT conversation"
    );
  }

  function sendToBackground(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            log("Background message failed.", {
              error: chrome.runtime.lastError.message
            });

            resolve(null);
            return;
          }

          resolve(response || null);
        });
      } catch (error) {
        log("Background message threw.", {
          error: String(error?.message || error)
        });

        resolve(null);
      }
    });
  }

  function log(message, data) {
    if (!CONFIG.debug) return;

    if (data !== undefined) {
      console.log(`[RWC] ${message}`, data);
    } else {
      console.log(`[RWC] ${message}`);
    }
  }

  globalThis.RWC_CAPTURE = Object.freeze({
    start,
    stop,
    captureNow
  });
})();