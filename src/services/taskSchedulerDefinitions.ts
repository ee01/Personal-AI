export interface TaskSchedulerDefinition {
  id: string;
  name: string;
  category: 'message_analysis' | 'data_sync' | 'system_maintenance' | 'user_profile';
  intervalMinutes: number;
  description: string;
  enabled: boolean;
}

// 预定义的任务配置
export const TASK_DEFINITIONS: TaskSchedulerDefinition[] = [
  {
    id: 'message_analysis',
    name: '静默消息分析',
    category: 'message_analysis',
    intervalMinutes: 30, // 默认30分钟间隔（实际值从 envConfig.MESSAGE_ANALYSIS_INTERVAL 读取）
    description: '自动分析RingCentral消息，提取关键信息',
    enabled: false
  },
  {
    id: 'memory_sync',
    name: '记忆系统同步',
    category: 'data_sync',
    intervalMinutes: 5, // 5分钟间隔
    description: '同步本地和云端记忆数据',
    enabled: true
  },
  {
    id: 'system_monitoring',
    name: '系统健康监控',
    category: 'system_maintenance',
    intervalMinutes: 60, // 1小时间隔
    description: '执行系统健康检查和自动维护',
    enabled: true
  },
  {
    id: 'user_profile_decay',
    name: '用户画像权重衰变',
    category: 'user_profile',
    intervalMinutes: 1440, // 24小时间隔
    description: '执行用户画像权重的自然衰变',
    enabled: true
  },
  {
    id: 'vectorized_data_maintenance',
    name: '向量化数据维护',
    category: 'user_profile',
    intervalMinutes: 720, // 12小时间隔
    description: '清理过期向量记录，更新嵌入向量，生成用户概要',
    enabled: true
  },
  {
    id: 'user_summary_generation',
    name: '用户概要生成',
    category: 'user_profile',
    intervalMinutes: 10080, // 7天间隔
    description: '定期生成和更新用户行为概要记录',
    enabled: true
  },
  {
    id: 'vector_quality_check',
    name: '向量质量检查',
    category: 'system_maintenance',
    intervalMinutes: 4320, // 3天间隔
    description: '检查向量数据质量，修复异常记录',
    enabled: true
  },
  {
    id: 'digest_queue_process',
    name: '汇总推送队列处理',
    category: 'data_sync',
    intervalMinutes: 60, // 每小时检查一次
    description: '检查并处理到期的汇总推送任务（关注后续合并通知、每日摘要等）',
    enabled: true
  }
];

export function getTaskDefaultEnabled(taskId: string): boolean {
  return TASK_DEFINITIONS.find((task) => task.id === taskId)?.enabled ?? false;
}

/**
 * 辅助函数: 获取指定任务的启用状态
 * 用于替代旧的 scheduleActive 存储
 */
export async function getTaskEnabled(taskId: string): Promise<boolean> {
  try {
    const { taskSchedulerStates } = await chrome.storage.local.get('taskSchedulerStates');
    const defaultEnabled = getTaskDefaultEnabled(taskId);
    if (taskSchedulerStates && taskSchedulerStates[taskId]) {
      return taskSchedulerStates[taskId].enabled ?? defaultEnabled;
    }
    // 如果没有保存的状态,返回默认值(根据任务定义)
    return defaultEnabled;
  } catch (error) {
    console.error(`获取任务 ${taskId} 状态失败:`, error);
    return false;
  }
}

/**
 * 辅助函数: 监听指定任务的启用状态变化
 */
export function onTaskEnabledChanged(
  taskId: string,
  callback: (enabled: boolean) => void
): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
    if (namespace === 'local' && changes.taskSchedulerStates) {
      const newStates = changes.taskSchedulerStates.newValue;
      if (newStates && newStates[taskId]) {
        callback(newStates[taskId].enabled ?? getTaskDefaultEnabled(taskId));
      }
    }
  };

  chrome.storage.onChanged.addListener(listener);

  // 返回清理函数
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}
