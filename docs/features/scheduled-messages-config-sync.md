# 定时消息配置同步机制

## 概述

为了解决用户在更换设备或手动绑定 Sheet 时丢失配置（特别是 Bot 配置）的问题，我们实现了配置同步机制，确保所有配置同时存储在 Chrome Storage 和 Sheet Config 表中。

## 改进内容

### 1. 创建 ConfigSyncService

新增 `ConfigSyncService.ts` 工具类，提供统一的配置读写接口：

- `readConfigFromSheet(sheetId)` - 从 Sheet Config 表读取完整配置
- `saveConfigToSheet(config)` - 保存配置到 Sheet Config 表
- `saveConfigToStorage(config)` - 保存配置到 Chrome Storage
- `syncConfig(config)` - 同时同步到两个位置
- `updatePartialConfig(updates)` - 更新部分配置并同步

### 2. 扩展 Sheet Config 表字段

新增以下字段以支持 Bot 配置：

| 字段名 | 说明 |
|-------|------|
| `bot_executor_rule_id` | Jira Automation Rule ID |
| `bot_executor_rule_name` | 规则名称 |
| `bot_executor_webhook_url` | Webhook URL |
| `bot_executor_project_key` | Jira Project Key |
| `bot_executor_jira_url` | Jira 实例 URL |
| `bot_executor_created_at` | Bot 配置创建时间 |

### 3. 改进 Bot 配置流程

在 `BotConfigDialog` 中配置 Bot 后：
- ✅ 使用 `ConfigSyncService.syncConfig()` 同时保存到 Sheet 和本地
- ✅ 确保配置在两个位置保持一致

### 4. 改进手动绑定流程

在 `OneClickSetup.handleManualBind()` 中：
- ✅ 从 Sheet Config 表读取完整配置（包括 Bot 配置）
- ✅ 自动恢复所有配置项
- ✅ 如果 Sheet Config 表为空，创建最小配置

## 测试指南

### 测试场景 1：Bot 配置同步

**步骤：**
1. 打开定时消息管理页面
2. 配置 Bot 推送功能（输入 Jira URL 和 Project Key）
3. 等待配置成功
4. 打开 Google Sheet，检查 Config 工作表
5. 验证以下字段是否存在：
   - `bot_executor_rule_id`
   - `bot_executor_rule_name`
   - `bot_executor_webhook_url`
   - `bot_executor_project_key`
   - `bot_executor_jira_url`
   - `bot_executor_created_at`

**预期结果：**
- ✅ Config 表中包含所有 Bot 配置字段
- ✅ 控制台输出：`✅ 配置已同步到 Sheet Config 表`

---

### 测试场景 2：手动绑定恢复配置

**步骤：**
1. 记录当前 Sheet URL
2. 清除扩展存储：
   ```javascript
   chrome.storage.local.clear()
   ```
3. 刷新定时消息管理页面
4. 使用"手动绑定"功能，输入之前的 Sheet URL
5. 点击"绑定"按钮
6. 等待页面刷新

**预期结果：**
- ✅ 页面显示"正在从 Sheet 读取配置..."
- ✅ 所有配置恢复（包括 Bot 配置）
- ✅ Bot 推送功能可正常使用，无需重新配置
- ✅ 控制台输出：`✅ 从 Sheet 读取并绑定配置`

---

### 测试场景 3：跨设备配置迁移

**步骤：**
1. 在设备 A 上完成 Bot 配置
2. 记录 Sheet URL
3. 在设备 B 上安装扩展
4. 使用手动绑定功能绑定相同的 Sheet URL
5. 验证所有配置是否迁移

**预期结果：**
- ✅ 设备 B 上自动恢复所有配置
- ✅ Bot 推送功能无需重新配置
- ✅ 所有定时消息正常显示

---

### 测试场景 4：配置更新同步

**步骤：**
1. 已配置 Bot 的系统
2. 删除并重新配置 Bot（使用不同的 Project Key）
3. 检查 Sheet Config 表是否更新

**预期结果：**
- ✅ Config 表中的 Bot 配置字段已更新为新值
- ✅ `last_sync_time` 字段更新为最新时间

---

## 兼容性说明

### 向后兼容

- ✅ 旧版本创建的 Sheet 仍然可以正常使用
- ✅ 如果 Config 表中没有 Bot 配置字段，系统会正常工作
- ✅ 手动绑定时会优雅降级：如果 Sheet 为空，创建最小配置

### 数据迁移

对于已有用户：
1. 如果已在本地配置 Bot，下次更新配置时会自动同步到 Sheet
2. 可以通过重新配置 Bot 来主动触发同步
3. 不影响现有消息和触发器

## 配置存储位置对比

| 配置项 | Chrome Storage | Sheet Config |
|-------|----------------|--------------|
| Sheet ID | ✅ | ✅ |
| Sheet URL | ✅ | ❌ (可从 ID 推导) |
| Script ID | ✅ | ✅ |
| Web App URL | ✅ | ✅ |
| Trigger IDs | ✅ | ✅ |
| Bot Executor | ✅ | ✅ (新增) |
| Version | ✅ | ✅ |
| Timestamps | ✅ | ✅ |

## 其他可能需要同步的配置

目前未同步但可能需要考虑的配置：
- **messagesSheetId**: Messages 工作表的 Sheet ID（数字 ID）
  - 当前只存储在 Chrome Storage
  - 建议：如果用户重命名了工作表，可以通过此 ID 找到正确的表
  - 优先级：中

## 注意事项

1. **权限要求**：需要 Google Sheets API 读写权限
2. **错误处理**：如果 Sheet Config 表不存在，会抛出错误
3. **性能考虑**：每次配置更新都会同时写入两个位置
4. **并发问题**：多设备同时修改配置可能导致冲突（以最后写入为准）

## 故障排查

### 问题：手动绑定后 Bot 配置丢失

**可能原因：**
- Sheet Config 表中没有 Bot 配置字段
- 网络请求失败

**解决方案：**
1. 检查 Sheet Config 表是否包含 `bot_executor_*` 字段
2. 重新配置 Bot 推送功能
3. 查看控制台日志确认同步状态

### 问题：配置同步失败

**可能原因：**
- Google Sheets API 权限不足
- Sheet 已被删除或无法访问

**解决方案：**
1. 检查控制台错误信息
2. 验证 Google 账号权限
3. 确认 Sheet 仍然存在且可访问

