// src/shared/config.js

(() => {
  "use strict";

  const RWC_CONFIG = Object.freeze({
    namespace: "RWC",

    debug: true,

    hosts: Object.freeze([
      "chatgpt.com",
      "chat.openai.com"
    ]),

    capture: Object.freeze({
      scanDebounceMs: 900,
      maxMessageChars: 25000,
      maxCodeBlockChars: 4000
    }),

    storage: Object.freeze({
      dbName: "reset_with_context",
      dbVersion: 1,
      stores: Object.freeze({
        conversations: "conversations",
        messages: "messages"
      })
    }),

    messages: Object.freeze({
      captured: "RWC_MESSAGES_CAPTURED"
    })
  });

  globalThis.RWC_CONFIG = RWC_CONFIG;
})();