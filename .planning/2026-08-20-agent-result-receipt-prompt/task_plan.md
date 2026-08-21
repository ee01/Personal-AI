# Task Plan: Agent Result Receipt System Prompt

## Goal
User Agent Task prompts stay as natural-language work instructions. Result format (JSON envelope + verifiable artifacts) is owned by a shared system prompt and a tolerant parser, then deployed to memory-service.

## Current Phase
Phase 5: Delivery

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm user intent: no format instructions in user prompt
- [x] Trace Gateway extraSystemPrompt + parseEnvelope failure on incidental JSON
- [x] Document findings
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Shared bilingual receipt contract prompt
- [x] Infer source-system hints from task text
- [x] Parser: envelope detection + markdown receipt recovery
- **Status:** complete

### Phase 3: Implementation
- [x] Add `agentResultPrompt.ts` + `agentResultEnvelope.ts`
- [x] Wire Gateway / ACP / DelegationService / worker prompt
- [x] Tests + docs
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Targeted memory-service tests
- [x] Deploy memory-service and smoke-check
- **Status:** complete

### Phase 5: Delivery
- [x] Explain design and deploy result in Chinese
- **Status:** complete

## Key Questions
1. Should markdown without JSON still count as success? Yes, when entity keys + verification language are present. Vague "做好了" stays error.
2. Is artifact JSON still self-reported? Yes — recovery matches that trust model; it does not independently re-query Jira.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| System prompt owns format; user Task is work-only | User should not write JSON schema into Sheet/Jira prompts |
| Chinese-first bilingual prompt | Real OpenClaw agents answer in Chinese and ignored English schema jargon |
| Ignore JSON objects that lack `status` | `{"value":"Yes"}` was misread as the envelope |
| Recover markdown receipts conservatively | Fixes "business succeeded, ledger failed" without accepting empty boasts |
| `agent_task` is not a sourceSystem | Infer jira/sheets/web from the task text |
| Do not recover from an incomplete JSON envelope | Incomplete JSON success still fails; markdown recovery only when there is no envelope |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| JSON success with only issueKey recovered as success | 1 | Stop markdown recovery once a real envelope exists |
| Truncated fenced JSON no longer repaired | 1 | Port JSON repair into extractAgentResultJson |
