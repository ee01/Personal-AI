# Findings

## 产品/论文启发

- Slack Enterprise Search：搜索和 AI answers 只包含用户有权限访问的来源内容，适合映射到 Personal AI 本地研究的“只读本地可见记忆”边界。
- Notion Enterprise Search：强调连接应用内容的安全和隐私实践，说明多源检索 UI 需要清楚交代连接源和可访问范围。
- Generative Agents：reflection 是长期记忆、规划和行为生成的一环；Personal AI 已有同轮反思的本地研究步骤。
- Reflexion：语言反馈写入 episodic memory 后改善后续决策；这里对应“研究 trace / evidence refs 是否真正进入下一轮反思”的可解释性。

## 代码观察

- `ReflectionThreadDetail.vue` 已展示本轮研究范围、每条 trace、空结果、失败、skipped 和研究命中证据列表。
- 现有 UI 没有把 `researchAttempts.evidenceRefs` 与下方 `researchEvidence` link 明确解释成“已进入本轮 ReflectionWorker 输入”的采用状态。
- `tools/verify-reflection-research-e2e.mjs` 已覆盖 detail/list/empty-filter 主路径，是本轮最合适的验证入口。

## Reminder

EventKit 读取 `Personal AI` 列表：4 条总数，0 条未完成；无相关 open item，无需标记 done 或写备注。
