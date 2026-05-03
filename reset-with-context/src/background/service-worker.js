// src/background/service-worker.js

"use strict";

try {
  importScripts("../shared/config.js", "../storage/db.js");
} catch (error) {
  console.error("[RWC] Failed to import background dependencies.", error);
}

const CONFIG = globalThis.RWC_CONFIG;
const DB = globalThis.RWC_DB;

chrome.runtime.onInstalled.addListener(() => {
  log("Extension installed or updated.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== CONFIG?.messages?.captured) {
    return false;
  }

  handleCapturedMessages(message.payload, sender)
    .then((result) => {
      sendResponse(result);
    })
    .catch((error) => {
      console.error("[RWC] Failed to handle captured messages.", error);

      sendResponse({
        ok: false,
        error: String(error?.message || error)
      });
    });

  return true;
});

async function handleCapturedMessages(payload, sender) {
  if (!DB) {
    throw new Error("RWC_DB is not available.");
  }

  if (!payload?.conversation?.id) {
    throw new Error("Missing conversation id.");
  }

  const now = new Date().toISOString();

  const conversation = {
    ...payload.conversation,
    tabId: sender?.tab?.id ?? null,
    windowId: sender?.tab?.windowId ?? null,
    createdAt: payload.capturedAt || now,
    updatedAt: payload.capturedAt || now
  };

  await DB.upsertConversation(conversation);

  const result = await DB.upsertMessages(payload.messages || []);

  const total = await DB.countMessagesForConversation(conversation.id);

  log("Stored captured messages.", {
    tabId: conversation.tabId,
    windowId: conversation.windowId,
    conversationId: conversation.id,
    title: conversation.title,
    url: conversation.url,
    received: payload.messages?.length || 0,
    stored: result.stored,
    total
  });

  return {
    ok: true,
    stored: result.stored,
    total
  };
}

function log(message, data) {
  if (!CONFIG?.debug) return;

  if (data !== undefined) {
    console.log(`[RWC] ${message}`, data);
  } else {
    console.log(`[RWC] ${message}`);
  }
}