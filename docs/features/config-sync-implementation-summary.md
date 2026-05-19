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
- 写回 Sheet 时会顺手清理重复的系统管理键，避免旧表多次迁移后留下多个 `web_app_url`、Bot rule id 等行；自定义键仍原样保留。
- 读取旧表时会防止重复系统键或旧 camelCase alias 覆盖规范字段；重复 `last_sync_time` 会按真实时间取最新值，降低旧迁移残留导致误恢复的风险。
- 写回 Sheet 前会检查现有 `last_sync_time`；如果 Sheet 已经比本机这次写入的基准更新，系统会暂停写入并要求用户重新读取最新配置，避免旧本机状态覆盖另一台设备刚写入的配置。
- 手动绑定支持粘贴 Google Sheets URL、`/spreadsheets/u/0/d/...` 路径、Google Drive `open?id` / `file/d` 链接或完整 Sheet ID，并会在授权前即时提示识别到的 Sheet ID；完整 URL 只接受 `docs.google.com` / `drive.google.com`，避免把其它网页上的普通 `id` 参数误当成维护表。读取到完整 Config 时恢复本地配置，旧表缺 Config 工作表或 Config 为空时会补齐兼容的最小绑定。
- 手动绑定同一张维护表时会比较本机和 Sheet 的 `last_sync_time`；如果本机更新，界面会先让用户选择“保留本机并同步到 Sheet”或“仍用 Sheet 恢复本机”，避免静默覆盖本机新配置。
- 手动绑定同一张维护表时，如果双方缺少可靠同步时间或时间相同但关键配置不同，界面会列出字段级差异，并要求用户选择保留本机还是用 Sheet 恢复；差异较多时先显示关键项，用户可展开查看全部差异，Webhook、JWT、client secret 等敏感值只显示配置状态，不展示原文。
- 手动绑定另一张维护表时会先进入“切换维护表”确认，展示当前本机表、新表和将恢复的配置范围；用户继续后才用新 Sheet 恢复本机，取消则保留当前本机配置。
- App Script 版本元数据回写也复用 Sheet-first 完整同步，避免升级后本机显示新版本但 Sheet 恢复源仍停留在旧版本。
- 局部配置更新会返回真正完成 Sheet + 本地写入后的规范化配置，调用方拿到的 `last_sync_time` 与持久化结果一致；当 Sheet 配置不比本机旧或双方缺少可靠同步时间时，局部更新优先以 Sheet 为基准，避免旧本机快照清掉远端已存在的管理字段。

## 用户路径

1. 首次使用时，用户通过一键初始化创建维护表、Apps Script、触发器和基础配置。
2. 配置 Bot 推送时，系统创建或修复 Jira Automation 规则，并把规则信息同步到 Sheet + 本地。
3. 更换设备或重装扩展后，用户只需要手动绑定同一个维护表，即可恢复 Web App、触发器、Bot Automation、Messages/Logs 工作表等配置。
4. 手动绑定输入框会先校验 Google Sheets / Drive 链接来源，再展示识别到的维护表和将恢复的配置范围，降低粘错链接或不确定恢复内容的风险。
5. 如果本机已有同一张维护表的更新配置，或无法仅靠同步时间判断但关键配置不同，绑定流程会先停在冲突决策提示，展示差异后由用户明确选择写入本机或 Sheet。
6. 如果本机已有另一张维护表，绑定流程会先停在切换确认提示，避免误粘 Sheet ID 后静默替换本机配置。
7. 如果旧维护表缺少 `Config` 工作表，系统会在用户有编辑权限时自动创建并写入基础配置；如果 Sheet 无访问权限、链接错误或自动补齐失败，手动绑定会给出可执行的错误提示。

## 设计依据

- Google Sheets API 的 `spreadsheets.values` 适合作为轻量配置表读写；本功能使用开放范围读取 Config 列，避免未来字段或用户自定义键超出固定行数后丢失。
- Config 表是机器可读的键值存储，不是用户录入表；因此写入时使用 `RAW`，保留精确字符串。
- Chrome `storage.local` 适合保存扩展运行态配置，但不是跨设备恢复来源；敏感 webhook 或 token 不应只依赖浏览器本地状态，也不应在冲突 diff 里直接展示。
- Jira Automation 规则和 Apps Script Web App URL 都是跨设备可恢复的连接配置，需要和普通 UI 偏好区分管理。
- 这类“本地可用、云端可恢复”的设计接近 local-first 思路：本机状态保持快速可用，跨设备状态必须有可审计、可恢复的同步来源。
- 业内配置同步产品通常会把“覆盖本机 / 覆盖云端 / 查看冲突”做成显式用户决策，例如 VS Code Settings Sync；当前实现采用 Sheet 时间戳、维护表 ID 和关键字段差异作为保护基线，并让局部更新在时间戳不明确时偏向保护 Sheet 恢复源。
- 文件同步产品处理并发写入时通常避免静默覆盖，例如 Dropbox API 建议用带 revision 的 update 模式来暴露冲突；本功能不做多端实时合并，但至少在跨表切换和同表本机较新时要求用户显式确认。
- CRDT / local-first 讨论强调多副本最终收敛；当前 Config 是单用户轻量键值表，暂不引入 CRDT，但写回时会去重系统键，减少表格作为同步源时的歧义。

## 外部参考

- [VS Code Settings Sync](https://code.visualstudio.com/docs/configure/settings-sync) 在冲突时提供接受本地、接受远端和查看差异，说明跨设备配置恢复不能只做静默覆盖。
- [Google Sheets values.update](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/update) 要求调用方明确 `valueInputOption`；当前使用 `RAW` 保留 ID、URL 和时间戳的原始字符串。
- [Dropbox WriteMode.update](https://dropbox.github.io/dropbox-sdk-java/api-docs/v5.4.3/com/dropbox/core/v2/files/WriteMode.html) 使用已知 revision 判断是否覆盖，说明同步入口要保留冲突信号。
- [Zapier Webhooks](https://help.zapier.com/hc/en-us/articles/8496083355661-How-to-get-started-with-Webhooks-by-Zapier) 明确提醒 webhook URL 要像密码一样处理；因此手动绑定 diff 会对 Bot Automation webhook 脱敏。
- Local-first software 与 CRDT 相关论文强调本地可用和最终收敛，但也提醒配置语义冲突仍需要用户可理解的决策点；当前先对单用户 Config 做时间戳级保护。

## 验证重点

- `ConfigSyncService` 能读写 App Script metadata、Messages/Logs sheet id 和双 Bot Automation 规则，并能在旧维护表缺少 `Config` 工作表时补齐基础结构。
- 写回 Config 时不会删除未知自定义键，也不会把不完整 Bot 规则字段写成 `null`。
- 写回 Config 时应把重复的系统管理键收敛成单行，避免后续读取或人工排查看到过期重复行。
- 读取 Config 时遇到重复系统键或旧 alias 时不能让后面的旧值覆盖规范字段；重复 `last_sync_time` 需要取可解析时间中的最新值。
- 写回 Config 时不能让 Sheets 自动解析值；长数字 ID 和 ISO 时间戳需要原样保存。
- 写回 Config 时如果远端 `last_sync_time` 比本机基准更新，必须中止写入并给出可恢复提示；如果本机基准更新，则允许用户选择后写回 Sheet。
- `syncConfig` 必须保持 Sheet-first 顺序，并让本地 `last_sync_time` 与 Sheet 一致。
- `updatePartialConfig` 必须返回与 Sheet / Chrome Storage 相同的同步时间戳，避免调用方 UI 状态与持久化状态短暂分叉；当 Sheet 与本机同步时间相同或都未知时，不能用旧本机快照清掉 Sheet 中已有的 Web App、触发器、Bot Automation 等管理字段。
- App Script 版本回写必须走 `syncConfig`，Sheet 写入成功后才更新本地 storage。
- 手动绑定需要覆盖：完整 Config 恢复、旧表最小绑定、无权限、Sheet 不存在、缺少 Config 工作表、常见 Sheet / Drive 链接格式的即时识别，以及非 Google 链接不能因 `id` 参数被误识别。
- 手动绑定同表冲突需要覆盖：本机更新时暂停并显示决策；同步时间缺失或相同时如关键字段不同也要暂停并显示差异；差异超过折叠阈值时可以展开查看全部；Webhook、JWT、client secret 等敏感字段不可泄露原文；选择保留本机时写回 Sheet；选择 Sheet 时只恢复本机。
- 手动绑定跨表切换需要覆盖：本机已有另一张维护表时暂停；继续前不改写本机 storage；确认继续后才恢复新表；取消时保持当前本机配置。
