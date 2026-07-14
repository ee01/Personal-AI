# Findings

- `docs/progressing/to-verify.md` 为空，本轮从 `docs/features/index.md` 抽取并避开近期精确覆盖项后，选定 Memory Service 的 `多用户隔离`。
- Reminders：AppleScript 未列出 `Personal AI`；EventKit 成功读取该列表，4 条均为已完成历史 Doubao / Notification / test 反馈，没有身份隔离、default fallback、错用户写入或备份恢复相关 open item。
- 外部参考：OpenAI Memory Sources 强调可见来源和用户控制；Microsoft / AWS 多租户 RAG 指出授权必须在检索或请求路径内执行且 fail-closed；SuperLocalMemory 与 memory fabric 研究都支持本地/按用户隔离、来源可审计和跨用户传播防护。
- 代码问题：`buildApp()` 当前先注册 auth middleware 再注册 write guard。缺失 `X-User-Id` 的写请求虽然最终 403，但 auth 已经 `ucm.getContext('default')`，会提前创建/迁移 default 用户上下文。

