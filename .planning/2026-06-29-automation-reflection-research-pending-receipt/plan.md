# Reflection 本地研究提交中回执计划

## 随机目标

- 来源：`docs/index.md`
- 目标小功能：`反思本地研究补查`
- 所属能力：Memory Service
- 主文档：`docs/memory_system.md`
- Reminder：本机 Reminders 可读，但没有 `Personal AI` 列表；本轮没有 Reminder 来源或可标记完成的条目。

## 当前观察

`ReflectionThreadDetail.vue` 已经展示 `本轮研究范围`、研究摘要、每条研究 trace、空结果、失败和范围裁剪回执；`tools/verify-reflection-research-e2e.mjs` 也覆盖了这些状态。文档对当前运行逻辑基本是最新的。

用户体验缺口在手动点击 `立即自我反思` 后：请求等待期间页面保留旧研究 trace，但没有明确告诉用户这些 trace 还是上次成功快照，新的 `manual_revisit` 尚未返回。真实用户容易把旧 trace 当成刚点击后的新研究结果，尤其是 Memory Service 慢、研究失败或旧 trace 含失败项时。

## 外部参考

- LangSmith observability 强调 agent/RAG pipeline 的 end-to-end traces、failure debugging、latency/cost 监控；这支持把 run 进行中和历史 trace 分开显示。
- Langfuse observability/data model 把 traces/observations、latency、成本、评分和调试维度结构化；这支持让本地研究 query 的状态与上下文可复核，而不是只显示最终摘要。
- OpenTelemetry GenAI semantic conventions 已覆盖 workflow、agent、retrieval、tool call 等 span 属性；这支持把一次反思研究当成一个有状态的 run/span，而不是普通页面刷新。
- AgentTrace 论文强调 continuous introspectable trace capture 能提升 agent security、accountability 和 trust calibration；这支持在 pending 期间暴露“尚未替换旧 trace”的边界。

## 改进计划

1. 在 `ReflectionThreadDetail.vue` 增加手动反思专用 pending 状态，不复用全局 `busy` 判断暂停/恢复/关闭。
2. 在 `研究补查过程` panel 顶部显示 `新一轮本地研究提交中` 回执：说明 Memory Service 正在规划/读取本地证据，结果尚未替换旧 trace；下方旧 trace 只是上次成功读取快照；此阶段不会联网搜索、发送、确认决策、执行 OpenClaw 或写 confirmed profile。
3. 在 `tools/verify-reflection-research-e2e.mjs` 给 revisit POST 加短延迟，并断言 pending 回执先出现，随后成功回执和刷新结果出现。
4. 更新 `docs/memory_system.md` 的反思本地研究补查段落，记录 pending 回执和旧 trace 快照边界。
5. 验证：运行 focused E2E、`npm start` 首次成功编译、再跑 focused E2E、`npm run verify:i18n` 和 scoped `git diff --check`。
