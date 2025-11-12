/**
 * 定时消息管理主页面
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import { OneClickSetup } from './components/OneClickSetup';
import { ScheduledMessageService } from './ScheduledMessageService';
import { ScheduledMessage, SheetConfig, InitializationResult, Statistics, CreateMessageFormData } from './types';

const ScheduledMessagesManager: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<SheetConfig | null>(null);
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    total: 0,
    active: 0,
    paused: 0,
    completed: 0,
    done: 0,
    executedToday: 0
  });
  const [service, setService] = useState<ScheduledMessageService | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBotConfigDialog, setShowBotConfigDialog] = useState(false);
  const [botConfigured, setBotConfigured] = useState(false);
  const [showBotConfigWarning, setShowBotConfigWarning] = useState(false);
  const [filterSelfOnly, setFilterSelfOnly] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [hoveredMessage, setHoveredMessage] = useState<ScheduledMessage | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isReminderMode, setIsReminderMode] = useState(false);
  
  useEffect(() => {
    initializeApp();
    getCurrentUserName();
  }, []);
  
  const initializeApp = async () => {
    try {
      // 检查是否已初始化
      const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
      const savedConfig = result.scheduledMessagesConfig;
      
      if (savedConfig && savedConfig.sheetId) {
        setConfig(savedConfig);
        setIsInitialized(true);
        
        // 检查 Bot 是否已配置（从 scheduledMessagesConfig.botExecutor 读取）
        if (savedConfig.botExecutor && savedConfig.botExecutor.ruleId) {
          setBotConfigured(true);
        }
        
        // 获取 token 并加载数据
        const token = await getAuthToken();
        if (token) {
          const messageService = new ScheduledMessageService(token);
          setService(messageService);
          await loadMessages(messageService);
          
          // 加载消息后，验证 Bot 配置是否仍然有效
          await checkBotConfigValidity(savedConfig, messageService);
        }
      } else {
        setIsInitialized(false);
      }
    } catch (error) {
      console.error('初始化应用失败:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadMessages = async (messageService: ScheduledMessageService) => {
    try {
      const msgs = await messageService.getAllMessages();
      setMessages(msgs);
      
      const stats = await messageService.getStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('加载消息失败:', error);
    }
  };
  
  const checkBotConfigValidity = async (savedConfig: SheetConfig, messageService: ScheduledMessageService) => {
    try {
      // 如果没有配置 Bot，跳过检查
      if (!savedConfig.botExecutor || !savedConfig.botExecutor.ruleId) {
        return;
      }
      
      // 获取所有消息
      const msgs = await messageService.getAllMessages();
      
      // 检查是否有待推送的 Bot 消息（Active 状态 + Push_Method 为 Bot）
      const hasPendingBotMessages = msgs.some(
        msg => msg.Status === 'Active' && msg.Push_Method === 'Bot'
      );
      
      // 如果没有待推送的 Bot 消息，不需要显示警告
      if (!hasPendingBotMessages) {
        setShowBotConfigWarning(false);
        return;
      }
      
      // 检查 Jira 规则是否还存在
      const { JiraAutomationService } = await import('./JiraAutomationService');
      const jiraService = new JiraAutomationService();
      
      const ruleExists = await jiraService.checkRuleExists(
        {
          jiraUrl: savedConfig.botExecutor.jiraUrl,
          projectKey: savedConfig.botExecutor.projectKey
        },
        savedConfig.botExecutor.ruleId
      );
      
      // 如果规则不存在且有待推送的 Bot 消息，显示警告
      if (!ruleExists) {
        console.warn('Bot 推送规则不存在，但有待推送的 Bot 消息');
        setShowBotConfigWarning(true);
        setBotConfigured(false);
      } else {
        setShowBotConfigWarning(false);
      }
    } catch (error) {
      console.error('检查 Bot 配置有效性失败:', error);
      // 检查失败不影响正常使用，不显示警告
    }
  };
  
  const handleInitializationComplete = (result: InitializationResult) => {
    if (result.success) {
      // 刷新页面重新加载
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };
  
  const handleSync = async () => {
    if (!service) return;
    
    setIsLoading(true);
    try {
      await loadMessages(service);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleOpenSheet = () => {
    if (config && config.sheetUrl) {
      window.open(config.sheetUrl, '_blank');
    }
  };
  
  const handleAddMessage = () => {
    setIsReminderMode(false);
    setShowAddDialog(true);
  };
  
  const handleAddReminder = () => {
    setIsReminderMode(true);
    setShowAddDialog(true);
  };
  
  const handleDeleteMessage = async (id: string, topic: string) => {
    if (!service) return;
    
    if (!confirm(`确定要删除消息 "${topic}" 吗？此操作无法撤销。`)) {
      return;
    }
    
    setIsLoading(true);
    try {
      await service.deleteMessage(id);
      await loadMessages(service);
      alert('消息已删除');
    } catch (error) {
      console.error('删除消息失败:', error);
      alert(`删除失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleToggleStatus = async (message: ScheduledMessage) => {
    if (!service) return;
    
    setIsLoading(true);
    try {
      await service.toggleMessageStatus(message.ID);
      await loadMessages(service);
    } catch (error) {
      console.error('切换状态失败:', error);
      alert(`切换状态失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSubmitNewMessage = async (formData: CreateMessageFormData) => {
    if (!service) return;
    
    setIsSubmitting(true);
    try {
      await service.createMessage(formData);
      await loadMessages(service);
      setShowAddDialog(false);
      alert('消息创建成功！');
    } catch (error) {
      console.error('创建消息失败:', error);
      alert(`创建失败: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCleanupCompleted = async () => {
    if (!service) return;
    
    if (!confirm(`确定要删除所有已完成的消息吗？\n共 ${statistics.done} 条消息将被永久删除。`)) {
      return;
    }
    
    try {
      const deletedCount = await service.deleteCompletedMessages();
      await loadMessages(service);
      alert(`成功清理 ${deletedCount} 条已完成的消息！`);
    } catch (error) {
      console.error('清理已完成消息失败:', error);
      alert(`清理失败: ${error.message}`);
    }
  };
  
  const getAuthToken = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token || '');
        }
      });
    });
  };
  
  const getCurrentUserName = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userInfo = await response.json();
        // userInfo.email 格式如：esone.qiu@ringcentral.com
        const email = userInfo.email || '';
        const username = email.split('@')[0]; // 提取 esone.qiu
        setCurrentUsername(username);
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  };
  
  // 格式化下次执行时间
  const formatNextExec = (message: ScheduledMessage): string => {
    // 检查是否为 Timeline 触发
    if (!message.Schedule_Date && message.Timeline_Milestone) {
      const milestone = message.Timeline_Milestone;
      const offset = message.Timeline_Offset ?? 0;
      let offsetText = '';
      
      if (offset === 0) {
        offsetText = '当天';
      } else if (offset === 1) {
        offsetText = '后一天';
      } else if (offset === -1) {
        offsetText = '前一天';
      } else if (offset > 1) {
        offsetText = `后${offset}天`;
      } else if (offset < -1) {
        offsetText = `前${Math.abs(offset)}天`;
      }
      
      return `下次 ${milestone} ${offsetText}`;
    }
    
    // 时间触发：返回原有的 Next_Exec 值
    return message.Next_Exec || '-';
  };
  
  // 频率格式化函数
  const formatFrequency = (message: ScheduledMessage): string => {
    // 检查是否为 Timeline 触发
    if (!message.Schedule_Date && message.Timeline_Milestone) {
      const milestone = message.Timeline_Milestone;
      const offset = message.Timeline_Offset ?? 0;
      let offsetText = '';
      
      if (offset === 0) {
        offsetText = '当天';
      } else if (offset === 1) {
        offsetText = '后一天';
      } else if (offset === -1) {
        offsetText = '前一天';
      } else if (offset > 1) {
        offsetText = `后${offset}天`;
      } else if (offset < -1) {
        offsetText = `前${Math.abs(offset)}天`;
      }
      
      const timeText = message.Schedule_Time ? ` ${message.Schedule_Time}` : ' 早上';
      return `${milestone} ${offsetText}${timeText}`;
    }
    
    // 判断是否有重复规则
    if (!message.Repeat_Every || !message.Repeat_Unit) {
      // 一次性任务
      return '推送一次';
    }
    
    const every = message.Repeat_Every;
    const unit = message.Repeat_Unit;
    const scheduleDate = message.Schedule_Date;
    const scheduleTime = message.Schedule_Time;
    
    // 根据单位构建频率描述
    let freq = '';
    
    if (unit === 'Day') {
      if (every === 1) {
        freq = '每天';
      } else {
        freq = `每 ${every} 天`;
      }
    } else if (unit === 'Week') {
      if (every === 1) {
        // 解析 Schedule_Date 获取星期几
        const date = new Date(scheduleDate);
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        const weekday = weekdays[date.getDay()];
        freq = `每周${weekday}`;
      } else {
        freq = `每 ${every} 周`;
      }
    } else if (unit === 'Month') {
      // 从 Schedule_Date 提取日期
      const day = new Date(scheduleDate).getDate();
      if (every === 1) {
        freq = `每月 ${day} 号`;
      } else {
        freq = `每 ${every} 月的 ${day} 号`;
      }
    } else if (unit === 'Year') {
      if (every === 1) {
        const date = new Date(scheduleDate);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        freq = `每年 ${month}/${day}`;
      } else {
        freq = `每 ${every} 年`;
      }
    }
    
    // 添加时间
    if (scheduleTime) {
      freq += ` ${scheduleTime}`;
    } else {
      freq += ' 早上';
    }
    
    return freq;
  };
  
  // 判断消息是否只发给自己
  const isSelfOnlyMessage = (message: ScheduledMessage): boolean => {
    if (!message.Glip_User_Name || !currentUsername) {
      return false;
    }
    
    // Glip_User_Name 格式：esone.qiu 或 esone.qiu+john.doe
    const usernames = message.Glip_User_Name.split('+');
    
    // 只有一个人且是自己
    return usernames.length === 1 && usernames[0] === currentUsername;
  };
  
  // 根据 Push_Method 显示类型
  const getMessageTypeDisplay = (message: ScheduledMessage): string => {
    // 特殊逻辑：sync.service 显示为系统消息
    if (message.Glip_User_Name === 'sync.service') {
      return '系统消息';
    }
    
    switch (message.Push_Method) {
      case 'AI':
        return 'AI Report';
      case 'AsMe':
        return '假装我发的';
      case 'Bot':
        return 'Bot 定时';
      default:
        return message.Push_Method;
    }
  };
  
  // 格式化"发给"列的显示
  const formatRecipient = (message: ScheduledMessage): string => {
    // 优先显示用户名
    if (message.Glip_User_Name && message.Glip_User_Name.trim()) {
      const usernames = message.Glip_User_Name.split('+');
      const formattedNames = usernames.map(name => {
        // esone.qiu -> Esone
        const parts = name.split('.');
        if (parts.length > 0) {
          return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        }
        return name;
      });
      return formattedNames.join(', ');
    }
    
    // 否则显示群组 ID
    if (message.Glip_Team_ID && message.Glip_Team_ID.trim()) {
      return message.Glip_Team_ID;
    }
    
    return '-';
  };
  
  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>加载中...</p>
      </div>
    );
  }
  
  if (!isInitialized) {
    return <OneClickSetup onComplete={handleInitializationComplete} />;
  }
  
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>⏰ 定时消息管理</h1>
        <div style={styles.headerActions}>
          <button style={styles.reminderButton} onClick={handleAddReminder} title="快速创建个人提醒">
            ⏰ 提醒我
          </button>
          <button style={styles.addButton} onClick={handleAddMessage} title="新增消息">
            ➕ 新增
          </button>
          <button style={styles.syncButton} onClick={handleSync} title="同步数据">
            🔄 同步
          </button>
          <button style={styles.configButton} onClick={handleOpenSheet} title="打开 Sheet">
            📊 打开 Sheet
          </button>
        </div>
      </header>
      
      {/* Bot 配置失效警告 */}
      {showBotConfigWarning && (
        <div style={styles.warningBanner}>
          <div style={styles.warningContent}>
            <span style={styles.warningIcon}>⚠️</span>
            <div style={styles.warningText}>
              <strong>Bot 推送配置失效</strong>
              <p style={styles.warningDescription}>
                检测到您有待推送的 Bot 消息，但 Jira Automation 规则已不存在，需要重新配置。
              </p>
            </div>
          </div>
          <button 
            style={styles.warningButton}
            onClick={() => setShowBotConfigDialog(true)}
          >
            🔧 重新配置
          </button>
        </div>
      )}
      
      <div style={styles.statusBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
          <span style={styles.statusItem}>
            📊 状态：<strong>已初始化</strong>
          </span>
          <span style={styles.statusItem}>
            总计: <strong>{statistics.total}</strong>
          </span>
          <span style={styles.statusItem}>
            活跃: <strong style={{ color: '#28a745' }}>{statistics.active}</strong>
          </span>
          <span style={styles.statusItem}>
            暂停: <strong style={{ color: '#ffc107' }}>{statistics.paused}</strong>
          </span>
          <span style={styles.statusItem}>
            已完成: <strong style={{ color: '#6c757d' }}>{statistics.done}</strong>
          </span>
          <span style={styles.statusItem}>
            今日已执行: <strong style={{ color: '#007bff' }}>{statistics.executedToday}</strong>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {statistics.done > 0 && (
            <button
              onClick={handleCleanupCompleted}
              style={{
                padding: '6px 12px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500
              }}
              title={`清理 ${statistics.done} 条已完成的消息`}
            >
              🗑️ 清理已完成 ({statistics.done})
            </button>
          )}
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            color: '#666',
            userSelect: 'none'
          }}>
            <input 
              type="checkbox"
              checked={filterSelfOnly}
              onChange={(e) => setFilterSelfOnly(e.target.checked)}
              style={{ marginRight: '6px', cursor: 'pointer' }}
            />
            过滤掉仅发我的
          </label>
        </div>
      </div>
      
      <div style={styles.content}>
        {messages.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>暂无定时消息</p>
            <p style={styles.emptyHint}>
              请在 <a href="#" onClick={handleOpenSheet}>Google Sheet</a> 中添加消息
            </p>
          </div>
        ) : (
          <div style={styles.messageList}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>类型</th>
                  <th style={styles.th}>主题</th>
                  <th style={styles.th}>发给</th>
                  <th style={styles.th}>频率</th>
                  <th style={styles.th}>下次执行</th>
                  <th style={styles.th}>已发</th>
                  <th style={styles.th}>状态</th>
                  <th style={styles.th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {messages
                  .filter(message => {
                    // 应用过滤条件
                    if (filterSelfOnly && isSelfOnlyMessage(message)) {
                      return false;
                    }
                    return true;
                  })
                  .map((message) => {
                    const displayTitle = message.Topic || (message.Content.length > 30 ? message.Content.substring(0, 30) + '...' : message.Content);
                    return (
                      <tr 
                        key={message.ID} 
                        style={styles.tr}
                        onMouseMove={(e) => {
                          setHoveredMessage(message);
                          setTooltipPosition({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => {
                          setHoveredMessage(null);
                        }}
                      >
                        <td style={styles.td}>
                          <span style={getTypeStyle(message.Push_Method)}>
                            {getMessageTypeDisplay(message)}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.topicText}>{displayTitle}</span>
                        </td>
                        <td style={styles.td}>{formatRecipient(message)}</td>
                        <td style={styles.td}>{formatFrequency(message)}</td>
                        <td style={styles.td}>{formatNextExec(message)}</td>
                        <td style={styles.td}>{message.Exec_Count || 0} 次</td>
                        <td style={styles.td}>
                          <span 
                            style={{...getStatusStyle(message.Status), cursor: 'pointer'}} 
                            onClick={() => handleToggleStatus(message)}
                            title={`点击切换为${message.Status === 'Active' ? '禁用' : '启用'}`}
                          >
                            {message.Status}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <button 
                            style={styles.deleteButton}
                            onClick={() => handleDeleteMessage(message.ID, displayTitle)}
                            title="删除消息"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <footer style={styles.footer}>
        <p style={styles.footerText}>
          提示：编辑消息请在 <a href="#" onClick={handleOpenSheet}>Google Sheet</a> 中操作
        </p>
      </footer>
      
       {showAddDialog && (
         <AddMessageDialog 
           onSubmit={handleSubmitNewMessage}
           onCancel={() => setShowAddDialog(false)}
           isSubmitting={isSubmitting}
           botConfigured={botConfigured}
           onConfigureBot={() => setShowBotConfigDialog(true)}
           isReminderMode={isReminderMode}
           currentUsername={currentUsername}
         />
       )}
       
       {showBotConfigDialog && config && (
         <BotConfigDialog
           config={config}
           onClose={() => setShowBotConfigDialog(false)}
           onSuccess={() => {
             setBotConfigured(true);
             setShowBotConfigWarning(false);
             setShowBotConfigDialog(false);
             alert('Bot 推送配置成功！');
           }}
         />
       )}
       
       {/* 浮动 Tooltip */}
       {hoveredMessage && (
         <div style={{
           ...styles.tooltip,
           left: `${tooltipPosition.x + 15}px`,
           top: `${tooltipPosition.y + 15}px`,
         }}>
           <div style={styles.tooltipHeader}>消息内容</div>
           <div style={styles.tooltipContent}>{hoveredMessage.Content}</div>
         </div>
       )}
    </div>
  );
};

// 变量选择器组件
const VariableSelector: React.FC<{
  onInsert: (variable: string) => void;
  excludeVariables?: string[];
}> = ({ onInsert, excludeVariables = [] }) => {
  const variables = [
    { key: '{Topic}', label: '消息主题' },
    { key: '{Content}', label: '消息内容' },
    { key: '{TeamID}', label: '群组 ID' },
    { key: '{currentRelease}', label: '当前 Release' },
    { key: '{currentPhase}', label: '当前 Phase' },
    { key: '{currentPhaseStartDate}', label: '当前 Phase 日期' },
    { key: '{currentPhaseStartedWorkdays}', label: '已过天数' },
    { key: '{nextPhase}', label: '下个 Phase' },
    { key: '{nextPhaseStartDate}', label: '下个 Phase 日期' },
    { key: '{nextPhaseCountdownWorkdays}', label: '距离天数' }
  ].filter(v => !excludeVariables.includes(v.key));

  if (variables.length === 0) return null;

  return (
    <div style={{
      marginTop: '8px',
      padding: '8px 10px',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      border: '1px solid #e0e0e0',
      fontSize: '12px',
      color: '#666',
    }}>
      <span style={{ marginRight: '8px' }}>💡 插入变量：</span>
      {variables.map((variable, index) => (
        <React.Fragment key={variable.key}>
          {index > 0 && <span style={{ margin: '0 4px', color: '#ccc' }}>|</span>}
          <button
            type="button"
            onClick={() => onInsert(variable.key)}
            style={{
              padding: '2px 8px',
              backgroundColor: '#e0e0e0',
              color: '#555',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#d0d0d0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#e0e0e0';
            }}
            title={`插入 ${variable.key}`}
          >
            {variable.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

// 用户名格式化工具函数
const formatUserName = {
  /**
   * 验证用户名格式（必须包含 first name 和 last name）
   */
  validate: (input: string): boolean => {
    const trimmed = input.trim();
    if (!trimmed) return false;
    
    // 支持两种格式：
    // 1. "Esone Qiu" - 空格分隔
    // 2. "esone.qiu" - 点号分隔
    const parts = trimmed.includes('.') 
      ? trimmed.split('.') 
      : trimmed.split(/\s+/);
    
    // 必须至少有两个部分（first name 和 last name）
    return parts.length >= 2 && parts.every(p => p.length > 0);
  },
  
  /**
   * 转换为显示格式："Esone Qiu"
   */
  toDisplayFormat: (input: string): string => {
    const trimmed = input.trim().toLowerCase();
    
    // 分割：支持空格或点号
    const parts = trimmed.includes('.') 
      ? trimmed.split('.') 
      : trimmed.split(/\s+/);
    
    // 首字母大写
    return parts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  },
  
  /**
   * 转换为存储格式："esone.qiu"
   */
  toStorageFormat: (input: string): string => {
    const trimmed = input.trim().toLowerCase();
    
    // 分割：支持空格或点号
    const parts = trimmed.includes('.') 
      ? trimmed.split('.') 
      : trimmed.split(/\s+/);
    
    // 用点号连接
    return parts.join('.');
  },
  
  /**
   * 将多个用户名转换为存储格式（用+连接，用于 Glip_User_Name）
   */
  joinForStorage: (displayNames: string[]): string => {
    return displayNames
      .map(name => formatUserName.toStorageFormat(name))
      .join('+');
  },
  
  /**
   * 将多个用户名转换为 mentionList 格式（用,连接，用于 AI Report）
   */
  joinForMentionList: (displayNames: string[]): string => {
    return displayNames
      .map(name => formatUserName.toStorageFormat(name))
      .join(',');
  }
};

// Tags 输入框组件
const TagsInput: React.FC<{
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
}> = ({ tags, onChange, placeholder, maxTags, disabled }) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      
      // 验证格式
      if (!formatUserName.validate(inputValue)) {
        setError('请输入完整的姓名（如：Esone Qiu 或 esone.qiu）');
        return;
      }
      
      if (maxTags && tags.length >= maxTags) {
        setError(`最多只能添加 ${maxTags} 个`);
        return;
      }
      
      // 转换为显示格式
      const displayName = formatUserName.toDisplayFormat(inputValue);
      
      // 检查是否已存在（避免重复）
      if (tags.includes(displayName)) {
        setError('该用户已添加');
        return;
      }
      
      onChange([...tags, displayName]);
      setInputValue('');
      setError('');
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
      setError('');
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (error) setError(''); // 清除错误提示
  };
  
  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, index) => index !== indexToRemove));
    setError('');
  };
  
  return (
    <div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '8px',
        border: `1px solid ${error ? '#dc3545' : '#ddd'}`,
        borderRadius: '4px',
        minHeight: '42px',
        backgroundColor: disabled ? '#f5f5f5' : '#fff',
      }}>
        {tags.map((tag, index) => (
          <span key={index} style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 8px',
            backgroundColor: '#007bff',
            color: '#fff',
            borderRadius: '4px',
            fontSize: '14px',
          }}>
            {tag}
            <button
              onClick={() => removeTag(index)}
              disabled={disabled}
              style={{
                marginLeft: '6px',
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0',
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          disabled={disabled}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            minWidth: '120px',
            fontSize: '14px',
            backgroundColor: 'transparent',
          }}
        />
      </div>
      {error && (
        <div style={{
          color: '#dc3545',
          fontSize: '12px',
          marginTop: '4px',
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

// AI Header 选项
const AVAILABLE_AI_HEADERS = [
  { value: 'Authorization', label: 'Authorization (认证)', placeholder: 'Bearer token 或 Basic xxx' },
  { value: 'Content-Type', label: 'Content-Type (内容类型)', placeholder: 'application/json' },
  { value: 'Accept', label: 'Accept (接受类型)', placeholder: 'application/json' },
  { value: 'X-API-Key', label: 'X-API-Key (API密钥)', placeholder: 'sk-xxxxxxx' },
  { value: 'User-Agent', label: 'User-Agent (用户代理)', placeholder: 'MyApp/1.0' },
  { value: 'X-Request-ID', label: 'X-Request-ID (请求ID)', placeholder: 'req-12345' },
  { value: 'X-Custom-Header', label: 'X-Custom-Header (自定义)', placeholder: '自定义值' }
];

// AI Header 类型
interface AIHeader {
  name: string;
  value: string;
}

// 新增消息对话框组件
const AddMessageDialog: React.FC<{
  onSubmit: (data: CreateMessageFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  botConfigured: boolean;
  onConfigureBot: () => void;
  isReminderMode?: boolean;
  currentUsername?: string;
}> = ({ onSubmit, onCancel, isSubmitting, botConfigured, onConfigureBot, isReminderMode = false, currentUsername = '' }) => {
  const [formData, setFormData] = useState<CreateMessageFormData>({
    Topic: '',
    Content: '',
    Schedule_Date: new Date().toISOString().split('T')[0],
    Schedule_Time: '',
    Push_Method: 'AsMe',
    Target_Type: 'private',
    Glip_User_Name: '',
    Glip_Team_ID: ''
  });
  const [userTags, setUserTags] = useState<string[]>([]);
  const [isRepeating, setIsRepeating] = useState(false);
  const [aiReportTemplate, setAiReportTemplate] = useState<'ai-report' | 'pep-report' | 'custom'>('ai-report');
  const [aiHeaders, setAiHeaders] = useState<AIHeader[]>([]);
  const [isTimelineTrigger, setIsTimelineTrigger] = useState(false);
  
  // AI Report 可视化字段
  const [aiReportJql, setAiReportJql] = useState('');
  const [aiReportOutputs, setAiReportOutputs] = useState({
    noduedate: true,
    overdue: true,
    toTest: true
  });
  const [aiReportTeamId, setAiReportTeamId] = useState('');
  const [aiReportMentionList, setAiReportMentionList] = useState<string[]>([]);
  const [aiReportExtraText, setAiReportExtraText] = useState('');
  const [pepReportTeamId, setPepReportTeamId] = useState('');
  
  // Body 输入框的 ref，用于插入变量
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 提醒模式：展开高级选项的状态
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // 提醒模式初始化
  React.useEffect(() => {
    if (isReminderMode) {
      // 自动填充提醒模式的数据
      handleChange('Topic', '个人提醒事项');
      handleChange('Push_Method', 'Bot');
      handleChange('Target_Type', 'private');
      
      // 填充当前用户名
      if (currentUsername) {
        const displayName = formatUserName.toDisplayFormat(currentUsername);
        setUserTags([displayName]);
      }
    }
  }, [isReminderMode]);
  
  // 三个模板的数据缓存（内存中，关闭页面后失效）
  const templateCacheRef = React.useRef<{
    'ai-report': { AI_Endpoint: string; AI_Headers: string; AI_Body: string };
    'pep-report': { AI_Endpoint: string; AI_Headers: string; AI_Body: string };
    'custom': { AI_Endpoint: string; AI_Headers: string; AI_Body: string };
  }>({
    'ai-report': { AI_Endpoint: '', AI_Headers: '', AI_Body: '' },
    'pep-report': { AI_Endpoint: '', AI_Headers: '', AI_Body: '' },
    'custom': { AI_Endpoint: '', AI_Headers: '', AI_Body: '' }
  });
  
  // AI Report 预设值
  const aiReportPresets = {
    'ai-report': {
      AI_Endpoint: 'POST https://dify.int.rclabenv.com/v1/chat-messages',
      AI_Headers: 'Authorization: Bearer app-hTAaR1jaLnYDITixXRP5qi4Y\nContent-Type: application/json',
      AI_Body: JSON.stringify({
        response_mode: 'blocking',
        user: 'default-user',
        query: '{Topic}',
        inputs: {
          title: '{Topic}',
          outputs: 'noduedate, overdue, toTest',
          jql: '{Content}',
          extraText: '',
          teamId: '{TeamID}',
          mentionList: ''
        }
      }, null, 2)
    },
    'pep-report': {
      AI_Endpoint: 'POST https://gitlab-reviewer.int.rclabenv.com/pep_daily_report',
      AI_Headers: 'Content-Type: application/json',
      AI_Body: JSON.stringify({
        jql: '',
        jira_query_id: 111,
        sheet_id: '',
        sheet_name: '',
        team_id: '{TeamID}',
        mention_list: [],
        overallFilterId: '',
        bugFilterid: '',
        ignore_due_soon: true,
        force_running: true,
        missing_due_check_scope: 'all',
        language: '',
        milestones: [
          {
            abbreviation: 'MR',
            full_name: 'Code Merge',
            goal: '提测所有功能及安排在本Release的Production Bug'
          },
          {
            abbreviation: 'FF',
            full_name: 'Feature Freeze',
            goal: '1）完成所有功能测试；2）完成安排在本Release的所有Production和Release Bug (接近FF 2天内的P2 bug可以Regression阶段修复）'
          },
          {
            abbreviation: 'CF',
            full_name: 'Code Freeze',
            goal: '完成所有本Release的功能开发、测试和Bug修复。完成Sign off。提供Dogfooding Build'
          }
        ]
      }, null, 2)
    }
  };
  
  // 处理模板切换
  const handleTemplateChange = (newTemplate: 'ai-report' | 'pep-report' | 'custom') => {
    // 保存当前模板的数据到缓存
    if (aiReportTemplate === 'ai-report') {
      // ai-report 使用可视化字段，不需要保存 Body
      templateCacheRef.current[aiReportTemplate] = {
        AI_Endpoint: formData.AI_Endpoint || '',
        AI_Headers: formData.AI_Headers || '',
        AI_Body: '' // ai-report 的 Body 会动态生成
      };
    } else {
      templateCacheRef.current[aiReportTemplate] = {
        AI_Endpoint: formData.AI_Endpoint || '',
        AI_Headers: formData.AI_Headers || '',
        AI_Body: formData.AI_Body || ''
      };
    }
    
    // 切换到新模板
    setAiReportTemplate(newTemplate);
    
    // 如果新模板有预设值且缓存为空，使用预设值
    if (newTemplate === 'ai-report' && !templateCacheRef.current['ai-report'].AI_Endpoint) {
      const headersStr = aiReportPresets['ai-report'].AI_Headers;
      handleChange('AI_Endpoint', aiReportPresets['ai-report'].AI_Endpoint);
      handleChange('AI_Headers', headersStr);
      // ai-report 的 Body 会通过可视化字段自动生成，不需要手动设置
      setAiHeaders(parseHeadersString(headersStr));
    } else if (newTemplate === 'pep-report' && !templateCacheRef.current['pep-report'].AI_Endpoint) {
      const headersStr = aiReportPresets['pep-report'].AI_Headers;
      handleChange('AI_Endpoint', aiReportPresets['pep-report'].AI_Endpoint);
      handleChange('AI_Headers', headersStr);
      handleChange('AI_Body', aiReportPresets['pep-report'].AI_Body);
      setAiHeaders(parseHeadersString(headersStr));
    } else {
      // 从缓存恢复数据
      const cached = templateCacheRef.current[newTemplate];
      handleChange('AI_Endpoint', cached.AI_Endpoint);
      handleChange('AI_Headers', cached.AI_Headers);
      if (newTemplate !== 'ai-report') {
        handleChange('AI_Body', cached.AI_Body);
      }
      if (newTemplate === 'custom') {
        setAiHeaders(parseHeadersString(cached.AI_Headers));
      }
    }
  };
  
  // 构建 AI Report Body JSON
  const buildAiReportBody = (): string => {
    const outputs = Object.entries(aiReportOutputs)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key)
      .join(', ');
    
    return JSON.stringify({
      response_mode: 'blocking',
      user: 'default-user',
      query: '{Topic}',
      inputs: {
        title: '{Topic}',
        outputs: outputs,
        jql: '{Content}',
        extraText: aiReportExtraText,
        teamId: '{TeamID}',
        mentionList: formatUserName.joinForMentionList(aiReportMentionList)
      }
    }, null, 2);
  };
  
  // 解析 headers 字符串为数组
  const parseHeadersString = (headersStr: string): AIHeader[] => {
    if (!headersStr) return [];
    const lines = headersStr.split('\n');
    const headers: AIHeader[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;
      
      const name = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();
      
      if (name && value) {
        headers.push({ name, value });
      }
    }
    
    return headers;
  };
  
  // 将 headers 数组转换为字符串
  const formatHeadersToString = (headers: AIHeader[]): string => {
    return headers
      .filter(h => h.name && h.value)
      .map(h => `${h.name}: ${h.value}`)
      .join('\n');
  };
  
  // 当 Push_Method 切换到 AI 时，初始化模板
  React.useEffect(() => {
    if (formData.Push_Method === 'AI' && !formData.AI_Endpoint) {
      setAiReportTemplate('ai-report');
      const headersStr = aiReportPresets['ai-report'].AI_Headers;
      handleChange('AI_Endpoint', aiReportPresets['ai-report'].AI_Endpoint);
      handleChange('AI_Headers', headersStr);
      // ai-report 模板不需要初始化 AI_Body，会通过可视化字段动态生成
      setAiHeaders(parseHeadersString(headersStr));
    }
  }, [formData.Push_Method]);
  
  // 当 ai-report 的可视化字段变化时，自动更新 Content 和 AI_Body
  React.useEffect(() => {
    if (formData.Push_Method === 'AI' && aiReportTemplate === 'ai-report') {
      // 同步 JQL 到 Content
      handleChange('Content', aiReportJql);
      // 动态构建 AI_Body
      handleChange('AI_Body', buildAiReportBody());
    }
  }, [aiReportJql, aiReportOutputs, aiReportTeamId, aiReportMentionList, aiReportExtraText]);
  
  // Header 管理函数
  const addAIHeader = () => {
    setAiHeaders([...aiHeaders, { name: '', value: '' }]);
  };
  
  const updateAIHeaderName = (index: number, name: string) => {
    const newHeaders = [...aiHeaders];
    newHeaders[index].name = name;
    setAiHeaders(newHeaders);
    handleChange('AI_Headers', formatHeadersToString(newHeaders));
  };
  
  const updateAIHeaderValue = (index: number, value: string) => {
    const newHeaders = [...aiHeaders];
    newHeaders[index].value = value;
    setAiHeaders(newHeaders);
    handleChange('AI_Headers', formatHeadersToString(newHeaders));
  };
  
  const removeAIHeader = (index: number) => {
    const newHeaders = aiHeaders.filter((_, i) => i !== index);
    setAiHeaders(newHeaders);
    handleChange('AI_Headers', formatHeadersToString(newHeaders));
  };
  
  // 插入变量到 Body 输入框
  const insertVariableToBody = (variable: string) => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.AI_Body || '';
    const newText = text.substring(0, start) + variable + text.substring(end);
    
    handleChange('AI_Body', newText);
    
    // 设置光标位置到插入变量之后
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };
  
  // 插入变量到消息内容输入框
  const insertVariableToContent = (variable: string) => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.Content || '';
    const newText = text.substring(0, start) + variable + text.substring(end);
    
    handleChange('Content', newText);
    
    // 设置光标位置到插入变量之后
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 提醒模式：检查 Bot 是否已配置
    if (isReminderMode && !botConfigured) {
      alert('请先配置 Bot 推送功能才能创建个人提醒');
      return;
    }
    
    // 验证必填字段
    if (!formData.Topic) {
      alert('请填写消息主题');
      return;
    }
    
    // 验证触发方式
    if (isTimelineTrigger) {
      // Timeline 触发验证：必须先配置 Bot
      if (!botConfigured) {
        alert('Timeline 触发功能需要先配置 Bot 推送（需要通过 Jira Automation 规则访问 Release 信息）');
        return;
      }
      
      if (!formData.Timeline_Project || !formData.Timeline_Milestone || formData.Timeline_Offset === undefined) {
        alert('请完整填写 Timeline 触发配置');
        return;
      }
    } else {
      // 时间触发验证
      if (!formData.Schedule_Date) {
        alert('请填写执行日期');
        return;
      }
    }
    
    // 验证推送目标
    if (formData.Push_Method === 'AI') {
      // AI 消息验证
      if (aiReportTemplate === 'ai-report') {
        // ai-report 模板验证 JQL
        if (!aiReportJql.trim()) {
          alert('请填写 JQL 查询');
          return;
        }
      } else {
        // 其他模板验证 Content 和 Body
        if (!formData.Content) {
          alert('请填写消息内容');
          return;
        }
        if (!formData.AI_Endpoint || !formData.AI_Body) {
          alert('请填写 AI Endpoint 和 Body');
          return;
        }
      }
    } else {
      // Bot/AsMe 消息验证
      if (!formData.Content) {
        alert('请填写消息内容');
        return;
      }
      
      // 非提醒模式才需要验证推送目标（提醒模式已自动配置）
      if (!isReminderMode) {
        if (formData.Target_Type === 'private' && userTags.length === 0) {
          alert('请至少添加一个接收人');
          return;
        }
        
        if (formData.Target_Type === 'group' && !formData.Glip_Team_ID) {
          alert('请填写群组 ID');
          return;
        }
      }
    }
    
    // 验证周期性消息
    if (isRepeating) {
      if (!formData.Repeat_Every || !formData.Repeat_Unit) {
        alert('请完整填写重复设置');
        return;
      }
    }
    
    // 合并 userTags 到 Glip_User_Name（转换为存储格式：esone.qiu+john.doe）
    // 注意：不传递 Target_Type，由 AppScript 动态判断
    
    // 处理 AI Report 的 Glip_Team_ID
    let glipTeamId = formData.Glip_Team_ID;
    if (formData.Push_Method === 'AI') {
      if (aiReportTemplate === 'ai-report') {
        // ai-report 模板：使用可视化输入框的值
        glipTeamId = aiReportTeamId;
      } else if (aiReportTemplate === 'pep-report') {
        // pep-report 模板：使用专用的输入框值
        glipTeamId = pepReportTeamId;
      }
      // custom 模板：不处理，用户自己负责
    }
    
    const finalFormData: CreateMessageFormData = {
      ...formData,
      Glip_User_Name: formData.Push_Method === 'AI' ? undefined : formatUserName.joinForStorage(userTags),
      Glip_Team_ID: glipTeamId,
      Repeat_Every: isRepeating ? formData.Repeat_Every : undefined,
      Repeat_Unit: isRepeating ? formData.Repeat_Unit : undefined,
      Repeat_Count: isRepeating ? formData.Repeat_Count : undefined,
      End_Date: isRepeating ? formData.End_Date : undefined,
    };
    
    onSubmit(finalFormData);
  };
  
  const handleChange = (field: keyof CreateMessageFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleUserTagsChange = (tags: string[]) => {
    setUserTags(tags);
  };
  
  return (
    <div style={dialogStyles.overlay}>
      <div style={dialogStyles.dialog}>
        <div style={dialogStyles.header}>
          <h2 style={dialogStyles.title}>
            {isReminderMode ? '⏰ 新增个人提醒' : '➕ 新增定时消息'}
          </h2>
          <button style={dialogStyles.closeButton} onClick={onCancel}>✕</button>
        </div>
        
        <form onSubmit={handleSubmit} style={dialogStyles.form}>
          {/* 提醒模式说明 */}
          {isReminderMode && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#e7f3ff',
              borderRadius: '8px',
              marginBottom: '16px',
              border: '1px solid #b3d7ff',
            }}>
              <div style={{ fontSize: '14px', color: '#0066cc', lineHeight: '1.6' }}>
                <strong>💡 个人提醒模式</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                  此模式会通过 Bot 向您发送私信提醒，无需配置推送方式和接收人。
                </p>
              </div>
            </div>
          )}
          
          {/* 消息内容（提醒模式始终显示） */}
          {!(formData.Push_Method === 'AI' && aiReportTemplate === 'ai-report' && !isReminderMode) && (
            <div style={dialogStyles.formGroup}>
              <label style={dialogStyles.label}>消息内容 *</label>
              <textarea 
                ref={contentTextareaRef}
                style={dialogStyles.textarea}
                value={formData.Content}
                onChange={(e) => handleChange('Content', e.target.value)}
                placeholder={isReminderMode ? "输入提醒内容" : "输入消息内容"}
                rows={4}
              />
              {/* 提醒模式下隐藏变量选择器 */}
              {!isReminderMode && (
                <VariableSelector 
                  onInsert={insertVariableToContent}
                  excludeVariables={['{Topic}', '{Content}', '{TeamID}']}
                />
              )}
            </div>
          )}
          
          {/* 提醒模式：高级选项折叠容器 */}
          {isReminderMode && (
            <div 
              style={{
                overflow: 'hidden',
                transition: 'max-height 0.3s ease-in-out, opacity 0.3s ease-in-out',
                maxHeight: showAdvancedOptions ? '2000px' : '0px',
                opacity: showAdvancedOptions ? 1 : 0,
              }}
            >
              {/* 变量选择器 */}
              {!(formData.Push_Method === 'AI' && aiReportTemplate === 'ai-report') && (
                <div style={dialogStyles.formGroup}>
                  <VariableSelector 
                    onInsert={insertVariableToContent}
                    excludeVariables={['{Topic}', '{Content}', '{TeamID}']}
                  />
                </div>
              )}
              
              {/* 消息主题 */}
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>消息主题（可选）</label>
                <input 
                  style={dialogStyles.input}
                  type="text"
                  value={formData.Topic}
                  onChange={(e) => handleChange('Topic', e.target.value)}
                  placeholder="输入消息主题"
                />
              </div>
              
              {/* 触发类型选择 */}
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>触发方式 *</label>
                <div style={dialogStyles.buttonGroup}>
                  <button
                    type="button"
                    style={getButtonStyle(!isTimelineTrigger)}
                    onClick={() => {
                      setIsTimelineTrigger(false);
                      handleChange('Schedule_Date', new Date().toISOString().split('T')[0]);
                      handleChange('Timeline_Project', undefined);
                      handleChange('Timeline_Milestone', undefined);
                      handleChange('Timeline_Offset', undefined);
                    }}
                  >
                    ⏰ 时间触发
                  </button>
                  <button
                    type="button"
                    style={getButtonStyle(isTimelineTrigger)}
                    onClick={() => {
                      setIsTimelineTrigger(true);
                      handleChange('Schedule_Date', '');
                      handleChange('Timeline_Project', 'mThor');
                      handleChange('Timeline_Milestone', 'FF');
                      handleChange('Timeline_Offset', 0);
                    }}
                  >
                    📅 Timeline 触发
                  </button>
                </div>
              </div>
              
              {/* 是否重复推送（仅时间触发） */}
              {!isTimelineTrigger && (
                <div style={dialogStyles.formGroup}>
                  <label style={{...dialogStyles.label, display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                    <input 
                      type="checkbox"
                      checked={isRepeating}
                      onChange={(e) => {
                        setIsRepeating(e.target.checked);
                        if (e.target.checked) {
                          handleChange('Repeat_Every', 1);
                          handleChange('Repeat_Unit', 'Week');
                        }
                      }}
                      style={{marginRight: '8px'}}
                    />
                    是否重复推送
                  </label>
                </div>
              )}
            </div>
          )}
          
          {/* 非提醒模式：正常显示消息主题和触发方式 */}
          {!isReminderMode && (
            <>
              {/* 消息主题 */}
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>消息主题 *</label>
                <input 
                  style={dialogStyles.input}
                  type="text"
                  value={formData.Topic}
                  onChange={(e) => handleChange('Topic', e.target.value)}
                  placeholder="输入消息主题"
                />
              </div>
              
              {/* 触发类型选择 */}
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>触发方式 *</label>
                <div style={dialogStyles.buttonGroup}>
                  <button
                    type="button"
                    style={getButtonStyle(!isTimelineTrigger)}
                    onClick={() => {
                      setIsTimelineTrigger(false);
                      handleChange('Schedule_Date', new Date().toISOString().split('T')[0]);
                      handleChange('Timeline_Project', undefined);
                      handleChange('Timeline_Milestone', undefined);
                      handleChange('Timeline_Offset', undefined);
                    }}
                  >
                    ⏰ 时间触发
                  </button>
                  <button
                    type="button"
                    style={getButtonStyle(isTimelineTrigger)}
                    onClick={() => {
                      setIsTimelineTrigger(true);
                      handleChange('Schedule_Date', '');
                      handleChange('Timeline_Project', 'mThor');
                      handleChange('Timeline_Milestone', 'FF');
                      handleChange('Timeline_Offset', 0);
                    }}
                  >
                    📅 Timeline 触发
                  </button>
                </div>
              </div>
            </>
          )}
          
          {/* 时间触发：执行日期 */}
          {!isTimelineTrigger && (
            <div style={dialogStyles.formRow}>
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>执行日期 *</label>
                <input 
                  style={dialogStyles.input}
                  type="date"
                  value={formData.Schedule_Date || ''}
                  onChange={(e) => handleChange('Schedule_Date', e.target.value)}
                />
              </div>
              
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>执行时间</label>
                <input 
                  style={dialogStyles.input}
                  type="time"
                  value={formData.Schedule_Time || ''}
                  onChange={(e) => handleChange('Schedule_Time', e.target.value)}
                  placeholder="09:00"
                />
                <small style={dialogStyles.hint}>留空则每日早上 9 点左右推送</small>
              </div>
            </div>
          )}
          
          {/* Timeline 触发：项目和 Milestone 配置 */}
          {isTimelineTrigger && (
            <div style={{...dialogStyles.section, backgroundColor: '#f0f7ff', padding: '16px', borderRadius: '8px', marginBottom: '16px'}}>
              {/* Timeline 模式 Bot 配置检查 */}
              {!botConfigured && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#fff3cd',
                  borderRadius: '6px',
                  border: '1px solid #ffc107',
                  marginBottom: '16px',
                }}>
                  <p style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '14px' }}>
                    ⚠️ Timeline 触发功能需要配置 Bot 推送才能使用（需要通过 Jira Automation 规则访问 Release 信息）
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onConfigureBot();
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ffc107',
                      color: '#000',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                    }}
                  >
                    🔧 配置 Bot 后启用
                  </button>
                </div>
              )}
              
              <div style={dialogStyles.formRow}>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>项目 *</label>
                  <select
                    style={dialogStyles.select}
                    value={formData.Timeline_Project || 'mThor'}
                    onChange={(e) => handleChange('Timeline_Project', e.target.value)}
                    disabled={!botConfigured}
                  >
                    <option value="mThor">mThor</option>
                    <option value="Jupiter desktop">Jupiter desktop</option>
                    <option value="Jupiter web">Jupiter web</option>
                  </select>
                  <small style={dialogStyles.hint}>
                    新增请联系项目组所在 SDET 完善 <a href="https://heimdall-xmn02.int.rclabenv.com/api/swagger/#/bot/bot_get_release_info_retrieve" target="_blank" rel="noopener noreferrer" style={{color: '#007bff', textDecoration: 'underline'}}>API</a>
                  </small>
                </div>
                
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>Milestone *</label>
                  <select
                    style={dialogStyles.select}
                    value={formData.Timeline_Milestone || 'FF'}
                    onChange={(e) => handleChange('Timeline_Milestone', e.target.value)}
                    disabled={!botConfigured}
                  >
                    <option value="DoR">DoR</option>
                    <option value="Embedded">Embedded</option>
                    <option value="FF">FF</option>
                    <option value="Regression">Regression</option>
                    <option value="CF">CF</option>
                    <option value="Release">Release</option>
                  </select>
                </div>
              </div>
              
              <div style={dialogStyles.formRow}>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>偏移天数 *</label>
                  <input 
                    style={dialogStyles.input}
                    type="number"
                    min="-30"
                    max="30"
                    value={formData.Timeline_Offset ?? 0}
                    onChange={(e) => handleChange('Timeline_Offset', parseInt(e.target.value))}
                    disabled={!botConfigured}
                  />
                  <small style={dialogStyles.hint}>
                    负数=之前，0=当天，正数=之后。例如：-1 表示 Milestone 前一天，1 表示后一天
                  </small>
                </div>
                
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>执行时间</label>
                  <input 
                    style={dialogStyles.input}
                    type="time"
                    value={formData.Schedule_Time || ''}
                    onChange={(e) => handleChange('Schedule_Time', e.target.value)}
                    placeholder="09:00"
                    disabled={!botConfigured}
                  />
                  <small style={dialogStyles.hint}>留空则每日早上 9 点左右推送</small>
                </div>
              </div>
            </div>
          )}
          
          {/* 是否重复 Toggle（仅非提醒模式显示，提醒模式已在高级选项中） */}
          {!isReminderMode && !isTimelineTrigger && (
            <div style={dialogStyles.formGroup}>
              <label style={{...dialogStyles.label, display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                <input 
                  type="checkbox"
                  checked={isRepeating}
                  onChange={(e) => {
                    setIsRepeating(e.target.checked);
                    if (e.target.checked) {
                      handleChange('Repeat_Every', 1);
                      handleChange('Repeat_Unit', 'Week');
                    }
                  }}
                  style={{marginRight: '8px'}}
                />
                是否重复推送
              </label>
            </div>
          )}
          
          {/* 重复设置（仅时间触发模式显示） */}
          {!isTimelineTrigger && isRepeating && (
            <div style={{...dialogStyles.section, backgroundColor: '#f8f9fa', padding: '16px', borderRadius: '8px'}}>
              <div style={dialogStyles.formRow}>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>每隔 *</label>
                  <input 
                    style={dialogStyles.input}
                    type="number"
                    min="1"
                    value={formData.Repeat_Every || 1}
                    onChange={(e) => handleChange('Repeat_Every', parseInt(e.target.value))}
                  />
                </div>
                
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>重复单位 *</label>
                  <div style={dialogStyles.buttonGroup}>
                    {['Day', 'Week', 'Month', 'Year'].map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        style={getButtonStyle(formData.Repeat_Unit === unit)}
                        onClick={() => handleChange('Repeat_Unit', unit)}
                      >
                        {unit === 'Day' ? '天' : unit === 'Week' ? '周' : unit === 'Month' ? '月' : '年'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div style={dialogStyles.formRow}>
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>结束日期（可选）</label>
                  <input 
                    style={dialogStyles.input}
                    type="date"
                    value={formData.End_Date || ''}
                    onChange={(e) => handleChange('End_Date', e.target.value)}
                  />
                </div>
                
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>重复次数（可选）</label>
                  <input 
                    style={dialogStyles.input}
                    type="number"
                    min="1"
                    value={formData.Repeat_Count || ''}
                    onChange={(e) => handleChange('Repeat_Count', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="留空表示无限"
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* 提醒模式：展开更多选项按钮 */}
          {isReminderMode && (
            <div style={{
              marginBottom: '16px',
              textAlign: 'center',
            }}>
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'transparent',
                  color: '#007bff',
                  border: '1px dashed #007bff',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  margin: '0 auto',
                  transition: 'all 0.2s ease-in-out',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f7ff';
                  e.currentTarget.style.borderColor = '#0056b3';
                  e.currentTarget.style.color = '#0056b3';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#007bff';
                  e.currentTarget.style.color = '#007bff';
                }}
              >
                <span style={{
                  display: 'inline-block',
                  transition: 'transform 0.3s ease-in-out',
                  transform: showAdvancedOptions ? 'rotate(180deg)' : 'rotate(0deg)',
                }}>
                  ▼
                </span>
                {showAdvancedOptions ? '收起高级选项' : '展开更多选项'}
              </button>
            </div>
          )}
          
          {/* 提醒模式：Bot 配置检查 */}
          {isReminderMode && !botConfigured && (
            <div style={{
              padding: '16px',
              backgroundColor: '#fff3cd',
              borderRadius: '8px',
              border: '1px solid #ffc107',
              marginBottom: '16px',
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#856404', fontSize: '15px' }}>
                ⚠️ Bot 推送功能未配置
              </div>
              <p style={{ margin: '0 0 12px 0', color: '#856404', fontSize: '14px', lineHeight: '1.6' }}>
                个人提醒功能需要通过 Bot 发送消息。请先配置 Bot 推送功能才能使用。
              </p>
              <button
                type="button"
                onClick={() => {
                  onConfigureBot();
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#ffc107',
                  color: '#000',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                🔧 立即配置 Bot
              </button>
            </div>
          )}
          
          {/* 非提醒模式：显示完整的推送配置 */}
          {!isReminderMode && (
            <>
           {/* 推送方式 */}
           <div style={dialogStyles.formGroup}>
             <label style={dialogStyles.label}>推送方式 *</label>
             <div style={dialogStyles.buttonGroup}>
               <button
                 type="button"
                 style={getButtonStyle(formData.Push_Method === 'AsMe')}
                 onClick={() => handleChange('Push_Method', 'AsMe')}
               >
                 👤 AsMe（以我的身份）
               </button>
               <button
                 type="button"
                 style={getButtonStyle(formData.Push_Method === 'Bot')}
                 onClick={() => handleChange('Push_Method', 'Bot')}
               >
                 🤖 Bot（机器人）
               </button>
               <button
                 type="button"
                 style={getButtonStyle(formData.Push_Method === 'AI')}
                 onClick={() => handleChange('Push_Method', 'AI')}
               >
                 🤖 AI Report
               </button>
             </div>
             {formData.Push_Method === 'Bot' && !botConfigured && (
               <div style={{
                 marginTop: '12px',
                 padding: '12px',
                 backgroundColor: '#fff3cd',
                 borderRadius: '6px',
                 border: '1px solid #ffc107',
               }}>
                 <p style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '14px' }}>
                   ⚠️ 您还未配置 Bot 推送功能，需要先配置才能使用。
                 </p>
                 <button
                   type="button"
                   onClick={() => {
                     onConfigureBot();
                   }}
                   style={{
                     padding: '8px 16px',
                     backgroundColor: '#ffc107',
                     color: '#000',
                     border: 'none',
                     borderRadius: '4px',
                     cursor: 'pointer',
                     fontSize: '14px',
                     fontWeight: 'bold',
                   }}
                 >
                   🔧 配置 Bot 后启用
                 </button>
               </div>
             )}
             {formData.Push_Method === 'AI' && !botConfigured && (
               <div style={{
                 marginTop: '12px',
                 padding: '12px',
                 backgroundColor: '#fff3cd',
                 borderRadius: '6px',
                 border: '1px solid #ffc107',
               }}>
                 <p style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '14px' }}>
                   ⚠️ AI Report 功能需要配置 Bot 推送功能才能使用。
                 </p>
                 <button
                   type="button"
                   onClick={() => {
                     onConfigureBot();
                   }}
                   style={{
                     padding: '8px 16px',
                     backgroundColor: '#ffc107',
                     color: '#000',
                     border: 'none',
                     borderRadius: '4px',
                     cursor: 'pointer',
                     fontSize: '14px',
                     fontWeight: 'bold',
                   }}
                 >
                   🔧 配置 Bot 后启用
                 </button>
               </div>
             )}
           </div>
          
          {/* AI Report 配置 */}
          {formData.Push_Method === 'AI' && (
            <>
              {/* 模板选择 */}
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>报告模板 *</label>
                <select
                  style={dialogStyles.select}
                  value={aiReportTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value as 'ai-report' | 'pep-report' | 'custom')}
                >
                  <option value="ai-report">AI report</option>
                  <option value="pep-report">PEP report</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              
              {/* AI Endpoint */}
              {(aiReportTemplate === 'custom') && (
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>API Endpoint *</label>
                  <input 
                    style={dialogStyles.input}
                    type="text"
                    value={formData.AI_Endpoint || ''}
                    onChange={(e) => handleChange('AI_Endpoint', e.target.value)}
                    placeholder="POST https://example.com/api 或 GET https://example.com/api 或 https://example.com/api"
                  />
                  <small style={dialogStyles.hint}>格式：POST/GET URL 或仅 URL（默认为 GET）</small>
                </div>
              )}
              
              {/* AI Headers */}
              {(aiReportTemplate === 'custom') && (
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>Headers</label>
                  <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '12px', backgroundColor: '#f9f9f9' }}>
                    {aiHeaders.map((header, index) => (
                      <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'flex-start' }}>
                        <select
                          value={header.name}
                          onChange={(e) => updateAIHeaderName(index, e.target.value)}
                          style={{
                            ...dialogStyles.select,
                            flex: '0 0 200px',
                            marginBottom: 0
                          }}
                        >
                          <option value="">选择 Header</option>
                          {AVAILABLE_AI_HEADERS.map(h => (
                            <option key={h.value} value={h.value}>{h.label}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={header.value}
                          onChange={(e) => updateAIHeaderValue(index, e.target.value)}
                          placeholder={
                            header.name
                              ? AVAILABLE_AI_HEADERS.find(h => h.value === header.name)?.placeholder || 'Header 值'
                              : 'Header 值'
                          }
                          style={{
                            ...dialogStyles.input,
                            flex: 1,
                            marginBottom: 0
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeAIHeader(index)}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#dc3545',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            whiteSpace: 'nowrap'
                          }}
                          title="删除此 Header"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addAIHeader}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        width: '100%',
                        marginTop: aiHeaders.length > 0 ? '4px' : '0'
                      }}
                    >
                      ➕ 添加 Header
                    </button>
                  </div>
                  <small style={dialogStyles.hint}>
                    💡 提示：只支持预定义的 7 个 header 名称，选择后填写对应的值即可
                  </small>
                </div>
              )}
              
              {/* AI Body */}
              {aiReportTemplate === 'ai-report' ? (
                /* AI Report 可视化配置 */
                <div style={{...dialogStyles.section, backgroundColor: '#f8f9fa', padding: '16px', borderRadius: '8px'}}>
                  <h3 style={{margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold', color: '#333'}}>
                    📊 AI Report 配置
                  </h3>
                  
                  {/* JQL 输入框 */}
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>JQL 查询 *</label>
                    <textarea 
                      style={dialogStyles.textarea}
                      value={aiReportJql}
                      onChange={(e) => setAiReportJql(e.target.value)}
                      placeholder='例如：project = MTR AND status = "In Progress"'
                      rows={3}
                    />
                    <small style={dialogStyles.hint}>此内容会自动同步到上方的"消息内容"字段</small>
                  </div>
                  
                  {/* 版块自定义 */}
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>版块自定义</label>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                      <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px'}}>
                        <input 
                          type="checkbox"
                          checked={aiReportOutputs.noduedate}
                          onChange={(e) => setAiReportOutputs({...aiReportOutputs, noduedate: e.target.checked})}
                          style={{marginRight: '8px'}}
                        />
                        展示没填 Duedate 的 tickets
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px'}}>
                        <input 
                          type="checkbox"
                          checked={aiReportOutputs.overdue}
                          onChange={(e) => setAiReportOutputs({...aiReportOutputs, overdue: e.target.checked})}
                          style={{marginRight: '8px'}}
                        />
                        展示 Duedate 超时的 tickets
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px'}}>
                        <input 
                          type="checkbox"
                          checked={aiReportOutputs.toTest}
                          onChange={(e) => setAiReportOutputs({...aiReportOutputs, toTest: e.target.checked})}
                          style={{marginRight: '8px'}}
                        />
                        展示待 QA 验证的 tickets
                      </label>
                    </div>
                  </div>
                  
                  {/* Team ID */}
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>Team ID</label>
                    <input 
                      style={dialogStyles.input}
                      type="text"
                      value={aiReportTeamId}
                      onChange={(e) => setAiReportTeamId(e.target.value)}
                      placeholder="例如：148192141318"
                    />
                    <small style={dialogStyles.hint}>可选，填入后会将报告发送到指定群组</small>
                  </div>
                  
                  {/* @ 成员 */}
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>@ 成员</label>
                    <TagsInput
                      tags={aiReportMentionList}
                      onChange={setAiReportMentionList}
                      placeholder="输入人名后按 Enter 添加，例如：Esone Qiu 或 esone.qiu"
                    />
                    <small style={dialogStyles.hint}>
                      支持格式：<strong>Esone Qiu</strong> 或 <strong>esone.qiu</strong>，按 Enter 添加
                    </small>
                  </div>
                  
                  {/* 尾部添加文本 */}
                  <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>尾部添加文本</label>
                    <textarea 
                      style={dialogStyles.textarea}
                      value={aiReportExtraText}
                      onChange={(e) => setAiReportExtraText(e.target.value)}
                      placeholder="可选，在报告末尾添加自定义文本"
                      rows={2}
                    />
                  </div>
                </div>
              ) : (
                /* PEP Report 和自定义模板：显示 JSON 输入框 */
                  <>
                   {/* PEP Report 专用：群组 ID 输入框 */}
                   {aiReportTemplate === 'pep-report' && (
                     <div style={dialogStyles.formGroup}>
                       <label style={dialogStyles.label}>群组 ID</label>
                       <input 
                         style={dialogStyles.input}
                         type="text"
                         value={pepReportTeamId}
                         onChange={(e) => setPepReportTeamId(e.target.value)}
                         placeholder="例如：148192141318"
                       />
                       <small style={dialogStyles.hint}>可选，填入后会将报告发送到指定群组</small>
                     </div>
                   )}
 
                    <div style={dialogStyles.formGroup}>
                    <label style={dialogStyles.label}>Body *</label>
                    <textarea 
                      ref={bodyTextareaRef}
                      style={dialogStyles.textarea}
                      value={formData.AI_Body || ''}
                      onChange={(e) => handleChange('AI_Body', e.target.value)}
                      placeholder='{"key": "value"}'
                      rows={8}
                    />
                    <VariableSelector 
                      onInsert={insertVariableToBody}
                    />
                  </div>
                </>
              )}
            </>
          )}
          
          {/* 推送目标（仅 Bot/AsMe 时显示） */}
          {formData.Push_Method !== 'AI' && (
            <>
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>推送目标 *</label>
                <div style={dialogStyles.buttonGroup}>
                  <button
                    type="button"
                    style={getButtonStyle(formData.Target_Type === 'private')}
                    onClick={() => handleChange('Target_Type', 'private')}
                  >
                    💬 私发消息
                  </button>
                  <button
                    type="button"
                    style={getButtonStyle(formData.Target_Type === 'group')}
                    onClick={() => handleChange('Target_Type', 'group')}
                  >
                    👥 群组消息
                  </button>
                </div>
              </div>
              
              {/* 私发消息 - 用户名 */}
              {formData.Target_Type === 'private' && (
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>
                    接收人 * 
                    {formData.Push_Method === 'Bot' && <span style={{color: '#dc3545', marginLeft: '8px'}}>（Bot 模式只能填一个人名）</span>}
                  </label>
                  <TagsInput
                    tags={userTags}
                    onChange={handleUserTagsChange}
                    placeholder="输入人名后按 Enter 添加，例如：Esone Qiu 或 esone.qiu"
                    maxTags={formData.Push_Method === 'Bot' ? 1 : undefined}
                  />
                  <small style={dialogStyles.hint}>
                    支持格式：<strong>Esone Qiu</strong> 或 <strong>esone.qiu</strong>，按 Enter 添加
                  </small>
                </div>
              )}
              
              {/* 群组消息 - 群组 ID */}
              {formData.Target_Type === 'group' && (
                <div style={dialogStyles.formGroup}>
                  <label style={dialogStyles.label}>群组 ID *</label>
                  <input 
                    style={dialogStyles.input}
                    type="text"
                    value={formData.Glip_Team_ID || ''}
                    onChange={(e) => handleChange('Glip_Team_ID', e.target.value)}
                    placeholder="例如：148192141318"
                  />
                </div>
              )}
            </>
          )}
          </>
          )}
          
          {/* 提交按钮 */}
          <div style={dialogStyles.actions}>
            <button 
              type="button" 
              style={dialogStyles.cancelButton}
              onClick={onCancel}
              disabled={isSubmitting}
            >
              取消
            </button>
            <button 
              type="submit" 
              style={dialogStyles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? '创建中...' : '✅ 创建消息'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 按钮选择器样式辅助函数
const getButtonStyle = (isSelected: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '10px 16px',
  backgroundColor: isSelected ? '#007bff' : '#fff',
  color: isSelected ? '#fff' : '#333',
  border: `2px solid ${isSelected ? '#007bff' : '#ddd'}`,
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: isSelected ? 'bold' : 'normal',
  transition: 'all 0.2s',
});

const getTypeStyle = (pushMethod: string): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  };
  
  switch (pushMethod) {
    case 'AI':
      return { ...baseStyle, backgroundColor: '#e3f2fd', color: '#1976d2' }; // 蓝色 - AI Report
    case 'AsMe':
      return { ...baseStyle, backgroundColor: '#f3e5f5', color: '#7b1fa2' }; // 紫色 - 假装我发的
    case 'Bot':
      return { ...baseStyle, backgroundColor: '#fff3e0', color: '#f57c00' }; // 橙色 - Bot 定时
    default:
      return { ...baseStyle, backgroundColor: '#f5f5f5', color: '#666' };
  }
};

const getStatusStyle = (status: string): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  };
  
  switch (status) {
    case 'Active':
      return { ...baseStyle, backgroundColor: '#d4edda', color: '#155724' };
    case 'Paused':
      return { ...baseStyle, backgroundColor: '#fff3cd', color: '#856404' };
    case 'Completed':
      return { ...baseStyle, backgroundColor: '#d1ecf1', color: '#0c5460' };
    default:
      return { ...baseStyle, backgroundColor: '#f5f5f5', color: '#666' };
  }
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #007bff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  topicText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '300px',
    display: 'inline-block',
  },
  header: {
    backgroundColor: '#fff',
    padding: '20px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
  },
  headerActions: {
    display: 'flex',
    gap: '10px',
  },
  reminderButton: {
    padding: '8px 16px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  addButton: {
    padding: '8px 16px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  syncButton: {
    padding: '8px 16px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  configButton: {
    padding: '8px 16px',
    backgroundColor: '#6c757d',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  deleteButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: '#dc3545',
    border: '1px solid #dc3545',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  warningBanner: {
    backgroundColor: '#fff3cd',
    borderLeft: '4px solid #ffc107',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #ffc107',
    animation: 'slideDown 0.3s ease-out',
  },
  warningContent: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    flex: 1,
  },
  warningIcon: {
    fontSize: '24px',
    lineHeight: 1,
  },
  warningText: {
    flex: 1,
  },
  warningDescription: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#856404',
  },
  warningButton: {
    padding: '8px 16px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    marginLeft: '16px',
  },
  statusBar: {
    backgroundColor: '#fff',
    padding: '15px 20px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    gap: '20px',
  },
  statusItem: {
    fontSize: '14px',
    color: '#666',
  },
  content: {
    padding: '20px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: '#fff',
    borderRadius: '8px',
  },
  emptyText: {
    fontSize: '18px',
    color: '#666',
    marginBottom: '10px',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#999',
  },
  messageList: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '12px',
    textAlign: 'left',
    backgroundColor: '#f8f9fa',
    borderBottom: '2px solid #e0e0e0',
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#333',
  },
  tr: {
    borderBottom: '1px solid #e0e0e0',
  },
  td: {
    padding: '12px',
    fontSize: '14px',
    color: '#666',
  },
  footer: {
    padding: '20px',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '12px',
    color: '#999',
  },
  tooltip: {
    position: 'fixed',
    backgroundColor: '#333',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    maxWidth: '400px',
    zIndex: 10000,
    pointerEvents: 'none',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  },
  tooltipHeader: {
    fontWeight: 'bold',
    marginBottom: '4px',
    fontSize: '12px',
    color: '#ffc107',
  },
  tooltipContent: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
};

// 对话框样式
const dialogStyles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '0',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #e0e0e0',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#666',
    padding: '0',
    width: '30px',
    height: '30px',
  },
  form: {
    padding: '20px',
  },
  formGroup: {
    marginBottom: '16px',
    flex: '1',
  },
  formRow: {
    display: 'flex',
    gap: '16px',
  },
  section: {
    marginBottom: '16px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  hint: {
    display: 'block',
    marginTop: '4px',
    fontSize: '12px',
    color: '#999',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid #e0e0e0',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  submitButton: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
};

// 添加 CSS 动画
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  button:hover {
    opacity: 0.9;
  }
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
document.head.appendChild(styleSheet);

// Bot 配置对话框组件
const BotConfigDialog: React.FC<{
  config: SheetConfig;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ config, onClose, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'input' | 'testing' | 'creating'>('input');
  const [jiraUrl, setJiraUrl] = useState('https://jira.ringcentral.com');
  const [projectKey, setProjectKey] = useState('');
  
  // 使用 ref 跟踪组件是否已挂载
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // 获取授权 token
  const getAuthToken = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token || '');
        }
      });
    });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectKey.trim()) {
      setError('请输入 Jira Project Key');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      // 导入服务类
      const { JiraAutomationService } = await import('./JiraAutomationService');
      const jiraService = new JiraAutomationService();
      
      // 步骤 1: 测试连接
      setStep('testing');
      const testResult = await jiraService.testAccess({
        jiraUrl,
        projectKey: projectKey.toUpperCase()
      });
      
      if (!testResult.success) {
        throw new Error(testResult.message);
      }
      
      // 步骤 2: 创建规则
      setStep('creating');
      const ruleResult = await jiraService.createBotExecutorRule(
        {
          jiraUrl,
          projectKey: projectKey.toUpperCase()
        },
        config.webAppUrl
      );
      
      // 保存配置到 scheduledMessagesConfig.botExecutor
      const updatedConfig = {
        ...config,
        botExecutor: {
          ...ruleResult,
          jiraUrl,
        }
      };
      
      // 使用 ConfigSyncService 同步配置到 Sheet 和 Chrome Storage
      const token = await getAuthToken();
      const { ConfigSyncService } = await import('./ConfigSyncService');
      const syncService = new ConfigSyncService(token);
      await syncService.syncConfig(updatedConfig);
      
      onSuccess();
      
    } catch (err: any) {
      console.error('配置 Bot 失败:', err);
      if (isMountedRef.current) {
        setError(err.message || '配置失败，请重试');
        setStep('input');
      }
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };
  
  return (
    <div style={dialogStyles.overlay}>
      <div style={dialogStyles.dialog}>
        <div style={dialogStyles.header}>
          <h2 style={dialogStyles.title}>🤖 配置 Bot 推送</h2>
          <button 
            style={dialogStyles.closeButton} 
            onClick={onClose}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={dialogStyles.form}>
          {step === 'input' && (
            <>
              <div style={{
                backgroundColor: '#e7f3ff',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid #b3d7ff',
              }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
                  📋 配置说明
                </p>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
                  <li>需要您在 Jira 上有管理权限的项目</li>
                  <li>系统将在该项目下创建一个 Automation 规则</li>
                  <li>该规则每分钟执行一次，检查并发送 Bot 消息</li>
                  <li>✅ Bot 配置（API 地址、Token、ID）将自动从扩展设置中读取，无需手动填写</li>
                </ul>
              </div>
              
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>Jira URL *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    style={{...dialogStyles.input, flex: 1}}
                    type="text"
                    value={jiraUrl}
                    onChange={(e) => setJiraUrl(e.target.value)}
                    placeholder="https://jira.ringcentral.com"
                  />
                  <button
                    type="button"
                    onClick={() => window.open(jiraUrl, '_blank')}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#007bff',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      whiteSpace: 'nowrap',
                    }}
                    title="在新标签页中打开 Jira（需要先登录）"
                  >
                    🔗 打开 Jira
                  </button>
                </div>
                <small style={dialogStyles.hint}>
                  请确保您已在浏览器中登录此 Jira 实例
                </small>
              </div>
              
              <div style={dialogStyles.formGroup}>
                <label style={dialogStyles.label}>Project Key *</label>
                <input 
                  style={dialogStyles.input}
                  type="text"
                  value={projectKey}
                  onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                  placeholder="MTR"
                  maxLength={10}
                />
                <small style={dialogStyles.hint}>
                  请输入您有管理权限的项目 Key，如：MTR
                </small>
              </div>
              
              {error && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#f8d7da',
                  color: '#721c24',
                  borderRadius: '6px',
                  fontSize: '14px',
                  marginTop: '16px',
                  border: '1px solid #f5c6cb',
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                    ❌ 配置失败
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {error}
                  </div>
                </div>
              )}
            </>
          )}
          
          {step === 'testing' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={styles.spinner}></div>
              <p style={{ fontSize: '16px', color: '#333', marginTop: '20px' }}>
                正在测试 Jira 连接...
              </p>
            </div>
          )}
          
          {step === 'creating' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={styles.spinner}></div>
              <p style={{ fontSize: '16px', color: '#333', marginTop: '20px' }}>
                正在创建 Jira Automation 规则...
              </p>
              <p style={{ fontSize: '13px', color: '#999', marginTop: '10px' }}>
                这可能需要几秒钟，请稍候...
              </p>
            </div>
          )}
          
          {step === 'input' && (
            <div style={dialogStyles.actions}>
              <button 
                type="button" 
                style={dialogStyles.cancelButton}
                onClick={onClose}
                disabled={isSubmitting}
              >
                取消
              </button>
              <button 
                type="submit" 
                style={dialogStyles.submitButton}
                disabled={isSubmitting}
              >
                {isSubmitting ? '配置中...' : '✅ 开始配置'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

// 渲染应用
ReactDOM.render(
  <React.StrictMode>
    <ScheduledMessagesManager />
  </React.StrictMode>,
  document.getElementById('root')
);


