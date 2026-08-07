# 多用户隔离身份恢复回执计划

## 目标

本轮随机功能：`多用户隔离`，source of truth 是 `docs/memory_system.md`。

## 外部参考信号

- ChatGPT Memory 与 Claude Memory 都把记忆控制、查看和关闭入口放在用户可见路径里，而不是只依赖后台状态。
- Notion Enterprise Search 强调查询时权限检查和 workspace 隔离。
- 近期 governed shared memory / local-first memory 研究强调 persistent memory 需要 scope enforcement、provenance、stale-state visibility 和恢复路径。

## 需要改进的点

当前 Memory Exploring 侧栏已经显示当前 `X-User-Id`、per-user SQLite 路径和 default fallback 边界；但当身份丢失或服务端只返回 default fallback 时，用户只能看到“写入会被拦截”，不知道这张身份状态是什么时候读取的、如何重新检查、下一步该去哪里恢复登录/设置。

## 实现步骤

1. 在 Memory Exploring 身份卡补充身份快照时间和只读来源说明。
2. 在身份卡补充 `刷新身份快照` 与 `打开设置` 动作。
3. default fallback / local inferred 状态继续保持写入、导入、恢复被拦截的边界，不改后端隔离模型。
4. 更新 `tools/verify-memory-user-identity-e2e.mjs`，覆盖快照时间、刷新按钮和打开设置动作。
5. 更新 `docs/memory_system.md` 的多用户隔离说明。
6. 运行 targeted verify、`npm start` 首次编译、E2E 和 scoped `git diff --check`。
