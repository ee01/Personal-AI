# 用户画像降低影响确认边界

## 背景

- 本轮从 `docs/features/index.md` 随机选中 `画像快速增强/降低影响`。
- `docs/progressing/to-verify.md` 当前为空。
- 本机 Reminders 可读，但没有 `Personal AI` 列表，因此没有可纳入或可完成的 Reminder 条目。
- 工作区已有大量无关改动，本轮只触碰用户画像校准相关文件。

## 外部参照

- ChatGPT、Claude 和 Gemini 的记忆管理都强调用户可查看、编辑、删除或关闭记忆。
- RUMS / Response-Aware User Memory Selection 指出画像进入上下文应看响应效用，而不是只看相似度或存在性。
- MemoryBank / Mem0 一类长期记忆论文强调选择性强化和遗忘；这支持把“降低影响”作为降权信号，而不是确认事实真实性。

## 改进计划

1. 给 `SET_EXPLICIT_IMPORTANCE` 增加 `confirmAfterUpdate` 控制，默认保持旧行为。
2. “设为重点”和星级评分继续确认条目；“降低影响”只更新 `confidence/salience`，不自动确认未确认推断。
3. 更新画像页的就地影响说明和校准回执，明确未确认条目降权后仍不会进入 `USER_CORE`、召回或 provider context。
4. 更新 E2E fixture 断言，证明降低未确认画像不会调用 confirm。
5. 更新 `docs/features/user_profile_system.md`，只记录用户可见边界，不展开过细实现。

## 验证计划

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-user-profile-system.ts`
- `npm start` 等首次成功编译后停止。
- `node tools/verify-user-profile-export-e2e.mjs`
- scoped `git diff --check`
