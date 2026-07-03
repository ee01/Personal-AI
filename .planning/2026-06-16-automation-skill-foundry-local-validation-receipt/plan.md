# Skill Foundry 本地导入验证线索回执 Plan

## 目标

随机命中 `docs/features/index.md` 里的 `本地 agent skill 导入建议`。本轮只改 Skill Foundry 本地导入建议路径：让用户在确认本机 Codex / Claude Code / Cursor skill 进入 Personal AI active 真源前，能看到该包是否带有测试、eval、fixture、spec 或验证脚本线索。

## 外部参考约束

- Anthropic Agent Skills 和 Agent Skills open standard 都把 skill 定义为 `SKILL.md` 加 scripts / references / assets 的能力包；本地导入不能只看标题和摘要。
- OpenAI Agents SDK guardrails / tracing 强调工具调用、边界和运行轨迹要可审计；带脚本的 skill 若缺少验证线索，应在审核 gate 前置。
- 近期 agent skill lifecycle / MUSE-Autoskill 研究把 skill 评估、运行反馈和持续演进视为核心生命周期；短期无需新增 eval 面板，但应把“是否已有验证材料”做成导入审核事实。

## 改进步骤

1. 后端 `local-platform` 同步分析包内文件路径，识别 test / spec / eval / fixture / verify 等验证线索，并写入 binding metadata。
2. 后端 review reason：本地导入如果含脚本或外部运行依赖但没有验证线索，增加“缺少验证线索”的审核原因。
3. 前端 Inbox 卡片、审核 gate 和确认前回执显示验证线索数量；缺失时显示“未发现验证线索”，让用户知道确认使用不是已验证运行。
4. 更新 `tools/verify-personal-skill-foundry-e2e.mjs` 和 `memory-service/src/__tests__/api-skills.test.ts` 覆盖缺失/存在验证线索两类本地导入。
5. 更新 `docs/features/personal_skill_foundry.md`，记录该 UX 边界和验证建议。
