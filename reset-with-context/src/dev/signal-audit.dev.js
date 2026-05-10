// src/dev/signal-audit.dev.js
//
// Reset with Context
// Dev-only signal audit helper.
//
// Purpose:
// - Read locally stored captured messages from IndexedDB.
// - Run draft primitive signal rules.
// - Count phrases and examples.
// - Help study real chat language before building production signal-extractor.js.
//
// Not product logic.
// No UI.
// No capture/reset side effects.
// Safe to delete later.

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

  const DB_NAME = CONFIG.storage.dbName || "reset_with_context";
  const DB_VERSION = CONFIG.storage.dbVersion || 1;

  const STORES = CONFIG.storage.stores || {
    conversations: "conversations",
    messages: "messages"
  };

  const SIGNAL_KINDS = [
  "instruction",
  "proposal",
  "agreement_check",
  "confirmation",
  "negation",
  "rejection",
  "correction",
  "uncertainty",
  "scope_limiter",
  "completion/checkpoint",
  "clarification_request",
  "frustration_escalation",
  "output_failure",
  "alignment_question",
  "quality_bar",
  "role_contract",
  "artifact_reference",
  "artifact_state_hint",
  "topic_shift",
  "target_correction"
];

  const RULES = [
  {
    kind: "instruction",
    id: "direct_request",
    re: /\b(please|can you|could you|would you|help me|i need you to|i want you to)\b[\s\S]{0,120}/gi
  },
  {
    kind: "instruction",
    id: "imperative_action",
    re: /\b(build|create|make|write|rewrite|refactor|fix|update|change|add|remove|delete|move|rename|keep|use|avoid|stop|start|show|give|explain|summarize|audit|inspect|compare)\b[\s\S]{0,120}/gi
  },
  {
    kind: "instruction",
    id: "strong_constraint",
    re: /\b(must not|do not|don't|never|always|important rule|critical|make sure|under no circumstance|must)\b[\s\S]{0,140}/gi
  },

  {
    kind: "proposal",
    id: "soft_proposal",
    re: /\b(maybe we could|maybe you could|we could|you could|what if|how about|one option is|another option is|i suggest|i'd suggest|we should|let's|i would|could be better to)\b[\s\S]{0,140}/gi
  },

   {
    kind: "agreement_check",
    id: "agreement_question",
    re: /(?:^|\s)(right\?|correct\?|sound good\?|makes sense\?|does that make sense\?|is that okay\?|ok\?|okay\?|agree\?|fair\?)(?:\s|$)/gi,
    preserveQuestionMark: true
  },

  {
    kind: "confirmation",
    id: "positive_confirmation",
    re: /\b(yes|yep|yeah|exactly|correct|that's right|that works|works for me|great|nice|good|perfect|ok great|sounds good)\b[\s\S]{0,80}/gi,
    weakTriggerGate: true
  },

  {
    kind: "negation",
    id: "actionable_negation",
    re: /\b(no don't|do not|don't|never|can't|cannot|won't|shouldn't|wouldn't|couldn't|not this|not that|not what i meant|not what i asked|not what we did|not useful|not needed|not included|not loaded|doesn't work|does not work)\b[\s\S]{0,120}/gi
  },

  {
    kind: "rejection",
    id: "explicit_rejection",
    re: /\b(no don't|do not do that|don't do that|not that|not this|i don't want|we don't want|skip that|remove that|wrong direction|not the right approach|we shouldn't|that is not useful|that's not useful|throw that away|ignore that)\b[\s\S]{0,140}/gi
  },

  {
    kind: "correction",
    id: "correction_marker",
    re: /\b(actually|i meant|what i meant|that's not what|that is not what|not what i asked|not what we did|you misunderstood|wrong|incorrect|the issue is|the problem is|instead|rather than|sorry, i mean|i mean)\b[\s\S]{0,160}/gi
  },

  {
    kind: "uncertainty",
    id: "uncertainty_marker",
    re: /\b(maybe|probably|possibly|not sure|i'm not sure|i think|i guess|seems like|might|could be|unsure|unclear|i wonder|perhaps|idk)\b[\s\S]{0,120}/gi
  },

    {
    kind: "scope_limiter",
    id: "scope_limit",
    re: /\b(for now|for this|dev-only|local only|not product logic|not production|mvp|mvp scope|keep it simple|small scope|minimal version|minimal|no need to|don't overbuild|vanilla js only|no ui|no backend|no npm|no react|only if|only when|only currently|just this|just for now|just enough|not now|not yet|out of scope)\b[\s\S]{0,140}/gi
  },

  {
    kind: "completion/checkpoint",
    id: "checkpoint",
    re: /\b(checkpoint|milestone|next step|moving on|that part is done|we are done with|we're done with|current status|where we landed|final decision|ready to move on|ready for next|save this|capture this)\b[\s\S]{0,140}/gi
  },

  {
    kind: "clarification_request",
    id: "clarification_question",
    re: /\b(can you clarify|what do you mean|which one|which file|what file|where exactly|do you mean|are you asking|should i|do you want|can you explain|would that help|do you need)\b[\s\S]{0,160}/gi
  },

  {
    kind: "frustration_escalation",
    id: "frustration_marker",
    re: /\b(again|you keep|this keeps|why are you|this is wrong|that's wrong|not working|broken|annoying|frustrating|seriously|come on|same issue|same problem|wtf|what the fuck)\b[\s\S]{0,160}/gi
  },

  {
    kind: "quality_bar",
    id: "quality_expectation",
    re: /\b(production-ready|production ready|polished|cleaner|clean and simple|make it clean|senior|scalable|robust|reliable|not sloppy|high quality|best practice|real-world|practical|performant|maintainable|simple and local|easy to delete|clear|not vague|too vague|follow instructions)\b[\s\S]{0,140}/gi,
    skipCodeLike: true
  },

  {
    kind: "role_contract",
    id: "role_contract",
    re: /\b(act like|respond as|you are acting as|your role is|be direct|be concise|senior product engineer|product strategist|senior product designer|ux strategist|do not ask me|don't ask me)\b[\s\S]{0,160}/gi
  },

  {
    kind: "artifact_reference",
    id: "artifact_reference",
    re: /\b(file|component|hook|store|script|function|class|module|extension|indexeddb|database|db|table|manifest|service worker|content script|controller|adapter|readme|\.js|\.ts|\.tsx|\.jsx|\.css|\.json|\.md)\b[\s\S]{0,140}/gi,
    skipCodeLike: false
  },
  {
    kind: "artifact_reference",
    id: "message_reference",
    re: /\b(message above|last message|previous message|this handoff|the handoff|this prompt|the prompt|this conversation|current conversation|this screenshot|the screenshot|this file|the file|this code|the code|this screen|the screen)\b[\s\S]{0,140}/gi
  },

  {
    kind: "artifact_state_hint",
    id: "artifact_state",
    re: /\b(already|existing|currently|stored|captured|saved|local|draft|previous|current|old|new|updated|changed|fixed|missing|broken|loaded|available|not loaded)\b[\s\S]{0,140}/gi
  },

  {
    kind: "topic_shift",
    id: "topic_shift",
    re: /\b(btw|by the way|new topic|separate question|another thing|different topic|switching gears|unrelated|anyway|moving on|next screen|next part|let's switch to)\b[\s\S]{0,140}/gi
  },
    {
    kind: "output_failure",
    id: "assistant_output_failure",
    re: /\b(too much|too vague|vague language|what is this|what the fuck is this|is this supposed to help|no one can understand this|these aren't real instructions|these are not real instructions|not real instructions|sounds robotic|sounds fucking robotic|follow instructions|clear instructions|you ignored|ignoring the last message|wrong output|bad output|miles away|all over the place|cryptic)\b[\s\S]{0,160}/gi
  },

  {
    kind: "alignment_question",
    id: "alignment_question",
    re: /\b(do we like this|do we want this|do we even want|should we use|should we keep|should we have|is this right|is this correct|is this the right|so roughly like this|so more or less like this|link first or accordion|where do we decide|where should this go|what goes here|which direction|which approach|how many image versions|isn't this too tight|isnt this too tight)\b[\s\S]{0,160}/gi
  },
  {
  kind: "target_correction",
  id: "target_correction",
  re: /\b(i said|screen 2, not|not 15 screens|there's no such thing|there is no such thing|forget about|what we are working on now is|we need this here|wrong screen|wrong page|wrong component|wrong target|not the nav bar|not the app nav bar)\b[\s\S]{0,160}/gi
},
];

  function getDefaultOptions(userOptions) {
    return {
      roles: ["user"],
      maxMessages: Infinity,
      topPhrasesPerCategory: 20,
      maxExamplesPerPhrase: 5,
      maxNoSignalExamples: 25,
      maxNoisyMatches: 25,
      minNoisyPhraseCount: 10,
      minWeakCategoryCount: 3,
      phraseMaxLength: 160,
      log: true,
      includeDiagnostics: true,
      ...userOptions,
      conversationId: userOptions.conversationId || null,
      conversationIds: Array.isArray(userOptions.conversationIds)
      ? userOptions.conversationIds
      : null,
    };
  }

  async function auditSignals(userOptions = {}) {
    const options = getDefaultOptions(userOptions);

    const db = await getDb();

    const conversations = await readAll(db, STORES.conversations).catch(() => []);
    const conversationById = new Map(
      conversations.map((conversation) => [conversation.id, conversation])
    );

    const accumulator = createAccumulator();

    await eachMessage(db, async (message) => {
      accumulator.diagnostics.totalMessages += 1;

      if (!shouldScanConversation(message.conversationId, options)) {
        return;
      }

      if (accumulator.diagnostics.scannedMessages >= options.maxMessages) {
        return;
      }

      if (!shouldScanRole(message.role, options.roles)) {
        return;
      }

      const text = normalizeMessageText(message);
      if (!text) {
        return;
      }

      accumulator.diagnostics.scannedMessages += 1;

      const conversation = conversationById.get(message.conversationId) || null;
      const signals = extractDraftSignalsFromText(text);

      if (!signals.length) {
        if (accumulator.noSignalMessages.length < options.maxNoSignalExamples) {
          accumulator.noSignalMessages.push(toMessageExample(message, conversation, text));
        }

        return;
      }

      accumulator.diagnostics.messagesWithSignals += 1;

      for (const signal of signals) {
        addSignal(accumulator, signal, message, conversation, text, options);
      }
    });

    const result = buildResult(accumulator, options);

    if (options.log) {
      printAudit(result);
    }

    return result;
  }

  function passesWeakTriggerGate(phrase, normalizedSource) {
  const weakPhrases = new Set(["yes", "yep", "yeah", "good", "nice", "great", "perfect", "correct"]);

  if (!weakPhrases.has(phrase)) {
    return true;
  }

  if (normalizedSource.length <= 80) {
    return true;
  }

  const strongConfirmationStart = new RegExp(
    `^${escapeRegExp(phrase)}\\b(?:[,!.\\s]+(?:that works|works|exactly|correct|continue|go on|do that|this is right|sounds good))?`
  );

  return strongConfirmationStart.test(normalizedSource);
}

function looksLikeCodeOrConfig(text) {
  const value = String(text || "");

  if (!value.trim()) {
    return false;
  }

  const lower = value.toLowerCase();

  const codeKeywords = /\b(function|const|let|var|return|class|import|export|=>|console\.log|queryselector|addeventlistener|regexp|indexeddb|objectstore|manifest_version)\b/i;

  if (codeKeywords.test(value)) {
    return true;
  }

  const symbolCount = (value.match(/[{}[\]();=<>]/g) || []).length;
  const symbolRatio = symbolCount / Math.max(value.length, 1);

  if (symbolRatio > 0.035 && value.length > 120) {
    return true;
  }

  if (
    lower.includes("```") ||
    lower.includes("const ") ||
    lower.includes("function ") ||
    lower.includes("return ") ||
    lower.includes("=>")
  ) {
    return true;
  }

  return false;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

  function extractDraftSignalsFromText(text) {
  const source = String(text || "");
  const normalizedSource = normalizePhrase(source);
  const results = [];
  const seen = new Set();

  for (const rule of RULES) {
    if (rule.skipCodeLike && looksLikeCodeOrConfig(source)) {
      continue;
    }

    const flags = rule.re.flags.includes("g") ? rule.re.flags : `${rule.re.flags}g`;
    const re = new RegExp(rule.re.source, flags);

    let match;

    while ((match = re.exec(source))) {
      const trigger = cleanSpan(match[1] || match[0]);
      const raw = cleanSpan(match[0]);

      if (!trigger || !raw) {
        continue;
      }

            const phrase = rule.preserveQuestionMark
        ? normalizeQuestionPhrase(trigger)
        : normalizePhrase(trigger);

      if (!phrase) {
        continue;
      }

      if (rule.weakTriggerGate && !passesWeakTriggerGate(phrase, normalizedSource)) {
        continue;
      }

      const start = match.index;
      const end = match.index + match[0].length;
      const key = `${rule.kind}:${rule.id}:${phrase}:${start}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);

      results.push({
        kind: rule.kind,
        ruleId: rule.id,
        phrase,
        raw,
        start,
        end,
        context: getContext(source, start, end)
      });

      if (re.lastIndex === match.index) {
        re.lastIndex += 1;
      }
    }
  }

  return results;
}

  function createAccumulator() {
    return {
      byKind: Object.fromEntries(SIGNAL_KINDS.map((kind) => [kind, new Map()])),
      noSignalMessages: [],
      diagnostics: {
        dbName: DB_NAME,
        stores: STORES,
        totalMessages: 0,
        scannedMessages: 0,
        messagesWithSignals: 0,
        totalSignals: 0,
        signalCounts: Object.fromEntries(SIGNAL_KINDS.map((kind) => [kind, 0])),
        ruleCounts: {},
        roleCounts: {},
        weakCategories: [],
        noisyMatches: []
      }
    };
  }

  function addSignal(accumulator, signal, message, conversation, text, options) {
    const phrase = limitText(signal.phrase, options.phraseMaxLength);
    const kindMap = accumulator.byKind[signal.kind];

    if (!kindMap.has(phrase)) {
      kindMap.set(phrase, {
        phrase,
        count: 0,
        examples: [],
        rules: {}
      });
    }

    const row = kindMap.get(phrase);

    row.count += 1;
    row.rules[signal.ruleId] = (row.rules[signal.ruleId] || 0) + 1;

    if (row.examples.length < options.maxExamplesPerPhrase) {
      row.examples.push({
        ...toMessageExample(message, conversation, text),
        matched: signal.raw,
        context: signal.context,
        ruleId: signal.ruleId
      });
    }

    accumulator.diagnostics.totalSignals += 1;
    accumulator.diagnostics.signalCounts[signal.kind] += 1;

    const ruleKey = `${signal.kind}:${signal.ruleId}`;
    accumulator.diagnostics.ruleCounts[ruleKey] =
      (accumulator.diagnostics.ruleCounts[ruleKey] || 0) + 1;

    const role = message.role || "unknown";
    accumulator.diagnostics.roleCounts[role] =
      (accumulator.diagnostics.roleCounts[role] || 0) + 1;
  }

  function buildResult(accumulator, options) {
    const signals = {};

    for (const kind of SIGNAL_KINDS) {
      signals[kind] = Array.from(accumulator.byKind[kind].values())
        .sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase))
        .slice(0, options.topPhrasesPerCategory)
        .map((row) => ({
          phrase: row.phrase,
          count: row.count,
          examples: row.examples
        }));
    }

    const diagnostics = buildDiagnostics(accumulator, options);

    return {
      signals,
      noisyMatches: diagnostics.noisyMatches,
      messagesWithNoDetectedSignal: accumulator.noSignalMessages,
      diagnostics: options.includeDiagnostics ? diagnostics : undefined
    };
  }

  function buildDiagnostics(accumulator, options) {
    const diagnostics = accumulator.diagnostics;

    diagnostics.weakCategories = [];
    diagnostics.noisyMatches = [];

    for (const kind of SIGNAL_KINDS) {
      const count = diagnostics.signalCounts[kind] || 0;

      if (count < options.minWeakCategoryCount) {
        diagnostics.weakCategories.push({
          kind,
          count,
          reason:
            count === 0
              ? "No matches found. Rule may be missing or category may be rare."
              : "Few matches found. Rule may be too narrow."
        });
      }

      const phrases = Array.from(accumulator.byKind[kind].values())
        .sort((a, b) => b.count - a.count)
        .filter((row) => row.count >= options.minNoisyPhraseCount)
        .slice(0, options.maxNoisyMatches);

      for (const row of phrases) {
        diagnostics.noisyMatches.push({
          kind,
          phrase: row.phrase,
          count: row.count,
          reason: "High-frequency phrase. Inspect examples for false positives.",
          examples: row.examples.slice(0, 3)
        });
      }
    }

    diagnostics.noisyMatches.sort((a, b) => b.count - a.count);

    return diagnostics;
  }

  function printAudit(result) {
    console.group("[RWC_DEV] Signal audit");

    console.log("Result object:", result);

    if (result.diagnostics) {
      console.group("Counts by signal category");
      console.table(
        Object.entries(result.diagnostics.signalCounts)
          .map(([kind, count]) => ({ kind, count }))
          .sort((a, b) => b.count - a.count)
      );
      console.groupEnd();

      console.group("Weak categories");
      console.table(result.diagnostics.weakCategories);
      console.groupEnd();
    }

    console.group("Noisy matches");
    console.table(
      result.noisyMatches.map((row) => ({
        kind: row.kind,
        phrase: row.phrase,
        count: row.count,
        reason: row.reason
      }))
    );
    console.groupEnd();

    console.group("Top phrases per category");

    for (const [kind, rows] of Object.entries(result.signals)) {
      if (!rows.length) continue;

      console.group(kind);
      console.table(
        rows.map((row) => ({
          phrase: row.phrase,
          count: row.count,
          example: row.examples[0]?.context || ""
        }))
      );
      console.groupEnd();
    }

    console.groupEnd();

    console.group("Messages with no detected signal");
    console.table(
      result.messagesWithNoDetectedSignal.map((message) => ({
        role: message.role,
        conversationId: message.conversationId,
        index: message.index,
        text: message.preview
      }))
    );
    console.groupEnd();

    console.groupEnd();
  }

  async function getDb() {
    if (globalThis.RWC_DB && typeof globalThis.RWC_DB.openDb === "function") {
      return globalThis.RWC_DB.openDb();
    }

    return openDbDirectly();
  }

  function openDbDirectly() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };

      request.onupgradeneeded = () => {
        // This helper should not create or migrate product stores.
        // If this runs, you are probably in the wrong execution context.
        request.transaction.abort();
        reject(
          new Error(
            `[RWC_DEV] IndexedDB ${DB_NAME} needs upgrade. Audit helper aborted to avoid schema changes.`
          )
        );
      };
    });
  }

  function readAll(db, storeName) {
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve([]);
        return;
      }

      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  function eachMessage(db, onMessage) {
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(STORES.messages)) {
        reject(new Error(`[RWC_DEV] Missing IndexedDB store: ${STORES.messages}`));
        return;
      }

      const tx = db.transaction(STORES.messages, "readonly");
      const store = tx.objectStore(STORES.messages);
      const request = store.openCursor();

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = async () => {
        const cursor = request.result;

        if (!cursor) {
          resolve();
          return;
        }

        try {
          await onMessage(cursor.value);
          cursor.continue();
        } catch (error) {
          reject(error);
        }
      };
    });
  }

  function shouldScanRole(role, allowedRoles) {
    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
      return true;
    }

    return allowedRoles.includes(role);
  }

  function shouldScanConversation(conversationId, options) {
  if (options.conversationId && conversationId !== options.conversationId) {
    return false;
  }

  if (Array.isArray(options.conversationIds) && options.conversationIds.length) {
    return options.conversationIds.includes(conversationId);
  }

  return true;
}

  function normalizeMessageText(message) {
    return String(message?.text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

    function normalizeQuestionPhrase(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/^[\s"'`.,:;!()[\]{}]+/, "")
      .replace(/[\s"'`.,:;!()[\]{}]+$/, "")
      .trim();
  }

  function normalizePhrase(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/^[\s"'`.,:;!?()[\]{}]+/, "")
      .replace(/[\s"'`.,:;!?()[\]{}]+$/, "")
      .trim();
  }

  function cleanSpan(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function limitText(value, maxLength) {
    const text = String(value || "");

    if (!Number.isFinite(maxLength) || text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength).trim()}…`;
  }

  function getContext(text, start, end, radius = 100) {
    const source = String(text || "");
    const left = Math.max(0, start - radius);
    const right = Math.min(source.length, end + radius);

    return source.slice(left, right).replace(/\s+/g, " ").trim();
  }

  function toMessageExample(message, conversation, text) {
    return {
      messageId: message.id,
      conversationId: message.conversationId,
      conversationTitle:
        conversation?.title ||
        conversation?.name ||
        conversation?.conversationTitle ||
        null,
      role: message.role,
      roleConfidence: message.roleConfidence,
      index: message.index,
      sourceUrl: message.sourceUrl || conversation?.url || null,
      capturedAt: message.capturedAt,
      updatedAt: message.updatedAt,
      preview: limitText(text, 260)
    };
  }

  async function listConversations() {
  const db = await getDb();

  const conversations = await readAll(db, STORES.conversations).catch(() => []);
  const messages = await readAll(db, STORES.messages).catch(() => []);

  const messageCounts = new Map();

  for (const message of messages) {
    const count = messageCounts.get(message.conversationId) || 0;
    messageCounts.set(message.conversationId, count + 1);
  }

  const rows = conversations
    .map((conversation) => ({
      title: conversation.title,
      conversationId: conversation.id,
      count: messageCounts.get(conversation.id) || 0,
      updatedAt: conversation.updatedAt,
      url: conversation.url
    }))
    .sort((a, b) =>
      String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
    );

  console.table(rows);

  return rows;
}
  globalThis.RWC_DEV = globalThis.RWC_DEV || {};

  globalThis.RWC_DEV.auditSignals = auditSignals;
  globalThis.RWC_DEV.listConversations = listConversations;
  globalThis.RWC_DEV.extractDraftSignalsFromText = extractDraftSignalsFromText;
  globalThis.RWC_DEV.signalAuditRules = RULES;

  console.info("[RWC_DEV] Signal audit loaded. Run: await RWC_DEV.auditSignals()");
})();