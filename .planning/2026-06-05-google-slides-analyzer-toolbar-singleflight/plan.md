# Google Slides Analyzer toolbar single-flight plan

## 目标功能

- 随机抽中: `Google Slides 项目分析器`
- Source of truth: `docs/features/google_slides_analyzer.md`
- 入口代码: `src/contentScriptGoogleSlide.tsx`
- 主要验证: `npm run verify:google-slides-analyzer`、`npm run verify:google-slides-analyzer:e2e`

## Reminder 检查

- 本机 Reminders 可访问，但列表中没有 `Personal AI`。
- 因此本轮没有相关用户反馈 item 可合并，也没有可标记完成的 Reminder。

## 外部参考结论

- Google Workspace Gemini in Slides/Docs 强调 sources 可能不完整，需要用户核对；结果页继续保留字段来源和解析范围。
- Microsoft Copilot in PowerPoint、Asana for Google Slides 都把 AI/自动化输出放在既有协作材料里，适合“带来源的草稿 + 用户确认”而不是直接覆盖。
- Google Slides API `batchUpdate` 是批量写回，错误定位对用户很关键；本功能已有字段级回执、跳过原因和人工接管清单。
- NB2Slides、Slide4N、SlideBot 等 slide 生成/整理研究都支持 mixed-initiative 协作，改进重点应放在减少重复运行和让用户清楚当前动作状态。

## 发现的问题

Google Slides 页面工具栏按钮点击后只发送 `REQUEST_SLIDES_ANALYSIS`，按钮本身没有 busy/disabled 状态。真实路径里如果用户快速连点，或者 popup 仍打开时 background 与 popup listener 都处理同一请求，content script 可能收到多次 `ANALYZE_SLIDES_PROJECTS`，重复跑 OAuth/API/LLM 分析并打开多个结果页。

## 实施步骤

1. 在 `src/contentScriptGoogleSlide.tsx` 增加 `idle/requesting/analyzing` 状态。
2. 工具栏按钮在 requesting/analyzing 时展示忙碌文案、`aria-disabled=true`、`aria-busy=true`，重复点击只提示等待。
3. 收到 `ANALYZE_SLIDES_PROJECTS` 时如果已有分析在跑，返回错误并不启动第二次分析；正常/失败/空结果都恢复入口。
4. 在 E2E 中断言工具栏入口可进入 busy 状态且语义属性正确。
5. 更新功能文档的当前能力和 UX 原则。
6. 执行 focused helper、首次 webpack compile、extension E2E 和 diff check。
