# 定时消息管理功能更新总结

## 更新日期
2025-10-28

## 主要修改

### 1. Push_Method 值更新 ✅

**修改前：** `Email` | `Bot_API` | `Both`  
**修改后：** `AsMe` | `Bot`

#### 修改说明
- **AsMe（以我的身份发送）**：通过 Google Mail 发送邮件到 Glip，在 Glip 中显示为用户本人发送的消息，由 AppScript 引擎执行
- **Bot（机器人身份发送）**：通过 Jira Automation 调用内网 Bot API，在 Glip 中显示为机器人发送的消息

#### 涉及文件
- `src/scheduled-messages/types.ts` - 类型定义更新
- `src/scheduled-messages/SheetInitializer.ts` - 示例数据更新
- `docs/features/scheduled_messages_manager.md` - 文档更新

### 2. 自动生成 ID 功能 ✅

在同步 Google Sheet 数据时，如果检测到某行消息缺少 ID，系统会自动生成一个唯一的 ID。

#### 实现细节
```typescript
// 格式：msg_{timestamp}_{rowIndex}
message.ID = `msg_${Date.now()}_${i}`;
```

#### 涉及文件
- `src/scheduled-messages/ScheduledMessageService.ts` - `getAllMessages()` 方法增强

### 3. 管理界面功能增强 ✅

#### 3.1 新增消息功能
- 点击页面右上角 **"➕ 新增"** 按钮
- 弹出对话框，支持填写所有消息字段
- 根据消息类型动态显示/隐藏相关字段
- 根据推送方式动态显示相关配置项

**支持的消息类型：**
- Daily - 按日期执行一次
- Hourly - 按时间执行一次
- Periodic - 周期性重复执行

**推送方式选项：**
- AsMe - 以我的身份发送（需填写 Glip_User_Name 或 Glip_Team_ID）
- Bot - 机器人身份发送（需填写 Bot_Endpoint）

#### 3.2 删除消息功能
- 每行消息右侧有 **"🗑️"** 删除按钮
- 点击后会弹出确认对话框
- 确认后从 Google Sheet 中删除该行

#### 3.3 启用/禁用状态切换
- 点击消息的 **状态** 列（Active/Paused）可以快速切换状态
- 鼠标悬停时会显示提示信息
- 状态变化后立即同步到 Google Sheet

#### 3.4 界面优化
- **隐藏 ID 列**：ID 列不再在表格中显示，但仍在后台使用
- **主题列优化**：
  - 如果 Topic 字段为空，自动显示 Content 的前30个字符
  - 超过30个字符的内容会显示为 "..."
  - 鼠标悬停在主题上时，会通过 tooltip 显示完整的消息内容

#### 涉及文件
- `src/scheduled-messages/ScheduledMessagesManager.tsx` - 主界面更新，新增对话框组件

### 4. 文档更新 ✅

完整更新了 `docs/features/scheduled_messages_manager.md` 文档，包括：
- 推送方式说明更新
- 技术架构图更新
- 字段说明表更新
- 使用方法更新

## Bot 类型推送实现说明

根据现有代码分析，**Bot 类型推送**通过以下方式实现：

1. **AppScript 端**（`appscripts/scheduled_messages.gs`）：
   - 包含 `_sendBotTextMessage()` 和 `_sendBotImageMessage()` 函数
   - 调用内网 botman API：`https://botman.int.rclabenv.com/v2/team/message`
   - 由于内网访问限制，这些函数目前被注释掉

2. **Jira Automation**（文档规划）：
   - 每分钟读取 Google Sheet
   - 筛选出 Push_Method 为 "Bot" 的消息
   - 调用内网 Bot API 发送消息
   - 避免了 AppScript 无法访问内网的限制

## 使用指南

### 新增消息
1. 点击右上角 **"➕ 新增"** 按钮
2. 填写消息信息
3. 选择推送方式（AsMe 或 Bot）
4. 点击 **"创建消息"**

### 删除消息
1. 找到要删除的消息行
2. 点击最右侧的 **"🗑️"** 按钮
3. 确认删除

### 启用/禁用消息
1. 直接点击消息的状态列（Active/Paused）
2. 系统自动切换状态

### 查看完整内容
- 鼠标悬停在主题列上，会显示完整的消息内容

## 技术细节

### 自动 ID 生成逻辑
```typescript
if (!message.ID) {
  message.ID = `msg_${Date.now()}_${i}`;
  await this.updateRow(i + 1, this.messageToRow(message));
  console.log(`自动生成 ID: ${message.ID} (行 ${i + 1})`);
}
```

### 状态切换逻辑
```typescript
async toggleMessageStatus(id: string): Promise<ScheduledMessage> {
  const message = await this.getMessageById(id);
  const newStatus = message.Status === 'Active' ? 'Paused' : 'Active';
  return await this.updateMessage(id, { Status: newStatus });
}
```

### 主题显示逻辑
```typescript
const displayTitle = message.Topic || 
  (message.Content.length > 30 
    ? message.Content.substring(0, 30) + '...' 
    : message.Content);
```

## 向后兼容性

- 旧的 `Email/Bot_API/Both` 值仍然可以在 Google Sheet 中使用（如果有的话）
- 系统会在前端显示时继续工作，但建议更新为新值
- 示例数据已更新为使用 `AsMe`

## 测试建议

1. **新增消息测试**
   - 测试 Daily/Hourly/Periodic 三种类型
   - 测试 AsMe 和 Bot 两种推送方式
   - 验证表单验证逻辑

2. **删除消息测试**
   - 测试删除确认对话框
   - 验证删除后列表刷新

3. **状态切换测试**
   - 测试 Active ↔ Paused 切换
   - 验证切换后 Sheet 同步

4. **ID 自动生成测试**
   - 手动在 Sheet 中添加没有 ID 的行
   - 同步数据后检查是否自动生成 ID

5. **界面显示测试**
   - 测试长内容是否正确截断
   - 测试 tooltip 是否正确显示
   - 测试无 Topic 时显示 Content

## 已知限制

1. **编辑功能**：目前仅支持新增和删除，编辑功能仍需在 Google Sheet 中进行
2. **Bot 推送**：需要配置 Jira Automation 才能实际发送 Bot 消息
3. **批量操作**：暂不支持批量删除或批量状态修改

## 未来改进建议

1. 在管理界面支持编辑消息
2. 支持批量操作（批量删除、批量启用/禁用）
3. 增加消息执行历史查看
4. 支持消息模板管理
5. 增加消息执行状态实时监控

