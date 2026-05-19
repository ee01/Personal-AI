# Desktop App Integration

_最后更新: 2026-05-19_

## Goal

让服务端 `Memory Service` 产生的记忆，在不暴露登录态给服务端的前提下，被本机 `Desktop App` 安全消费，并形成当前已经落地的双向记忆流：

- Doubao 输出线程（长期记忆与移动上下文）
- Doubao / ChatGPT explorer 输入链路
- scope/source 感知的回写、预览、撤回与本地缓存管理

这个方案从一开始就按 provider-neutral 设计。Doubao 是当前主要输出渠道之一，同时也是输入来源之一；ChatGPT 已作为独立 explorer 输入来源接入。

## Core Architecture

### Source of truth

- `Memory Service` 仍然是唯一真源。
- `Desktop App` 只是本机消费端，不保存业务真值。
- Extension 只负责入口、状态、绑定和手动触发，不直接持有 Doubao 凭据。

### Three components

1. `Memory Service`

   - 维护消息、画像、待办、反思、结论。
   - 把内部数据渲染成 provider-facing `context package`。
   - 持久化 provider bindings 与 sync jobs。

2. `Desktop App`

   - 运行在用户机器上。
   - 使用受控浏览器 profile 保存 Doubao 登录态，并为 ChatGPT explorer 使用独立会话上下文。
   - 负责 Doubao 输出线程、explorer 输入采集、本地缓存、预览、提炼回写、撤回与状态同步。

3. Extension
   - 在 [src/popup.tsx](/Users/Esone/git/personal-ai/src/popup.tsx) 提供 Desktop App 入口。
   - Extension 页面只负责安装引导、状态摘要和打开 app；完整配置在 `Personal AI.app` 内完成。

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

| Product               | Provider transport                       | Target binding                               |
| --------------------- | ---------------------------------------- | -------------------------------------------- |
| `persona_core`        | `native_memory`                          | `memory_sync_thread`                         |
| `voice_mode`          | `native_memory`                          | `memory_sync_thread`                         |
| `active_focus_digest` | `session_context`                        | `mobile_context_thread`                      |
| `reminder_digest`     | `reminder` or `session_context` fallback | `reminder_channel` / `mobile_context_thread` |
| `query_answer_card`   | `session_context`                        | `mobile_context_thread`                      |

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

## Local Desktop App API

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

当前本机 API 既包含输出侧 bridge contract，也包含 explorer contract。extension 只承担入口和状态页职责，完整配置与 explorer 操作在 Desktop App 内完成。

### Explorer operations

- `GET /explorer/status`
- `POST /explorer/auth/open-login`
- `POST /explorer/run-now`
- `POST /explorer/reset-cache`
- `POST /explorer/revoke-ingested-memory`
- `GET /explorer/preview`

Explorer 相关行为：

- 原始消息先写本机 explorer cache
- 预览会返回 raw messages、cleaned preview、artifacts、cursor
- `reset-cache` 只清本地缓存与 cursor
- `revoke-ingested-memory` 只删除 `Memory Service` 中按 source/scope 写入的记忆，不删除远端聊天记录
- 用户在来源卡片上改完抓取范围、默认范围或浏览器传输方式后直接点击手动抓取时，Desktop App 会先保存该来源的待生效设置，再按最新设置执行抓取

## End-user Packaging

最终用户不应该进入源码目录执行命令。

推荐交付物：

- `/Applications/Personal AI.app`
- `Personal-AI-Desktop-<version>-Installer.pkg`
- GitHub Releases 下载页：<https://github.com/ee01/personal-ai/releases/latest>

开发者打包命令：

- `npm run build:desktop`
- `npm run deploy:desktop`

`deploy` 优先读取 `desktop-app/.env`，其次使用 `gh auth token` / `gh release`。可配置：

- `GITHUB_TOKEN` 或 `GH_TOKEN`
- `GITHUB_REPOSITORY`（如果无法从 `origin` 推断）
- 可选的 `GITHUB_RELEASE_TAG`、`GITHUB_RELEASE_TITLE`、`GITHUB_RELEASE_NOTES`
- 可选的 `APPLE_INSTALLER_SIGNING_IDENTITY`、`APPLE_NOTARY_KEYCHAIN_PROFILE`

安装后的体验：

- `.pkg` 会把 `Personal AI.app` 安装到 `Applications`
- app 首次启动后会在后台继续运行
- 关闭窗口后仍继续同步
- 只有在 app 中点击“停止后台并退出”才会真正停止

## Auth Model

默认方案：

- bridge 使用自己的 Playwright persistent profile
- 首次登录由 bridge 打开受控浏览器窗口
- 用户在窗口中手动登录豆包
- 登录态保存在本地 bridge profile 目录

可选方案：

- 用户可以选择“使用我日常浏览器的登录状态”
- app 会通过 `webpage-mcp` 操作明确打开的 `doubao.com` 标签页
- 如果连接器不可用，输出广播与输入抓取会短时间回退到桌面端自带 Chromium，并在 UI 中显示回退原因

这意味着：

- 服务端拿不到 Doubao auth
- extension 不需要收集用户名和密码
- 默认不依赖用户主浏览器 cookie；日常浏览器模式也不会把 cookie 导出到服务端

## Runtime Model

### Implemented now

- `Personal AI.app` 作为主配置中心
- extension 中的 `desktop-app.html` 退化为安装引导与状态摘要
- bridge 本机常驻并固定监听 `http://127.0.0.1:46321`
- app 内支持：
  - 配置 Memory Service
  - open login
  - create/bind memory sync thread
  - 自动绑定“手机版对话”
  - 手动触发 stable memory / briefing / reminder
  - 管理 Doubao / ChatGPT explorer 输入来源
  - 查看 explorer 缓存、预览、撤回已入库记忆
- bridge 在满足前置条件后可自动执行：
  - stable memory sync
  - mobile briefing sync
  - todo / notice sync
  - Doubao / ChatGPT explorer 定时抓取
- app 内会展示最近同步流水，用户可以直接看到每次手动 / 自动推送的结果、耗时和跳过 / 失败原因

当前可靠性边界：

- `mobile_context` 未绑定时，非 dry-run 的近期重点、待办、通知、查询注入不会发送到当前豆包页，避免误投递。
- 豆包安全验证、发送失败或消息不可见时，手动推送会返回失败，后台同步不会把失败任务当成已完成冷却。
- todo / notice 投递失败会回写 delivery failed，避免 Memory Service 误以为用户已经收到。
- 日常浏览器模式下，登录按钮会显示“打开 Chrome 豆包”，避免用户误以为仍在使用内置登录窗口。
- 同步审计会记录每次推送实际使用的传输来源：日常 Chrome（webpage-mcp）或内置 Chromium；如果日常浏览器模式临时回退，也会保留回退原因。
- 如果 Memory Service、登录态等前置条件暂时未满足，Explorer 来源开关只会被临时置为不可点击并显示原因；不会把已经保存的“自动读取豆包 / ChatGPT”配置静默改成关闭。

## Industry References And Product Direction

业内相似能力给出的方向比较一致：

- ChatGPT memory 把“用户显式保存的记忆”和“从历史对话引用的上下文”分开，并强调用户可查看、删除、关闭与临时聊天控制：<https://help.openai.com/en/articles/8590148-memory-in-chatgpt>
- Claude memory 把全局记忆、项目记忆和可迁移/可重置的控制面分开，说明项目级隔离对工作场景很重要：<https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context>
- Claude API memory tool 与 Mem0 都强调“client-side / managed memory layer”模式，和本功能的“服务端真源 + 本机桥接登录态”方向一致：<https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool>、<https://docs.mem0.ai/overview>
- MemGPT 把长期记忆看成分层上下文管理问题；2026 年综述进一步把 agent memory 归纳成 write-manage-read loop，并特别点出写入过滤、矛盾处理、延迟预算、隐私治理和 learned forgetting：<https://arxiv.org/abs/2310.08560>、<https://arxiv.org/abs/2603.07670>

对 Personal AI 的建设性结论：

- 保持双线程模型，不把长期画像、近期重点、待办、通知混成一条普通对话。
- Explorer 侧继续强化可见、可撤回、可按 scope 清理的记忆列表，而不是只展示“抓取成功”。
- 同步链路要优先保证可验证投递，不要为了顺滑体验吞掉失败；在发生 transport fallback 时也要让用户看见实际写入通道。
- 后续适合补一个“记忆审计 / 版本历史”视图，让用户能看到哪些外部对话材料进入了 Memory Service，以及哪些推送已经送达豆包。

### Next step

- 把当前本机内存中的最近同步流水升级为可查询的长期审计历史。
- 对 sent / delivered / failed / skipped 做跨输出渠道的一致筛选。
- 如果 Doubao 暴露稳定 reminder API，再把待办通道从随手记文本升级为原生提醒。

## UI Entry

入口位于 [src/popup.tsx](/Users/Esone/git/personal-ai/src/popup.tsx)。

当前行为：

- 顶部 help/share 旁新增 Desktop App icon
- 点击打开 `desktop-app.html`
- 该页面只负责：
  - 下载 app
  - 检测本机 bridge 状态
  - 展示只读 checklist
  - 引导用户去 `Personal AI.app` 完成真实配置
- 页面实现位于：
  - [src/modals/desktop-app.tsx](/Users/Esone/git/personal-ai/src/modals/desktop-app.tsx)
  - [src/services/DesktopAppClient.ts](/Users/Esone/git/personal-ai/src/services/DesktopAppClient.ts)

## Test Chain

### Extension

- `npm run build`

验证：

- popup 中能打开 Desktop App 页面
- 构建产物包含 `desktop-app.html` 与 `desktop-app.js`

### Memory service

- `npm --prefix memory-service run build`
- `npm --prefix memory-service test`

重点覆盖：

- provider capabilities
- provider binding upsert/list
- context package render
- sync job report

### Local bridge

- `npm --prefix desktop-app run build`
- `npm --prefix desktop-app test`

重点覆盖：

- pairing flow
- auth-protected endpoints
- dry-run sync endpoints
- mobile-context 未绑定防误投递
- todo / notice 失败投递回报

### Manual smoke test

1. 启动 `memory-service`
2. 启动 `app`
   前台模式可直接双击 `Start Desktop App.command`
   后台模式可直接双击 `Install Background Sync.command`
3. 打开 extension popup 中的 Desktop App 页面
4. 点击“重新配对”
5. 根据广播方式点击“打开登录窗口”或“打开 Chrome 豆包”，完成 Doubao 登录
6. 创建长期记忆线程
7. 在当前标签页打开真实 Doubao 会话并绑定为手机版对话
8. 点击“现在推一次 persona”
9. 点击“现在推一次近期记忆重点”
10. 点击“现在推一次待办 / 通知”
11. 检查 memory-service 的 sync job 已被成功回写

## Primary Files

- [docs/features/doubao_bridge_integration.md](/Users/Esone/git/personal-ai/docs/features/doubao_bridge_integration.md)
- [desktop-app/src/server.ts](/Users/Esone/git/personal-ai/desktop-app/src/server.ts)
- [desktop-app/src/bridgeService.ts](/Users/Esone/git/personal-ai/desktop-app/src/bridgeService.ts)
- [desktop-app/src/syncManager.ts](/Users/Esone/git/personal-ai/desktop-app/src/syncManager.ts)
- [desktop-app/app/index.html](/Users/Esone/git/personal-ai/desktop-app/app/index.html)
- [desktop-app/app/renderer.js](/Users/Esone/git/personal-ai/desktop-app/app/renderer.js)
- [memory-service/src/routes/providers.ts](/Users/Esone/git/personal-ai/memory-service/src/routes/providers.ts)
- [memory-service/src/core/ProviderContextService.ts](/Users/Esone/git/personal-ai/memory-service/src/core/ProviderContextService.ts)
- [memory-service/src/repositories/ProviderRepository.ts](/Users/Esone/git/personal-ai/memory-service/src/repositories/ProviderRepository.ts)
- [src/services/DesktopAppClient.ts](/Users/Esone/git/personal-ai/src/services/DesktopAppClient.ts)
- [src/modals/desktop-app.tsx](/Users/Esone/git/personal-ai/src/modals/desktop-app.tsx)
