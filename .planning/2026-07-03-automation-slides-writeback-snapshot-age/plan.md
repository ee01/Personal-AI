# Slides 写回预览快照年龄回执计划

## 选择

- 功能点: `Slides 写回预览`
- 主文档: `docs/features/google_slides_analyzer.md`
- 主要代码: `src/modals/slides-analysis.tsx`
- 验证脚本: `tools/verify-google-slides-analyzer.ts`, `tools/verify-google-slides-analyzer-e2e.mjs`

## 当前发现

- 文档与实现整体一致: 结果页已有分析快照、范围判定、字段级预览、写回决策、复核清单、提交中、失败和部分成功人工接管回执。
- Reminders: EventKit 找到 `Personal AI` 列表 4 条，均为已完成的豆包 / Weekly Dream Digest / sync 历史项，没有开放且与 Slides 写回相关的反馈。
- 外部参考:
  - Google Slides `batchUpdate` 是整批原子写入，任一 request 无效会导致整批失败。
  - Gemini in Slides 和 Copilot in PowerPoint 都把生成/改写结果放在人类预览、编辑和复核路径里。
  - NB2Slides / Slide4N 等论文也支持 presentation 生成和改写应保留 human-AI collaboration，而不是静默覆盖。

## 改进计划

1. 在写回预览的 `写回决策回执` 中增加快照年龄行，说明本页持有分析快照约多久，超过阈值或 deck 有协作编辑时需要回 Slides 重新分析。
2. 让复制出来的复核清单和 `提交中回执` 带同一条快照年龄基准，保证离开页面或等待 API 回包时仍能看见陈旧风险。
3. 更新 Google Slides Analyzer E2E，断言预览、复制清单和提交中回执都包含快照年龄与重新分析边界。
4. 更新功能文档，只概括行为，不展开实现细节。
5. 运行目标验证: `npm run verify:google-slides-analyzer`, `npm start -- --progress` 首次成功编译后停止，`npm run verify:google-slides-analyzer:e2e`, scoped `git diff --check`。

