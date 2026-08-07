# Prompt Config 用户上下文来源待保存回执计划

## 目标功能

- 索引条目：`用户上下文注入`
- 所属能力：Prompt Config
- 主文档：`docs/features/custom_prompts.md`

## 当前发现

- `docs/progressing/to-verify.md` 暂无待接续事项；本轮从 `docs/index.md` 随机抽样后选中 `用户上下文注入`，并避开今天已覆盖的 Project Dashboard、Storyline、Action Queue、User Profile、Skill Foundry、Notification、Digest Queue 等精确目标。
- 主文档已基本覆盖真实行为：用户上下文会按消息 / 项目范围裁剪，和自定义提示词一样以低优先级 `user_context` 数据块注入；配置页已有草稿 / 已生效基线、范围依据、注入回执、复制审计、敏感信息和保存阻塞回执。
- 代码中 `renderInjectionControl()` 的“用户上下文”来源开关会立即改变当前页面预览，但开关区本身缺少一个就地待保存回执。用户如果刚关闭或重新开启来源，可能把当前预览状态误读成真实分析已经改用这个来源状态。
- `tools/verify-custom-prompts.ts` 覆盖注入与 helper；`tools/verify-custom-prompts-e2e.mjs` 覆盖 Prompt Config 页面、范围切换、来源暂停、复制和安全门禁，是本轮最可靠的验证入口。

## Reminder 输入

EventKit 找到本机 `Personal AI` Reminders 列表，合计 4 条，未完成 0 条。全部都是已完成的 Doubao / Notification / 测试历史反馈，和 Prompt Config、用户上下文注入、来源开关、保存影响或上下文敏感提示无关。本轮不纳入 Reminder，也不标记任何 Reminder。

## 外部参考

- OpenAI ChatGPT Memory / Custom Instructions：用户应能管理、关闭、删除或临时绕过长期记忆和指令。
- Anthropic Claude Memory / Projects / Claude Code memory：长期上下文需要可查看、可编辑、可禁用，并明确它是上下文而非强制安全边界。
- LaMP 个性化研究：个性化收益来自按任务检索相关 profile/context，而不是把完整 profile 无差别塞进每次 prompt。
- Promptware / memory poisoning 研究：可持久化上下文必须保持低优先级、可审计和可恢复，尤其要避免用户误把污染或暂停状态当成真实运行状态。

## 改进计划

1. 在 `src/modals/prompt-config.tsx` 增加用户上下文来源开关的待保存回执，只有当该开关相对已生效基线发生变化时显示。
2. 回执区分“暂停待保存”和“开启待保存”，说明当前页面预览已经按草稿开关重算，但真实消息 / 项目 / 会议 / 文档分析仍读取已生效基线，保存后才会写入本机并尝试备份到记忆服务。
3. 回执展示当前范围下用户上下文信号数量，说明这只是当前页面预览，不会保存配置、触发真实分析、融合画像或写入记忆服务。
4. 更新 `tools/verify-custom-prompts-e2e.mjs`，覆盖关闭和重新开启“用户上下文”来源后的待保存回执。
5. 更新 `docs/features/custom_prompts.md` 和 `docs/index.md` 的简短描述。
6. 验证：`node --check tools/verify-custom-prompts-e2e.mjs`、`npm run verify:custom-prompts`、`npm start -- --progress` 首次成功编译、`npm run verify:custom-prompts:e2e`、scoped `git diff --check`。

## 边界

- 不改 `buildUserContextPreferenceSection()`、真实 `agentThinking` prompt 注入或清洗算法。
- 不改 storage schema、memory-service profile item 写入、融合画像、风险提示或敏感字段检测语义。
- 不处理 Reminder，因为本轮没有相关未完成条目。
- 保持 edits scoped to Prompt Config source / verifier / docs / planning / automation memory。

## 状态

- [x] 读取 AGENT、功能索引、自动化记忆、历史计划和 to-verify
- [x] 随机选中目标功能并检查 Reminder
- [x] 检查主文档、实现代码和现有验证
- [x] 完成外部产品 / 论文扫描
- [x] 实现待保存回执
- [x] 更新验证脚本和文档
- [x] 运行完整验证并更新自动化记忆
