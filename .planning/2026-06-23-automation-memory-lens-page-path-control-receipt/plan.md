# Memory Lens 页面路径控制回执计划

目标功能：`站点静默/屏蔽/白名单`（Memory Lens / `docs/features/memory_lens.md`）。

本轮随机抽样先命中 Prompt Config、Doubao Bridge、OpenClaw 和 Rehearsal 的近期覆盖项，避重后锁定 Memory Lens 的站点控制子功能。当前代码和文档已经覆盖站点静默、整站屏蔽、白名单、冲突消解、Options 状态回执和主动划词不受被动控制影响；发现的缺口集中在页面路径屏蔽的即时反馈。

## 业内参考

- Chrome extension permission guidance强调敏感能力应和用户动作、权限说明绑定，避免用户把扩展访问理解成全局无限制访问。
- Microsoft Edge Copilot page context policy把页面内容访问做成动态可刷新的 per-profile 控制，支持当前站点控制变更立即影响已打开页面。
- SOUPS 2021 浏览器扩展权限研究指出用户对扩展权限和数据访问能力理解不足，因此控制后的结果文案必须说明真实影响范围。
- Contextual Integrity assistant 研究强调 AI 助手的信息流要符合当前上下文，特别是区分本地提示、信息共享和外部发送。

## 改进计划

1. 检查 Memory Lens 站点控制文档、content script、Options 管理页和现有验证脚本。
2. 补齐 `此页面永久不提示` 的 toast：只影响该路径下被动 Lens、页面召回和整页/视觉入库候选；不影响同域其他路径；主动划词仍可用；不会删除、同步或外发已有记忆。
3. 补齐 Options 页面路径屏蔽/恢复/清空消息，避免用户把恢复理解成写入、删除或外部同步。
4. 更新 `docs/features/memory_lens.md`，保持文档和代码一致。
5. 扩展源码 helper 和 Memory Lens E2E 断言，覆盖页面路径屏蔽与恢复回执。
6. 验证：`npm run verify:webpage-memory-detection`、`npm start` 首次成功编译、`npm run verify:webpage-memory-detection:e2e`、scoped `git diff --check`。
