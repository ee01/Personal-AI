# Google Slides 写回提交中回执

## 目标

- 随机目标: `Slides 写回预览` / Google Slides Analyzer。
- 当前文档和代码已经覆盖字段级写回预览、风险提示、失败/跳过接管清单；本轮只补等待态 UX 缺口。
- 用户点击 `应用 ... 个字段到 Slides` 后，结果页应立即显示已发送并锁定的 payload 范围，避免慢网络或 Google Slides API 等待期间误以为还能改选择，或误以为已经完成写回。

## Reminder 检查

- 本机 Reminders 可访问。
- `Personal AI` 列表不存在；本轮没有可完成或可备注的 Reminder item。

## 外部参考

- Gemini in Google Slides 和 Copilot in PowerPoint 都把 AI slide 内容定位为可继续编辑、需人工复核的草稿。
- Google Slides API `batchUpdate` 是原子批量请求：任一子请求无效时整批失败。
- Human-AI collaboration / Slide4N 方向支持人机协作、确认后执行，而不是全自动覆盖。

## Plan

1. 在 `slides-analysis.html` 写回等待态加入 `提交中回执`。
2. 回执展示 presentation id、字段/项目数、原子批次、已锁定范围和无副作用边界。
3. 等待 Google Slides 回包期间锁定筛选视图、字段勾选、全选和复核队列。
4. 成功、失败、超时或异常时清掉提交中回执，改由已有完成/失败接管回执承接。
5. 更新 Google Slides Analyzer 文档和索引。
6. 通过 targeted verifier、webpack dev compile、扩展 E2E 和 scoped diff check 验证。

## 实施记录

- `src/modals/slides-analysis.tsx`: 新增提交中回执构造和 UI；等待态锁定审阅筛选与快捷筛选按钮。
- `tools/verify-google-slides-analyzer-e2e.mjs`: 覆盖点击应用后、API 返回前的提交中回执和锁定控件。
- `docs/features/google_slides_analyzer.md`: 记录提交中回执和等待态锁定边界。
- `docs/features/index.md`: 更新 `Slides 写回预览` 简述。

