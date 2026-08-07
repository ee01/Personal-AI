# Findings

## Local State

- `docs/progressing/to-verify.md` is empty.
- AppleScript did not list `Personal AI`, but EventKit did. EventKit result: `Personal AI` has 4 total reminders and 0 incomplete reminders.
- `docs/features/assist.md` already documents that thumb-down hides the current suggestion, adjusts only the current surface threshold, and reports calibration write status.
- `src/composer-guard/ComposerGuardController.ts` already splits post-click receipt text into local hide, threshold save, Rehearsal feedback, and ambient calibration states.
- Current reject button attributes are generic: `title="减少这类建议"` and matching `aria-label`, which does not state the no-send/no-delete/no-global-silence boundary before click.

## External Scan

- Gmail Smart Compose exposes settings and feedback controls for suggestions, supporting low-friction feedback without making every suggestion a heavy review flow.
- Outlook suggested replies exposes a clear setting to turn suggested replies off, reinforcing that local feedback and global disabling should not be conflated.
- Smart Compose research emphasizes real-time, inline, low-latency writing assistance rather than modal review.
- Interaction-Required Suggestions research argues for control, ownership, and awareness in co-writing interfaces; the exact click consequence should be visible before the user commits.

## Improvement

Add dynamic reject button boundary copy based on the current surface and Rehearsal involvement:

- Clicking only hides the current suggestion.
- It makes the current surface more cautious.
- It attempts a redacted calibration signal.
- If Rehearsal-backed, background Rehearsal downranking depends on the later receipt.
- It does not send/submit drafts, delete source memories, or silence other input boxes.
