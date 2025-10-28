/**
 * Personal AI - 定时消息执行引擎
 * 统一处理 Email 推送的定时消息
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
    
    // 检查是否需要执行
    if (!types.includes(rowData.Type)) continue;
    if (rowData.Status !== 'Active') continue;
    if (rowData.Push_Method === 'Bot_API') continue; // Bot API 由 Jira 处理
    
    try {
      if (shouldExecuteNow(rowData, now)) {
        Logger.log(`准备执行消息: ${rowData.ID} - ${rowData.Topic}`);
        
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
 * 解析行数据为对象
 */
function parseRow(row, headers) {
  const rowData = {};
  headers.forEach((header, idx) => {
    rowData[header] = row[idx];
  });
  return rowData;
}

/**
 * 获取列索引
 */
function getColumnIndex(headers, columnName) {
  return headers.indexOf(columnName) + 1;
}

/**
 * 判断是否应该在当前时间执行
 */
function shouldExecuteNow(rowData, now) {
  const type = rowData.Type;
  
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
    if (rowData.Glip_User_Name && rowData.Glip_User_Name.toString().trim()) {
      toEmail = generateEmailFromName(rowData.Glip_User_Name.toString());
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
 * 从用户名生成邮箱地址
 * 例：Esone Qiu -> esone.qiu@reply.ringcentral.glip.com
 */
function generateEmailFromName(name) {
  if (!name) return null;
  
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
  
  if (action === 'getActiveBotMessages') {
    return ContentService.createTextOutput(
      JSON.stringify(getMessagesToExecute())
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
 * 获取需要通过 Bot API 执行的消息
 */
function getMessagesToExecute() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Messages');
  if (!sheet) {
    return { messages: [], error: 'Messages sheet not found' };
  }
  
  // 使用 getDisplayValues() 强制以文本格式读取所有数据
  const data = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) {
    return { messages: [] };
  }
  
  const headers = data[0];
  const now = new Date();
  const messages = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = parseRow(data[i], headers);
    
    // 只返回需要执行的 Bot API 消息
    if (row.Status === 'Active' && 
        (row.Push_Method === 'Bot_API' || row.Push_Method === 'Both') &&
        shouldExecuteNow(row, now)) {
      
      messages.push({
        id: row.ID,
        topic: row.Topic,
        content: row.Content,
        glipTeamId: row.Glip_Team_ID ? row.Glip_Team_ID.toString() : '',
        glipUserName: row.Glip_User_Name ? row.Glip_User_Name.toString() : '',
        botEndpoint: row.Bot_Endpoint ? row.Bot_Endpoint.toString() : ''
      });
      
      // 更新执行记录
      try {
        updateExecutionLog(sheet, i + 1, row, true, headers);
      } catch (error) {
        Logger.log(`更新执行日志失败: ${error}`);
      }
    }
  }
  
  return { 
    messages, 
    timestamp: now.toISOString(),
    count: messages.length
  };
}


