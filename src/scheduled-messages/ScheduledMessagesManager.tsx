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
  
  useEffect(() => {
    initializeApp();
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
                  <th style={styles.th}>下次执行</th>
                  <th style={styles.th}>状态</th>
                  <th style={styles.th}>推送方式</th>
                  <th style={styles.th}>执行次数</th>
                  <th style={styles.th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => {
                  const displayTitle = message.Topic || (message.Content.length > 30 ? message.Content.substring(0, 30) + '...' : message.Content);
                  return (
                    <tr key={message.ID} style={styles.tr}>
                      <td style={styles.td}>
                        <span style={getTypeStyle(message.Type)}>{message.Type}</span>
                      </td>
                      <td style={styles.td} title={message.Content}>
                        <span style={styles.topicText}>{displayTitle}</span>
                      </td>
                      <td style={styles.td}>{message.Next_Exec || '-'}</td>
                      <td style={styles.td}>
                        <span 
                          style={{...getStatusStyle(message.Status), cursor: 'pointer'}} 
                          onClick={() => handleToggleStatus(message)}
                          title={`点击切换为${message.Status === 'Active' ? '禁用' : '启用'}`}
                        >
                          {message.Status}
                        </span>
                      </td>
                      <td style={styles.td}>{message.Push_Method}</td>
                      <td style={styles.td}>{message.Exec_Count || 0}</td>
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
   * 将多个用户名转换为存储格式（用+连接）
   */
  joinForStorage: (displayNames: string[]): string => {
    return displayNames
      .map(name => formatUserName.toStorageFormat(name))
      .join('+');
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

// 新增消息对话框组件
const AddMessageDialog: React.FC<{
  onSubmit: (data: CreateMessageFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  botConfigured: boolean;
  onConfigureBot: () => void;
}> = ({ onSubmit, onCancel, isSubmitting, botConfigured, onConfigureBot }) => {
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
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 验证必填字段
    if (!formData.Topic || !formData.Content || !formData.Schedule_Date) {
      alert('请填写所有必填字段');
      return;
    }
    
    // 验证推送目标
    if (formData.Target_Type === 'private' && userTags.length === 0) {
      alert('请至少添加一个接收人');
      return;
    }
    
    if (formData.Target_Type === 'group' && !formData.Glip_Team_ID) {
      alert('请填写群组 ID');
      return;
    }
    
    // 验证周期性消息
    if (isRepeating) {
      if (!formData.Repeat_Every || !formData.Repeat_Unit) {
        alert('请完整填写重复设置');
        return;
      }
    }
    
    // 合并 userTags 到 Glip_User_Name（转换为存储格式：esone.qiu+john.doe）
    const finalFormData: CreateMessageFormData = {
      ...formData,
      Glip_User_Name: formatUserName.joinForStorage(userTags),
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
          <h2 style={dialogStyles.title}>➕ 新增定时消息</h2>
          <button style={dialogStyles.closeButton} onClick={onCancel}>✕</button>
        </div>
        
        <form onSubmit={handleSubmit} style={dialogStyles.form}>
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
          
          {/* 消息内容 */}
          <div style={dialogStyles.formGroup}>
            <label style={dialogStyles.label}>消息内容 *</label>
            <textarea 
              style={dialogStyles.textarea}
              value={formData.Content}
              onChange={(e) => handleChange('Content', e.target.value)}
              placeholder="输入消息内容"
              rows={4}
            />
          </div>
          
          {/* 执行时间 */}
          <div style={dialogStyles.formRow}>
            <div style={dialogStyles.formGroup}>
              <label style={dialogStyles.label}>执行日期 *</label>
              <input 
                style={dialogStyles.input}
                type="date"
                value={formData.Schedule_Date}
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
          
          {/* 是否重复 Toggle */}
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
          
          {/* 重复设置 */}
          {isRepeating && (
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
           </div>
          
          {/* 推送目标 */}
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

const getTypeStyle = (type: string): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  };
  
  switch (type) {
    case 'Daily':
      return { ...baseStyle, backgroundColor: '#e3f2fd', color: '#1976d2' };
    case 'Hourly':
      return { ...baseStyle, backgroundColor: '#f3e5f5', color: '#7b1fa2' };
    case 'Periodic':
      return { ...baseStyle, backgroundColor: '#fff3e0', color: '#f57c00' };
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
      
      await chrome.storage.local.set({
        scheduledMessagesConfig: updatedConfig
      });
      
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


