# Native Join Fallback Privacy Findings

## Repo Context

- `docs/progressing/to-verify.md` currently says `暂无。`, so there is no carry-over verification task to continue.
- Local Reminders is accessible, but the list names are `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, and `Tasks`; there is no `Personal AI` list to incorporate or mark done.
- The existing Native Join implementation already validates RingCentral Video host, upgrades browser fallback to HTTPS, normalizes `/join` and `/launcher` to `/conf/on`, preserves browser fallback, and keeps the fallback visible when the page remains active after a failed handoff.

## External Product / Research Notes

- RingCentral positions browser join as a no-download path for guests and users who do not want another meeting app.
- Zoom exposes an "Always Join from Browser" option for users who cannot or do not want to launch the desktop client.
- Microsoft Teams documentation keeps app launch, guest join, meeting ID/passcode, and web join paths as separate recovery routes.
- RFC 8252 and deep-link security discussions reinforce that custom scheme handoff is not a proof of successful app takeover; products should keep validated HTTPS recovery paths visible and avoid over-trusting scheme launches.

## UX Finding

The fallback panel currently displays the full direct browser meeting URL, including query parameters such as `?passcode=abc`. That is useful for recovery, but it can expose meeting secrets during screenshare or in a shared workspace. The safer behavior is:

- visible by default: trusted host and meeting route without query/hash details;
- explicit receipt: passcode/search/hash details are hidden on the panel but preserved in Join/Copy actions;
- explicit reveal: user can reveal the full link if manual copy/inspection is required.

## Candidate Implementation

- Add a small helper to build a query/hash-stripped display URL from a validated `RingCentralVideoJoinTarget`.
- Add a helper to state whether hidden link details exist.
- Add a `Show full link` / `Hide full link` button in the fallback panel only when the full browser URL differs from the default display URL.
- Update unit and E2E assertions so `Join in browser` and `Copy link` still use the full URL, while the default visible text hides `passcode`.
