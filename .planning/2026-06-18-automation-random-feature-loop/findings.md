# Findings

## Initial context

- `AGENT.md` requires the random feature loop to read carry-over state, check Reminders, keep docs current, run targeted validation plus `npm start` first successful compile, and use E2E where practical.
- Automation memory shows the freshest completed targets include Memory Lens, Scheduled Messages, Storyline, Doubao Bridge, Message Reaction, Agent Thinking, Message Analysis, Coverage Map, User Profile, Memory Service identity/action surfaces, Project Dashboard, Ask, Google Slides Analyzer, Prompt Config, Skill Foundry, and Meeting Pilot.
- `docs/progressing/to-verify.md` contains `暂无。`, so this run should select a fresh feature from the index.

## Target feature: Native Join

- Randomly selected `NC 加会` / Native Join from `docs/index.md`.
- The current doc is mostly up to date with code: it already covers Safe Links unwrap, browser fallback, passcode-hidden display, copy failure recovery, app retry, default-path toggle, and Video Home DOM/IndexedDB matching.
- The target files were already dirty before this run; existing uncommitted work includes Native Join handoff receipts, full-link reveal, redirect unwrap tests, and E2E coverage.
- Reminders list names were readable: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`. There is no `Personal AI` list.

## External context

- RingCentral's own product messaging emphasizes that meetings should remain joinable directly from modern browsers with no app download; this supports keeping browser fallback first-class.
- Zoom's join flow explicitly separates app launch prompts from `Join from your browser`, and documents the browser prompt / cancel / fallback path.
- Microsoft Teams exposes a clear choice between continuing in the browser and joining in the Teams app for guest joins.
- USENIX Security 2017 deep-link research shows custom scheme and app-link flows can have hijacking / verification weaknesses, supporting strict host validation and explicit copy about full-link handoff boundaries.

## UX gap

- Initial Native Join handoff text says what to do if the app prompt was cancelled, but not what to do while Chrome is asking to open the app.
- The panel says displayed link details are hidden and recovery actions keep the full meeting link, but it does not explicitly say the native app handoff itself also uses the validated full meeting link. A user could misread the redacted display as redacted handoff.
