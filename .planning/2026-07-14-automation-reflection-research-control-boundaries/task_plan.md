# 反思本地研究补查控件边界计划

## 选中功能

- 随机样本中选择 `反思本地研究补查`，source of truth 是 `docs/memory_system.md` 和 `docs/index.md` 对应行。
- `docs/progressing/to-verify.md` 当前为 `暂无。`
- 避开了 automation memory 中刚覆盖的 Coverage、Meeting ASR、Snooze、Timeline、Skill Foundry、Relationship Radar、Message Analysis 等最新目标。

## Reminder 状态

- AppleScript 未列出 `Personal AI`。
- Swift/EventKit 找到 `Personal AI` Reminders list：共 4 条，未完成 0 条。
- 4 条都是已完成的豆包同步 / notification digest / 测试历史反馈，和 Reflection 本地研究补查无关，本轮没有 Reminder item 可纳入或标记 done。

## 外部参考

- NotebookLM source guide 和官方介绍强调 source-grounded answer、source guide 与可核查材料，支持研究补查必须暴露来源和采用证据。
- Microsoft Copilot personalization / memory controls 强调记忆和个性化可管理，支持把 confirmed profile 写入边界说清楚。
- Slack Enterprise Search 与 Slack engineering 的 federated / permissioned search 说明跨来源搜索要展示权限、来源和是否存储外部数据。
- Notion Enterprise Search security/privacy practices 同样强调 connected app 权限和可访问范围。
- Generative Agents、Reflexion、Reflective Memory Management 都支持反思型 memory loop，但产品上必须把反思输入、失败 trace、证据采用和动作副作用拆开呈现，避免用户把内部反思误读成外部确认。

## 改进计划

1. 给 Reflection 详情页顶部返回、立即自我反思、暂停、恢复、关闭按钮补 `title` / `aria-label`。
2. 给详情页动作队列的执行、重试、取消补动作类型和外部副作用边界。
3. 给外部委派 transcript 展开 / 收起补本地文件读取边界。
4. 给关联主动询问 `查看会话` 链接补只读导航边界。
5. 更新 `tools/verify-reflection-research-e2e.mjs` fixture 和断言，证明这些真实控件带有一致 `title` / `aria-label`。
6. 更新 `docs/memory_system.md` 和 `docs/index.md`，保持文档与当前代码一致。

## 非目标

- 不改 `ReflectionThreadService`、`ReflectionResearcher`、`ReflectionWorker`。
- 不改 `/reflection-threads` API、研究 trace payload、动作执行语义、OpenClaw 委派、Outreach 状态机或 confirmed profile 写入逻辑。
- 不改 Reminder 状态。

## 验证计划

- `node --check tools/verify-reflection-research-e2e.mjs`
- `npm start -- --progress` 等待第一次 successful compile 后停止
- `npm run verify:reflection-research:e2e`
- scoped `git diff --check`
