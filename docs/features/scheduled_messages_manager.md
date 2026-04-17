# 定时消息统一管理功能

*最后更新: 2026-04-16*

## 功能概述

定时消息统一管理功能提供了一个集中化的平台，用于管理和执行各种类型的定时消息推送。系统整合了 Google Sheet、AppScript、Jira Automation 和 memory-service runtime，既能做普通消息推送，也能做“帮我问 / 主动询问（Outreach）”这类带运行时状态和追问逻辑的任务。

## 核心特性

### 1. 一键初始化
- 自动创建 Google Spreadsheet
- 自动配置 AppScript 执行引擎
- 自动设置定时触发器
- 自动添加示例消息
- 全过程约 10-15 秒完成

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

### 4. 智能调度
- 自动计算下次执行时间
- 支持重复次数限制
- 自动标记已完成任务
- 记录执行日志

### 5. 灵活的表格结构 ✨
- **动态列位置识别**：通过 header 行自动识别列的位置
- **支持自由调整列顺序**：用户可以在 Google Sheet 中随意调整列的顺序
- **自动适配读写**：系统自动根据 header 确定数据的读取和写入位置
- **向后兼容**：自动适配旧版本和新版本的表格结构

## 使用方法

### 首次使用

1. 点击 Personal AI 插件图标
2. 选择"⏰ 定时消息管理"
3. 点击"🚀 一键生成维护表"按钮
4. 等待 10-15 秒，系统自动完成初始化
5. 一分钟后，您将收到测试消息

### 创建定时消息

#### 方式一：在 Google Sheet 中添加

1. 点击"打开 Sheet"按钮
2. 在 Messages 表中添加新行
3. 填写必要字段：
   - **ID**: 唯一标识（如 msg_001）
   - **Topic**: 消息主题
   - **Content**: 消息内容
   - **Schedule_Date**: 执行日期（YYYY-MM-DD）
   - **Schedule_Time**: 执行时间（HH:mm，可选）
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
   - **Target_Type**: `private` 或 `group`
   - **Glip_User_Name**: 目标是某个人时填写
   - **Glip_Team_ID**: 目标是某个群时填写
   - **Outreach_Context**: 可选背景说明
   - **Outreach_Max_Followup**: 最大追问次数
   - **Outreach_Followup_Interval_Hours**: 追问间隔（小时）

#### 方式二：通过管理界面创建

1. 点击管理页面右上角的“➕ 新增”按钮
2. 填写消息主题、内容以及执行时间
3. 选择推送方式：AsMe / Bot / AI Report / 帮我问
4. 按提示填写对应字段：
   - **AsMe**：按接收人添加人名标签
   - **Bot**：选择私聊或群组，并填写 Glip 用户名或群组 ID
   - **AI Report**：选择模板（AI report / PEP report / 自定义），系统会为每个模板分别记住 Endpoint / Headers / Body
   - **帮我问**：选择问某个人还是某个群，填写问题、可选背景和追问策略
5. AI Report 模式下默认选中 **AI report** 模板，切换到 **自定义** 时可以手动填写并保存专属配置
6. 点击“✅ 创建消息”完成创建

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
- Repeat_Unit 可选值：
  - Day: 每 N 天（排除周末）
  - Week: 每 N 周
    - 支持多星期选择：可通过 Repeat_Days 指定一周多天执行（如周一、三、五）
    - Repeat_Days 格式：逗号分隔的数字（0=周日, 1=周一...6=周六）
    - 示例：`1,3,5` 表示每周一、三、五执行
    - 特殊情况：工作日（1,2,3,4,5）、周末（0,6）会显示为"工作日"、"周末"
  - Month: 每 N 个月
  - Year: 每 N 年

### 推送方式说明

#### AsMe（以我的身份发送）
- 通过 Google Mail 发送邮件到 Glip 邮箱
- 在 Glip 中显示为用户本人发送的消息
- 自动生成邮箱地址：
  - `Esone Qiu` → `esone.qiu@reply.ringcentral.glip.com`
  - 或直接使用群组 ID：`{teamId}@reply.ringcentral.glip.com`
- 由 **AppScript 引擎**执行，24/7 可靠运行

#### Bot（机器人身份发送）
- 通过 Jira Automation 调用内网 Bot API
- 在 Glip 中显示为机器人发送的消息
- Bot 路由和凭据由扩展配置 / Jira Automation 规则维护，不需要在单条消息里额外填写专属 endpoint 字段
- 由 **Jira Automation 引擎**执行（同时负责 AI 推送），解决内网访问限制

#### AI Report（AI 报告推送）
- 通过 Jira Automation 调用外部 API，发送结构化报告
- 提供 **AI report / PEP report / 自定义** 三种模板，并为每种模板保留独立配置
- `AI_Endpoint` 与 `AI_Headers` 会根据模板自动填充，可随时切换；`AI_Body` 可直接编辑并支持 `{Topic}`、`{Content}` 变量
- 自定义模板支持完全自由填写 Endpoint / Headers / Body，切换模板时系统会记住各自的输入

#### Outreach（帮我问 / 主动询问）
- 这不是一次性消息推送，而是一个 **主动询问模板**
- Sheet 中保留的是模板入口；真正的运行时状态在 memory-service 的 `outreach_templates / outreach_sessions / outreach_events`
- 发送前会先做 **目标解析**，确认应该问谁
- 真正触发时会先做 **答案预检**
  - 第一层：检查目标群 / 目标私聊从模板创建到当前触发点的最近会话消息
  - 第二层：检查全局记忆中是否已经存在其他群里的相关答复
- 如果在发送前已经命中答案，则 **不发出消息**
- 如果在等待回复期间仍未收到直接回复，每次追问前也会再次做同一套预检；若已命中答案，则 **不再追问**
- 用户在定时消息列表中看到的是模板状态和最近结果；更完整的证据、命中阶段、来源与相关消息会在“主动询问 / Outreach Sessions”页面中查看
- 系统会为 Outreach 动态挂载内部观察规则用于证据采集，但这些规则不会显示在“记忆入口规则”或 “Follow Threads” 列表中

#### Outreach 典型状态
- `pending_approval`：目标未解析完成，或需要人工批准后才能发出
- `scheduled`：已排程，等待发送
- `waiting_reply`：已经发出，正在等答复
- `deferred`：对方表示稍后回复，系统等待新的时间点
- `resolved`：已获得可用结果，可能来自直接回复，也可能来自发送前 / 追问前的答案预检
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

- **自定义**：Endpoint / Headers / Body 均由用户填写，模板切换后仍会保留已输入内容

- 🎯 **单条消息推送**：每分钟执行一条（覆盖 Bot / AI），避免批量失败
- 📊 **三级优先级**：当前分钟 > 过去30分钟 > 未指定时间（8点后）
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
    │   ├─→ minuteTrigger（每分钟）
    │   └─→ dailyTrigger（每日）
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
- `minuteTrigger()`: 每分钟执行，处理 Hourly 类型
- `dailyTrigger()`: 每日执行，处理 Daily 和 Periodic 类型
- `doGet()`: Web App 端点，供 Jira Automation 调用

#### 4. Jira Automation 执行器（v2 架构）
- 每分钟触发一次 Webhook 调用 AppScript
- AppScript 执行完整流程：
  1. 按优先级选择单条消息（当前分钟 > 过去30分钟 > 未指定时间）
  2. 过滤今日已成功/已失败的消息
  3. 调用内网 Bot API 或外部 AI API 发送
  4. 更新执行日志到 Sheet
- **优势**：失败消息不阻塞队列，全天分散推送未指定时间的消息

#### 5. Outreach Runtime
- 将 `Push_Method = Outreach` 的定时消息同步成主动询问模板
- 运行时状态通过 overlay 回写到定时消息列表，例如：
  - `Outreach_Sync_State`
  - `Outreach_Runtime_Status`
  - `Outreach_Last_Session_ID`
  - `Outreach_Result`
  - `Outreach_Last_Updated`
- 对重复模板，只结束单次 session，不会因为一次 `resolved` 就把整个模板永久视为 Done
- 真正的会话详情和证据查看入口在 `memory-exploring.html#/outreach`

## 配置说明

### Messages 表字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ID | String | ✅ | 唯一标识 |
| Type | Enum | ✅ | Daily/Hourly/Periodic |
| Topic | String | ✅ | 消息主题 |
| Content | String | ✅ | 消息内容 |
| Schedule_Date | Date | ✅ | 执行日期 (YYYY-MM-DD) |
| Schedule_Time | Time | ❌ | 执行时间 (HH:mm) |
| End_Date | Date | ❌ | 结束日期 |
| Repeat_Every | Number | ❌ | 重复间隔 |
| Repeat_Unit | Enum | ❌ | Day/Week/Month/Year |
| Repeat_Count | Number | ❌ | 重复次数 |
| Repeat_Days | String | ❌ | 多选日期（周模式：0=周日,1=周一...6=周六，逗号分隔） |
| Push_Method | Enum | ✅ | AsMe / Bot / AI / JiraAutomation / Outreach |
| Glip_User_Name | String | ❌ | 接收人用户名（AsMe、Bot 私聊或 Outreach private 目标） |
| Glip_Team_ID | String | ❌ | 群组 ID（Bot 群推送或 Outreach group 目标） |
| Attachment | String | ❌ | 附件文件名 |
| AI_Endpoint | String | ❌ | AI API 端点（AI 推送必填） |
| AI_Headers | String | ❌ | AI API 请求头（多行文本，每行一个 header） |
| AI_Body | String | ❌ | AI API 请求体（JSON，支持 {Topic}/{Content} 变量） |
| Target_Type | Enum | ❌ | `private` / `group` / `api`，Outreach 会使用 |
| Outreach_Target_Type | Enum | ❌ | Outreach 目标类型镜像字段，兼容旧表头 |
| Outreach_Target_Ref | String | ❌ | Outreach 目标引用镜像字段，兼容旧表头 |
| Outreach_Context | String | ❌ | 帮我问的背景说明 |
| Outreach_Max_Followup | Number | ❌ | 最大追问次数 |
| Outreach_Followup_Interval_Hours | Number | ❌ | 追问间隔（小时） |
| Outreach_Sync_State | String | ❌ | 模板同步状态（运行态 overlay） |
| Outreach_Runtime_Status | String | ❌ | 最近一次会话状态（运行态 overlay） |
| Outreach_Last_Session_ID | String | ❌ | 最近一次 session id（运行态 overlay） |
| Outreach_Result | String | ❌ | 最近一次结果摘要（运行态 overlay） |
| Outreach_Last_Result | String | ❌ | 最近一次结果摘要镜像字段，兼容旧表头 |
| Outreach_Last_Updated | DateTime | ❌ | 最近一次会话更新时间（运行态 overlay） |
| Outreach_Question | String | ❌ | 已废弃；历史表头兼容字段，当前使用 `Content` 保存问题原文 |
| Owner | String | ✅ | 创建者 |
| Status | Enum | ✅ | Active/Paused/Completed |
| Last_Exec | DateTime | ❌ | 最后执行时间（自动） |
| Next_Exec | DateTime | ❌ | 下次执行时间（自动） |
| Exec_Count | Number | ❌ | 执行次数（自动） |
| Exec_Log | String | ❌ | 执行日志（自动） |

### Config 表字段

| Key | 说明 |
|-----|------|
| minute_trigger_id | 分钟触发器 ID |
| daily_trigger_id | 每日触发器 ID |
| web_app_url | Web App 地址 |
| jira_executor_rule_id | Jira 执行器规则 ID |
| sheet_version | 版本号 |
| created_by | 创建者 |
| created_at | 创建时间 |
| last_sync_time | 最后同步时间 |

## 常见问题

### Q: 初始化失败怎么办？
A: 请检查：
1. 是否已登录 Google 账号
2. 是否授权了 Google Sheets 和 Apps Script 权限
3. 网络连接是否正常

### Q: 消息没有按时发送？
A: 请检查：
1. 消息状态是否为 Active
2. Schedule_Date 和 Schedule_Time 是否正确
3. AppScript 触发器是否正常运行（在 Google Apps Script 控制台查看）

### Q: 如何修改消息内容？
A: 
1. 打开 Google Sheet
2. 找到对应的消息行
3. 直接编辑内容
4. 保存即可（下次执行时生效）

### Q: 如何暂停消息？
A:
1. 将消息的 Status 字段改为 "Paused"
2. 系统将跳过该消息的执行

### Q: 如何删除消息？
A:
1. 打开 Google Sheet
2. 删除对应的消息行即可

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
1. 系统先检查目标群 / 私聊在模板创建到当前触发点之间的最近消息
2. 如果没有，再检查全局记忆里是否已经在其他群拿到答案
3. 如果两层检测已经能确认答案，session 会直接标记为 `resolved`，不会再重复追问

### Q: 帮我问的系统观察规则在哪里看？
A:
用户不会在“记忆入口规则”里看到这类规则。当前可见入口是：
1. 定时消息列表中的运行态摘要
2. “主动询问 / Outreach Sessions” 页面里的证据状态、命中阶段、命中来源和相关消息

系统内部观察规则是运行时能力，不是用户手动维护的规则列表。

## 未来规划

### Phase 2: Bot API 支持 ✅
- [x] Jira Automation 统一执行器（v2 单条消息推送）
- [x] 优先级调度系统（当前分钟 > 过去30分钟 > 未指定时间）
- [x] 失败消息智能过滤（避免阻塞队列）
- [ ] 从 Jira Automation 导入规则
- [ ] 批量导入 Scheduled 规则
- [ ] 每日同步 Jira rules 到 Sheet

### Phase 3: 高级功能
- [ ] RingCentral 聊天界面集成
- [ ] 一键定时回复按钮
- [ ] AI 建议回复时间
- [ ] 在管理界面直接创建/编辑消息
- [ ] 消息模板管理
- [ ] 执行历史查看

## 参考资料

- [Google Sheets API 文档](https://developers.google.com/sheets/api)
- [Google Apps Script 文档](https://developers.google.com/apps-script)
- [Apps Script API 文档](https://developers.google.com/apps-script/api)
- [Jira Automation 文档](https://support.atlassian.com/cloud-automation/docs/jira-automation/)

**实现细节文档**：
- `BOT_SINGLE_MESSAGE_IMPLEMENTATION.md` - Bot 单条消息推送完整实现
- `JIRA_GROOVY_FIX.md` - Jira Automation 架构演进
