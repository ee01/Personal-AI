# Context Recall Autopilot Boundary Findings

## Initial State

- Randomly selected feature from `docs/features/index.md`: `场景记忆自动驾驶`.
- Capability: Memory Service / Memory Lens.
- Indexed source docs: `docs/features/memory_system.md` and `docs/features/memory_lens.md`.
- Local Reminder scan returned list names `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`; no `Personal AI` list is visible.
- The worktree is already broadly dirty from prior runs. Treat all pre-existing changes as user/automation-owned and keep this run's edits scoped.

## Code Findings

- `memory-service/src/core/ContextRecallService.ts` already builds `autopilot` with mode, summary, candidate/shown/quieted counts, quiet reasons, scene anchors, and gates.
- `src/background.ts` already forwards `result.autopilot` in `CONTEXT_RECALL_REQUEST` responses.
- `src/contentScriptWebIntelligence.ts` previously typed and consumed only `matches/topMatch` for display and cache. The backend's display-before-filtering explanation was not visible in Memory Lens.
- Chosen UX fix: ordinary passive Memory Lens Expanded Card now shows `展示前过滤回执` with `autopilot.summary`, filtered weak-candidate information, scene anchors, and an explicit read-only/no-write/no-access-reinforcement/no-external-send boundary.
- Selection Memory Search remains a user-initiated query and does not show the passive Autopilot receipt.

## External Reference Findings

- OpenAI ChatGPT Memory sources expose which memory/past-chat/files/custom-instruction sources personalized a response and allow corrections or "don't mention this again"; the docs also warn source views may not show every factor.
- Microsoft 365 Copilot Semantic Index uses Microsoft Graph and permission boundaries for contextual retrieval; relevance and personalization are useful only when organizational/user access boundaries are respected.
- Notion AI security docs describe search query generation, vector retrieval/ranking, response generation, and existing-permission honoring.
- Slack AI Search says answers are based on messages/files the user already has access to and include source citations; sharing is a separate explicit action.
- IBM CHI 2025 RAG trust research found confidence indicators alone did not significantly improve trust, while source attribution/highlighting and source controls improved understanding.
- 2025 source-attribution research frames document-level attribution as a practical explainability problem for RAG, especially when sources overlap or contribute complementary evidence.
