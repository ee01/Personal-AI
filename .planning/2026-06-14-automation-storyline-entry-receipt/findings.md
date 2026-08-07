# Storyline Entry Receipt Findings

## Initial Context

- Random sample from `docs/index.md` included `Storyline 会前提示`; this was selected as the first valid, non-fresh duplicate feature family.
- `docs/progressing/to-verify.md` is clear: `暂无。`.
- Automation memory's freshest runs covered Google Slides, Agent Thinking approval retry, memory `/events` identity, Scheduled Messages target filtering, Meeting Pilot ASR, and Doubao revoke scope. This run should avoid those exact surfaces.
- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; no Reminder-driven idea or completion is available for this run.
- Existing dirty worktree is very broad. Treat pre-existing modifications as user/automation-owned and avoid reverting them.

## Code And UX Findings

- `docs/features/today_pilot.md` and `docs/features/memory_storyline_builder.md` already describe the intended Storyline prompt: generated from meeting prep LLM output, shown between meeting summary and cue cards, dismissed for 30 days per prep/source/event, and explicitly not a writeback or auto-generation action.
- Both docs now promise a `Storyline 入口回执` with output format, material cluster count, evidence count, source types, audience/length, and Draft API / evidence-review boundary.
- `src/contentScriptRingCentralVideoHome.ts` already renders a Storyline strip and `Storyline 入口回执`; `tools/verify-storyline-video-home-e2e.mjs` asserts the strip, lazy Draft API boundary, source kinds, target artifact, evidence count, and dismiss behavior.
- UX gap: the receipt currently displays the LLM cluster evidence total as `证据 N 条`. If the model's cluster total differs from the actual `prep.evidenceRefs.length`, the UI can overstate or understate the available auditable refs. Source labels also come only from cluster `sourceKinds`, even though actual refs have `sourceLabel`.
- Low-decision fix: show both `素材估计 N 条` and `实际 refs M 条` when they differ, keep `证据 N 条` only when they match, add a boundary sentence saying mismatches are reviewed on the Draft page, and fall back to evidence-ref source labels if cluster source kinds are absent.

## External Reference Findings

- Microsoft Teams Copilot meeting support says Copilot meeting answers depend on meeting chat/transcript availability, organizer policy, sensitivity labels, and export restrictions. This supports keeping Storyline generation lazy and source-boundary aware before opening the Draft page: https://support.microsoft.com/en-us/teams/copilot/catch-up-on-meetings-with-microsoft-365-copilot-in-teams
- Zoom AI Companion meeting docs separate live summaries, in-meeting questions, smart recording chapters/highlights, and shareability. This supports labeling whether Storyline is only an entry prompt versus an actual generated/exported artifact: https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0057623
- Google Meet `Take notes for me` docs emphasize explicit start/configuration, recipients, language, note sections, review/edit, and organizer/admin sharing settings. This supports visible audience/output/share boundaries: https://support.google.com/meet/answer/14754931
- RAG survey and source-attribution work both reinforce that generated outputs need verifiable citation/source attribution, but attribution can be approximate or costly; the UI should distinguish model-estimated material from auditable evidence refs instead of flattening both into one count: https://arxiv.org/html/2507.18910v1 and https://arxiv.org/abs/2507.04480
