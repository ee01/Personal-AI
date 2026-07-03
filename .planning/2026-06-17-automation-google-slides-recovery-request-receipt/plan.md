# Google Slides Analyzer 恢复请求回执

## 目标功能

- 随机选择: `Google Slides 项目分析器`
- 功能文档: `docs/features/google_slides_analyzer.md`
- 主要代码: `src/modals/slides-analysis.tsx`

## 外部参考

- Google Workspace Gemini / Gemini in Slides 强调来源、上下文和用户复核，AI 生成内容不应被当作最终事实。
- Microsoft Copilot in PowerPoint 把生成结果定位为可编辑 draft，并要求人工审阅。
- Google Slides API `batchUpdate` 是原子批次，所有子请求先校验后应用；写回 UI 必须把“预览 / 已发送 / 已确认”分清。
- Slide4N 等人机协作 slide 研究支持把用户复核和低成本恢复路径放在创作流程内。

## 用户体验问题

结果页初始加载拿不到 opener 数据时已有恢复提示和 `重新请求数据` 按钮，但点击后只出现短暂 toast。真实用户会不知道这次动作到底是:

- 重新拉取上一次分析结果；
- 重新分析整个 deck；
- 还是可能重新写回 Slides。

这个语义缺口会在 Google Slides 页面慢响应、弹窗被后台挂起或用户长时间停留结果页时制造不必要的不信任。

## 改进计划

1. 在结果页数据恢复路径中增加持久 `重新请求回执`。
2. 回执只在用户主动点击 `重新请求数据` 后展示，避免初次加载增加噪音。
3. 回执明确说明只向原 Google Slides 页面请求当前分析结果快照，不重新分析 deck，不写回 Slides，不反写 Jira / Memory Service。
4. 增加 E2E 慢父窗口场景: 父窗口接收请求但不返回数据，等待超时后点击重新请求并校验回执和第二次请求。
5. 更新 `docs/features/google_slides_analyzer.md`，保持文档与当前行为一致。

## 验证计划

- `npm run verify:google-slides-analyzer`
- `npm start` 等首次 webpack dev compile 成功后停止
- `npm run verify:google-slides-analyzer:e2e`
- `git diff --check -- src/modals/slides-analysis.tsx tools/verify-google-slides-analyzer-e2e.mjs docs/features/google_slides_analyzer.md .planning/2026-06-17-automation-google-slides-recovery-request-receipt/plan.md`
