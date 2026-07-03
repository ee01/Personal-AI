# Skill Foundry 平台同步在途回执改进计划

## 目标功能

- 随机抽中：`平台同步`
- 所属能力：Personal Skill Foundry
- Source of truth：`docs/features/personal_skill_foundry.md`
- 入口：`memory-exploring.html#/skills` 的 `平台级自动同步` 弹窗

## 当前发现

- 文档描述基本匹配代码：平台同步仍是 per-platform，不是 per-skill；OpenClaw 是远端 API 同步；Codex CLI / Claude Code / Cursor 依赖 Desktop App；ChatGPT / Claude.ai Skills 是 manual-only。
- 本机 Reminders 可读，但没有名为 `Personal AI` 的列表；本轮没有 Reminder 来源条目可纳入或标记 done。
- 外部扫描显示 Claude / Agent Skills、OpenAI GPT Actions 与近期 agent-skill 供应链讨论都强调：skill 是可移植能力包，但同步、安装、复制凭证和执行是不同风险边界。
- 代码已有成功/失败后的 `同步回执` 和开关 `开关回执`，但点击 `立即同步` 后请求在途时只清空旧回执并禁用按钮，用户看不到这次正在处理哪个平台、扫描/写入范围是什么、哪些副作用尚未确认。

## 改进计划

1. 在 `PersonalSkillsPage.vue` 增加 `同步处理中` pending receipt builder。
   - OpenClaw：说明这次会请求远端 API，同步范围是最多 10 条 active package / remote candidates，manual-only 不参与。
   - Desktop App：说明这次会调用本机 Desktop App 扫描/写回指定平台目录，页面本身不直接读写文件。
   - 共同边界：请求返回前不代表已新增 suggestion、更新 binding、推送、回拉、安装、执行 skill 或覆盖 active 真源。
2. 在 `runOpenClawSync` 和 `runDesktopSkillSync` 发请求前展示 pending receipt；返回后替换成现有成功/失败回执。
3. 扩展 `tools/verify-personal-skill-foundry-e2e.mjs`：
   - hold Desktop App 同步响应，断言点击 `立即同步 Codex CLI` 后先出现 `同步处理中`。
   - release 响应后继续断言现有成功同步回执，避免只验证中间态。
4. 更新 `docs/features/personal_skill_foundry.md` 的平台同步段落，记录在途回执行为。
5. 验证：
   - `npm start` 首次成功编译后停止。
   - `node tools/verify-personal-skill-foundry-e2e.mjs`。
   - `npm run verify:i18n`。
   - scoped `git diff --check`。
