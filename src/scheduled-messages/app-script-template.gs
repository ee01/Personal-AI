/**
 * Personal AI - 定时消息执行引擎
 * 统一处理 Email 推送的定时消息
 * 
 * ===== 动态列映射支持 =====
 * 本脚本支持动态识别 Google Sheet 的列位置，用户可以自由调整列的顺序：
 * 
 * 1. 读取机制：
 *    - parseRow() 函数根据 header 动态解析每行数据
 *    - 所有数据访问都通过列名（如 'ID'、'Topic'）而非列索引
 * 
 * 2. 写入机制：
 *    - getColumnIndex() 函数动态获取列的位置
 *    - updateExecutionLog() 等函数使用动态列索引更新数据
 * 
 * 3. 灵活性：
 *    - ✅ 支持用户调整列的顺序
 *    - ✅ 支持隐藏列
 *    - ✅ 支持在中间插入新列
 *    - ⚠️ 不要修改列名（header）
 * 
 * 4. 实现细节：
 *    - 第一行（header）必须包含所有必要的列名
 *    - 列名必须与 TypeScript 接口 ScheduledMessage 的字段名一致
 *    - 所有列访问都通过 headers 数组动态映射
 */

// 每分钟执行（处理 Hourly 类型）
function minuteTrigger() {
  executeScheduledMessages(['Hourly']);
}

// 每日执行（处理 Daily 和 Periodic）
function dailyTrigger() {
  executeScheduledMessages(['Daily', 'Periodic']);
}

/**
 * 自动判断消息类型（与前端逻辑一致）
 */
function determineMessageType(rowData) {
  // 如果填写了 Repeat_Every 和 Repeat_Unit，判断为 Periodic
  if (rowData.Repeat_Every && rowData.Repeat_Unit) {
    return 'Periodic';
  }
  
  // 如果填写了 Schedule_Time，判断为 Hourly
  if (rowData.Schedule_Time && rowData.Schedule_Time.toString().trim()) {
    return 'Hourly';
  }
  
  // 否则为 Daily（每日早上9点执行）
  return 'Daily';
}

/**
 * 执行定时消息
 * @param {string[]} types - 要处理的消息类型
 */
function executeScheduledMessages(types) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Messages');
  if (!sheet) {
    Logger.log('错误：未找到 Messages 工作表');
    return;
  }
  
  // 使用 getDisplayValues() 强制以文本格式读取所有数据
  const data = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) {
    Logger.log('没有消息数据');
    return;
  }
  
  const headers = data[0];
  const now = new Date();
  
  Logger.log(`开始执行定时任务，当前时间: ${Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')}`);
  Logger.log(`处理消息类型: ${types.join(', ')}`);
  
  // 遍历每一行（跳过表头）
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowData = parseRow(row, headers);
    
    // 自动判断消息类型
    const messageType = determineMessageType(rowData);
    
    // 检查是否需要执行
    if (!types.includes(messageType)) continue;
    if (rowData.Status !== 'Active') continue;
    if (rowData.Push_Method !== 'AsMe') continue; // Bot 由 Jira 处理, AI 由 Jira 处理
    
    try {
      if (shouldExecuteNow(rowData, now, messageType)) {
        Logger.log(`准备执行消息: ${rowData.ID} - ${rowData.Topic} (类型: ${messageType})`);
        
        // 发送 Email
        const success = sendEmailToGlip(rowData);
        
        // 更新执行记录
        updateExecutionLog(sheet, i + 1, rowData, success, headers);
        
        Logger.log(`消息执行${success ? '成功' : '失败'}: ${rowData.ID}`);
      }
    } catch (error) {
      Logger.log(`处理消息时出错 ${rowData.ID}: ${error}`);
      updateExecutionLog(sheet, i + 1, rowData, false, headers, error.toString());
    }
  }
  
  Logger.log('定时任务执行完成');
}

/**
 * 解析行数据为对象（动态列映射的核心）
 * 
 * 根据 header 行的列名和索引，将数据行解析为键值对对象。
 * 这样即使用户调整了列的顺序，也能正确读取数据。
 * 
 * 示例：
 * headers = ['Topic', 'ID', 'Status']
 * row = ['测试消息', 'msg_001', 'Active']
 * 返回：{ Topic: '测试消息', ID: 'msg_001', Status: 'Active' }
 * 
 * @param {array} row - 数据行数组
 * @param {array} headers - header 行数组
 * @returns {object} 行数据对象
 */
function parseRow(row, headers) {
  const rowData = {};
  headers.forEach((header, idx) => {
    rowData[header] = row[idx];
  });
  return rowData;
}

/**
 * 获取列索引（动态列映射的核心）
 * 
 * 根据列名动态获取列在 Sheet 中的索引位置。
 * 这样即使用户调整了列的顺序，也能正确写入数据。
 * 
 * 示例：
 * headers = ['Topic', 'ID', 'Status']
 * getColumnIndex(headers, 'Status') 返回 3
 * getColumnIndex(headers, 'ID') 返回 2
 * 
 * @param {array} headers - header 行数组
 * @param {string} columnName - 列名
 * @returns {number} 列索引（从 1 开始，符合 Google Sheets API）
 */
function getColumnIndex(headers, columnName) {
  return headers.indexOf(columnName) + 1;
}

/**
 * 判断是否应该在当前时间执行
 */
function shouldExecuteNow(rowData, now, messageType) {
  const type = messageType || determineMessageType(rowData);
  
  if (type === 'Hourly') {
    // 检查 Schedule_Date 和 Schedule_Time
    if (!rowData.Schedule_Date || !rowData.Schedule_Time) return false;
    
    const scheduleDate = new Date(rowData.Schedule_Date);
    if (!isSameDate(scheduleDate, now)) return false;
    
    // 解析 Schedule_Time（文本格式，如 "17:16"）
    const timeStr = rowData.Schedule_Time.toString().trim();
    const timeParts = timeStr.split(':');
    const scheduleHour = parseInt(timeParts[0]);
    const scheduleMinute = parseInt(timeParts[1]);
    
    return now.getHours() == scheduleHour && now.getMinutes() == scheduleMinute;
    
  } else if (type === 'Daily') {
    // 检查 Schedule_Date
    if (!rowData.Schedule_Date) return false;
    const scheduleDate = new Date(rowData.Schedule_Date);
    return isSameDate(scheduleDate, now);
    
  } else if (type === 'Periodic') {
    // 周期性逻辑
    return checkPeriodicSchedule(rowData, now);
  }
  
  return false;
}

/**
 * 检查两个日期是否是同一天
 */
function isSameDate(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * 检查周期性消息是否应该执行
 */
function checkPeriodicSchedule(rowData, now) {
  if (!rowData.Schedule_Date) return false;
  
  const startDate = new Date(rowData.Schedule_Date);
  const endDate = rowData.End_Date ? new Date(rowData.End_Date) : null;
  const every = parseInt(rowData.Repeat_Every) || 1;
  const repeatUnit = rowData.Repeat_Unit || 'Day';
  
  // 检查是否已经过了结束日期
  if (endDate && now > endDate) return false;
  
  // 检查是否还没到开始日期
  if (now < startDate) return false;
  
  // 计算与开始日期的差异
  const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const daysToStart = Math.floor((todayDateOnly - startDateOnly) / (1000 * 60 * 60 * 24));
  
  let shouldSend = false;
  
  if (repeatUnit === 'Day') {
    // 每 N 天推送一次，排除周末
    if (daysToStart >= 0 && daysToStart % every === 0) {
      if (now.getDay() >= 1 && now.getDay() <= 5) { // 周一到周五
        shouldSend = true;
      }
    }
    
  } else if (repeatUnit === 'Week') {
    // 每 N 周推送一次
    if (daysToStart >= 0 && daysToStart % (7 * every) === 0) {
      shouldSend = true;
    }
    
  } else if (repeatUnit === 'Month') {
    // 每 N 个月推送一次（同一天）
    if (now.getDate() === startDate.getDate()) {
      const monthsDiff = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
      if (monthsDiff >= 0 && monthsDiff % every === 0) {
        shouldSend = true;
      }
    }
    
  } else if (repeatUnit === 'Year') {
    // 每 N 年推送一次（同一天）
    if (now.getDate() === startDate.getDate() && now.getMonth() === startDate.getMonth()) {
      const yearsDiff = now.getFullYear() - startDate.getFullYear();
      if (yearsDiff >= 0 && yearsDiff % every === 0) {
        shouldSend = true;
      }
    }
  }
  
  return shouldSend;
}

/**
 * 发送邮件到 Glip
 */
function sendEmailToGlip(rowData) {
  try {
    let toEmail;
    
    // 优先使用用户名生成邮箱
    // 新格式：esone.qiu+john.doe（多个用户用+连接）
    if (rowData.Glip_User_Name && rowData.Glip_User_Name.toString().trim()) {
      const userNames = rowData.Glip_User_Name.toString().trim();
      // 直接使用存储格式构建邮箱：esone.qiu+john.doe@reply.ringcentral.glip.com
      toEmail = userNames + '@reply.ringcentral.glip.com';
    } else if (rowData.Glip_Team_ID && rowData.Glip_Team_ID.toString().trim()) {
      toEmail = rowData.Glip_Team_ID.toString().trim() + '@reply.ringcentral.glip.com';
    } else {
      Logger.log('错误：未指定收件人');
      return false;
    }
    
    const attachments = [];
    if (rowData.Attachment && rowData.Attachment.toString().trim()) {
      try {
        const file = DriveApp.getFilesByName(rowData.Attachment.toString()).next();
        attachments.push(file.getAs(MimeType.PNG));
      } catch (e) {
        Logger.log('警告：无法找到附件文件: ' + rowData.Attachment);
        // 继续发送，但没有附件
      }
    }
    
    const htmlContent = rowData.Content.toString().replaceAll("\n", '<br />');
    
    MailApp.sendEmail({
      to: toEmail,
      subject: `定时推送 - ${rowData.Topic}`,
      htmlBody: htmlContent,
      attachments: attachments
    });
    
    Logger.log(`邮件发送成功至: ${toEmail}`);
    return true;
    
  } catch (error) {
    Logger.log('发送邮件失败: ' + error);
    return false;
  }
}

/**
 * 从用户名生成邮箱地址（已废弃，保留以兼容旧代码）
 * 新格式直接存储为 esone.qiu+john.doe，无需转换
 * 例：esone.qiu+john.doe -> esone.qiu+john.doe@reply.ringcentral.glip.com
 */
function generateEmailFromName(name) {
  if (!name) return null;
  
  // 如果已经是新格式（包含点号），直接使用
  if (name.includes('.')) {
    return name + '@reply.ringcentral.glip.com';
  }
  
  // 兼容旧格式：Esone Qiu -> esone.qiu
  const nameParts = name.trim().split(/\s+/);
  if (nameParts.length >= 2) {
    return nameParts[0].toLowerCase() + '.' + nameParts[1].toLowerCase() + '@reply.ringcentral.glip.com';
  } else {
    return nameParts[0].toLowerCase() + '@reply.ringcentral.glip.com';
  }
}

/**
 * 更新执行日志
 */
function updateExecutionLog(sheet, rowIndex, rowData, success, headers, errorMsg) {
  const now = new Date();
  const execCount = (parseInt(rowData.Exec_Count) || 0) + 1;
  const nextExec = calculateNextExecution(rowData, now);
  
  // 获取列索引
  const lastExecCol = getColumnIndex(headers, 'Last_Exec');
  const execCountCol = getColumnIndex(headers, 'Exec_Count');
  const nextExecCol = getColumnIndex(headers, 'Next_Exec');
  const execLogCol = getColumnIndex(headers, 'Exec_Log');
  const statusCol = getColumnIndex(headers, 'Status');
  
  // 更新列
  if (lastExecCol > 0) {
    sheet.getRange(rowIndex, lastExecCol).setValue(
      Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
    );
  }
  
  if (execCountCol > 0) {
    sheet.getRange(rowIndex, execCountCol).setValue(execCount);
  }
  
  if (nextExecCol > 0 && nextExec) {
    sheet.getRange(rowIndex, nextExecCol).setValue(nextExec);
  }
  
  if (execLogCol > 0) {
    const logMessage = success ? 
      '✅ 推送成功' : 
      ('❌ 推送失败' + (errorMsg ? ': ' + errorMsg : ''));
    sheet.getRange(rowIndex, execLogCol).setValue(logMessage);
  }
  
  // 如果达到 Repeat_Count，标记为 Completed
  if (rowData.Repeat_Count && execCount >= parseInt(rowData.Repeat_Count)) {
    if (statusCol > 0) {
      sheet.getRange(rowIndex, statusCol).setValue('Completed');
    }
  }
}

/**
 * 计算下次执行时间
 */
function calculateNextExecution(rowData, currentTime) {
  const type = rowData.Type;
  
  if (type === 'Daily') {
    // Daily 类型只执行一次
    return '';
    
  } else if (type === 'Hourly') {
    // Hourly 类型也只执行一次（除非是 Periodic）
    return '';
    
  } else if (type === 'Periodic') {
    const startDate = new Date(rowData.Schedule_Date);
    const every = parseInt(rowData.Repeat_Every) || 1;
    const repeatUnit = rowData.Repeat_Unit || 'Day';
    
    let nextDate = new Date(currentTime);
    
    if (repeatUnit === 'Day') {
      nextDate.setDate(nextDate.getDate() + every);
    } else if (repeatUnit === 'Week') {
      nextDate.setDate(nextDate.getDate() + (7 * every));
    } else if (repeatUnit === 'Month') {
      nextDate.setMonth(nextDate.getMonth() + every);
    } else if (repeatUnit === 'Year') {
      nextDate.setFullYear(nextDate.getFullYear() + every);
    }
    
    return Utilities.formatDate(nextDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  
  return '';
}

// ========== Web App 端点（供 Jira Automation 调用）==========

/**
 * Web App GET 请求处理
 */
function doGet(e) {
  const action = e.parameter.action;
  Logger.log(`action: ${action}`);
  
  // 授权成功页面
  if (action === 'authSuccess') {
    return HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>授权成功</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
            }
            .container {
              background: white;
              padding: 50px;
              border-radius: 20px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 500px;
            }
            .success-icon {
              font-size: 80px;
              margin-bottom: 20px;
            }
            h1 {
              color: #28a745;
              font-size: 32px;
              margin-bottom: 20px;
            }
            p {
              color: #666;
              font-size: 16px;
              line-height: 1.6;
              margin-bottom: 15px;
            }
            .highlight {
              color: #667eea;
              font-weight: bold;
            }
            .btn {
              display: inline-block;
              padding: 12px 30px;
              background: #28a745;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              margin-top: 20px;
              transition: background 0.3s;
            }
            .btn:hover {
              background: #218838;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">🎉</div>
            <h1>授权成功！</h1>
            <p>您已成功授权 <span class="highlight">Personal AI - Scheduled Messages</span></p>
            <p>现在可以关闭此页面，返回扩展页面点击 <span class="highlight">"我已完成授权，继续初始化"</span> 按钮完成剩余步骤。</p>
            <p style="font-size: 14px; color: #999; margin-top: 30px;">
              💡 提示：请保持此标签页打开，直到完成所有初始化步骤
            </p>
          </div>
        </body>
      </html>
    `);
  }
  
  // 获取当前时间点需要执行的单条 Bot 消息（供 Jira Automation 调用）
  // 只返回消息数据，不调用 Bot API（Bot API 由 Jira 调用，因为在内网）
  if (action === 'getBotMessageCurrentTime') {
    return ContentService.createTextOutput(
      JSON.stringify(getMessageCurrentTime())
    ).setMimeType(ContentService.MimeType.JSON);
  }
  
  // 标记 Bot 消息执行完成（供 Jira Automation 在发送后调用）
  if (action === 'markBotMessageExecuted') {
    const messageId = e.parameter.messageId || '';
    const rowIndex = parseInt(e.parameter.rowIndex) || 0;
    const success = e.parameter.success === 'true';
    const error = e.parameter.error || '';
    
    return ContentService.createTextOutput(
      JSON.stringify(markBotMessageExecuted(messageId, rowIndex, success, error))
    ).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'setupTriggers') {
    // 通过 Web App 创建触发器
    // 这是唯一能从外部（Chrome Extension）触发触发器创建的方式
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
    JSON.stringify({ status: 'OK', message: 'Personal AI Scheduled Messages API' })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 内部函数：设置触发器
 * 由 Web App 的 doGet 调用，因为 ScriptApp.newTrigger 只能在 Apps Script 环境内执行
 */
function setupTriggersInternal() {
  // 删除现有的所有触发器，避免重复创建
  var existingTriggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existingTriggers.length; i++) {
    ScriptApp.deleteTrigger(existingTriggers[i]);
  }
  
  // 创建新的触发器
  // 每分钟触发器（处理 Hourly 类型消息）
  ScriptApp.newTrigger('minuteTrigger')
    .timeBased()
    .everyMinutes(1)
    .create();
  
  // 每日触发器（每天早上 9 点，处理 Daily 和 Periodic 类型消息）
  ScriptApp.newTrigger('dailyTrigger')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();
  
  Logger.log('触发器创建成功');
  return 'Triggers created successfully: minuteTrigger (every 1 minute), dailyTrigger (daily at 9:00 AM)';
}

/**
 * ==============================================
 * Bot 单条消息执行逻辑（新版本 - 供 Jira Automation 调用）
 * ==============================================
 */

/**
 * 获取当前时间点需要执行的消息并返回消息数据（合并了原来的两个方法）
 * 供 Jira Automation 调用，Jira 负责调用内网 Bot API
 * @returns {object|null} 消息数据对象或 null
 */
function getMessageCurrentTime() {
  try {
    // === 第一部分：从 Sheet 查找消息 ===
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Messages');
    if (!sheet) {
      Logger.log('错误：未找到 Messages 工作表');
      return {
        executed: false,
        message: '未找到 Messages 工作表',
        timestamp: new Date().toISOString()
      };
    }
    
    const data = sheet.getDataRange().getDisplayValues();
    if (data.length <= 1) {
      Logger.log('没有消息数据');
      return {
        executed: false,
        message: '没有消息数据',
        timestamp: new Date().toISOString()
      };
    }
    
    const headers = data[0];
    const now = new Date();
    const currentDate = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const currentMinute = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm');
    const currentHour = now.getHours();
    
    Logger.log(`[Bot 单条消息] 当前时间: ${currentDate} ${currentMinute}`);
    
    // 优先级 1：查找当前分钟需要执行的消息
    Logger.log('[Bot 单条消息] 优先级 1：查找当前分钟的消息...');
    let message = findMessageByPriority(data, headers, now, currentDate, 1, currentHour);
    if (message) {
      Logger.log(`[Bot 单条消息] ✅ 找到优先级 1 消息: ${message.ID} - ${message.Topic}`);
    }
    
    // 优先级 2：查找过去 30 分钟内应该执行但未执行的消息
    if (!message) {
      Logger.log('[Bot 单条消息] 优先级 2：查找过去 30 分钟的消息...');
      message = findMessageByPriority(data, headers, now, currentDate, 2, currentHour);
      if (message) {
        Logger.log(`[Bot 单条消息] ✅ 找到优先级 2 消息: ${message.ID} - ${message.Topic}`);
      }
    }
    
    // 优先级 3：查找未指定时间的消息（仅限 8 点后）
    if (!message && currentHour >= 8) {
      Logger.log('[Bot 单条消息] 优先级 3：查找未指定时间的消息（8点后）...');
      message = findMessageByPriority(data, headers, now, currentDate, 3, currentHour);
      if (message) {
        Logger.log(`[Bot 单条消息] ✅ 找到优先级 3 消息: ${message.ID} - ${message.Topic}`);
      }
    }
    
    if (!message) {
      Logger.log('[Bot 单条消息] ❌ 没有符合条件的消息');
      return {
        executed: false,
        message: '当前时间点没有需要执行的 Bot 消息',
        timestamp: new Date().toISOString()
      };
    }
    
    // === 第二部分：处理消息数据 ===
    
    // 确保消息有 ID，如果没有则生成一个
    let messageId = message.ID;
    if (!messageId || messageId.toString().trim() === '') {
      messageId = `MSG_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`;
      Logger.log(`消息没有 ID，生成新 ID: ${messageId}`);
      
      // 更新 Sheet 中的 ID
      try {
        if (sheet && message.rowIndex) {
          const idColIndex = message.headers.indexOf('ID') + 1;
          if (idColIndex > 0) {
            sheet.getRange(message.rowIndex, idColIndex).setValue(messageId);
            Logger.log(`已将生成的 ID 写入 Sheet: 行 ${message.rowIndex}`);
          }
        }
      } catch (updateError) {
        Logger.log(`更新 Sheet ID 失败: ${updateError}`);
      }
    }
    
    Logger.log(`返回待发送 Bot 消息数据: ${messageId} - ${message.Topic}`);
    
    // 检查是否是 AI 消息
    if (message.Push_Method === 'AI') {
      Logger.log(`处理 AI 消息: ${messageId}`);
      
      // 解析 AI 相关字段
      const endpointInfo = parseAIEndpoint(message.AI_Endpoint || '');
      const headersObj = parseAIHeaders(message.AI_Headers || '');
      const bodyStr = replaceAIBodyVariables(
        message.AI_Body || '',
        message.Topic || '',
        message.Content || ''
      );
      
      Logger.log(`AI URL 解析结果: host=${endpointInfo.host}, uri=${endpointInfo.uri}, method=${endpointInfo.method}`);
      
      // 立即标记为成功（避免超时重复）
      try {
        markBotMessageExecuted(messageId, message.rowIndex, true, '');
        Logger.log(`AI 消息已标记为成功: ${messageId}`);
      } catch (markError) {
        Logger.log(`标记 AI 消息失败: ${markError}`);
      }
      
      // 返回 AI 消息数据（host 和 uri 分开）
      return {
        executed: true,
        messageId: messageId,
        targetType: 'api',
        aiEndpoint: endpointInfo.url,
        aiHost: endpointInfo.host,
        aiUri: endpointInfo.uri,
        aiMethod: endpointInfo.method,
        aiHeaders: headersObj,
        aiBody: bodyStr,
        rowIndex: message.rowIndex,
        timestamp: new Date().toISOString()
      };
    }
    
    // 返回消息数据，供 Jira 调用 Bot API
    // 支持两种类型：private（私聊）、group（群组）和 api（AI Report）
    
    return {
      executed: true,
      messageId: messageId,
      topic: message.Topic,
      content: message.Content,
      targetType: message.targetType,
      // Private 消息字段
      userName: message.Glip_User_Name || '',
      // Group 消息字段
      teamId: message.Glip_Team_ID || '',
      teamName: message.Glip_Team_ID || 'Team', // 使用 teamId 作为 teamName 或默认值
      rowIndex: message.rowIndex,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    Logger.log(`getMessageCurrentTime 执行失败: ${error}`);
    return {
      executed: false,
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 标记消息执行完成（由 Jira Automation 在发送后调用）
 * @param {string} messageId - 消息 ID
 * @param {number} rowIndex - 行索引（从 getMessageCurrentTime 返回，可选）
 * @param {boolean} success - 是否成功
 * @param {string} errorMsg - 错误消息（可选）
 * @returns {object} 更新结果
 */
function markBotMessageExecuted(messageId, rowIndex, success, errorMsg) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Messages');
    if (!sheet) {
      return { success: false, error: 'Messages sheet not found' };
    }
    
    const data = sheet.getDataRange().getDisplayValues();
    const headers = data[0];
    
    // 如果没有提供 rowIndex 或 rowIndex 无效，通过 messageId 查找
    let actualRowIndex = rowIndex;
    if (!rowIndex || rowIndex < 1 || rowIndex >= data.length) {
      Logger.log(`rowIndex 无效 (${rowIndex})，尝试通过 messageId 查找: ${messageId}`);
      actualRowIndex = findRowIndexByMessageId(data, headers, messageId);
      
      if (!actualRowIndex) {
        return { 
          success: false, 
          error: `无法找到消息 ID: ${messageId}`,
          messageId: messageId
        };
      }
      Logger.log(`通过 messageId 找到行索引: ${actualRowIndex}`);
    }
    
    const row = data[actualRowIndex - 1]; // rowIndex 是从 1 开始的
    if (!row) {
      return { 
        success: false, 
        error: `行索引 ${actualRowIndex} 超出范围`,
        messageId: messageId
      };
    }
    
    const rowData = parseRow(row, headers);
    
    // 更新执行日志
    updateExecutionLog(sheet, actualRowIndex, rowData, success, headers, errorMsg);
    
    // 检查是否应该标记为 Done
    if (success && shouldMarkAsDone(rowData)) {
      const statusColIndex = getColumnIndex(headers, 'Status');
      if (statusColIndex > 0) {
        sheet.getRange(actualRowIndex, statusColIndex).setValue('Done');
        Logger.log(`任务已完成所有推送，标记为 Done: ${messageId}`);
      }
    }
    
    Logger.log(`标记消息执行完成: ${messageId}, 成功: ${success}`);
    
    return {
      success: true,
      messageId: messageId,
      marked: true,
      rowIndex: actualRowIndex
    };
    
  } catch (error) {
    Logger.log(`markBotMessageExecuted 执行失败: ${error}`);
    return {
      success: false,
      error: error.toString(),
      messageId: messageId
    };
  }
}

/**
 * 通过消息 ID 查找行索引
 * @param {array} data - 表格数据
 * @param {array} headers - 表头
 * @param {string} messageId - 消息 ID
 * @returns {number|null} 行索引（从 1 开始）或 null
 */
function findRowIndexByMessageId(data, headers, messageId) {
  const idColIndex = headers.indexOf('ID');
  if (idColIndex === -1) {
    Logger.log('错误：未找到 ID 列');
    return null;
  }
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idColIndex] && data[i][idColIndex].toString() === messageId.toString()) {
      return i + 1; // 返回从 1 开始的索引
    }
  }
  
  Logger.log(`未找到消息 ID: ${messageId}`);
  return null;
}

/**
 * 判断任务是否应该标记为 Done
 * @param {object} rowData - 行数据对象
 * @returns {boolean} 是否应该标记为 Done
 */
function shouldMarkAsDone(rowData) {
  const messageType = determineMessageType(rowData);
  
  // 非周期性消息（Daily 或 Hourly）：执行一次后就标记为 Done
  if (messageType === 'Daily' || messageType === 'Hourly') {
    return true;
  }
  
  // Periodic 消息：需要判断是否还有下一次执行
  if (messageType === 'Periodic') {
    const now = new Date();
    
    // 检查是否有结束日期，且已经过了结束日期
    if (rowData.End_Date) {
      const endDate = new Date(rowData.End_Date);
      if (now > endDate) {
        return true;
      }
    }
    
    // 检查是否达到重复次数限制
    if (rowData.Repeat_Count) {
      const repeatCount = parseInt(rowData.Repeat_Count);
      const execCount = parseInt(rowData.Exec_Count) || 0;
      if (execCount >= repeatCount) {
        return true;
      }
    }
    
    // 还有下一次执行，不标记为 Done
    return false;
  }
  
  return false;
}


/**
 * 按优先级查找消息（找到第一条符合条件的即返回）
 * @param {array} data - 表格数据
 * @param {array} headers - 表头
 * @param {Date} now - 当前时间
 * @param {string} currentDate - 当前日期（yyyy-MM-dd）
 * @param {number} priority - 优先级（1=当前分钟，2=过去30分钟，3=未指定时间）
 * @param {number} currentHour - 当前小时
 * @returns {object|null} 消息对象或 null
 */
function findMessageByPriority(data, headers, now, currentDate, priority, currentHour) {
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowData = parseRow(row, headers);
    
    // 基本过滤：必须是 Active + Bot 或 AI
    if (rowData.Status !== 'Active' || (rowData.Push_Method !== 'Bot' && rowData.Push_Method !== 'AI')) {
      continue;
    }
    
    // 过滤：今日已推送成功的消息
    if (isPushedSuccessfullyToday(rowData, currentDate)) {
      continue;
    }
    
    // 过滤：今日已推送失败的消息（避免阻塞队列）
    if (isPushedFailedToday(rowData, currentDate)) {
      continue;
    }
    
    const messageType = determineMessageType(rowData);
    
    // 根据优先级判断是否符合条件
    let matches = false;
    
    if (priority === 1) {
      // 当前分钟的消息
      matches = shouldExecuteNow(rowData, now, messageType);
    } else if (priority === 2) {
      // 过去 30 分钟内应该执行但未执行的
      matches = shouldExecuteInPast30Minutes(rowData, now, messageType, currentDate);
    } else if (priority === 3) {
      // 未指定时间的消息（8 点后）
      matches = shouldExecuteTodayWithoutTime(rowData, now, messageType, currentDate);
    }
    
    if (matches) {
      // 找到符合条件的消息，立即返回
      return {
        ID: rowData.ID,
        Topic: rowData.Topic,
        Content: rowData.Content,
        Push_Method: rowData.Push_Method,
        Glip_Team_ID: rowData.Glip_Team_ID,
        Glip_User_Name: rowData.Glip_User_Name,
        Bot_Endpoint: rowData.Bot_Endpoint,
        AI_Endpoint: rowData.AI_Endpoint,
        AI_Headers: rowData.AI_Headers,
        AI_Body: rowData.AI_Body,
        targetType: rowData.Push_Method === 'AI' ? 'api' : (rowData.Glip_User_Name ? 'private' : 'group'),
        Schedule_Date: rowData.Schedule_Date,
        Schedule_Time: rowData.Schedule_Time,
        Created_At: rowData.Created_At || '',
        messageType: messageType,
        rowIndex: i + 1,
        rowData: rowData,
        headers: headers,
        priority: priority
      };
    }
  }
  
  // 未找到符合条件的消息
  return null;
}

/**
 * 判断消息是否在过去 30 分钟内应该执行但未执行
 */
function shouldExecuteInPast30Minutes(rowData, now, messageType, currentDate) {
  // 只检查今天的消息
  if (!rowData.Schedule_Date || rowData.Schedule_Date !== currentDate) {
    return false;
  }
  
  // 只处理有指定时间的消息
  if (!rowData.Schedule_Time || !rowData.Schedule_Time.toString().trim()) {
    return false;
  }
  
  const scheduleTime = rowData.Schedule_Time.toString().trim();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const scheduleMinutes = parseTimeToMinutes(scheduleTime);
  
  // 在过去 30 分钟窗口内
  const diff = nowMinutes - scheduleMinutes;
  return diff > 0 && diff <= 30;
}

/**
 * 判断消息是否是今天未指定时间的
 */
function shouldExecuteTodayWithoutTime(rowData, now, messageType, currentDate) {
  // 必须是今天
  if (!rowData.Schedule_Date || rowData.Schedule_Date !== currentDate) {
    return false;
  }
  
  // 必须没有指定时间
  if (rowData.Schedule_Time && rowData.Schedule_Time.toString().trim()) {
    return false;
  }
  
  return true;
}

/**
 * 判断消息今日是否已成功推送
 */
function isPushedSuccessfullyToday(rowData, currentDate) {
  const lastExec = rowData.Last_Exec;
  const execLog = rowData.Exec_Log || '';
  
  if (!lastExec) return false;
  
  // 检查 Last_Exec 是否是今天
  const lastExecDate = lastExec.toString().substring(0, 10);
  if (lastExecDate !== currentDate) {
    return false;
  }
  
  // 检查是否成功（包含 ✅ 或 "成功"）
  const isSuccess = execLog.includes('✅') || execLog.includes('成功');
  
  return isSuccess;
}

/**
 * 判断消息今日是否推送失败
 */
function isPushedFailedToday(rowData, currentDate) {
  const lastExec = rowData.Last_Exec;
  const execLog = rowData.Exec_Log || '';
  
  if (!lastExec) return false;
  
  // 检查 Last_Exec 是否是今天
  const lastExecDate = lastExec.toString().substring(0, 10);
  if (lastExecDate !== currentDate) {
    return false;
  }
  
  // 检查是否失败（包含 ❌ 或 "失败"）
  const isFailed = execLog.includes('❌') || execLog.includes('失败');
  
  return isFailed;
}

/**
 * 将时间字符串（HH:mm）转换为分钟数
 */
function parseTimeToMinutes(timeStr) {
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  
  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  
  return hours * 60 + minutes;
}

/**
 * 解析 AI_Endpoint：提取 method、host 和 URI 路径
 * 格式：\"POST https://example.com/api\" 或 \"GET https://example.com/api\" 或 \"https://example.com/api\"
 * @param {string} endpointStr - 原始 endpoint 字符串
 * @returns {object} {method: 'GET'|'POST', host: string, endpoint: string (URI路径), url: string}
 */
function parseAIEndpoint(endpointStr) {
  if (!endpointStr || !endpointStr.toString().trim()) {
    return { method: 'GET', host: '', endpoint: '', url: '' };
  }
  
  const str = endpointStr.toString().trim();
  const upperStr = str.toUpperCase();
  
  let method = 'GET';
  let url = str;
  
  // 提取 method
  if (upperStr.startsWith('POST ')) {
    method = 'POST';
    url = str.substring(5).trim();
  } else if (upperStr.startsWith('GET ')) {
    method = 'GET';
    url = str.substring(4).trim();
  }
  
  // 解析 URL：分离 host 和 URI 路径
  let host = '';
  let uri = '';
  
  try {
    // 移除协议部分（http:// 或 https://）
    const protocolMatch = url.match(/^(https?:\/\/)?(.+)/i);
    if (protocolMatch) {
      const withoutProtocol = protocolMatch[2];
      
      // 找到第一个 / 的位置
      const slashIndex = withoutProtocol.indexOf('/');
      
      if (slashIndex === -1) {
        // 没有路径，整个是 host
        host = withoutProtocol;
        uri = '';
      } else {
        // 分离 host 和 URI 路径（去掉前导 /）
        host = withoutProtocol.substring(0, slashIndex);
        uri = withoutProtocol.substring(slashIndex + 1);
      }
    }
  } catch (parseError) {
    Logger.log('解析 AI Endpoint 失败: ' + parseError);
    host = '';
    uri = url;
  }
  
  return { method: method, host: host, uri: uri, url: url };
}

/**
 * 解析 AI_Headers：将字符串格式解析为固定字段对象
 * 格式：\"Authorization: Bearer token\\nContent-Type: application/json\"
 * 返回：{Authorization: '...', ContentType: '...', Accept: '...', ...}
 * @param {string} headersStr - 原始 headers 字符串
 * @returns {object} 固定字段对象
 */
function parseAIHeaders(headersStr) {
  // 固定的 header 字段，带默认值
  const result = {
    Authorization: '',
    ContentType: 'application/json',  // 默认 JSON，避免某些 API 报错
    Accept: '*/*',                     // 默认接受所有类型
    XAPIKey: '',
    UserAgent: 'PersonalAI-ScheduledMessages/1.0',  // 默认 User-Agent
    XRequestID: '',
    XCustomHeader: ''
  };
  
  if (!headersStr || !headersStr.toString().trim()) {
    return result;
  }
  
  const lines = headersStr.toString().split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const name = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();
    
    if (!value) continue; // 跳过空值
    
    // 映射到固定字段（覆盖默认值）
    if (name === 'Authorization') {
      result.Authorization = value;
    } else if (name === 'Content-Type') {
      result.ContentType = value;
    } else if (name === 'Accept') {
      result.Accept = value;
    } else if (name === 'X-API-Key') {
      result.XAPIKey = value;
    } else if (name === 'User-Agent') {
      result.UserAgent = value;
    } else if (name === 'X-Request-ID') {
      result.XRequestID = value;
    } else if (name === 'X-Custom-Header') {
      result.XCustomHeader = value;
    }
  }
  
  return result;
}

/**
 * 替换 AI Body 中的变量（{Topic} 和 {Content}），并进行 JSON 转义
 * @param {string} bodyStr - Body 模板字符串
 * @param {string} topic - Topic 值
 * @param {string} content - Content 值
 * @returns {string} 替换后的字符串
 */
function replaceAIBodyVariables(bodyStr, topic, content) {
  if (!bodyStr || !bodyStr.toString()) {
    return '';
  }
  
  // JSON 转义函数：转义双引号、反斜杠、换行符等特殊字符
  function escapeJsonString(str) {
    if (!str) return '';
    return str.toString()
      .replace(/"/g, '\\"')     // 双引号
  }
  
  let result = bodyStr.toString();
  
  // 替换 {Topic} 和 {Content}，并进行 JSON 转义
  result = result.replace(/\{Topic\}/g, escapeJsonString(topic || ''));
  result = result.replace(/\{Content\}/g, escapeJsonString(content || ''));
  
  return result;
}

