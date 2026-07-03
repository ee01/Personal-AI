# Native Join Findings

## Repo Context

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows recent sweeps covered Memory Capture, Decision Center, Jira Import, Memory Coverage, Jira Design Links, Relationship Radar, Memory Lens, Skill Foundry, Quick Ask, Project Dashboard, Rehearsal, Scheduled Messages, Meeting Pilot, and Compose Assist; Native Join is not in the freshest automation-memory target set.
- Reminders is reachable, but the visible list names do not include `Personal AI`, so there are no related Reminder items to complete.
- Native Join docs and code already include recent uncommitted work for handoff receipts, Safe Links unwrap, app retry, passcode-hidden display links, and copy-failure full-link reveal. This run should build on that instead of replacing it.

## External Research

- RingCentral states browser joining is important because downloads and last-minute app issues can block meeting access; browser support is positioned as a low-friction fallback.
- Zoom documents a "Join from your browser" path that appears after attempting app/download flow, reinforcing that browser fallback should remain available after an app-first attempt.
- Microsoft Teams supports joining with meeting ID and passcode from the app or a web page, so a manual Meeting ID recovery path is a known meeting-product pattern.
- Deep-link fallback references recommend alternative destinations when the app is absent or a direct deep link fails.
- Deep-link security references warn that custom schemes and deep-link parameters need strict validation; the Native Join code should keep host/path/meeting ID validation and avoid exposing sensitive query details by default.

## UX Judgment

The missing small recovery path is not another app retry. If the RingCentral app opens but does not consume the custom URL, the user may be staring at the native app and the browser fallback. A visible, copyable Meeting ID gives a manual app path while preserving the existing full-link/passcode privacy boundary.
