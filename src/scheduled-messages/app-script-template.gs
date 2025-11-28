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


/**
 * 每分钟触发器（统一处理所有类型的消息）
 * 
 * 执行逻辑：
 * 1. 判断日期是否匹配（OneTime/Periodic 检查日期，Timeline 检查里程碑）
 * 2. 判断时间是否匹配（有 Schedule_Time 则匹配分钟，无则在 9:00 执行）
 * 3. 发送消息
 */
function minuteTrigger() {
  executeScheduledMessages();
}

/**
 * 自动判断消息类型
 * 
 * 类型说明：
 * - Timeline: 基于项目进度的消息（没有 Schedule_Date，有 Timeline_Milestone）
 * - Periodic: 周期性重复消息（有 Repeat_Every 和 Repeat_Unit）
 * - OneTime: 一次性消息（有 Schedule_Date，没有周期字段）
 * 
 * 注意：所有类型都可能有或没有 Schedule_Time
 * - 有 Schedule_Time: 在指定时间执行
 * - 无 Schedule_Time: 默认在早上 9:00 执行
 */
function determineMessageType(rowData) {
  // Timeline 消息：基于项目进度（没有 Schedule_Date，有 Timeline_Milestone）
  if (!rowData.Schedule_Date && rowData.Timeline_Milestone) {
    return 'Timeline';
  }
  
  // Periodic 消息：周期性重复（有 Repeat_Every 和 Repeat_Unit）
  if (rowData.Repeat_Every && rowData.Repeat_Unit) {
    return 'Periodic';
  }
  
  // OneTime 消息：一次性消息（有 Schedule_Date，没有周期字段）
  return 'OneTime';
}

/**
 * 执行定时消息（统一处理所有类型）
 * 
 * 支持的消息类型：
 * - Timeline: 基于项目进度的消息（由 Jira 处理，AsMe 方式跳过）
 * - Periodic: 周期性重复消息
 * - OneTime: 一次性消息
 */
function executeScheduledMessages() {
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
  const currentDate = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  
  Logger.log(`开始执行定时任务，当前时间: ${Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')}`);
  
  // 遍历每一行（跳过表头）
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowData = parseRow(row, headers);
    
    // 自动判断消息类型
    const messageType = determineMessageType(rowData);
    
    // 跳过 Timeline 消息（需要通过 Jira 获取内网 release info）
    if (messageType === 'Timeline') {
      continue;
    }
    
    // 基本过滤条件
    if (rowData.Status !== 'Active') continue;
    if (rowData.Push_Method !== 'AsMe') continue; // Bot 和 AI 由 Jira 处理
    
    try {
      // 步骤 1: 先判断日期是否匹配
      let dateMatches = false;
      
      if (messageType === 'Periodic') {
        // Periodic 消息：使用周期性日期判断逻辑
        dateMatches = checkPeriodicSchedule(rowData, now);
      } else {
        // OneTime 消息：检查 Schedule_Date 是否匹配今天
        dateMatches = rowData.Schedule_Date && rowData.Schedule_Date === currentDate;
      }
      
      // 日期不匹配，跳过
      if (!dateMatches) {
        continue;
      }
      
      // 步骤 2: 日期匹配后，判断时间是否匹配
      if (matchesCurrentMinuteTime(rowData, now, messageType)) {
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
 * 判断消息的时间是否匹配当前分钟（只判断时间条件，日期匹配需在调用前完成）
 * 
 * 时间匹配规则：
 * - 有 Schedule_Time: 匹配当前分钟 (±1分钟容差)
 * - 无 Schedule_Time: 在早上 9:00 执行（所有类型默认）
 * 
 * @param {object} rowData - 消息行数据
 * @param {Date} now - 当前时间
 * @param {string} messageType - 消息类型 (Timeline/Periodic/OneTime)
 * @returns {boolean} 时间是否匹配
 */
function matchesCurrentMinuteTime(rowData, now, messageType) {
  // 注意：日期匹配需在调用前完成，此方法只判断时间条件
  
  // 检查是否有指定时间
  const hasScheduleTime = rowData.Schedule_Time && rowData.Schedule_Time.toString().trim();
  
  if (hasScheduleTime) {
    // 有指定时间，检查时间是否匹配当前分钟（±1分钟容差）
    const scheduleMinutes = parseTimeToMinutes(rowData.Schedule_Time.toString());
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return Math.abs(nowMinutes - scheduleMinutes) <= 1;
  } else {
    // 没有指定时间，默认在早上 9:00 执行（所有类型统一）
    return now.getHours() === 9 && now.getMinutes() === 0;
  }
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
    
    // AsMe 推送不处理 Timeline 消息（Timeline 需要通过 Jira 获取内网 release info）
    // 所以这里不需要替换项目进度变量
    let topic = rowData.Topic.toString();
    let content = rowData.Content.toString();
    
    const htmlContent = content.replaceAll("\n", '<br />');
    
    MailApp.sendEmail({
      to: toEmail,
      subject: `定时推送 - ${topic}`,
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
 * 插入推送记录到 Logs 表
 * 新记录插入到第2行（表头下方），旧记录自动下移（倒序）
 * @param {string} messageId - 消息 ID
 * @param {string} topic - 消息主题
 * @param {string} content - 消息内容
 * @param {string} pushMethod - 推送方法（AsMe/Bot/AI）
 * @param {string} target - 目标（用户名/团队ID/API地址）
 * @param {boolean} success - 是否成功
 * @param {string} errorMsg - 错误信息（可选）
 * @param {number} execCount - 执行次数
 */
function insertPushLog(messageId, topic, content, pushMethod, target, success, errorMsg, execCount) {
  try {
    const logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Logs');
    if (!logsSheet) {
      Logger.log('警告：未找到 Logs 工作表，跳过记录推送日志');
      return;
    }
    
    const now = new Date();
    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const status = success ? 'Success' : 'Failed';
    const error = errorMsg || '';
    
    // 构建日志记录（按 Logs 表头顺序）
    // Timestamp, Message_ID, Topic, Content, Push_Method, Target, Status, Error, Exec_Count
    const logRow = [
      timestamp,
      messageId,
      topic,
      content,
      pushMethod,
      target,
      status,
      error,
      execCount
    ];
    
    // 在第2行插入新行（表头是第1行）
    logsSheet.insertRowAfter(1);
    
    // 写入数据到新插入的第2行
    logsSheet.getRange(2, 1, 1, logRow.length).setValues([logRow]);
    
    Logger.log(`推送记录已插入: ${messageId} - ${status}`);
    
  } catch (error) {
    Logger.log(`插入推送记录失败: ${error}`);
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 更新执行日志
 * 
 * 功能：
 * 1. 更新 Last_Exec、Exec_Count、Next_Exec、Exec_Log
 * 2. 如果成功且满足完成条件（通过 shouldMarkAsDone 判断），标记为 Done
 * 3. 插入推送记录到 Logs 表
 * 
 * 完成条件（由 shouldMarkAsDone 统一判断）：
 * - Timeline: 不标记为 Done（基于发布周期，会重复触发）
 * - OneTime: 执行一次后标记为 Done
 * - Periodic: 达到结束日期或重复次数后标记为 Done
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
  
  // 检查是否应该标记为 Done（统一使用 shouldMarkAsDone 逻辑）
  if (success && shouldMarkAsDone(rowData)) {
    if (statusCol > 0) {
      sheet.getRange(rowIndex, statusCol).setValue('Done');
      Logger.log(`任务已完成所有推送，标记为 Done: ${rowData.ID}`);
    }
  }
  
  // 插入推送记录到 Logs 表
  // 确定目标：优先使用 Glip_User_Name，其次使用 Glip_Team_ID
  let target = '';
  if (rowData.Glip_User_Name && rowData.Glip_User_Name.toString().trim()) {
    target = rowData.Glip_User_Name.toString().trim();
  } else if (rowData.Glip_Team_ID && rowData.Glip_Team_ID.toString().trim()) {
    target = rowData.Glip_Team_ID.toString().trim();
  }
  
  insertPushLog(
    rowData.ID,
    rowData.Topic || '',
    rowData.Content || '',
    rowData.Push_Method || 'AsMe',
    target,
    success,
    errorMsg || '',
    execCount
  );
}

/**
 * 计算下次执行时间
 * 
 * 规则：
 * - Timeline: 不计算固定时间（基于项目里程碑，下次执行时间由 releaseInfo 动态决定）
 * - OneTime: 执行一次，不计算下次时间
 * - Periodic: 根据周期规则计算下次执行日期
 * 
 * @param {object} rowData - 消息行数据
 * @param {Date} currentTime - 当前时间
 * @returns {string} 下次执行日期（yyyy-MM-dd）或空字符串
 */
function calculateNextExecution(rowData, currentTime) {
  const messageType = determineMessageType(rowData);
  
  if (messageType === 'Timeline') {
    // Timeline 消息：下次执行时间由项目里程碑决定，不是固定周期
    return '';
    
  } else if (messageType === 'OneTime') {
    // OneTime 消息：只执行一次
    return '';
    
  } else if (messageType === 'Periodic') {
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
  // 支持两种模式：
  // 1. 带 releaseInfo 参数：用于 Timeline 消息匹配
  // 2. 不带 releaseInfo：只匹配普通时间触发的消息
  if (action === 'getBotMessageCurrentTime') {
    const currentTimeStr = e.parameter.currentTime || '';
    
    // 从 URL 参数接收 releaseInfo（可选）
    const mThor = e.parameter.mThor || '';
    const jupiterDesktop = e.parameter.jupiterDesktop || '';
    const jupiterWeb = e.parameter.jupiterWeb || '';
    
    let releaseInfo = null;
    
    // 如果提供了 releaseInfo 参数，则解析
    if (mThor || jupiterDesktop || jupiterWeb) {
      try {
        releaseInfo = {};
        if (mThor) releaseInfo['mThor'] = parseJiraJson(mThor);
        if (jupiterDesktop) releaseInfo['Jupiter desktop'] = parseJiraJson(jupiterDesktop);
        if (jupiterWeb) releaseInfo['Jupiter web'] = parseJiraJson(jupiterWeb);
        
        Logger.log(`[GET] 接收到 releaseInfo 参数，项目: ${Object.keys(releaseInfo).join(', ')}`);
      } catch (parseError) {
        Logger.log(`[GET] 解析 releaseInfo 失败: ${parseError.toString()}`);
        releaseInfo = null; // 解析失败，使用原方案
      }
    } else {
      Logger.log(`[GET] 未提供 releaseInfo，使用原方案（不匹配 Timeline 消息）`);
    }
    
    // 构建 postData 格式，复用现有函数
    const postData = {
      releaseInfo: releaseInfo || {},
      currentTime: currentTimeStr || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
    };
    
    const result = getMessageCurrentTimeWithReleaseInfo(postData);
    
    return ContentService.createTextOutput(
      JSON.stringify(result)
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
 * Web App POST 请求处理
 * 支持 Jira 传递 release info 数据
 */
function doPost(e) {
  try {
    const action = e.parameter.action;
    Logger.log(`POST action: ${action}`);
    Logger.log(`POST 请求来源: ${JSON.stringify(e.parameter)}`);
    
    if (action === 'getBotMessageCurrentTime') {
      // 解析 POST 数据
      const postData = JSON.parse(e.postData.contents);
      Logger.log(`接收到 releaseInfo 数据: ${JSON.stringify(postData).substring(0, 200)}...`);
      
      // 调用新的处理函数
      const result = getMessageCurrentTimeWithReleaseInfo(postData);
      
      // 返回响应，添加 CORS 和 Cache 控制头
      const output = ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
      
      return output;
    }
    
    // 默认响应
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ERROR', message: 'Unknown action' })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log(`doPost 错误: ${error.toString()}`);
    Logger.log(`错误堆栈: ${error.stack || '无堆栈信息'}`);
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ERROR', message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 内部函数：设置触发器
 * 由 Web App 的 doGet 调用，因为 ScriptApp.newTrigger 只能在 Apps Script 环境内执行
 * 
 * 触发器说明：
 * - minuteTrigger: 每分钟执行一次，统一处理所有类型的消息
 *   - Timeline: 基于项目进度（由 Jira 处理）
 *   - Periodic: 周期性重复消息
 *   - OneTime: 一次性消息
 */
function setupTriggersInternal() {
  // 删除现有的所有触发器，避免重复创建
  var existingTriggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existingTriggers.length; i++) {
    ScriptApp.deleteTrigger(existingTriggers[i]);
  }
  
  // 创建新的触发器：每分钟触发器（统一处理所有类型消息）
  ScriptApp.newTrigger('minuteTrigger')
    .timeBased()
    .everyMinutes(1)
    .create();
  
  Logger.log('触发器创建成功');
  return 'Trigger created successfully: minuteTrigger (every 1 minute, handles all message types)';
}

/**
 * 标记消息执行完成（由 Jira Automation 在发送后调用）
 * @param {string} messageId - 消息 ID
 * @param {number} rowIndex - 行索引（从 getMessageCurrentTimeWithReleaseInfo 返回，可选）
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
    
    // 更新执行日志（已包含 shouldMarkAsDone 判断和 insertPushLog 调用）
    updateExecutionLog(sheet, actualRowIndex, rowData, success, headers, errorMsg);
    
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
 * 
 * 标记规则：
 * - Timeline: 不标记为 Done（每次新的 release 都会触发，是周期性的）
 * - OneTime: 执行一次后标记为 Done
 * - Periodic: 根据结束条件判断（结束日期或重复次数）
 * 
 * @param {object} rowData - 行数据对象
 * @returns {boolean} 是否应该标记为 Done
 */
function shouldMarkAsDone(rowData) {
  const messageType = determineMessageType(rowData);
  
  // Timeline 消息：不标记为 Done（基于发布周期，每次 release 都会触发）
  if (messageType === 'Timeline') {
    return false;
  }
  
  // OneTime 消息：执行一次后就标记为 Done
  if (messageType === 'OneTime') {
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
 * 按匹配模式查找消息（三种匹配模式 + Timeline 支持 + 自动去重）
 * 
 * 功能说明：
 * 1. 支持三种匹配模式：当前分钟、过去30分钟、未指定时间
 * 2. 支持 Timeline 触发和时间触发两种类型
 * 3. 自动去重：跳过今日已推送成功或失败的消息
 * 4. 按表格顺序查找，返回第一个匹配的消息
 * 
 * @param {array} data - 表格数据
 * @param {array} headers - 表头
 * @param {Date} now - 当前时间
 * @param {object} releaseInfo - 项目进度信息（用于 Timeline 触发）
 * @param {string} matchMode - 匹配模式：'CURRENT_MINUTE' | 'PAST_30_MINUTES' | 'NO_TIME_SPECIFIED'
 * @param {string} currentDate - 当前日期（yyyy-MM-dd）
 * @param {number} currentHour - 当前小时
 * @returns {object|null} 消息对象或 null
 */
function findMatchingMessage(data, headers, now, releaseInfo, matchMode, currentDate, currentHour) {
  // 遍历所有消息，找到第一个符合匹配模式的消息（按表格顺序）
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
    
    // 先统一判断日期是否匹配
    let dateMatches = false;
    
    if (messageType === 'Timeline') {
      // Timeline 消息：需要 releaseInfo
      const hasReleaseInfo = releaseInfo && Object.keys(releaseInfo).length > 0;
      if (!hasReleaseInfo) {
        continue; // 没有 releaseInfo，跳过
      }
      
      // 获取 Timeline 目标日期
      const targetDate = getTimelineTargetDate(rowData, releaseInfo);
      dateMatches = targetDate && isSameDate(now, targetDate);
      
    } else if (messageType === 'Periodic') {
      // Periodic 消息：使用周期性日期判断逻辑
      dateMatches = checkPeriodicSchedule(rowData, now);
      
    } else {
      // OneTime 消息：检查 Schedule_Date 是否匹配今天
      dateMatches = rowData.Schedule_Date && rowData.Schedule_Date === currentDate;
    }
    
    // 日期不匹配，跳过
    if (!dateMatches) {
      continue;
    }
    
    // 日期匹配后，再根据匹配模式判断时间条件
    let matches = false;
    
    if (matchMode === 'CURRENT_MINUTE') {
      // 匹配模式 1：当前分钟的消息
      matches = matchesCurrentMinuteTime(rowData, now, messageType);
    } else if (matchMode === 'PAST_30_MINUTES') {
      // 匹配模式 2：过去 30 分钟内应该执行但未执行的
      matches = matchesPast30MinutesTime(rowData, now, messageType);
    } else if (matchMode === 'NO_TIME_SPECIFIED') {
      // 匹配模式 3：未指定时间的消息（8 点后）
      matches = matchesNoSpecifiedTime(rowData, now, messageType);
    }
    
    if (matches) {
      // 找到匹配的消息
      Logger.log(`[${matchMode}] 匹配消息: ${rowData.ID} - ${rowData.Topic} (行: ${i + 1})`);
      
      // 替换项目进度变量（仅 Timeline 消息）
      let topic = rowData.Topic;
      let content = rowData.Content;
      let aiBody = rowData.AI_Body || '';
      
      if (messageType === 'Timeline' && rowData.Timeline_Project) {
        const projectInfo = releaseInfo[rowData.Timeline_Project];
        if (projectInfo) {
          topic = replaceProjectVariablesInText(topic, projectInfo);
          content = replaceProjectVariablesInText(content, projectInfo);
          aiBody = replaceProjectVariablesInText(aiBody, projectInfo);
        }
      }
      
      // 生成 glipEmailAddress（用于 email targetType）
      let glipEmailAddress = '';
      if (rowData.Glip_User_Name) {
        glipEmailAddress = rowData.Glip_User_Name + '@reply.ringcentral.glip.com';
      } else if (rowData.Glip_Team_ID) {
        glipEmailAddress = rowData.Glip_Team_ID + '@reply.ringcentral.glip.com';
      }
      
      // 确定 targetType
      let targetType = 'private'; // 默认
      if (rowData.Push_Method === 'AI') {
        targetType = 'api';
      } else if (rowData.Glip_Team_ID && rowData.Glip_Team_ID.trim()) {
        targetType = 'group';
      } else if (rowData.Glip_User_Name && rowData.Glip_User_Name.trim()) {
        // 检查是否包含 '@reply.ringcentral.glip.com' 后缀
        if (rowData.Glip_User_Name.includes('@')) {
          targetType = 'email';
        } else {
          targetType = 'private';
        }
      }
      
      // 返回完整的消息对象
      return {
        ID: rowData.ID,
        Topic: topic,
        Content: content,
        Glip_User_Name: rowData.Glip_User_Name || '',
        Glip_Team_ID: rowData.Glip_Team_ID || '',
        glipEmailAddress: glipEmailAddress,
        Push_Method: rowData.Push_Method,
        AI_Endpoint: rowData.AI_Endpoint || '',
        AI_Headers: rowData.AI_Headers || '',
        AI_Body: aiBody,
        targetType: targetType,
        rowIndex: i + 1,
        Schedule_Date: rowData.Schedule_Date,
        Schedule_Time: rowData.Schedule_Time,
        Created_At: rowData.Created_At || '',
        messageType: messageType,
        matchMode: matchMode
      };
    }
  }
  
  // 未找到符合条件的消息
  return null;
}

/**
 * 判断消息的时间是否在过去 30 分钟窗口内（只判断时间条件，日期匹配需在调用前完成）
 * 
 * 补偿机制：处理因系统问题错过的消息
 * - 只处理有指定 Schedule_Time 的消息
 * - 时间窗口：过去 2-30 分钟（不包括当前分钟，已在 CURRENT_MINUTE 处理）
 * 
 * @param {object} rowData - 消息行数据
 * @param {Date} now - 当前时间
 * @param {string} messageType - 消息类型 (Timeline/Periodic/OneTime)
 * @returns {boolean} 时间是否匹配
 */
function matchesPast30MinutesTime(rowData, now, messageType) {
  // 注意：日期匹配需在调用前完成，此方法只判断时间条件
  
  // 只处理有指定时间的消息（补偿机制）
  if (!rowData.Schedule_Time || !rowData.Schedule_Time.toString().trim()) {
    return false;
  }
  
  const scheduleMinutes = parseTimeToMinutes(rowData.Schedule_Time.toString());
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const diff = nowMinutes - scheduleMinutes;
  
  // 在过去 30 分钟窗口内（但不包括当前分钟，因为已经在 CURRENT_MINUTE 模式处理过了）
  return diff > 1 && diff <= 30;
}

/**
 * 判断消息是否未指定时间且当前时间满足执行条件（只判断时间条件，日期匹配需在调用前完成）
 * 
 * 兜底逻辑：处理没有指定 Schedule_Time 但错过了 9:00 执行窗口的消息
 * - 只处理未指定 Schedule_Time 的消息
 * - 时间窗口：8:00 之后（包括 9:00）
 * 
 * @param {object} rowData - 消息行数据
 * @param {Date} now - 当前时间
 * @param {string} messageType - 消息类型 (Timeline/Periodic/OneTime)
 * @returns {boolean} 时间是否匹配
 */
function matchesNoSpecifiedTime(rowData, now, messageType) {
  // 注意：日期匹配需在调用前完成，此方法只判断时间条件
  
  // 必须没有指定时间
  if (rowData.Schedule_Time && rowData.Schedule_Time.toString().trim()) {
    return false;
  }
  
  // 未指定时间的消息在 8 点后执行（作为兜底逻辑）
  return now.getHours() >= 8;
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
 * 替换 AI Body 中的变量（{Topic}、{Content} 和 {TeamID}），并进行 JSON 转义
 * @param {string} bodyStr - Body 模板字符串
 * @param {string} topic - Topic 值
 * @param {string} content - Content 值
 * @param {string} teamId - Team ID 值（来自 Glip_Team_ID）
 * @returns {string} 替换后的字符串
 */
function replaceAIBodyVariables(bodyStr, topic, content, teamId) {
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
  
  // 替换 {Topic}、{Content} 和 {TeamID}，并进行 JSON 转义
  result = result.replace(/\{Topic\}/g, escapeJsonString(topic || ''));
  result = result.replace(/\{Content\}/g, escapeJsonString(content || ''));
  result = result.replace(/\{TeamID\}/g, escapeJsonString(teamId || ''));
  
  return result;
}

/**
 * 获取当前时间点需要执行的消息（三匹配模式 + Timeline 支持 + ID 生成 + AI 消息处理）
 * 接收 Jira 传递的 releaseInfo 数据，用于判断 Timeline 消息
 * @param {object} postData - POST 数据 {releaseInfo: {...}, currentTime: "yyyy-MM-dd HH:mm"}
 * @returns {object} 消息数据对象或 null
 */
function getMessageCurrentTimeWithReleaseInfo(postData) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Messages');
    if (!sheet) {
      Logger.log('错误：未找到 Messages 工作表');
      return {
        executed: false,
        error: 'Messages sheet not found',
        timestamp: new Date().toISOString()
      };
    }
    
    // 提取参数
    const releaseInfo = postData.releaseInfo || {};
    const currentTimeStr = postData.currentTime; // "yyyy-MM-dd HH:mm"
    
    // 解析当前时间（如果没有传入，使用当前时间）
    let now;
    if (currentTimeStr) {
      const [datePart, timePart] = currentTimeStr.split(' ');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute] = timePart.split(':').map(Number);
      now = new Date(year, month - 1, day, hour, minute);
      Logger.log(`使用传入的时间: ${currentTimeStr}`);
    } else {
      now = new Date();
      Logger.log(`使用当前时间: ${Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')}`);
    }
    
    Logger.log(`接收到的 releaseInfo 项目: ${Object.keys(releaseInfo).join(', ')}`);
    
    // 获取表格数据
    const data = sheet.getDataRange().getDisplayValues();
    if (data.length <= 1) {
      return {
        executed: false,
        message: 'No message data in sheet',
        timestamp: new Date().toISOString()
      };
    }
    
    const headers = data[0];
    const currentDate = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const currentHour = now.getHours();
    
    Logger.log(`[三匹配模式查找] 开始查找消息，当前时间: ${currentDate} ${currentHour}:${now.getMinutes()}`);
    
    // 匹配模式 1: 查找当前分钟需要执行的消息
    Logger.log('[匹配模式 1] 查找当前分钟的消息...');
    let message = findMatchingMessage(data, headers, now, releaseInfo, 'CURRENT_MINUTE', currentDate, currentHour);
    
    // 匹配模式 2: 查找过去 30 分钟内应该执行但未执行的消息
    if (!message) {
      Logger.log('[匹配模式 2] 查找过去 30 分钟的消息...');
      message = findMatchingMessage(data, headers, now, releaseInfo, 'PAST_30_MINUTES', currentDate, currentHour);
      if (message) {
        Logger.log(`[匹配模式 2] ✅ 找到消息: ${message.ID} - ${message.Topic} (补偿执行)`);
      }
    }
    
    // 匹配模式 3: 查找未指定时间的消息（仅限 8 点后）
    if (!message && currentHour >= 8) {
      Logger.log('[匹配模式 3] 查找未指定时间的消息（8点后）...');
      message = findMatchingMessage(data, headers, now, releaseInfo, 'NO_TIME_SPECIFIED', currentDate, currentHour);
      if (message) {
        Logger.log(`[匹配模式 3] ✅ 找到消息: ${message.ID} - ${message.Topic}`);
      }
    }
    
    if (!message) {
      Logger.log('[三匹配模式查找] ❌ 未找到符合条件的消息');
      return {
        executed: false,
        message: 'No message found for current time',
        timestamp: new Date().toISOString()
      };
    }
    
    // === 确保消息有 ID，如果没有则生成一个 ===
    let messageId = message.ID;
    if (!messageId || messageId.toString().trim() === '') {
      messageId = `MSG_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`;
      Logger.log(`消息没有 ID，生成新 ID: ${messageId}`);
      
      // 更新 Sheet 中的 ID
      try {
        const idColIndex = headers.indexOf('ID') + 1;
        if (idColIndex > 0) {
          sheet.getRange(message.rowIndex, idColIndex).setValue(messageId);
          Logger.log(`已将生成的 ID 写入 Sheet: 行 ${message.rowIndex}`);
        }
      } catch (updateError) {
        Logger.log(`更新 Sheet ID 失败: ${updateError}`);
      }
      
      // 更新消息对象中的 ID
      message.ID = messageId;
    }
    
    Logger.log(`返回待发送消息数据: ${messageId} - ${message.Topic}`);
    
    // === 检查是否是 AI 消息 ===
    if (message.Push_Method === 'AI') {
      Logger.log(`处理 AI 消息: ${messageId}`);
      
      // 解析 AI 相关字段
      const endpointInfo = parseAIEndpoint(message.AI_Endpoint || '');
      const headersObj = parseAIHeaders(message.AI_Headers || '');
      const bodyStr = replaceAIBodyVariables(
        message.AI_Body || '',
        message.Topic || '',
        message.Content || '',
        message.Glip_Team_ID || ''
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
    
    // === 返回 Bot 消息数据（供 Jira 调用 Bot API）===
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
      // Email 消息字段
      glipEmailAddress: message.glipEmailAddress || '',
      rowIndex: message.rowIndex,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    Logger.log(`getMessageCurrentTimeWithReleaseInfo 错误: ${error.toString()}`);
    return {
      executed: false,
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}


/**
 * 获取 Timeline 消息的目标日期（辅助函数）
 * @param {object} rowData - 消息行数据
 * @param {object} releaseInfo - 项目进度信息
 * @returns {Date|null} 目标日期或 null
 */
function getTimelineTargetDate(rowData, releaseInfo) {
  const project = rowData.Timeline_Project;
  const milestone = rowData.Timeline_Milestone;
  const offset = parseInt(rowData.Timeline_Offset || '0');
  
  if (!project || !milestone) {
    return null;
  }
  
  // 获取项目的 releaseInfo
  const projectInfo = releaseInfo[project];
  if (!projectInfo || !projectInfo.releaseInfo) {
    Logger.log(`未找到项目 ${project} 的 releaseInfo`);
    return null;
  }
  
  // 获取 milestone 日期
  const milestoneDate = projectInfo.releaseInfo[milestone];
  if (!milestoneDate) {
    Logger.log(`未找到 Milestone: ${milestone}`);
    return null;
  }
  
  // 解析日期（格式：MM/DD/YYYY）
  const dateParts = milestoneDate.split('/');
  if (dateParts.length !== 3) {
    Logger.log(`Milestone 日期格式错误: ${milestoneDate}`);
    return null;
  }
  
  const baseDate = new Date(
    parseInt(dateParts[2]), // year
    parseInt(dateParts[0]) - 1, // month (0-based)
    parseInt(dateParts[1]) // day
  );
  
  // 应用工作日偏移
  const targetDate = addWorkingDays(baseDate, offset);
  
  return targetDate;
}

/**
 * 计算工作日偏移后的日期（跳过周六、周日）
 * @param {Date} startDate - 起始日期
 * @param {number} workingDays - 工作日偏移量（正数向后，负数向前）
 * @returns {Date} 偏移后的日期
 */
function addWorkingDays(startDate, workingDays) {
  if (workingDays === 0) {
    return new Date(startDate);
  }
  
  const result = new Date(startDate);
  const direction = workingDays > 0 ? 1 : -1; // 方向：1=向后，-1=向前
  let remainingDays = Math.abs(workingDays);
  
  while (remainingDays > 0) {
    // 移动一天
    result.setDate(result.getDate() + direction);
    
    // 检查是否是工作日（周一到周五）
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0=周日, 6=周六
      remainingDays--;
    }
  }
  
  return result;
}

/**
 * 替换项目进度变量
 * @param {string} text - 原始文本
 * @param {object} projectInfo - 项目进度信息
 * @returns {string} 替换后的文本
 */
function replaceProjectVariablesInText(text, projectInfo) {
  if (!text || !projectInfo) return text;
  
  let result = text;
  result = result.replaceAll('{currentRelease}', projectInfo.currentRelease || '');
  result = result.replaceAll('{currentPhase}', projectInfo.currentPhase || '');
  result = result.replaceAll('{currentPhaseStartDate}', projectInfo.currentPhaseStartDate || '');
  result = result.replaceAll('{currentPhaseStartedWorkdays}', projectInfo.currentPhaseStartedWorkdays || '0');
  result = result.replaceAll('{nextPhase}', projectInfo.nextPhase || '');
  result = result.replaceAll('{nextPhaseStartDate}', projectInfo.nextPhaseStartDate || '');
  result = result.replaceAll('{nextPhaseCountdownWorkdays}', projectInfo.nextPhaseCountdownWorkdays || '0');
  
  return result;
}

/**
 * 解析 Jira Automation 返回的 JSON/Groovy Map 格式
 * 
 * Jira 的 {{webhookResponse.body.asJsonString}} 返回的是 Groovy Map 格式：
 * {currentRelease=25.4.20, currentPhase=Dev}
 * 
 * 而不是标准 JSON 格式：
 * {"currentRelease":"25.4.20","currentPhase":"Dev"}
 * 
 * 此函数尝试多种解析方式，兼容两种格式
 * 
 * @param {string} jsonStr - JSON 字符串或 Groovy Map 字符串
 * @returns {object} 解析后的对象
 */
function parseJiraJson(jsonStr) {
  if (!jsonStr || jsonStr.trim() === '') {
    return {};
  }
  
  const str = jsonStr.trim();
  
  // 尝试 1: 标准 JSON 解析
  try {
    return JSON.parse(str);
  } catch (e) {
    Logger.log(`标准 JSON 解析失败，尝试 Groovy Map 格式: ${e.toString()}`);
  }
  
  // 尝试 2: 处理 Groovy Map 格式 {key=value, key2=value2}
  try {
    // 移除外层的大括号
    let content = str;
    if (content.startsWith('{') && content.endsWith('}')) {
      content = content.substring(1, content.length - 1);
    }
    
    // 如果是空对象
    if (content.trim() === '') {
      return {};
    }
    
    const result = {};
    
    // 分割键值对（处理嵌套对象的情况）
    const pairs = splitGroovyMapPairs(content);
    
    for (const pair of pairs) {
      const trimmedPair = pair.trim();
      if (!trimmedPair) continue;
      
      // 查找第一个 = 号的位置
      const equalIndex = trimmedPair.indexOf('=');
      if (equalIndex === -1) continue;
      
      const key = trimmedPair.substring(0, equalIndex).trim();
      let value = trimmedPair.substring(equalIndex + 1).trim();
      
      // 处理嵌套对象 {key=value}
      if (value.startsWith('{') && value.endsWith('}')) {
        result[key] = parseJiraJson(value); // 递归解析
      } 
      // 处理数组 [item1, item2]
      else if (value.startsWith('[') && value.endsWith(']')) {
        const arrayContent = value.substring(1, value.length - 1);
        result[key] = arrayContent.split(',').map(item => item.trim());
      }
      // 处理 null
      else if (value === 'null') {
        result[key] = null;
      }
      // 处理布尔值
      else if (value === 'true') {
        result[key] = true;
      } else if (value === 'false') {
        result[key] = false;
      }
      // 处理数字
      else if (/^-?\d+\.?\d*$/.test(value)) {
        result[key] = parseFloat(value);
      }
      // 其他情况作为字符串
      else {
        result[key] = value;
      }
    }
    
    Logger.log(`Groovy Map 解析成功: ${JSON.stringify(result)}`);
    return result;
    
  } catch (e) {
    Logger.log(`Groovy Map 解析失败: ${e.toString()}`);
    Logger.log(`原始字符串: ${str}`);
    return {};
  }
}

/**
 * 分割 Groovy Map 的键值对（处理嵌套情况）
 * 例如：key1=value1, key2={nested=value}, key3=value3
 * @param {string} content - Map 内容（不含外层大括号）
 * @returns {array} 键值对数组
 */
function splitGroovyMapPairs(content) {
  const pairs = [];
  let currentPair = '';
  let braceDepth = 0;
  let bracketDepth = 0;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (char === '{') {
      braceDepth++;
      currentPair += char;
    } else if (char === '}') {
      braceDepth--;
      currentPair += char;
    } else if (char === '[') {
      bracketDepth++;
      currentPair += char;
    } else if (char === ']') {
      bracketDepth--;
      currentPair += char;
    } else if (char === ',' && braceDepth === 0 && bracketDepth === 0) {
      // 只有在不在嵌套结构内时，逗号才是分隔符
      pairs.push(currentPair);
      currentPair = '';
    } else {
      currentPair += char;
    }
  }
  
  // 添加最后一个键值对
  if (currentPair.trim()) {
    pairs.push(currentPair);
  }
  
  return pairs;
}

