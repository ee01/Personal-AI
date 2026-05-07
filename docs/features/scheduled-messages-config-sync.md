# 定时消息配置同步

## 概述

定时消息系统把运行配置同时保存到两个位置：

- `chrome.storage.local.scheduledMessagesConfig`：当前浏览器的快速读取缓存
- Google Sheet 的 `Config` 工作表：跨设备恢复、手动绑定和排障时的共享配置源

这个机制解决的是更换设备、重装扩展或手动绑定已有维护表时，Bot、Apps Script、Sheet 子表 ID 等配置丢失的问题。

## 当前实现

核心实现位于 `src/scheduled-messages/ConfigSyncService.ts`：

- `readConfigFromSheet(sheetId)`：从 `Config!A2:B` 读取键值配置，并恢复为 `SheetConfig`
- `saveConfigToSheet(config)`：用 `RAW` 写回扩展管理的配置键，同时保留未知键，避免 Sheets 自动把 ID/时间戳转成数字或日期
- `saveConfigToStorage(config)`：写入 Chrome Storage
- `syncConfig(config)`：先写 Sheet，再写 Chrome Storage，降低 Sheet 写失败后的半同步风险
- `updatePartialConfig(updates)`：合并局部更新；如果 Sheet 上的 `last_sync_time` 更新，会先以 Sheet 配置为基准，降低旧本地配置覆盖跨设备更新的风险；Bot 双规则字段会保留未被更新的 sibling rule
- `recoverScheduledMessagesWorksheetIds(sheetId, config)`：手动绑定旧维护表时，从工作表标题恢复缺失的 Messages/Logs grid id，并在恢复成功时写回 Config

## 同步字段

当前同步字段包括：

- Sheet 与 Apps Script：`sheet_version`、`script_id`、`deployment_id`、`web_app_url`
- 触发器：`minute_trigger_id`、`daily_trigger_id`
- 子表 ID：`messages_sheet_id`、`logs_sheet_id`
- 版本信息：`app_script_version`、`app_script_last_updated`
- 审计信息：`created_by`、`created_at`、`last_sync_time`
- 旧版 Bot 执行规则：`bot_executor_*`
- 新版 Bot Automation：`bot_automation_executor_*`、`bot_automation_timeline_sync_*`

旧版 `bot_executor_*` 会继续镜像 executor rule，确保老版本维护表仍可恢复。

## 用户流程

### 首次初始化

`SheetInitializer` 创建维护表、Apps Script、触发器和 Config 工作表后，调用 `ConfigSyncService.syncConfig()` 同步到 Sheet 和本地。

### 手动绑定已有 Sheet

`OneClickSetup.handleManualBind()` 会：

1. 从 Sheet URL 或直接粘贴的 Sheet ID 提取 `sheetId`
2. 读取 `Config` 工作表
3. 如果存在完整配置，保存到 Chrome Storage 并刷新页面
4. 如果旧维护表缺少 `Config` 工作表，会在用户有编辑权限时创建该工作表并写入表头
5. 如果 Config 为空，写入带 Messages/Logs sheet id 的最小 Config 后再保存到本地，以便下一台设备也能恢复
6. 如果 Config 已存在但缺少 Messages/Logs sheet id，会按工作表标题补齐并回写 Config；读取工作表列表失败时仍会恢复已有 Config，不阻塞绑定

### Bot 配置与升级

`BotConfigDialog` 配置或修复 Jira Automation 后，会把 executor rule 和 timeline sync rule 一起写入 Config。只升级其中一个 rule 时，另一个 rule 会被保留。

## 2026-05-05 巡检更新

- 文档仍符合当前代码边界：Sheet 是跨设备恢复源，Chrome Storage 是本机快速缓存。
- 本轮修复了旧 Config 的恢复缺口：以前只有 Config 为空时才补 Messages/Logs sheet id；现在 Config 已存在但缺少这些 id 时也会补齐并写回。
- 业内参考：Chrome `storage.sync` 适合小型用户设置，但有约 100 KB 总量和 8 KB 单项限制；Google Sheets developer metadata 可把业务字段和 sheet/行/列语义绑定，减少用户编辑表格结构后的断链风险；同步理论研究强调冲突识别、回滚/接受信息和用户可理解的合并结果。当前实现仍选择轻量的 last-write-wins，后续如果增加多设备编辑 UI，应先暴露“远端更新时间、本地更新时间、将覆盖字段”。

## 行为边界

- 当前冲突策略是“最后写入 wins”，没有多设备自动合并 UI。
- 局部更新会在写入前读取 Sheet，并在 Sheet 明显更新时以 Sheet 版本作为合并基准；同一字段并发编辑仍然遵循最后写入 wins。
- `last_sync_time` 主要用于排障和判断配置新旧，不是强一致锁。
- 写 Sheet 时只替换扩展管理的键；用户或未来版本新增的未知键会被保留。
- Config 写入使用 `valueInputOption=RAW`，因为这些值是机器配置，不应被 Sheets 按用户输入规则自动解析。
- 如果 Sheet 写入失败，`syncConfig()` 不会继续写本地，避免本地显示已配置但跨设备无法恢复。
- 如果 `saveConfigToSheet()` 写入旧维护表时发现 `Config` 工作表缺失，会先补齐 `Config` 工作表和表头，再继续写入配置。
- Config 里的 `messages_sheet_id`、`logs_sheet_id` 只接受非负整数；无效值会被忽略，后续运行时可重新发现子表 ID。
- Messages/Logs sheet id 仍依赖默认工作表标题恢复；如果用户重命名这两个表，后续更稳的方案是同步 Google Sheets developer metadata。

## 参考资料

- Chrome Extensions `chrome.storage`：本地、同步、会话存储的适用边界与 quota。
- Google Sheets API developer metadata：用元数据语义绑定 spreadsheet、sheet、行或列，降低 A1 range 和标题漂移风险。
- Csirmaz & Csirmaz, "Data Synchronization: A Complete Theoretical Solution for Filesystems"：同步可拆成冲突识别和冲突解决，用户应能理解将被回滚或接受的变更。

## 验证

目标单测：

```bash
TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node src/scheduled-messages/__tests__/appScriptConfigSync.test.ts
```

关键人工回归：

1. 创建或绑定定时消息维护表
2. 配置 Bot Automation
3. 检查 Sheet `Config` 工作表包含新版 `bot_automation_*` 字段和旧版 `bot_executor_*` 镜像字段
4. 清空本地 `chrome.storage.local` 后用同一 Sheet URL 手动绑定
5. 确认 Bot 状态、Web App URL、Messages/Logs 子表 ID 都能恢复
