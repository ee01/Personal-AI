# AR Data Repeat Detach Boundary Findings

## Repo Findings

- `docs/progressing/to-verify.md` is empty.
- EventKit found `Personal AI` Reminders: 4 total, all completed. The completed items are Doubao/notification/test feedback and unrelated to AR Data.
- Current AR editor saves `linkedAgentTaskId = undefined` when an existing linked binding has `重复执行` unchecked, but it does not update or pause the existing Scheduled Messages/AgentTask row.
- `UPSERT_AGENT_TASK_FROM_AR_BINDING` already updates or creates the scheduled row when repeat is checked.
- `ScheduledMessageService.updateMessage()` supports partial updates and `Status: 'Paused'`, so a narrow detach message can pause the existing AgentTask row and clear `Agent_AR_Binding_ID`.

## External Scan

- Google Chrome AI positions browser AI as always available in the tab while emphasizing user control over access/history and task automation boundaries.
- Web augmentation research defines browser-side augmentation as client-side UI modification and calls out fragility when third-party pages change.
- Data-service-layer web augmentation research frames these systems as adding content/functionality not originally provided by the site, often from multiple data sources.
- ORIGINTRACER/provenance research shows users benefit from visible labels for extension-injected page modifications.
- Human-centered AI research argues automation level should preserve human control; for AR Data, repeat execution should not be silently changed.

## Chosen Improvement

Add an explicit repeat-boundary receipt in the AR editor. When an existing binding has a linked AgentTask and the user unchecks repeat, saving should pause the existing AgentTask row and clear its AR binding id before the local binding is saved as non-repeating.
