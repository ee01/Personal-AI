# Doubao Bridge Integration Plan

## Goal

让服务端 `Memory Service` 产生的记忆，在不暴露 Doubao 登录态给服务端的前提下，被本机 `Doubao Bridge` 安全消费，并分别注入：

- Doubao 长期记忆
- 真实使用中的“手机版对话”线程
- 未来可扩展的提醒通道

这个方案从一开始就按 provider-neutral 设计，Doubao 只是第一个实现。

## Core Architecture

### Source of truth

- `Memory Service` 仍然是唯一真源。
- `Doubao Bridge` 只是本机消费端，不保存业务真值。
- Extension 只负责入口、状态、绑定和手动触发，不直接持有 Doubao 凭据。

### Three components

1. `Memory Service`
   - 维护消息、画像、待办、反思、结论。
   - 把内部数据渲染成 provider-facing `context package`。
   - 持久化 provider bindings 与 sync jobs。

2. `Doubao Bridge`
   - 运行在用户机器上。
   - 使用 Playwright persistent profile 保存 Doubao 登录态。
   - 负责桥接 Doubao 会话、注入消息、同步状态。

3. Extension
   - 在 [src/popup.tsx](/Users/Esone/git/personal-ai/src/popup.tsx) 提供 Doubao 入口。
   - 打开独立的 Doubao Bridge 控制页。
   - 通过 memory-service provider API 渲染实际内容，再调用 localhost bridge。

## Thread Model

### `memory_sync_thread`

- 专门用于长期记忆沉淀。
- 只承接稳定信息：
  - `persona_core`
  - `voice_mode`
- 桥接器长期复用同一条 Doubao conversation。
- 不混入用户真实聊天，避免污染手机版会话。

### `mobile_context_thread`

- 绑定到用户真实使用的“手机版对话”线程。
- 只承接短期上下文：
  - `active_focus_digest`
  - `reminder_digest`
  - `query_answer_card`
  - `project_brief`（后续）
- 不要求豆包长期记住这些内容。

### Why split threads

用户实测表明：

- 明确“请记住”的内容会跨会话、跨设备共享。
- 普通会话上下文不跨会话。

因此：

- 长期稳定信息必须走 `memory_sync_thread`
- 近期重点、项目进展、查询结果必须打到真正的 `mobile_context_thread`

## Memory Products

### Stable memory

- `persona_core`
  - 职业角色
  - 长期偏好
  - 稳定约束
  - 长期目标

- `voice_mode`
  - 回答长度偏好
  - 语气偏好
  - 是否主动提醒
  - 通勤/语音聊天风格

### Rolling / ephemeral context

- `active_focus_digest`
  - 最近 7-14 天重点关注事项
  - 当前重点项目
  - 最近显著信号

- `reminder_digest`
  - 待提醒事项
  - pending notifications
  - pending actions

- `query_answer_card`
  - 针对某个问题的临时检索结果
  - 附带证据来源

## Transport Mapping

| Product | Provider transport | Target binding |
| --- | --- | --- |
| `persona_core` | `native_memory` | `memory_sync_thread` |
| `voice_mode` | `native_memory` | `memory_sync_thread` |
| `active_focus_digest` | `session_context` | `mobile_context_thread` |
| `reminder_digest` | `reminder` or `session_context` fallback | `reminder_channel` / `mobile_context_thread` |
| `query_answer_card` | `session_context` | `mobile_context_thread` |

## Service-side API

### Provider capabilities

- `GET /api/v1/providers/:provider/capabilities`

返回：

- supported transports
- supported binding types
- supported scenarios
- sync model

### Provider bindings

- `GET /api/v1/providers/:provider/bindings`
- `PUT /api/v1/providers/:provider/bindings/:bindingType`

绑定记录保存：

- provider
- binding type
- external thread id
- title
- device id
- metadata
- last sync status

### Context package rendering

- `POST /api/v1/providers/context-packages/render`

请求字段：

- `provider`
- `scenario`
- `query?`
- `tokenBudget?`
- `freshnessWindowDays?`
- `includeKinds?`
- `deviceContext?`
- `bindingType?`
- `createSyncJob?`

返回：

- rendered packages
- known bindings
- optional sync job

### Sync jobs

- `GET /api/v1/providers/:provider/sync-jobs`
- `GET /api/v1/providers/:provider/sync-jobs/:id`
- `POST /api/v1/providers/:provider/sync-jobs/:id/report`

用于记录：

- 渲染请求
- provider sync 目标
- result
- provider message id
- external thread id
- error

## Local Doubao Bridge API

Bridge 默认地址：

- `http://127.0.0.1:46321`

### Health and pairing

- `GET /health`
- `POST /pair`
- `GET /auth/status`
- `POST /auth/open-login`

Pairing token 只存在本机：

- extension 通过 `/pair` 获取 token
- 后续调用带 `x-bridge-token`

### Thread binding

- `GET /threads`
- `POST /threads/create-memory-sync`
- `POST /threads/bind`

Bridge 内部 binding type：

- `memory_sync`
- `mobile_context`

服务端 provider binding type 与其映射如下：

- `memory_sync` -> `memory_sync_thread`
- `mobile_context` -> `mobile_context_thread`

### Sync operations

- `POST /sync/stable-memory`
- `POST /sync/mobile-briefing`
- `POST /inject/query`
- `POST /reminders/sync`

当前 bridge API 是 Doubao-optimized contract，不是 memory-service contract。
由 extension 负责把 provider package 转成 bridge payload。

## End-user Packaging

最终用户不应该进入源码目录执行命令。

推荐交付物：

- `Doubao-Bridge-Installer.pkg`
- 安装后的目录：`/Applications/Doubao Bridge`
- 前台脚本：`Start Doubao Bridge.command`
- 后台安装脚本：`Install Background Sync.command`
- 停止脚本：`Stop Doubao Bridge.command`
- 卸载后台常驻脚本：`Uninstall Background Sync.command`
- 日志脚本：`Open Doubao Bridge Logs.command`
- GitHub Releases 下载页：<https://github.com/ee01/personal-ai/releases/latest>

开发者打包命令：

- `npm --prefix doubao-bridge run package:macos`
- `npm --prefix doubao-bridge run deploy`

`deploy` 优先读取 `doubao-bridge/.env`，其次使用 `gh auth token` / `gh release`。可配置：

- `GITHUB_TOKEN` 或 `GH_TOKEN`
- `GITHUB_REPOSITORY`（如果无法从 `origin` 推断）
- 可选的 `GITHUB_RELEASE_TAG`、`GITHUB_RELEASE_TITLE`、`GITHUB_RELEASE_NOTES`
- 可选的 `APPLE_INSTALLER_SIGNING_IDENTITY`、`APPLE_NOTARY_KEYCHAIN_PROFILE`

这样用户得到的是“可安装”的 bridge pkg，而不是源码仓库。

## Auth Model

默认方案：

- bridge 使用自己的 Playwright persistent profile
- 首次登录由 bridge 打开受控浏览器窗口
- 用户在窗口中手动登录豆包
- 登录态保存在本地 bridge profile 目录

这意味着：

- 服务端拿不到 Doubao auth
- extension 不需要收集用户名和密码
- 不依赖用户主浏览器当前 cookie

## Runtime Model

### Implemented now

- bridge 本机常驻
- bridge 可选直接轮询 memory-service provider API
- popup 提供 Doubao 入口
- bridge 面板支持：
  - pairing
  - open login
  - create/bind memory sync thread
  - bind current Doubao tab as mobile context thread
  - render provider packages from memory-service
  - send them to bridge
  - report sync job result back to memory-service
- bridge daemon 在配置了 `MEMORY_SERVICE_BASE_URL` 后可自动执行：
  - stable memory sync
  - mobile briefing sync
  - reminder sync

### Next step

- 用 provider sync job 的 dedupe / 调度策略进一步避免高频重复渲染
- 无需打开 extension 面板也能基于 richer policy 自动同步
- reminder 通道再升级为真正的 Doubao reminder API 或系统提醒

## UI Entry

入口位于 [src/popup.tsx](/Users/Esone/git/personal-ai/src/popup.tsx)。

当前行为：

- 顶部 help/share 旁新增 Doubao icon
- 点击打开 `doubao-bridge.html`
- 控制页位于：
  - [src/modals/doubao-bridge.tsx](/Users/Esone/git/personal-ai/src/modals/doubao-bridge.tsx)
  - [src/services/DoubaoBridgeClient.ts](/Users/Esone/git/personal-ai/src/services/DoubaoBridgeClient.ts)

## Test Chain

### Extension

- `npm run build`

验证：

- popup 中能打开 Doubao Bridge 页面
- 构建产物包含 `doubao-bridge.html` 与 `doubao-bridge.js`

### Memory service

- `npm --prefix memory-service run build`
- `npm --prefix memory-service test`

重点覆盖：

- provider capabilities
- provider binding upsert/list
- context package render
- sync job report

### Local bridge

- `npm --prefix doubao-bridge run build`
- `npm --prefix doubao-bridge test`

重点覆盖：

- pairing flow
- auth-protected endpoints
- dry-run sync endpoints

### Manual smoke test

1. 启动 `memory-service`
2. 启动 `doubao-bridge`
前台模式可直接双击 `Start Doubao Bridge.command`
后台模式可直接双击 `Install Background Sync.command`
3. 打开 extension popup 中的 Doubao Bridge 页面
4. 点击“重新配对”
5. 点击“打开登录窗口”，完成 Doubao 登录
6. 创建长期记忆线程
7. 在当前标签页打开真实 Doubao 会话并绑定为手机版对话
8. 点击“同步 persona_core / voice_mode”
9. 点击“同步今日重点到手机版对话”
10. 点击“查记忆并注入当前会话”
11. 检查 memory-service 的 sync job 已被成功回写

## Files Added in This Slice

- [docs/features/doubao_bridge_integration.md](/Users/Esone/git/personal-ai/docs/features/doubao_bridge_integration.md)
- [doubao-bridge/src/server.ts](/Users/Esone/git/personal-ai/doubao-bridge/src/server.ts)
- [doubao-bridge/src/bridgeService.ts](/Users/Esone/git/personal-ai/doubao-bridge/src/bridgeService.ts)
- [memory-service/src/routes/providers.ts](/Users/Esone/git/personal-ai/memory-service/src/routes/providers.ts)
- [memory-service/src/core/ProviderContextService.ts](/Users/Esone/git/personal-ai/memory-service/src/core/ProviderContextService.ts)
- [memory-service/src/repositories/ProviderRepository.ts](/Users/Esone/git/personal-ai/memory-service/src/repositories/ProviderRepository.ts)
- [src/services/DoubaoBridgeClient.ts](/Users/Esone/git/personal-ai/src/services/DoubaoBridgeClient.ts)
- [src/modals/doubao-bridge.tsx](/Users/Esone/git/personal-ai/src/modals/doubao-bridge.tsx)
