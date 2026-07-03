# Native Join Copy-Link Receipt Findings

## Local Context

- Target feature: `NC 加会浏览器回退` under Native Join.
- Source doc: `docs/features/meeting_native_join.md`.
- Main implementation: `src/ringcentralNativeJoin.ts`.
- Existing tests: `src/__tests__/ringcentralNativeJoin.test.ts` and `tools/verify-ringcentral-native-join-e2e.mjs`.
- Reminder list names returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No `Personal AI` Reminder list is visible on this machine.

## Code And UX Findings

- The Native Join doc is current for the existing fallback behavior: native handoff, active-page recovery, `Try app again`, `Copy ID`, hidden full-link details, direct `/conf/on/:meetingId` browser fallback, and reversible default path switching.
- Current code already preserves hidden query/hash details for `Join in browser` and `Copy link` while showing a passcode-stripped URL in the panel.
- UX gap: after successful `Copy link`, the status only says `Browser meeting link copied.`. Because the visible URL intentionally hides query/hash details, the user cannot tell whether the copied value was the full recovery link or the stripped display link.
- Low-decision fix: make copy success say it copied the full browser meeting link, including hidden passcode/details if present, and did not join/retry/change defaults.

## External Reference Findings

- RingCentral promotes browser join as a no-download path across common desktop browsers, which supports treating browser fallback as a first-class recovery path, not an error-only escape.
- Zoom's browser-join setting appears after users click a meeting link and is for users who prefer web or cannot install the app; this supports leaving browser recovery visible after an app handoff.
- Microsoft Teams exposes meeting ID and passcode entry as a join path, supporting a manual recovery path but also showing why ID-only copy should not imply complete entry credentials.
- USENIX deep-link research and Android deep-link guidance both emphasize hijacking/validation risk; Personal AI should keep strict host/meeting ID validation and explicit side-effect receipts.
