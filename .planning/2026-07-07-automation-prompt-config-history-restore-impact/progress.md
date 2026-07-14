# Prompt Config 版本恢复影响回执进度

## 已完成

- 随机选中 `自定义消息分析提示词` / Prompt Config。
- 用 EventKit 检查 `Personal AI` Reminders：4 条全部已完成，没有相关未完成反馈，因此没有标记新完成项。
- 外部扫描并形成方向：custom instructions / project instructions / prompt injection 风险都支持在长期偏好恢复前显示范围、未来影响和风险状态。
- `src/modals/prompt-config.tsx`：版本历史列表新增 `history-restore-impact`，复用 `buildPreferenceChangeImpact(lastPersistedConfig, entry.config, { userContextScope: previewScope })`，显示恢复后保存的影响和恢复按钮的无写入边界。
- `tools/verify-custom-prompts.ts`：补源码级断言。
- `tools/verify-custom-prompts-e2e.mjs`：补版本历史恢复前影响的页面断言。
- `docs/features/custom_prompts.md` 和 `docs/features/index.md`：同步当前用户可见行为。

## 验证

- `node --check tools/verify-custom-prompts-e2e.mjs` 通过。
- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-custom-prompts.ts` 通过。
- `npm start -- --progress` 首次成功编译通过，用时约 14202 ms，并已停止 watcher。
- `npm run verify:custom-prompts:e2e` 通过。
- `git diff --check -- src/modals/prompt-config.tsx tools/verify-custom-prompts.ts tools/verify-custom-prompts-e2e.mjs docs/features/custom_prompts.md docs/features/index.md` 通过。
- 进程检查未发现仍存活的本轮 webpack / Prompt Config E2E / Playwright / Chromium 进程。

## 边界

- 本轮是 presentation-only / verifier / docs 更新。
- 没有改变 Prompt Config 存储结构、memory-service 备份、风险检测规则、真实分析注入、融合用户画像、复制预览或版本历史合并策略。

