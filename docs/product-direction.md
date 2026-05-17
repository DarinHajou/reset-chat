Reset with Context — Product Direction and Roadmap
Product direction

Reset with Context is a project-aware continuity tool for AI-assisted work.

The first usable feature is:

Reset a degraded ChatGPT session with useful context.

The broader product direction is:

Checkpoints, project continuity, and searchable crucial moments across many AI sessions.

The product promise:

Keep AI work coherent across sessions.

The tool should not become a full transcript archive. It should preserve the moments that matter.

Those moments include:

decisions
corrections
pivots
rejected paths
constraints
active files/artifacts
bugs
fixes
open questions
handoffs
next steps

The long-term value is not “having more context.”

The value is:

trustworthy continuity
auditability
project truth
source-linked reasoning
recoverability after messy or lost sessions
Two-track roadmap

We need to separate the MVP from the bigger product.

MVP path
capture
→ primitive signals
→ candidate state changes
→ validity / supersession / scope
→ session reset context
→ handoff / continue
Future product path
handoffs + important moments
→ checkpoints
→ project continuity
→ search / traceability
→ sharing / repo export / team use

The reset handoff is the first usable product surface.

Checkpoints are part of the larger product, but they should not block the first handoff feature.

#######################################################################################
Layer 0 — Capture

Status: built and tested.

Purpose:

Capture ChatGPT sessions locally.

Files:

src/content/index.js
src/content/chatgpt-dom-adapter.js
src/content/capture-controller.js
src/background/service-worker.js
src/storage/db.js
src/shared/config.js
src/shared/hash.js

Belongs here:

DOM observation
visible message extraction
role/text/code extraction
stable message IDs
conversationId separation
IndexedDB persistence
multi-chat capture

Does not belong here:

signals
decisions
checkpoints
handoff generation
context guessing

Checkpoint:

Messages are captured, stored, deduped, and separated by conversation.

Current status:

Working.

####################################################################################
Layer 1 — Primitive Signals

Status: in progress.

Purpose:

Detect low-level evidence in messages.

Production file:

src/core/signal-extractor.js

Dev/research helper:

src/dev/signal-audit.dev.js

The audit helper is only for research. It studies stored chats, finds real phrases, exposes noisy rules, and helps decide what should become production signal logic.

The production signal extractor should take one message and emit primitive signals.

Example:

Message:
"Do we agree that IndexedDB is the right storage choice for MVP?"

Signals:
agreement_check
artifact_reference
scope_limiter

It must not decide:

final decision
checkpoint
current project state
handoff content

Universal primitive signals:

instruction
proposal
agreement_check
confirmation
negation
rejection
correction
uncertainty
scope_limiter
completion
clarification_request
frustration_escalation
output_failure
alignment_question
trust_boundary
prior_context_request
decision_pending

Power-user / builder modifiers:

artifact_reference
artifact_state_hint
implementation_checkpoint
quality_bar
role_contract
workflow_contract
debug_problem_state
hard_dependency
release_blocker

Core rule:

Signals are evidence, not truth.

Example:

"We should use IndexedDB"

becomes:

proposal
artifact_reference

not:

final decision: use IndexedDB

Frustration/cusswords:

Raw wording can be stored as local evidence.
Raw wording should not appear directly in handoffs.
It can strengthen nearby correction, rejection, output_failure, or trust_boundary signals.

Checkpoint:

signal-extractor.js emits useful primitive signals from real messages without producing final context.

#######################################################################################
Layer 2 — Candidate State Changes

Status: not started.

Purpose:

Turn primitive signals into possible state changes.

Likely file:

src/core/candidate-extractor.js

Belongs here:

current task candidates
constraint candidates
decision candidates
rejected path candidates
artifact state candidates
workflow rule candidates
open question candidates
reset-context candidates

Examples:

proposal + later confirmation
→ decision candidate

correction + frustration_escalation
→ previous assistant claim likely invalid

artifact_reference + completion
→ implementation state candidate

alignment_question
→ unresolved decision candidate

Rule:

Candidates are provisional.

They must include:

sourceMessageIds
confidence
origin
scope guess
status

Checkpoint:

The system can propose tasks, decisions, corrections, rejected paths, artifact states, and open questions without treating them as final truth.

##########################################################################################
Layer 3 — Validity, Supersession, Scope

Status: not started.

Purpose:

Resolve what is still true, what got replaced, and where each item applies.

Likely file:

src/core/context-resolver.js

Belongs here:

validity
supersession
scope
provenance
confidence

Questions answered here:

Did this evidence actually change the state?
Is there later evidence that supersedes it?
Does it apply globally, to the project, to this session, or only to one artifact?
Is it confirmed, rejected, pending, or uncertain?
Should it be included in reset context?

Examples:

Old reset-time extractor
→ superseded by continuous capture approach

No backend
→ valid MVP constraint

Stable message IDs fix
→ supersedes hash-based message IDs

React later
→ deferred idea, not current implementation requirement

Rule:

Prefer omission over false certainty.

Checkpoint:

The system can separate useful current context from stale or superseded context.

########################################################################################
Layer 4 — Session Reset Context

Status: not started.

Purpose:

Build the compact working state needed for a clean reset.

Likely file:

src/core/reset-context-reducer.js

Reset context fields:

current task
active direction
constraints
confirmed decisions
rejected paths
active artifacts
implementation state
open problems
next step
uncertainties

Important product rule:

Curated working state, not full chat noise.

This layer does not need the full checkpoint system yet.

It only needs to answer:

What does the next ChatGPT session need to know to continue correctly?

Checkpoint:

The system has a compact, source-linked session state that can be used for a reset handoff.

##########################################################################################
Layer 5 — Handoff / Reset Flow

Status: first real user-facing feature after session reset context exists.

Purpose:

Let the user continue in a clean chat with the right context.

Likely file:

src/core/handoff-renderer.js

UI files later:

src/ui/reset-context-modal.js
src/ui/reset-button.js

Flow:

User clicks Reset with Context
→ load current session reset context
→ generate compact handoff
→ optional review
→ copy/open new chat

Optional later addition:

Save generated handoff as a checkpoint.

Handoff sections:

Current task
Implementation/session state
Constraints
Decisions
Rejected paths
Active artifacts
Open problems
Next step
Uncertainties

UX rule:

High confidence = one-click reset
Medium confidence = one-click with review available
Low/conflict = review recommended

Checkpoint:

A new ChatGPT session can continue with less re-explaining than manual copy/paste.

#########################################################################################
Layer 6 — Checkpoints

Status: future product expansion.

Purpose:

Save important moments, handoffs, pivots, fixes, rejected paths, and manual marks as source-linked checkpoints.

Likely future file:

src/core/checkpoint-reducer.js

Checkpoint types:

decision
pivot
correction
rejected_path
implementation_checkpoint
bug_or_failure
fix
artifact_change
scope_change
manual_mark_important
handoff

Manual marking:

User clicks "mark important"
→ high-confidence checkpoint
→ source-linked
→ prioritized in handoff/search

Checkpoint:

Important moments can be preserved independently of a single chat session.

#######################################################################################
Layer 7 — Project Continuity

Status: later, but should influence the data model.

Purpose:

Group multiple AI sessions under one project.

Future stores:

projects
sessions
checkpoints
projectState
handoffs
artifacts

Model:

Project
  Sessions
    Messages
    Signals
  Checkpoints
  Artifacts
  Project state
  Handoffs

Use case:

Project: Notification feature

Sessions:
- planning
- API design
- UI build
- debugging
- refactor

Checkpoints:
- chose architecture
- rejected polling
- added schema
- fixed duplicate notification bug
- current next step

Checkpoint:

A user can continue work from project state, not just one chat.

########################################################################################
Layer 8 — Search and Traceability

Status: later.

Purpose:

Find crucial moments across a project.

Search should prioritize:

checkpoints
decisions
rejected paths
pivots
artifact changes
bug/fix moments
handoffs

Raw messages should be fallback, not the primary search target.

Example searches:

Why did we use IndexedDB?
When did we reject backend storage?
Where did stable message IDs come from?
When did the notification approach change?
What was the last known good checkpoint?
Where did this bug first appear?
What did we decide before the reset?

Checkpoint:

The user can find where something changed, broke, or was decided without digging through long chats.

########################################################################################
Layer 9 — Sharing / Repo Export / Team Use

Status: later hypothesis.

Purpose:

Make project history useful outside the original chat.

Possible outputs:

AI_WORKLOG.md
.ai-checkpoints/
shareable handoff
senior review summary
feature decision log

Use cases:

handoff to senior developer
recover deleted/lost sessions
review why a feature was built this way
trace bad AI-generated assumptions
connect reasoning history to code history

Positioning:

Git tracks code history.
Reset with Context tracks AI-work reasoning history.

Not MVP.

Checkpoint:

The saved project context becomes useful to another human, not just the original user.
Artifact Lifecycle

This deserves its own model later.

Artifacts include:

files
functions
schemas
configs
prompts
plans
handoffs
generated code
implementation snippets

Eventually track:

artifact identity
artifact versions
artifact state
artifact supersession
linked checkpoints
linked sessions
linked source messages

This matters for questions like:

What session created this file?
When did this implementation change?
What was the last known good version?
Which checkpoint introduced this bug?

Not immediate MVP, but important for project continuity.

This is the key design:

Primitive = small evidence object
Trigger = phrase that found it
Span = the meaningful sentence/window around it
Modifier = frustration/negation/uncertainty/etc.
Later layer = decides what changed

Example:

"We are talking about the page header. Forget about the app nav bar."

Layer 1 emits:

{
  kind: "correction",
  subtype: "target_correction",
  trigger: "forget about",
  span: "Forget about the app nav bar",
  nearbyContext: "We are talking about the page header...",
  modifiers: ["frustration"],
  artifactHints: ["page header", "app nav bar"]
}

Layer 2 later turns that into:

Current target: page header
Rejected target: app nav bar

########################################################################################
Current Build Status

Done:

Layer 0 capture is working.

In progress:

Layer 1 signal discovery/tuning.

Current dev tool:

src/dev/signal-audit.dev.js

Its role:

Research real phrases from stored chats.
Find missing/noisy primitive signals.
Help decide production signal rules.
Do not become product logic.

Next implementation step:

Implement src/core/signal-extractor.js conservatively.
Promote only validated primitive patterns from the audit tool.
Operating Rules

These rules keep the project sane:

Capture everything locally.
Promote only meaningful moments.
Preserve source links.
Do not turn guesses into truth.
Prefer omission over false certainty.
Keep reset convenient.
Do not block the MVP handoff behind the future checkpoint system.
Let checkpoints become the bridge from one session to a project later.

The MVP product path:

capture
→ primitive signals
→ candidate state changes
→ validity / supersession / scope
→ session reset context
→ handoff / continue

The broader product path:

handoffs + important moments
→ checkpoints
→ project continuity
→ search / traceability
→ sharing / repo export / team use

TL;DR:

Layer 0 captures facts.
Layer 1 detects primitive signals.
Layer 2 proposes possible state changes.
Layer 3 decides what is still valid.
Layer 4 builds session reset context.
Layer 5 makes reset/handoff useful.
Layer 6 adds checkpoints.
Layer 7 groups sessions into project continuity.
Layer 8 adds search and traceability.
Layer 9 explores sharing, repo export, and team use.

The product should compete on:

trustworthy continuity
auditability
project truth
source-linked reasoning
recoverability across AI sessions