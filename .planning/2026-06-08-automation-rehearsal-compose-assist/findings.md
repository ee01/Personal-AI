# Rehearsal Compose Assist Findings

## 2026-06-08 Initial Context

- Randomly selected feature from `docs/features/index.md`: `回复助手预演提醒`.
- Feature owner/capability: Compose Assist using Rehearsal evidence.
- Source document: `docs/features/rehearsal.md`.
- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; no Reminder feedback can be incorporated or marked done in this run.
- The worktree has many unrelated dirty files from prior work. Treat pre-existing changes as user/automation-owned and avoid reverting them.

## Code And UX Findings

- `docs/features/rehearsal.md` and `docs/features/compose_assist.md` already describe the important contract: Rehearsal evidence must be treated as a future-scene cue, previewed before insert, and fed back as `accepted` / `irrelevant`.
- `src/composer-guard/ComposerGuardController.ts` already forces Rehearsal evidence through preview even when the backend omits `previewRequired`, and the review evidence line exposes `metadata.rehearsal.content` / summary.
- `getStructuredEvidenceFeedbackTargets()` and `submitStructuredEvidenceFeedback()` already route Rehearsal evidence through `CONTEXT_RECALL_FEEDBACK` with `rehearsalActivationId`.
- UX gap: `showFeedbackReceipt()` always says only that the current input surface will be more conservative. When the rejected evidence is Rehearsal, users cannot tell that this specific future-scene cue is being marked irrelevant / downgraded for similar scenes.
- Low-decision implementation slice: derive whether the rejected assist contains Rehearsal feedback targets and render a Rehearsal-specific receipt after thumb-down.

## External Reference Findings

- Gmail Smart Compose keeps suggestions lightweight, account-scoped, user-accepted, and feedback-capable; it also warns suggestions may not always be factually correct.
- Outlook suggested replies keep suggestions editable before send, provide feedback paths, and let users disable the feature.
- Apple Reminders supports messaging-person cues, which reinforces Rehearsal's person/conversation cue model, but Rehearsal must additionally expose the action script to avoid being just a task reminder.
- Microsoft Research digital-reminder work emphasizes reminders that retrieve information for future social interactions, supporting scene-specific Rehearsal cues inside Compose Assist.
- Implementation-intention and context-aware-reminder papers support the cue-action binding model: the useful UI state is not only "a source matched" but "this future cue and this action script are being accepted or downgraded."
