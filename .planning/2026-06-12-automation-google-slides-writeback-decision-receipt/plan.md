# Google Slides 写回决策回执计划

## 目标

随机抽中的功能是 `Slides 写回预览`。这次只补一个窄口径问题：用户在筛选视图里准备写回时，已有字段预览、隐藏选择提醒和原子批次说明，但缺少一个合并的提交范围/复核/非写入边界回执。

## 外部参考

- Gemini in Google Slides 和 Copilot in PowerPoint 都把 AI 生成内容放在可预览、可继续编辑的人工确认流程里。
- Slide4N 和 NB2Slides 都强调 slide 生成/整理更适合人机协作，不适合全自动覆盖。

## 实施步骤

1. 在 `slides-analysis.html` 写回区新增 `写回决策回执`。
2. 回执覆盖已选字段/项目数、当前筛选可见与隐藏选择、来源充分与人工纳入字段。
3. 回执写清未选字段、无法写回字段、仅风险关注项不会进入批次，也不会反写 Jira 或 Memory Service。
4. 把同样的决策回执写入复制出来的复核清单。
5. 更新 `docs/features/google_slides_analyzer.md` 和 `tools/verify-google-slides-analyzer-e2e.mjs`。

## 验证计划

- `npm run verify:google-slides-analyzer`
- `npm start` 首次成功编译后停止 watcher
- `npm run verify:google-slides-analyzer:e2e`
- `git diff --check`
