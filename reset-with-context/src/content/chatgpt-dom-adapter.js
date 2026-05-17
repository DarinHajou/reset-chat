// src/content/chatgpt-dom-adapter.js

(() => {
  "use strict";

  const CONFIG = globalThis.RWC_CONFIG || {
    capture: {
      maxMessageChars: 25000,
      maxCodeBlockChars: 4000
    }
  };

  function readLoadedMessages() {
  const containers = findMessageContainers();

  const messages = containers
    .map((container, index) => extractMessage(container, index))
    .filter(Boolean)
    .filter((message) => message.text || message.codeBlocks.length);

  return dedupeMessages(messages).map((message, index) => ({
    ...message,
    index
  }));
}
  function findMessageContainers() {
    const roleNodes = Array.from(
      document.querySelectorAll("[data-message-author-role]")
    );

    const containers = [];

    for (const node of roleNodes) {
      if (!isVisible(node)) continue;

      const container =
        node.closest("[data-testid^='conversation-turn']") ||
        node.closest("article") ||
        node;

      if (container && isVisible(container)) {
        containers.push(container);
      }
    }

    if (!containers.length) {
      const fallbackNodes = document.querySelectorAll(
        "main article, main [data-testid^='conversation-turn']"
      );

      for (const node of fallbackNodes) {
        if (isVisible(node)) containers.push(node);
      }
    }

    return uniqueContainers(containers).sort(compareDomOrder);
  }

  function extractMessage(container, index) {
    const roleInfo = extractRole(container);
    const extracted = extractTextAndCode(container);

    if (!extracted.text && !extracted.codeBlocks.length) {
      return null;
    }

    return {
      index,
      role: roleInfo.role,
      roleConfidence: roleInfo.confidence,
      text: trimTo(extracted.text, CONFIG.capture.maxMessageChars),
      codeBlocks: extracted.codeBlocks
    };
  }

  function extractRole(container) {
    const roleNode = container.matches("[data-message-author-role]")
      ? container
      : container.querySelector("[data-message-author-role]");

    const role = String(
      roleNode?.getAttribute("data-message-author-role") || ""
    ).toLowerCase();

    if (role === "user") {
      return {
        role: "user",
        confidence: 1
      };
    }

    if (role === "assistant") {
      return {
        role: "assistant",
        confidence: 1
      };
    }

    return {
      role: "unknown",
      confidence: 0.25
    };
  }

  function extractTextAndCode(container) {
    const clone = container.cloneNode(true);

    const codeBlocks = Array.from(clone.querySelectorAll("pre code, pre"))
      .map((node, index) => {
        const text = cleanCode(node.textContent || "");

        if (!text) return null;

        return {
          index,
          language: inferLanguage(node),
          text: trimTo(text, CONFIG.capture.maxCodeBlockChars)
        };
      })
      .filter(Boolean);

    removeNoiseNodes(clone);

    const rawText = clone.innerText || clone.textContent || "";

    return {
      text: cleanMessageText(rawText),
      codeBlocks
    };
  }

  function removeNoiseNodes(root) {
    const selectors = [
      "script",
      "style",
      "noscript",
      "svg",
      "button",
      "textarea",
      "input",
      "select",
      "nav",
      "menu",
      "[contenteditable='true']",
      "[aria-hidden='true']",
      "[data-testid*='copy']",
      "[data-testid*='feedback']",
      "[data-testid*='share']",
      "[data-testid*='edit']",
      "[role='button']",
      "pre"
    ];

    for (const selector of selectors) {
      for (const node of Array.from(root.querySelectorAll(selector))) {
        node.remove();
      }
    }
  }

  function cleanMessageText(text) {
    const lines = String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !isUiNoise(line));

    return dedupeConsecutive(lines).join("\n").trim();
  }

  function cleanCode(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r/g, "\n")
      .trim();
  }

  function inferLanguage(node) {
    const className = String(node.className || "");
    const match = className.match(/language-([a-z0-9_-]+)/i);

    return match ? match[1].toLowerCase() : "";
  }

  function isUiNoise(line) {
    return (
      /^(copy|copy code|edit|share|regenerate|read aloud|good response|bad response|more|stop generating|you said:|chatgpt said:)$/i.test(line) ||
      /^chatgpt can make mistakes/i.test(line)
    );
  }

  function uniqueContainers(containers) {
    const output = [];

    for (const container of containers) {
      const isNested = output.some((existing) => {
        return existing === container || existing.contains(container);
      });

      if (isNested) continue;

      output.push(container);
    }

    return output;
  }

  function dedupeMessages(messages) {
    const seen = new Set();
    const output = [];

    for (const message of messages) {
      const key = [
        message.role,
        normalizeKey(message.text).slice(0, 480),
        message.codeBlocks.length
      ].join(":");

      if (seen.has(key)) continue;

      seen.add(key);
      output.push(message);
    }

    return output;
  }

  function dedupeConsecutive(lines) {
    const output = [];
    let previous = "";

    for (const line of lines) {
      const key = normalizeKey(line);

      if (key && key === previous) continue;

      output.push(line);
      previous = key;
    }

    return output;
  }

  function normalizeKey(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[`"'“”‘’]/g, "")
      .replace(/[^\w\s./-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function trimTo(text, max) {
    const value = String(text || "").trim();

    if (value.length <= max) return value;

    return value.slice(0, max - 1).trimEnd() + "…";
  }

  function isVisible(element) {
    if (!element || !(element instanceof Element)) return false;

    const style = window.getComputedStyle(element);

    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();

    return rect.width > 0 && rect.height > 0;
  }

  function compareDomOrder(a, b) {
    if (a === b) return 0;

    const position = a.compareDocumentPosition(b);

    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;

    return 0;
  }

  globalThis.RWC_DOM_ADAPTER = Object.freeze({
  readLoadedMessages,
  readVisibleMessages: readLoadedMessages
});
})();