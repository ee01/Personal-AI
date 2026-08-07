# Compose Assist Direct Insert Findings

## Initial Context

- Randomly selected feature from `docs/index.md`: `回复助手直接插入`.
- Feature owner/capability: Compose Assist.
- Source document: `docs/features/assist.md`.
- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; there are no local Reminder items to incorporate or complete for this feature in this run.
- The worktree has broad unrelated dirty files from prior work. Treat pre-existing changes as user/automation-owned and avoid reverting them.

## Code And UX Findings

- `docs/features/assist.md` is current for the selected direct-insert path and already documents hover preview, insert-only semantics, undo, write-failure receipts, source-route receipts, review gating, and high-risk evidence redaction.
- Current code path: `ComposerGuardController` renders the icon/popover, gates high-risk/Rehearsal suggestions through `reviewMode`, inserts via `insertTextIntoComposer(...)`, and shows undo/failure receipts.
- Existing direct-insert E2E coverage lives in `tools/verify-compose-assist-direct-insert-e2e.mjs`; focused policy/unit coverage lives in `src/composer-guard/__tests__/ComposerGuardController.test.ts` and `siteContextAdapters.test.ts`.
- UX gap: the review state's `取消` button and Escape key currently dismiss the whole suggestion context. That makes an accidental review-open indistinguishable from rejecting or suppressing the suggestion, even though thumb-down is the explicit “hide and learn” control.
- Low-decision implementation slice: make review cancel/Escape collapse back to the lightweight preview without writing, sending, submitting, or recording rejected feedback.

## External Reference Findings

- Gmail / Google Chat Smart Compose keep suggestions lightweight and explicitly accepted, commonly with Tab, rather than treating preview as send.
- Outlook suggested replies inserts a reply candidate but still lets the user edit before selecting Send.
- RingCentral AI Writer and Atlassian Intelligence draft replies keep AI writing inside the native draft/reply surface rather than sending directly.
- Grammarly exposes dismiss/turn-off paths for unhelpful suggestions, supporting a distinction between “close this view” and “learn this is unhelpful.”
- Smart Compose and Interaction-Required Suggestions research both support low-friction acceptance plus human agency/fine-grained control; this argues for a reversible review back-out instead of silently suppressing the suggestion.
