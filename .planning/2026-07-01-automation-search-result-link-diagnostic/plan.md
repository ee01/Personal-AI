# 搜索结果安全诊断恢复路径

## 目标功能

- 随机选中：`时间轴/搜索安全跳转`
- 所属文档：`docs/features/memory_system.md`
- 当前范围：Memory Exploring 搜索结果与时间轴共用的链接安全呈现。

## 现状

- 时间轴卡片在链接被拦截或无可打开目标时，已经可以复制安全诊断。
- 搜索结果卡片会显示链接安全状态、拦截原因和点击回执，但没有同等的低风险恢复动作。
- 搜索结果里的决策证据内链按钮传参有误，按钮可见但点击不会按证据对象跳转。

## 外部参考

- Slack Enterprise Search 和 Notion Enterprise Search 都强调搜索结果必须尊重用户可访问权限和来源边界。
- Microsoft Defender Safe Links / Google Safe Browsing 类产品把风险提示放在点击路径附近，而不是只在后台拦截。
- OWASP / CWE 对 URL query 中的 token、secret、credential 泄漏有明确风险描述。
- 浏览器安全警告研究强调警告需要给出原因和可执行下一步，否则用户容易忽略或误解。

## 实施计划

1. 在 `searchResultPresentation.ts` 增加搜索结果安全诊断 builder 与复制成功/失败回执。
2. 在 `SearchResultPage.vue` 为被拦截或无目标的搜索结果显示 `复制安全诊断`，诊断不包含原始 URL 或内部 route。
3. 修正决策证据 `在记忆中查看` 的点击参数，复用同一安全跳转函数。
4. 更新 `docs/features/memory_system.md` 的当前行为描述。
5. 用纯函数验证和 E2E 验证诊断内容、无敏感 URL 泄漏、按钮可见和复制回执。

## 非目标

- 不放宽安全链接白名单。
- 不改变 Memory Service 召回、反馈写入或排序逻辑。
- 不新增外部打开能力或自动同步来源。
