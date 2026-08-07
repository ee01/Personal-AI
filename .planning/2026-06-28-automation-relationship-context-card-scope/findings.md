# Relationship Context Card Findings

## Initial Selection

- Random sample from `docs/index.md` included Doubao manual push, four-channel recall, Relationship Context Card, Today meeting prep, Source Memory recall card, Memory Lens eval, Prompt Config user context injection, and Meeting History archive.
- Selected `人脉关系 Context Card` because the first two sampled candidates overlap with very recent automation work, while Context Card is a narrower Relationship Radar route distinct from the latest Meeting Brief pending-receipt run.
- Local Reminders lists visible in this session: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`.
- No visible local Reminders list named `Personal AI`; no Reminder feedback is available for this run.

## Code And UX Findings

- Source doc: `docs/features/relationship_radar.md`.
- API route: `memory-service/src/routes/relationships.ts` exposes `POST /api/v1/relationships/context-card` with `personId/personName`, `surface`, `tokenBudget`, and `includeSensitive`.
- Core service: `RelationshipRadarService.buildContextCard()` prefers stored cards, rebuilds when confirmed relationship facts are newer, redacts sensitive aliases/facts/evidence/open loops/retrieval hints by default, and returns `privacySummary` plus `contextReceipt`.
- UI: `RelationshipRadarPage.vue` already shows the final `上下文卡回执`, privacy strip, sensitive inclusion action, failure receipt, and copy toast for stale snapshots.
- Gap: during a same-person refresh or sensitive-scope toggle, `isContextLoading` hides the current card behind a generic `正在生成上下文卡...` state. The old card remains in state, but the visible UI does not say whether the old snapshot is still the last confirmed display or whether the new privacy scope has been applied.

## External Reference Findings

- Microsoft Dynamics 365 relationship intelligence shows relationship health, activity history, and "who knows whom" suggestions based on interaction data. This supports keeping source/activity basis visible before acting on relationship suggestions. https://learn.microsoft.com/en-us/dynamics365/sales/ri-overview
- Affinity relationship intelligence uses recency/frequency and relationship-strength signals to identify attention and follow-up timing. This supports showing requested/current scope and action readiness on the card, not only after the final result. https://www.affinity.co/product/relationship-intelligence
- Salesforce Einstein Relationship Insights positions itself as AI-powered relationship research/discovery. The useful analogue for Personal AI is evidence-backed context, not automatic external action. https://help.salesforce.com/s/articleView?id=ind.intro_eri.htm&language=en_US&type=5
- The Scientific Reports paper "Artificial intelligence in communication impacts language and social relationships" shows AI writing assistance can change interpersonal perception; that supports keeping external-sharing and sensitive-context state explicit. https://www.nature.com/articles/s41598-023-30938-9
- "AI Transparency in the Age of LLMs" argues transparency should support appropriate human understanding in context. A pending receipt is a small contextual transparency control. https://arxiv.org/abs/2306.01941
- Microsoft Human-AI Interaction Guidelines emphasize expectation management, efficient invocation, and recovery/correction. The selected pending receipt keeps invocation and recovery visible while the AI/card refresh is uncertain. https://www.microsoft.com/en-us/research/wp-content/uploads/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf
