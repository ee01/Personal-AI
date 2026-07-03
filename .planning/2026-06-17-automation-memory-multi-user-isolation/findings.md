# Memory Multi-User Isolation Findings

## Requirements

- Pick one random feature from `docs/features/index.md`.
- Check that the feature document still matches code.
- Search current industry products and papers for similar functionality and constructive ideas.
- Inspect unfinished work and implement any low-decision improvement.
- Review code for bugs, blocks, and UX/design gaps.
- Check local Reminders `Personal AI` list and include related items if present.
- Write a plan first, implement step by step, test as completely as practical, update docs, update automation memory, and archive when possible.

## Initial Discovery

- `docs/progressing/to-verify.md` says `暂无。`, so there is no carry-over verification item to continue.
- Existing automation memory shows very recent sweeps of OpenClaw Action Queue receipts, Ask follow-up receipts, Google Slides recovery receipts, search feedback failure receipts, Prompt Config sensitive-context receipts, Skill Foundry decision receipts, Meeting Pilot alert receipts, Native Join app retry, Agent Workflow baseline acceptance, Memory Ingestion batch trust summary, Task Scheduler refresh receipts, Today Mission feedback, Decision Center watch checks, Jira Automation Import name checks, Agent Thinking diagnostic copy, Compose Assist review backout, Topic deep-link stability, and Doubao Mobile Context manual receipts.
- Random target selected after avoiding those freshest exact focus areas: `多用户隔离` / Memory Service, documented in `docs/features/memory_system.md`.
- Local Reminders list names were readable on the second probe: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, and `Tasks`.
- No visible Reminders list named `Personal AI`; no Reminder item can be incorporated or marked complete in this run.

## Code And UX Findings

- `docs/features/memory_system.md` describes multi-user isolation as per-user SQLite at `data/users/{userId}/memory.db`, `X-User-Id` identity resolution, read-only fallback to `default`, write-operation fail-closed behavior when identity is missing or blank, SSE `?userId=`, `/stats` identity receipts, and visible Memory Exploring identity status.
- Backend code largely matches the document:
  - `memory-service/src/utils/userIdentity.ts` validates user IDs with `^[a-zA-Z0-9._-]+$`, rejects duplicate headers, and treats missing/blank headers as `default` fallback.
  - `memory-service/src/middleware/auth.ts` attaches a per-user context for every non-health/docs request.
  - `memory-service/src/middleware/writeGuard.ts` blocks non-read methods when identity resolution falls back because the header is missing or blank.
  - `memory-service/src/core/UserContextManager.ts` creates isolated SQLite/Markdown directories per validated user and rejects unsafe direct IDs before storage creation.
  - `memory-service/src/routes/stats.ts` returns `user.id`, `isolation`, `storageKey`, and `fallbackToDefault`.
  - `memory-service/src/routes/events.ts` validates EventSource query `userId`, reports the identity source in the connected receipt, and filters per-user events.
- Existing verification anchors:
  - `memory-service/src/__tests__/api-health.test.ts` covers `/stats` identity metadata, duplicate headers, write guard, unsafe direct user IDs, and unsafe skill share-token user IDs.
  - `memory-service/src/__tests__/events.test.ts` plus `tools/verify-memory-events-multiuser.ts` cover SSE query identity and client delayed EventSource opening after async user resolution.
  - `tools/verify-memory-user-identity-e2e.mjs` covers the Memory Exploring identity status display.
- UX/security gap found: `MemoryServiceClient` starts with `userId='default'` and always sends `X-User-Id: default`, even when no real `userinfo.username` was resolved. That turns an unresolved local identity into an explicit default identity:
  - `/stats` reports `fallbackToDefault=false`, so Memory Exploring does not warn the user.
  - write routes receive an explicit header and are not stopped by `writeGuardMiddleware`.
  - EventSource opens `/events?userId=default`, so the connected receipt says query identity rather than `default_fallback`.
- Low-decision implementation slice: track whether the client user ID was explicitly configured/resolved. Send `X-User-Id` and `events?userId=` only when identity is explicit/resolved; leave identity absent when the client is still in unresolved default fallback, so read paths show fallback receipts and write paths fail closed.

## External Reference Findings

- OpenAI's ChatGPT Memory FAQ separates saved memories from chat history, exposes settings to enable/disable memory, lets users manage/delete memories, and notes temporary chat as a way to avoid using saved memory. Constructive implication: Personal AI should keep unresolved identity visible and avoid writing persistent memory under an implicit default account.
- Anthropic's Claude memory announcement says memory is optional, user-controllable, supports Incognito chats, and creates separate memories per project so confidential and unrelated work stays separated. Constructive implication: Personal AI should treat a missing user identity as a boundary condition, not silently collapse it into a writable shared default space.
- Microsoft 365 Copilot privacy docs state that grounding respects the current user's identity-based access boundary and tenant permissions so data is only presented when the user is authorized. Constructive implication: the client should not manufacture an authorization identity from a placeholder value.
- Azure's secure multitenant RAG architecture guide frames identity-provider authorization and authorized grounding-data selection as the core multitenancy concern. Constructive implication: server-side write guards are useful only if clients preserve the difference between an authenticated identity and a missing identity.
- AWS's multi-tenant RAG guidance emphasizes tenant-specific data isolation and preventing cross-tenant access or unintended leakage. Constructive implication: default/fallback spaces should be clearly marked and fail-closed for mutation.
- The 2026 arXiv paper "Securing the Agent: Vendor-Neutral, Multitenant Enterprise Retrieval and Tool Use" argues that relevance ranking is not authorization and proposes layered server-side enforcement. Constructive implication: Personal AI should not let high-level client defaults bypass server-side identity enforcement.

## Resources

- `AGENT.md`
- `docs/features/index.md`
- `docs/features/memory_system.md`
- `${CODEX_HOME:-$HOME/.codex}/automations/automation/memory.md`
- OpenAI Memory FAQ: https://help.openai.com/en/articles/8590148-memory-faq
- Anthropic Claude memory announcement: https://claude.com/blog/memory
- Microsoft 365 Copilot privacy: https://learn.microsoft.com/en-us/microsoft-365/copilot/microsoft-365-copilot-privacy
- Azure secure multitenant RAG guide: https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/secure-multitenant-rag
- AWS multi-tenant RAG with Bedrock/OpenSearch: https://aws.amazon.com/blogs/machine-learning/multi-tenant-rag-implementation-with-amazon-bedrock-and-amazon-opensearch-service-for-saas-using-jwt/
- arXiv 2605.05287: https://arxiv.org/html/2605.05287v1
