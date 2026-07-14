# Dream Replay Findings

## Repo Context

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows the freshest exact surfaces were Memory Lens selection search, Skill Foundry local scan, Agent Thinking result handoff, Memory Search keyboard open, Prompt Config restore impact, Today popup overflow, and other trust-receipt work. `梦境重放` was only adjacent to older dream deep-link work, not the latest exact surface.
- AppleScript listed local Reminder lists but missed `Personal AI`; EventKit found `Personal AI` with 4 total items and 0 incomplete items. No Reminder item is available to incorporate or mark done.

## Current Dream Replay Behavior

- `DreamInsights.vue` already shows page scope, evidence status, deep-link safety, per-card time receipt, grounding receipt, triage receipt, notification-hit receipt, and an expanded-card review handoff.
- The user-visible gap is path friction: collapsed cards show the triage/priority decision but hide the review action until the user expands the card.

## External Scan

- OpenAI Memory controls emphasize that memory systems need user control, management, and correction paths around background memory behavior: https://openai.com/index/memory-and-new-controls-for-chatgpt/
- Microsoft Recall privacy controls emphasize visible snapshot scope, filtering, deletion, and user control over retained history: https://support.microsoft.com/en-US/Windows/privacy/privacy-and-control-over-your-recall-experience
- screenpipe positions local AI memory as captured work history that becomes searchable memory and automations, with local-first framing: https://screenpipe.com/
- Generative Agents describes memory stream, reflection, and planning as separate components; reflection synthesizes memories but remains a step before future behavior: https://arxiv.org/abs/2304.03442
- Reflexion stores verbal reflections in episodic memory for future decisions without weight updates, supporting visible review boundaries before those reflections influence action: https://arxiv.org/abs/2303.11366

## Decision

Add a visible review handoff row on each dream card. It should carry the same route and no-write boundary as the expanded receipt, so the user sees both "what to do next" and "what will not happen" before expanding long generated content.
