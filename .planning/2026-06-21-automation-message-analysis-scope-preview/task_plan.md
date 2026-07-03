# Message Analysis Scope Preview Plan

## Goal
Improve the Message Analysis `规则范围校验` UX so users can see how sender/group/time/context gates are applied before a manual rule is saved or edited.

## Current Phase
Phase 5

## Phases

### Phase 1: Discovery
- [x] Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, feature index, target doc, and target code.
- [x] Check Reminders `Personal AI` list availability.
- [x] Inspect existing Message Analysis verify and E2E harnesses.
- **Status:** complete

### Phase 2: Research And Plan
- [x] Scan comparable product and research patterns for scoped message triggers and trigger-action debugging.
- [x] Decide a bounded implementation that does not need user decisions.
- **Status:** complete

### Phase 3: Implementation
- [x] Add a reusable manual-rule scope execution receipt.
- [x] Render it in new/edit rule forms and existing rule cards.
- [x] Update tests and feature docs.
- **Status:** complete

### Phase 4: Verification
- [x] Run targeted Message Analysis/runtime tests.
- [x] Run `npm start` until first successful compile, then stop it.
- [x] Run Message Analysis E2E.
- [x] Run scoped `git diff --check`.
- **Status:** complete

### Phase 5: Closeout
- [ ] Update automation memory.
- [ ] Attempt thread archive.
- [ ] Report concise evidence.
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Add a visible scope execution receipt rather than changing `watchRules` matching | Runtime matching already has deterministic candidate filtering and final resolution; the user-facing gap is pre-save interpretability. |
| Keep the receipt in `topic-rule-safety.ts` | Existing rule-safety receipts already live there and have focused tests. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `node` missing on default PATH | 1 | Use `$HOME/.nvm/versions/node/v24.13.0/bin` for repo scripts. |

## Notes
- Reminders returned `NO_PERSONAL_AI_LIST`; no Reminder completion is possible this run.
