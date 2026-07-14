# Findings & Decisions

## Requirements
- User asked for a random `docs/features/index.md` feature sweep: verify docs freshness, research similar products/papers, check Reminders, create a plan first, implement, test as fully as practical, and mark completed Reminder ideas done if used.
- `docs/progressing/to-verify.md` says `暂无`.
- EventKit found `Personal AI` Reminders with 4 total items and 0 incomplete items; no Reflection-related Reminder item was available to incorporate or complete.

## Repository Findings
- Feature selected: `反思本地研究补查` in `docs/features/index.md`, source of truth `docs/features/memory_system.md`.
- Main UI: `src/modals/components/ReflectionThreadDetail.vue`.
- Existing verifier: `tools/verify-reflection-research-e2e.mjs`.
- Current page already shows `本轮研究范围`, summary pills, `研究证据采用回执`, pending request receipts, individual trace rows, and research evidence links.
- Remaining UX gap: the individual `.research-trace-card` rows are visually clear but do not expose a title/ARIA boundary. A user hovering/focusing a specific query cannot immediately tell whether that trace was local-only, whether it adopted evidence, and whether inspecting it triggers query/write/action behavior.

## External Research Findings
- Google NotebookLM frames sources as imported or auto-synced copies and says users can select specific sources for chat, while original Drive files are not edited by NotebookLM. Product implication: source scope and no-write semantics should stay visible at the item level. Source: https://support.google.com/notebooklm/answer/16215270
- Microsoft 365 Copilot memory documents distinguish saved/inferred memories, admin/user controls, and retention/deletion behavior. Product implication: memory-derived personalization needs clear control and persistence boundaries. Source: https://learn.microsoft.com/en-us/microsoft-365/copilot/copilot-personalization-memory
- OpenAI Memory docs distinguish saved memories from chat-history references and explain that saved memories persist until deleted. Product implication: reflection trace evidence should not look like a confirmed durable memory write. Source: https://help.openai.com/en/articles/11146739-how-does-reference-saved-memories-work
- Reflexion argues agents can improve by storing verbal reflections in episodic memory rather than updating model weights. Product implication: reflection traces are reusable reasoning context, not automatically confirmed external truth. Source: https://arxiv.org/abs/2303.11366
- Generative Agents describes observation, reflection, and planning as separable components. Product implication: users need to distinguish raw observations, synthesized reflections, and planned actions. Source: https://arxiv.org/abs/2304.03442
- Reflective Memory Management (ACL 2025) uses cited evidence to refine retrieval and reports fixed retrieval as a challenge. Product implication: local research trace should disclose source clipping, degraded retrieval, and adopted evidence. Source: https://aclanthology.org/2025.acl-long.413/

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add `title`, `aria-label`, `role=group`, and `tabindex=0` to trace cards | Makes the row discoverable to mouse and keyboard users without changing behavior or layout. |
| Derive copy from existing `ReflectionResearchAttempt` fields | Avoids new backend contracts and keeps the boundary tied to status/result/source/evidence data already present in fixtures. |
| Assert hit, skipped, and failed branches in E2E | These cover the main trust states: adopted evidence, no extra query, and failed local retrieval. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Worktree already has broad unrelated dirty state | Keep this run scoped to Reflection detail, the Reflection E2E, docs/index, planning, and automation memory. |

## Resources
- `AGENT.md`
- `docs/features/index.md`
- `docs/features/memory_system.md`
- `src/modals/components/ReflectionThreadDetail.vue`
- `tools/verify-reflection-research-e2e.mjs`
