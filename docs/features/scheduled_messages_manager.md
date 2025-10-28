# 定时消息统一管理功能

## 功能概述

定时消息统一管理功能提供了一个集中化的平台，用于管理和执行各种类型的定时消息推送。系统整合了 Google Sheet + AppScript 和 Jira Automation 两种执行引擎，支持 Email 和 Bot API 两种推送方式。

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
- 支持两种推送方式：Email（假装用户）、Bot_API（机器人身份）
- 支持灵活的周期配置：日/周/月/年

### 3. 多种执行引擎
- **AppScript 引擎**：处理 Email 推送，24/7 可靠运行
- **Jira Automation 引擎**：处理 Bot API 推送，解决内网访问限制
- **Chrome Extension 备用**：浏览器开启时可直接执行

### 4. 智能调度
- 自动计算下次执行时间
- 支持重复次数限制
- 自动标记已完成任务
- 记录执行日志

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
   - **Type**: 消息类型（Daily/Hourly/Periodic）
   - **Topic**: 消息主题
   - **Content**: 消息内容
   - **Schedule_Date**: 执行日期
   - **Schedule_Time**: 执行时间（Hourly 类型必填）
   - **Push_Method**: 推送方式（Email/Bot_API/Both）
   - **Glip_User_Name**: 接收人用户名（如"Esone Qiu"）
   - **Owner**: 创建者
   - **Status**: 状态（Active/Paused/Completed）

#### 方式二：通过管理界面（未来版本）

目前版本需要在 Google Sheet 中操作，未来版本将支持在管理界面直接创建和编辑。

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
- 可选字段：End_Date（结束日期）, Repeat_Count（重复次数）
- Repeat_Unit 可选值：
  - Day: 每 N 天（排除周末）
  - Week: 每 N 周
  - Month: 每 N 个月
  - Year: 每 N 年

### 推送方式说明

#### Email（假装用户身份）
- 通过 Google Mail 发送邮件到 Glip 邮箱
- 在 Glip 中显示为用户本人发送的消息
- 自动生成邮箱地址：
  - `Esone Qiu` → `esone.qiu@reply.ringcentral.glip.com`
  - 或直接使用群组 ID：`{teamId}@reply.ringcentral.glip.com`

#### Bot_API（机器人身份）
- 通过 Jira Automation 调用 Bot API
- 在 Glip 中显示为机器人发送的消息
- 需要配置 Bot_Endpoint 字段

#### Both（两者都用）
- Email 和 Bot API 同时发送
- 适用于需要双重保障的场景

## 技术架构

### 数据流

```
用户操作
    ↓
Chrome Extension 管理界面
    ↓
Google Sheets（统一数据源）
    ↓
    ├─→ AppScript Trigger（Email 推送）
    │   ├─→ minuteTrigger（每分钟）
    │   └─→ dailyTrigger（每日）
    │
    └─→ Jira Automation（Bot API 推送）
        └─→ 每分钟读取 Sheet，调用 Bot API
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

#### 3. AppScript 执行引擎
- `minuteTrigger()`: 每分钟执行，处理 Hourly 类型
- `dailyTrigger()`: 每日执行，处理 Daily 和 Periodic 类型
- `doGet()`: Web App 端点，供 Jira Automation 调用

#### 4. Jira Automation 执行器
- 每分钟调用 AppScript Web App
- 获取需要执行的 Bot API 消息
- 调用 Bot API 发送消息

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
| Push_Method | Enum | ✅ | Email/Bot_API/Both |
| Glip_User_Name | String | ❌ | 接收人用户名 |
| Glip_Team_ID | String | ❌ | 群组 ID |
| Bot_Endpoint | String | ❌ | Bot API 端点 |
| Attachment | String | ❌ | 附件文件名 |
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

## 未来规划

### Phase 2: Bot API 支持
- [ ] Jira Automation 统一执行器
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


