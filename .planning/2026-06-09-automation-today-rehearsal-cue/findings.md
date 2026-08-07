# Findings: Today Rehearsal Cue

## Requirements

- Pick one random feature from `docs/index.md`.
- Confirm the feature doc matches current code and update it if behavior changes.
- Research adjacent product and paper guidance.
- Check local Reminders for relevant `Personal AI` items; mark completed items done only if the list exists and items are actually incorporated.
- Plan first, implement step by step, and verify as deeply as practical under `AGENT.md`.

## Initial Context

- Carry-over `docs/progressing/to-verify.md`: `暂无。`
- Local Reminders lists: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible `Personal AI` Reminders list, so no Reminder items are available to incorporate or complete.
- Selected feature: `今日预演提示`.
- Capability: Today Pilot.
- Canonical doc: `docs/features/rehearsal.md`; adjacent Today Pilot doc: `docs/features/today_pilot.md`.
- Worktree is broadly dirty before this run; preserve unrelated changes.

## Research Findings

- Apple Reminders supports time/location/message-person triggers, which reinforces that a Rehearsal cue should name the triggering person/place/time/context rather than just saying "relevant today".
- Slack Later keeps saved/reminder items in one place, lets users jump back to the original conversation, and separates in-progress/archived/completed states. Today Rehearsal cards should preserve the deep link and the current lifecycle state.
- Microsoft To Do flagged email keeps the original email preview and "Open in Outlook" path, plus due dates/reminders/My Day. This supports preserving source preview and a recovery path on Today Pilot cards.
- Microsoft Teams Copilot meeting support exposes prerequisites and source scope (transcription/chat availability). Today Rehearsal cues should be explicit that they are prep context, not meeting execution or guaranteed live capture.
- Prospective-memory and implementation-intention research supports strong cue-action binding: the useful card should show "what cue matched" and "what script to rehearse/use".
- The 2026 context-aware reminders paper emphasizes translating natural language reminder intent into structured time/activity/state conditions; Today Pilot should surface a compact structured trigger receipt when it promotes a Rehearsal.

## Code Findings

- `memory-service/src/core/DayPilotService.ts` scans active/stale/candidate Rehearsals into `rehearsal_prompt` candidates.
- Current Rehearsal candidate evidence preserves `exploreLink`, title, snippet, timestamp, and stale open question, but it does not include a compact cue receipt naming why the row belongs in today's board.
- Today Pilot UI already renders `为什么出现`, `待确认`, tags, evidence, and detail navigation; the improvement can reuse these instead of adding a new major surface.

## Resources

- `AGENT.md`
- `docs/index.md`
- `docs/features/rehearsal.md`
- `docs/features/today_pilot.md`
