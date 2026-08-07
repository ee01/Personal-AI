# Findings

## Repo Findings

- `docs/progressing/to-verify.md` 为空。
- 随机抽中 `主动询问 | Memory Service | docs/memory_system.md`。
- `docs/memory_system.md` 已详细记录 Outreach 列表失败、发送前复核、详情/列表操作回执、只读控件边界等近期待办。
- `src/modals/components/OutreachSessions.vue` 列表页已经把会话列表加载失败显示成 alert，并在有旧快照时继续展示上次成功数据。
- `src/modals/components/OutreachSessionDetail.vue` 当前 `loadDetail()` catch 后直接 `detail.value = null`，模板只显示 `未找到该会话。`。这会把 Memory Service 503、网络失败或目录状态失败误报为会话不存在。
- `tools/verify-outreach-sessions-e2e.mjs` 已覆盖列表加载失败、列表重试、筛选空结果、列表/详情审批、编辑草稿、目标检索和操作回执，但未覆盖详情读取失败。

## Reminder Findings

- EventKit: `Personal AI` Reminders total 4, incomplete 0。
- 未完成相关条目：无。

## External Scan

- Microsoft Copilot Studio Request for information: human review action pauses execution, collects reviewer input, and resumes subsequent flow; this supports making paused/error/retry state explicit instead of silently falling through.
- OpenAI Agents SDK HITL: sensitive tool calls surface interruptions and resume from stored run state after approval/rejection; this supports preserving a clear pending/error boundary around external side effects.
- Slack Workflow Builder custom steps: steps should call `complete` or `fail`; otherwise they remain in progress. This maps to Outreach UI needing explicit failure and recovery when a detail read fails.
- SIGIR 2024 proactive conversational agents perspective warns proactive agents can feel intrusive without thoughtful human-centered design; Outreach should avoid ambiguous states before contacting people.

## Sources

- https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-request-for-information
- https://openai.github.io/openai-agents-python/human_in_the_loop/
- https://docs.slack.dev/tools/bolt-js/tutorials/custom-steps-workflow-builder-new/
- https://arxiv.org/abs/2404.12670
