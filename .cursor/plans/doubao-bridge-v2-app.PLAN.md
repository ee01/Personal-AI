# Doubao Bridge macOS App 化方案

## Summary

- v1 直接定为 **macOS-only 的正式桌面应用**：交付物是 **已签名并 notarize 的 `Doubao Bridge.app` + `.pkg`**，不再让终端脚本成为用户主路径。
- 技术路线固定为 **Electron + 复用现有 Node/Playwright/Fastify/React 栈**，不选 Tauri/Swift。原因是现有 `doubao-bridge` 已经是 Node 服务，Playwright 自动化与本地 HTTP API 都能原样复用，迁移风险最低。
- 安装后默认 **自动注册并启动后台同步**；用户可以从 `Applications` 打开 app 查看状态、登录豆包、绑定线程、手动同步、看日志、停止/恢复后台。
- 卸载的主路径是 **app 内一键卸载**，同时做一层“app 缺失时后台自清理”的 best-effort；不把“直接拖进废纸篓”作为唯一可靠卸载路径。

## Key Changes

### 1. 运行时架构

- 把现有 `doubao-bridge` 重构成一个可嵌入的 `BridgeRuntime`：
  - `start() / stop() / getStatus() / onStatusChange()`
  - 内部继续管理 Fastify 本地 API、Playwright 登录态、同步队列、线程绑定与日志
- 新增 `Doubao Bridge.app`：
  - **Electron main process** 负责单实例、窗口、菜单、后台模式、托管 `BridgeRuntime`
  - **Electron renderer** 复用当前 Doubao 控制面板 UI，抽成共享 React 层，避免再把核心交互放在 extension popup 里
- 本地 API 继续保留，作为 **extension 与 app 之间的兼容层**，这样现有扩展集成不需要整体重写
- Playwright Chromium 不再依赖用户机器的 `node/npm/playwright install`：
  - 在构建时把浏览器二进制一并打进 app resources
  - 运行时统一使用 app 自带浏览器和持久化 profile

### 2. 安装、后台与生命周期

- `.pkg` 安装内容固定为：
  - `/Applications/Doubao Bridge.app`
  - `~/Library/Application Support/PersonalAI/DoubaoBridge/...`
  - `~/Library/LaunchAgents/com.personalai.doubao-bridge.plist`
- 安装完成后的默认行为：
  - `postinstall` 注册 `LaunchAgent`
  - 以 `--background` 模式启动 app，一上来就跑本地 bridge 和自动同步
- 后台实现固定为：
  - `LaunchAgent` 启动 `Doubao Bridge.app` 的 background 模式
  - app 在 background 模式不弹主窗口，只跑 bridge runtime
  - 用户从 `Applications` 打开 app 时，复用已存在实例并把状态窗口前置
- app 内必须提供这些控制：
  - 登录/重连豆包
  - 创建或修复长期记忆线程
  - 绑定手机对话
  - 同步 `persona_core / voice_mode`
  - 同步今日 briefing / reminder
  - 查看最近错误与日志
  - 开启/暂停后台同步
  - 一键卸载
- 卸载模型固定为两层：
  - **主路径**：app 内 `Uninstall Doubao Bridge`
  - **兜底**：后台启动器每次启动先检查 app bundle 是否仍存在；如果 app 已被删除，则自动 `bootout` 自己并清理本地支持目录

### 3. Public Interfaces / Types

- 保持现有 localhost bridge API 作为稳定对外接口，继续给 extension 使用：
  - `GET /health`
  - `GET /status`
  - `POST /auth/open-login`
  - `POST /threads/...`
  - `POST /sync/...`
- 扩展 `GET /status` 返回结构，新增：
  - `appVersion`
  - `mode: foreground | background`
  - `launchAgentInstalled`
  - `autoSyncEnabled`
  - `installChannel: dev | release`
- 新增两个本地控制接口，给 extension 和 app 自己共用：
  - `POST /app/show`：把已运行 app 窗口唤到前台
  - `POST /lifecycle/uninstall`：触发一键卸载流程
- 线程策略不变但要做强约束：
  - `memory_sync_thread` 永久复用，不允许普通同步时新开线程
  - `mobile_context_thread` 仍然是目标“手机版对话”绑定
  - 线程丢失时只允许显式 `repair/recreate`，不能静默漂移

### 4. Packaging / Release / Signing

- 打包链路统一切到 **Electron Builder**：
  - 输出 `.app`
  - 输出 `.pkg`
  - 统一处理 macOS 签名、entitlements、notarization
- 继续保留现有命令名，但语义改为 app 发布链路：
  - `npm --prefix doubao-bridge run package:macos`
  - `npm --prefix doubao-bridge run deploy`
  - `npm --prefix doubao-bridge run macos:signing-info`
- 发布机必填环境保持只在发布机生效：
  - `APPLE_INSTALLER_SIGNING_IDENTITY`
  - `APPLE_NOTARY_KEYCHAIN_PROFILE`
  - `GITHUB_TOKEN` 或 `gh auth`
- GitHub Release 的主下载对象固定为：
  - `Doubao-Bridge-Installer.pkg`
- 扩展中的安装指引改为只指向 release 下载页；安装成功后，popup 优先走 `POST /app/show` 打开 app，而不是继续承担完整 setup 交互

### 5. 实施顺序

1. 先把 `doubao-bridge` runtime 从 CLI 入口抽成可嵌入模块，保证 start/stop/status 可编排。  
2. 再建 Electron 壳，接入共享控制面板、单实例与 background 模式。  
3. 再接 LaunchAgent、postinstall、一键卸载与缺失自清理。  
4. 最后切换打包发布到 `.app + notarized .pkg`，并把 extension onboarding 改成“下载 app / 打开 app”。  

## Test Plan

- 新机器无 Node 环境时，下载 release 的 `.pkg` 后可直接安装，不要求用户装 Node/npm。
- 安装完成 10 秒内：
  - `LaunchAgent` 已注册
  - localhost bridge 可响应
  - extension 能读到 `health/status`
- 从 `Applications` 打开 app 时：
  - 若后台已运行，只前置窗口，不启动第二个实例
  - 能显示登录状态、线程绑定、最近同步时间、错误日志
- 登录豆包后，关闭窗口再打开 app，登录态仍存在。
- `sync persona_core` 连续执行多次时：
  - 必须命中同一个 `memory_sync_thread`
  - 不能再出现“每次新开会话”
- `sync briefing / reminder / query inject` 在绑定的手机对话上成功发消息，不再出现“找不到可编辑输入框”时缺乏定位信息。
- 开机重启后后台仍能自动恢复；暂停后台后不应再自动拉取 memory-service。
- 执行 app 内卸载后：
  - `LaunchAgent` 被移除
  - 本地支持目录被清理
  - app bundle 被删除或给出明确删除提示
- app 被手动从 `Applications` 删除后，下次后台自检会自动停掉 agent 并清理残留。
- 签名/公证完成后的 release `.pkg` 在另一台未开发配置的 Mac 上可通过 Gatekeeper 正常安装。

## Assumptions

- v1 只做 macOS，不同时覆盖 Windows。
- 现有 extension 继续存在，但降级为入口与辅助层；Doubao 的主运维界面迁到 app。
- 发布机具备 Apple Developer Program 资质；没有该资质时只能产出未签名测试包，不作为正式发布方案。
- “删除 app 即卸载后台”只能做到 best-effort；正式支持的卸载路径仍然是一键卸载，而不是单纯拖拽删除。
