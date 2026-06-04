# 定时消息统一管理功能

*最后更新: 2026-06-04*

## 功能概述

定时消息统一管理功能提供了一个集中化的平台，用于管理和执行各种类型的定时消息推送。系统整合了 Google Sheet、AppScript、Jira Automation 和 memory-service runtime，既能做普通消息推送，也能做“帮我问 / 主动询问（Outreach）”这类带运行时状态和追问逻辑的任务。

## 大白话运行逻辑

这个功能把“什么时候发什么消息”拆成三层：Google Sheet 是用户可编辑的计划表，执行引擎负责按时间发出，memory-service runtime 负责 Outreach 这类需要等回复、追问和记录状态的任务。

结果主要受这些因素影响：

1. 表格行是否有效：状态、日期、时间、重复规则、推送方式和内容是调度的根。
2. 本地时区解释：日期/时间按本机本地时间保存和预览，避免 UTC 转换造成跨天误发。
3. 执行引擎选择：AsMe 走 App Script，Bot/AI 走 Jira Automation，Outreach 走 memory-service runtime，浏览器只做备用。
4. 幂等和补偿：`Next_Exec`、Logs、occurrence/session 共同决定是否已执行、是否要补偿、是否应避免重复。
5. 队列健康：pending/running/succeeded/failed/recovered 等状态会影响管理页提示，不应把历史成功误当当前阻塞。

## 核心特性

### 1. 一键初始化

- 自动创建 Google Spreadsheet
- 自动配置 AppScript 执行引擎
- 先创建维护表、Apps Script 项目和 Web App，再要求用户授权 Apps Script
- 授权完成后设置分钟触发器、添加示例消息并保存 Config
- 维护表默认不会静默开放为“知道链接的任何人可编辑”；域内共享失败时保持仅创建者可编辑，并在初始化收据里提示用户手动分享给指定成员、群组或目标受众
- 初始化收据会保留并展示维护表子表定位和 Web App deployment；授权后保存 Config 时使用同一批元数据，避免新建表后还要靠后续同步修复 Messages / Logs 链接或 App Script 升级目标
- 授权后完成初始化并刷新到管理页时，会显示一次性完成收据，概括 Sheet、子表定位、Deployment、Script、触发器状态和共享/权限注意事项；关闭后不再重复打扰
- 通常 10-15 秒完成自动步骤；如果需要开启 Apps Script API 或完成授权，会停在可恢复的下一步

### 2. 统一数据模型

- 用户友好的表格格式（无 JSON）
- 支持三种消息类型：Daily（按日期）、Hourly（按时间）、Periodic（周期性）
- 支持多种推送方式：AsMe、Bot、AI Report、Outreach（帮我问）
- 支持灵活的周期配置：日/周/月/年

### 3. 多种执行引擎

- **AppScript 引擎**：处理 AsMe 推送（通过 Email），24/7 可靠运行
- **Jira Automation 引擎**：处理 Bot / AI 类推送，解决内网访问限制
- **Outreach Runtime**：处理“帮我问”的模板同步、目标解析、发出、等回复与追问
- **Chrome Extension 备用**：浏览器开启时可直接执行
- 管理页列表和新增 / 编辑表单会显示真实执行引擎：例如 AsMe 是 AppScript 邮件 fallback 还是 Jira Automation RingCentral sender，Bot/AI 是否依赖 Bot executor，JiraAutomation 是外部规则还是托管 API，Outreach 是否由 memory-service runtime 接管。缺少前置配置时显示为需要修复，而不是只展示 `Push_Method`。

### 4. 智能调度

- 自动计算下次执行时间
- 支持重复次数限制
- 自动标记已完成任务
- 记录执行日志
- 日期和时间按本机本地时间保存，避免接近午夜时被 UTC 转换成前一天 / 后一天
- 执行时间必须是有效的本地时间（00:00-23:59），异常值会在管理界面提示并被执行器跳过
- 周期任务的 `End_Date` 包含结束日当天；达到 `Repeat_Count` 后会在本次成功发送后收尾
- 所有周期单位（天 / 周 / 月 / 年）都可以设置重复次数上限；周重复不会再丢失 `Repeat_Count`
- 一次性任务、到达 `End_Date` 或达到 `Repeat_Count` 的周期任务成功收尾后会清空 `Next_Exec`，列表中显示为已完成，避免误以为还有下一次发送
- 已完成的单次任务如果被改到未来执行时间，会自动从 `Done` 恢复为 `Active`，并清空上次执行时间以允许重新推送
- Outreach / 帮我问模板同步到 memory-service 后会保留 `Repeat_Days`、`End_Date` 和 `Repeat_Count`，运行态发问节奏与表单预览保持一致
- 周期任务的预计执行和保存校验会同步检查 `End_Date`；如果结束日前已经没有下一次可执行日期，表单会阻止保存并提示用户调整结束日或重复规则
- 周重复任务的预览和 `Next_Exec` 始终指向未来的有效执行日，今天时间已过时会自动跳到下一个匹配星期
- 列表里的频率文案与实际调度保持一致：Day 重复会标明“仅工作日”，`Repeat_Every > 1` 且选择多个星期时会显示“每 N 周的周一/三/五”，避免把隔周任务误看成每周任务
- 新建 / 编辑表单会在执行预览中显示本机时区和 UTC offset，并把“明确 08:00”和“08:00 后队列”区分展示，降低跨时区和队列语义误解

### 5. 灵活的表格结构 ✨

- **动态列位置识别**：通过 header 行自动识别列的位置
- **支持自由调整列顺序**：用户可以在 Google Sheet 中随意调整列的顺序
- **自动适配读写**：系统自动根据 header 确定数据的读取和写入位置
- **向后兼容**：自动适配旧版本和新版本的表格结构

### 6. 列表筛选与恢复路径

- 管理页支持按类别、待审核状态和“过滤掉仅发我的”筛选消息
- 筛选结果为空时会显示明确空状态和“清除筛选”按钮，不再只留下空表格
- 筛选逻辑由共享 helper 统一处理，便于入口链接和 UI 保持一致
- 自动答复通知中的“点击审核或取消”链接会带上 `messageId`，管理页打开后直接定位目标消息，并提供返回完整列表的恢复路径
- 管理页的表格入口按任务拆分：“推送记录”打开 Logs；空状态和页脚的 Google Sheet 入口打开 Messages 维护表，避免批量编辑时误进日志页
- 状态列只展示状态；暂停 / 恢复改为行内显式按钮。`PendingReview` 必须通过批准 / 拒绝处理，`Done` / `Completed` 需要编辑到未来执行时间后恢复，避免误触绕过审核或重启已完成消息
- 新增 / 编辑保存成功后会自动定位刚保存的消息行，并在 URL 写入 `messageId`；如果删除的正是当前定位行，页面会清除定位并返回完整列表，避免停在一个已不存在的消息过滤状态
- 删除确认会列出消息 ID、状态、下次执行、频率和接收目标；托管 JiraAutomation 消息删除前会按本机时区把本地计划时间还原成 Jira 需要的 UTC trigger 时间，恢复前置检查或 Jira trigger 恢复失败时不会删除本地行
- 行内编辑 / 删除按钮带有包含消息标题的可读标签，便于键盘、辅助技术和自动化验证直接操作目标消息

### 7. 队列健康提示

- Bot / AI / JiraAutomation 消息由 Jira Automation 每分钟执行一条；管理页会汇总同一执行时间的排队情况
- 只有带有效 `AI_Endpoint` 的 JiraAutomation 消息会进入统一执行器队列；空白 endpoint 的外部规则不会被误判为 Bot / AI 队列
- 当同一时间槽可能超过 30 分钟补偿窗口时，顶部会显示风险提示，并列出受影响的时间槽和示例消息
- 明确时间的同槽排队会给出“改到建议”操作；即使尚未超出补偿窗口，也能把最晚受影响的消息改到下一个清晰分钟
- 队列卡片会说明建议处理项前面还有多少条待执行，并展示前序消息示例，帮助用户判断是改最晚项、编辑前序项，还是接受当前延后
- 新增 / 编辑表单会实时提示当前消息在同槽队列中的位置；高风险时间会阻止保存，避免创建后才发现不会按预期发送
- 新增 / 编辑表单在明确时间已经拥挤时会直接给出“使用建议时间”；无时间队列如果快排到执行日结束后，会优先建议下一天默认队列日期，并清空执行时间保留“08:00 后队列”语义，减少手工试错
- 无时间的 08:00 后队列会把当天后续明确时间消息占用的分钟扣掉；如果明确时间已经吃掉剩余容量，队列卡片会说明“已避开明确时间分钟”，并把最晚受影响项建议到下一可用队列日
- 已有 Active 消息如果因为手工改 Sheet 或长期未打开而错过可执行窗口，管理页会在顶部和行内提示需要改期；用户可以编辑为未来明确时间，或对执行器消息清空时间进入 08:00 后队列
- 错过执行窗口或执行时间格式异常时，顶部健康告警会给出“一键改期”：明确时间改到下一分钟，未设时间的执行器消息改回今天的 08:00 后队列，减少手工编辑阻塞
- 多条明确时间消息同时错过窗口时，一键改期会按告警顺序分配连续可用分钟，并在告警行直接显示建议目标和原因，避免把所有恢复操作重新挤到同一个分钟
- 未设时间的执行器消息错过日期后，健康告警会先检查今天默认队列是否还剩可执行分钟；如果已经接近跨日或同批恢复会挤爆今天队列，就改到下一个可用默认队列日，避免“一键恢复”后立刻再次错过
- 需要改期的消息超过 4 条时，顶部健康告警可展开显示全部，保证每条阻塞项都有定位、编辑和一键改期入口

### 8. 执行匹配、补偿与幂等

- 当前实现不使用独立 `Priority` 字段；同一执行槽命中多条 Bot / AI / 带 `AI_Endpoint` 的 JiraAutomation 消息时，按 Messages 表格行顺序每分钟执行第一条
- 执行器按三段顺序匹配：当前分钟显式时间消息、过去 30 分钟补偿窗口、执行日 08:00 后未填写时间的队列消息
- 显式时间只允许准点或最多迟到 1 分钟的触发器抖动容差，不会提前发送；补偿窗口支持跨午夜恢复
- `Last_Exec`、`Exec_Log` 和 `Execution_Key` 共同提供轻量幂等：当天成功或失败的消息都会跳过，避免失败项阻塞后续队列或 Jira 重试造成重复发送
- `markBotMessageExecuted` 会携带 `messageId` / `rowIndex` / `executionKey` 写回，Sheet 行移动、缺失 rowIndex 或 Jira 重试时仍能定位并去重
- 当未填写时间的执行器队列排到当天结束后，建议改期会继续保持 `Schedule_Time` 为空，而不是改成明确 `08:00`；这样用户看到的“08:00 后队列”不会被一键恢复误改成准点优先执行
- 健康告警的一键改期建议会避开已存在的未来明确执行分钟；批量修复错过项时不会把恢复动作重新制造成同槽排队
- `AI_Body` 支持 `{Topic}`、`{Content}`、`{TeamID}` 和 Timeline 变量；变量替换会做 JSON 字符串转义，避免正文里的引号、反斜杠或换行破坏外部 API body

### 9. Config 同步与跨设备恢复

- `Config` 工作表是跨设备恢复来源，`chrome.storage.local` 只是本机运行缓存；同步时先写 Sheet，再写本地，避免出现“本机成功但另一台设备无法恢复”的半同步状态
- Config 写入使用 Google Sheets `RAW` value input option，保留 rule id、URL、ISO 时间戳、JWT 状态等精确字符串
- 每次写回会带上 `last_sync_action`，例如一键初始化、手动绑定、Bot 配置、Sheet schema 更新或 App Script 元数据更新；手动绑定冲突时会把这个来源和字段差异一起展示，方便判断最近是谁改过配置
- 写回时只替换系统管理键，保留用户或后续功能添加的自定义 Config 键；重复的系统管理键会收敛成单行，重复 `last_sync_time` 会按真实时间取最新值
- 写回前会比较远端 `last_sync_time`：远端更新时暂停写入并要求重新读取；同表但本机较新、时间相同或时间缺失且关键字段不同，会展示字段级差异让用户选择保留本机或使用 Sheet
- 管理页“同步”会先读取 Sheet Config；只有 Sheet 明确更新时才刷新本机缓存，并在页面横幅展示同步时间、最近动作和采用的配置来源。时间相同但内容有差异时不会静默覆盖。
- 手动绑定支持 Google Sheets / Drive URL、`/spreadsheets/u/0/d/...` 路径和完整 Sheet ID；非 Google URL 不会因为普通 `id` 参数被误识别为维护表
- 切换到另一张维护表前会进入确认流程；Webhook、JWT、client secret 等敏感值只显示配置状态，不展示原文
- App Script 版本元数据也走 Sheet-first 完整同步；升级成功并确认当前 Web App URL 已返回目标版本后，才把 Sheet / Storage 标记为最新

### 10. Timeline 缓存与 Jira Groovy Map 兼容

- Timeline Sync Rule 每天 05:00 按项目读取内网 release info，并把每个项目缓存到 Apps Script Script Properties；Executor Rule 每分钟只读取缓存，不再在执行请求里携带完整 releaseInfo
- 当前生成的 Timeline Sync Rule 对 App Script `WEB_APP_URL` 回调必须保持 `GET`，URL 包含 `action=cacheReleaseInfo`、`project` 和 URL 编码后的 `releaseInfo`；不要改成 POST，Jira Automation 对 Apps Script `ContentService` 的 POST 302 重定向兼容性仍有风险
- Apps Script 仍保留 POST JSON、旧 inline 参数和 Groovy/Java Map fallback parser，主要用于旧 Rule、手工诊断或兼容输入；当前可维护路径以生成的 GET Rule 为准
- `cacheReleaseInfo` 会校验项目、schema、嵌套深度、字符长度、Script Properties 单值约 9KB 限制，以及至少一个 `MM/DD/YYYY` milestone 日期；非法日期、空日期或非字符串 milestone 不会出现在 UI 可选项里
- Timeline 项目在界面和执行端会兼容项目显示名与 Jira Sync Rule 参数名，旧 Sheet 或手工行里保存的 `jupiterWeb` 这类参数不会因为状态面板或执行器只认 `Jupiter web` 而静默跳过
- Timeline 缓存状态面板会展示最近同步摘要、错误码、`requestId`、执行影响和下一步排障建议；扩展里的 dry-run 也走 GET + `dryRun=true`，不会写入缓存或覆盖真实 Jira 同步诊断
- 新增 / 编辑不会因为缓存缺失而阻止保存，但会明确说明执行后果：Timeline 触发会跳过到项目缓存可用且包含所选 Milestone，普通定时消息里的项目变量会在缓存不可用时保留原样
- 如果看到 `INVALID_POST_JSON`，通常说明手工规则仍在用 POST 或 body 不是合法 JSON；当前修复方向是把 Apps Script 写缓存请求改回生成规则的 GET URL

### 11. App Script 自动更新

- App Script 自动更新使用 Google Apps Script API 的 `deployments.update` 更新现有 Web App deployment，保持 Web App URL 不变，避免用户重新配置 Jira Automation
- 当前模板版本来自 [app-script-template.gs](/Users/Esone/git/personal-ai/src/scheduled-messages/app-script-template.gs)：

  ```javascript
  var APP_SCRIPT_VERSION = '2.8.5';
  var APP_SCRIPT_LAST_UPDATED = '2026-05-28';
  ```

- 后台静默检查只复用已缓存授权，不在页面加载时弹出授权窗口；用户手动点击“检查脚本”或“升级调度系统”时才触发交互式授权
- 升级前会验证模板版本是合法 SemVer、匿名读取当前 Web App `getVersion`、匹配正式 deployment 的 Web App URL、通过 `projects.getContent` 确认远端项目属于 Personal AI 调度脚本，并预检 Project History 200 个版本上限
- 版本探测会使用不携带 Chrome profile cookie 的匿名请求，避免 Google 多账号登录态重定向到错误的 `/u/N/` 账号上下文；版本探测临时失败或非 JSON 响应不会被当成旧版脚本，非 JSON 响应也不会按旧版脚本继续升级
- 如果“检查脚本”无法确认版本，管理页会保留当前脚本不变，并提供直接打开 `getVersion` 版本端点和 Apps Script 项目的排障入口，方便确认 Web App URL、访问权限或 deployment 状态
- 若线上 Web App 已是最新或更高版本时直接跳过脚本写入和版本创建，只同步配置状态
- 写入前会预检是否存在可更新的正式 Web App deployment、确认 Web App URL 匹配、读取远端项目代码确认 Personal AI 调度脚本标记，并检查 Project History 版本额度
- 当 Project History 已满或接近 200 个版本上限时，升级提示会同时提供 Project History 入口和“重新检查”，用户清理旧版本后不用刷新页面就能重新读取额度并继续升级
- 只有写入代码、创建版本、`deployments.update` 成功，并且当前 Web App URL 的 `getVersion` 已确认返回目标版本后，才同步 Sheet / Storage 里的版本字段
- 部署生效确认未确认返回目标版本时，不会把配置标记为最新
- 如果 deployment 已提交但版本端点无法确认目标版本，系统会尝试把 deployment 回退到升级前的 versionNumber，并在 UI 中保留可恢复的错误说明

## 使用方法

### 首次使用

1. 点击 Personal AI 插件图标
2. 选择"⏰ 定时消息管理"
3. 点击"🚀 一键生成维护表"按钮
4. 等待系统创建维护表、Apps Script 项目和 Web App；页面会显示初始化收据，包括 Messages / Logs 子表定位和 Web App deployment
5. 打开授权页面并授权 Apps Script，然后回到管理页继续初始化
6. 初始化完成后，分钟触发器、示例消息和 Config 会写入维护表；刷新到管理页后会显示一次性完成收据，如果组织内共享失败，维护表仍保持仅创建者可编辑
7. 一分钟后，您将收到测试消息

### 创建定时消息

#### 方式一：在 Google Sheet 中添加

1. 点击"打开 Sheet"按钮
2. 在 Messages 表中添加新行
3. 填写必要字段：

   - **ID**: 唯一标识（如 msg_001）
   - **Topic**: 消息主题
   - **Content**: 消息内容
   - **Schedule_Date**: 执行日期（YYYY-MM-DD）
   - **Schedule_Time**: 执行时间（00:00-23:59，本地时间，可选）
   - **Push_Method**: 推送方式（AsMe/Bot/AI/Outreach）
   - **Owner**: 创建者
   - **Status**: 状态（Active/Paused/Completed）

   **AsMe 推送额外字段**：

   - **Glip_User_Name**: 接收人用户名（如"Esone Qiu"）

   **Bot 推送额外字段**：

   - **Glip_User_Name**: 私聊时的用户名（填写则为私聊）
   - **Glip_Team_ID**: 群组推送时的群组 ID（填写则为群组推送）
   - 💡 **推送类型自动判断**：系统根据 Glip_User_Name 和 Glip_Team_ID 自动识别私聊还是群组

   **AI 推送额外字段**：

   - **AI_Endpoint**: API 端点（必填），格式：`POST https://example.com/api`、`GET https://example.com/api` 或仅 URL（默认 GET）
   - **AI_Headers**: HTTP 请求头（可选），每行一个，格式：`name: value`
   - **AI_Body**: 请求体（必填），JSON 格式，支持使用 `{Topic}`、`{Content}` 变量

   **Outreach / 帮我问额外字段**：

   - **Content**: 实际要问的问题
   - **Glip_User_Name**: 目标是某个人时填写
   - **Glip_Team_ID**: 目标是某个群时填写
   - 信息目标/完成标准、目标解析、追问策略和运行态结果下沉到 memory-service；新表不再把这些运行态字段作为 Sheet 主 schema 保存

#### 方式二：通过管理界面创建

1. 点击管理页面右上角的“➕ 新增”按钮
2. 填写消息主题、内容以及执行时间
3. 选择推送方式：AsMe / Bot / AI Report / 帮我问
4. 按提示填写对应字段：
   - **AsMe**：按接收人添加人名标签
   - **Bot**：选择私聊或群组，并填写 Glip 用户名或群组 ID
   - **AI Report**：选择模板（AI report / PEP report / Multiple Jira Query / 自定义），系统会为每个模板分别记住 Endpoint / Headers / Body
   - **帮我问**：选择问某个人还是某个群，填写问题、信息目标和追问策略
5. AI Report 模式下默认选中 **AI report** 模板，切换到 **自定义** 时可以手动填写并保存专属配置
6. 执行日期 / 时间支持快捷选择：1 分钟后、下个整点、下次默认时间（AsMe 09:00，Bot / AI / JiraAutomation 08:00）或清空时间
7. 表单会显示预计下次执行时间和本机时区；一次性任务若已经错过可执行窗口，会提示改成未来时间
8. 周期任务若因为结束日期或重复星期设置导致没有下一次执行机会，会在预计执行区域显示“暂无可执行时间”，并阻止保存
9. 未填写执行时间时，AsMe 默认按 09:00 执行；Bot / AI / JiraAutomation 默认从 08:00 后进入队列，每分钟执行一条
10. 点击“✅ 创建消息”完成创建；保存成功后列表会自动定位到刚创建的行，并显示下一次执行时间

### 管理列表筛选

- “只看待审核”用于快速处理自动答复审核队列
- 类别筛选支持多个类别，按并集匹配
- “过滤掉仅发我的”用于隐藏只发给当前账号的个人提醒
- 从自动答复通知打开时，页面会优先展示目标消息；如果该消息已处理，仍会显示当前状态，避免用户在待审核列表中找不到记录
- 如果筛选后没有结果，页面会提示当前筛选条件并提供一键清除筛选
- 需要批量调整维护数据时，页面底部和空状态的 Google Sheet 链接会直接打开 `Messages` 工作表；需要查看发送历史时使用顶部“推送记录”按钮打开 `Logs`

### 队列健康查看

- 顶部队列提示只在存在同槽排队时出现；没有排队风险时不会占用界面
- 普通排队提示用于说明最大同槽数量和预计延后时间
- 明确时间槽出现排队时可以直接定位、编辑或把最晚受影响消息改到建议时间
- 每个拥挤槽位会标出“建议处理”的最晚消息，同时显示前面会先执行的数量和前序样例，避免用户只看到改期建议却不知道阻塞来源
- 风险提示表示至少一个时间槽可能超过 30 分钟补偿窗口，建议改成未来明确时间，或清空执行时间进入 08:00 后队列
- 未填写时间的执行器队列会扣除同一天未来明确执行时间占用的分钟；如果剩余可用分钟不足，卡片会显示已避开的明确时间分钟数，并建议保留空时间移动到下一可用队列日
- 创建或编辑消息时，如果系统已经能算出可避开拥挤队列的空闲分钟，预计执行区域会提供“使用建议时间”；未设时间的队列排满当天时会优先建议下一天 08:00 后队列，并保持执行时间为空
- 如果顶部提示“有定时消息需要改期”，表示有 Active 一次性消息已经错过实际执行窗口或时间格式异常；这些消息不会只靠等待自动恢复，需要从列表行进入编辑并改成未来时间
- 健康提示里的“一键改期”会直接把目标消息恢复到可执行窗口：明确时间改到下一分钟，未设时间的执行器消息改到今天的默认队列，AsMe 默认时间已过时会移到下一个默认发送日
- 如果今天的执行器默认队列已经没有剩余分钟，或同批恢复会让后面的未设时间消息排到今天结束后，健康提示会把后续项改到下一个可用默认队列日
- 当需要处理的健康告警超过 4 条时，先显示前 4 条和隐藏数量；点击“显示全部”后可逐条处理其余消息
- 表单打开时会自动刷新时间判断，长时间停留后仍能正确阻止已错过的执行时间

### 消息类型说明

#### Daily（按日期）

- 在指定日期执行一次
- 必填字段：Schedule_Date

#### Hourly（按时间）

- 在指定日期的指定时间执行一次
- 必填字段：Schedule_Date, Schedule_Time

#### Periodic（周期性）

- 按固定周期重复执行
- 必填字段：Schedule_Date, Repeat_Every, Repeat_Unit
- 可选字段：End_Date（结束日期）, Repeat_Count（重复次数）, Repeat_Days（多选日期）
- End_Date 表示最后允许执行的日期，结束日当天仍会执行匹配的任务
- Repeat_Count 表示最多成功发送次数，适用于天 / 周 / 月 / 年重复任务
- Repeat_Unit 可选值：
  - Day: 每 N 天（排除周末）
  - Week: 每 N 周
    - 支持多星期选择：可通过 Repeat_Days 指定一周多天执行（如周一、三、五）
    - Repeat_Days 格式：逗号分隔的数字（0=周日, 1=周一...6=周六）
    - 示例：`1,3,5` 表示每周一、三、五执行
    - `Repeat_Every > 1` 时会按开始周计算间隔，例如每 2 周的周一/三/五不会退化成每周执行
    - 特殊情况：工作日（1,2,3,4,5）、周末（0,6）会显示为"工作日"、"周末"
  - Month: 每 N 个月
  - Year: 每 N 年

### 推送方式说明

#### AsMe（以我的身份发送）

- 默认通过 Google Mail 发送邮件到 Glip 邮箱，在 Glip 中显示为用户本人发送的消息
- 自动生成 fallback 邮箱地址：
  - `Esone Qiu` → `esone.qiu@reply.ringcentral.glip.com`
  - 或直接使用群组 ID：`{teamId}@reply.ringcentral.glip.com`
- 如果 Bot 初始化时配置了 RingCentral Client ID / Client Secret / JWT，AsMe 会改由 **Jira Automation** 调内网 Dify RingCentral sender workflow 发送
- RingCentral sender 路径继续复用 `Glip_User_Name` / `Glip_Team_ID` 作为 Dify `chatId`；例如 `Glip_User_Name = esone.qiu` 会传给 Dify 的 `chatId`
- RingCentral sender 不再在领取消息时预标记完成；Jira Rule 会在 Dify workflow 返回 `data.status = succeeded` 后通过 GET 调用 `markBotMessageExecuted` 写回 Done 和 Logs，返回 `failed` 时写入失败日志避免当天重复发送；发送成功后的 `chatId/postId/sentAt` 记录在 Logs 单次执行行中，用于 Glip message marker
- 未配置或关闭 RingCentral sender 时，仍由 **AppScript 引擎**执行邮件 fallback
- 2026-05-26 起，表单和列表会直接显示当前 AsMe 实际执行路径，避免用户误以为所有 AsMe 都走同一个引擎。
- 老版本 Sheet 如果已有 Bot executor rule 但没有 `ringcentral_sender_*` 配置，新建消息弹窗选择 AsMe 时会提示配置 @ 人发送能力；提交完整 RingCentral credentials 后，会先删除低于 v1.4.0 的旧 executor rule，再创建支持 Dify sender 的新版 rule

#### Bot（机器人身份发送）

- 通过 Jira Automation 调用内网 Bot API
- 在 Glip 中显示为机器人发送的消息
- Bot 路由和凭据由扩展配置 / Jira Automation 规则维护，不需要在单条消息里额外填写专属 endpoint 字段
- 由 **Jira Automation 引擎**执行（同时负责 AI 推送），解决内网访问限制

#### AI Report（AI 报告推送）

- 通过 Jira Automation 调用外部 API，发送结构化报告
- 提供 **AI report / PEP report / Multiple Jira Query / 自定义** 四种模板，并为每种模板保留独立配置
- `AI_Endpoint` 与 `AI_Headers` 会根据模板自动填充，可随时切换；`AI_Body` 可直接编辑并支持 `{Topic}`、`{Content}` 变量
- 自定义模板支持完全自由填写 Endpoint / Headers / Body，切换模板时系统会记住各自的输入

#### Outreach（帮我问 / 主动询问）

- 这不是普通消息推送，而是一个 **主动询问计划**
- Sheet 中保留的是计划入口；真正的运行时状态在 memory-service 的 `outreach_templates / outreach_sessions / outreach_events`（表名沿用内部 template 命名）
- 发送前会先做 **目标解析**，确认应该问谁
- 真正触发时会先做 **答案预检**
  - 第一层：检查目标群 / 目标私聊在本次计划窗口内的最近会话消息
  - 第二层：检查全局记忆中是否已经存在其他群里的相关答复
- 如果在发送前已经命中答案，则 **不发出消息**
- 如果在等待回复期间仍未收到直接回复，每次追问前也会再次做同一套预检；若已命中答案，则 **不再追问**
- `Outreach_Context` 在兼容层仍沿用旧列名，但产品语义是 **信息目标 / 完成标准**：答案预检、直接回复判断和外部查证都必须判断证据是否满足这个目标；只拿到部分线索时保持等待或继续追问，不把 `partial` 当成 `resolved`
- 用户在定时消息列表中看到的是计划状态和最近结果；更完整的证据、命中阶段、来源与相关消息会在“主动询问 / Outreach Sessions”页面中查看
- 系统会为 Outreach 动态挂载内部观察规则用于证据采集，但这些规则不会显示在“记忆入口规则”或 “Follow Threads” 列表中
- 周期性 Outreach 计划复用定时消息的本地日历语义：Day 排除周末，Week 支持多星期，End_Date 包含当天，Repeat_Count 达到后不再生成下一次发问
- 循环计划本身会留在“待触发计划”里；每个周期会独立创建一个 `outreach_sessions` occurrence，已发出 / 已完成的 occurrence 进入历史记录
- 每个 occurrence 会记录 `scheduled_for`、`occurrence_key` 和 `occurrence_start_at`；循环计划的 `occurrence_start_at` 优先取上一条 occurrence 的终态时间，发送前答案预检只把本次窗口内的证据当成本周期答案，避免用上一周的结论误判本周已经完成
- `scheduleSpec.timezone` 记录创建计划时的本地时区，服务端会按该时区解释 `Schedule_Date` / `Schedule_Time`，避免本地 10:36 被服务端时区漂移成 18:36

#### Outreach 典型状态

- `pending_approval`：目标未解析完成，或需要人工批准后才能发出
- `scheduled`：已排程，等待发送
- `waiting_reply`：已经发出，正在等答复
- `deferred`：对方表示稍后回复，系统等待新的时间点
- `resolved`：已获得满足信息目标的可用结果，可能来自直接回复，也可能来自发送前 / 追问前的答案预检
- `no_reply`：达到等待和追问上限，仍然没有有效答复
- `escalated`：需要人工介入处理
- `failed`：发送、轮询或配置异常

**预设模板默认值**：

- **AI report（Dify）**

  - Endpoint：`POST https://dify.int.rclabenv.com/v1/chat-messages`
  - Headers：
    - `Authorization: Bearer app-hTAaR1jaLnYDITixXRP5qi4Y`
    - `Content-Type: application/json`
  - Body：
    ```json
    {
      "response_mode": "blocking",
      "user": "default-user",
      "query": "{Topic}",
      "inputs": {
        "title": "{Topic}",
        "outputs": "noduedate, overdue, toTest",
        "jql": "{Content}",
        "extraText": "",
        "teamId": "",
        "mentionList": ""
      }
    }
    ```

- **PEP report（GitLab Reviewer）**

  - Endpoint：`POST https://gitlab-reviewer.int.rclabenv.com/pep_daily_report`
  - Headers：`Content-Type: application/json`
  - Body：
    ```json
    {
      "jira_query_id": 111,
      "sheet_id": "",
      "sheet_name": "",
      "team_id": "",
      "mention_list": [],
      "overallFilterId": "",
      "bugFilterid": "",
      "ignore_due_soon": true,
      "force_running": true,
      "missing_due_check_scope": "all",
      "language": "",
      "milestones": [
        {
          "abbreviation": "MR",
          "full_name": "Code Merge",
          "goal": "提测所有功能及安排在本Release的Production Bug"
        },
        {
          "abbreviation": "FF",
          "full_name": "Feature Freeze",
          "goal": "1）完成所有功能测试；2）完成安排在本Release的所有Production和Release Bug (接近FF 2天内的P2 bug可以Regression阶段修复）"
        },
        {
          "abbreviation": "CF",
          "full_name": "Code Freeze",
          "goal": "完成所有本Release的功能开发、测试和Bug修复。完成Sign off。提供Dogfooding Build"
        }
      ]
    }
    ```

- **Multiple Jira Query report**

  - Endpoint：`POST https://pep.int.rclabenv.com/multiple_jira_query_notify`
  - Headers：`Content-Type: application/json`
  - Body 默认包含 `team_id` 和多条 Jira query 配置，可按团队报告需求调整

- **自定义**：Endpoint / Headers / Body 均由用户填写，模板切换后仍会保留已输入内容

- 🎯 **单条消息推送**：每分钟执行一条（覆盖 Bot / AI），避免批量失败
- 📊 **三级优先级**：当前分钟 > 过去 30 分钟 > 未指定时间（8 点后）
- 🛡️ **智能过滤**：自动跳过今日已成功/已失败的消息
- 🔄 **自动重试**：失败消息第二天自动重试

## 技术架构

### 数据流

```
用户操作
    ↓
Chrome Extension 管理界面
    ↓
Google Sheets（统一数据源）
    ↓
    ├─→ AppScript Trigger（AsMe 推送）
    │   └─→ minuteTrigger（每分钟统一检查时间 / 周期 / Timeline）
    │
    └─→ Jira Automation（Bot/AI 推送）
        └─→ 每分钟读取 Sheet，调用 Bot/AI API
    ↓
memory-service runtime（Outreach）
    ├─→ 模板同步 / runtime overlay
    ├─→ 目标解析
    ├─→ 发送前答案判定
    ├─→ 等待回复 / 追问前答案判定
    └─→ 会话结果与证据展示
```

### 核心组件

#### 1. SheetInitializer

- 负责一键创建 Google Sheet
- 创建 AppScript 项目
- 设置触发器
- 部署 Web App

#### 2. ScheduledMessageService

- 封装 Google Sheets API 操作
- 提供 CRUD 接口
- 计算下次执行时间
- **动态列映射**：
  - 读取时：通过 header 动态解析每行数据
  - 写入时：根据 header 顺序动态生成行数据
  - 缓存机制：header 结构缓存，提升性能
  - 自动同步：同步数据时清除缓存，确保获取最新列结构

#### 3. AppScript 执行引擎

- `minuteTrigger()`: 每分钟执行，统一处理一次性、周期性和 Timeline 类型
- `doGet()`: Web App 端点，供 Jira Automation 调用

#### 4. Jira Automation 执行器（v2 架构）

- 由两条 Jira Automation Rule 组成：
  - Executor Rule 每分钟触发一次 Webhook 调用 AppScript
  - Timeline Sync Rule 每天 05:00 按项目刷新 releaseInfo 缓存
- Timeline 缓存状态在创建/编辑相关消息时展示；用户从 Jira 手动同步或修复规则后回到扩展，会自动刷新状态并在诊断中区分“缓存不可用”和“缓存仍可用但最近同步失败”。状态面板可直接运行 Apps Script dry-run 测试，也保留复制 curl 的手工排障路径。
- 302 重定向兼容说明：Google Apps Script `ContentService` 会把文本响应重定向到 `script.googleusercontent.com` 的一次性 URL，Jira Automation Send web request 对第三方 POST 重定向仍有兼容风险（AUTO-2123）。
- 因此 Jira Rule 里所有指向 AppScript `WEB_APP_URL` 的调用都保持为 GET；`markBotMessageExecuted` 使用 `messageId` / `rowIndex` / `executionKey` 的短 URL 写回，避免 Jira 在 POST 302 上停住导致消息重复推送。
- `cacheReleaseInfo` 按项目缓存并记录最近同步尝试摘要；`markBotMessageExecuted` 携带 `messageId` / `rowIndex` / `executionKey` 做行定位和幂等写回，避免 Sheet 行移动、Jira 重试或特殊字符导致误标记、重复记账或静默失败。
- Timeline Sync Rule 逐项目调用内网 release info API 并通过 GET 写入 Script Properties；单个项目缓存失败不会阻断后续项目，Apps Script 会拒绝格式异常、未知项目、空 release info 或超出单值大小限制的写入，并返回可读错误。
- 首次配置或修复 Timeline Sync Rule 后，用户可以手动运行一次 Sync Rule 让缓存立即生效；新增/编辑 Timeline 消息或使用 `{currentRelease}`、`{nextPhase}` 等项目变量时，管理页会读取所选项目的缓存状态并展示执行影响，但不会阻止保存草稿。
- 缓存状态接口只暴露项目状态、Milestone key 和最近同步尝试摘要，不暴露具体 release 日期；如果接口返回 HTML、空响应或 Apps Script 错误对象，管理页会显示升级/排查提示，不会把异常响应当成有效缓存。
- 旧 inline `releaseInfo` GET 参数仍保留解析能力，主要用于兼容旧 Rule 或手工调试；维护 Timeline 项目时要保持 `app-script-template.gs` 的 `TIMELINE_PROJECT_PARAM_MAP` 与前端项目清单一致。
- AppScript 执行完整流程：
  1. 按优先级选择单条消息（当前分钟 > 过去 30 分钟 > 未指定时间）
  2. 过滤今日已成功/已失败的消息
  3. Timeline 消息从缓存读取项目 Milestone 信息；缓存缺失时跳过 Timeline，不影响普通时间消息
  4. 调用内网 Bot API 或外部 AI API 发送
  5. 更新执行日志到 Sheet
- **优势**：失败消息不阻塞队列，全天分散推送未指定时间的消息

#### 5. Outreach Runtime

- 将 `Push_Method = Outreach` 的定时消息同步成主动询问计划
- 运行时状态通过 overlay 回写到定时消息列表，例如：
  - `Outreach_Sync_State`
  - `Outreach_Runtime_Status`
  - `Outreach_Last_Session_ID`
  - `Outreach_Result`
  - `Outreach_Last_Updated`
- 对循环计划，只结束本次 occurrence/session，不会因为一次 `resolved` 就把整个计划永久视为 Done
- 真正的会话详情和证据查看入口在 `memory-exploring.html#/outreach`

## 配置说明

### Messages 表字段

| 字段               | 类型     | 必填 | 说明                                                 |
| ------------------ | -------- | ---- | ---------------------------------------------------- |
| ID                 | String   | ✅   | 唯一标识                                             |
| Topic              | String   | ✅   | 消息主题                                             |
| Content            | String   | ✅   | 消息内容                                             |
| Schedule_Date      | Date     | ✅   | 执行日期 (YYYY-MM-DD)                                |
| Schedule_Time      | Time     | ❌   | 执行时间（00:00-23:59，本地时间）                    |
| End_Date           | Date     | ❌   | 结束日期（包含当天）                                 |
| Repeat_Every       | Number   | ❌   | 重复间隔                                             |
| Repeat_Unit        | Enum     | ❌   | Day/Week/Month/Year                                  |
| Repeat_Count       | Number   | ❌   | 重复次数                                             |
| Repeat_Days        | String   | ❌   | 多选日期（周模式：0=周日,1=周一...6=周六，逗号分隔） |
| Timeline_Project   | String   | ❌   | Timeline 触发项目                                    |
| Timeline_Milestone | String   | ❌   | Timeline 触发里程碑                                  |
| Timeline_Offset    | Number   | ❌   | Timeline 偏移天数                                    |
| Push_Method        | Enum     | ✅   | AsMe / Bot / AI / JiraAutomation / Outreach          |
| Glip_User_Name     | String   | ❌   | 接收人用户名（AsMe、Bot 私聊或 Outreach 个人目标）   |
| Glip_Team_ID       | String   | ❌   | 群组 ID（Bot 群推送、AI 报告或 Outreach 群目标）     |
| Attachment         | String   | ❌   | 附件文件名                                           |
| AI_Endpoint        | String   | ❌   | AI API 端点（AI 推送必填）                           |
| AI_Headers         | String   | ❌   | AI API 请求头（多行文本，每行一个 header）           |
| AI_Body            | String   | ❌   | AI API 请求体（JSON，支持 {Topic}/{Content} 变量）   |
| Category           | String   | ❌   | 分类标签                                             |
| Automation_Link    | String   | ❌   | Jira Automation Rule 链接                            |
| Status             | Enum     | ✅   | Active/Paused/Completed                              |
| Last_Exec          | DateTime | ❌   | 最后执行时间（自动）                                 |
| Next_Exec          | DateTime | ❌   | 下次执行时间（自动）                                 |
| Exec_Count         | Number   | ❌   | 执行次数（自动）                                     |
| Exec_Log           | String   | ❌   | 执行日志（自动）                                     |

说明：`Type` 由程序根据日期、时间和重复字段自动判断，不再作为新表 schema 保存。旧表中的 `Target_Type`、`Outreach_*`、`Outreach_Question` 等列会继续兼容读取，但 v2.7 起新表只把 Outreach 入口保存在 `Content / Glip_User_Name / Glip_Team_ID / Push_Method` 等基础列中，运行态以上游 memory-service 为准。`Sent_Chat_ID` / `Sent_Post_ID` / `Sent_At` 不属于 Messages 计划定义，发送结果统一写入 Logs。

### Logs 表字段

| 字段          | 类型     | 说明                                        |
| ------------- | -------- | ------------------------------------------- |
| Timestamp     | DateTime | 日志写入时间                                |
| Message_ID    | String   | 对应 Messages.ID                            |
| Topic         | String   | 实际发送主题                                |
| Content       | String   | 实际发送内容                                |
| Push_Method   | Enum     | AsMe / Bot / AI / JiraAutomation / Outreach |
| Target        | String   | 发送目标                                    |
| Status        | Enum     | Success / Failed                            |
| Error         | String   | 错误信息                                    |
| Exec_Count    | Number   | 第几次执行                                  |
| Execution_Key | String   | 单次执行幂等键                              |
| Sent_Chat_ID  | String   | 实际 RingCentral chatId，用于 Glip 标注     |
| Sent_Post_ID  | String   | 实际 RingCentral postId，用于 Glip 标注     |
| Sent_At       | DateTime | 实际发送时间                                |

### Config 表字段

| Key                                  | 说明                                                           |
| ------------------------------------ | -------------------------------------------------------------- |
| minute_trigger_id                    | 分钟触发器 ID                                                  |
| daily_trigger_id                     | 每日触发器 ID                                                  |
| web_app_url                          | Web App 地址                                                   |
| deployment_id                        | Web App deployment ID，用于 `deployments.update` 保持 URL 不变 |
| app_script_version                   | 当前线上 App Script 版本                                       |
| app_script_last_updated              | 当前线上 App Script 模板更新时间                               |
| jira_executor_rule_id                | Jira 执行器规则 ID                                             |
| bot_automation_executor_rule_id      | Bot/AI/AsMe RingCentral sender 执行规则 ID                     |
| bot_automation_timeline_sync_rule_id | Timeline Sync 规则 ID                                          |
| ringcentral_sender_enabled           | 是否启用 AsMe RingCentral sender                               |
| ringcentral_sender_client_id         | RingCentral sender Client ID                                   |
| ringcentral_sender_client_secret     | RingCentral sender Client Secret                               |
| ringcentral_sender_jwt               | RingCentral sender JWT                                         |
| ringcentral_sender_updated_at        | RingCentral sender 配置更新时间                                |
| sheet_version                        | 版本号                                                         |
| created_by                           | 创建者                                                         |
| created_at                           | 创建时间                                                       |
| last_sync_time                       | 最后同步时间                                                   |
| last_sync_action                     | 最近一次写回 Config 的触发来源                                 |

## 常见问题

### Q: 初始化失败怎么办？

A: 请检查：

1. 是否已登录 Google 账号
2. 是否授权了 Google Sheets 和 Apps Script 权限
3. 网络连接是否正常

### Q: 消息没有按时发送？

A: 请检查：

1. 消息状态是否为 Active
2. Schedule_Date 和 Schedule_Time 是否正确，Schedule_Time 必须是 00:00-23:59 的本地时间
3. AppScript 触发器是否正常运行（在 Google Apps Script 控制台查看）

### Q: 如何修改消息内容？

A:

1. 在管理界面点击消息右侧的编辑按钮，或打开 Google Sheet 找到对应行
2. 修改内容 / 时间 / 目标后保存
3. 下次执行时会使用最新配置

### Q: 为什么列表是空的，但总计不为 0？

A:
这通常是筛选条件没有匹配消息。点击空状态里的“清除筛选”即可恢复全部消息列表。

### Q: 如何暂停消息？

A:

1. 在管理界面点击消息右侧的“暂停 / 恢复”按钮，或在 Sheet 中将 Status 改为 "Paused"
2. 系统将跳过该消息的执行
3. 待审核消息不能直接恢复为 Active，请使用“批准 / 拒绝”；已完成消息要先编辑为未来执行时间再恢复

### Q: 如何删除消息？

A:

1. 在管理界面点击删除按钮，或打开 Google Sheet 删除对应消息行
2. 管理界面删除前会显示消息 ID、状态、下次执行、频率和接收目标，避免重复主题误删
3. 托管的 Jira Automation 规则会先按本机时区把本地时间换算为 Jira UTC trigger，尝试恢复原 trigger，再删除 Personal AI 记录；链接解析、项目权限或恢复请求失败时会保留本地行

### Q: 可以调整 Sheet 中列的顺序吗？

A:
✅ **完全支持！** 系统会自动识别列的位置：

1. 可以随意调整列的顺序（如把 Topic 移到第一列）
2. 可以隐藏不需要的列
3. 可以在中间插入新的列
4. 系统通过 header 行（第一行）自动识别每列的含义
5. 读取和写入数据时都会自动适配当前的列顺序

**注意事项**：

- ⚠️ 不要修改 header 行的列名（如 "ID"、"Topic" 等）
- ⚠️ 不要删除必要的列（如 ID、Status 等）
- ✅ 调整顺序后建议点击"同步"按钮刷新数据

### Q: Bot 消息推送失败怎么办？

A:

1. **自动处理**：失败的消息今天不会重试（避免阻塞队列），第二天自动重试
2. **手动重试**：打开 Sheet，清空失败消息的 `Last_Exec` 或修改 `Exec_Log`（移除 ❌）
3. **查看原因**：检查 `Exec_Log` 列的错误信息
4. **常见问题**：
   - Bot Token 过期：重新配置 Jira Automation Rule
   - Bot 路由配置异常：检查扩展中的 Bot 配置或 Jira Automation Rule 是否仍然有效
   - 权限不足：确认 Bot 有权限访问目标群组/用户

### Q: 看到错误 "Cannot read properties of undefined (reading '0')"？

A:
这个错误已在最新版本修复。如果仍然遇到：

1. **原因**：Apps Script 的 `markBotMessageExecuted` API 接收到不完整的参数
2. **解决方案**：
   - 确保 Google Sheet 中的消息有唯一的 `ID` 字段
   - 更新 AppScript 代码到最新版本（支持通过 messageId 自动查找）
   - 如果是从 Jira Automation 调用，确保 webhook 包含 `messageId` 参数
3. **技术细节**：最新版本的 `markBotMessageExecuted` 可以自动通过 `messageId` 查找对应的行，即使缺少 `rowIndex` 参数也能正常工作

### Q: Bot 消息为什么没有立即推送？

A:
Bot 消息采用**单条消息推送策略**，每分钟执行一条：

- ✅ **正常情况**：当前分钟的消息会立即推送
- ✅ **同时多条**：按优先级排队，5-10 分钟内全部推送完
- ✅ **未指定时间**：8 点后全天分散推送
- ⚠️ **超大量**：同时超过 30 条可能部分延迟或遗漏

### Q: 帮我问为什么到了触发时间却没有真的发出去？

A:
这通常不是失败，而是 **发送前答案判定已经命中**：

1. 系统一次性计划会检查计划创建以来的最近消息；循环计划会检查本次周期窗口内的最近消息
2. 如果没有，再检查全局记忆里是否已经在其他群拿到答案
3. 如果两层检测已经能确认证据满足信息目标，session 会直接标记为 `resolved`，不会再重复追问；如果只是部分相关或仍缺目标信息，会继续等待/追问

### Q: 帮我问的系统观察规则在哪里看？

A:
用户不会在“记忆入口规则”里看到这类规则。当前可见入口是：

1. 定时消息列表中的运行态摘要
2. “主动询问 / Outreach Sessions” 页面里的证据状态、命中阶段、命中来源和相关消息

系统内部观察规则是运行时能力，不是用户手动维护的规则列表。

## 最近更新

- 2026-05-20：把配置同步、执行匹配 / 补偿 / 幂等、Timeline 缓存排障和 App Script 自动更新规则归并到本文，移除对应子文档。
- 2026-05-20：核对当前 Timeline Sync Rule 仍以 GET 写缓存为准，POST JSON 仅作为旧链路和诊断兼容能力保留。
- 2026-05-22：队列建议会保留未填写时间的执行器队列语义；无时间队列溢出时一键建议清空 `Schedule_Time` 并改到下一可执行日期的 08:00 后队列。
- 2026-05-22：队列可视化补充“前面会先执行”的数量和前序样例，让改期建议的阻塞来源可见。
- 2026-05-25：Timeline 缓存面板补充执行影响提示，区分 Timeline 触发跳过和项目变量保留原样，避免缓存异常时保存看起来像完全可执行。
- 2026-05-28：Timeline 项目标识统一兼容显示名和 Jira paramKey，避免旧 Sheet 行、手工行或状态面板使用不同标识时出现“可见配置但执行跳过”的排障死角。
- 2026-05-26：错过执行窗口的批量一键改期会分配连续未来分钟，并在健康告警中直接显示建议目标与原因。
- 2026-05-27：管理页新增 / 编辑保存后会自动定位刚保存的行；删除当前定位行后会清除 `messageId` 并返回完整列表。该交互参考 Slack / Teams 对已排程消息的集中编辑、改期、删除路径，以及 Gmail 取消排程后回到草稿的可恢复语义。
- 2026-05-28：队列健康的一键改期现在会为未设时间的执行器消息检查当天剩余队列容量；跨日前或批量恢复溢出时改到下一个可用默认队列日。该策略参考 Apps Script time-driven trigger 可能抖动、Twilio scheduled message 的状态/失败可见性、Zapier run history 的错误恢复路径，以及触发-动作规则调试研究中“解释失败位置和下一步”的要求。
- 2026-05-29：08:00 后队列的容量判断会扣除当天未来明确时间及其前序 backlog 占用的分钟；改期建议不再把目标挪到仍会被前序消息占用的分钟，并在风险提示里解释已避开的明确时间分钟。
- 2026-05-27：App Script 自动更新检查失败时会直接提供版本端点和 Apps Script 项目入口；deployment 更新请求体同步带上 `scriptId`，贴合 Google Apps Script API 的 `deployments.update` 契约。
- 2026-05-29：一键初始化授权前后的收据现在会贯通 `messages_sheet_id`、`logs_sheet_id` 和 `deployment_id`，避免第二阶段用新的初始化器保存出缺失子表定位或缺失 deployment 的 Config；这个调整参考 Zapier / Power Automate 把自动化创建、测试和运行历史拆成可审计步骤，以及触发-动作研究中对 mental model 和调试线索的要求。
- 2026-05-30：App Script 自动更新在 Project History 已满或接近上限时增加“重新检查”，清理版本后无需刷新管理页即可恢复升级判断。
- 2026-05-31：管理页“同步”现在先刷新 Sheet Config，再加载 Messages；当 Sheet Config 比本机更新时会自动应用到本机缓存并展示同步来源，避免跨设备更新后的 App Script / Bot / Timeline 配置继续被旧缓存遮蔽。该调整参考 Airtable Sync 的源/字段/故障排查、Zapier 连接测试/重连，以及 trigger-action programming 研究中对心智模型和可调试性的要求。
- 2026-05-31：删除确认补充消息 ID、状态、目标和执行时间，托管 JiraAutomation 删除恢复 trigger 时改为按本机时区换算 UTC，并在恢复前置检查失败时保留本地行，而不是假设固定 UTC+8 或删除后再补救。这个调整参考 Slack / Gmail / Twilio 对已排程消息的取消、删除和状态边界，以及 end-user debugging 研究中“操作前看清对象和后果”的要求。
- 2026-06-04：一键初始化完成后会把授权前后的 Sheet / Script / Deployment / 子表 / 触发器信息压成一次性完成收据，在刷新后的管理页展示；这延续了 Zapier / Airtable 对自动化运行状态和排障路径的可见性，也避免用户只看到页面刷新而不知道哪些步骤已经成功。

## 未来规划

### Phase 2: Bot API 支持 ✅

- [x] Jira Automation 统一执行器（v2 单条消息推送）
- [x] 优先级调度系统（当前分钟 > 过去 30 分钟 > 未指定时间）
- [x] 失败消息智能过滤（避免阻塞队列）
- [ ] 从 Jira Automation 导入规则
- [ ] 批量导入 Scheduled 规则
- [ ] 每日同步 Jira rules 到 Sheet

### Phase 3: 高级功能

- [ ] RingCentral 聊天界面集成
- [x] 一键定时回复按钮
- [ ] AI 建议回复时间
- [x] 在管理界面直接创建/编辑消息
- [ ] 消息模板管理
- [ ] 执行历史查看

## 参考资料

- [Google Sheets API 文档](https://developers.google.com/sheets/api)
- [Google Apps Script 文档](https://developers.google.com/apps-script)
- [Google Apps Script Authorization](https://developers.google.com/apps-script/guides/services/authorization)：Web App 和 installable trigger 的运行身份会随部署和创建者变化，初始化收据要明确哪个 deployment 和触发器链路被记录
- [Google Apps Script Properties Service](https://developers.google.com/apps-script/guides/properties)：Apps Script 常用 key-value 字符串保存配置，说明 Config 表也应保留明确 key、value 和同步来源
- [Apps Script API 文档](https://developers.google.com/apps-script/api)
- [Google Apps Script deployments.update](https://developers.google.com/apps-script/api/reference/rest/v1/projects.deployments/update)：更新现有 deployment 时应明确 deployment config、版本号和 manifest，适合保持 Web App URL 不变的自动升级
- [Google Apps Script Versions](https://developers.google.com/apps-script/guides/versions)：版本是不可变快照，项目最多 200 个版本，管理页需要在升级前暴露额度和 Project History 清理路径
- [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)：Properties 单值大小上限为 9KB，Timeline 缓存需要提前提示 payload 大小和修复方向
- [Jira Automation 文档](https://support.atlassian.com/cloud-automation/docs/jira-automation/)
- [Jira Automation JSON smart values](https://support.atlassian.com/jira-software-cloud/docs/smart-values-json-functions/)：Send web request / JSON body 中的文本需要按 JSON 字符串转义，适合把 Timeline dry-run 和修复模板做成可复制诊断
- [Google Drive sharing permissions](https://developers.google.com/workspace/drive/api/guides/manage-sharing)：Drive 权限以 `type` + `role` 表达，维护表初始化只尝试域内 writer；不能自动升级为 `anyone` writer
- [Google Apps Script installable triggers](https://developers.google.com/apps-script/guides/triggers/installable)：time-driven trigger 允许分钟级/周期执行，但实际触发时间可能有抖动，产品侧需要补偿窗口和可恢复改期
- [Google Apps Script ClockTriggerBuilder](https://developers.google.com/apps-script/reference/script/clock-trigger-builder)：`nearMinute()` 仍是近似分钟，未指定时会使用随机分钟，说明 UI 不应把底层触发器包装成绝对准点保证
- [Jira Automation scheduled triggers](https://support.atlassian.com/cloud-automation/docs/jira-automation-triggers/)：Scheduled trigger 可按固定频率或 cron 运行，连续失败会自动禁用，适合在管理页暴露健康和恢复路径
- [Airtable Sync settings](https://www.airtable.com/guides/scale/sync-data-into-airtable)：同步产品会让用户看到源、目标、字段和频率等设置，支持 Config 绑定时展示来源与差异
- [Automating Spreadsheet Discovery & Risk Assessment](https://arxiv.org/abs/0809.3016)：电子表格作为最终用户应用容易缺少工程控制，关键配置应有可持续的识别、风险和来源线索
- [Zapier Filters & Paths](https://help.zapier.com/hc/en-us/sections/16074338520461)：面向用户的自动化产品会把条件分支和路径显式化，Scheduled Messages 的多引擎路由也应让用户看到当前走哪条路径
- [Power Automate retry / run history limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config)：成熟自动化平台会暴露运行历史、重试限制和失败后的恢复语义，支持这里的执行引擎回执与缺配置提示
- [Understanding provenance black boxes](https://link.springer.com/article/10.1007/s10619-009-7058-3)：工作流 provenance 只记录“哪个黑盒跑过”仍不够，用户还需要能理解每个步骤做了什么；因此执行引擎名称和简短说明应直接出现在 UI 中
- [Quartz misfire instructions](https://www.quartz-scheduler.net/documentation/quartz-4.x/tutorial/more-about-triggers.html)：成熟调度器会显式建模 missed fire，补偿策略应可见而不是靠用户猜
- [Twilio Message Scheduling](https://www.twilio.com/docs/messaging/features/message-scheduling)：排程消息需要明确状态、可取消标识和发送前校验，说明恢复路径要暴露目标时间和后续状态
- [Zapier troubleshooting](https://help.zapier.com/hc/en-us/articles/8496037690637-How-to-troubleshoot-errors-in-Zaps)：成熟自动化产品会区分 errored / on hold / scheduled retry 等运行状态，并提供 replay / recovery 路径，支持把队列健康提示做成可直接处理的恢复入口
- [Zapier Zap history](https://help.zapier.com/hc/en-us/articles/8496291148685-View-and-manage-your-Zap-history)：自动化平台会让用户按状态和步骤查看 run 结果，支持一键初始化后用简短收据保留完成证据
- [Airtable automation troubleshooting](https://support.airtable.com/docs/troubleshooting-airtable-automations)：自动化调试应能回到 trigger / action 测试和 run history 状态，支持把初始化拆成可解释步骤
- [Slack scheduled messages API](https://docs.slack.dev/messaging/sending-and-scheduling-messages/)：已排程消息需要可列出、删除，更新时可用删除后重建策略
- [Slack send and read messages](https://slack.com/help/articles/201457107-Send-and-read-messages-in-Slack)：Drafts/Scheduled 集中入口支持编辑、改期、发送、取消或删除
- [Slack recurring messages workflow](https://slack.com/help/articles/23814859584659-Automations--Schedule-recurring-messages-in-a-channel)：周期消息应把开始时间、频率、发送目标和正文配置放在同一个可编辑 workflow 中
- [Microsoft Teams schedule chat messages](https://support.microsoft.com/en-gb/office/schedule-chat-messages-in-microsoft-teams-2fc5ea77-7bb4-4511-8f59-e62bac1c0f6a)：已排程消息支持编辑、改期和删除
- [Gmail Schedule Send](https://support.google.com/mail/answer/9214606?hl=en-GB)：取消已排程邮件会回到草稿，说明取消 / 删除前后的可恢复上下文要明确
- [Google Chat schedule messages](https://support.google.com/chat/answer/16059642?co=GENIE.Platform%3DDesktop&hl=en)：Drafts 入口集中管理待发送消息，并显示发送人与接收人时区
- [Analyzing and Predicting Task Reminders](https://www.microsoft.com/en-us/research/publication/analyzing-predicting-task-reminder/)：提醒时间会受创建时间和文本内容影响，调度系统要让用户能明确控制实际触发日历
- [Intelligent Notification Systems survey](https://arxiv.org/abs/1711.10171)：通知系统应结合时间、上下文和偏好提高接收时机的可接受度
- [Empowering End Users in Debugging Trigger-Action Rules](https://iris.polito.it/retrieve/handle/11583/2724318/231604/euddebug.pdf)：非程序员容易误解 trigger-action 规则，调试线索和运行前/运行后可见性有助于建立正确心智模型
- [Snooze! Investigating the User-Defined Deferral of Mobile Notifications](https://doi.org/10.1145/3229434.3229436)：用户常把人和事件相关通知推迟到当天稍后或次日早上，说明“默认队列”和清晰改期入口比隐藏失败更符合实际使用
- [Iqbal & Bailey CHI 2007 interruption timing](https://www.interruptions.net/literature/Iqbal-CHI07.pdf)：不合适的通知时机会增加恢复成本，调度工具应让发送时间和上下文更可预期
- [The Update Framework specification](https://theupdateframework.github.io/specification/v1.0.17/)：自动更新系统需要明确目标、完整性和信任边界；本功能用版本端点、deployment 匹配和项目归属预检降低误更新风险
- [Betrayed by Updates](https://doi.org/10.1145/2556288.2557275)：负面更新体验会降低用户后续接受更新的意愿，因此升级失败时要解释风险、恢复动作和当前系统是否被改动
- [Adaptive notification scheduling study](https://www.sciencedirect.com/science/article/abs/pii/S1574119217304388)：真实生产环境中延迟到更合适时机发送通知能改善响应体验
- [Supporting End-User Debugging of Trigger-Action Rules](https://giove.isti.cnr.it/AssetsSitoLab/publications/ijhcs-rev-final-very-last-24%20september-very-final.pdf)：触发-动作自动化需要把失败原因、位置和下一步恢复动作放到用户能看到的诊断路径里
- [TAPInspector](https://arxiv.org/abs/2102.01468)：触发-动作系统的并发、延迟和迟到属性会带来安全/活性问题，调度 UI 应把这些风险前置成可理解的状态
