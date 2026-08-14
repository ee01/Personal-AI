# Task Plan: Silent Message Analysis Project Rule Fix

## Goal
Make silent message analysis handle Focus Project watch rules without aborting, and preserve the original error when background analysis genuinely fails.

## Current Phase
Phase 1

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm whether the bug stops the remaining groups
- [x] Identify the primary and secondary failure paths
- [x] Record dirty-worktree and validation constraints
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define an exhaustive rule-source formatting approach
- [x] Define background-safe error propagation
- [x] Select targeted regression coverage
- **Status:** complete

### Phase 3: Implementation
- [x] Update `buildRuleText` for project rules
- [x] Make `analyzeMessages` background-safe and rethrow the original error
- [x] Add regression tests
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run the targeted regression tests
- [x] Run the relevant existing verifier
- [x] Run `npm start` through the first successful compile
- [x] Run a fresh-dist extension E2E smoke check
- [x] Run scoped whitespace checks
- **Status:** complete

### Phase 5: Delivery
- [x] Review the scoped diff and worktree ownership
- [x] Report behavior, evidence, and any remaining boundary
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Render both `outreach` and `project` system rules from their existing `text` plus stable `RULE_REF` | Neither rule owns `manualItem`; their builders already produce complete prompt text |
| Only recurse for `source === 'manual'` | Makes the discriminated union explicit and prevents future system-rule fallthrough |
| Rethrow after optional DOM toast | Scheduled/background callers must receive the original failure; swallowing it can be summarized as success |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| Minimal project-rule reproduction throws `Cannot use 'in' operator...` | Treat as the regression case to make pass |
