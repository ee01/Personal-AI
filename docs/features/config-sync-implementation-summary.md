# 定时消息配置同步

定时消息的跨设备恢复以 Google Sheet 的 `Config` 工作表为来源，同时把一份规范化配置写入 `chrome.storage.local`，供扩展本机运行使用。

## 当前能力

- `ConfigSyncService` 统一负责从 Sheet 读取、写入 Sheet、写入本地存储，以及局部配置更新。
- 同步时先写 Sheet，再写本地存储，避免 Sheet 写入失败后留下“本地显示成功、跨设备无法恢复”的半同步状态。
- `Config` 工作表保存核心配置：Web App URL、Script/Deployment metadata、触发器 ID、Messages/Logs sheet id、版本和同步时间。
- 写入 `Config` 时使用 Google Sheets `RAW` value input option，避免 rule id、ISO 时间戳或 URL 被 Sheets 按日期/数字自动改写。
- Bot Automation 同时支持旧版 `bot_executor_*` 字段和新版双规则结构：
  - `bot_automation_executor_*`：每分钟执行 Bot/AI/Jira Automation 消息。
  - `bot_automation_timeline_sync_*`：每天同步项目 Timeline 缓存。
- 写回 Sheet 时只替换系统管理的配置键，保留用户或后续功能添加的自定义 Config 键。
- 手动绑定支持粘贴完整 Sheet URL、Drive `open?id` 链接或 Sheet ID；读取到完整 Config 时恢复本地配置，旧表缺 Config 工作表或 Config 为空时会补齐兼容的最小绑定。

## 用户路径

1. 首次使用时，用户通过一键初始化创建维护表、Apps Script、触发器和基础配置。
2. 配置 Bot 推送时，系统创建或修复 Jira Automation 规则，并把规则信息同步到 Sheet + 本地。
3. 更换设备或重装扩展后，用户只需要手动绑定同一个维护表，即可恢复 Web App、触发器、Bot Automation、Messages/Logs 工作表等配置。
4. 如果旧维护表缺少 `Config` 工作表，系统会在用户有编辑权限时自动创建并写入基础配置；如果 Sheet 无访问权限、链接错误或自动补齐失败，手动绑定会给出可执行的错误提示。

## 设计依据

- Google Sheets API 的 `spreadsheets.values` 适合作为轻量配置表读写；本功能使用开放范围读取 Config 列，避免未来字段或用户自定义键超出固定行数后丢失。
- Config 表是机器可读的键值存储，不是用户录入表；因此写入时使用 `RAW`，保留精确字符串。
- Chrome `storage.local` 适合保存扩展运行态配置，但不是跨设备恢复来源；敏感 webhook 或 token 不应只依赖浏览器本地状态。
- Jira Automation 规则和 Apps Script Web App URL 都是跨设备可恢复的连接配置，需要和普通 UI 偏好区分管理。
- 这类“本地可用、云端可恢复”的设计接近 local-first 思路：本机状态保持快速可用，跨设备状态必须有可审计、可恢复的同步来源。

## 验证重点

- `ConfigSyncService` 能读写 App Script metadata、Messages/Logs sheet id 和双 Bot Automation 规则，并能在旧维护表缺少 `Config` 工作表时补齐基础结构。
- 写回 Config 时不会删除未知自定义键，也不会把不完整 Bot 规则字段写成 `null`。
- 写回 Config 时不能让 Sheets 自动解析值；长数字 ID 和 ISO 时间戳需要原样保存。
- `syncConfig` 必须保持 Sheet-first 顺序，并让本地 `last_sync_time` 与 Sheet 一致。
- 手动绑定需要覆盖：完整 Config 恢复、旧表最小绑定、无权限、Sheet 不存在、缺少 Config 工作表。
