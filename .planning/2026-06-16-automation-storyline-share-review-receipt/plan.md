# Storyline 入口外发复核回执 Plan

## 目标

本轮从 `docs/features/index.md` 随机选中 `Storyline 会前提示`。目标是让 Today Pilot 会前准备里的 Storyline 入口在打开 Draft 页前，更清楚地说明私有素材、脱敏提示和风险提醒范围，避免用户把“可生成故事线”误读成“已经可以外发”。

## 外部参考

- Microsoft Teams Intelligent recap 会把 meeting notes、recommended tasks、timeline markers、chapters 和 topics 放在 Recap 中，并区分外部分享能力，说明会议 AI 输出需要保留后续分享边界。
- Google Meet `Take notes for me` 会生成 notes doc、summary 和 next steps，同时有参与者同意、共享范围、语言和截图设置，说明会议材料在生成前后都要显示访问/分享边界。
- Notion AI Meeting Notes 默认私有，可手动或内部自动分享，并明确录音/转写处理与分享责任，说明会议总结产品需要把“可分享”和“默认私有”拆开。
- LLM-powered meeting recap 研究强调 highlights / hierarchical minutes 面向不同复盘需求，并提供编辑、复制、上下文查看等复核 affordance；Storyline 应更接近“可复核讲述材料”，而不是直接发布。

## 改进计划

1. 代码检查：确认 Storyline 入口已经展示素材组、refs 差异、来源类型和 Draft API 延迟调用边界。
2. UX 改进：在入口回执中增加 `外发复核`，显示 `prep.evidenceRefs` 的私有素材数、`redactionPreview` 脱敏提示数和 `risksOrOpenLoops` 风险提醒数。
3. 文档更新：同步 `today_pilot.md` 与 `memory_storyline_builder.md`，说明该回执不阻断打开 Draft 页，只提前暴露复核范围。
4. 验证：更新 Video Home Storyline E2E fixture 和断言，再跑后端 Storyline/meeting-prep 测试、webpack 首次编译、Video Home/Draft E2E、scoped `git diff --check`。

## Reminder 状态

本机 Reminders 可读，但列表中没有 `Personal AI`，因此本轮没有 Reminder 来源条目，也没有可标记 done 的条目。
