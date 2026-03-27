# Doubao Bridge 完整接入方案

## Summary

- 保持 `Memory Service` 为服务端唯一真源；新增一层 provider 发布层，把内部记忆转成对外可消费的 `MemoryProduct` / `ContextPackage`。
- 本机新增 `Doubao Bridge` 常驻程序，默认采用 `Node + Playwright persistent profile + localhost HTTP API`，负责豆包登录态、会话绑定、自动化注入、同步回执。
- 扩展新增两层 UI：
  - `popup` 顶部在 help/share 旁加豆包 icon，作为桥接器状态与快速操作入口。
  - `options` 增加 Doubao Bridge 配置与诊断区，承接本地桥接器地址、配对 token、常驻说明。
- 会话策略固定为“双线程绑定”：
  - `memory_sync_thread` 专门做长期记忆沉淀，长期复用同一 conversation。
  - `mobile_context_thread` 绑定用户实际的“手机版对话”，承接短期 briefing、项目结论、按需查询结果。
- 只把稳定信息写入豆包长期记忆；`最近关注重点项目 / 最近结论 / 待办提醒` 一律视为会话级上下文或提醒，不进长期记忆。

## Key Changes

### 1. Extension UX 与配置

- 在 [popup.tsx](/Users/Esone/git/personal-ai/src/popup.tsx) 的 `header-icons` 区域新增豆包 icon，点击打开新的 `doubao-setup` popup，而不是直接做同步动作。
- `doubao-setup` popup 采用 4 态状态机：
  - `未安装桥接器`
  - `已安装但未连接豆包`
  - `已连接但未绑定会话`
  - `已就绪`
- 已就绪态提供这些操作：
  - `连接/重连豆包`
  - `创建或查看长期记忆同步线程`
  - `绑定当前 Doubao 会话为“手机版对话”`
  - `立即同步长期记忆`
  - `同步今日 briefing 到手机版对话`
  - `把本次问题先查记忆再发给豆包`
- 在 [options.tsx](/Users/Esone/git/personal-ai/src/options.tsx) 增加 Doubao Bridge 配置区，新增本地字段：
  - `DOUBAO_BRIDGE_ENABLED`
  - `DOUBAO_BRIDGE_BASE_URL`，默认 `http://127.0.0.1:46321`
  - `DOUBAO_BRIDGE_TOKEN`
- 扩展侧新增 `DoubaoBridgeClient`，通过 localhost HTTP 与桥接器交互；不走 native messaging，避免浏览器清单与安装复杂度上升。

### 2. 本机 Doubao Bridge

- 新增独立包 `doubao-bridge/`，职责只限本机自动化，不承载业务真源。
- 运行模型：
  - 常驻 HTTP 服务
  - Playwright 持久化浏览器 profile
  - 开机自启动模板：macOS `launchd`，Windows `Task Scheduler`
  - 开发者 fallback：脚本模式手动启动
- Auth 策略固定：
  - 不读取用户主浏览器 cookie
  - 不在扩展中收集用户名/密码
  - 桥接器首次连接时拉起自己控制的浏览器窗口到 `doubao.com`
  - 用户在该窗口手动登录一次，后续复用桥接器本地 profile
- 桥接器本地 API：
```text
GET  /health
POST /pair
GET  /auth/status
POST /auth/open-login
POST /threads/create-memory-sync
POST /threads/bind-from-url
GET  /threads
POST /sync/stable-memory
POST /sync/mobile-briefing
POST /inject/query-card
POST /reminders/sync
```
- `bind-from-url` 默认从当前打开的 Doubao 页面 URL/线程上下文提取 thread id，用来绑定 `mobile_context_thread`。

### 3. 服务端 Provider 发布层

- 不把 Doubao 相关状态塞进通用 `/config`；新增 provider 专属数据模型：
  - `provider_bindings`
    - `provider`, `bindingType`, `externalThreadId`, `title`, `deviceId`, `updatedAt`
  - `published_memory_products`
    - `kind`, `bodyMd`, `dedupeKey`, `stability`, `ttlSeconds`, `recommendedTransport`, `generatedAt`
  - `provider_sync_jobs`
    - `provider`, `productKind`, `targetBindingType`, `payloadHash`, `state`, `lastAttemptAt`, `resultJson`
- 新增服务端接口：
```text
GET  /api/v1/providers/:provider/capabilities
GET  /api/v1/providers/:provider/bindings
PUT  /api/v1/providers/:provider/bindings/:bindingType
POST /api/v1/providers/context-packages/render
GET  /api/v1/providers/:provider/sync-jobs
POST /api/v1/providers/:provider/sync-jobs/:id/report
```
- `MemoryServiceClient` 扩展 provider 方法，但继续复用现有 `/ask`、`/recall`、`/profile/*`、`/notifications`、`/events` 作为底层数据源。

### 4. 记忆类型与传输策略

- `persona_core`
  - 来源：高置信、已确认 `fact/preference/habit/constraint`
  - 传输：`memory_sync_thread`
  - 策略：明确要求豆包“记住”，每天至多一次增量同步
- `voice_mode`
  - 来源：通勤聊天偏好、回答风格偏好
  - 传输：`memory_sync_thread`
  - 策略：低频更新，与 `persona_core` 分开 dedupe
- `active_focus_digest`
  - 来源：`concerned-items`、近 7-14 天高显著性主题、watched projects
  - 传输：`mobile_context_thread`
  - 策略：只作为临时上下文，不要求豆包记住；默认 4 小时内不重复推送同类 briefing
- `reminder_digest`
  - 来源：`notifications` + pending actions
  - 传输：优先提醒，其次 `mobile_context_thread`
  - 策略：紧急项每 15 分钟检查；非紧急项合并进 briefing
- `project_brief`
  - 来源：project summaries、reflection threads、reports
  - 传输：当前目标会话；若目标是手机语音场景则发到 `mobile_context_thread`
- `query_answer_card`
  - 来源：`/ask` + `/recall`
  - 传输：用户触发时注入目标会话
  - 策略：显式注明“以下是本次临时上下文，不需要长期记住”

### 5. 会话与同步规则

- `memory_sync_thread` 由桥接器自动创建并长期复用，只承接长期记忆与校验问答，不混入用户真实聊天。
- `mobile_context_thread` 由用户显式绑定到“手机版对话”，这是影响 Ola Friend 聊天效果的唯一正确线程。
- 不为 `active_focus_digest` 新开线程；因为普通会话内容不跨线程，只有发到 `mobile_context_thread` 才会影响手机端会话上下文。
- `stable-memory sync` 的默认节奏：
  - 服务端 nightly consolidation 后生成增量产品
  - 本机桥接器收到事件后执行
  - 同一 `dedupeKey` 不重复注入
- `mobile briefing` 的默认节奏：
  - 通勤前手动触发
  - 或重大变化时自动触发
  - 或用户在 popup 中点击“同步到手机版对话”
- `reminder sync` 优先走豆包提醒/系统日历；只有不能结构化为提醒时才退回对话消息。

## Test Plan

- Popup/Setup：
  - 豆包 icon 显示正确
  - 四种状态切换正确
  - 能检测本地桥接器健康状态与未安装状态
- Auth/Bridge：
  - 首次登录只通过桥接器浏览器窗口完成
  - 扩展与服务端均不保存 Doubao 凭据
  - 桥接器重启后仍能复用登录态
- Binding：
  - 自动创建 `memory_sync_thread`
  - 绑定当前 Doubao 会话为 `mobile_context_thread`
  - 绑定结果持久化到服务端并可在 popup/option 中展示
- Sync：
  - `persona_core` 更新后进入 `memory_sync_thread` 且不会污染 `mobile_context_thread`
  - `active_focus_digest` 只进入 `mobile_context_thread`
  - 同一 briefing 在节流窗口内不会重复注入
- Query：
  - “最近聊天里怎么说的 / 最近某项目结论 / 最近待办”三类问题能先查 Memory Service 再把结果注入目标会话
- Reminder：
  - 紧急提醒优先走提醒通道
  - 失败时可降级为 `mobile_context_thread` briefing
- Security：
  - localhost API 需要桥接 token
  - 服务端只接收 sync report，不接收 Doubao auth 信息

## Assumptions

- v1 采用 localhost HTTP bridge，不做 native messaging。
- v1 的桥接器交付形式为“本地守护程序 + 安装说明”；桌面 GUI 包装可后续再做。
- 扩展已有 `<all_urls>` host 权限，可承接 Doubao 当前页面 URL 读取与绑定辅助。
- 豆包行为约束以当前可验证信息与用户实测为准：长期记忆跨会话，普通会话上下文不跨会话，因此必须区分 `memory_sync_thread` 与 `mobile_context_thread`。
- 官方边界参考：[记忆功能FAQ](https://www.doubao.com/legal/memory_faq)、[隐私政策](https://www.doubao.com/legal/privacy?external=true)、[豆包云盘使用须知](https://www.doubao.com/legal/ai_space)。
