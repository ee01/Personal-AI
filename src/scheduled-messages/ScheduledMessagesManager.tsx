/**
 * 定时消息管理主页面
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect } from 'react';
import { OneClickSetup } from './components/OneClickSetup';
import { ScheduledMessageService } from './ScheduledMessageService';
import { ScheduledMessage, SheetConfig, InitializationResult, Statistics } from './types';

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
    executedToday: 0
  });
  const [service, setService] = useState<ScheduledMessageService | null>(null);
  
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
        
        // 获取 token 并加载数据
        const token = await getAuthToken();
        if (token) {
          const messageService = new ScheduledMessageService(token);
          setService(messageService);
          await loadMessages(messageService);
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
          <button style={styles.syncButton} onClick={handleSync} title="同步数据">
            🔄 同步
          </button>
          <button style={styles.configButton} onClick={handleOpenSheet} title="打开 Sheet">
            📊 打开 Sheet
          </button>
        </div>
      </header>
      
      <div style={styles.statusBar}>
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
          今日已执行: <strong style={{ color: '#007bff' }}>{statistics.executedToday}</strong>
        </span>
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
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>类型</th>
                  <th style={styles.th}>主题</th>
                  <th style={styles.th}>下次执行</th>
                  <th style={styles.th}>状态</th>
                  <th style={styles.th}>推送方式</th>
                  <th style={styles.th}>执行次数</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <tr key={message.ID} style={styles.tr}>
                    <td style={styles.td}>{message.ID}</td>
                    <td style={styles.td}>
                      <span style={getTypeStyle(message.Type)}>{message.Type}</span>
                    </td>
                    <td style={styles.td}>{message.Topic}</td>
                    <td style={styles.td}>{message.Next_Exec || '-'}</td>
                    <td style={styles.td}>
                      <span style={getStatusStyle(message.Status)}>{message.Status}</span>
                    </td>
                    <td style={styles.td}>{message.Push_Method}</td>
                    <td style={styles.td}>{message.Exec_Count || 0}</td>
                  </tr>
                ))}
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
    </div>
  );
};

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

// 添加 CSS 动画
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

// 渲染应用
ReactDOM.render(
  <React.StrictMode>
    <ScheduledMessagesManager />
  </React.StrictMode>,
  document.getElementById('root')
);


