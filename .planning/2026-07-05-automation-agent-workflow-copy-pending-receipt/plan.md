# Agent Workflow 证据包复制提交中回执

## 目标

- 随机选中功能：`Agent Workflow 运行诊断`。
- 具体改进：单次运行证据包复制时先显示提交中回执，并锁住复制按钮，避免用户在剪贴板写入完成前误以为已经复制成功或触发了真实写入。

## 调研结论

- OpenAI Agents SDK tracing、OpenTelemetry GenAI 语义约定、LangSmith evaluation 和 agentic workflow 结构覆盖论文都强调 trace/eval 证据需要可观察、可比较、可复跑，并且要把工具调用、失败状态和副作用边界分清。
- 当前 Agent Workflow 已经有证据包、结构覆盖和失败回执；缺口是剪贴板写入等待期间没有显式状态。

## 实施步骤

1. 在 `src/options.tsx` 为证据包复制增加 `pending` 回执状态。
2. pending 期间显示 `证据包复制中`，说明尚未确认剪贴板写入成功，并禁用复制按钮。
3. 成功/失败后用最终回执替换 pending，保留无 Memory Service 写入、无通知、无规则自动化、无基线覆盖边界。
4. 更新 `tools/verify-agent-workflow-options-e2e.mjs`，用延迟 clipboard mock 断言 pending 回执和按钮锁定。
5. 更新 `docs/features/message_analysis.md` 和 `docs/index.md` 的当前行为描述。

## 验证计划

- `node --check tools/verify-agent-workflow-options-e2e.mjs`
- `npm run verify:agent-workflow`
- `npm start -- --progress` 等首次成功编译后停止
- `node tools/verify-agent-workflow-options-e2e.mjs`
- `git diff --check` scoped 到本轮文件
