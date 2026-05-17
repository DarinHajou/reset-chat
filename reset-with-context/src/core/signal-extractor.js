// src/core/signal-extractor.js
//
// Reset with Context
// Primitive signal extractor.
//
// Purpose:
// - Convert captured messages into low-level evidence signals.
// - Do NOT decide final project state.
// - Do NOT generate handoff text.
// - Do NOT treat single words as truth.
// - Emit events + modifiers for later candidate/state layers.

(() => {
  "use strict";

  const SIGNAL_KINDS = Object.freeze({
    INSTRUCTION: "instruction",
    PROPOSAL: "proposal",
    CORRECTION: "correction",
    REJECTION: "rejection",
    SCOPE_CONSTRAINT: "scope_constraint",
    ALIGNMENT_QUESTION: "alignment_question",
    CLARIFICATION_REQUEST: "clarification_request",
    OUTPUT_FAILURE: "output_failure",
    TRUST_BOUNDARY: "trust_boundary",
    PRIOR_CONTEXT_REQUEST: "prior_context_request",
    DECISION_PENDING: "decision_pending",
    COMPLETION_MARKER: "completion_marker",
    ARTIFACT_REFERENCE: "artifact_reference",
    ARTIFACT_STATE_HINT: "artifact_state_hint"
  });

  const MODIFIERS = Object.freeze({
    NEGATION: "negation",
    UNCERTAINTY: "uncertainty",
    FRUSTRATION: "frustration",
    QUALITY_PRESSURE: "quality_pressure",
    TOPIC_SHIFT: "topic_shift",
    ROLE_CONTRACT: "role_contract"
  });

  const EVENT_RULES = [
    {
      kind: SIGNAL_KINDS.CORRECTION,
      subtype: "target_correction",
      confidence: 0.9,
      priority: 0.9,
      patterns: [
        /\b(i said|we said)\b[\s\S]{0,120}?\b(not|not this|not that)\b[\s\S]{0,120}/gi,
        /\b(not what i meant|not what i asked|not what we did|that's not what|that is not what)\b[\s\S]{0,160}/gi,
        /\b(forget about|ignore that|wrong screen|wrong page|wrong file|wrong component|wrong direction|wrong target)\b[\s\S]{0,160}/gi,
        /\b(there's no such thing|there is no such thing)\b[\s\S]{0,160}/gi,
        /\b(we are talking about|what we are working on now is)\b[\s\S]{0,180}/gi
      ]
    },
    {
      kind: SIGNAL_KINDS.CORRECTION,
      subtype: "soft_correction",
      confidence: 0.65,
      priority: 0.65,
      patterns: [
        /\b(i meant|what i meant|sorry, i mean|rather than)\b[\s\S]{0,160}/gi,
        /\b(actually|instead|i mean)\b[\s\S]{0,140}/gi
      ],
      gated: true
    },
    {
      kind: SIGNAL_KINDS.REJECTION,
      subtype: "explicit_rejection",
      confidence: 0.85,
      priority: 0.8,
      patterns: [
        /\b(i don't want|we don't want|don't do that|do not do that|skip that|remove that|throw that away)\b[\s\S]{0,160}/gi,
        /\b(not the right approach|we shouldn't|wrong direction|not useful|that's not useful)\b[\s\S]{0,160}/gi
      ]
    },
    {
      kind: SIGNAL_KINDS.SCOPE_CONSTRAINT,
      subtype: "scope_limit",
      confidence: 0.85,
      priority: 0.8,
      patterns: [
        /\b(for mvp|mvp scope|for now|not now|not yet|out of scope|keep it simple|don't overbuild|do not overbuild)\b[\s\S]{0,160}/gi,
        /\b(no backend|local only|no ui|no npm|no react|dev-only|not production|not product logic)\b[\s\S]{0,160}/gi,
        /\b(don't restart from scratch|do not restart from scratch|continue, do not restart)\b[\s\S]{0,160}/gi
      ]
    },
    {
      kind: SIGNAL_KINDS.OUTPUT_FAILURE,
      subtype: "assistant_output_failure",
      confidence: 0.85,
      priority: 0.9,
      patterns: [
        /\b(too vague|vague crap|vague language|this makes no sense|doesn't make sense|makes no sense)\b[\s\S]{0,160}/gi,
        /\b(no one can understand this|is this supposed to help|these aren't real instructions|these are not real instructions)\b[\s\S]{0,160}/gi,
        /\b(cryptic|sounds robotic|wrong output|bad output|all over the place|ignoring the last message|you ignored)\b[\s\S]{0,160}/gi
      ]
    },
    {
      kind: SIGNAL_KINDS.TRUST_BOUNDARY,
      subtype: "trust_check",
      confidence: 0.8,
      priority: 0.85,
      patterns: [
        /\b(are you sure|are you just guessing|just guessing|making this up|is this actually true|can you verify)\b[\s\S]{0,160}/gi,
        /\b(talking out of your ass|guessing earlier|what were you doing earlier)\b[\s\S]{0,160}/gi
      ]
    },
    {
      kind: SIGNAL_KINDS.ALIGNMENT_QUESTION,
      subtype: "direction_check",
      confidence: 0.8,
      priority: 0.7,
      patterns: [
        /\b(do we like this|do we want this|do we even want|should we have|should we use|should we keep)\b[\s\S]{0,160}/gi,
        /\b(is this right|is this correct|is this the right|so roughly like this|so more or less like this)\b[\s\S]{0,160}/gi,
        /\b(where do we decide|where should this go|which direction|which approach|icon or image|any suggestion for)\b[\s\S]{0,160}/gi
      ]
    },
    {
      kind: SIGNAL_KINDS.CLARIFICATION_REQUEST,
      subtype: "clarification",
      confidence: 0.75,
      priority: 0.6,
      patterns: [
        /\b(what do you mean|can you clarify|do you mean|which one|which file|where exactly|can you explain)\b[\s\S]{0,160}/gi,
        /^(what\?|what no\?|what no|huh\?|why\?)$/gi
      ]
    },
    {
      kind: SIGNAL_KINDS.PRIOR_CONTEXT_REQUEST,
      subtype: "context_recall",
      confidence: 0.85,
      priority: 0.8,
      patterns: [
        /\b(do you remember|remember the setup|what was the setup|where were we|as we said before|from earlier|previous setup)\b[\s\S]{0,180}/gi,
        /\b(last message|previous message|message above|this conversation|the handoff|this handoff)\b[\s\S]{0,160}/gi
      ]
    },
    {
      kind: SIGNAL_KINDS.DECISION_PENDING,
      subtype: "blocked_or_pending",
      confidence: 0.85,
      priority: 0.85,
      patterns: [
        /\b(need to align|we need to align|need to consult|i need to consult|big decision|big decisions)\b[\s\S]{0,180}/gi,
        /\b(before i continue|before we continue|nothing can go live before|blocked until|depends on|waiting for)\b[\s\S]{0,180}/gi
      ]
    },
    {
      kind: SIGNAL_KINDS.COMPLETION_MARKER,
      subtype: "progress_marker",
      confidence: 0.75,
      priority: 0.65,
      patterns: [
        /\b(done|that part is done|we are done with|we're done with|moving on|ready to move on|next step|checkpoint|final decision|where we landed)\b[\s\S]{0,160}/gi
      ]
    },
    {
      kind: SIGNAL_KINDS.INSTRUCTION,
      subtype: "direct_request",
      confidence: 0.7,
      priority: 0.55,
      patterns: [
        /\b(please|can you|could you|help me|i need you to|i want you to)\b[\s\S]{0,160}/gi,
        /\b(build|create|write|rewrite|refactor|fix|update|change|remove|delete|rename|inspect|compare|summarize)\b[\s\S]{0,160}/gi
      ],
      gated: true
    },
    {
      kind: SIGNAL_KINDS.PROPOSAL,
      subtype: "soft_proposal",
      confidence: 0.65,
      priority: 0.5,
      patterns: [
        /\b(maybe we could|we could|what if|how about|one option is|another option is|i suggest|we should|let's)\b[\s\S]{0,160}/gi
      ]
    },
    {
      kind: SIGNAL_KINDS.ARTIFACT_REFERENCE,
      subtype: "artifact_reference",
      confidence: 0.8,
      priority: 0.65,
      patterns: [
        /\b(src\/[a-z0-9_./-]+|[a-z0-9_-]+\.(js|ts|tsx|jsx|css|json|md))\b/gi,
        /\b(this file|the file|this code|the code|this screen|the screen|the component|service worker|content script|manifest|indexeddb)\b[\s\S]{0,120}/gi
      ]
    },
    {
      kind: SIGNAL_KINDS.ARTIFACT_STATE_HINT,
      subtype: "artifact_state",
      confidence: 0.65,
      priority: 0.55,
      patterns: [
        /\b(current|existing|old|new|missing|broken|fixed|loaded|stored|captured|updated|changed)\b[\s\S]{0,120}/gi
      ],
      gated: true
    }
  ];

  const MODIFIER_RULES = [
    {
      modifier: MODIFIERS.NEGATION,
      patterns: [/\b(don't|do not|not|never|cannot|can't|shouldn't|won't)\b/gi]
    },
    {
      modifier: MODIFIERS.UNCERTAINTY,
      patterns: [/\b(maybe|probably|possibly|i think|i guess|idk|not sure|unclear|might|could be)\b/gi]
    },
    {
      modifier: MODIFIERS.FRUSTRATION,
      patterns: [/\b(wtf|what the fuck|are you dumb|stupid|trash|fucking|come on|seriously)\b/gi]
    },
    {
      modifier: MODIFIERS.QUALITY_PRESSURE,
      patterns: [/\b(best practice|best practices|how pros|very best|senior|real-world|practical|clear|not vague|production-ready|robust|scalable)\b/gi]
    },
    {
      modifier: MODIFIERS.TOPIC_SHIFT,
      patterns: [/\b(btw|by the way|moving on|next screen|next part|switching gears|new topic|another thing)\b/gi]
    },
    {
      modifier: MODIFIERS.ROLE_CONTRACT,
      patterns: [/\b(act as|assume the role|respond as|senior product engineer|senior designer|be direct|be concise)\b/gi]
    }
  ];

  function extractSignalsFromMessage(message, userOptions = {}) {
    const options = {
      contextRadius: 120,
      skipCodeLike: true,
      ...userOptions
    };

    const source = normalizeMessageText(message?.text || "");

    if (!source) {
      return [];
    }

    const modifiers = extractModifiers(source);
    const signals = [];
    const seen = new Set();

    for (const rule of EVENT_RULES) {
      if (rule.gated && shouldSkipGatedRule(source, rule)) {
        continue;
      }

      for (const pattern of rule.patterns) {
        const re = cloneGlobalRegex(pattern);
        let match;

        while ((match = re.exec(source))) {
          const raw = cleanSpan(match[0]);

          if (!raw) continue;

          const trigger = cleanSpan(match[1] || raw.split(/\s+/).slice(0, 4).join(" "));
          const span = limitText(raw, 260);
          const start = match.index;
          const end = match.index + match[0].length;

          const key = [rule.kind, rule.subtype, normalizeKey(span), start].join(":");
          if (seen.has(key)) continue;
          seen.add(key);

          signals.push({
            kind: rule.kind,
            subtype: rule.subtype,
            trigger: normalizeTrigger(trigger),
            span,
            context: getContext(source, start, end, options.contextRadius),
            modifiers: modifiersForContext(modifiers, start, end, source.length),
            priority: scoreWithModifiers(rule.priority, modifiers),
            confidence: rule.confidence,
            sourceMessageId: message?.id || null,
            conversationId: message?.conversationId || null,
            messageIndex: Number.isFinite(message?.index) ? message.index : null,
            role: message?.role || "unknown",
            start,
            end
          });

          if (re.lastIndex === match.index) {
            re.lastIndex += 1;
          }
        }
      }
    }

    return sortSignals(signals);
  }

  function extractSignalsFromMessages(messages, options = {}) {
    return (messages || []).flatMap((message) =>
      extractSignalsFromMessage(message, options)
    );
  }

  function extractModifiers(source) {
    const modifiers = [];

    for (const rule of MODIFIER_RULES) {
      for (const pattern of rule.patterns) {
        const re = cloneGlobalRegex(pattern);
        let match;

        while ((match = re.exec(source))) {
          modifiers.push({
            modifier: rule.modifier,
            trigger: normalizeTrigger(match[0]),
            start: match.index,
            end: match.index + match[0].length
          });

          if (re.lastIndex === match.index) {
            re.lastIndex += 1;
          }
        }
      }
    }

    return modifiers;
  }

  function modifiersForContext(modifiers, start, end, sourceLength) {
    const radius = 160;
    const left = Math.max(0, start - radius);
    const right = Math.min(sourceLength, end + radius);

    return Array.from(
      new Set(
        modifiers
          .filter((item) => item.end >= left && item.start <= right)
          .map((item) => item.modifier)
      )
    );
  }

  function scoreWithModifiers(basePriority, modifiers) {
    let score = basePriority;

    if (modifiers.some((item) => item.modifier === MODIFIERS.FRUSTRATION)) {
      score += 0.1;
    }

    if (modifiers.some((item) => item.modifier === MODIFIERS.QUALITY_PRESSURE)) {
      score += 0.05;
    }

    return Math.min(1, Number(score.toFixed(2)));
  }

  function shouldSkipGatedRule(source, rule) {
    if (looksLikeCodeOrLog(source)) {
      return true;
    }

    if (
      rule.kind === SIGNAL_KINDS.ARTIFACT_STATE_HINT &&
      !/\b(file|code|screen|component|script|extension|db|database|indexeddb|src\/|\.js|\.json|\.ts|\.tsx)\b/i.test(source)
    ) {
      return true;
    }

    return false;
  }

  function looksLikeCodeOrLog(text) {
    const value = String(text || "");

    if (!value.trim()) return false;

    if (
      value.includes("signal-audit.dev.js:") ||
      value.includes("console.table") ||
      value.includes("Uncaught ") ||
      value.includes("Array(")
    ) {
      return true;
    }

    if (/```|function\s+\w+|const\s+\w+|let\s+\w+|return\s+|=>|class\s+\w+|import\s+|export\s+/i.test(value)) {
      return true;
    }

    const symbolCount = (value.match(/[{}[\]();=<>]/g) || []).length;
    return value.length > 200 && symbolCount / value.length > 0.035;
  }

  function normalizeMessageText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/^You said:\s*/i, "")
      .replace(/^ChatGPT said:\s*/i, "")
      .trim();
  }

  function getContext(text, start, end, radius) {
    const left = Math.max(0, start - radius);
    const right = Math.min(text.length, end + radius);

    return text.slice(left, right).replace(/\s+/g, " ").trim();
  }

  function cleanSpan(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function limitText(value, maxLength) {
    const text = String(value || "");

    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength).trim()}…`;
  }

  function normalizeTrigger(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/^[\s"'`.,:;!?()[\]{}]+/, "")
      .replace(/[\s"'`.,:;!?()[\]{}]+$/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKey(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[`"'“”‘’]/g, "")
      .replace(/[^\w\s./-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cloneGlobalRegex(pattern) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    return new RegExp(pattern.source, flags);
  }

  function sortSignals(signals) {
    return signals.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.start - b.start;
    });
  }

  globalThis.RWC_SIGNAL_EXTRACTOR = Object.freeze({
    SIGNAL_KINDS,
    MODIFIERS,
    extractSignalsFromMessage,
    extractSignalsFromMessages
  });
})();