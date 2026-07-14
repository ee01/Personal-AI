# AR Data visual overlay result plan

Run time: 2026-07-05T10:04:03+0800

## Selected feature

- `AR 数据网页叠加` / Personal AI AR Data, from `docs/features/index.md`.
- Reminder check: EventKit found the local `Personal AI` list with 4 completed historical Doubao / Notification items. No open or AR-related Reminder item is included in this run.

## Current state

- `docs/features/ar_data_overlay.md` says media or unstable elements use visual overlay.
- `src/contentScriptWebIntelligence.ts` applies `lastResult.text` to stable text DOM, but for `displayMode === "visual_overlay"` it currently only renders the Personal AI badge. The actual AR value is not visible on images, canvas, video, or svg targets.
- This makes the feature look saved while failing its core user promise on non-text targets.

## External scan

- Arc Boosts treats page customization as a user-controlled, editable, disableable layer.
- PageGuide argues for grounding web-agent results directly in page DOM via visual overlays so users can verify where an answer applies.
- Web Augmentation research calls out DOM locator fragility and the need for maintainable, user-repairable augmentations when third-party pages change.
- UCL / UC Davis privacy findings around AI browser assistants reinforce keeping local page overlays explicit and not implying background data sharing beyond the user-triggered action.

## Implementation scope

1. Add a real visual result panel for `visual_overlay` bindings.
   - It should show `lastResult.text`.
   - It should be anchored to the target element, reposition with scroll/resize, and remain visibly Personal AI-branded.
   - It should not mutate media/canvas/svg content.
2. Keep existing DOM text replacement, refresh, remove, and ON/OFF behavior unchanged.
3. Update the AR Data doc with the actual overlay behavior and boundary.
4. Add a focused extension E2E verifier that seeds one text binding and one image/canvas-style visual binding, then checks:
   - DOM text replacement still works.
   - visual overlay text is visible.
   - OFF removes both DOM replacement and visual overlay for the current page session.

## Validation target

- `node --check tools/verify-ar-data-overlay-e2e.mjs`
- `npm start -- --progress` until first successful compile, then stop it.
- `node tools/verify-ar-data-overlay-e2e.mjs`
- scoped `git diff --check`
