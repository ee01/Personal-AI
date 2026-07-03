# Message Analysis System Observation Empty Receipt Findings

## Repo Findings

- `docs/progressing/to-verify.md` currently says `暂无。`, so there is no carry-over validation task to continue.
- The selected feature is `系统观察规则` in `docs/features/message_analysis.md`.
- Current UI already loads Outreach runtime status, shows active internal observations, samples, scope labels, freshness labels, and side-effect boundaries.
- Current empty state only shows the status pill `当前没有运行中的内部观察`; it does not give the same source/scope/no-side-effect clarity as the active state.
- Low-risk improvement: when runtime status succeeds with zero internal observations, show a receipt that says the runtime status was checked, only manual rules are editable here, and no hidden system rule has been written, exported, imported, notified, replied, or delegated.

## Reminder Findings

- Local Reminders lists are readable: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No `Personal AI` list is present, so there are no Reminder feedback items for this run and nothing to mark done.

## External Reference Findings

- Slack's keyword workflow docs model automation as explicit message trigger + keyword conditions + selected channels. The useful product direction is to show whether an observation gate exists and where it applies.
- Zapier's filter/path docs describe conditional steps as gates for later actions, supporting an explicit "no gate is currently running" receipt rather than silent absence.
- Trigger-action debugging research argues end users need visible debugging and explanation for rule conditions and outcomes, especially when rules do not fire.
- Attention-sensitive alerting research emphasizes the cost of unnecessary interruptions, supporting copy that states the empty observation state did not create notifications, replies, or linked actions.
