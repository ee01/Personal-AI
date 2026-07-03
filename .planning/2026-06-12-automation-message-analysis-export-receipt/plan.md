# Message Analysis export receipt

## Target

Random feature: `记忆入口规则` / Message Analysis (`docs/features/message_analysis.md`).

## Context

- `docs/progressing/to-verify.md` says `暂无。`.
- Local Reminders lists are readable, but there is no `Personal AI` list, so no Reminder items are included.
- Current UI already has rule safety, delivery, effect-boundary, system-observation, and XML import receipts.
- Gap: XML export downloads the manual-rule file without a persistent receipt, so users cannot easily see what scope was exported or what did not happen.

## External signals

- Slack keyword workflows expose the channel and keyword conditions before the workflow runs.
- Zapier Filters and Paths treat conditions as explicit gates before later actions continue.
- Trigger-action programming research highlights user confusion around rule behavior and side effects.
- Attention-sensitive alerting research supports clear interruption and notification-cost boundaries.

## Plan

1. Add a reusable rule-transfer receipt shape for export counts, delivery paths, effect boundaries, automation, auto-reply, OpenClaw pending, and safety-review counts.
2. Show a persistent `导出规则回执` after XML export, separate from existing import receipt.
3. State that export includes only manual rules, excludes system observations, does not analyze history, does not sync Memory Service, and does not execute/write external actions.
4. Extend `tools/verify-message-analysis-rule-diagnostics-e2e.mjs` to assert export receipt copy before import replacement.
5. Update `docs/features/message_analysis.md` with the export receipt behavior.
6. Validate with targeted Message Analysis tests, `npm start` first compile, E2E, and `git diff --check`.
