# 时间轴安全跳转预点击 affordance

## 目标

- 随机目标：`时间轴/搜索安全跳转`，source of truth 是 `docs/features/memory_system.md`。
- 首次随机命中 `记忆搜索结果页`，但 2026-06-28 已做过成功空结果回执；本轮 reroll 到时间轴安全跳转。
- Reminder：本机 Reminders 可读，但没有 `Personal AI` 列表；无相关条目可纳入或完成。

## 外部参考

- Microsoft Recall 把时间线、app/site 过滤和敏感信息过滤放在同一个回看路径里，说明历史回找入口必须先暴露范围和安全控制。
- Google My Activity 支持按日期、产品和关键词过滤，说明个人历史浏览需要让用户看见当前筛选范围。
- OWASP / CWE 对 URL query 中的 token、credential、session 等敏感信息风险有明确说明；本轮不能放宽 signed URL、credential URL 或 token URL。
- PIM/refinding 与 timeline memory 研究强调时间、来源、上下文和可恢复路径；因此改进应放在用户点开前的判断路径，而不是只在点击后弹回执。

## 发现

当前时间轴已经具备：

- 内部 route allowlist；
- `http/https` 来源安全化；
- signed / credential / token URL 拦截；
- 卡片内链接安全状态；
- 点击后的打开动作回执；
- blocked/no-target 的安全诊断复制。

剩余 UX 问题是：整张时间轴卡片始终呈现可点击状态。即使唯一目标被拦截或根本没有可打开目标，用户也要点击后才知道这是“查看拦截原因”而不是“打开来源”。这会让 blocked/unavailable 状态看起来像失败或无响应。

## 实施计划

1. 在 `TimelinePage.vue` 为每张卡片增加 `卡片点击` affordance：
   - 内部路由可用：说明卡片只切换 Memory Exploring，外部来源仍需点按钮；
   - 来源 URL 可用：说明会打开 sanitized host；
   - 目标被拦截：说明卡片只展示拦截原因，另可复制安全诊断；
   - 没有目标：说明这是只读卡片和恢复路径。
2. 根据安全状态调整卡片 cursor / class，避免 blocked/no-target 卡片看起来像直接打开链接。
3. 不改后端、不放宽安全策略、不复制 blocked raw URL。
4. 更新 `docs/features/memory_system.md` 中时间轴安全跳转说明。
5. 扩展 `tools/verify-memory-timeline-e2e.mjs` 覆盖新 affordance，跑 focused verifier、`npm start` 首次成功编译、i18n 和 scoped diff check。
