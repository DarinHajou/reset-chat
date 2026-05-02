(function () {
  const BUTTON_ID = "reset-chat-button";

  function injectButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "Reset with context";

    button.addEventListener("click", handleResetClick);

    document.body.appendChild(button);
  }

  async function handleResetClick() {
    const messages = extractChatMessages();

    if (!messages.length) {
      alert("Reset Chat could not find any loaded chat messages.");
      return;
    }

    const restartPrompt = buildRestartPrompt(messages);
    const copied = await copyToClipboard(restartPrompt);

    openNewChat();

    if (copied) {
      alert("Restart prompt copied. Paste it into the new ChatGPT chat.");
    } else {
      alert("New chat opened, but clipboard copy failed. Check the console.");
      console.log("Reset Chat restart prompt:", restartPrompt);
    }
  }

  function extractChatMessages() {
    const selectors = [
      "[data-message-author-role]",
      "[data-testid^='conversation-turn']",
      "article"
    ];

    let nodes = [];

    for (const selector of selectors) {
      nodes = Array.from(document.querySelectorAll(selector));
      if (nodes.length > 0) break;
    }

    return nodes
      .map((node, index) => {
        const text = cleanText(node.innerText || "");

        return {
          index,
          role: getMessageRole(node, text),
          text
        };
      })
      .filter((message) => message.text.length > 20)
      .filter((message) => !message.text.includes("Reset with context"))
      .filter(uniqueMessageFilter);
  }

  function getMessageRole(node, text) {
    const explicitRole = node.getAttribute("data-message-author-role");

    if (explicitRole) return explicitRole;

    const lower = text.toLowerCase();

    if (lower.startsWith("you said:") || lower.startsWith("you:")) {
      return "user";
    }

    return "unknown";
  }

  function buildRestartPrompt(messages) {
    const summary = generateProjectSummary(messages);
    const recentUserInstructions = getRecentUserInstructions(messages);
    const importantParts = getImportantParts(messages);
    const currentProblem = getCurrentProblem(messages);

    return `You are continuing a previous ChatGPT conversation after a reset.

## Project Summary

${summary}
Do not restart from scratch. Continue from the context below.

## Current problem / active task

${currentProblem}

## Recent user instructions

${recentUserInstructions}

## Important decisions, constraints, and direction

${importantParts}

## Continue from here

Start by giving a brief recap of:
1. What we are building
2. Current implementation state
3. Most recent unresolved issue, if any

Then ask the user what they want help with next.

Do not assume the latest technical issue is still active unless the user says so.
Do not continue debugging old problems automatically.

Rules:
- Preserve the user's current goal.
- Prioritize the latest user intent.
- Do not restart from scratch.
- Do not continue solving old issues unless clearly still active.
- If the next task is ambiguous, recap and ask what the user wants help with.
- Be practical and concise.`;
  }

  function getRecentUserInstructions(messages) {
    const instructions = messages
      .filter((message) => message.role === "user")
      .filter((message) => looksLikeInstruction(message.text))
      .slice(-6)
      .map(formatMessage)
      .join("\n\n");

    return instructions || "No clear recent user instructions found.";
  }

  function getImportantParts(messages) {
    const importantParts = messages
      .filter((message) => looksImportant(message.text))
      .slice(-8)
      .map(formatMessage)
      .join("\n\n");

    return importantParts || "No clear decision-looking parts found.";
  }

  function getCurrentProblem(messages) {
    const recentUserMessages = messages
      .filter((message) => message.role === "user")
      .slice(-3)
      .map(formatMessage)
      .join("\n\n");

    return recentUserMessages || "No clear current problem found.";
  }

  function looksLikeInstruction(text) {
    const lower = text.toLowerCase();

    return [
      "don't",
      "don’t",
      "do not",
      "avoid",
      "make sure",
      "remember",
      "keep",
      "instead",
      "the goal",
      "for v1",
      "for mvp",
      "important",
      "constraint",
      "scope"
    ].some((term) => lower.includes(term));
  }

  function looksImportant(text) {
    const lower = text.toLowerCase();

    return [
      "decision",
      "decided",
      "constraint",
      "scope",
      "mvp",
      "v1",
      "phase 1",
      "important",
      "principle",
      "architecture",
      "tradeoff",
      "not good enough",
      "roadmap",
      "checkpoint"
    ].some((term) => lower.includes(term));
  }

  function formatMessage(message) {
    return `### ${normalizeRole(message.role)}
${trimTo(message.text, 500)}`;
  }

  function normalizeRole(role) {
    if (role === "user") return "User";
    if (role === "assistant") return "Assistant";
    return "Message";
  }

  function cleanText(text) {
    return text
      .replace(/Copy code/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function trimTo(text, maxLength) {
    if (!text) return "";

    if (text.length <= maxLength) {
      return text;
    }

    return text.slice(0, maxLength).trim() + "\n...[trimmed]";
  }

  function uniqueMessageFilter(message, index, messages) {
    const firstMatchIndex = messages.findIndex((candidate) => {
      return (
        candidate.role === message.role &&
        candidate.text.slice(0, 160) === message.text.slice(0, 160)
      );
    });

    return firstMatchIndex === index;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn("Reset Chat: failed to copy prompt to clipboard.", error);
      return false;
    }
  }

  function openNewChat() {
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
  }

  function generateProjectSummary(messages) {
    const recent = messages.slice(-20);

    const userMsgs = recent.filter((m) => m.role === "user");
    const assistantMsgs = recent.filter((m) => m.role === "assistant");

    const goal = userMsgs.slice(-3).map((m) => m.text).join(" ");
    const assistantHints = assistantMsgs
      .slice(-2)
      .map((m) => trimTo(m.text, 400))
      .join("\n\n");

    return trimTo(
      `## What matters (read this first)

We are working on:
${extractHighLevelGoal(goal)}

Current stage:
${extractStage(recent)}

Recent direction:
${assistantHints}

Next step:
${inferNextStep(recent)}

Constraints:
- Keep solution simple
- Avoid overengineering
- Focus on current working flow

Important:
- Prioritize latest user intent
- Continue, do not restart
`,
      1200
    );
  }

  function extractHighLevelGoal(text) {
    return text
      .split(".")
      .slice(0, 2)
      .join(".")
      .trim();
  }

  function extractStage(messages) {
    const joined = messages.map((m) => m.text.toLowerCase()).join(" ");

    if (joined.includes("prototype") || joined.includes("first test")) {
      return "early prototype / testing";
    }

    if (joined.includes("mvp")) {
      return "MVP development";
    }

    if (joined.includes("debug") || joined.includes("fix")) {
      return "debugging phase";
    }

    return "active development";
  }

  function inferNextStep(messages) {
    const recentText = messages.map((m) => m.text.toLowerCase()).join(" ");

    if (recentText.includes("test") || recentText.includes("working")) {
      return "Validate behavior and improve output quality";
    }

    if (recentText.includes("build") || recentText.includes("implement")) {
      return "Continue implementation from current state";
    }

    if (recentText.includes("improve") || recentText.includes("optimize")) {
      return "Refine current approach for better results";
    }

    return "Continue based on latest user instruction";
  }

  injectButton();

  const observer = new MutationObserver(() => {
    injectButton();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();