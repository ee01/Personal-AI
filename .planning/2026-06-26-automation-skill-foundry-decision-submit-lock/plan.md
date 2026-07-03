# Skill Foundry 决策提交锁

## 目标

随机抽中的功能点是 `Skill Foundry / 技能使用/丢弃/稍后审`。本轮聚焦建议卡片的决策路径：用户点击 `使用`、`确认覆盖`、`丢弃`、`稍后审` 或 `现在审` 时，页面应该明确处于单次提交中，避免重复请求和旧状态交错。

## 业内与论文信号

- Claude Skills 把 skill 做成可逐层展开的 instructions / scripts / resources 包，说明 skill 决策页需要保留来源、资源和执行边界，而不是把确认动作伪装成已经执行 skill。
- OpenAI Agents guardrails / HITL 文档把敏感动作建模为 pause / approve / reject，说明人工决策动作需要清楚的 pending 和结果边界。
- SkillFoundry / agent skills 论文把 reusable skill library 视为会持续演化的 procedural memory，说明错误确认或重复确认会污染长期技能库。
- Automation bias 研究提醒，AI 推荐项需要让用户在动作提交和结果确认之间保持辨别能力；禁用重复动作和显示处理中状态是低成本防误触。

## 发现的问题

- `PersonalSkillsPage.vue` 对 suggestion 决策动作没有本地 pending guard。
- 如果用户快速双击或在请求返回前连续点同一条建议的多个按钮，前端可能发出重复 POST，或者把一条 suggestion 的旧选择和新回执混在一起。
- 后端状态机已经是安全的；本轮不扩展后端 contract，只补前端单次提交保护和 E2E 证据。

## 实施计划

1. 增加 per-suggestion pending action 状态和 `决策处理中` 回执。
2. 在 Inbox、稍后队列和详情页的 suggestion 决策按钮上统一禁用 pending 项。
3. 所有 suggestion action 函数开头做 guard，避免重复提交；成功或失败后清理 pending。
4. 扩展 `tools/verify-personal-skill-foundry-e2e.mjs`，用延迟 quick-promote fixture 验证双击只产生一次 use POST。
5. 更新 `docs/features/personal_skill_foundry.md` 的用户主流程说明。
6. 跑 Skill Foundry E2E、dev build 和 scoped diff checks。

## 完成结果

- `PersonalSkillsPage.vue` 增加 suggestion 决策 pending lock：请求返回前显示 `决策处理中` 回执，并锁定 `使用/确认覆盖/丢弃/稍后审/现在审` 等写入类按钮。
- 成功后继续显示原来的入库、丢弃、稍后审、恢复回执；失败时显示未确认写入的失败回执。
- E2E 对 Quick Promote 使用延迟响应，确认 pending 回执可见、按钮禁用、快速路径只发送 1 次 use POST。

## 验证

- `node --check tools/verify-personal-skill-foundry-e2e.mjs`
- `npm start` 首轮 webpack dev compile 成功后已停止 watcher
- `node tools/verify-personal-skill-foundry-e2e.mjs`
- `git diff --check -- src/modals/components/PersonalSkillsPage.vue tools/verify-personal-skill-foundry-e2e.mjs docs/features/personal_skill_foundry.md .planning/.active_plan .planning/2026-06-26-automation-skill-foundry-decision-submit-lock/plan.md`
