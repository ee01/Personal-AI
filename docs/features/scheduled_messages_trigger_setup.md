# 定时消息触发器设置方案

## 问题背景

Google Apps Script REST API **不支持**直接通过 HTTP 请求创建触发器（Triggers）。尝试调用 `https://script.googleapis.com/v1/projects/{scriptId}/triggers` 会返回 404 错误。

根据官方文档，`ScriptApp.newTrigger()` 方法只能在 Apps Script 环境内部执行，包括：
- Apps Script 编辑器
- 菜单执行代码
- **Web App 执行环境** ✅

## 解决方案：通过 Web App 创建触发器

我们采用以下方案来实现自动化触发器创建：

### 架构流程

```
Chrome Extension
    ↓
1. 创建 Spreadsheet
    ↓
2. 设置权限
    ↓
3. 设置工作表结构
    ↓
4. 添加示例数据
    ↓
5. 创建 AppScript 项目（包含 setupTriggersInternal 函数）
    ↓
6. 部署为 Web App（获得 Web App URL）
    ↓
7. 调用 Web App: GET {webAppUrl}?action=setupTriggers
    ↓
    Apps Script 内部执行：
    - 删除旧触发器
    - ScriptApp.newTrigger('minuteTrigger').timeBased().everyMinutes(1).create()
    - ScriptApp.newTrigger('dailyTrigger').timeBased().atHour(9).everyDays(1).create()
    ↓
8. 保存配置到 Config Sheet
```

### 关键代码

#### Apps Script 端（scheduled_messages_template.gs）

```javascript
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'setupTriggers') {
    try {
      const result = setupTriggersInternal();
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, message: result })
      ).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: error.toString() })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'OK' })
  ).setMimeType(ContentService.MimeType.JSON);
}

function setupTriggersInternal() {
  // 删除现有触发器
  var existingTriggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existingTriggers.length; i++) {
    ScriptApp.deleteTrigger(existingTriggers[i]);
  }
  
  // 创建新触发器
  ScriptApp.newTrigger('minuteTrigger')
    .timeBased()
    .everyMinutes(1)
    .create();
  
  ScriptApp.newTrigger('dailyTrigger')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();
  
  return 'Triggers created successfully';
}
```

#### Chrome Extension 端（SheetInitializer.ts）

```typescript
private async createTriggers(webAppUrl: string): Promise<{ minuteTriggerId: string; dailyTriggerId: string }> {
  const response = await fetch(
    `${webAppUrl}?action=setupTriggers`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`创建触发器失败: HTTP ${response.status}`);
  }
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`创建触发器失败: ${result.error}`);
  }
  
  return {
    minuteTriggerId: 'created-via-webapp',
    dailyTriggerId: 'created-via-webapp'
  };
}
```

## 技术要点

### 1. 为什么必须先部署 Web App？

因为只有部署后才能获得 Web App URL，我们需要这个 URL 来调用 `setupTriggers` 端点。

### 2. Web App 的访问权限

Web App 必须部署为以下权限之一：
- **"Anyone"** - 任何人都可以访问（推荐用于此场景）
- **"Anyone in organization"** - 组织内任何人可访问

我们的代码中使用：
```javascript
access: 'ANYONE'
```

### 3. 为什么不能用 Apps Script Execution API？

Apps Script Execution API (`/v1/scripts/{scriptId}:run`) 需要：
1. 启用 Google Apps Script API
2. 复杂的 OAuth 授权流程
3. 更严格的权限控制

而 Web App 方式更简单直接。

### 4. 触发器的限制

Google Apps Script 对触发器有以下限制：
- 每个脚本最多 20 个触发器
- 最小时间间隔：1 分钟
- 时间触发器受配额限制（免费账户每天约 90 分钟运行时间）

## 测试验证

初始化完成后，可以通过以下方式验证触发器是否创建成功：

1. **在 Apps Script 编辑器中查看**
   - 打开 Apps Script 项目
   - 点击左侧的 ⏰ 触发器图标
   - 应该能看到两个触发器：
     - `minuteTrigger` - 时间驱动，每 1 分钟
     - `dailyTrigger` - 时间驱动，每天 9:00

2. **通过 Web App 手动触发**
   ```bash
   curl "{webAppUrl}?action=setupTriggers"
   ```
   应该返回：
   ```json
   {
     "success": true,
     "message": "Triggers created successfully: ..."
   }
   ```

3. **检查执行日志**
   - 在 Apps Script 编辑器中点击"执行"
   - 查看是否有触发器执行记录

## 参考文档

- [Google Apps Script Installable Triggers](https://developers.google.com/apps-script/guides/triggers/installable)
- [ScriptApp.newTrigger() Reference](https://developers.google.com/apps-script/reference/script/script-app#newtriggerfunctionname)
- [Web Apps Guide](https://developers.google.com/apps-script/guides/web)

## 后续优化建议

1. **添加触发器状态检查**
   - 创建 `?action=listTriggers` 端点
   - 返回当前触发器列表和状态

2. **支持触发器自定义**
   - 允许用户在初始化时配置触发器间隔
   - 支持暂停/恢复触发器

3. **错误处理增强**
   - 添加重试机制
   - 更详细的错误日志

4. **权限优化**
   - 考虑使用 "Anyone in organization" 权限
   - 添加简单的 API key 验证

