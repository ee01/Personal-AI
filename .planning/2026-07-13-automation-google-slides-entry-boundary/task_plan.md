# Google Slides 项目分析器入口边界

## 选择依据

- 随机候选命中 `Google Slides 项目分析器`，最近 automation memory 已覆盖 Memory Service、Agent Thinking、Topic Messages、Meeting Pilot、Notification Center、Project Dashboard、Quick Ask 和 User Profile，所以本轮避开这些新鲜目标。
- `docs/progressing/to-verify.md` 为空，没有待继续校验项。
- EventKit 找到本机 `Personal AI` Reminders 列表，4 个 item 全部已完成，内容集中在 Doubao / Notification 同步；没有和 Google Slides Analyzer 相关的未完成反馈。

## 外部参考

- Google Slides API `batchUpdate` 是原子批次，任一无效 request 会导致整批不应用；协作编辑还可能影响最终呈现，所以入口不能暗示点击会安全直接落地。
- Asana for Google Slides 用 smart chips 把任务、项目、目标和状态上下文嵌入 slide，说明项目汇报页的价值在于保留源系统上下文，而不是只写静态文本。
- Microsoft Copilot in PowerPoint 把 slide 生成定位为 draft，可继续追问、编辑和 refine；这支持本功能保持“分析快照 -> 人工复核 -> 写回”的路径。
- Slide4N / NB2Slides 等论文都强调 slide AI 更适合 human-AI collaboration，而不是全自动覆盖。

## 改进计划

1. 将 Google Slides 工具栏入口 idle 状态的 `title` / `aria-label` 改成审阅快照边界：只生成分析结果和可写字段建议，不立即写回 Slides，不反写 Jira / Memory Service。
2. 将授权中、分析中、重复点击和启动超时提示统一到同一边界：重复点击不会二次授权、重复分析、打开多份结果页或写回外部系统。
3. 更新 `tools/verify-google-slides-analyzer-e2e.mjs`，在真实扩展内容脚本里断言入口 idle/busy/duplicate toast 的文案。
4. 更新 `docs/features/google_slides_analyzer.md` 和 `docs/index.md` 的入口能力描述。
5. 验证顺序：`npm run verify:google-slides-analyzer`，`npm start -- --progress` 首次成功编译，`npm run verify:google-slides-analyzer:e2e`，scoped `git diff --check`。

## 非目标

- 不改 Google Slides API 写回 payload、batchUpdate 原子批次、Jira 查询、字段建议生成、结果页选择/写回逻辑或 OAuth 授权流程。
- 不标记任何 Reminder 完成，因为本轮没有相关未完成 item。
