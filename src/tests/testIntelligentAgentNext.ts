/**
 * 智能Agent系统测试模块
 * 用于测试新的通用分析框架
 */

import { intelligentAgentNext, processMessageCompatible } from '../IntelligentAgentNext';
import { AnalysisConfig, AnalysisContext, MessageAnalysisResult } from '../interfaces/analysisInterfaces';

/**
 * 测试消息分析功能
 */
async function testMessageAnalysis() {
  console.log('=== 测试消息分析功能 ===');
  
  // 测试消息
  const testMessage = {
    message_content: '团队会议通知：明天上午10点在会议室A进行项目Alpha的进度讨论，请所有开发人员参加。',
    sender: '张经理',
    team_name: '产品开发组',
    team_id: 'dev-team-01',
    datetime: new Date().toISOString()
  };
  
  // 分析配置
  const config: AnalysisConfig = {
    type: 'message',
    analysisDepth: 'normal',
    maxActions: 3
  };
  
  // 上下文信息
  const context: AnalysisContext = {
    currentUser: '王工程师',
    concernedRules: [
      '含有会议信息的消息',
      '提到项目Alpha的消息'
    ]
  };
  
  try {
    console.log('开始分析消息...');
    console.log('输入消息:', testMessage);
    
    // 调用分析方法
    const result = await intelligentAgentNext.analyze(testMessage, config, context);
    
    console.log('分析结果:', JSON.stringify(result, null, 2));
    
    // 转换为兼容格式
    const compatibleResult = intelligentAgentNext.convertToOldFormat(result as MessageAnalysisResult);
    
    console.log('兼容格式结果:', JSON.stringify(compatibleResult, null, 2));
    
    return result;
  } catch (error) {
    console.error('测试消息分析失败:', error);
    throw error;
  }
}

/**
 * 测试兼容性处理函数
 */
async function testCompatibleProcessing() {
  console.log('\n=== 测试兼容层处理函数 ===');
  
  // 测试消息组
  const testInput = {
    username: '李用户',
    concernedItems: [
      { text: '紧急任务' },
      { text: '项目延期' }
    ],
    messageGroups: [
      {
        groupId: 'group-01',
        groupName: '项目A组',
        posts: [
          {
            content: '紧急！项目A的部署需要今天完成，谁能负责一下？',
            sender: '张经理',
            timestamp: Date.now()
          }
        ]
      }
    ]
  };
  
  try {
    console.log('开始处理兼容格式消息...');
    console.log('输入数据:', JSON.stringify(testInput, null, 2));
    
    // 调用兼容性处理函数
    const result = await processMessageCompatible(testInput, (progress) => {
      console.log('处理进度:', progress.length);
    });
    
    console.log('处理结果:', JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error('测试兼容层处理失败:', error);
    throw error;
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  try {
    // 测试消息分析
    await testMessageAnalysis();
    
    // 测试兼容处理
    await testCompatibleProcessing();
    
    console.log('\n所有测试完成！');
  } catch (error) {
    console.error('测试执行失败:', error);
  }
}

// 运行测试
if (require.main === module) {
  runTests();
}

export { runTests, testMessageAnalysis, testCompatibleProcessing }; 