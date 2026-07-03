# Findings & Decisions

## Requirements
- Randomly select one feature from `docs/features/index.md`.
- Ensure the feature doc matches current behavior without excessive implementation detail.
- Search current product/research context for similar capabilities.
- Implement low-decision unfinished or defective parts.
- Check UX, bugs, and blocking flows.
- Check local Reminders `Personal AI` list and complete related done items when applicable.
- Validate according to `AGENT.md`.

## Selected Feature
- Random target: `工作/个人/全部范围语义`
- Capability: Memory Service
- Canonical doc: `docs/features/memory_system.md`

## Local Reminder Finding
- Reminders was readable.
- Visible lists: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible `Personal AI` list, so no Reminder item was incorporated or marked done.

## Product And Research Findings
- Memory scope UX should keep source and boundary receipts explicit: current memory products expose memory controls and source/context boundaries instead of silently mixing sources.
- Personal information management research supports that personal information needs are role and context dependent; work/personal/all search must show what was included and excluded.
- The implementation should not change the default active recall scope; it should align returned evidence with existing filtering semantics.

## Code Findings
- `RecallEngine.matchesScope()` normalizes missing stored scope to `work`.
- Message candidates built from `messages_raw` only include `metadata.scope` when `msg.scope` is present.
- Final `RecallItem.scope` is currently derived from `c.metadata?.scope`.
- Therefore a legacy message with missing `scope` can pass a default `work` recall but be returned/count as unknown, making `scopeReceipt` and search UI less honest than the actual filter semantics.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Normalize missing message scopes to `work` inside message metadata | This matches the existing filtering semantics and prevents UI/receipt drift. |
| Add regression at API and search presentation layers | API proves server receipt; presentation proves UI scope breakdown no longer shows `未标明` for effective work results. |
| Keep docs concise | Feature doc should describe the user-facing boundary, not every implementation detail. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Massive dirty worktree | Limit edits to target files and new `.planning` directory. |
