# User Profile 星级校准边界

## 目标功能

- 随机命中: `画像快速增强/降低影响` / User Profile
- 功能文档: `docs/features/user_profile_system.md`
- 主要页面: `src/modals/components/UserProfilePage.vue`
- 验证脚本: `tools/verify-user-profile-system.ts`, `tools/verify-user-profile-export-e2e.mjs`

## 当前结论

- 文档总体跟实现一致: 画像条目以 `active + userConfirmed` 作为进入个性化上下文的门槛，快速设为重点会确认条目，降低影响不会把未确认推断推进个性化。
- 代码已有条目列表和待确认队列里的调权回执，但首屏「当前关注重点」项目/人员/主题星级控件也能直接改权重，却缺少点击前的影响说明。
- 作为用户体验官看，这个入口位置更靠前、更像轻量评分；用户可能不知道点星级会更新 `confidence/salience`，并在未确认条目上同时确认画像。

## 外部参照

- OpenAI ChatGPT Memory FAQ 强调用户可以查看、编辑、删除、降权/优先记忆，并通过 sources 理解个性化来源。
- Gemini Enterprise saved memories 提供查看、更新、删除和关闭引用 saved memories 的路径。
- Claude memory 文档强调个人和组织级 memory settings，说明画像/记忆控制必须保持可见边界。
- Guided Profile Generation 说明自然语言 profile 能提升个性化，但也意味着 profile 条目需要可审计、可校准。
- Response-Aware User Memory Selection 进一步说明不是所有相似记忆都应该进入 prompt；Personal AI 应把调权和进入上下文条件区分清楚。

## 实施计划

1. 在首屏星级控件下方复用画像校准回执语义，显示紧凑的「星级校准」影响说明。
2. 说明分两类:
   - 已确认 active 条目: 星级只改 `confidence/salience`，证据保留，仍按场景进入个性化。
   - 未确认或 pending 条目: 星级会同时确认，确认后才可能进入个性化，证据保留。
3. 不改后端语义，不新增用户决策，不改变 Reminder/导出/排除路径。
4. 扩展 User Profile E2E，覆盖首屏已确认条目和待确认条目的星级影响说明，以及待确认条目点星后确实走 update + confirm。
5. 更新功能文档，保持文档概括而不过度复制 UI 细节。

## 验证计划

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-user-profile-system.ts`
- `npm start` 到首次成功编译后停止
- `node tools/verify-user-profile-export-e2e.mjs`
- `git diff --check -- src/modals/components/UserProfilePage.vue tools/verify-user-profile-export-e2e.mjs docs/features/user_profile_system.md .planning/2026-06-17-automation-user-profile-star-calibration-boundary/plan.md`

## Reminder 状态

本机 Reminders 可读，但没有 `Personal AI` 列表。本次没有 Reminder 条目可纳入或标记完成。
