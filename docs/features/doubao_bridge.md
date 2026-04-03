# Doubao Bridge

*最后更新: 2026-03-31*

## 概述

Doubao Bridge 是一套运行在本机的豆包互联系统，用来把服务端 `Memory Service` 中沉淀出来的记忆和上下文，安全地注入到豆包。

它的目标不是让服务端直接控制豆包账号，而是把职责拆成三层：

- `Memory Service`
  - 唯一真源
  - 负责记忆提炼、画像、检索、提醒、上下文渲染
- `Doubao Bridge.app`
  - 本机控制中心
  - 负责登录豆包、绑定线程、配置同步频率、查看状态、手动触发同步
- Chrome Extension 中的 `doubao-bridge.html`
  - 只做安装引导、状态摘要、打开 app
  - 不再承载主要配置功能

当前版本为 `v2`，以 macOS app 形态交付。

---

## 核心能力

Doubao Bridge 当前提供这些核心能力：

### 1. 连接 Memory Service

- 在 app 中配置 `Memory Service Base URL`
- 可选配置 `Memory Service API Key`
- 必须配置 `Memory Service User ID`
- 可在 app 中直接测试连接

> 注意：`Memory Service User ID` 对写操作是必填的。如果没填，Memory Service 会返回类似  
> `X-User-Id header is required for write operations`

### 2. 管理豆包登录态

- 本机使用独立的 Playwright 持久化 profile 保存豆包登录态
- 用户通过 app 打开的受控浏览器窗口手动登录一次
- 登录态只保存在本机，不回传服务端

### 3. 绑定两类豆包线程

Doubao Bridge 使用双线程模型：

- `memory_sync_thread`
  - 专门用于长期记忆沉淀
  - 只承接稳定信息，如 `persona_core`、`voice_mode`
- `mobile_context_thread`
  - 绑定到用户真实使用的“手机版对话”
  - 承接近期重点、提醒、查询结果等短期上下文

这个设计来自豆包的实际行为边界：

- 明确要求“请记住”的内容，才有机会跨会话、跨设备共享
- 普通会话上下文不会自动跨线程共享

因此：

- 长期稳定信息要发到 `memory_sync_thread`
- 近期重点、提醒、查询结果要发到真实使用的 `mobile_context_thread`

### 4. 自动同步与手动同步

Doubao Bridge 支持三类定时同步：

- `stable_memory`
  - 同步长期记忆到 `memory_sync_thread`
  - 默认改为使用豆包“随手记”结构化格式发送
- `mobile_briefing`
  - 同步近期重点到 `mobile_context_thread`
  - 也会明确要求豆包将内容记录到“随手记”
- `reminder_sync`
  - 同步提醒到 `mobile_context_thread`
  - 默认改为使用豆包“随手记”结构化格式发送，提醒会转成待办形态

同时支持手动触发：

- `现在推一次 persona`
- `现在推一次近期重点`
- `现在推一次提醒`
- `查记忆并注入当前会话`

其中：

- 自动同步与“现在推一次 persona”走同一条 `stable_memory` 发送链路
- 自动同步与“现在推一次近期重点”走同一条 `mobile_briefing` 发送链路
- 自动同步与“现在推一次提醒”走同一条 `reminder_sync` 发送链路
- 这三条链路现在都会明确要求豆包把内容记录到“随手记”
- 其中 `stable_memory` / `reminder_sync` 的结构化程度更强，`mobile_briefing` 仍以近期重点列表为主，但记录话术已改为随手记导向

随手记格式发送后的内容，目标是让用户可以在豆包手机端按更结构化的方式查看和管理，而不是只停留在桥接线程里的一段普通上下文文本。

### 5. 本机状态与后台运行

- app 关闭窗口后，后台会继续运行
- 真正停掉后台，需要在 app 中点击 `停止后台并退出`
- extension 页面会显示本机 Bridge 是否运行、是否就绪、当前还缺哪些前置条件

---

## 用户主流程

标准主流程如下：

1. 从 GitHub Releases 下载最新安装包  
   [https://github.com/ee01/personal-ai/releases/latest](https://github.com/ee01/personal-ai/releases/latest)
2. 安装 `Doubao-Bridge-<version>-Installer.pkg`
3. 在 `Applications` 中打开 `Doubao Bridge.app`
4. 在 app 中依次完成：
   - 配置 `Memory Service Base URL`
   - 配置 `Memory Service User ID`
   - 测试 Memory Service 连通性
   - 打开登录窗口并登录豆包
   - 创建/修复长期记忆线程
   - 自动绑定“手机版对话”
5. 视情况调整同步频率
6. 关闭窗口即可，后台会继续按节奏自动同步

如果只打开 Chrome extension 中的 Doubao 页面，看到的是安装引导和状态页，不是完整配置页。

---

## 自动同步前置条件

要让“自动定时推送记忆”真的工作，必须同时满足这些条件：

1. `Memory Service Base URL` 已配置
2. `Memory Service User ID` 已配置
3. 豆包登录状态为 `connected`
4. `memory_sync_thread` 已绑定  
   影响 `stable_memory`
5. `mobile_context_thread` 已绑定  
   影响 `mobile_briefing` 和 `reminder_sync`

当前 app 中后台同步默认开启，不再要求用户额外勾选一个 `autoSync` 开关。

如果任意条件不满足：

- app 会在状态区显示阻塞原因
- extension 页也会显示“当前阻塞原因”

---

## 默认配置与同步节奏

当前默认值如下：

- `Memory Service Base URL`
  - `http://10.32.56.212:3210`
- 轮询周期
  - 每 `5` 分钟检查一次
- `stable_memory`
  - 每 `12` 小时同步一次
- `mobile_briefing`
  - 每 `4` 小时同步一次
- `reminder_sync`
  - 每 `15` 分钟同步一次

这些默认值来源于 `app/.env` 或代码默认值，但普通用户应在 `Doubao Bridge.app` 中修改，而不是手改 `.env`。

---

## 消息发送策略

Doubao Bridge 当前正式发送链路不再使用实验性的 request-mode，而是固定走 DOM 发送，并尽量降低机器人验证触发率。

当前策略：

- 主策略：`paste`
- 仅当满足以下两个条件时才 fallback：
  - 没检测到 challenge
  - 消息没有真正落到页面
- fallback 顺序：
  - `insert`
  - `type`

同时做了这些保护：

- 文本剪贴板备份/恢复，尽量避免污染用户剪贴板
- 发送后会检查：
  - 是否检测到 challenge
  - 消息是否真的出现在页面
- 如果已经检测到 challenge，不会继续盲目切换输入方式乱发

这套策略的背景是：

- 纯请求方式曾做过实验，但无法稳定通过豆包的校验链路
- `paste + 等待 + 发送` 更接近真实人工操作，实际表现更稳定

---

## App 与 Extension 的分工

### `Doubao Bridge.app`

负责：

- 配置 Memory Service
- 登录豆包
- 创建/修复长期记忆线程
- 绑定手机对话
- 调整同步频率
- 查看阻塞原因、最近同步、日志
- 手动推送 persona / 近期重点 / 提醒
- 停止后台并退出

当前发送形态说明：

- `persona` 的自动同步和手动推送，底层会转成随手记格式后再发送到 `memory_sync_thread`
- `近期重点` 的自动同步和手动推送，底层会明确要求豆包把近期重点记录到随手记
- `提醒` 的自动同步和手动推送，底层会转成随手记待办格式后再发送到 `mobile_context_thread`
- 用户在 app 里看到的按钮文案仍然是 `现在推一次 persona / 近期重点 / 提醒`，但发送给豆包的内容已经不是旧格式
- 用户可在豆包手机端查看这些同步过去的随手记内容

### Extension 中的 `doubao-bridge.html`

负责：

- 检测本机服务是否在线
- 提示缺失步骤
- 展示状态摘要
- 引导下载安装包
- 引导用户打开 `Doubao Bridge.app`

不再负责：

- 配置 bridge 地址
- 配置 token
- 配置 auto-sync 开关
- 配置线程绑定细节

当前固定约定：

- Bridge 地址：`http://127.0.0.1:46321`
- 这些细节由 app 自动管理，不暴露给普通用户

---

## Quick Ask

在 `v2` 的 app 方案里，menubar 的默认入口不再直接打开配置页，而是改成一个 `Quick Ask` 小窗：

- 左键点击 tray icon
  - 打开或收起 quick ask
- 右键点击 tray icon
  - 只弹 context menu
- 配置页
  - 退回 `Open Doubao Bridge Settings`

### 快捷键

默认全局快捷键是 `Option+A`（Electron 中注册为 `Alt+A`）：

- 窗口隐藏时
  - 唤起并聚焦 quick ask
- 窗口可见但未聚焦时
  - 把焦点带回现有 quick ask
- 窗口已聚焦时
  - 切换语音输入 start / stop

当前版本不支持真正的“全局长按语音”，因为 Electron 的 `globalShortcut` 只有按下回调，不提供稳定的全局 key-up / hold 语义。

### Compact 与 Expanded

Quick Ask 的视觉目标是 `Spotlight 式胶囊壳`：

- 收起态只保留：
  - 输入提示
  - 左下 `+`
  - 右下语音按钮
  - 一条可点击的状态胶囊
- 不再保留：
  - 模型菜单
  - 常驻状态条
  - 底部帮助文案

当用户真正发起问题后，窗口再平滑展开成轻量对话面板：

- 上方是消息流
- 下方是固定输入区
- structured answer 仍会保留：
  - `keyFindings`
  - `timeline`
  - `insights`
  - `relatedEntities`
  - `confidence`
- 证据默认折叠为轻量列表，而不是完整 dashboard

当前交互约定：

- `Esc`
  - expanded -> 收起到 compact
  - compact -> 隐藏窗口
- 会话上下文
  - 只在窗口存活期间保留
  - 关闭窗口即清空
  - 下一次重新唤起不会自动续聊

### 状态胶囊与状态卡

compact 态只显示一条主状态胶囊，按优先级从高到低选择：

1. `setup_blocker`
2. `confirm_request`
3. `running_action`
4. `waiting_reply`
5. `queued_action`

如果还有其他活跃状态，胶囊文案会显示成：

- `外部询问等待回复 +2`

这里的 `+2` 表示还有另外两类状态存在，而不是同类状态数量。

点击状态胶囊后：

- 窗口展开
- 将当前运行态汇总成一张 `status card`
- 状态卡直接插入消息流
- 不跳页，不打开第二窗口

这样做的原因是：

- 对用户来说，这仍然是一场 chat
- 状态只是这场 chat 里的“系统回复”
- 不需要为了看运行态切到另一个 dashboard

当前 v1 中，状态卡只做“显示与引导”，不直接在卡片里完成 approve / retry / openclaw / outreach 操作。

### 显式记忆

Quick Ask 和原来的 exploring `/ask` 有一个关键差异：它更像聊天，因此会自然出现“请帮我记住”这种输入。

当前实现约定是：

- 只有显式“记住”意图，才会写长期记忆
- 普通聊天不会自动沉淀 profile item
- 记忆写入不走 `/ingest`
- 而是直接写 `POST /profile/items`

分类规则：

- 语言 / 回复风格类 -> `preference`
- 身份 / 角色 / 组织 / 时区类 -> `fact`
- 其他显式“请记住” -> `fact` + `itemKey=remembered_note`

如果内容已存在，bridge 会把 Memory Service 的 `409` 归一化成成功响应，并在 UI 中显示“已记住 / 已存在”。

### 语音

当前语音输入只在 quick ask 窗口内可用：

- 通过 `SpeechRecognition / webkitSpeechRecognition` 做浏览器级转写
- interim transcript 会直接写回输入框
- final transcript 保留给用户确认发送

当前不引入原生 macOS STT helper，也不做离线识别；如果后续确实需要隐私或离线能力，再考虑接 `Speech.framework`。

### Demo

Quick Ask 的最终视觉 demo 收敛为一个独立 HTML：

- [docs/demo/doubao-bridge-quick-ask.html](/Users/Esone/git/personal-ai/docs/demo/doubao-bridge-quick-ask.html)

这个 demo 页面包含 5 个核心状态：

- compact 默认待命态
- compact 带状态胶囊态
- expanded 普通问答态
- expanded 插入状态卡态
- voice listening 态

---

## 发布与安装

面向用户的正式发布物只有一个：

- `Doubao-Bridge-<version>-Installer.pkg`

GitHub Release 主入口：

- [https://github.com/ee01/personal-ai/releases/latest](https://github.com/ee01/personal-ai/releases/latest)

本地打包产物通常会同时生成：

- `app/release/Doubao Bridge.app`
- `app/release/Doubao-Bridge-<version>-Installer.pkg`

但对最终用户来说，推荐只下载 `.pkg`。

版本号由 [app/package.json](/Users/Esone/git/personal-ai/app/package.json) 的 `version` 驱动，例如当前为 `2.0.2`。

---

## 升级与卸载

### 升级

- 直接下载并安装更高版本的 `.pkg`
- app 会继续复用本机数据目录和登录态

### 卸载

当前卸载入口是隐藏的，不放在主界面，而放在 app 菜单中的高级选项里。

卸载会尝试做这些事：

- 停止后台服务
- 清理本地数据和日志
- 关闭 app
- 尝试把 app 移到废纸篓，或者在失败时定位到 Finder 让用户手动删除

注意：

- 直接删除 `/Applications/Doubao Bridge.app` 不一定等于一次完整卸载
- 推荐使用 app 内的卸载入口

---

## 本地 API 摘要

Doubao Bridge 本机默认监听：

- `http://127.0.0.1:46321`

常用接口包括：

- `GET /health`
- `GET /status`
- `GET /settings`
- `PUT /settings`
- `POST /settings/test-memory-service`
- `POST /auth/open-login`
- `POST /threads/create-memory-sync`
- `POST /threads/auto-bind-mobile`
- `POST /sync/run-now`
- `POST /inject/query`
- `POST /memo/sync`
- `POST /memo/stable-memory`
- `POST /memo/reminders`
- `POST /memo/classify`

这些接口主要给 app 和 extension 使用，不面向普通用户直接操作。

其中：

- `POST /sync/run-now` 是 app 手动触发同步时走的统一入口
- `stable_memory`、`mobile_briefing` 与 `reminder_sync` 都会使用随手记导向的话术
- `/memo/*` 接口是直接操作随手记格式的本地 API

---

## 已知边界

1. Doubao Bridge 目前按 macOS 优先设计
2. 豆包普通会话上下文不天然跨线程共享，所以必须维护双线程模型
3. 消息注入仍需要浏览器上下文；当前不采用纯 HTTP request-mode 作为正式路径
4. 为降低风控触发率，当前不启用 headless 自动同步模式
5. 签名与 notarization 需要 Apple Developer Program 资质，未签名包在其他 Mac 上可能仍会被 Gatekeeper 拦截

---

## 相关文件

- 旧的集成方案文档：[docs/features/doubao_bridge_integration.md](/Users/Esone/git/personal-ai/docs/features/doubao_bridge_integration.md)
- app 入口与打包：
  - [app/app/main.mjs](/Users/Esone/git/personal-ai/app/app/main.mjs)
  - [app/app/renderer.js](/Users/Esone/git/personal-ai/app/app/renderer.js)
  - [app/scripts/package-macos.mjs](/Users/Esone/git/personal-ai/app/scripts/package-macos.mjs)
  - [app/scripts/deploy.mjs](/Users/Esone/git/personal-ai/app/scripts/deploy.mjs)
- 发送与桥接核心：
  - [app/src/browserSession.ts](/Users/Esone/git/personal-ai/app/src/browserSession.ts)
  - [app/src/bridgeService.ts](/Users/Esone/git/personal-ai/app/src/bridgeService.ts)
  - [app/src/server.ts](/Users/Esone/git/personal-ai/app/src/server.ts)
- extension 状态页：
  - [src/modals/doubao-bridge.tsx](/Users/Esone/git/personal-ai/src/modals/doubao-bridge.tsx)
