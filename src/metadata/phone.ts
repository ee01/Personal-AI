import { getIndexedDBData } from '../storage';
import { formatDate } from '../utils';

function fetchAllPhoneData(enableSms: boolean, enableVoicemail: boolean, enableCallTranscript: boolean) {
    const promises = [];
    if (enableSms) {
      promises.push(getIndexedDBData('SMS', 'sms'));
    }
    if (enableVoicemail) {
      promises.push(getIndexedDBData('Voicemail', 'voicemail'));
    }
    if (enableCallTranscript) {
      promises.push(getIndexedDBData('CaptionsTranscripts', 'callTranscript'));
      promises.push(getIndexedDBData('CallLog', 'callLog'));
    }
  
    return Promise.all(promises)
      .then(results => {
        const [sms, voicemail, callTranscript, callLog] = [
          enableSms ? results.shift() : [],
          enableVoicemail ? results.shift() : [],
          enableCallTranscript ? results.shift() : [],
          enableCallTranscript ? results.shift() : []
        ];
  
        return {
          sms,
          voicemail,
          callTranscript,
          callLog
        };
      })
      .catch(error => {
        console.log("Error fetchAllPhoneData:", error);
        throw error;
      });
}

const transformSMS = (input: any[]) => {
    return input.map(item => ({
      id: item.id.toString(), // 将ID转换为字符串形式
      conversationId: item.conversationId, // 会话ID
      type: "sms", // 确保类型为小写
      text: item.subject || '', // 如果没有主题，则使用空字符串
      from: item.from ? (item.from.name || item.from.phoneNumber) : 'unknown', // 如果没有用户名，设置为'unknown'
      to: item.to ? item.to.map((recipient: { name: any; phoneNumber: any; }) => recipient.name || recipient.phoneNumber || 'unknown  ') : ['unknown'], // 如果没有用户名，设置为'unknown'
      readStatus: item.readStatus, // 读取状态, 已读未读
      // @ts-ignore
      time: formatDate(new Date(item.__timestamp)), // 使用输入中的时间戳
    })).filter(item => item.text !== '');
};

function transformSMSData2Group(data: any[]) {
    const groupedData = data.reduce((acc, item) => {
      if (!acc[item.conversationId]) {
        acc[item.conversationId] = {
          id: item.conversationId,
          text: '',
          type: 'sms',
          postNum: 0,
          to: item.to,
          time: '' // 初始化 time 字段
        };
      }

      acc[item.conversationId].text += `[id:${item.id}][${item.time}][${item.from}]: ${item.text}\n`;
      acc[item.conversationId].postNum += 1;
      acc[item.conversationId].time = item.time; // 更新 time 为当前项的时间
      return acc;
    }, {});
  
  
    return Object.values(groupedData);
};

const transformVoicemail = (input: any[]) => {
    return input.map(item => ({
      id: item.id.toString(), // 将ID转换为字符串形式
      type: "voicemail", // 确保类型为小写
      text: item.transcription || '', // 如果没有主题，则使用空字符串
      from: item.from ? (item.from.name || item.from.phoneNumber) : 'unknown', // 如果没有用户名，设置为'unknown'
      // @ts-ignore
      time: formatDate(new Date(item.__timestamp)), // 使用输入中的时间戳
    })).filter(item => item.text !== '');
};

function transformVMData2Group(data: any[]) {
    const groupedData = data.reduce((acc, item) => {
      if (!acc[item.from]) {
        acc[item.from] = {
          id: 'vm-' + item.id,
          text: '',
          type: 'voicemail',
          postNum: 0,
          time: '' // 初始化 time 字段
        };
      }

      acc[item.from].text += `[id:${item.id}][${item.time}][${item.from}]: ${item.text}\n`;
      acc[item.from].postNum += 1;
      acc[item.from].time = item.time; // 更新 time 为当前项的时间
      return acc;
    }, {});
  
  
    return Object.values(groupedData);
};

const transformCall = (transcripts: any[], callLog: any[]) => {
    // 按 telephonySessionId 分组 transcripts
    const groupedTranscripts = transcripts.reduce((acc, curr) => {
      if (!acc[curr.telephonySessionId]) {
        acc[curr.telephonySessionId] = [];
      }
      acc[curr.telephonySessionId].push(curr);
      return acc;
    }, {});
  
    // 按 telephonySessionId 分组 callLog
    const groupedLogs = callLog.reduce((acc, curr) => {
      if (!acc[curr.telephonySessionId]) {
        acc[curr.telephonySessionId] = [];
      }
      acc[curr.telephonySessionId].push(curr);
      return acc;
    }, {});
  
    // 转换数据
    const transformedData = Object.entries(groupedTranscripts).map(([sessionId, sessionTranscripts]: any) => {
      // 按时间排序
      // @ts-ignore
      sessionTranscripts.sort((a, b) => a.startTimeMs - b.startTimeMs);
  
      const transcriptsText = transcripts
      .filter(t => !t.text.includes('transcription on'))
      // @ts-ignore
      .map(t => `[${formatDate(new Date(t.startTimeMs))}][${t.participant.name}]: ${t.text}`).join('\n');
  
      const text = `id:${sessionId}\n\n ${transcriptsText}`;
  
      // 使用最后一个记录的时间作为endTime
      // @ts-ignore
      const endTime = formatDate(new Date(sessionTranscripts[sessionTranscripts.length - 1].startTimeMs));
  
      // 查找对应的 log 信息
      const sessionLog = groupedLogs[sessionId] ? groupedLogs[sessionId][0] : {};
  
      return {
        id: sessionId,
        type: 'callTranscript',
        text: text,
        time: endTime,
        from: sessionLog.from ? sessionLog.from.name : 'unknown',
      };
    });
  
    return transformedData;
};

export const transformPhone = (startTime: number, enableSms: boolean, enableVoicemail: boolean, enableCallTranscript: boolean) => {
    return fetchAllPhoneData(enableSms,enableVoicemail,enableCallTranscript).then((inputData) => {
      const sms = transformSMS(inputData.sms).filter(item => new Date(item.time) >= new Date(startTime));
      const smsGroup = transformSMSData2Group(sms);
  
      const voicemail = transformVoicemail(inputData.voicemail).filter(item => new Date(item.time) >= new Date(startTime));
      const voicemailGroup = transformVMData2Group(voicemail);
  
      const callTranscript = transformCall(inputData.callTranscript, inputData.callLog).filter(item => new Date(item.time) >= new Date(startTime));
  
      return smsGroup.concat(voicemailGroup).concat(callTranscript);
    });
  }