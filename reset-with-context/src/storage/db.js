// src/storage/db.js

(() => {
  "use strict";

  const CONFIG = globalThis.RWC_CONFIG || {
    storage: {
      dbName: "reset_with_context",
      dbVersion: 1,
      stores: {
        conversations: "conversations",
        messages: "messages"
      }
    }
  };

  const DB_NAME = CONFIG.storage.dbName;
  const DB_VERSION = CONFIG.storage.dbVersion;
  const STORES = CONFIG.storage.stores;

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORES.conversations)) {
          const conversations = db.createObjectStore(STORES.conversations, {
            keyPath: "id"
          });

          conversations.createIndex("byUpdatedAt", "updatedAt");
          conversations.createIndex("byHost", "host");
        }

        if (!db.objectStoreNames.contains(STORES.messages)) {
          const messages = db.createObjectStore(STORES.messages, {
            keyPath: "id"
          });

          messages.createIndex("byConversationId", "conversationId");
          messages.createIndex("byConversationAndIndex", [
            "conversationId",
            "index"
          ]);
          messages.createIndex("byUpdatedAt", "updatedAt");
          messages.createIndex("byRole", "role");
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn("[RWC] IndexedDB upgrade blocked.");
      };
    });

    return dbPromise;
  }

  async function upsertConversation(conversation) {
    const db = await openDb();

    const now = new Date().toISOString();

    const existing = await getRecord(
      db,
      STORES.conversations,
      conversation.id
    );

    const record = {
      ...(existing || {}),
      ...conversation,
      createdAt: existing?.createdAt || conversation.createdAt || now,
      updatedAt: conversation.updatedAt || now
    };

    await putRecord(db, STORES.conversations, record);

    return record;
  }

  async function upsertMessage(message) {
    const db = await openDb();

    const existing = await getRecord(db, STORES.messages, message.id);

    if (
      existing &&
      existing.textHash === message.textHash &&
      existing.codeHash === message.codeHash &&
      existing.role === message.role &&
      existing.index === message.index
    ) {
      return {
        changed: false,
        record: existing
      };
    }

    const record = {
      ...(existing || {}),
      ...message,
      capturedAt: existing?.capturedAt || message.capturedAt,
      updatedAt: message.updatedAt || new Date().toISOString()
    };

    await putRecord(db, STORES.messages, record);

    return {
      changed: true,
      record
    };
  }

  async function upsertMessages(messages) {
    let stored = 0;

    for (const message of messages || []) {
      const result = await upsertMessage(message);

      if (result.changed) {
        stored += 1;
      }
    }

    return {
      stored
    };
  }

  async function countMessagesForConversation(conversationId) {
    const db = await openDb();

    return countByIndex(
      db,
      STORES.messages,
      "byConversationId",
      conversationId
    );
  }

  async function getMessagesForConversation(conversationId) {
    const db = await openDb();

    return getAllByIndex(
      db,
      STORES.messages,
      "byConversationAndIndex",
      IDBKeyRange.bound(
        [conversationId, -Infinity],
        [conversationId, Infinity]
      )
    );
  }

  function getRecord(db, storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  function putRecord(db, storeName, record) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);

      store.put(record);

      tx.oncomplete = () => {
        resolve(record);
      };

      tx.onerror = () => {
        reject(tx.error);
      };
    });
  }

  function countByIndex(db, storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const index = tx.objectStore(storeName).index(indexName);
      const request = index.count(value);

      request.onsuccess = () => {
        resolve(request.result || 0);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  function getAllByIndex(db, storeName, indexName, query) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const index = tx.objectStore(storeName).index(indexName);
      const request = index.getAll(query);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  globalThis.RWC_DB = Object.freeze({
    openDb,
    upsertConversation,
    upsertMessage,
    upsertMessages,
    countMessagesForConversation,
    getMessagesForConversation
  });
})();