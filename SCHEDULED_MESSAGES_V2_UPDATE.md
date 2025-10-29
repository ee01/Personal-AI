# 定时消息管理功能 V2.0 更新总结

## 更新日期
2025-10-28

## 主要改进

### 1. ✅ 移除 Type 字段 - 自动类型判断

**之前：** 用户需要手动选择 Daily/Hourly/Periodic  
**现在：** 系统根据填写的字段自动判断

**判断逻辑：**
```
- 如果填写了 Repeat_Every 和 Repeat_Unit → Periodic（周期性）
- 如果填写了 Schedule_Time → Hourly（按时间）
- 否则 → Daily（每日早上9点）
```

**影响范围：**
- Google Sheet 表结构：移除了 Type 列（从 21 列减少到 20 列）
- 前端 Service：添加 `determineMessageType()` 方法
- AppScript：添加同样的判断逻辑，保持一致性
- 用户体验：简化了创建流程，不需要理解类型概念

### 2. ✅ Schedule_Time 改为非必填

**改进：**
- Schedule_Time 字段变为可选
- 留空时，默认每日早上 9 点左右推送
- 添加 placeholder 提示："留空则每日早上 9 点左右推送"

### 3. ✅ 添加"是否重复推送"Toggle

**新增功能：**
- 默认关闭重复推送
- 开启后显示周期性设置区域（灰色背景高亮）
- 默认值：每 1 周重复
- 支持设置：
  - 重复间隔（数字）
  - 重复单位（天/周/月/年）- **按钮选择**
  - 结束日期（可选）
  - 重复次数（可选）

**UI 设计：**
- 使用 checkbox toggle，简单直观
- 重复设置区域使用浅灰色背景，视觉分离清晰

### 4. ✅ 多人名 Tags 输入框

**功能特性：**
- 支持输入多个接收人姓名
- Enter 键添加 tag
- 每个 tag 显示为蓝色胶囊
- 可以点击 × 删除 tag
- Backspace 键可以删除最后一个 tag

**智能限制：**
- **AsMe 模式**：可以添加多个人名
- **Bot 模式**：只能添加一个人名（自动限制 maxTags=1）

**实现细节：**
```typescript
<TagsInput
  tags={userTags}
  onChange={handleUserTagsChange}
  placeholder="输入人名后按 Enter 添加，例如：Esone Qiu"
  maxTags={formData.Push_Method === 'Bot' ? 1 : undefined}
/>
```

### 5. ✅ 私发/群组消息选择

**之前：** Glip_User_Name 和 Glip_Team_ID 都显示，用户可能混淆  
**现在：** 按钮选择推送目标类型

**选择器设计：**
```
[ 💬 私发消息 ]  [ 👥 群组消息 ]
```

**逻辑：**
- **私发消息**：显示 Tags 输入框（接收人姓名）
- **群组消息**：显示群组 ID 输入框

### 6. ✅ UI 全面美化 - 按钮选择器

**改进前：** 使用 `<select>` 下拉框  
**改进后：** 使用按钮选择器

**按钮选择器应用于：**
1. **推送方式选择：**
   ```
   [ 👤 AsMe（以我的身份） ]  [ 🤖 Bot（机器人） ]
   ```

2. **推送目标选择：**
   ```
   [ 💬 私发消息 ]  [ 👥 群组消息 ]
   ```

3. **重复单位选择：**
   ```
   [ 天 ]  [ 周 ]  [ 月 ]  [ 年 ]
   ```

**按钮样式：**
- 未选中：白色背景，灰色边框
- 已选中：蓝色背景，白色文字，加粗
- 带图标，更直观
- Hover 效果流畅

### 7. ✅ AppScript 自动类型判断

**更新内容：**
- 添加 `determineMessageType()` 函数（与前端逻辑完全一致）
- 更新 `executeScheduledMessages()` 在执行时自动判断类型
- 更新 `shouldExecuteNow()` 接收类型参数
- 更新 `getMessagesToExecute()` 为 Bot 消息自动判断类型

**关键改动：**
```javascript
// 自动判断消息类型
const messageType = determineMessageType(rowData);

// 检查是否需要执行
if (!types.includes(messageType)) continue;
if (rowData.Status !== 'Active') continue;
if (rowData.Push_Method === 'Bot') continue; // Bot 由 Jira 处理
```

## 表结构变化

### 之前（21列）
```
ID | Type | Topic | Content | Schedule_Date | Schedule_Time | ...
```

### 现在（20列）
```
ID | Topic | Content | Schedule_Date | Schedule_Time | ...
```

移除了 `Type` 列，由程序自动计算。

## 数据兼容性

### 向后兼容
- 如果 Sheet 中有旧的 Type 列，系统会忽略它
- 系统会根据其他字段重新计算类型
- 旧数据继续正常工作

### 自动修复
- 如果发现没有 ID 的行，自动生成 ID
- 如果发现没有 Type 的行，自动判断类型

## 用户体验提升

### 1. 简化了创建流程
- 不需要理解 Daily/Hourly/Periodic 的区别
- 直接填写需要的信息，系统自动处理

### 2. 更清晰的视觉层次
- 按钮选择器比下拉框更直观
- 重复设置区域有明显的视觉分隔
- Tags 输入框更符合现代 UI 习惯

### 3. 智能验证
- Bot 模式自动限制只能一个接收人
- 根据推送目标类型显示不同字段
- 根据推送方式显示不同选项

### 4. 更好的提示信息
- Schedule_Time：留空则每日早上 9 点左右推送
- Tags 输入：输入人名后按 Enter 键添加
- Bot 模式：自动显示"只能填一个人名"提示

## 技术改进

### 1. 类型安全
```typescript
export type TargetType = 'private' | 'group';
export interface CreateMessageFormData {
  Target_Type: TargetType;  // 新增字段
  Glip_User_Name?: string;  // 支持多个人名，用逗号分隔
  // ...
}
```

### 2. 组件化
- 新增 `TagsInput` 组件
- 提取 `getButtonStyle()` 样式辅助函数
- 对话框逻辑更清晰

### 3. 状态管理
```typescript
const [userTags, setUserTags] = useState<string[]>([]);
const [isRepeating, setIsRepeating] = useState(false);
```

## 代码质量

- ✅ 无 linter 错误
- ✅ 类型定义完整
- ✅ 前后端逻辑一致
- ✅ 代码注释清晰

## 测试建议

### 1. 类型自动判断测试
- [ ] 只填日期，验证为 Daily 类型
- [ ] 填写时间，验证为 Hourly 类型
- [ ] 开启重复，验证为 Periodic 类型

### 2. Tags 输入测试
- [ ] Enter 键添加 tag
- [ ] 点击 × 删除 tag
- [ ] Backspace 删除最后一个 tag
- [ ] Bot 模式限制为 1 个

### 3. 按钮选择器测试
- [ ] 点击选择推送方式
- [ ] 点击选择推送目标
- [ ] 点击选择重复单位

### 4. 重复设置测试
- [ ] Toggle 开启/关闭
- [ ] 默认值正确（1 周）
- [ ] 字段正确显示/隐藏

### 5. 数据验证测试
- [ ] 私发消息需要至少一个接收人
- [ ] 群组消息需要群组 ID
- [ ] 重复设置需要完整填写

## 文件修改清单

### 修改的文件
1. `src/scheduled-messages/types.ts` - 类型定义更新
2. `src/scheduled-messages/ScheduledMessageService.ts` - 添加自动判断逻辑
3. `src/scheduled-messages/ScheduledMessagesManager.tsx` - 完全重写对话框UI
4. `src/scheduled-messages/SheetInitializer.ts` - 更新表头和示例数据
5. `appscripts/scheduled_messages_template.gs` - 添加自动判断逻辑

### 新增功能
- TagsInput 组件
- getButtonStyle() 辅助函数
- determineMessageType() 判断逻辑（前后端）

## 迁移指南

### 对现有用户
1. 无需任何操作
2. 系统会自动处理旧数据
3. Type 列可以保留（系统会忽略）

### 对新用户
1. 一键初始化即可
2. 表结构自动创建（20列）
3. 示例数据已更新

## 未来改进建议

1. ✨ 在表格中显示自动判断的类型（只读）
2. ✨ 支持批量导入消息
3. ✨ 支持消息模板
4. ✨ 增加消息预览功能
5. ✨ 支持富文本编辑器

## 截图对比

### 之前的 UI
- 下拉框选择消息类型
- 下拉框选择推送方式
- 分别显示用户名和群组ID

### 现在的 UI
- ✅ 无需选择类型（自动判断）
- ✅ 按钮选择推送方式（更直观）
- ✅ 按钮选择推送目标（更清晰）
- ✅ Tags 输入支持多人（现代化）
- ✅ Toggle 控制重复设置（更简洁）

## 总结

本次更新是一次全面的 UX 改进，重点在于：

1. **简化**：移除不必要的选择，系统自动判断
2. **现代化**：使用按钮选择器和 Tags 输入
3. **智能化**：根据上下文显示不同选项
4. **一致性**：前后端逻辑完全一致
5. **美观**：全新的视觉设计

所有改进都向后兼容，现有数据无需迁移。

