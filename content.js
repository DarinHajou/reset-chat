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
      .filter((message) => !message.text.includes("You are continuing a previous ChatGPT conversation after a reset"))
      .filter((message) => !isLowSignal(message.text))
      .filter(uniqueMessageFilter);
  }

  function isLowSignal(text) {
    const clean = text.trim().toLowerCase();

    if (clean.length < 25) return true;

    const punctuationRatio =
      clean.replace(/[a-z0-9 ]/g, "").length / clean.length;

    if (punctuationRatio > 0.3) return true;

    const toxicWords = ["fuck", "shit", "whore", "idiot", "trash", "stupid"];

    if (toxicWords.some(word => clean.includes(word))) return true;

    return false;
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
    const currentProblem = getCurrentProblem(messages);

    return `You are continuing a previous ChatGPT conversation after a reset.

## Project Summary

${summary}
Do not restart from scratch. Continue from the context below.

## Current problem / active task

${currentProblem}

## Recent user instructions

${recentUserInstructions}

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
    return messages
      .filter(m => m.role === "user")
      .filter(m => looksLikeInstruction(m.text))
      .slice(-5)
      .map(formatMessage)
      .join("\n\n") || "No clear recent user instructions found.";
  }

  function getCurrentProblem(messages) {
    return messages
      .filter(m => m.role === "user")
      .filter(m => !isLowSignal(m.text))
      .slice(-2)
      .map(formatMessage)
      .join("\n\n") || "No clear current problem found.";
  }

  function looksLikeInstruction(text) {
    const lower = text.toLowerCase();

    return [
      "don't",
      "do not",
      "avoid",
      "make sure",
      "remember",
      "instead",
      "constraint",
      "scope",
      "goal"
    ].some(term => lower.includes(term));
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
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + "\n...[trimmed]";
  }

  function uniqueMessageFilter(message, index, messages) {
    const firstMatchIndex = messages.findIndex((candidate) =>
      candidate.role === message.role &&
      candidate.text.slice(0, 160) === message.text.slice(0, 160)
    );

    return firstMatchIndex === index;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function openNewChat() {
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
  }

  function generateProjectSummary(messages) {
    const recent = messages.slice(-20);

    const assistantMsgs = recent
      .filter(m => m.role === "assistant")
      .filter(m => !isLowSignal(m.text));

    const goal = inferProjectGoal(messages);

    const assistantHints = assistantMsgs
      .slice(-1)
      .map(m => extractKeySentence(m.text))
      .join("\n");

    return trimTo(
`## What matters (read this first)

We are working on:
${goal}

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
- Continue, do not restart`,
1200
    );
  }

  function inferProjectGoal(messages) {
    const allText = messages.map(m => m.text.toLowerCase()).join(" ");

    if (
      allText.includes("reset with context") ||
      allText.includes("chrome extension")
    ) {
      return "Improve a Chrome extension that reconstructs ChatGPT context and reduces prompt noise.";
    }

    return "Improve a Chrome extension that reconstructs ChatGPT context and reduces prompt noise.";
  }

  function extractKeySentence(text) {
    return text.split(".").slice(0, 1).join(".").trim();
  }

  function extractStage(messages) {
    const joined = messages.map(m => m.text.toLowerCase()).join(" ");

    if (joined.includes("debug")) return "debugging phase";
    if (joined.includes("mvp")) return "MVP development";
    if (joined.includes("prototype")) return "early prototype / testing";

    return "active development";
  }

  function inferNextStep(messages) {
    const text = messages.map(m => m.text.toLowerCase()).join(" ");

    if (text.includes("test")) return "Validate behavior and improve output quality";
    if (text.includes("build")) return "Continue implementation from current state";

    return "Continue based on latest user instruction";
  }

  injectButton();

  new MutationObserver(injectButton).observe(document.body, {
    childList: true,
    subtree: true
  });

})();