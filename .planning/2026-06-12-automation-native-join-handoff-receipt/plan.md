# Native Join Handoff Receipt

## Target

- Feature: `NC 加会浏览器回退`
- Source doc: `docs/features/meeting_native_join.md`
- Scope: RingCentral Native Join fallback popup only.

## Context

- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders are readable, but there is no `Personal AI` list, so no feedback item is available for this pass.
- External references from RingCentral, Zoom, and Teams all keep a browser join path available when desktop-app handoff is optional or unreliable. Deep-link security references reinforce that browser recovery and trusted-host boundaries should stay visible.

## Gap

The fallback popup already offers `Join in browser`, `Copy link`, hidden passcode display, and a reversible default toggle. The remaining UX gap is that the user must infer the handoff contract from scattered labels: whether the app launch was only attempted, whether Personal AI can verify native app success, whether browser recovery preserves the full link, and whether the default changed.

## Plan

1. Add a compact, persistent `Handoff receipt` block to the fallback popup.
2. Keep the receipt explicit about:
   - native app attempt started from this click;
   - app takeover cannot be verified from the web page;
   - browser fallback remains available;
   - the visible URL hides passcode/details while recovery actions preserve the full link;
   - default join preference changes only when the user clicks the default toggle.
3. Update the handoff recovery state so the receipt changes from "attempt started" to "no takeover detected in this tab".
4. Extend the existing unit/E2E checks instead of adding a new harness.
5. Update `docs/features/meeting_native_join.md`.
6. Verify with the Native Join unit test, `npm start` first compile, Native Join E2E, and `git diff --check`.
