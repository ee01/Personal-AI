# Personal AI Desktop App Memory Flow

_最后更新: 2026-05-05_

## 概述

Personal AI Desktop App 是一套运行在本机的记忆协调系统，用来在 `Memory Service`、explorer 输入链路、豆包线程之间建立稳定的双向记忆流。

它的目标不是让服务端直接控制豆包账号，而是把职责拆成三层：

- `Memory Service`
  - 唯一真源
  - 负责记忆提炼、画像、检索、提醒、上下文渲染、explorer 落库
- `Personal AI.app`
  - 本机控制中心
  - 负责登录豆包、绑定线程、配置同步频率、查看状态、手动触发同步、管理 explorer 输入链路
- Chrome Extension 中的 `desktop-app.html`
  - 只做安装引导、状态摘要、打开 app
  - 不再承载主要配置功能

当前版本为 `v2`，以 macOS app 形态交付。

---

## 核心能力

Desktop App 当前提供这些核心能力：

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
- 也可以在“使用我日常浏览器的登录状态”开关下，通过 `webpage-mcp` 借用用户日常 Chrome 里已登录的豆包页面
- 如果 `webpage-mcp` 不可用、没有可用豆包标签页、填入/发送失败或发送后无法验证消息可见，输出广播与输入抓取都会临时回退到桌面端自带的 Chromium profile，并在短时间内避免反复重试不可用的连接器
- 输入侧的豆包 / ChatGPT 来源卡片会显示当前传输状态；如果用户选择了日常浏览器但系统临时回退到内置 Chromium，会直接展示回退原因，避免用户误以为仍在使用日常浏览器登录态
- 输出侧“使用日常浏览器”的广播方式可在广播卡片里直接保存；未保存时界面会提示待生效状态，如果用户切换后立刻登录、绑定或手动推送，app 会先保存待生效的广播方式再执行操作

### 3. 绑定两类豆包线程

Desktop App 使用双线程模型：

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

### 4. 输出侧同步，写回豆包

Desktop App 支持三类定时同步：

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
- 手动触发同步会区分 `succeeded` 与 `skipped`：如果 Memory Service 当前没有真实可推送内容，app 会提示“本次没有可推送内容”，不会把跳过误展示为已推送

随手记格式发送后的内容，目标是让用户可以在豆包手机端按更结构化的方式查看和管理，而不是只停留在桥接线程里的一段普通上下文文本。

### 5. 输入侧探索，写回 Memory Service

Desktop App 现在还承接 explorer 输入链路，用来把受支持来源中的消息重新整理后写回 `Memory Service`。

- 支持查看各来源的认证状态、启用状态、运行频率、最近一次运行结果
- 支持手动触发 explorer 立刻抓取
- 原始消息先写本机 explorer cache，再由提炼链路产出 artifact 并写入 `Memory Service`
- 支持 preview 已缓存消息、提炼结果、cursor 位置，方便定位问题
- 支持 reset cache，只清理本机 raw message cache 与 cursor，不删除远端会话
- 支持 revoke ingested memory，按来源和 `work/personal` scope 删除之前写入 `Memory Service` 的记忆，不回删远端聊天记录
- 使用日常 Chrome 抓取或广播豆包时，必须先存在明确的 `doubao.com` 标签页；不会把当前活动页误当作豆包页面读取或写入。DOM fallback 也会统一处理 `/chat/<id>`、`/thread/<id>` 与绝对链接。
- 当 `webpage-mcp` 来源读取失败并临时回退到桌面端 Chromium 时，Explorer 状态会保留最近一次回退原因，UI 会在来源卡片内显示，用户可以据此补齐扩展连接、Chrome 标签页或登录态

因此当前产品方向已经不是单向“往豆包发”的 bridge，而是：

- 输出侧，把长期记忆、近期重点、提醒、查询答案发进豆包线程
- 输入侧，把 explorer 抓回来的对话材料整理后沉淀回 `Memory Service`

### 6. 本机状态与后台运行

- app 关闭窗口后，后台会继续运行
- 真正停掉后台，需要在 app 中点击 `停止后台并退出`
- extension 页面会显示本机 Desktop App 服务是否运行、是否就绪、当前还缺哪些前置条件

---

## 用户主流程

标准主流程如下：

1. 从 GitHub Releases 下载最新安装包  
   [https://github.com/ee01/personal-ai/releases/latest](https://github.com/ee01/personal-ai/releases/latest)
2. 安装 `Personal-AI-Desktop-<version>-Installer.pkg`
3. 在 `Applications` 中打开 `Personal AI.app`
4. 在 app 中依次完成：
   - 配置 `Memory Service Base URL`
   - 配置 `Memory Service User ID`
   - 测试 Memory Service 连通性
   - 打开登录窗口并登录豆包
   - 创建/修复长期记忆线程
   - 自动绑定“手机版对话”
5. 视情况调整同步频率
6. 关闭窗口即可，后台会继续按节奏自动同步

如果只打开 Chrome extension 中的 Desktop App 页面，看到的是安装引导和状态页，不是完整配置页。

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

这些默认值来源于 `desktop-app/.env` 或代码默认值，但普通用户应在 `Personal AI.app` 中修改，而不是手改 `.env`。

---

## 消息发送策略

Desktop App 当前正式发送链路不再使用实验性的 request-mode，而是固定走 DOM 发送，并尽量降低机器人验证触发率。

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
- 近期重点、待办、通知和查询注入必须先绑定 `mobile_context_thread`；未绑定时不会把内容发到当前豆包页
- 发送失败、命中安全验证或消息不可见时，手动推送会返回失败，后台同步也不会把失败任务当作已完成冷却
- todo / notice 投递失败会回写到 Memory Service，避免把未送达的通知误标为已送达
- 如果已经检测到 challenge，不会继续盲目切换输入方式乱发
- 日常浏览器 `webpage-mcp` 传输不会只因为按下 Enter 就判定成功；它必须先成功填入输入框、触发提交，并在页面正文里观察到本次消息片段，才会向上层返回 `sent=true`
- `webpage-mcp` 传输会先检查当前页是否已经处在安全验证状态；发送后会等待消息出现在非输入区正文中，避免把仍留在输入框里的文本或慢加载页面误判为成功/失败；如果这些检查返回未送达，输出链路会切到内置 Chromium profile 再尝试
- `webpage-mcp` 传输现在支持 `/chat/<id>` 和 `/thread/<id>` 两类路径，也不再假设 thread id 一定是纯数字

这套策略的背景是：

- 纯请求方式曾做过实验，但无法稳定通过豆包的校验链路
- `paste + 等待 + 发送` 更接近真实人工操作，实际表现更稳定
- 对输出同步来说，误报成功比失败重试更危险，因为 Memory Service 可能会把待办或通知标记成已投递

---

## App 与 Extension 的分工

### `Personal AI.app`

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

### Extension 中的 `desktop-app.html`

负责：

- 检测本机服务是否在线
- 提示缺失步骤
- 展示状态摘要
- 引导下载安装包
- 引导用户打开 `Personal AI.app`

不再负责：

- 配置本机服务地址
- 配置 token
- 配置 auto-sync 开关
- 配置线程绑定细节

当前固定约定：

- Desktop App 本机服务地址：`http://127.0.0.1:46321`
- 这些细节由 app 自动管理，不暴露给普通用户

---

## Quick Ask

在 `v2` 的 app 方案里，menubar 的默认入口不再直接打开配置页，而是改成一个 `Quick Ask` 小窗：

- 左键点击 tray icon
  - 打开或收起 quick ask
- 右键点击 tray icon
  - 只弹 context menu
- 配置页
- 退回 `Open Desktop App Settings`

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

- `Personal-AI-Desktop-<version>-Installer.pkg`

GitHub Release 主入口：

- [https://github.com/ee01/personal-ai/releases/latest](https://github.com/ee01/personal-ai/releases/latest)

本地打包产物通常会同时生成：

- `desktop-app/release/Personal AI.app`
- `desktop-app/release/Personal-AI-Desktop-<version>-Installer.pkg`

但对最终用户来说，推荐只下载 `.pkg`。

版本号由 [desktop-app/package.json](/Users/Esone/git/personal-ai/desktop-app/package.json) 的 `version` 驱动，例如当前为 `2.0.2`。

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

- 直接删除 `/Applications/Personal AI.app` 不一定等于一次完整卸载
- 推荐使用 app 内的卸载入口

---

## 本地 API 摘要

Desktop App 本机默认监听：

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
- `GET /explorer/status`
- `POST /explorer/auth/open-login`
- `POST /explorer/run-now`
- `POST /explorer/reset-cache`
- `POST /explorer/revoke-ingested-memory`
- `GET /explorer/preview`
- `POST /memo/sync`
- `POST /memo/stable-memory`
- `POST /memo/reminders`
- `POST /memo/classify`

这些接口主要给 app 和 extension 使用，不面向普通用户直接操作。

其中：

- `POST /sync/run-now` 是 app 手动触发同步时走的统一入口
- `POST /sync/run-now` 会返回本次状态；`skipped` 表示没有可推送内容，不代表发送失败
- `stable_memory`、`mobile_briefing` 与 `reminder_sync` 都会使用随手记导向的话术
- `/memo/*` 接口是直接操作随手记格式的本地 API
- `/explorer/preview` 会返回原始缓存消息、清洗后的预览文本、提炼出的 artifact、以及 cursor 位置
- `/explorer/reset-cache` 只清本地 explorer cache 与 cursor
- `/explorer/revoke-ingested-memory` 只删除 `Memory Service` 中按来源和 scope 写入的记忆，不删除远端聊天记录

---

## 已知边界

1. Desktop App 目前按 macOS 优先设计
2. 豆包普通会话上下文不天然跨线程共享，所以必须维护双线程模型
3. 消息注入仍需要浏览器上下文；当前不采用纯 HTTP request-mode 作为正式路径
4. 为降低风控触发率，当前不启用 headless 自动同步模式
5. 签名与 notarization 需要 Apple Developer Program 资质，未签名包在其他 Mac 上可能仍会被 Gatekeeper 拦截

---

## 相关文件

- 旧的集成方案文档：[docs/features/doubao_bridge_integration.md](/Users/Esone/git/personal-ai/docs/features/doubao_bridge_integration.md)
- app 入口与打包：
- [desktop-app/app/main.mjs](/Users/Esone/git/personal-ai/desktop-app/app/main.mjs)
  - [desktop-app/app/renderer.js](/Users/Esone/git/personal-ai/desktop-app/app/renderer.js)
- [desktop-app/scripts/package-macos.mjs](/Users/Esone/git/personal-ai/desktop-app/scripts/package-macos.mjs)
  - [desktop-app/scripts/deploy.mjs](/Users/Esone/git/personal-ai/desktop-app/scripts/deploy.mjs)
- 发送与桥接核心：
- [desktop-app/src/browserSession.ts](/Users/Esone/git/personal-ai/desktop-app/src/browserSession.ts)
  - [desktop-app/src/bridgeService.ts](/Users/Esone/git/personal-ai/desktop-app/src/bridgeService.ts)
  - [desktop-app/src/server.ts](/Users/Esone/git/personal-ai/desktop-app/src/server.ts)
- extension 状态页：
- [src/modals/desktop-app.tsx](/Users/Esone/git/personal-ai/src/modals/desktop-app.tsx)
