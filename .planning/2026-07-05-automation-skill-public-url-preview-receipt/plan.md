# Public Skill URL 预览回执计划

## 目标

随机抽中 `Public Skill URL` 后，检查到复制 URL / 安装指令已经有 token、只读、失败和旧回执，但 `打开预览` 仍然直接打开 bearer URL，没有留下本页回执。用户容易把预览误读成安装、同步或执行，也看不到弹窗被拦截时到底是否访问了 token URL。

## 外部参考

- Anthropic Claude Skills 把 skill 作为带说明、脚本和资源的可加载包；这类包被 agent 拉取时要区分“读取包”和“执行/安装”。
- OpenAI GPT Actions / agent action 体系把 schema、认证和外部调用边界分开，支持把“拿到入口”和“实际执行动作”拆成两个状态。
- W3C capability URL guidance 和 Macaroons 论文都提醒 bearer URL / token URL 本身就是访问能力，UI 不能只把它当普通链接。

## 实施步骤

1. 在 `PersonalSkillsPage.vue` 增加 preview receipt，复用 share snapshot，记录 token 尾号、version、sha 和 display short link。
2. `openSkillPreview()` 打开成功时显示 `已打开只读预览`；`window.open` 返回空值时显示 `预览未打开`。
3. 回执明确：预览只读拉取 HTML/SKILL.md/package/files，不复制剪贴板，不安装 skill，不触发平台同步，不写外部平台，不执行脚本。
4. E2E 拦截 `page` 事件确认成功打开完整 token URL；再 mock `window.open` 返回 `null`，断言失败回执。
5. 更新 `docs/features/personal_skill_foundry.md`，说明预览按钮和 Reminders 结果。

## 验证

- `node --check tools/verify-personal-skill-foundry-e2e.mjs`
- `npm start -- --progress` 首次成功编译后停止
- `node tools/verify-personal-skill-foundry-e2e.mjs`
- `git diff --check -- src/modals/components/PersonalSkillsPage.vue tools/verify-personal-skill-foundry-e2e.mjs docs/features/personal_skill_foundry.md .planning/.active_plan .planning/2026-07-05-automation-skill-public-url-preview-receipt/plan.md`
