# Action Queue 处理构成回执

## 目标

随机抽中 `docs/index.md` 里的 `动作队列`。当前 Action Queue 已经有健康摘要、执行范围、审批、OpenClaw 预检、刷新失败旧快照和操作提交中回执，但顶部 `需要处理` 只给总数，用户仍要扫每张卡片才能判断优先处理哪类阻塞。

## Reminder 检查

- AppleScript 只列出普通 Reminders list，没有 `Personal AI`。
- EventKit fallback 能看到 `Personal AI`，共 4 条，全部已完成。
- 这些条目是历史 Doubao / Weekly Dream Digest / 同步反馈，不属于 Action Queue，本轮不标记新的 Reminder。

## 外部参考

- OpenAI Agents SDK HITL 和 LangGraph HITL 都把敏感 tool call 暂停为 pending approval，并强调 approve / reject / edit 后再 resume。
- Zapier Agents 的 activity 和 approval 资料强调按运行状态、使用的 app、时间和细节审计，并按风险决定人工 review。
- Microsoft Human-AI Interaction Guidelines 和近期 agent oversight 讨论强调可见状态、可恢复错误、用户控制和不过载解释。

## 实现计划

1. 在 Action Queue 顶部新增只读 `处理构成` 回执。
2. 将 `需要处理` 拆成互斥类别：失败/死信、已到期自动动作、待人工确认、高风险已可执行。
3. 如果列表是刷新失败后保留的旧快照，回执明确说明这是上次成功读取的构成。
4. 更新 Action Queue E2E 断言和 `docs/memory_system.md`。

## 非目标

- 不改 Memory Service 的 `proposed_actions` 状态机。
- 不改 `GET /actions` / execute / retry / cancel 接口。
- 不自动执行、批准、重试或取消任何动作。

## 验证

- `node --check tools/verify-action-queue-e2e.mjs`
- `npm start -- --progress`，等待首次成功编译后停止
- `npm run verify:action-queue:e2e`
- scoped `git diff --check`
