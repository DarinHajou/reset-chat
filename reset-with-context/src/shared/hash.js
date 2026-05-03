// src/shared/hash.js

(() => {
  "use strict";

  function hashString(input) {
    const text = String(input || "");
    let hash = 2166136261;

    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash +=
        (hash << 1) +
        (hash << 4) +
        (hash << 7) +
        (hash << 8) +
        (hash << 24);
    }

    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function createMessageHash(message) {
    const role = message?.role || "unknown";
    const text = message?.text || "";
    const codeBlocks = Array.isArray(message?.codeBlocks)
      ? message.codeBlocks.map((block) => block.text || "").join("\n---\n")
      : "";

    return hashString(`${role}\n${text}\n${codeBlocks}`);
  }

  globalThis.RWC_HASH = Object.freeze({
    hashString,
    createMessageHash
  });
})();