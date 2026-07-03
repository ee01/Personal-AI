# Google Slides Analyzer 分析快照回执计划

## 目标

为 `Google Slides Analyzer / Google Slides 项目分析器` 补上结果页首屏的分析快照身份回执，避免用户在多个结果页、切换 slide 或编辑 deck 后，把旧分析结果误认为当前 Slides 实时状态。

## 外部参考

- Gemini in Google Slides 把生成/总结/引用 Drive 文件放在 side panel 中，并让用户预览、插入、反馈，说明 AI 输出需要和插入动作分离。
- Microsoft Copilot PowerPoint summarizer 支持 overview、slide-wise、topic-wise summary，并强调按读者调整摘要，说明项目 deck 分析应标明当前快照和审阅对象。
- Canva Magic Design 将 AI 生成定位为 first draft，说明后续人工编辑和确认路径仍是核心。
- PowerPoint 任务评测和 persona-aware slide 生成论文都把演示文稿视为复杂、多轮、多模态工具任务，支持在写回前保留来源、范围和人工确认。

## 改进步骤

1. 在 `src/modals/slides-analysis.tsx` 记录分析数据到达时间。
2. 在分析报告首屏新增 `分析快照回执`，显示 presentation、目标 slide、收到时间、项目/建议/可写字段/默认选择/当前选择，并明确这不是 deck 实时监听。
3. 更新 `tools/verify-google-slides-analyzer-e2e.mjs`，断言回执、presentation、target slide、非实时和无写回边界。
4. 更新 `docs/features/google_slides_analyzer.md`，用简短条目记录当前行为。
5. 运行目标验证、`npm start` 首次成功编译和 scoped `git diff --check`。

