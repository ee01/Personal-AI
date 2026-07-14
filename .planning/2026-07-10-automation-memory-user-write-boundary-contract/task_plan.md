# 多用户隔离写入边界契约

## 目标

把 Memory Service 多用户隔离里的 default fallback 从“前端根据字段猜测”收敛为 `/stats.user.writeBoundary` 的稳定契约，并让 Memory Exploring / Today Pilot 首屏直接展示写入、导入、恢复是否被拦截。

## 步骤

1. 检查 `AGENT.md`、`docs/progressing/to-verify.md`、自动化记忆、Reminder 和现有身份测试。
2. 参考业内 memory / enterprise search / governed memory 做一个最小 UX 改进判断。
3. 在 `/api/v1/stats` 增加 `writeBoundary` 机器可读契约。
4. 前端身份卡优先展示服务端契约，不改变实际写入权限。
5. 更新 targeted API/E2E、feature docs 和索引。
6. 运行 memory-service targeted test、webpack dev compile、身份 E2E、i18n 和 scoped diff check。
