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

// App Script 版本号（用于检测更新）
var APP_SCRIPT_VERSION = '2.8.5';
var APP_SCRIPT_LAST_UPDATED = '2026-05-28';
var TIMELINE_CACHE_KEY_PREFIX = 'TIMELINE_CACHE_';
var TIMELINE_SYNC_ATTEMPT_KEY_PREFIX = 'TIMELINE_SYNC_ATTEMPT_';
var LEGACY_RELEASE_INFO_CACHE_KEY = 'RELEASE_INFO_CACHE';
// Timeline Sync Rule 默认每天运行一次，这里给缓存留出冗余窗口，避免偶发延迟导致全天失效
var TIMELINE_CACHE_MAX_AGE_MS = 36 * 60 * 60 * 1000;
var EXECUTION_MARK_KEY_PREFIX = 'BOT_EXECUTION_MARK_';
var EXECUTION_MARK_MAX_AGE_MS = 48 * 60 * 60 * 1000;
var JIRA_RELEASE_INFO_MAX_CHARS = 12000;
var JIRA_GROOVY_MAX_NESTING_DEPTH = 12;
var TIMELINE_SYNC_ATTEMPT_ERROR_MAX_CHARS = 260;
// Google Apps Script PropertiesService limits each stored value to 9 KB.
// Preflight the serialized Timeline cache so Jira gets an actionable error
// instead of a generic setProperty exception.
var TIMELINE_CACHE_PROPERTY_MAX_BYTES = 9 * 1024;
var PUSH_LOG_SCHEMA_COLUMNS = [
  'Timestamp',
  'Message_ID',
  'Topic',
  'Content',
  'Push_Method',
  'Target',
  'Status',
  'Error',
  'Exec_Count',
  'Execution_Key',
  'Sent_Chat_ID',
  'Sent_Post_ID',
  'Sent_At'
];

var TIMELINE_PROJECT_PARAM_MAP = [
  { project: 'mThor', paramKey: 'mThor' },
  { project: 'Jupiter desktop', paramKey: 'jupiterDesktop' },
  { project: 'Jupiter web', paramKey: 'jupiterWeb' },
  { project: 'Nova', paramKey: 'nova' },
  { project: 'RIO', paramKey: 'rio' },
  { project: 'NC', paramKey: 'nc' },
  { project: 'Rooms', paramKey: 'rooms' }
];


/**
 * 每分钟触发器（统一处理所有类型的消息）
 * 
 * 执行逻辑：
 * 1. 判断日期是否匹配（OneTime/Periodic 检查日期，Timeline 检查里程碑）
 * 2. 判断时间是否匹配（有 Schedule_Time 则匹配分钟；未设时间的 Bot/AI 和带 AI_Endpoint 的 JiraAutomation 由执行器 8:00 后排队，AsMe 9:00 执行）
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
 * - 无 Schedule_Time: AsMe 默认在早上 9:00 执行；Bot/AI/带 AI_Endpoint 的 JiraAutomation 由执行器 8:00 后排队
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
 * - Timeline: 基于项目进度的消息（AsMe 方式从 Script Properties 缓存读取 release info）
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
  let timelineReleaseInfo = null;
  let timelineReleaseInfoLoaded = false;
  const ringCentralSenderConfig = getRingCentralSenderConfigFromSheet();
  const shouldHandoffAsMeToJira = isRingCentralSenderReady(ringCentralSenderConfig);
  
  Logger.log(`开始执行定时任务，当前时间: ${Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')}`);
  if (shouldHandoffAsMeToJira) {
    Logger.log('RingCentral AsMe sender 已启用，AsMe 消息由 Jira Automation 处理，AppScript 邮件 fallback 暂停');
  }
  reactivateDoneFutureOneTimeMessages(sheet, data, headers, now);
  
  // 遍历每一行（跳过表头）
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowData = parseRow(row, headers);
    
    // 自动判断消息类型
    const messageType = determineMessageType(rowData);

    // 基本过滤条件
    if (rowData.Status !== 'Active') continue;
    if (rowData.Push_Method !== 'AsMe') continue; // Bot 和 AI 由 Jira 处理
    if (shouldHandoffAsMeToJira) continue;
    
    try {
      // 步骤 1: 先判断日期是否匹配
      let dateMatches = false;
      let messageToSend = rowData;
      
      if (messageType === 'Timeline') {
        if (!timelineReleaseInfoLoaded) {
          timelineReleaseInfo = readReleaseInfoFromCache();
          timelineReleaseInfoLoaded = true;
          if (timelineReleaseInfo && Object.keys(timelineReleaseInfo).length > 0) {
            Logger.log(`[AsMe Timeline] 从缓存读取 releaseInfo，项目: ${Object.keys(timelineReleaseInfo).join(', ')}`);
          } else {
            Logger.log('[AsMe Timeline] 未找到可用的 timeline 缓存，跳过 Timeline 消息');
          }
        }

        const hasReleaseInfo = timelineReleaseInfo && Object.keys(timelineReleaseInfo).length > 0;
        if (!hasReleaseInfo) {
          continue;
        }

        const targetDate = getTimelineTargetDate(rowData, timelineReleaseInfo);
        dateMatches = targetDate && isSameDate(now, targetDate);

        const projectInfo = getTimelineProjectInfo(timelineReleaseInfo, rowData.Timeline_Project);
        if (dateMatches && projectInfo) {
          messageToSend = Object.assign({}, rowData, {
            Topic: replaceProjectVariablesInText(rowData.Topic || '', projectInfo),
            Content: replaceProjectVariablesInText(rowData.Content || '', projectInfo)
          });
        }
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
      
      // 步骤 2: 日期匹配后，判断时间是否匹配
      if (matchesCurrentMinuteTime(rowData, now, messageType)) {
        Logger.log(`准备执行消息: ${rowData.ID} - ${rowData.Topic} (类型: ${messageType})`);
        
        // 发送 Email
        const emailResult = sendEmailToGlip(messageToSend);
        
        // 更新执行记录（传递实际发送的内容，便于日志记录替换后的变量）
        const sentContent = emailResult.success ? {
          topic: emailResult.sentTopic,
          content: emailResult.sentContent
        } : null;
        updateExecutionLog(sheet, i + 1, rowData, emailResult.success, headers, emailResult.error, sentContent);
        
        Logger.log(`消息执行${emailResult.success ? '成功' : '失败'}: ${rowData.ID}`);
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

function readConfigSheetMap() {
  const config = {};

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
    if (!sheet) {
      return config;
    }

    const rows = sheet.getDataRange().getDisplayValues();
    for (let i = 0; i < rows.length; i++) {
      const key = rows[i][0] ? rows[i][0].toString().trim() : '';
      if (!key || key === 'Key') {
        continue;
      }

      config[key] = rows[i][1] === undefined || rows[i][1] === null ? '' : rows[i][1].toString();
    }
  } catch (error) {
    Logger.log(`读取 Config 工作表失败: ${error.toString()}`);
  }

  return config;
}

function parseConfigBoolean(value) {
  return ['true', '1', 'yes', 'y', 'on'].indexOf((value || '').toString().trim().toLowerCase()) >= 0;
}

function getRingCentralSenderConfigFromSheet() {
  const config = readConfigSheetMap();
  return {
    enabled: parseConfigBoolean(config.ringcentral_sender_enabled),
    clientId: (config.ringcentral_sender_client_id || '').toString().trim(),
    clientSecret: (config.ringcentral_sender_client_secret || '').toString().trim(),
    jwt: (config.ringcentral_sender_jwt || '').toString().trim(),
    executorRuleId: (
      config.bot_automation_executor_rule_id ||
      config.bot_executor_rule_id ||
      config.jira_executor_rule_id ||
      ''
    ).toString().trim()
  };
}

function isRingCentralSenderReady(config) {
  return Boolean(
    config &&
    config.enabled &&
    config.clientId &&
    config.clientSecret &&
    config.jwt &&
    config.executorRuleId
  );
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

function isExecutorDefaultSchedule(rowData) {
  const hasAiEndpoint = String(rowData.AI_Endpoint || '').trim() !== '';
  return rowData.Push_Method === 'Bot' ||
    rowData.Push_Method === 'AI' ||
    (rowData.Push_Method === 'JiraAutomation' && hasAiEndpoint);
}

function getDefaultScheduleTimeForRow(rowData) {
  return isExecutorDefaultSchedule(rowData) ? '08:00' : '09:00';
}

function getOneTimeScheduledAt(rowData) {
  if (determineMessageType(rowData) !== 'OneTime' || !rowData.Schedule_Date) {
    return null;
  }

  const scheduledAt = parseScheduleDate(rowData.Schedule_Date);
  if (!scheduledAt) {
    return null;
  }

  const rawTime = rowData.Schedule_Time && rowData.Schedule_Time.toString().trim()
    ? rowData.Schedule_Time.toString().trim()
    : getDefaultScheduleTimeForRow(rowData);
  const scheduleMinutes = parseTimeToMinutes(rawTime);
  if (scheduleMinutes === null) {
    return null;
  }

  scheduledAt.setHours(Math.floor(scheduleMinutes / 60), scheduleMinutes % 60, 0, 0);
  return scheduledAt;
}

function formatOneTimeNextExecution(rowData) {
  const scheduledAt = getOneTimeScheduledAt(rowData);
  return scheduledAt
    ? Utilities.formatDate(scheduledAt, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
    : '';
}

function reactivateDoneFutureOneTimeMessages(sheet, data, headers, now) {
  const statusCol = getColumnIndex(headers, 'Status');
  if (statusCol <= 0) {
    return 0;
  }

  const lastExecCol = getColumnIndex(headers, 'Last_Exec');
  const execLogCol = getColumnIndex(headers, 'Exec_Log');
  const nextExecCol = getColumnIndex(headers, 'Next_Exec');
  let reactivatedCount = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowData = parseRow(row, headers);
    const status = (rowData.Status || '').toString().trim().toLowerCase();
    if (status !== 'done') {
      continue;
    }

    const scheduledAt = getOneTimeScheduledAt(rowData);
    if (!scheduledAt || scheduledAt.getTime() <= now.getTime()) {
      continue;
    }

    const rowIndex = i + 1;
    sheet.getRange(rowIndex, statusCol).setValue('Active');
    row[statusCol - 1] = 'Active';

    if (lastExecCol > 0) {
      sheet.getRange(rowIndex, lastExecCol).setValue('');
      row[lastExecCol - 1] = '';
    }

    if (execLogCol > 0) {
      sheet.getRange(rowIndex, execLogCol).setValue('待执行');
      row[execLogCol - 1] = '待执行';
    }

    if (nextExecCol > 0) {
      const nextExec = formatOneTimeNextExecution(rowData);
      sheet.getRange(rowIndex, nextExecCol).setValue(nextExec);
      row[nextExecCol - 1] = nextExec;
    }

    reactivatedCount++;
    Logger.log(`已将未来单次消息从 Done 恢复为 Active: ${rowData.ID || rowData.Topic || rowIndex}`);
  }

  return reactivatedCount;
}

/**
 * 判断未填写 Schedule_Time 的消息是否应由执行器 8:00 后兜底队列处理。
 *
 * AsMe 即使由 RingCentral sender 接管，也仍应保持 9:00 默认发送语义；
 * 否则会被 NO_TIME_SPECIFIED 模式提前到 8:00 后执行。
 */
function isNoTimeExecutorQueueMessage(rowData) {
  const hasAiEndpoint = String(rowData.AI_Endpoint || '').trim() !== '';
  return rowData.Push_Method === 'Bot' ||
    rowData.Push_Method === 'AI' ||
    (rowData.Push_Method === 'JiraAutomation' && hasAiEndpoint);
}

/**
 * 判断消息的时间是否匹配当前分钟（只判断时间条件，日期匹配需在调用前完成）
 * 
 * 时间匹配规则：
 * - 有 Schedule_Time: 匹配当前分钟或最多迟到 1 分钟；不提前发送
 * - 无 Schedule_Time: AsMe 在早上 9:00 命中当前分钟；执行器消息只走 8:00 后兜底排队
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
    // 有指定时间，检查时间是否匹配当前分钟或最多迟到 1 分钟；不提前发送
    const scheduleMinutes = parseTimeToMinutes(rowData.Schedule_Time.toString());
    if (scheduleMinutes === null) {
      Logger.log(`跳过无效执行时间: ${rowData.ID || rowData.Topic || ''} - ${rowData.Schedule_Time}`);
      return false;
    }
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const diff = nowMinutes - scheduleMinutes;
    const previousDayWrappedDiff = nowMinutes + 1440 - scheduleMinutes;
    return (diff >= 0 && diff <= 1) || (scheduleMinutes > nowMinutes && previousDayWrappedDiff <= 1);
  } else {
    // 没有指定时间，AsMe 通过当前分钟在 9:00 执行；执行器消息只走 8:00 后兜底排队
    if (isNoTimeExecutorQueueMessage(rowData)) {
      return false;
    }
    return now.getHours() === 9 && now.getMinutes() === 0;
  }
}

/**
 * 为跨午夜补偿计算日期判断时应使用的参考日期。
 *
 * 例如：消息设在 2026-05-02 23:50，执行器在 2026-05-03 00:05 恢复轮询时，
 * 时间仍在 30 分钟补偿窗口内，日期判断应落在 2026-05-02。
 */
function getDateReferenceForMatchMode(rowData, now, matchMode) {
  if (
    matchMode !== 'CURRENT_MINUTE' &&
    matchMode !== 'PAST_30_MINUTES'
  ) {
    return now;
  }

  if (!rowData.Schedule_Time || !rowData.Schedule_Time.toString().trim()) {
    return now;
  }

  const scheduleMinutes = parseTimeToMinutes(rowData.Schedule_Time.toString());
  if (scheduleMinutes === null) {
    return now;
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (scheduleMinutes <= nowMinutes) {
    return now;
  }

  const wrappedDiff = nowMinutes + 1440 - scheduleMinutes;
  const isPreviousDayCurrentMinute = matchMode === 'CURRENT_MINUTE' && wrappedDiff <= 1;
  const isPreviousDayCompensation = matchMode === 'PAST_30_MINUTES' && wrappedDiff > 1 && wrappedDiff <= 30;

  if (!isPreviousDayCurrentMinute && !isPreviousDayCompensation) {
    return now;
  }

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  );
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
 * 解析 Sheet 里的 yyyy-MM-dd 日期，避免 V8 把日期字符串按 UTC 解释后跨日。
 */
function parseScheduleDate(dateValue) {
  if (!dateValue) return null;

  if (Object.prototype.toString.call(dateValue) === '[object Date]') {
    return new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
  }

  const text = dateValue.toString().trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) {
    return new Date(
      parseInt(match[1], 10),
      parseInt(match[2], 10) - 1,
      parseInt(match[3], 10)
    );
  }

  const parsed = new Date(text);
  if (isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function toScheduleDateOnly(dateValue) {
  if (!dateValue || isNaN(dateValue.getTime())) return null;
  return new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
}

function isAfterScheduleEndDate(currentTime, endDateValue) {
  const endDate = parseScheduleDate(endDateValue);
  const currentDateOnly = toScheduleDateOnly(currentTime);
  const endDateOnly = toScheduleDateOnly(endDate);

  if (!currentDateOnly || !endDateOnly) return false;
  return currentDateOnly.getTime() > endDateOnly.getTime();
}

function isOnOrAfterScheduleEndDate(currentTime, endDateValue) {
  const endDate = parseScheduleDate(endDateValue);
  const currentDateOnly = toScheduleDateOnly(currentTime);
  const endDateOnly = toScheduleDateOnly(endDate);

  if (!currentDateOnly || !endDateOnly) return false;
  return currentDateOnly.getTime() >= endDateOnly.getTime();
}

/**
 * 检查周期性消息是否应该执行
 */
function checkPeriodicSchedule(rowData, now) {
  if (!rowData.Schedule_Date) return false;
  
  const startDate = parseScheduleDate(rowData.Schedule_Date);
  const endDate = rowData.End_Date ? parseScheduleDate(rowData.End_Date) : null;
  const every = parseInt(rowData.Repeat_Every) || 1;
  const repeatUnit = rowData.Repeat_Unit || 'Day';

  if (!startDate) return false;
  
  // End_Date 是包含当天的日期上限；结束日当天仍应允许最后一次发送。
  if (endDate && isAfterScheduleEndDate(now, rowData.End_Date)) return false;
  
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
    // 检查 Repeat_Days 字段（多星期模式）
    const repeatDays = rowData.Repeat_Days;
    if (repeatDays && repeatDays.toString().trim()) {
      // 多星期模式：检查今天是否在 repeatDays 中
      // Repeat_Days 格式：逗号分隔的 JS 格式数字（0=周日, 1=周一...6=周六）
      const todayDayOfWeek = now.getDay(); // 0=周日, 1=周一...6=周六
      const allowedDays = repeatDays.toString().split(',').map(function(d) {
        return parseInt(d.trim(), 10);
      });
      const weekIndex = Math.floor(daysToStart / 7);
      shouldSend = weekIndex >= 0 &&
        weekIndex % every === 0 &&
        allowedDays.indexOf(todayDayOfWeek) !== -1;
    } else {
      // 原有逻辑：每 N 周的同一天
      if (daysToStart >= 0 && daysToStart % (7 * every) === 0) {
        shouldSend = true;
      }
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
 * rowData 可以是原始行数据，也可以是已替换 Timeline 变量后的副本
 * @returns {object} { success: boolean, sentTopic?: string, sentContent?: string, error?: string }
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
      return { success: false, error: '未指定收件人' };
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
    
    // Timeline 变量如有需要，应在调用方基于缓存先完成替换
    let topic = rowData.Topic.toString();
    let content = rowData.Content.toString();
    
    // 检查是否包含项目变量（用于日志记录）
    const hasProjectVars = content.includes('{current') || content.includes('{next') || topic.includes('{current') || topic.includes('{next');
    if (hasProjectVars) {
      Logger.log(`警告：AsMe 消息包含项目变量但无法替换: ${rowData.ID}`);
    }
    
    const htmlContent = content.replaceAll("\n", '<br />');
    
    MailApp.sendEmail({
      to: toEmail,
      subject: `定时推送 - ${topic}`,
      htmlBody: htmlContent,
      attachments: attachments
    });
    
    Logger.log(`邮件发送成功至: ${toEmail}`);
    return { 
      success: true, 
      sentTopic: topic,
      sentContent: content 
    };
    
  } catch (error) {
    Logger.log('发送邮件失败: ' + error);
    return { 
      success: false, 
      error: error.toString()
    };
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
 * @param {string} executionKey - 单次执行幂等键（可选）
 * @param {object} sendResultMeta - 实际发送结果元数据（可选）
 */
function insertPushLog(messageId, topic, content, pushMethod, target, success, errorMsg, execCount, executionKey, sendResultMeta) {
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
    const sentChatId = sendResultMeta ? getRequestParameterValue(sendResultMeta.sentChatId) : '';
    const sentPostId = sendResultMeta ? getRequestParameterValue(sendResultMeta.sentPostId) : '';
    const sentAt = sendResultMeta && getRequestParameterValue(sendResultMeta.sentAt)
      ? getRequestParameterValue(sendResultMeta.sentAt)
      : (success && (sentChatId || sentPostId) ? now.toISOString() : '');
    const headers = ensurePushLogHeaders(logsSheet);
    const entry = {
      Timestamp: timestamp,
      Message_ID: messageId,
      Topic: topic,
      Content: content,
      Push_Method: pushMethod,
      Target: target,
      Status: status,
      Error: error,
      Exec_Count: execCount,
      Execution_Key: getRequestParameterValue(executionKey),
      Sent_Chat_ID: sentChatId,
      Sent_Post_ID: sentPostId,
      Sent_At: sentAt
    };
    const logRow = headers.map(function(header) {
      return entry[header] === undefined || entry[header] === null ? '' : entry[header];
    });
    
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

function ensurePushLogHeaders(logsSheet) {
  let headers = [];
  try {
    const data = logsSheet.getDataRange().getDisplayValues();
    headers = data && data.length > 0 ? data[0] : [];
  } catch (error) {
    Logger.log(`读取 Logs 表头失败，使用默认表头: ${error}`);
  }

  headers = (headers || []).map(function(header) {
    return header ? header.toString().trim() : '';
  }).filter(function(header) {
    return header !== '';
  });

  const missing = PUSH_LOG_SCHEMA_COLUMNS.filter(function(column) {
    return headers.indexOf(column) < 0;
  });

  if (missing.length > 0) {
    const startCol = headers.length + 1;
    logsSheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
  }

  return headers.length > 0 ? headers : PUSH_LOG_SCHEMA_COLUMNS.slice();
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
 * 
 * @param {object} replacedContent - 可选，替换变量后的内容 { topic, content }
 */
function updateExecutionLog(sheet, rowIndex, rowData, success, headers, errorMsg, replacedContent, executionKey) {
  const now = new Date();
  const execCount = (parseInt(rowData.Exec_Count) || 0) + 1;
  const willMarkAsDone = success && shouldMarkAsDone(rowData, now);
  const nextExec = willMarkAsDone ? '' : calculateNextExecution(rowData, now);
  
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
  
  if (nextExecCol > 0) {
    sheet.getRange(rowIndex, nextExecCol).setValue(nextExec || '');
  }
  
  if (execLogCol > 0) {
    let logMessage = success ?
      '✅ 推送成功' :
      ('❌ 推送失败' + (errorMsg ? ': ' + errorMsg : ''));
    sheet.getRange(rowIndex, execLogCol).setValue(logMessage);
  }

  // 检查是否应该标记为 Done（统一使用 shouldMarkAsDone 逻辑）
  if (willMarkAsDone) {
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
  
  // 使用替换后的内容（如果提供），否则使用原始内容
  const logTopic = (replacedContent && replacedContent.topic) ? replacedContent.topic : (rowData.Topic || '');
  const logContent = (replacedContent && replacedContent.content) ? replacedContent.content : (rowData.Content || '');
  
  insertPushLog(
    rowData.ID,
    logTopic,
    logContent,
    rowData.Push_Method || 'AsMe',
    target,
    success,
    errorMsg || '',
    execCount,
    executionKey || '',
    replacedContent || null
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
    if (rowData.End_Date && isOnOrAfterScheduleEndDate(currentTime, rowData.End_Date)) {
      return '';
    }

    if (rowData.Repeat_Count) {
      const repeatCount = parseInt(rowData.Repeat_Count);
      const execCountAfterThisRun = (parseInt(rowData.Exec_Count) || 0) + 1;
      if (!isNaN(repeatCount) && repeatCount > 0 && execCountAfterThisRun >= repeatCount) {
        return '';
      }
    }

    const startDate = parseScheduleDate(rowData.Schedule_Date);
    const every = parseInt(rowData.Repeat_Every) || 1;
    const repeatUnit = rowData.Repeat_Unit || 'Day';

    if (!startDate) return '';
    
    let nextDate = new Date(currentTime);
    
    if (repeatUnit === 'Day') {
      nextDate.setDate(nextDate.getDate() + every);
    } else if (repeatUnit === 'Week') {
      // 检查 Repeat_Days 字段（多星期模式）
      const repeatDays = rowData.Repeat_Days;
      if (repeatDays && repeatDays.toString().trim()) {
        // 多星期模式：找下一个符合条件的日期
        // Repeat_Days 格式：逗号分隔的 JS 格式数字（0=周日, 1=周一...6=周六）
        var allowedDays = repeatDays.toString().split(',').map(function(d) {
          return parseInt(d.trim(), 10);
        }).sort(function(a, b) { return a - b; });
        var todayDayOfWeek = nextDate.getDay();
        
        // 找今天之后最近的一个允许的星期，并保留每 N 周的间隔约束
        for (var offset = 1; offset <= (7 * every) + 7; offset++) {
          var checkDay = (todayDayOfWeek + offset) % 7;
          var candidateDate = new Date(nextDate);
          candidateDate.setDate(nextDate.getDate() + offset);
          var candidateDateOnly = new Date(candidateDate.getFullYear(), candidateDate.getMonth(), candidateDate.getDate());
          var startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
          var daysFromStart = Math.floor((candidateDateOnly - startDateOnly) / (1000 * 60 * 60 * 24));
          var weekIndex = Math.floor(daysFromStart / 7);
          if (weekIndex >= 0 && weekIndex % every === 0 && allowedDays.indexOf(checkDay) !== -1) {
            nextDate = candidateDate;
            break;
          }
        }
      } else {
        // 原有逻辑：每 N 周的同一天
        nextDate.setDate(nextDate.getDate() + (7 * every));
      }
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
function createJsonOutput(payload) {
  return ContentService.createTextOutput(
    JSON.stringify(payload)
  ).setMimeType(ContentService.MimeType.JSON);
}

function parseJsonPostBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  const rawBody = e.postData.contents.toString();
  const trimmedBody = rawBody.trim();
  if (!trimmedBody || !shouldParsePostDataAsJson(e, trimmedBody)) {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmedBody);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    throw new Error(`POST JSON 解析失败: ${error.toString()}`);
  }
}

function shouldParsePostDataAsJson(e, trimmedBody) {
  const contentType = getPostDataType(e).toLowerCase();
  if (contentType.indexOf('application/json') !== -1 || contentType.indexOf('+json') !== -1) {
    return true;
  }

  return trimmedBody[0] === '{' || trimmedBody[0] === '[';
}

function isPostJsonParseError(error) {
  return error && error.message && error.message.indexOf('POST JSON 解析失败') !== -1;
}

function getPostDataType(e) {
  return e && e.postData && e.postData.type ? e.postData.type.toString() : '';
}

function getPostBodyLength(e) {
  return e && e.postData && e.postData.contents ? e.postData.contents.toString().length : 0;
}

function getRawPostBody(e) {
  return e && e.postData && e.postData.contents ? e.postData.contents.toString() : '';
}

function getPostBodyBytes(e) {
  return getUtf8ByteLength(getRawPostBody(e));
}

function isTruthyRequestValue(value) {
  const raw = getRequestParameterValue(value).trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function parseJsonStringFragment(fragment) {
  try {
    return JSON.parse('"' + fragment + '"');
  } catch (error) {
    return fragment.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
}

function extractJsonStringPropertyFromText(text, propertyName) {
  const source = getRequestParameterValue(text);
  if (!source || !propertyName) {
    return '';
  }

  const pattern = new RegExp('"' + propertyName + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"', 'i');
  const match = source.match(pattern);
  return match ? parseJsonStringFragment(match[1]) : '';
}

function hasTruthyJsonBooleanPropertyInText(text, propertyName) {
  const source = getRequestParameterValue(text);
  if (!source || !propertyName) {
    return false;
  }

  const pattern = new RegExp('"' + propertyName + '"\\s*:\\s*(true|"true"|1|"1")', 'i');
  return pattern.test(source);
}

function resolveCacheReleaseInfoProjectFromPostFailure(e, queryParameters) {
  const queryProject = getRequestParameterValue(queryParameters && queryParameters.project).trim();
  const bodyProject = extractJsonStringPropertyFromText(getRawPostBody(e), 'project').trim();
  const paramKey = queryProject || bodyProject;
  return paramKey ? getTimelineProjectConfigByParamKey(paramKey) : null;
}

function buildPostJsonParseErrorPayload(action, error, e) {
  const actionName = getRequestParameterValue(action);
  const payload = {
    success: false,
    status: 'ERROR',
    errorCode: 'INVALID_POST_JSON',
    action: actionName,
    error: error.toString(),
    receivedContentType: getPostDataType(e),
    bodyLength: getPostBodyLength(e),
    requestContentType: getPostDataType(e),
    requestBodyBytes: getPostBodyBytes(e),
    acceptedFormats: [
      'POST JSON body with Content-Type: application/json',
      'Jira text smart values must use .asJsonString before being inserted into JSON',
      'Generated Timeline Sync Rule should use GET query parameters for Apps Script callbacks; POST can stop on Google 302 redirects'
    ],
    nextAction: '检查 Jira Automation 的 Send web request：生成规则中的 Apps Script cacheReleaseInfo 必须使用 Method=GET，并在 URL 中包含 project 和 releaseInfo；不要改成 POST，否则 Jira 可能停在 Google 302 重定向。'
  };

  if (actionName === 'cacheReleaseInfo') {
    const troubleshooting = getReleaseInfoTroubleshootingPayload();
    const projectConfig = resolveCacheReleaseInfoProjectFromPostFailure(e, e.parameter || {});
    const fallbackParamKey = extractJsonStringPropertyFromText(getRawPostBody(e), 'project') || 'cacheReleaseInfo';
    const isDryRun = hasTruthyJsonBooleanPropertyInText(getRawPostBody(e), 'dryRun');
    const cachePayload = Object.assign({}, troubleshooting, payload, {
      dryRun: isDryRun || undefined,
      requestId: createTimelineSyncRequestId(projectConfig ? projectConfig.paramKey : fallbackParamKey),
      acceptedFormats: payload.acceptedFormats.concat(troubleshooting.acceptedFormats),
      nextAction: `${payload.nextAction} ${troubleshooting.nextAction}`,
      expectedBody: '{{WEB_APP_URL}}?action=cacheReleaseInfo&project=mThor&releaseInfo={{mThorReleaseInfo.replaceAll("\'","").urlEncode.replaceAll("\\+","%20")}}',
      expectedVariable: '{{webhookResponse.body}}'
    });
    if (projectConfig) {
      cachePayload.project = projectConfig.project;
      cachePayload.paramKey = projectConfig.paramKey;
    }
    return cachePayload;
  }

  if (actionName === 'markBotMessageExecuted') {
    return Object.assign(payload, {
      expectedBody: '{"messageId":{{messageId.asJsonString}},"rowIndex":{{webhookResponse.body.rowIndex}},"success":true,"topic":{{replacedTopic.asJsonString}},"content":{{replacedContent.asJsonString}},"sentChatId":{{webhookResponse.body.data.outputs.chatId.asJsonString}},"sentPostId":{{webhookResponse.body.data.outputs.postId.asJsonString}},"sentAt":{{webhookResponse.body.data.outputs.sentAt.asJsonString}}}'
    });
  }

  return payload;
}

function recordCachePostJsonParseFailure(action, payload, e, queryParameters) {
  if (getRequestParameterValue(action) !== 'cacheReleaseInfo') {
    return;
  }

  const rawPostBody = getRawPostBody(e);
  if (
    isTruthyRequestValue(queryParameters && queryParameters.dryRun) ||
    hasTruthyJsonBooleanPropertyInText(rawPostBody, 'dryRun')
  ) {
    return;
  }

  const projectConfig = resolveCacheReleaseInfoProjectFromPostFailure(e, queryParameters);
  const fallbackParamKey = extractJsonStringPropertyFromText(rawPostBody, 'project') || 'cacheReleaseInfo';
  payload.requestId = payload.requestId || createTimelineSyncRequestId(projectConfig ? projectConfig.paramKey : fallbackParamKey);
  if (!projectConfig) {
    return;
  }

  payload.project = projectConfig.project;
  payload.paramKey = projectConfig.paramKey;
  recordTimelineSyncAttempt(projectConfig, Object.assign({}, payload, {
    success: false,
    errorCode: payload.errorCode || 'INVALID_POST_JSON',
    parseError: payload.error || 'POST JSON 解析失败'
  }));
}

function mergeRequestParameters(queryParameters, bodyParameters) {
  const merged = {};
  const query = queryParameters || {};
  const body = bodyParameters || {};

  Object.keys(query).forEach(function(key) {
    merged[key] = query[key];
  });

  Object.keys(body).forEach(function(key) {
    if (body[key] !== undefined && body[key] !== null) {
      merged[key] = body[key];
    }
  });

  return merged;
}

function getFirstRequestParameterValue(parameters, keys) {
  const source = parameters || {};
  for (let i = 0; i < keys.length; i++) {
    const value = getRequestParameterValue(source[keys[i]]);
    if (value) {
      return value;
    }
  }
  return '';
}

function getFirstObjectValue(object, keys) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) {
    return '';
  }
  for (let i = 0; i < keys.length; i++) {
    const value = object[keys[i]];
    if (!isMissingRequestValue(value)) {
      return value.toString();
    }
  }
  return '';
}

function parseJsonObjectParameter(value) {
  const text = getRequestParameterValue(value);
  if (!text) {
    return {};
  }
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    Logger.log(`发送结果 JSON 解析失败，忽略 marker 元数据: ${error}`);
    return {};
  }
}

function extractSendResultMetaFromObject(object) {
  const candidates = [];
  if (object && typeof object === 'object' && !Array.isArray(object)) {
    candidates.push(object);
    if (object.data && typeof object.data === 'object') {
      candidates.push(object.data);
      if (object.data.outputs && typeof object.data.outputs === 'object') {
        candidates.push(object.data.outputs);
      }
    }
    if (object.outputs && typeof object.outputs === 'object') {
      candidates.push(object.outputs);
    }
    if (object.result && typeof object.result === 'object') {
      candidates.push(object.result);
    }
    if (object.post && typeof object.post === 'object') {
      candidates.push(object.post);
    }
    if (object.message && typeof object.message === 'object') {
      candidates.push(object.message);
    }
  }

  const meta = { sentChatId: '', sentPostId: '', sentAt: '' };
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!meta.sentChatId) {
      meta.sentChatId = getFirstObjectValue(candidate, [
        'sentChatId',
        'chatId',
        'groupId',
        'chat_id',
        'group_id',
        'resolved_chat_id'
      ]);
    }
    if (!meta.sentPostId) {
      meta.sentPostId = getFirstObjectValue(candidate, [
        'sentPostId',
        'postId',
        'post_id',
        'id'
      ]);
    }
    if (!meta.sentAt) {
      meta.sentAt = getFirstObjectValue(candidate, [
        'sentAt',
        'creationTime',
        'createdAt',
        'created_at',
        'timestamp'
      ]);
    }
  }
  return meta;
}

function extractSendResultMetaFromParameters(parameters) {
  const directMeta = {
    sentChatId: getFirstRequestParameterValue(parameters, [
      'sentChatId',
      'sentChatIdFallback',
      'sentChatIdAlt',
      'sentChatIdExtra',
      'chatId',
      'groupId'
    ]),
    sentPostId: getFirstRequestParameterValue(parameters, [
      'sentPostId',
      'sentPostIdFallback',
      'sentPostIdAlt',
      'sentPostIdExtra',
      'postId',
      'id'
    ]),
    sentAt: getFirstRequestParameterValue(parameters, [
      'sentAt',
      'sentAtFallback',
      'sentAtAlt',
      'sentAtExtra',
      'creationTime',
      'createdAt'
    ])
  };

  const payload = getFirstRequestParameterValue(parameters, [
    'sentPayload',
    'sendResult',
    'responsePayload'
  ]);
  if (!payload) {
    return directMeta;
  }

  const payloadMeta = extractSendResultMetaFromObject(parseJsonObjectParameter(payload));
  return {
    sentChatId: directMeta.sentChatId || payloadMeta.sentChatId || '',
    sentPostId: directMeta.sentPostId || payloadMeta.sentPostId || '',
    sentAt: directMeta.sentAt || payloadMeta.sentAt || ''
  };
}

function normalizeExecutionKey(executionKey) {
  const raw = getRequestParameterValue(executionKey).trim();
  if (!raw) {
    return '';
  }

  if (/^ek_[A-Za-z0-9_.:-]+$/.test(raw)) {
    return raw;
  }

  const safePrefix = raw.replace(/[^A-Za-z0-9_.:-]/g, '_').substring(0, 140);
  return `ek_${safePrefix}_${simpleStringHash(raw)}`;
}

function simpleStringHash(value) {
  let hash = 0;
  const text = value || '';
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildExecutionMarkPropertyKey(executionKey) {
  const normalized = normalizeExecutionKey(executionKey);
  return normalized ? `${EXECUTION_MARK_KEY_PREFIX}${normalized}` : '';
}

function parseExecutionMarkRecord(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    return null;
  }
}

function getRecordedExecutionMark(props, propertyKey, now) {
  if (!propertyKey) {
    return null;
  }

  const existing = parseExecutionMarkRecord(props.getProperty(propertyKey));
  if (!existing) {
    return null;
  }

  const markedAt = existing.markedAt ? new Date(existing.markedAt).getTime() : 0;
  if (markedAt && now.getTime() - markedAt > EXECUTION_MARK_MAX_AGE_MS) {
    props.deleteProperty(propertyKey);
    return null;
  }

  return existing;
}

function recordExecutionMark(props, propertyKey, executionKey, messageId, rowIndex, success, now) {
  if (!propertyKey) {
    return;
  }

  props.setProperty(propertyKey, JSON.stringify({
    executionKey: normalizeExecutionKey(executionKey),
    messageId,
    rowIndex,
    success,
    markedAt: now.toISOString()
  }));
}

function withExecutionMarkLock(callback) {
  if (typeof LockService === 'undefined') {
    return callback();
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    return callback();
  } finally {
    try {
      lock.releaseLock();
    } catch (error) {
      Logger.log(`释放执行标记锁失败: ${error}`);
    }
  }
}

function buildMessageExecutionKey(message, messageId, now) {
  const minuteKey = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMddHHmm');
  const raw = [
    'v1',
    messageId,
    message.rowIndex,
    message.matchMode || '',
    minuteKey
  ].join(':');

  return normalizeExecutionKey(raw);
}

function getReleaseInfoTroubleshootingPayload() {
  return {
    expectedShape: '{releaseInfo={Milestone=MM/DD/YYYY, ...}}',
    acceptedFormats: [
      'GET query: ?action=cacheReleaseInfo&project=mThor&releaseInfo={{mThorReleaseInfo.replaceAll("\'","").urlEncode.replaceAll("\\+","%20")}}',
      'Saved variable: {{webhookResponse.body}}',
      'POST JSON body: {"project":"mThor","releaseInfo":{"releaseInfo":{"FF":"MM/DD/YYYY"}}}',
      'Groovy Map fallback: {currentRelease=Version, releaseInfo={FF=MM/DD/YYYY}}'
    ],
    limits: {
      maxChars: JIRA_RELEASE_INFO_MAX_CHARS,
      maxNestingDepth: JIRA_GROOVY_MAX_NESTING_DEPTH,
      maxCachePropertyBytes: TIMELINE_CACHE_PROPERTY_MAX_BYTES
    },
    nextAction: '生成的 Jira Rule 必须用 GET 调 Apps Script cacheReleaseInfo；先用 {{webhookResponse.body}} 保存变量，再用 .replaceAll("\'","").urlEncode.replaceAll("\\+","%20") 放进 URL；不要改成 POST，否则 Jira 可能停在 Google 302 重定向。'
  };
}

function getReleaseInfoCacheNextAction(errorCode) {
  switch (errorCode) {
    case 'MISSING_RELEASE_INFO':
      return '检查 Timeline Sync Rule：releaseInfo 变量应保存 {{webhookResponse.body}}，Apps Script webhook Method=GET，URL 包含 project 和 releaseInfo={{变量.replaceAll("\'","").urlEncode.replaceAll("\\+","%20")}}。';
    case 'INVALID_POST_JSON':
      return '不要把 Jira Automation 到 Apps Script 的 cacheReleaseInfo 配成 POST；生成规则应使用 GET，避免 Jira 停在 Google 302 重定向。';
    case 'INVALID_RELEASE_INFO_SCHEMA':
      return '确认 releaseInfo.releaseInfo 下至少有一个 MM/DD/YYYY 格式的 Milestone 日期；空日期、ISO 日期和非字符串值不会触发 Timeline。';
    case 'RELEASE_INFO_TOO_LARGE':
      return '减少 releaseInfo 字符数到限制内，只同步 Timeline 消息需要的项目字段和 Milestone 日期。';
    case 'RELEASE_INFO_TOO_DEEP':
      return '压平 releaseInfo 结构，避免超过 Groovy Map 嵌套层级限制；Timeline 缓存只需要项目字段和 Milestone 日期。';
    case 'TIMELINE_CACHE_TOO_LARGE':
      return 'Timeline 缓存超过 Apps Script Script Properties 单值 9KB 限制。请减少同步字段或 Milestone 数量后，手动运行 Timeline Sync Rule；如项目确实需要更大 payload，需要改用 Sheet/Drive 等外部缓存。';
    case 'UNKNOWN_PROJECT':
      return '确认 JSON body 的 project 使用生成规则里的项目参数名，例如 mThor、jupiterDesktop、nova。';
    default:
      return getReleaseInfoTroubleshootingPayload().nextAction;
  }
}

function truncateTimelineSyncDiagnostic(value, maxLength) {
  const text = getRequestParameterValue(value).replace(/\s+/g, ' ').trim();
  if (!text || text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - 3) + '...';
}

function getTimelineSyncAttemptKey(paramKey) {
  return TIMELINE_SYNC_ATTEMPT_KEY_PREFIX + paramKey;
}

function createTimelineSyncRequestId(paramKey) {
  const safeParamKey = (getRequestParameterValue(paramKey).trim() || 'project')
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .substring(0, 40);
  const timestampPart = new Date().getTime().toString(36);
  const randomPart = Math.floor(Math.random() * 1679616).toString(36);
  return `tl_${safeParamKey}_${timestampPart}_${randomPart}`;
}

function buildTimelineSyncAttempt(projectConfig, payload) {
  const now = new Date();
  const attempt = {
    project: projectConfig.project,
    paramKey: projectConfig.paramKey,
    success: payload && payload.success === true,
    attemptedAt: now.toISOString(),
    timestamp: now.getTime()
  };

  const errorCode = truncateTimelineSyncDiagnostic(payload && payload.errorCode, 80);
  const error = truncateTimelineSyncDiagnostic(payload && (payload.error || payload.message), TIMELINE_SYNC_ATTEMPT_ERROR_MAX_CHARS);
  const parseError = truncateTimelineSyncDiagnostic(payload && payload.parseError, TIMELINE_SYNC_ATTEMPT_ERROR_MAX_CHARS);
  const requestContentType = truncateTimelineSyncDiagnostic(payload && payload.requestContentType, 120);
  const nextAction = truncateTimelineSyncDiagnostic(payload && payload.nextAction, TIMELINE_SYNC_ATTEMPT_ERROR_MAX_CHARS);
  const requestId = truncateTimelineSyncDiagnostic(payload && payload.requestId, 120);

  if (requestId) {
    attempt.requestId = requestId;
  }
  if (errorCode) {
    attempt.errorCode = errorCode;
  }
  if (error) {
    attempt.error = error;
  }
  if (parseError) {
    attempt.parseError = parseError;
  }
  if (requestContentType) {
    attempt.requestContentType = requestContentType;
  }
  if (nextAction) {
    attempt.nextAction = nextAction;
  }
  if (payload && typeof payload.requestBodyBytes === 'number' && isFinite(payload.requestBodyBytes)) {
    attempt.requestBodyBytes = payload.requestBodyBytes;
  } else if (payload && typeof payload.bodyLength === 'number' && isFinite(payload.bodyLength)) {
    attempt.requestBodyBytes = payload.bodyLength;
  }
  if (payload && typeof payload.payloadBytes === 'number' && isFinite(payload.payloadBytes)) {
    attempt.payloadBytes = payload.payloadBytes;
  }
  if (payload && typeof payload.maxBytes === 'number' && isFinite(payload.maxBytes)) {
    attempt.maxBytes = payload.maxBytes;
  }
  if (payload && typeof payload.milestoneCount === 'number' && isFinite(payload.milestoneCount)) {
    attempt.milestoneCount = payload.milestoneCount;
  }
  if (payload && Array.isArray(payload.milestoneKeys)) {
    attempt.milestoneKeys = payload.milestoneKeys
      .map(function(key) { return getRequestParameterValue(key).trim(); })
      .filter(function(key) { return key; })
      .slice(0, 20);
  }

  return attempt;
}

function recordTimelineSyncAttempt(projectConfig, payload) {
  if (!projectConfig) {
    return;
  }

  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(
      getTimelineSyncAttemptKey(projectConfig.paramKey),
      JSON.stringify(buildTimelineSyncAttempt(projectConfig, payload || {}))
    );
  } catch (error) {
    Logger.log(`[cacheReleaseInfo] 记录同步尝试失败: ${error.toString()}`);
  }
}

function createTimelineCacheResponse(projectConfig, payload, options) {
  const shouldRecordAttempt = !(options && options.recordAttempt === false);
  if (shouldRecordAttempt) {
    recordTimelineSyncAttempt(projectConfig, payload);
  }
  return createJsonOutput(payload);
}

function handleCacheReleaseInfoRequest(parameters) {
  let projectConfig = null;
  let requestId = '';

  try {
    const paramKey = getRequestParameterValue(parameters.project).trim();
    const rawReleaseInfo = parameters.releaseInfo;
    const dryRun = isTruthyRequestValue(parameters.dryRun);
    const responseOptions = dryRun ? { recordAttempt: false } : null;
    projectConfig = getTimelineProjectConfigByParamKey(paramKey);
    requestId = createTimelineSyncRequestId(projectConfig ? projectConfig.paramKey : paramKey || 'unknown');

    if (!projectConfig) {
      const message = `[cacheReleaseInfo] 未知项目参数: ${paramKey || '(empty)'}`;
      Logger.log(message);
      return createJsonOutput({
        success: false,
        requestId,
        dryRun,
        errorCode: 'UNKNOWN_PROJECT',
        error: message,
        project: paramKey,
        nextAction: getReleaseInfoCacheNextAction('UNKNOWN_PROJECT')
      });
    }

    if (isMissingRequestValue(rawReleaseInfo)) {
      const message = `[cacheReleaseInfo] 缺少 releaseInfo，项目: ${projectConfig.project}`;
      Logger.log(message);
      return createTimelineCacheResponse(projectConfig, {
        success: false,
        requestId,
        dryRun,
        errorCode: 'MISSING_RELEASE_INFO',
        error: message,
        project: projectConfig.project,
        paramKey: projectConfig.paramKey,
        nextAction: getReleaseInfoCacheNextAction('MISSING_RELEASE_INFO')
      }, responseOptions);
    }

    const parseResult = parseSingleProjectReleaseInfoForCache(rawReleaseInfo);

    if (!parseResult.success) {
      const message = `[cacheReleaseInfo] releaseInfo 解析失败，项目: ${projectConfig.project}，原因: ${parseResult.parseError || parseResult.errorCode}`;
      Logger.log(message);
      return createTimelineCacheResponse(projectConfig, Object.assign({}, getReleaseInfoTroubleshootingPayload(), {
        success: false,
        requestId,
        dryRun,
        errorCode: parseResult.errorCode || 'INVALID_RELEASE_INFO',
        error: message,
        parseError: parseResult.parseError || '',
        project: projectConfig.project,
        paramKey: projectConfig.paramKey,
        nextAction: getReleaseInfoCacheNextAction(parseResult.errorCode || 'INVALID_RELEASE_INFO')
      }), responseOptions);
    }

    const projectInfo = parseResult.projectInfo;
    const validMilestoneKeys = getValidTimelineMilestoneKeys(projectInfo.releaseInfo);
    const cacheKey = getTimelineProjectCacheKey(paramKey);
    const updatedAt = new Date().toISOString();
    const cachePayload = {
      project: projectConfig.project,
      paramKey: projectConfig.paramKey,
      releaseInfo: projectInfo,
      updatedAt,
      timestamp: new Date().getTime(),
    };
    const serializedCachePayload = JSON.stringify(cachePayload);
    const cachePayloadBytes = getUtf8ByteLength(serializedCachePayload);

    if (cachePayloadBytes > TIMELINE_CACHE_PROPERTY_MAX_BYTES) {
      const message = `[cacheReleaseInfo] releaseInfo 缓存超过 Script Properties 单值限制，项目: ${projectConfig.project}`;
      Logger.log(`${message}，大小: ${cachePayloadBytes}/${TIMELINE_CACHE_PROPERTY_MAX_BYTES} bytes`);
      return createTimelineCacheResponse(projectConfig, Object.assign({}, getReleaseInfoTroubleshootingPayload(), {
        success: false,
        requestId,
        errorCode: 'TIMELINE_CACHE_TOO_LARGE',
        error: message,
        project: projectConfig.project,
        paramKey: projectConfig.paramKey,
        payloadBytes: cachePayloadBytes,
        maxBytes: TIMELINE_CACHE_PROPERTY_MAX_BYTES,
        milestoneCount: validMilestoneKeys.length,
        milestoneKeys: validMilestoneKeys.slice(0, 20),
        nextAction: getReleaseInfoCacheNextAction('TIMELINE_CACHE_TOO_LARGE')
      }), responseOptions);
    }

    if (dryRun) {
      Logger.log(`[cacheReleaseInfo] dry-run 校验成功，项目: ${projectConfig.project}`);
      return createTimelineCacheResponse(projectConfig, {
        success: true,
        dryRun: true,
        wouldCache: true,
        requestId,
        project: projectConfig.project,
        paramKey: projectConfig.paramKey,
        payloadBytes: cachePayloadBytes,
        maxBytes: TIMELINE_CACHE_PROPERTY_MAX_BYTES,
        milestoneCount: validMilestoneKeys.length,
        milestoneKeys: validMilestoneKeys,
      }, responseOptions);
    }

    const props = PropertiesService.getScriptProperties();
    props.setProperty(cacheKey, serializedCachePayload);
    Logger.log(`[cacheReleaseInfo] 缓存成功，项目: ${projectConfig.project}`);

    return createTimelineCacheResponse(projectConfig, {
      success: true,
      requestId,
      project: projectConfig.project,
      paramKey: projectConfig.paramKey,
      updatedAt,
      milestoneCount: validMilestoneKeys.length,
      milestoneKeys: validMilestoneKeys,
    }, responseOptions);
  } catch (cacheError) {
    Logger.log(`[cacheReleaseInfo] 错误: ${cacheError.toString()}`);
    const dryRun = isTruthyRequestValue(parameters && parameters.dryRun);
    return createTimelineCacheResponse(projectConfig, {
      success: false,
      requestId,
      dryRun,
      errorCode: 'CACHE_RELEASE_INFO_EXCEPTION',
      error: cacheError.toString(),
      nextAction: '复制 Timeline 缓存诊断后查看 Apps Script 执行日志，并用请求 ID 对照失败请求。'
    }, dryRun ? { recordAttempt: false } : null);
  }
}

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
            <p>您已成功授权你私人表格 <span class="highlight">定时消息管理</span></p>
            <p>现在可以关闭此页面，返回扩展页面点击 <span class="highlight">"我已完成授权，继续初始化"</span> 按钮完成剩余步骤。</p>
            <p style="font-size: 14px; color: #999; margin-top: 30px;">
              💡 提示：请保持此标签页打开，直到完成所有初始化步骤
            </p>
          </div>
        </body>
      </html>
    `);
  }
  
  // 按项目缓存 releaseInfo 到 Script Properties。
  // Jira Automation 调 Apps Script Web App 必须用 GET；POST 可能停在 Google 302 重定向。
  if (action === 'cacheReleaseInfo') {
    return handleCacheReleaseInfoRequest(e.parameter);
  }

  // 返回 Timeline 缓存状态，供扩展 UI 判断 Sync Rule 是否已经把数据写入缓存
  if (action === 'getTimelineCacheStatus') {
    return ContentService.createTextOutput(
      JSON.stringify(getTimelineCacheStatus())
    ).setMimeType(ContentService.MimeType.JSON);
  }
  
  // 获取当前时间点需要执行的单条 Bot 消息（供 Jira Automation 调用）
  // 只返回消息数据，不调用 Bot API（Bot API 由 Jira 调用，因为在内网）
  // 支持两种模式：
  // 1. 带 releaseInfo 参数（URL inline）：用于 Timeline 消息匹配
  // 2. 不带参数：从 Script Properties 缓存读取（分批写入后调用此接口）
  if (action === 'getBotMessageCurrentTime') {
    const currentTimeStr = e.parameter.currentTime || '';

    // 从 URL 参数接收 releaseInfo（可选，主要用于兼容旧调用）
    let releaseInfo = extractReleaseInfoFromParameters(e.parameter);
    
    if (releaseInfo) {
      Logger.log(`[GET] 接收到 inline releaseInfo 参数，项目: ${Object.keys(releaseInfo).join(', ')}`);
    } else {
      // 无 inline 参数，从 Script Properties 缓存读取（正常工作流程）
      try {
        releaseInfo = readReleaseInfoFromCache();
        if (releaseInfo && Object.keys(releaseInfo).length > 0) {
          Logger.log(`[GET] 从缓存读取 releaseInfo，项目: ${Object.keys(releaseInfo).join(', ')}`);
        } else {
          Logger.log('[GET] 未找到缓存，使用无 releaseInfo 模式（不匹配 Timeline 消息）');
        }
      } catch (cacheReadError) {
        Logger.log(`[GET] 读取缓存失败: ${cacheReadError.toString()}`);
      }
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
    const executionKey = getRequestParameterValue(e.parameter.executionKey);
    const sendResultMeta = extractSendResultMetaFromParameters(e.parameter || {});
    // 接收替换后的内容（用于日志记录）
    const replacedTopic = getRequestParameterValue(e.parameter.topic);
    const replacedContent = getRequestParameterValue(e.parameter.content);
    
    return ContentService.createTextOutput(
      JSON.stringify(markBotMessageExecuted(messageId, rowIndex, success, error, replacedTopic, replacedContent, executionKey, sendResultMeta.sentChatId, sendResultMeta.sentPostId, sendResultMeta.sentAt))
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
  
  // 获取 App Script 版本信息
  if (action === 'getVersion') {
    return ContentService.createTextOutput(
      JSON.stringify({ 
        version: APP_SCRIPT_VERSION,
        lastUpdated: APP_SCRIPT_LAST_UPDATED
      })
    ).setMimeType(ContentService.MimeType.JSON);
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
  let queryParameters = {};
  let action = '';

  try {
    queryParameters = e.parameter || {};
    action = getRequestParameterValue(queryParameters.action);
    const postData = parseJsonPostBody(e);
    action = action || getRequestParameterValue(postData.action);
    Logger.log(`POST action: ${action}`);
    Logger.log(`POST 请求来源: ${JSON.stringify(queryParameters)}`);

    if (action === 'cacheReleaseInfo') {
      return handleCacheReleaseInfoRequest(mergeRequestParameters(queryParameters, postData));
    }

    if (action === 'markBotMessageExecuted') {
      const parameters = mergeRequestParameters(queryParameters, postData);
      const messageId = getRequestParameterValue(parameters.messageId);
      const rowIndex = parseInt(getRequestParameterValue(parameters.rowIndex)) || 0;
      const success = parameters.success === true || getRequestParameterValue(parameters.success) === 'true';
      const error = getRequestParameterValue(parameters.error);
      const replacedTopic = getRequestParameterValue(parameters.topic);
      const replacedContent = getRequestParameterValue(parameters.content);
      const executionKey = getRequestParameterValue(parameters.executionKey);
      const sendResultMeta = extractSendResultMetaFromParameters(parameters);

      return ContentService.createTextOutput(
        JSON.stringify(markBotMessageExecuted(messageId, rowIndex, success, error, replacedTopic, replacedContent, executionKey, sendResultMeta.sentChatId, sendResultMeta.sentPostId, sendResultMeta.sentAt))
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'getBotMessageCurrentTime') {
      // 解析 POST 数据
      let requestData = postData;
      Logger.log(`接收到 releaseInfo 数据: ${JSON.stringify(requestData).substring(0, 200)}...`);
      
      // 支持两种 body 格式：
      // 1. { releaseInfo: {...}, currentTime: "..." } - 标准格式
      // 2. { mThor: "...", jupiterDesktop: "...", ... } - Jira POST 的 per-project 格式（规避 URL 长度限制）
      if (!requestData.releaseInfo || Object.keys(requestData.releaseInfo).length === 0) {
        const releaseInfo = extractReleaseInfoFromParameters(requestData);
        if (releaseInfo) {
          requestData = { releaseInfo: releaseInfo, currentTime: requestData.currentTime || '' };
        }
      }
      
      // 调用新的处理函数
      const result = getMessageCurrentTimeWithReleaseInfo(requestData);
      
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

    if (isPostJsonParseError(error)) {
      const payload = buildPostJsonParseErrorPayload(action, error, e);
      recordCachePostJsonParseFailure(action, payload, e, queryParameters);
      return createJsonOutput(payload);
    }

    return createJsonOutput({ status: 'ERROR', message: error.toString() });
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
 * @param {string} replacedTopic - 替换变量后的主题（可选，用于日志记录）
 * @param {string} replacedContent - 替换变量后的内容（可选，用于日志记录）
 * @param {string} executionKey - 单次执行的幂等键（可选，用于规避 Jira/网络重试重复记账）
 * @param {string} sentChatId - 实际发送成功后的 RingCentral chatId（可选）
 * @param {string} sentPostId - 实际发送成功后的 RingCentral postId（可选）
 * @param {string} sentAt - 实际发送时间（可选）
 * @returns {object} 更新结果
 */
function markBotMessageExecuted(messageId, rowIndex, success, errorMsg, replacedTopic, replacedContent, executionKey, sentChatId, sentPostId, sentAt) {
  try {
    // 构建替换后的内容对象（用于日志记录）
    const sendResultMeta = {
      sentChatId: getRequestParameterValue(sentChatId),
      sentPostId: getRequestParameterValue(sentPostId),
      sentAt: getRequestParameterValue(sentAt)
    };
    const hasReplacedContent = replacedTopic || replacedContent;
    const hasSendResultMeta = sendResultMeta.sentChatId || sendResultMeta.sentPostId || sendResultMeta.sentAt;
    const replacedContentObj = (hasReplacedContent || hasSendResultMeta) ? {
      topic: replacedTopic || '',
      content: replacedContent || '',
      sentChatId: sendResultMeta.sentChatId || '',
      sentPostId: sendResultMeta.sentPostId || '',
      sentAt: sendResultMeta.sentAt || ''
    } : null;

    const normalizedExecutionKey = normalizeExecutionKey(executionKey);
    const applyExecutionMark = function() {
      const now = new Date();
      const props = normalizedExecutionKey ? PropertiesService.getScriptProperties() : null;
      const propertyKey = normalizedExecutionKey ? buildExecutionMarkPropertyKey(normalizedExecutionKey) : '';
      const existingMark = props ? getRecordedExecutionMark(props, propertyKey, now) : null;

      if (existingMark) {
        Logger.log(`跳过重复执行标记: ${messageId}, executionKey=${normalizedExecutionKey}`);
        return {
          success: true,
          messageId: getRequestParameterValue(messageId) || getRequestParameterValue(existingMark.messageId),
          marked: true,
          duplicate: true,
          rowIndex: parseInt(existingMark.rowIndex, 10) || parseInt(rowIndex, 10) || 0,
          executionKey: normalizedExecutionKey
        };
      }

      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Messages');
      if (!sheet) {
        return { success: false, error: 'Messages sheet not found' };
      }

      const data = sheet.getDataRange().getDisplayValues();
      const headers = data[0];

      const resolvedRow = resolveExecutionMarkRow(data, headers, rowIndex, messageId);
      if (!resolvedRow.success) {
        return {
          success: false,
          error: resolvedRow.error,
          messageId: messageId,
          rowIndex: rowIndex
        };
      }

      const actualRowIndex = resolvedRow.rowIndex;
      const rowData = resolvedRow.rowData;

      // 更新执行日志（已包含 shouldMarkAsDone 判断和 insertPushLog 调用）
      updateExecutionLog(sheet, actualRowIndex, rowData, success, headers, errorMsg, replacedContentObj, normalizedExecutionKey);
      if (props) {
        recordExecutionMark(props, propertyKey, normalizedExecutionKey, messageId, actualRowIndex, success, now);
      }

      Logger.log(`标记消息执行完成: ${messageId}, 成功: ${success}`);

      const response = {
        success: true,
        messageId: messageId,
        marked: true,
        duplicate: false,
        rowIndex: actualRowIndex
      };
      if (normalizedExecutionKey) {
        response.executionKey = normalizedExecutionKey;
      }
      return response;
    };

    if (normalizedExecutionKey) {
      return withExecutionMarkLock(applyExecutionMark);
    }

    // 兼容旧 Jira Rule：没有 executionKey 时保持原行为。
    return applyExecutionMark();
    
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
  const targetMessageId = getRequestParameterValue(messageId);
  if (!targetMessageId) {
    return null;
  }

  const idColIndex = headers.indexOf('ID');
  if (idColIndex === -1) {
    Logger.log('错误：未找到 ID 列');
    return null;
  }
  
  for (let i = 1; i < data.length; i++) {
    if (getRequestParameterValue(data[i][idColIndex]) === targetMessageId) {
      return i + 1; // 返回从 1 开始的索引
    }
  }
  
  Logger.log(`未找到消息 ID: ${targetMessageId}`);
  return null;
}

function getMessageIdAtRow(data, headers, rowIndex) {
  const idColIndex = headers.indexOf('ID');
  if (idColIndex === -1 || rowIndex <= 1 || rowIndex > data.length) {
    return '';
  }

  const row = data[rowIndex - 1];
  return row ? getRequestParameterValue(row[idColIndex]) : '';
}

function resolveExecutionMarkRow(data, headers, rowIndex, messageId) {
  const requestedRowIndex = parseInt(rowIndex, 10) || 0;
  const targetMessageId = getRequestParameterValue(messageId);
  const hasUsableRowIndex = requestedRowIndex > 1 && requestedRowIndex <= data.length;

  if (hasUsableRowIndex) {
    const rowMessageId = getMessageIdAtRow(data, headers, requestedRowIndex);
    if (!targetMessageId || rowMessageId === targetMessageId) {
      return {
        success: true,
        rowIndex: requestedRowIndex,
        rowData: parseRow(data[requestedRowIndex - 1], headers)
      };
    }

    Logger.log(`rowIndex ${requestedRowIndex} 的消息 ID (${rowMessageId || 'empty'}) 与回调 ID (${targetMessageId}) 不一致，改按 messageId 查找`);
  } else {
    Logger.log(`rowIndex 无效 (${rowIndex})，尝试通过 messageId 查找: ${targetMessageId || '(empty)'}`);
  }

  const fallbackRowIndex = findRowIndexByMessageId(data, headers, targetMessageId);
  if (fallbackRowIndex) {
    Logger.log(`通过 messageId 找到行索引: ${fallbackRowIndex}`);
    return {
      success: true,
      rowIndex: fallbackRowIndex,
      rowData: parseRow(data[fallbackRowIndex - 1], headers)
    };
  }

  if (!targetMessageId) {
    return {
      success: false,
      error: `行索引 ${requestedRowIndex || '(empty)'} 无效，且未提供消息 ID`
    };
  }

  return {
    success: false,
    error: `无法找到消息 ID: ${targetMessageId}`
  };
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
function shouldMarkAsDone(rowData, currentTime) {
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
    const now = currentTime || new Date();
    
    // 结束日当天执行成功后即可收尾，避免第二天再保留 Active。
    if (rowData.End_Date) {
      if (isOnOrAfterScheduleEndDate(now, rowData.End_Date)) {
        return true;
      }
    }
    
    // 检查是否达到重复次数限制
    if (rowData.Repeat_Count) {
      const repeatCount = parseInt(rowData.Repeat_Count);
      const execCount = (parseInt(rowData.Exec_Count) || 0) + 1;
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
 * @param {boolean} ringCentralSenderEnabled - 是否允许 Jira 处理 AsMe RingCentral sender
 * @returns {object|null} 消息对象或 null
 */
function findMatchingMessage(data, headers, now, releaseInfo, matchMode, currentDate, currentHour, ringCentralSenderEnabled) {
  // 遍历所有消息，找到第一个符合匹配模式的消息（按表格顺序）
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowData = parseRow(row, headers);
    
    // 基本过滤：必须是 Active + Jira 执行器支持的推送方式
    const hasAiEndpoint = String(rowData.AI_Endpoint || '').trim() !== '';
    const isValidPushMethod = rowData.Push_Method === 'Bot' || 
                              rowData.Push_Method === 'AI' || 
                              (rowData.Push_Method === 'JiraAutomation' && hasAiEndpoint) ||
                              (ringCentralSenderEnabled === true && rowData.Push_Method === 'AsMe');
    if (rowData.Status !== 'Active' || !isValidPushMethod) {
      continue;
    }

    const dateReference = getDateReferenceForMatchMode(rowData, now, matchMode);
    const matchDate = Utilities.formatDate(dateReference, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    // 过滤：该执行日期已推送成功的消息
    if (isPushedSuccessfullyToday(rowData, matchDate)) {
      continue;
    }
    
    // 过滤：该执行日期已推送失败的消息（避免阻塞队列）
    if (isPushedFailedToday(rowData, matchDate)) {
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
      dateMatches = targetDate && isSameDate(dateReference, targetDate);
      
    } else if (messageType === 'Periodic') {
      // Periodic 消息：使用周期性日期判断逻辑
      dateMatches = checkPeriodicSchedule(rowData, dateReference);
      
    } else {
      // OneTime 消息：检查 Schedule_Date 是否匹配今天
      dateMatches = rowData.Schedule_Date && rowData.Schedule_Date === matchDate;
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
      
      // 替换项目进度变量（Bot/AI 所有场景都支持）
      let topic = rowData.Topic;
      let content = rowData.Content;
      let aiBody = rowData.AI_Body || '';
      
      // 如果有 releaseInfo 且设置了 Timeline_Project，则替换变量
      if (rowData.Timeline_Project) {
        const projectInfo = getTimelineProjectInfo(releaseInfo, rowData.Timeline_Project);
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
      let chatId = '';
      if (rowData.Push_Method === 'AsMe' && ringCentralSenderEnabled === true) {
        targetType = 'ringcentral_sender';
        chatId = (rowData.Glip_Team_ID && rowData.Glip_Team_ID.trim())
          ? rowData.Glip_Team_ID.trim()
          : (rowData.Glip_User_Name || '').trim();
      } else if (rowData.Push_Method === 'AI') {
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
        chatId: chatId,
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
  if (scheduleMinutes === null) {
    Logger.log(`跳过无效执行时间: ${rowData.ID || rowData.Topic || ''} - ${rowData.Schedule_Time}`);
    return false;
  }
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let diff = nowMinutes - scheduleMinutes;
  if (diff < 0) {
    diff += 1440;
  }
  
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

  if (!isNoTimeExecutorQueueMessage(rowData)) {
    return false;
  }
  
  // 未指定时间的执行器消息在 8 点后执行（作为兜底逻辑）
  return now.getHours() >= 8;
}

/**
 * 判断消息在指定执行日期是否已成功推送
 */
function isPushedSuccessfullyToday(rowData, currentDate) {
  const lastExec = rowData.Last_Exec;
  const execLog = rowData.Exec_Log || '';
  
  if (!lastExec) return false;
  
  // 检查 Last_Exec 是否是指定执行日期
  const lastExecDate = lastExec.toString().substring(0, 10);
  if (lastExecDate !== currentDate) {
    return false;
  }
  
  // 检查是否成功（包含 ✅ 或 "成功"）
  const isSuccess = execLog.includes('✅') || execLog.includes('成功');
  
  return isSuccess;
}

/**
 * 判断消息在指定执行日期是否推送失败
 */
function isPushedFailedToday(rowData, currentDate) {
  const lastExec = rowData.Last_Exec;
  const execLog = rowData.Exec_Log || '';
  
  if (!lastExec) return false;
  
  // 检查 Last_Exec 是否是指定执行日期
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
  if (!timeStr || !timeStr.toString().trim()) return null;
  
  const match = /^(\d{1,2}):(\d{1,2})(?::\d{1,2})?\s*(AM|PM)?$/i.exec(timeStr.toString().trim());
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3] ? match[3].toUpperCase() : '';

  if (period) {
    if (hours < 1 || hours > 12) return null;
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  } else if (hours < 0 || hours > 23) {
    return null;
  }

  if (minutes < 0 || minutes > 59) return null;
  
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
    if (str === null || str === undefined) return '';
    return JSON.stringify(str.toString()).slice(1, -1);
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
    const ringCentralSenderConfig = getRingCentralSenderConfigFromSheet();
    const ringCentralSenderReady = isRingCentralSenderReady(ringCentralSenderConfig);
    reactivateDoneFutureOneTimeMessages(sheet, data, headers, now);
    
    Logger.log(`[三匹配模式查找] 开始查找消息，当前时间: ${currentDate} ${currentHour}:${now.getMinutes()}`);
    if (ringCentralSenderReady) {
      Logger.log('[三匹配模式查找] RingCentral AsMe sender 已启用，AsMe 消息可由 Jira 执行');
    }
    
    // 匹配模式 1: 查找当前分钟需要执行的消息
    Logger.log('[匹配模式 1] 查找当前分钟的消息...');
    let message = findMatchingMessage(data, headers, now, releaseInfo, 'CURRENT_MINUTE', currentDate, currentHour, ringCentralSenderReady);
    
    // 匹配模式 2: 查找过去 30 分钟内应该执行但未执行的消息
    if (!message) {
      Logger.log('[匹配模式 2] 查找过去 30 分钟的消息...');
      message = findMatchingMessage(data, headers, now, releaseInfo, 'PAST_30_MINUTES', currentDate, currentHour, ringCentralSenderReady);
      if (message) {
        Logger.log(`[匹配模式 2] ✅ 找到消息: ${message.ID} - ${message.Topic} (补偿执行)`);
      }
    }
    
    // 匹配模式 3: 查找未指定时间的消息（仅限 8 点后）
    if (!message && currentHour >= 8) {
      Logger.log('[匹配模式 3] 查找未指定时间的消息（8点后）...');
      message = findMatchingMessage(data, headers, now, releaseInfo, 'NO_TIME_SPECIFIED', currentDate, currentHour, ringCentralSenderReady);
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
    const executionKey = buildMessageExecutionKey(message, messageId, now);
    
    // === 检查是否是 AI 消息或 JiraAutomation（有 AI_Endpoint）===
    if (message.Push_Method === 'AI' || (message.Push_Method === 'JiraAutomation' && String(message.AI_Endpoint || '').trim() !== '')) {
      Logger.log(`处理 ${message.Push_Method} 消息: ${messageId}`);
      
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
      
      // 返回 AI 消息数据（host 和 uri 分开），由 Jira 在 endpoint 调用后回写执行日志。
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
        executionKey: executionKey,
        requiresExecutionCallback: true,
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
      // RingCentral AsMe sender 字段
      chatId: message.chatId || '',
      // Email 消息字段
      glipEmailAddress: message.glipEmailAddress || '',
      rowIndex: message.rowIndex,
      executionKey: executionKey,
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
  const offsetText = getRequestParameterValue(rowData.Timeline_Offset || '0').trim();
  const offset = /^-?\d+$/.test(offsetText) ? parseInt(offsetText, 10) : NaN;
  
  if (!project || !milestone) {
    return null;
  }

  if (!isFinite(offset)) {
    Logger.log(`Timeline 偏移天数格式错误: ${rowData.Timeline_Offset}`);
    return null;
  }
  
  // 获取项目的 releaseInfo。当前缓存保存扁平项目对象，旧 inline 调用可能保存 { releaseInfo: {...} } 包装对象。
  const projectInfo = getTimelineProjectInfo(releaseInfo, project);
  if (!projectInfo) {
    Logger.log(`未找到项目 ${project} 的 releaseInfo`);
    return null;
  }
  
  const milestoneMap = getTimelineProjectMilestoneMap(projectInfo);

  // 获取 milestone 日期
  const milestoneDate = getTimelineMilestoneDateText(milestoneMap[milestone]);
  if (!milestoneDate) {
    Logger.log(`未找到有效 Milestone 日期: ${milestone}`);
    return null;
  }
  
  // 解析日期（格式：MM/DD/YYYY）
  const dateParts = milestoneDate.split('/');
  const baseDate = new Date(
    parseInt(dateParts[2]), // year
    parseInt(dateParts[0]) - 1, // month (0-based)
    parseInt(dateParts[1]) // day
  );
  
  // 应用工作日偏移
  const targetDate = addWorkingDays(baseDate, offset);
  
  return targetDate;
}

function getTimelineProjectInfo(releaseInfo, project) {
  if (!releaseInfo || !project) {
    return null;
  }

  const projectInfo = releaseInfo[project];
  if (!projectInfo) {
    const projectConfig = getTimelineProjectConfig(project);
    if (!projectConfig) {
      return null;
    }

    return releaseInfo[projectConfig.project] || releaseInfo[projectConfig.paramKey] || null;
  }

  return projectInfo;
}

function getTimelineProjectMilestoneMap(projectInfo) {
  if (!projectInfo || typeof projectInfo !== 'object') {
    return {};
  }

  if (projectInfo.releaseInfo && typeof projectInfo.releaseInfo === 'object' && !Array.isArray(projectInfo.releaseInfo)) {
    return projectInfo.releaseInfo;
  }

  return projectInfo;
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
  result = result.replaceAll('{nextRelease}', projectInfo.nextRelease || '');
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
 * Jira 的 {{webhookResponse.body}} 返回的是 Groovy Map 格式：
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
  try {
    return parseJiraJsonStrict(jsonStr);
  } catch (e) {
    Logger.log(`Groovy Map 解析失败: ${getSafeJiraParseErrorMessage(e)}`);
    Logger.log(`原始字符串: ${String(jsonStr || '').trim()}`);
    return {};
  }
}

function parseJiraJsonStrict(jsonStr) {
  if (jsonStr && typeof jsonStr === 'object') {
    return jsonStr;
  }

  if (isMissingRequestValue(jsonStr)) {
    return {};
  }
  
  const str = String(jsonStr).trim();
  assertJiraReleaseInfoStringWithinBounds(str);
  let jsonParseError = null;
  
  // 尝试 1: 标准 JSON 解析
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed === 'string') {
      const nested = parsed.trim();
      if (nested && /^[{\[]/.test(nested) && nested !== str) {
        return parseJiraJsonStrict(nested);
      }
    }
    return parsed;
  } catch (e) {
    jsonParseError = e;
    Logger.log(`标准 JSON 解析失败，尝试 Groovy Map 格式: ${e.toString()}`);
  }
  
  // 尝试 2: 处理 Groovy Map 格式 {key=value, key2=value2}
  try {
    const result = parseGroovyMapObject(str);
    
    Logger.log(`Groovy Map 解析成功: ${JSON.stringify(result)}`);
    return result;
    
  } catch (e) {
    const error = new Error(getSafeGroovyParseMessage(e));
    error.diagnosticCode = e.diagnosticCode || 'PARSE_RELEASE_INFO_FAILED';
    error.jsonParseError = jsonParseError ? jsonParseError.toString() : '';
    error.groovyParseError = getSafeGroovyParseMessage(e);
    throw error;
  }
}

function createJiraReleaseInfoParseError(message, diagnosticCode) {
  const error = new Error(message);
  error.diagnosticCode = diagnosticCode;
  return error;
}

function assertJiraReleaseInfoStringWithinBounds(value) {
  if (value.length > JIRA_RELEASE_INFO_MAX_CHARS) {
    throw createJiraReleaseInfoParseError(
      `releaseInfo 超过 ${JIRA_RELEASE_INFO_MAX_CHARS} 字符限制`,
      'RELEASE_INFO_TOO_LARGE'
    );
  }
}

function assertGroovyNestingDepth(depth) {
  if (depth > JIRA_GROOVY_MAX_NESTING_DEPTH) {
    throw createJiraReleaseInfoParseError(
      `Groovy Map 嵌套层级超过 ${JIRA_GROOVY_MAX_NESTING_DEPTH} 层限制`,
      'RELEASE_INFO_TOO_DEEP'
    );
  }
}

function getSafeGroovyParseMessage(error) {
  const rawMessage = error && error.message ? error.message : String(error || '');

  if (rawMessage.indexOf('无法解析 Groovy Map 键值对') !== -1) {
    return 'Groovy Map 中存在无法识别的键值对';
  }

  return rawMessage.substring(0, 180);
}

function getSafeJiraParseErrorMessage(error) {
  if (!error) {
    return '未知解析错误';
  }

  if (error.groovyParseError) {
    return error.groovyParseError;
  }

  return (error.message || String(error)).substring(0, 180);
}

function parseGroovyMapObject(mapText, depth) {
  const currentDepth = depth || 0;
  assertGroovyNestingDepth(currentDepth);

  let content = mapText.trim();
  if (content.startsWith('{') && content.endsWith('}')) {
    content = content.substring(1, content.length - 1);
  }

  if (content.trim() === '') {
    return {};
  }

  const result = {};
  const pairs = splitGroovyMapPairs(content, currentDepth);
  let parsedPairCount = 0;

  for (const pair of pairs) {
    const trimmedPair = pair.trim();
    if (!trimmedPair) continue;

    const equalIndex = findGroovyMapPairSeparator(trimmedPair, currentDepth);
    if (equalIndex === -1) {
      throw new Error(`无法解析 Groovy Map 键值对: ${trimmedPair.substring(0, 120)}`);
    }

    const key = parseGroovyMapKey(trimmedPair.substring(0, equalIndex));
    const value = trimmedPair.substring(equalIndex + 1);
    result[key] = parseGroovyMapValue(value, currentDepth + 1);
    parsedPairCount++;
  }

  if (parsedPairCount === 0) {
    throw new Error('Groovy Map 中没有可解析的键值对');
  }

  return result;
}

function parseGroovyMapKey(keyText) {
  const key = keyText.trim();
  if (isQuotedGroovyString(key)) {
    return parseGroovyQuotedString(key);
  }
  return key;
}

function parseGroovyMapValue(valueText, depth) {
  const currentDepth = depth || 0;
  assertGroovyNestingDepth(currentDepth);

  const value = valueText.trim();

  if (value === '') {
    return '';
  }

  if (value.startsWith('{') && value.endsWith('}')) {
    return parseGroovyMapObject(value, currentDepth);
  }

  if (value.startsWith('[') && value.endsWith(']')) {
    return parseGroovyArray(value, currentDepth);
  }

  if (isQuotedGroovyString(value)) {
    return parseGroovyQuotedString(value);
  }

  if (value === 'null') {
    return null;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  if (/^-?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) {
    return parseFloat(value);
  }

  return value;
}

function parseGroovyArray(arrayText, depth) {
  const currentDepth = depth || 0;
  assertGroovyNestingDepth(currentDepth);

  const content = arrayText.substring(1, arrayText.length - 1).trim();
  if (!content) {
    return [];
  }

  return splitGroovyMapPairs(content, currentDepth).map(function(item) {
    return parseGroovyMapValue(item, currentDepth + 1);
  });
}

function isQuotedGroovyString(value) {
  if (value.length < 2) {
    return false;
  }

  const first = value[0];
  const last = value[value.length - 1];
  return (first === '"' || first === "'") && first === last;
}

function isGroovyQuoteStart(text, index) {
  const char = text[index];
  if (char !== '"' && char !== "'") {
    return false;
  }

  for (let i = index - 1; i >= 0; i--) {
    const previous = text[i];
    if (/\s/.test(previous)) {
      continue;
    }
    return previous === '=' || previous === ',' || previous === '{' || previous === '[';
  }

  return true;
}

function parseGroovyQuotedString(value) {
  const quote = value[0];
  const inner = value.substring(1, value.length - 1);
  let result = '';
  let escaped = false;

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];

    if (escaped) {
      if (char === 'n') {
        result += '\n';
      } else if (char === 'r') {
        result += '\r';
      } else if (char === 't') {
        result += '\t';
      } else if (char === 'b') {
        result += '\b';
      } else if (char === 'f') {
        result += '\f';
      } else if (char === 'u') {
        const hex = inner.substring(i + 1, i + 5);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          result += String.fromCharCode(parseInt(hex, 16));
          i += 4;
        } else {
          result += char;
        }
      } else if (char === quote || char === '\\') {
        result += char;
      } else {
        result += char;
      }
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else {
      result += char;
    }
  }

  if (escaped) {
    result += '\\';
  }

  return result;
}

function findGroovyMapPairSeparator(pairText, depth) {
  const baseDepth = depth || 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let quoteChar = '';
  let escaped = false;

  for (let i = 0; i < pairText.length; i++) {
    const char = pairText[i];

    if (quoteChar) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quoteChar) {
        quoteChar = '';
      }
      continue;
    }

    if (isGroovyQuoteStart(pairText, i)) {
      quoteChar = char;
    } else if (char === '{') {
      braceDepth++;
      assertGroovyNestingDepth(baseDepth + braceDepth + bracketDepth);
    } else if (char === '}') {
      if (braceDepth === 0) {
        throw new Error('Groovy Map 键值对包含多余的 }');
      }
      braceDepth--;
    } else if (char === '[') {
      bracketDepth++;
      assertGroovyNestingDepth(baseDepth + braceDepth + bracketDepth);
    } else if (char === ']') {
      if (bracketDepth === 0) {
        throw new Error('Groovy Map 键值对包含多余的 ]');
      }
      bracketDepth--;
    } else if (char === '=' && braceDepth === 0 && bracketDepth === 0) {
      return i;
    }
  }

  return -1;
}

function getTimelineProjectConfigByParamKey(paramKey) {
  for (const config of TIMELINE_PROJECT_PARAM_MAP) {
    if (config.paramKey === paramKey) {
      return config;
    }
  }
  return null;
}

function getTimelineProjectConfig(projectOrParamKey) {
  for (const config of TIMELINE_PROJECT_PARAM_MAP) {
    if (config.project === projectOrParamKey || config.paramKey === projectOrParamKey) {
      return config;
    }
  }
  return null;
}

function getTimelineProjectCacheKey(paramKey) {
  return TIMELINE_CACHE_KEY_PREFIX + paramKey;
}

function isValidProjectReleaseInfo(projectInfo) {
  return getProjectReleaseInfoSchemaError(projectInfo) === '';
}

function getProjectReleaseInfoSchemaError(projectInfo) {
  if (!projectInfo || typeof projectInfo !== 'object' || Array.isArray(projectInfo)) {
    return 'releaseInfo 必须是非空对象';
  }

  if (!projectInfo.releaseInfo || typeof projectInfo.releaseInfo !== 'object' || Array.isArray(projectInfo.releaseInfo)) {
    return 'releaseInfo 必须是非空对象';
  }

  const milestoneKeys = Object.keys(projectInfo.releaseInfo);
  if (milestoneKeys.length === 0) {
    return 'releaseInfo 必须是非空对象';
  }

  if (getValidTimelineMilestoneKeys(projectInfo.releaseInfo).length === 0) {
    return 'releaseInfo 必须包含至少一个有效日期（MM/DD/YYYY）的 Milestone';
  }

  return '';
}

function getTimelineMilestoneDateText(value) {
  const text = getRequestParameterValue(value).trim();
  if (!text) {
    return '';
  }

  const dateParts = text.split('/');
  if (dateParts.length !== 3) {
    return '';
  }

  if (!/^\d{1,2}$/.test(dateParts[0]) || !/^\d{1,2}$/.test(dateParts[1]) || !/^\d{4}$/.test(dateParts[2])) {
    return '';
  }

  const month = parseInt(dateParts[0], 10);
  const day = parseInt(dateParts[1], 10);
  const year = parseInt(dateParts[2], 10);

  if (!isFinite(month) || !isFinite(day) || !isFinite(year)) {
    return '';
  }

  const parsedDate = new Date(year, month - 1, day);
  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return '';
  }

  return text;
}

function getValidTimelineMilestoneKeys(releaseInfoMap) {
  if (!releaseInfoMap || typeof releaseInfoMap !== 'object' || Array.isArray(releaseInfoMap)) {
    return [];
  }

  return Object.keys(releaseInfoMap).filter(function(key) {
    const milestoneKey = getRequestParameterValue(key).trim();
    return milestoneKey && getTimelineMilestoneDateText(releaseInfoMap[key]);
  });
}

function parseSingleProjectReleaseInfo(rawValue) {
  const result = parseSingleProjectReleaseInfoForCache(rawValue);
  return result.success ? result.projectInfo : null;
}

function parseSingleProjectReleaseInfoForCache(rawValue) {
  if (isMissingRequestValue(rawValue)) {
    return {
      success: false,
      errorCode: 'MISSING_RELEASE_INFO',
      parseError: 'releaseInfo 参数为空'
    };
  }

  try {
    const parsed = parseJiraJsonStrict(rawValue);
    const schemaError = getProjectReleaseInfoSchemaError(parsed);
    if (!schemaError) {
      return {
        success: true,
        projectInfo: parsed
      };
    }

    const parsedKeys = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.keys(parsed).slice(0, 8)
      : [];

    return {
      success: false,
      errorCode: 'INVALID_RELEASE_INFO_SCHEMA',
      parseError: parsedKeys.length
        ? `${schemaError}；当前顶层字段: ${parsedKeys.join(', ')}`
        : schemaError
    };
  } catch (error) {
    Logger.log(`[cacheReleaseInfo] 解析单项目 releaseInfo 失败: ${error.toString()}`);
    return {
      success: false,
      errorCode: error.diagnosticCode || 'PARSE_RELEASE_INFO_FAILED',
      parseError: getSafeJiraParseErrorMessage(error)
    };
  }
}

function getRequestParameterValue(value) {
  if (isMissingRequestValue(value)) {
    return '';
  }

  // Apps Script 已经把 e.parameter 解码过；再次 decode 会在 "100% done"
  // 这类原文百分号上抛错，也可能误改用户原文里的 "%2F"。
  return value.toString();
}

function isMissingRequestValue(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function getUtf8ByteLength(value) {
  const text = String(value || '');
  let bytes = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const nextCode = text.charCodeAt(i + 1);
      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        bytes += 4;
        i++;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }

  return bytes;
}

function readLegacyReleaseInfoCache() {
  try {
    const props = PropertiesService.getScriptProperties();
    const cached = props.getProperty(LEGACY_RELEASE_INFO_CACHE_KEY);
    if (!cached) {
      return null;
    }

    const cachedData = JSON.parse(cached);
    const ageMs = new Date().getTime() - (cachedData.timestamp || 0);
    if (ageMs > TIMELINE_CACHE_MAX_AGE_MS) {
      Logger.log(`[GET] 旧版缓存已过期 (${Math.round(ageMs / 1000)}秒)，不使用`);
      return null;
    }

    return cachedData.releaseInfo || null;
  } catch (error) {
    Logger.log(`[GET] 读取旧版缓存失败: ${error.toString()}`);
    return null;
  }
}

function readReleaseInfoFromCache() {
  const props = PropertiesService.getScriptProperties();
  let releaseInfo = null;

  for (const config of TIMELINE_PROJECT_PARAM_MAP) {
    try {
      const raw = props.getProperty(getTimelineProjectCacheKey(config.paramKey));
      if (!raw) {
        continue;
      }

      const cachedData = JSON.parse(raw);
      const ageMs = new Date().getTime() - (cachedData.timestamp || 0);
      if (ageMs > TIMELINE_CACHE_MAX_AGE_MS) {
        Logger.log(`[GET] 项目 ${config.project} 缓存已过期 (${Math.round(ageMs / 1000)}秒)，跳过`);
        continue;
      }

      if (!isValidProjectReleaseInfo(cachedData.releaseInfo)) {
        Logger.log(`[GET] 项目 ${config.project} 缓存格式异常，跳过`);
        continue;
      }

      if (!releaseInfo) {
        releaseInfo = {};
      }

      releaseInfo[config.project] = cachedData.releaseInfo;
    } catch (error) {
      Logger.log(`[GET] 读取项目 ${config.project} 缓存失败: ${error.toString()}`);
    }
  }

  if (releaseInfo && Object.keys(releaseInfo).length > 0) {
    return releaseInfo;
  }

  return readLegacyReleaseInfoCache();
}

function readTimelineSyncAttempt(props, paramKey, nowMs) {
  const raw = props.getProperty(getTimelineSyncAttemptKey(paramKey));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const timestamp = Number(parsed.timestamp || Date.parse(parsed.attemptedAt || ''));
    const hasTimestamp = !isNaN(timestamp) && timestamp > 0;
    const attempt = {
      success: parsed.success === true,
      attemptedAt: parsed.attemptedAt || (hasTimestamp ? new Date(timestamp).toISOString() : ''),
      ageMs: hasTimestamp ? Math.max(0, nowMs - timestamp) : null
    };

    const errorCode = truncateTimelineSyncDiagnostic(parsed.errorCode, 80);
    const error = truncateTimelineSyncDiagnostic(parsed.error, TIMELINE_SYNC_ATTEMPT_ERROR_MAX_CHARS);
    const parseError = truncateTimelineSyncDiagnostic(parsed.parseError, TIMELINE_SYNC_ATTEMPT_ERROR_MAX_CHARS);
    const requestContentType = truncateTimelineSyncDiagnostic(parsed.requestContentType, 120);
    const nextAction = truncateTimelineSyncDiagnostic(parsed.nextAction, TIMELINE_SYNC_ATTEMPT_ERROR_MAX_CHARS);
    const requestId = truncateTimelineSyncDiagnostic(parsed.requestId, 120);

    if (requestId) {
      attempt.requestId = requestId;
    }
    if (errorCode) {
      attempt.errorCode = errorCode;
    }
    if (error) {
      attempt.error = error;
    }
    if (parseError) {
      attempt.parseError = parseError;
    }
    if (requestContentType) {
      attempt.requestContentType = requestContentType;
    }
    if (nextAction) {
      attempt.nextAction = nextAction;
    }
    if (typeof parsed.requestBodyBytes === 'number' && isFinite(parsed.requestBodyBytes)) {
      attempt.requestBodyBytes = parsed.requestBodyBytes;
    }
    if (typeof parsed.payloadBytes === 'number' && isFinite(parsed.payloadBytes)) {
      attempt.payloadBytes = parsed.payloadBytes;
    }
    if (typeof parsed.maxBytes === 'number' && isFinite(parsed.maxBytes)) {
      attempt.maxBytes = parsed.maxBytes;
    }
    if (typeof parsed.milestoneCount === 'number' && isFinite(parsed.milestoneCount)) {
      attempt.milestoneCount = parsed.milestoneCount;
    }
    if (Array.isArray(parsed.milestoneKeys)) {
      attempt.milestoneKeys = parsed.milestoneKeys
        .map(function(key) { return getRequestParameterValue(key).trim(); })
        .filter(function(key) { return key; })
        .slice(0, 20);
    }

    return attempt;
  } catch (error) {
    Logger.log(`[getTimelineCacheStatus] 读取项目 ${paramKey} 最近同步尝试失败: ${error.toString()}`);
    return null;
  }
}

function attachTimelineSyncAttempt(status, lastAttempt) {
  if (lastAttempt) {
    status.lastAttempt = lastAttempt;
  }
  return status;
}

function getTimelineSyncAttemptError(lastAttempt) {
  if (!lastAttempt || lastAttempt.success !== false) {
    return '';
  }

  return lastAttempt.parseError || lastAttempt.error || lastAttempt.errorCode || 'Timeline Sync 最近一次写入失败';
}

function getTimelineCacheStatus() {
  const props = PropertiesService.getScriptProperties();
  const nowMs = new Date().getTime();
  const generatedAt = new Date(nowMs).toISOString();

  const projects = TIMELINE_PROJECT_PARAM_MAP.map(function(config) {
    const cacheKey = getTimelineProjectCacheKey(config.paramKey);
    const lastAttempt = readTimelineSyncAttempt(props, config.paramKey, nowMs);
    const baseStatus = {
      project: config.project,
      paramKey: config.paramKey,
      cached: false,
      valid: false,
      expired: false,
      status: 'missing'
    };

    try {
      const raw = props.getProperty(cacheKey);
      if (!raw) {
        const lastAttemptError = getTimelineSyncAttemptError(lastAttempt);
        if (lastAttemptError) {
          return attachTimelineSyncAttempt(Object.assign({}, baseStatus, {
            status: 'error',
            error: lastAttemptError
          }), lastAttempt);
        }
        return attachTimelineSyncAttempt(baseStatus, lastAttempt);
      }

      const cachedData = JSON.parse(raw);
      const timestamp = Number(cachedData.timestamp || Date.parse(cachedData.updatedAt || ''));
      const hasTimestamp = !isNaN(timestamp) && timestamp > 0;
      const ageMs = hasTimestamp ? Math.max(0, nowMs - timestamp) : null;
      const expired = ageMs === null || ageMs > TIMELINE_CACHE_MAX_AGE_MS;
      const valid = isValidProjectReleaseInfo(cachedData.releaseInfo);
      const milestoneKeys = valid ? getValidTimelineMilestoneKeys(cachedData.releaseInfo.releaseInfo) : [];
      const status = !valid ? 'invalid' : expired ? 'expired' : 'ready';
      const lastAttemptError = status === 'ready' ? '' : getTimelineSyncAttemptError(lastAttempt);

      return attachTimelineSyncAttempt({
        project: config.project,
        paramKey: config.paramKey,
        cached: true,
        valid: valid,
        expired: expired,
        status: lastAttemptError ? 'error' : status,
        error: lastAttemptError || '',
        updatedAt: cachedData.updatedAt || (hasTimestamp ? new Date(timestamp).toISOString() : ''),
        ageMs: ageMs,
        expiresAt: hasTimestamp ? new Date(timestamp + TIMELINE_CACHE_MAX_AGE_MS).toISOString() : '',
        milestoneKeys: milestoneKeys
      }, lastAttempt);
    } catch (error) {
      Logger.log(`[getTimelineCacheStatus] 读取项目 ${config.project} 缓存失败: ${error.toString()}`);
      return attachTimelineSyncAttempt(Object.assign({}, baseStatus, {
        cached: true,
        status: 'error',
        error: error.toString()
      }), lastAttempt);
    }
  });

  const readyProjects = projects.filter(function(item) {
    return item.status === 'ready';
  }).length;
  const missingProjects = projects.filter(function(item) {
    return item.status === 'missing';
  }).length;
  const staleProjects = projects.filter(function(item) {
    return item.status === 'expired' || item.status === 'invalid' || item.status === 'error';
  }).length;

  return {
    success: true,
    generatedAt: generatedAt,
    maxAgeMs: TIMELINE_CACHE_MAX_AGE_MS,
    totalProjects: projects.length,
    readyProjects: readyProjects,
    missingProjects: missingProjects,
    staleProjects: staleProjects,
    allProjectsReady: readyProjects === projects.length,
    projects: projects
  };
}

function extractReleaseInfoFromParameters(parameters) {
  const releaseInfoParam = parameters.releaseInfo || '';
  
  if (releaseInfoParam) {
    try {
      const parsedReleaseInfo = parseJiraJson(releaseInfoParam);
      if (parsedReleaseInfo && Object.keys(parsedReleaseInfo).length > 0) {
        return parsedReleaseInfo;
      }
    } catch (error) {
      Logger.log(`[GET] 解析 releaseInfo 参数失败: ${error.toString()}`);
    }
  }
  
  let releaseInfo = null;
  
  try {
    for (const config of TIMELINE_PROJECT_PARAM_MAP) {
      const rawValue = parameters[config.paramKey] || '';
      if (!rawValue) {
        continue;
      }
      
      if (!releaseInfo) {
        releaseInfo = {};
      }
      
      releaseInfo[config.project] = parseJiraJson(rawValue);
    }
  } catch (parseError) {
    Logger.log(`[GET] 解析项目 releaseInfo 失败: ${parseError.toString()}`);
    return null;
  }
  
  return releaseInfo;
}

/**
 * 分割 Groovy Map 的键值对（处理嵌套情况）
 * 例如：key1=value1, key2={nested=value}, key3=value3
 * @param {string} content - Map 内容（不含外层大括号）
 * @returns {array} 键值对数组
 */
function splitGroovyMapPairs(content, depth) {
  const baseDepth = depth || 0;
  const pairs = [];
  let currentPair = '';
  let braceDepth = 0;
  let bracketDepth = 0;
  let quoteChar = '';
  let escaped = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (quoteChar) {
      currentPair += char;

      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quoteChar) {
        quoteChar = '';
      }
    } else if (isGroovyQuoteStart(content, i)) {
      quoteChar = char;
      currentPair += char;
    } else if (char === '{') {
      braceDepth++;
      assertGroovyNestingDepth(baseDepth + braceDepth + bracketDepth);
      currentPair += char;
    } else if (char === '}') {
      if (braceDepth === 0) {
        throw new Error('Groovy Map 包含多余的 }');
      }
      braceDepth--;
      currentPair += char;
    } else if (char === '[') {
      bracketDepth++;
      assertGroovyNestingDepth(baseDepth + braceDepth + bracketDepth);
      currentPair += char;
    } else if (char === ']') {
      if (bracketDepth === 0) {
        throw new Error('Groovy Map 包含多余的 ]');
      }
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

  if (quoteChar) {
    throw new Error('Groovy Map 包含未闭合的字符串');
  }

  if (braceDepth !== 0 || bracketDepth !== 0) {
    throw new Error('Groovy Map 包含未闭合的嵌套结构');
  }
  
  return pairs;
}
