import React, { useState, useEffect } from 'react';
import { Logger, LogCategory, LogEntry } from '../utils/logger';

const CATEGORIES: { id: LogCategory; name: string; emoji: string }[] = [
  { id: 'auth', name: '授权日志', emoji: '🔐' },
  { id: 'upgrade', name: '升级日志', emoji: '📦' },
  { id: 'analysis', name: '分析日志', emoji: '📊' },
  { id: 'task', name: '任务日志', emoji: '⚡' },
  { id: 'error', name: '错误日志', emoji: '❌' },
  { id: 'lifecycle', name: '生命周期', emoji: '🔄' },
];

export const AuthLogViewer: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<LogCategory>('auth');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadLogs = () => {
    setLogs(Logger.get(selectedCategory).getLogs());
  };

  useEffect(() => {
    loadLogs();
    setExpandedIndex(null);
    
    if (autoRefresh) {
      const interval = setInterval(loadLogs, 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedCategory]);

  const handleClear = () => {
    if (confirm(`确定要清空 ${CATEGORIES.find(c => c.id === selectedCategory)?.name} 吗？`)) {
      Logger.get(selectedCategory).clear();
      loadLogs();
    }
  };

  const handleClearAll = () => {
    if (confirm('确定要清空所有类别的日志吗？')) {
      CATEGORIES.forEach(cat => Logger.get(cat.id).clear());
      loadLogs();
    }
  };

  const handleExport = () => {
    const text = Logger.get(selectedCategory).export();
    navigator.clipboard.writeText(text).then(() => {
      alert('日志已复制到剪贴板！');
    });
  };

  const handleExportAll = () => {
    const text = CATEGORIES
      .map(cat => Logger.get(cat.id).export())
      .join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      alert('所有日志已复制到剪贴板！');
    });
  };

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const getCategoryCount = (categoryId: LogCategory) => {
    return Logger.get(categoryId).getLogs().length;
  };

  const currentCategory = CATEGORIES.find(c => c.id === selectedCategory)!;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📋 Personal AI 日志系统</h2>
        <div style={styles.actions}>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            自动刷新
          </label>
          <button onClick={loadLogs} style={styles.button}>
            🔄 刷新
          </button>
          <button onClick={handleExport} style={styles.button}>
            📋 复制当前
          </button>
          <button onClick={handleExportAll} style={styles.button}>
            📋 复制全部
          </button>
          <button onClick={handleClear} style={styles.buttonWarning}>
            🗑️ 清空当前
          </button>
          <button onClick={handleClearAll} style={styles.buttonDanger}>
            🗑️ 清空全部
          </button>
        </div>
      </div>

      {/* 类别选择标签 */}
      <div style={styles.tabs}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            style={{
              ...styles.tab,
              ...(selectedCategory === cat.id ? styles.tabActive : {}),
            }}
          >
            {cat.emoji} {cat.name}
            <span style={styles.tabBadge}>{getCategoryCount(cat.id)}</span>
          </button>
        ))}
      </div>

      {/* 日志列表 */}
      <div style={styles.logContainer}>
        <h3 style={styles.sectionTitle}>
          {currentCategory.emoji} {currentCategory.name} ({logs.length} 条)
        </h3>

        {logs.length === 0 ? (
          <div style={styles.empty}>暂无日志</div>
        ) : (
          <div style={styles.logList}>
            {logs.map((log, index) => (
              <div key={index} style={styles.logItem}>
                <div
                  style={styles.logHeader}
                  onClick={() => toggleExpand(index)}
                >
                  <span style={styles.logEmoji}>
                    {log.success ? '✅' : '❌'}
                  </span>
                  <span style={styles.logTime}>
                    {new Date(log.timestamp).toLocaleString('zh-CN')}
                  </span>
                  <span style={styles.logLocation}>{log.location}</span>
                  {log.message && (
                    <span style={styles.logMessage}>{log.message}</span>
                  )}
                  <span style={styles.expandIcon}>
                    {expandedIndex === index ? '▼' : '▶'}
                  </span>
                </div>

                {expandedIndex === index && (
                  <div style={styles.logDetails}>
                    {log.data && Object.keys(log.data).length > 0 && (
                      <div style={styles.logData}>
                        <strong>数据:</strong>
                        <pre style={styles.dataPre}>
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.stack && (
                      <div style={styles.logStack}>
                        <strong>调用栈:</strong>
                        <pre style={styles.stackPre}>{log.stack}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    maxWidth: '1400px',
    margin: '0 auto',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    backgroundColor: 'white',
    padding: '15px 20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    margin: 0,
    fontSize: '24px',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    cursor: 'pointer',
  },
  button: {
    padding: '8px 16px',
    backgroundColor: '#4285f4',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  buttonWarning: {
    padding: '8px 16px',
    backgroundColor: '#ff9800',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  buttonDanger: {
    padding: '8px 16px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  tab: {
    padding: '10px 16px',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
  },
  tabActive: {
    backgroundColor: '#4285f4',
    color: 'white',
    borderColor: '#4285f4',
  },
  tabBadge: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
  },
  logContainer: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    margin: '0 0 15px 0',
    fontSize: '18px',
    color: '#333',
  },
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: '#999',
    fontSize: '16px',
  },
  logList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  logItem: {
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  logHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    cursor: 'pointer',
    backgroundColor: '#f8f9fa',
    gap: '12px',
  },
  logEmoji: {
    fontSize: '18px',
  },
  logTime: {
    fontSize: '13px',
    color: '#666',
    minWidth: '160px',
  },
  logLocation: {
    fontSize: '14px',
    fontWeight: 'bold',
    minWidth: '200px',
  },
  logMessage: {
    fontSize: '14px',
    color: '#666',
    flex: 1,
  },
  expandIcon: {
    fontSize: '12px',
    color: '#999',
  },
  logDetails: {
    padding: '12px',
    backgroundColor: 'white',
    borderTop: '1px solid #e0e0e0',
  },
  logData: {
    marginBottom: '12px',
    fontSize: '13px',
  },
  dataPre: {
    marginTop: '8px',
    padding: '12px',
    backgroundColor: '#e8f4fd',
    borderRadius: '4px',
    overflow: 'auto',
    fontSize: '12px',
    fontFamily: 'Monaco, Consolas, monospace',
    lineHeight: '1.5',
  },
  logStack: {
    fontSize: '13px',
  },
  stackPre: {
    marginTop: '8px',
    padding: '12px',
    backgroundColor: '#f4f4f4',
    borderRadius: '4px',
    overflow: 'auto',
    fontSize: '12px',
    fontFamily: 'Monaco, Consolas, monospace',
    lineHeight: '1.5',
  },
};
