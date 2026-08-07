# Prompt Config 用户上下文来源待保存回执 Progress

## 2026-07-06

- 读取 `AGENT.md`、`docs/index.md`、`docs/progressing/to-verify.md`、自动化记忆和历史 planning 文件。
- 确认 `.planning/.active_plan` 指向上一轮 Project Dashboard，是历史残留；已切换到本轮新目录。
- 随机抽样功能索引后选择 `用户上下文注入`，并避开今天最新覆盖过的精确功能。
- EventKit 读取 `Personal AI` Reminders 成功：4 条全已完成，0 条未完成，均与本轮无关。
- 读取 `docs/features/custom_prompts.md`、`src/modals/prompt-config.tsx`、`src/services/userConfigPreview.ts`、`tools/verify-custom-prompts.ts`、`tools/verify-custom-prompts-e2e.mjs`。
- 完成外部扫描：ChatGPT Memory / Custom Instructions、Claude Memory / Claude Code memory、LaMP 个性化、promptware / memory poisoning 研究都支持把长期上下文来源、关闭状态和运行边界显式化。
- 确定实现切片：给“用户上下文”来源开关增加待保存回执，不改真实注入算法。
- 实现 `src/modals/prompt-config.tsx`：新增用户上下文来源待保存回执，关闭来源显示“暂停待保存”，保存暂停状态后重新开启显示“开启待保存”；回执明确当前只是页面草稿，真实分析仍读已生效基线。
- 更新 `tools/verify-custom-prompts-e2e.mjs`：覆盖用户上下文来源暂停待保存、保存后回执消失、重新开启待保存。
- 更新 `docs/features/custom_prompts.md` 和 `docs/index.md` 的用户可感知行为说明。
- 验证通过：
  - `node --check tools/verify-custom-prompts-e2e.mjs`
  - `npm run verify:custom-prompts`
  - `npm start -- --progress` 首次 webpack dev 编译成功，用时 16725 ms，然后停止 watcher
  - `npm run verify:custom-prompts:e2e`
  - scoped `git diff --check`
  - 进程检查未发现残留 repo webpack watcher、Prompt Config E2E、Playwright 或 Chromium 进程
