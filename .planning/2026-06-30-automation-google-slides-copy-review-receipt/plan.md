# Google Slides 写回复核清单复制回执计划

## 目标功能

- 索引条目：`Slides 写回预览`
- 所属能力：Google Slides Analyzer
- 主文档：`docs/features/google_slides_analyzer.md`

## 当前观察

- 结果页已经在应用前展示 `即将写回`、`写回决策回执`、字段级写入目标、来源依据和 Google Slides 原子 `batchUpdate` 边界。
- `复制复核清单` 会把同一批字段、来源和边界复制到剪贴板，但当前页面只给 transient toast。
- 用户复制后如果改了勾选或筛选，页面没有保留“剪贴板是哪一版”的可见状态，也没有明确说明复制只是本机 handoff，不会提交到 Google Slides、Jira 或 Memory Service。
- Reminder 检查：本机 Reminders 可读取，但没有 `Personal AI` 列表，因此没有相关反馈项可纳入或标记完成。

## 外部参考

- Google Slides API `batchUpdate` 是先校验再原子应用，支持在写回前强调“复制/复核清单不是提交批次”。
- Gemini in Google Slides / Workspace sources 都把生成内容作为需要用户核对来源和结果的草稿，不应让复制动作看起来像应用或同步。
- Slide4N / NB2Slides 等 slide 生成研究强调 human-AI collaboration，适合保留可复核、可分享、可追溯的 handoff 快照。

## 改进计划

1. 在 `slides-analysis.html` 写回预览区新增持久 `复核清单复制回执`。
2. 复制成功时记录本次复制的字段数、项目数、presentation、当前视图可见/隐藏选择、人工纳入字段数、复制时间和字段签名。
3. 如果复制后用户改变选择，回执显示“复制清单已不是当前选择”，提示需要重新复制；复制失败时显示本机剪贴板未确认，不把失败伪装成 handoff。
4. 回执明确非效果：只写入本机剪贴板，不写回 Slides、不重新分析 deck、不反写 Jira 或 Memory Service，也不会随之后的选择自动更新。
5. 更新 E2E 覆盖复制成功、选择变化后的 stale 状态。
6. 更新 `docs/features/google_slides_analyzer.md` 的当前能力与 UX 原则。

## 验证

- `npm run verify:google-slides-analyzer`
- `npm start -- --progress` 等首次 successful compile 后停止
- `npm run verify:google-slides-analyzer:e2e`
- `git diff --check -- src/modals/slides-analysis.tsx tools/verify-google-slides-analyzer-e2e.mjs docs/features/google_slides_analyzer.md .planning/2026-06-30-automation-google-slides-copy-review-receipt/plan.md`
