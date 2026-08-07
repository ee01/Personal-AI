# Findings

## Repo State

- `docs/progressing/to-verify.md` 为“暂无”，本轮可以从 `docs/index.md` 随机选择已上线功能。
- 自动化记忆显示最近覆盖过 User Profile、Meeting History、Evidence Watch、Google Slides、Message Reaction、Scheduled Messages 等，本轮避开这些新鲜目标。
- Worktree 已有大量未提交变更；本轮只在 Agent Workflow 保存样例删除回执这条 UX 边界上增量修改。

## Reminder

- AppleScript 未列出 `Personal AI`。
- EventKit 只读 fallback 找到 `Personal AI` 列表，total=4，incomplete=0。
- 没有可纳入本轮 Agent Workflow 的未完成 Reminder item，因此不标记 Reminder done。

## Product / Paper Scan

- Zapier Agents 把 testing/draft 和 publish 后真实 trigger 分开，说明本地测试状态不能暗示真实自动化已生效。
- LangSmith complex-agent eval 把 final response、trajectory、single step 分开，支持把本地回归样例视为可携带证据而非真实运行结果。
- OpenTelemetry GenAI 语义约定把 agent/workflow/tool/data-source 分开，并多次警告输入、输出、工具参数可能包含敏感信息，支持删除回执不复制原始上下文。
- `Testing Agentic Workflows with Structural Coverage Criteria` 指出结构覆盖只能证明声明路径被 exercised，不能替代语义或端到端评估；保存样例删除应说明它只影响本地覆盖集。

## UX Gap

删除保存样例前后都缺少可见边界。用户可能误以为删除会移除 Memory Service 记忆、真实消息、已导出的报告、通知或自动化状态。实际实现只改写 `chrome.storage.local.agentWorkflowSavedScenarios`，因此需要同场回执。
