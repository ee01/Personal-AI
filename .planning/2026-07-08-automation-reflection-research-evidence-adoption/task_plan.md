# 反思本地研究补查巡检计划

## 目标

随机目标：`反思本地研究补查`，所属 `Memory Service`，主文档为 `docs/features/memory_system.md`。

本轮不改反思规划、召回、写入、动作生成或外部委派逻辑；只优化用户在反思详情页理解“本地研究命中证据是否真的进入本轮反思”的路径。

## 检查结论

- `docs/progressing/to-verify.md` 当前暂无待校验事项。
- Reminder：AppleScript 没列出 `Personal AI`；EventKit 确认有 `Personal AI` 列表，共 4 条且 0 条未完成。未发现与 Reflection / 本地研究补查相关的未完成反馈。
- 当前工作树已有大量未提交改动，包括 `ReflectionThreads.vue` 和 `verify-reflection-research-e2e.mjs` 中的空筛选回执改动。本轮只追加证据采用回执，不回退现有改动。

## 外部参考

- Slack Enterprise Search 和 Notion Enterprise Search 都强调按用户权限可访问的数据检索、连接源和安全边界。
- Generative Agents 与 Reflexion 都支持 reflection / memory loop，但产品 UI 仍需要暴露证据是否被采用、失败和空结果，避免用户只看结论。

## 实施步骤

1. 在 `ReflectionThreadDetail.vue` 增加 `研究证据采用回执`，基于 `researchAttempts`、唯一 `evidenceRefs`、research links 和 sourceTypes 生成。
2. 回执区分：已采用研究证据、没有新增证据、有失败 trace、提交中仍是旧快照。
3. 更新 `tools/verify-reflection-research-e2e.mjs`，断言 evidence refs、research link、来源和边界文案。
4. 更新 `docs/features/memory_system.md` 与 `docs/features/index.md` 的简短说明。
5. 验证：`node --check`、目标 E2E 脚本、`npm start` 首次成功编译、`npm run verify:reflection-research:e2e`、scoped `git diff --check`。
