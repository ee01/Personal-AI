# Findings

## Repo Context

- `docs/progressing/to-verify.md` says `暂无`.
- Automation memory shows the freshest exact surfaces were Relationship Radar Meeting Brief, Message Analysis scope gate, Memory Coverage import truth boundary, Outreach filters, Agent Workflow saved sample capacity, Today noise/source distribution, and similar; Native Join was last touched on 2026-07-05 for browser-request restore wording.
- EventKit found the local `Personal AI` Reminders list with 4 total reminders and 0 incomplete reminders. No Reminder item applies to Native Join.
- Native Join already has strong boundaries for app handoff, browser request, hidden full link, Meeting ID/passcode copy, close/restore, and source-aware browser-request restore.

## External Research

- RingCentral official docs show meetings can be joined from desktop, web, and mobile surfaces; browser join is a legitimate fallback path.
- Zoom documents a configurable `Join from your browser` fallback and Zoom Web App flow where users cancel the app prompt and continue in browser.
- Microsoft Teams documents `Continue on this browser`, app join, and Meeting ID + passcode manual fallback.
- USENIX Security 2017 deep-link research and Android deep-link security guidance reinforce that custom scheme handoff is not a confirmed outcome and should keep source validation plus recovery controls visible.

## UX Issue

The current Native Join fallback already says default preference changes affect future joins, but the feedback is embedded in the general handoff receipt/status. Because the same panel also controls the current meeting handoff, browser join, retry, copy link, Meeting ID, and passcode, the default-path write would benefit from its own visible receipt that binds:

- what was saved: app-first or browser-first
- scope: future RingCentral joins only
- current meeting: existing recovery controls remain; no join/retry/browser window/copy happened because of the preference write
- failure: preference unchanged and same non-effects

## Intended Change

Add a compact `Default path receipt` block near the default preference control. It should be hidden until the user attempts a default-path save, then update on saving app/browser default or save failure. This keeps future preference changes auditable without changing the selected meeting behavior.
