# Skill Foundry 本机导入确认边界计划

## 目标功能

- 索引条目：`本地 agent skill 导入建议`
- 主文档：`docs/features/personal_skill_foundry.md`
- 主要实现：`src/modals/components/PersonalSkillsPage.vue`
- 验证入口：`tools/verify-personal-skill-foundry-e2e.mjs`

## 现状检查

- `docs/progressing/to-verify.md` 当前为 `暂无。`，没有接续校验事项。
- 本机 Reminders 可读，但没有 `Personal AI` 列表；本次没有纳入或完成 Reminder item。
- 现有 Skill Foundry 已覆盖本机目录来源、资源文件数量、越界文件、缺少验证线索、review gate、稍后/丢弃/恢复/入库回执。

## 外部参考

- Codex Skills 和 Claude Code Skills 都把 skill 作为本机或插件级可发现包，且可能包含支持文件、脚本和安装/调用策略。
- Agent Skills 标准和 2026 agentic skills SoK 都强调 skill 是可复用、可执行、可治理的 procedural package；脚本、资源和 marketplace / 本机导入带来供应链与验证边界。
- TAP security usability 和 mixed-initiative UI 研究都支持把自动化建议的真实执行边界、用户控制点和验证状态前置展示，而不是只给最终状态。

## 改进计划

1. 在确认前回执中为本机导入增加“本机导入边界”行。
   - 说明确认只把本次扫描快照写入 Personal AI active 真源。
   - 说明不会改写、删除、修复或反写原本机 skill 目录。
   - 说明不会运行包内脚本、安装依赖、连接 MCP 或执行该 skill。
   - 说明验证线索只是审核事实，不代表确认时已验证。
2. 在确认后 `入库回执` 保留同一条本机导入边界。
   - 避免用户把 `已入库` 误读成原 `.codex/skills` / `.claude/skills` / Cursor 目录已被修复、验证或同步。
3. 扩展 Skill Foundry E2E。
   - 让 E2E 点击本机导入的 `确认使用`。
   - 断言确认前回执和确认后入库回执都包含本机目录、不执行脚本、不反写、不当成已验证的边界。
4. 更新主功能文档。
   - 文档只记录用户可感知边界，不展开实现细节。

## 验证计划

- `node tools/verify-personal-skill-foundry-e2e.mjs`
- `npm start` 等待首次成功编译后停止
- `git diff --check -- src/modals/components/PersonalSkillsPage.vue tools/verify-personal-skill-foundry-e2e.mjs docs/features/personal_skill_foundry.md .planning/2026-06-18-automation-skill-foundry-local-import-boundary/plan.md`
- 检查没有遗留 webpack watch 进程
