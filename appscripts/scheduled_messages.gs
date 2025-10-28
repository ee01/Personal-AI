// 自动发送当天的话题
function sendTodayTopics() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('By date');
    const datesRange = sheet.getRange(2, 1, 100, 10).getValues(); // 从第2行开始，假设第1行是标题
    
    var todayTopics = [];
    var todayEmails = [];
    var todayLecturers = [];
    
    // 获取今天的日期（只考虑年月日，忽略时间）
    const today = new Date();
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    for (var i = 0; i < datesRange.length; i++) {
        var row = datesRange[i];
        // 跳过空行
        if (!row[0] || !row[1]) continue;
        
        // 获取表格中的日期（B列），只考虑年月日
        var cellDate = new Date(row[0]);
        var cellDateOnly = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());
        
        // 检查是否是今天
        if (cellDateOnly.getTime() === todayDateOnly.getTime()) {
            var todayTopic = {
              row: i+2,
              date: row[0],        // A列：日期  
              topic: row[1],       // B列：主题
              content: row[2],     // C列：内容
              attachmentFile: row[3],   // D列：Attachment file name
              glipTeamId: row[4],  // E列：Glip team ID
            };
            
            todayTopics.push(todayTopic);
        }
    }
    
    // 如果找到今天的分享
    if (todayTopics.length > 0) {
        for (var j = 0; j < todayTopics.length; j++) {
            var topic = todayTopics[j];
            var attachments = [];
            
            // 尝试获取poster文件作为附件
            if (topic.attachmentFile) {
                try {
                    var attachmentFile = DriveApp.getFilesByName(topic.attachmentFile).next();
                    attachments.push(attachmentFile.getAs(MimeType.PNG));
                } catch (e) {
                    console.log('无法找到文件: ' + topic.attachmentFile);
                    sheet.getRange(topic.row, 6).setValue('无法找到文件，终止推送！')
                    throw new Error('终止推送！');
                }
            }

            // 发送邮件
            var emailContent = topic.content.replaceAll("\n", '<br />');
            
            MailApp.sendEmail({
                to: topic.glipTeamId + '@reply.ringcentral.glip.com',
                // bcc: 'esone.qiu@ringcentral.com',
                subject: `Sheet 推送提醒 - ${topic.topic}`,
                htmlBody: emailContent,
                attachments: attachments
            });
            
            // 发送bot文本消息，内网不可用
            // var textMessage = `Hi ${topic.name}!\n\n` +
            //     `今天是您的分享日！\n\n` +
            //     `**互动话题：** ${topic.topic || '暂无话题'}\n\n` +
            //     `请准备好您的分享内容，期待您的精彩演讲！\n\n` +
            //     `日期：${Utilities.formatDate(new Date(topic.date), Session.getScriptTimeZone(), 'yyyy-MM-dd')}\n\n` +
            //     `Thanks,\nπ 组织`;
            
            // _sendBotTextMessage(textMessage, topic.name);
            
            // // 如果有poster文件，发送bot图片消息
            // if (attachments.length > 0) {
            //     _sendBotImageMessage(topic.attachmentFile);
            // }

            Logger.log('推送成功: ' + topic.topic);
            Logger.log(topic);
            sheet.getRange(topic.row, 6).setValue('推送成功: ' + topic.glipTeamId)
        }
    }
}

// 自动推送当前时刻的话题
function sendCurrentTimeTopics() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('By time');
    const timesRange = sheet.getRange(2, 1, 100, 10).getValues(); // 从第2行开始，假设第1行是标题
    
    var currentTimeTopics = [];
    var currentTimeEmails = [];
    var currentTimeLecturers = [];
    
    // 获取当前的时间（精确到分钟，忽略秒）
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    for (var i = 0; i < timesRange.length; i++) {
        var row = timesRange[i];
        // 跳过空行
        if (!row[0] || !row[1]) continue;
        
        // 获取表格中的时间（A列）
        var cellTime = new Date(row[0]);
        var cellHour = cellTime.getHours();
        var cellMinute = cellTime.getMinutes();
        
        // 检查是否是当前时间（精确到分钟）
        if (cellHour === currentHour && cellMinute === currentMinute) {
            var currentTimeTopic = {
              row: i+2,
              time: row[0],        // A列：时间  
              topic: row[1],       // B列：主题
              content: row[2],     // C列：内容
              attachmentFile: row[3],   // D列：Attachment file name
              glipTeamId: row[4],  // E列：Glip team ID
            };
            
            currentTimeTopics.push(currentTimeTopic);
        }
    }
    
    // 如果找到当前时间的分享
    if (currentTimeTopics.length > 0) {
        for (var j = 0; j < currentTimeTopics.length; j++) {
            var topic = currentTimeTopics[j];
            var attachments = [];
            
            // 尝试获取poster文件作为附件
            if (topic.attachmentFile) {
                try {
                    var attachmentFile = DriveApp.getFilesByName(topic.attachmentFile).next();
                    attachments.push(attachmentFile.getAs(MimeType.PNG));
                } catch (e) {
                    console.log('无法找到文件: ' + topic.attachmentFile);
                    sheet.getRange(topic.row, 6).setValue('无法找到文件，终止推送！')
                    throw new Error('终止推送！');
                }
            }

            // 发送邮件
            var emailContent = topic.content.replaceAll("\n", '<br />');
            
            MailApp.sendEmail({
                to: topic.glipTeamId + '@reply.ringcentral.glip.com',
                // bcc: 'esone.qiu@ringcentral.com',
                subject: `定时推送提醒 - ${topic.topic}`,
                htmlBody: emailContent,
                attachments: attachments
            });
            
            // 发送bot文本消息，内网不可用
            // var textMessage = `Hi there!\n\n` +
            //     `定时提醒时间到了！\n\n` +
            //     `**互动话题：** ${topic.topic || '暂无话题'}\n\n` +
            //     `请查看推送内容。\n\n` +
            //     `时间：${Utilities.formatDate(new Date(topic.time), Session.getScriptTimeZone(), 'HH:mm')}\n\n` +
            //     `Thanks,\nπ 组织`;
            
            // _sendBotTextMessage(textMessage, topic.name);
            
            // // 如果有poster文件，发送bot图片消息
            // if (attachments.length > 0) {
            //     _sendBotImageMessage(topic.attachmentFile);
            // }

            Logger.log('推送成功: ' + topic.topic);
            Logger.log(topic);
            sheet.getRange(topic.row, 6).setValue('推送成功: ' + topic.glipTeamId + ' at ' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm'))
        }
    } else {
        Logger.log('当前时间 ' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm') + ' 没有找到对应的推送任务');
    }
}

// 自动定期推送消息
function sendRecurringTopics() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetRecurring = ss.getSheetByName('Recurring');
  const recurring = sheetRecurring.getRange(2, 1, 100, 10).getValues();
  
  for (var i = 0; i < recurring.length; i++) {
    var row = recurring[i];
    // 跳过空行
    if (!row[0] || !row[1]) continue; // Topic 和 Date 必须有值
    
    const today = new Date();
    const theday = new Date(row[1]); // Date 列 (B列)
    const endDate = row[2] ? new Date(row[2]) : null; // End Date 列 (C列)
    const every = row[3] || 1; // Every 列 (D列)
    const repeat = row[4]; // Repeat 列 (E列)
    const owner = row[5]; // Owner 列 (F列)
    const glipTeamID = row[6] + ""; // Glip Push 列 (G列)
    const glipMsg = row[7]; // Glip Msg 列 (H列)
    
    // 基本验证
    if (!glipTeamID) continue;
    if (theday.toDateString() == 'Invalid Date') continue;
    
    // 检查是否已经过了结束日期
    if (endDate && today > endDate) continue;
    
    // 计算与开始日期的天数差
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startDateOnly = new Date(theday.getFullYear(), theday.getMonth(), theday.getDate());
    const daysToStart = Math.floor((todayDateOnly - startDateOnly) / (1000 * 60 * 60 * 24));
    
    var shouldSend = false;
    
    if (repeat == 'Day') {
      // 每 N 天推送一次，排除周末
      if (daysToStart >= 0 && daysToStart % every == 0) {
        if (today.getDay() >= 1 && today.getDay() <= 5) { // 周一到周五
          shouldSend = true;
        }
      }
      
    } else if (repeat == 'Week') {
      // 每 N 周推送一次
      if (daysToStart >= 0 && daysToStart % (7 * every) == 0) {
        shouldSend = true;
      }
      
    } else if (repeat == 'Month') {
      // 每 N 个月推送一次（同一天）
      if (today.getDate() == theday.getDate()) {
        const monthsDiff = (today.getFullYear() - theday.getFullYear()) * 12 + (today.getMonth() - theday.getMonth());
        if (monthsDiff >= 0 && monthsDiff % every == 0) {
          shouldSend = true;
        }
      }
      
    } else if (repeat == 'Year') {
      // 每 N 年推送一次（同一天）
      if (today.getDate() == theday.getDate() && today.getMonth() == theday.getMonth()) {
        const yearsDiff = today.getFullYear() - theday.getFullYear();
        if (yearsDiff >= 0 && yearsDiff % every == 0) {
          shouldSend = true;
        }
      }
      
    } else {
      // 一次性推送（只在指定日期）
      if (daysToStart == 0) {
        shouldSend = true;
      }
    }
    
    if (shouldSend) {
      Logger.log("定期推送提醒: " + row[0]); // Topic
      
      // 准备邮件内容
      const emailContent = glipMsg || `定期推送提醒：${row[0]}`;
      const to = glipTeamID.split(',').reduce((t,n) => t.trim()+"+"+n.trim()) + "@reply.ringcentral.glip.com";
      
      // 发送邮件
      MailApp.sendEmail({
        to: to,
        // bcc: 'esone.qiu@ringcentral.com',
        subject: `定期推送提醒 - ${row[0]}`,
        htmlBody: emailContent.replaceAll("\n", '<br />'),
        attachments: []
      });
      
      Logger.log('推送成功: ' + row[0]);
      // 在状态列记录推送结果
      sheetRecurring.getRange(i + 2, 9).setValue('上次推送成功: ' + Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'));
    }
  }
}


// 发送bot文本消息
function _sendBotTextMessage(message, mentionName) {
    var url = 'https://botman.int.rclabenv.com/v2/team/message';
    
    var payload = {
        "mentionList": [mentionName],
        "isTeamMention": false,
        "teamId": "148192141318",     // 需要替换为实际的团队ID
        "message": message,
        "skipMentionCheck": false,
        "mentionAutoCorrect": true,
        "attachments": []
    };
    
    var options = {
        'method': 'POST',
        'headers': {
            'accept': '*/*',
            'Content-Type': 'application/json'
        },
        'payload': JSON.stringify(payload)
    };
    
    try {
        var response = UrlFetchApp.fetch(url, options);
        console.log('文本消息发送成功: ' + response.getContentText());
    } catch (e) {
        console.log('文本消息发送失败: ' + e.toString());
    }
}

// 发送bot图片消息
function _sendBotImageMessage(fileName) {
    if (!fileName) return;
    
    try {
        // 从Google Drive获取文件
        var file = DriveApp.getFilesByName(fileName).next();
        var fileBlob = file.getBlob();
        
        var url = 'https://botman.int.rclabenv.com/v2/team/message/file';
        
        var payload = {
            'file': fileBlob,
            'teamId': '148192141318' // 需要替换为实际的团队ID
        };
        
        var options = {
            'method': 'POST',
            'headers': {
                'Authorization': 'Bearer myToken' // 需要替换为实际的token
            },
            'payload': payload
        };
        
        var response = UrlFetchApp.fetch(url, options);
        console.log('图片消息发送成功: ' + response.getContentText());
    } catch (e) {
        console.log('图片消息发送失败: ' + e.toString());
    }
}

// 辅助函数：根据姓名生成email（保留原函数以备后用）
function _generateEmailFromName(name) {
    // 这里您需要根据实际的email格式来实现
    // 例如：如果姓名是 "Zhang San"，email可能是 "zhang.san@company.com"
    // 这只是一个示例，您需要根据实际情况修改
    if (!name) return null;
    
    // 假设email格式是 firstname.lastname@ringcentral.com
    var nameParts = name.trim().split(' ');
    if (nameParts.length >= 2) {
        return nameParts[0].toLowerCase() + '.' + nameParts[1].toLowerCase() + '@ringcentral.com';
    } else {
        return nameParts[0].toLowerCase() + '@ringcentral.com';
    }
}