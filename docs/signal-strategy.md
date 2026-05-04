1. Product focus
Reset with Context is optimized for high-context power users/builders, but uses universal low-level speech signals first.

2. Architecture rule
Bottom-up pipeline:
raw message
→ primitive signals
→ candidates
→ validity/supersession/scope
→ reset context
→ handoff

3. Signal layers
Universal primitives:
instruction, proposal, agreement_check, confirmation, negation, rejection, correction, uncertainty, scope_limiter, completion, clarification_request, frustration_escalation

Power-user/domain modifiers:
artifact_reference, artifact_state_hint, implementation_checkpoint, quality_bar, role_contract, workflow_contract, debug/problem_state

4. Important rule
Signals are evidence, not truth.

5. Sanitization rule
Raw frustration/cusswords are stored as evidence but should not appear in the handoff.

6. UX rule
High confidence = one-click reset.
Medium = one-click with review available.
Low/conflict = review recommended.

7. Audit plan
Use src/dev/signal-audit.dev.js to discover real phrases from stored chats before hardcoding too much.