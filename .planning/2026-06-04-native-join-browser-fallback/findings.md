# Native Join Browser Fallback Findings

## 2026-06-04 Initial Findings

- Randomly selected feature from `docs/features/index.md`: `NC 加会浏览器回退`.
- Feature owner/capability: Native Join.
- Source document: `docs/features/meeting_native_join.md`.
- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; there are no local Reminder items to incorporate or complete for this feature in this run.
- The worktree has many unrelated dirty files from prior work, but Native Join files currently have no diff.

## Code And UX Findings

- `docs/features/meeting_native_join.md` is current for the browser fallback behavior: native app first, trusted RingCentral Video host parsing, direct `/conf/on/:meetingId` browser fallback, copy link, close, default path switch, and Video Home coverage.
- Main shared implementation is `src/ringcentralNativeJoin.ts`.
- Entry points use the shared parser and fallback UI from Glip links, rich invite page context, and RingCentral Video Home.
- Existing E2E coverage in `tools/verify-ringcentral-native-join-e2e.mjs` checks fallback presence, direct browser URL, copy link, default browser/app toggle, active-page recovery, blocked popup same-tab fallback, and detail/list join interception.
- Unit coverage exists in `src/__tests__/ringcentralNativeJoin.test.ts`.
- UX gap: after the 5 second active-page timeout, only the status line changes to `Still on this page?`; the title still says `Opening RingCentral app...`, which is stale when the app likely did not take over.
- Robustness gap: when a second native handoff happens before the first fallback timers fire, the old host element is removed but its timers are not explicitly cleared. In practice the launch click has already happened, but the old cleanup can still update detached nodes or remove the shared temporary native launch link.

## External Reference Findings

- Microsoft Teams documents HTTPS deep links as the safer default because the browser choice page can open desktop, download it, or use web, while the direct `msteams://` protocol bypasses that choice and can fail for users without the desktop client.
- Zoom join docs show the same recovery pattern: users are prompted to open the app, but can cancel and use `Join from your browser`.
- RingCentral's own browser-join article emphasizes that browser joining removes download friction and supports common desktop browsers, which confirms that browser fallback is not an edge-only path.
- Android Developers' deep-link security guidance calls out hijacking and parameter-validation risks; this supports keeping strict RingCentral host and meeting-id allowlists rather than widening parsing.
- The USENIX Security 2017 deep-link paper measured scheme URL hijacking and weak real-world app-link verification, reinforcing the design choice to keep a visible browser recovery path and strict URL validation.

## Selected Plan

1. Keep the existing trusted-host/meeting-id parsing and direct browser `/conf/on/:meetingId` fallback.
2. Make the active-page recovery state update the title/body as well as the status line, so the panel no longer says it is still opening the app after likely failure.
3. Add a module-level cleanup handle for the active fallback so replacement panels clear old timers and temporary launch links before mounting the new handoff.
4. Extend unit and E2E assertions to cover the clearer recovery copy.
