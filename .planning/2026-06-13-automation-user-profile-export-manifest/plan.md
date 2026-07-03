# 用户画像导出 Manifest 改进计划

## 目标功能

- 随机抽中功能: `用户画像导出`
- 主文档: `docs/features/user_profile_system.md`
- 主要实现: `src/services/UserProfileMessageHandler.ts`、`src/modals/components/UserProfilePage.vue`
- 验证入口: `tools/verify-user-profile-system.ts`、`tools/verify-user-profile-export-e2e.mjs`

## 已确认上下文

- `docs/progressing/to-verify.md` 当前无待继续事项。
- 本机 Reminders 可读，但没有名为 `Personal AI` 的列表，本轮没有可合并或可标记完成的 Reminder item。
- 上一轮 automation 做过 Scheduled Messages / App Script 升级回执，本轮避开该功能。
- 当前 repo 已有大量未提交改动，本轮只扩展用户画像导出相关文件。

## 行业和研究信号

- Claude 已把 memory import/export 作为迁移和备份路径，导出内容需要能被用户拿到本地并带去其他服务。
- ChatGPT 的 memory controls 和 data export 强调用户可查看、修正、删除和导出数据，同时 memory sources 也强调来源解释并非总是完整覆盖。
- 数据可迁移研究把可复用、可转移、降低切换成本作为核心价值；AI personalization 场景里，个人数据越能提升产品质量，越需要清楚的 portability artifact。

## 问题

当前导出 UI 已说明“导出会重新分页拉取全部状态”和诊断 warning，但下载后的 JSON 缺少一个紧凑的 export manifest。用户把文件放到别处后，需要自己推断:

- 这个文件到底覆盖哪些画像状态。
- 是否包含已排除/归档审计项。
- 哪些内容可用于个性化，哪些只是确认前保留。
- 诊断段是否缺失。
- 是否能用一个短 fingerprint 对照 UI 回执和本地文件。

## 改进步骤

1. 在 `EXPORT_USER_PROFILE` 生成的 JSON 中加入 `exportInfo.manifest`。
2. Manifest 保持轻量，包含 scope、状态范围、pagination、warning 数、personalization 规则、restore/import 边界，以及 profile items / user core / audit 的 SHA-256 fingerprint。
3. 前端导出回执展示短 fingerprint，让用户能把页面回执和下载文件对上。
4. 更新用户画像功能文档，说明导出 artifact 自带 manifest/fingerprint，但它仍不是自动恢复或自动同步授权。
5. 扩展 `verify-user-profile-system` 覆盖分页 helper 的 status scope 语义，扩展 E2E 覆盖 manifest 字段和 UI fingerprint。
6. 按 `AGENT.md` 执行 targeted verify、`npm start` 首次成功编译、导出 E2E、`git diff --check`。

## 非目标

- 不实现画像导入/恢复。
- 不改变导出数据范围和分页策略。
- 不改动记忆召回或写入路径，不触发 memory-abilities 回归门。
