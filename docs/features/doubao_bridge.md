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
- `mobile_briefing`
  - 同步近期重点到 `mobile_context_thread`
- `reminder_sync`
  - 同步提醒到 `mobile_context_thread`

同时支持手动触发：

- `现在推一次 persona`
- `现在推一次近期重点`
- `现在推一次提醒`
- `查记忆并注入当前会话`

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

这些默认值来源于 `doubao-bridge/.env` 或代码默认值，但普通用户应在 `Doubao Bridge.app` 中修改，而不是手改 `.env`。

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

## 发布与安装

面向用户的正式发布物只有一个：

- `Doubao-Bridge-<version>-Installer.pkg`

GitHub Release 主入口：

- [https://github.com/ee01/personal-ai/releases/latest](https://github.com/ee01/personal-ai/releases/latest)

本地打包产物通常会同时生成：

- `doubao-bridge/release/Doubao Bridge.app`
- `doubao-bridge/release/Doubao-Bridge-<version>-Installer.pkg`

但对最终用户来说，推荐只下载 `.pkg`。

版本号由 [doubao-bridge/package.json](/Users/Esone/git/personal-ai/doubao-bridge/package.json) 的 `version` 驱动，例如当前为 `2.0.2`。

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

这些接口主要给 app 和 extension 使用，不面向普通用户直接操作。

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
  - [doubao-bridge/app/main.mjs](/Users/Esone/git/personal-ai/doubao-bridge/app/main.mjs)
  - [doubao-bridge/app/renderer.js](/Users/Esone/git/personal-ai/doubao-bridge/app/renderer.js)
  - [doubao-bridge/scripts/package-macos.mjs](/Users/Esone/git/personal-ai/doubao-bridge/scripts/package-macos.mjs)
  - [doubao-bridge/scripts/deploy.mjs](/Users/Esone/git/personal-ai/doubao-bridge/scripts/deploy.mjs)
- 发送与桥接核心：
  - [doubao-bridge/src/browserSession.ts](/Users/Esone/git/personal-ai/doubao-bridge/src/browserSession.ts)
  - [doubao-bridge/src/bridgeService.ts](/Users/Esone/git/personal-ai/doubao-bridge/src/bridgeService.ts)
  - [doubao-bridge/src/server.ts](/Users/Esone/git/personal-ai/doubao-bridge/src/server.ts)
- extension 状态页：
  - [src/modals/doubao-bridge.tsx](/Users/Esone/git/personal-ai/src/modals/doubao-bridge.tsx)
