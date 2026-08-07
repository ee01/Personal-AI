# Memory Capture 上下文变化未写入回执

## 目标功能

- 随机抽中：`docs/index.md` 中的「选中文字保存为资料记忆」。
- 相关文档：`docs/features/memory_capture.md`。
- 相关代码：`src/contentScriptWebIntelligence.ts`、`tools/verify-webpage-memory-detection.ts`。

## 现状

- `docs/progressing/to-verify.md` 当前为 `暂无。`，没有未完成校验项需要优先接续。
- 本机 Reminders 可读，但没有名为 `Personal AI` 的列表，本轮没有 Reminder 来源或可完成条目。
- 选区 / 整页保存的后端失败已经有结构化 `未写入` 回执，说明没有创建资料记忆，也没有写入网页或视觉检索信号。
- 但保存前如果页面上下文已经变化，面板只显示“当前页面上下文已变化，未保存。”，没有复用同一套 no-write 边界。

## 外部参考

- Notion Web Clipper 强调保存目标和可操作备注：https://www.notion.com/web-clipper
- Readwise Reader extension 把保存文章与 open-web highlight 分成明确动作：https://docs.readwise.io/reader/docs/saving-content
- Hypothesis 强调在原网页上 highlight / comment 且保留语境：https://web.hypothes.is/
- W3C Web Annotation Data Model 强调 annotation target / segment 能跨系统复用：https://www.w3.org/TR/annotation-model/
- KFTF / PIM 研究强调网页资料保存的核心是之后能重新找到当时为什么保存：https://www.microsoft.com/en-us/research/publication/keeping-found-things-found-web/

## 改进计划

1. 选区保存：当 URL、敏感页状态或 dismiss 状态变化导致提交被拦截时，改用 `formatMemoryCaptureSaveFailureReceipt('选区资料', ...)`。
2. 整页保存：当当前页面 payload 与复核时 payload 不一致，或敏感 / dismissed 状态变化时，改用 `formatMemoryCaptureSaveFailureReceipt('页面资料', ...)`。
3. 验证：在 `verify-webpage-memory-detection.ts` 中断言旧的含糊文案不再存在，并断言选区 / 整页上下文变化都走结构化未写入回执。
4. 文档：更新 Memory Capture 文档，说明上下文变化也属于手动保存失败，会明确没有创建资料记忆或检索信号，并提示重新选择或重试。
5. 校验：运行网页记忆检测 helper、source-memory API 测试、首次开发编译和 diff whitespace 检查。
