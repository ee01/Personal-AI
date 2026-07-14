# Prompt Config 用户上下文注入草稿边界改进计划

## 目标功能

- 随机选中功能：`用户上下文注入`
- 所属能力：Prompt Config
- 主文档：`docs/features/custom_prompts.md`

## 改进计划

1. 核对 `AGENT.md`、`docs/progressing/to-verify.md`、自动化记忆和 Reminders，确认本轮不接续未完成项。
2. 对比当前文档、`prompt-config` 实现和验证脚本，找出一个不需要用户决策的 UX / 边界缺口。
3. 参考业内产品与论文，确认长期偏好/用户画像应强调可关闭、可检查、可修订、草稿与真实生效状态分离。
4. 实现 Prompt Config 用户上下文注入草稿边界：
   - 总开关未保存变更时显示待保存回执。
   - 用户上下文页签回执区分当前页面预览与真实已生效基线。
   - helper 文案支持草稿注入状态，避免把未保存暂停误读成真实运行时已暂停。
5. 更新 `docs/features/custom_prompts.md` 和 `docs/features/index.md` 的简要说明。
6. 运行 `verify:custom-prompts`、`npm start` 首次编译、`verify:custom-prompts:e2e` 和 scoped `git diff --check`。

## 非目标

- 不改变真实 prompt 注入逻辑。
- 不改变保存、融合画像、memory-service 备份或敏感提示门禁。
- 不实现单条用户上下文开关。
