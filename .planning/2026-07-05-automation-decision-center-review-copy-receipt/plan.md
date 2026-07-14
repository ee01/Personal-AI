# 决策中心审核包复制回执改进计划

## 选题

- 随机功能点：`决策中心` / Confirm Requests
- Source of truth：`docs/features/memory_system.md`
- 主要代码：`src/modals/components/DecisionCenter.vue`
- 验证入口：`npm run verify:decision-center:e2e`

## 本轮判断

当前决策中心已经把回答、稍后、恢复、结束追踪、待观察查证的操作边界讲清楚，也有提交中回执和操作结果回执。剩余的窄 UX 缺口在 `复制审核包`：用户点击后只看到 `已复制审核包`，但不知道复制包包含多少证据、是否包含界面上折叠的证据、以及复制动作是否已经提交答案或触发执行。

外部扫描结论：

- OpenAI Agents SDK / LangGraph HITL 都把敏感工具调用做成暂停、审批、恢复的流程，审批面需要保留可恢复状态和明确的人工输入。
- Zapier Human in the Loop / Microsoft Copilot Studio Request for information 都强调把要给 reviewer 的字段、通知和后续流程映射清楚。
- AI overreliance 研究提醒：解释本身不够，用户需要低成本核对和明确边界，避免把 AI 建议或复制动作误读成默认正确或已经执行。

## 实施步骤

1. 把审核包复制状态从字符串升级为结构化回执，显示标题、正文和只读剪贴板边界。
2. 回执正文点名处理选项数量、证据引用数量、隐藏证据数量和队列快照性质。
3. 复制出去的审核包附带页面同款 `处理边界`，让离开页面后的外部复核仍保留“不提交/不外发/不续跑”的说明。
4. 扩展 `verify-decision-center-e2e.mjs`，覆盖普通决策和规则改进两类审核包复制回执。
5. 更新 `docs/features/memory_system.md` 中决策中心说明，保持文档简洁。
6. 运行 focused verifier、dev compile、E2E 与 scoped `git diff --check`。

## 不做

- 不改 `confirm_requests` 后端状态机。
- 不改回答、稍后、待观察查证、OpenClaw 续跑或规则保存语义。
- 不新增新的 review queue 或批量审批模型。
