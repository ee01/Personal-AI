# 用户画像导出失败回执计划

## 目标

随机功能: `用户画像导出`（User Profile / `docs/features/user_profile_system.md`）。

用户画像导出已经有导出前检查、pending 回执、全状态分页、manifest 指纹和成功回执。当前剩余缺口是失败态只显示通用 status：用户看不出本次是否生成了新 JSON、是否已请求浏览器下载、是否影响旧成功结果，或者是否对 Memory Service 产生副作用。

## 外部参照

- OpenAI ChatGPT 数据导出把“请求导出”和“下载导出”拆开，下载链接有到达/过期/重新请求语义。
- Claude memory import 把迁移表达成用户复制/导入的明确动作，不等同于自动恢复或跨平台同步。
- Google Takeout 和数据可迁移讨论都强调本地副本、结构化可读、用户控制和边界。
- Portable Agent Memory 论文强调 memory transfer 需要 provenance、完整性验证、权限边界和防注入 framing；即使是基础 JSON 导出，也应明确 artifact 是否真的生成。

## 实施步骤

1. 在 `UserProfilePage.vue` 增加导出失败回执 builder。
2. `EXPORT_USER_PROFILE` 返回失败或抛异常时设置 warning receipt，并保留 status error。
3. 更新 `tools/verify-user-profile-export-e2e.mjs` 中 `export-failure` 阶段，断言失败回执存在而不是 detached。
4. 更新 `docs/features/user_profile_system.md` 和 `docs/index.md` 的导出描述。
5. 运行目标语法检查、`npm start` 首次成功编译、目标 E2E 和 scoped `git diff --check`。

## 非目标

- 不修改 `EXPORT_USER_PROFILE` 后端/消息处理契约。
- 不修改导出 JSON schema、manifest、pagination、profileAudit 或诊断 warning。
- 不新增恢复、导入、删除、同步、外发能力。
