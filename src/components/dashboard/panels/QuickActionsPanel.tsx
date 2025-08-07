/**
 * 快速操作面板组件 - 项目管理快捷操作
 * 支持常用操作、快捷创建、状态更新等功能
 */

import * as React from 'react';
import { useState } from 'react';

interface ProjectData {
  id: string;
  name: string;
  status: 'planning' | 'in-progress' | 'at-risk' | 'completed';
  overallProgress: number;
  milestones: any[];
  team: any[];
  risks: any[];
}

interface QuickActionsPanelProps {
  project: ProjectData;
  onAction: (action: string, data: any) => void;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  type: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  description?: string;
  shortcut?: string;
  disabled?: boolean;
}

const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  project,
  onAction
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [createType, setCreateType] = useState<'milestone' | 'task' | 'risk' | null>(null);
  const [quickNote, setQuickNote] = useState('');

  // 定义快速操作
  const quickActions: QuickAction[] = [
    {
      id: 'sync_data',
      label: '同步数据',
      icon: '🔄',
      type: 'primary',
      description: '从Jira等数据源同步最新数据',
      shortcut: 'Ctrl+R'
    },
    {
      id: 'export_report',
      label: '导出报告',
      icon: '📊',
      type: 'secondary',
      description: '生成项目进度报告',
      shortcut: 'Ctrl+E'
    },
    {
      id: 'schedule_meeting',
      label: '安排会议',
      icon: '📅',
      type: 'secondary',
      description: '快速安排项目会议'
    },
    {
      id: 'send_update',
      label: '发送更新',
      icon: '📧',
      type: 'secondary',
      description: '向团队发送项目更新'
    },
    {
      id: 'add_milestone',
      label: '新增里程碑',
      icon: '🎯',
      type: 'success',
      description: '添加新的项目里程碑'
    },
    {
      id: 'create_task',
      label: '创建任务',
      icon: '✅',
      type: 'success',
      description: '快速创建新任务'
    },
    {
      id: 'log_risk',
      label: '记录风险',
      icon: '⚠️',
      type: 'warning',
      description: '记录新的项目风险'
    },
    {
      id: 'emergency_stop',
      label: '紧急暂停',
      icon: '🛑',
      type: 'danger',
      description: '紧急暂停项目进度',
      disabled: project.status === 'completed'
    }
  ];

  // 最近操作历史
  const recentActions = [
    { action: '更新里程碑状态', time: '5分钟前', user: '张三' },
    { action: '同步Jira数据', time: '15分钟前', user: '系统' },
    { action: '创建风险记录', time: '1小时前', user: '李四' },
    { action: '导出周报', time: '2小时前', user: '王五' }
  ];

  // 项目状态快速更新选项
  const statusOptions = [
    { value: 'planning', label: '规划中', color: '#d9d9d9' },
    { value: 'in-progress', label: '进行中', color: '#1890ff' },
    { value: 'at-risk', label: '有风险', color: '#fa8c16' },
    { value: 'completed', label: '已完成', color: '#52c41a' }
  ];

  // 处理快速操作
  const handleQuickAction = (action: QuickAction) => {
    if (action.disabled) return;

    switch (action.id) {
      case 'add_milestone':
      case 'create_task':
      case 'log_risk':
        setCreateType(action.id.split('_')[1] as any || action.id.replace('add_', '').replace('create_', '').replace('log_', '') as any);
        setIsCreating(true);
        break;
      
      default:
        onAction(action.id, { 
          projectId: project.id,
          timestamp: Date.now()
        });
        break;
    }
  };

  // 处理状态更新
  const handleStatusChange = (newStatus: string) => {
    onAction('update_project_status', {
      projectId: project.id,
      status: newStatus,
      timestamp: Date.now()
    });
  };

  // 处理快速创建
  const handleQuickCreate = () => {
    if (!createType || !quickNote.trim()) return;

    onAction(`create_${createType}`, {
      projectId: project.id,
      type: createType,
      content: quickNote.trim(),
      timestamp: Date.now()
    });

    setQuickNote('');
    setIsCreating(false);
    setCreateType(null);
  };

  // 获取操作按钮样式
  const getActionButtonClass = (type: string, disabled?: boolean): string => {
    if (disabled) return 'action-btn disabled';
    
    const baseClass = 'action-btn';
    switch (type) {
      case 'primary': return `${baseClass} primary`;
      case 'secondary': return `${baseClass} secondary`;
      case 'success': return `${baseClass} success`;
      case 'warning': return `${baseClass} warning`;
      case 'danger': return `${baseClass} danger`;
      default: return baseClass;
    }
  };

  return (
    <div className="quick-actions-panel">
      {/* 头部 */}
      <div className="panel-header">
        <h4>⚡ 快速操作</h4>
        <div className="project-status">
          <select 
            value={project.status} 
            onChange={(e) => handleStatusChange(e.target.value)}
            className="status-selector"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 项目快照 */}
      <div className="project-snapshot">
        <div className="snapshot-item">
          <span className="snapshot-label">进度</span>
          <div className="progress-ring">
            <svg width="40" height="40" viewBox="0 0 40 40">
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="#f0f0f0"
                strokeWidth="4"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="#1890ff"
                strokeWidth="4"
                strokeDasharray={`${project.overallProgress} ${100 - project.overallProgress}`}
                strokeDashoffset="25"
                transform="rotate(-90 20 20)"
              />
            </svg>
            <span className="progress-text">{project.overallProgress}%</span>
          </div>
        </div>
        
        <div className="snapshot-stats">
          <div className="stat-item">
            <span className="stat-icon">🎯</span>
            <span className="stat-value">{project.milestones?.length || 0}</span>
            <span className="stat-label">里程碑</span>
          </div>
          <div className="stat-item">
            <span className="stat-icon">👥</span>
            <span className="stat-value">{project.team?.length || 0}</span>
            <span className="stat-label">团队</span>
          </div>
          <div className="stat-item">
            <span className="stat-icon">⚠️</span>
            <span className="stat-value">{project.risks?.length || 0}</span>
            <span className="stat-label">风险</span>
          </div>
        </div>
      </div>

      {/* 快速操作按钮 */}
      <div className="actions-section">
        <h5>常用操作</h5>
        <div className="actions-grid">
          {quickActions.map(action => (
            <button
              key={action.id}
              className={getActionButtonClass(action.type, action.disabled)}
              onClick={() => handleQuickAction(action)}
              disabled={action.disabled}
              title={action.description}
            >
              <span className="action-icon">{action.icon}</span>
              <span className="action-label">{action.label}</span>
              {action.shortcut && (
                <span className="action-shortcut">{action.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 快速创建表单 */}
      {isCreating && (
        <div className="quick-create-form">
          <h5>
            快速创建 
            {createType === 'milestone' ? '里程碑' :
             createType === 'task' ? '任务' :
             createType === 'risk' ? '风险' : ''}
          </h5>
          <textarea
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            placeholder={
              createType === 'milestone' ? '输入里程碑名称和描述...' :
              createType === 'task' ? '输入任务标题和描述...' :
              createType === 'risk' ? '描述风险内容和影响...' : '输入内容...'
            }
            className="quick-note-input"
            rows={3}
            autoFocus
          />
          <div className="form-actions">
            <button 
              className="create-btn"
              onClick={handleQuickCreate}
              disabled={!quickNote.trim()}
            >
              创建
            </button>
            <button 
              className="cancel-btn"
              onClick={() => {
                setIsCreating(false);
                setCreateType(null);
                setQuickNote('');
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 最近操作 */}
      <div className="recent-actions-section">
        <h5>最近操作</h5>
        <div className="recent-actions-list">
          {recentActions.map((item, index) => (
            <div key={index} className="recent-action-item">
              <div className="action-content">
                <span className="action-text">{item.action}</span>
                <span className="action-user">by {item.user}</span>
              </div>
              <span className="action-time">{item.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 快捷键提示 */}
      <div className="shortcuts-section">
        <h5>快捷键</h5>
        <div className="shortcuts-list">
          <div className="shortcut-item">
            <kbd>Ctrl+R</kbd>
            <span>同步数据</span>
          </div>
          <div className="shortcut-item">
            <kbd>Ctrl+E</kbd>
            <span>导出报告</span>
          </div>
          <div className="shortcut-item">
            <kbd>Ctrl+N</kbd>
            <span>新建任务</span>
          </div>
        </div>
      </div>

      {/* 样式 */}
      <style>{`
        .quick-actions-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: white;
          border-radius: 8px;
          overflow: hidden;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e0e0e0;
        }

        .panel-header h4 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .status-selector {
          padding: 4px 8px;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          font-size: 12px;
          background: white;
        }

        .project-snapshot {
          padding: 16px 20px;
          background: #fafafa;
          border-bottom: 1px solid #f0f0f0;
        }

        .snapshot-item {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .snapshot-label {
          font-size: 12px;
          color: #666;
          font-weight: 500;
        }

        .progress-ring {
          position: relative;
          width: 40px;
          height: 40px;
        }

        .progress-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 10px;
          font-weight: 600;
          color: #333;
        }

        .snapshot-stats {
          display: flex;
          justify-content: space-around;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .stat-icon {
          font-size: 16px;
        }

        .stat-value {
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .stat-label {
          font-size: 10px;
          color: #666;
        }

        .actions-section {
          padding: 16px 20px;
          border-bottom: 1px solid #f0f0f0;
        }

        .actions-section h5 {
          margin: 0 0 12px 0;
          font-size: 13px;
          font-weight: 600;
          color: #333;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 8px;
          border: 1px solid #d0d0d0;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .action-btn:hover:not(.disabled) {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .action-btn.primary {
          border-color: #1890ff;
          background: linear-gradient(135deg, #1890ff, #40a9ff);
          color: white;
        }

        .action-btn.secondary {
          border-color: #d0d0d0;
          background: white;
          color: #333;
        }

        .action-btn.success {
          border-color: #52c41a;
          background: linear-gradient(135deg, #52c41a, #73d13d);
          color: white;
        }

        .action-btn.warning {
          border-color: #fa8c16;
          background: linear-gradient(135deg, #fa8c16, #ffa940);
          color: white;
        }

        .action-btn.danger {
          border-color: #ff4d4f;
          background: linear-gradient(135deg, #ff4d4f, #ff7875);
          color: white;
        }

        .action-btn.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .action-icon {
          font-size: 16px;
        }

        .action-label {
          font-size: 10px;
          font-weight: 500;
          text-align: center;
          line-height: 1.2;
        }

        .action-shortcut {
          position: absolute;
          top: 4px;
          right: 4px;
          font-size: 8px;
          opacity: 0.7;
          background: rgba(255,255,255,0.2);
          padding: 1px 3px;
          border-radius: 2px;
        }

        .quick-create-form {
          padding: 16px 20px;
          background: #fff7e6;
          border-bottom: 1px solid #ffd591;
        }

        .quick-create-form h5 {
          margin: 0 0 12px 0;
          font-size: 13px;
          font-weight: 600;
          color: #333;
        }

        .quick-note-input {
          width: 100%;
          padding: 8px;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          font-size: 12px;
          resize: vertical;
          margin-bottom: 12px;
        }

        .form-actions {
          display: flex;
          gap: 8px;
        }

        .create-btn,
        .cancel-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .create-btn {
          background: #52c41a;
          color: white;
          font-weight: 500;
        }

        .create-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .cancel-btn {
          background: #f0f0f0;
          color: #666;
        }

        .create-btn:hover:not(:disabled),
        .cancel-btn:hover {
          opacity: 0.8;
        }

        .recent-actions-section {
          padding: 16px 20px;
          border-bottom: 1px solid #f0f0f0;
        }

        .recent-actions-section h5 {
          margin: 0 0 12px 0;
          font-size: 13px;
          font-weight: 600;
          color: #333;
        }

        .recent-actions-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .recent-action-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 8px;
          background: #fafafa;
          border-radius: 4px;
        }

        .action-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .action-text {
          font-size: 11px;
          color: #333;
          font-weight: 500;
        }

        .action-user {
          font-size: 10px;
          color: #666;
        }

        .action-time {
          font-size: 10px;
          color: #999;
          white-space: nowrap;
        }

        .shortcuts-section {
          padding: 16px 20px;
        }

        .shortcuts-section h5 {
          margin: 0 0 12px 0;
          font-size: 13px;
          font-weight: 600;
          color: #333;
        }

        .shortcuts-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .shortcut-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
        }

        .shortcut-item kbd {
          padding: 2px 6px;
          background: #f0f0f0;
          border: 1px solid #d0d0d0;
          border-radius: 3px;
          font-size: 10px;
          font-family: monospace;
          color: #666;
        }

        .shortcut-item span {
          color: #666;
        }
      `}</style>
    </div>
  );
};

export { QuickActionsPanel };