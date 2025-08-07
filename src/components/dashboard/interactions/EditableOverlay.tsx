/**
 * 可编辑覆盖层组件 - 项目数据的批量编辑界面
 * 支持多种数据类型的快速编辑和批量保存
 */

import * as React from 'react';
import { useState, useEffect } from 'react';

interface ProjectData {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'in-progress' | 'at-risk' | 'completed';
  overallProgress: number;
  startDate: Date;
  endDate: Date;
  milestones: Milestone[];
  dependencies: any[];
  team: any[];
  risks: any[];
}

interface Milestone {
  id: string;
  name: string;
  description: string;
  progress: number;
  plannedDate: Date;
  actualDate?: Date;
  status: 'on-track' | 'at-risk' | 'delayed' | 'completed';
  tasks: Task[];
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done' | 'blocked';
  assignee: string;
  estimatedHours: number;
  actualHours?: number;
  priority: 'high' | 'medium' | 'low';
  startDate: Date;
  endDate: Date;
}

interface EditableOverlayProps {
  project: ProjectData;
  onSave: (changes: any) => void;
  onCancel: () => void;
}

interface PendingChange {
  id: string;
  type: 'project' | 'milestone' | 'task' | 'dependency' | 'risk';
  itemId: string;
  field: string;
  oldValue: any;
  newValue: any;
  description: string;
}

const EditableOverlay: React.FC<EditableOverlayProps> = ({
  project,
  onSave,
  onCancel
}) => {
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [activeSection, setActiveSection] = useState<'project' | 'milestones' | 'tasks' | 'review'>('project');
  const [editingProject, setEditingProject] = useState<ProjectData>(project);
  const [searchFilter, setSearchFilter] = useState('');
  const [changeFilter, setChangeFilter] = useState<'all' | 'project' | 'milestone' | 'task'>('all');

  useEffect(() => {
    setEditingProject(project);
  }, [project]);

  // 记录变更
  const recordChange = (
    type: PendingChange['type'],
    itemId: string,
    field: string,
    oldValue: any,
    newValue: any,
    description: string
  ) => {
    if (oldValue === newValue) return;

    const changeId = `${type}_${itemId}_${field}`;
    
    setPendingChanges(prev => {
      const existing = prev.find(c => c.id === changeId);
      if (existing) {
        return prev.map(c => c.id === changeId 
          ? { ...c, newValue, description }
          : c
        );
      } else {
        return [...prev, {
          id: changeId,
          type,
          itemId,
          field,
          oldValue,
          newValue,
          description
        }];
      }
    });
  };

  // 处理项目字段更新
  const updateProjectField = (field: keyof ProjectData, value: any) => {
    const oldValue = project[field];
    recordChange('project', project.id, field, oldValue, value, `更新项目${getFieldLabel(field)}`);
    
    setEditingProject(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 处理里程碑更新
  const updateMilestone = (milestoneId: string, field: string, value: any) => {
    const milestone = editingProject.milestones.find(m => m.id === milestoneId);
    if (!milestone) return;

    const oldValue = milestone[field as keyof Milestone];
    recordChange('milestone', milestoneId, field, oldValue, value, `更新里程碑"${milestone.name}"的${getFieldLabel(field)}`);

    setEditingProject(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => 
        m.id === milestoneId 
          ? { ...m, [field]: value }
          : m
      )
    }));
  };

  // 处理任务更新
  const updateTask = (milestoneId: string, taskId: string, field: string, value: any) => {
    const milestone = editingProject.milestones.find(m => m.id === milestoneId);
    const task = milestone?.tasks.find(t => t.id === taskId);
    if (!task) return;

    const oldValue = task[field as keyof Task];
    recordChange('task', taskId, field, oldValue, value, `更新任务"${task.title}"的${getFieldLabel(field)}`);

    setEditingProject(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => 
        m.id === milestoneId 
          ? {
              ...m,
              tasks: m.tasks.map(t => 
                t.id === taskId 
                  ? { ...t, [field]: value }
                  : t
              )
            }
          : m
      )
    }));
  };

  // 删除变更
  const removeChange = (changeId: string) => {
    setPendingChanges(prev => prev.filter(c => c.id !== changeId));
  };

  // 清空所有变更
  const clearAllChanges = () => {
    setPendingChanges([]);
    setEditingProject(project);
  };

  // 保存所有变更
  const saveAllChanges = () => {
    if (pendingChanges.length === 0) {
      onCancel();
      return;
    }

    const changes = {
      project: editingProject,
      pendingChanges,
      timestamp: Date.now()
    };

    onSave(changes);
  };

  // 获取字段标签
  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      name: '名称',
      description: '描述',
      status: '状态',
      progress: '进度',
      plannedDate: '计划日期',
      actualDate: '实际日期',
      startDate: '开始日期',
      endDate: '结束日期',
      assignee: '负责人',
      priority: '优先级',
      estimatedHours: '预估工时',
      actualHours: '实际工时',
      title: '标题',
      overallProgress: '总进度'
    };
    return labels[field] || field;
  };

  // 获取状态选项
  const getStatusOptions = (type: 'project' | 'milestone' | 'task') => {
    switch (type) {
      case 'project':
        return [
          { value: 'planning', label: '规划中' },
          { value: 'in-progress', label: '进行中' },
          { value: 'at-risk', label: '有风险' },
          { value: 'completed', label: '已完成' }
        ];
      case 'milestone':
        return [
          { value: 'on-track', label: '正常' },
          { value: 'at-risk', label: '有风险' },
          { value: 'delayed', label: '延期' },
          { value: 'completed', label: '已完成' }
        ];
      case 'task':
        return [
          { value: 'todo', label: '待办' },
          { value: 'in-progress', label: '进行中' },
          { value: 'done', label: '已完成' },
          { value: 'blocked', label: '阻塞' }
        ];
      default:
        return [];
    }
  };

  // 过滤变更
  const filteredChanges = pendingChanges.filter(change => {
    if (changeFilter !== 'all' && change.type !== changeFilter) return false;
    if (searchFilter && !change.description.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="editable-overlay">
      <div className="overlay-backdrop" onClick={onCancel} />
      
      <div className="overlay-content">
        {/* 头部 */}
        <div className="overlay-header">
          <h3>📝 编辑项目数据</h3>
          <div className="header-actions">
            <span className="changes-count">
              {pendingChanges.length} 个待保存变更
            </span>
            <button className="close-btn" onClick={onCancel}>×</button>
          </div>
        </div>

        {/* 导航标签 */}
        <div className="section-tabs">
          <button 
            className={activeSection === 'project' ? 'active' : ''}
            onClick={() => setActiveSection('project')}
          >
            📋 项目信息
          </button>
          <button 
            className={activeSection === 'milestones' ? 'active' : ''}
            onClick={() => setActiveSection('milestones')}
          >
            🎯 里程碑
          </button>
          <button 
            className={activeSection === 'tasks' ? 'active' : ''}
            onClick={() => setActiveSection('tasks')}
          >
            ✅ 任务
          </button>
          <button 
            className={activeSection === 'review' ? 'active' : ''}
            onClick={() => setActiveSection('review')}
          >
            🔍 审核变更 ({pendingChanges.length})
          </button>
        </div>

        {/* 内容区域 */}
        <div className="overlay-body">
          {activeSection === 'project' && (
            <div className="project-edit-section">
              <h4>项目基本信息</h4>
              
              <div className="form-grid">
                <div className="form-group">
                  <label>项目名称</label>
                  <input
                    type="text"
                    value={editingProject.name}
                    onChange={(e) => updateProjectField('name', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>项目状态</label>
                  <select
                    value={editingProject.status}
                    onChange={(e) => updateProjectField('status', e.target.value)}
                    className="form-select"
                  >
                    {getStatusOptions('project').map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>总进度</label>
                  <div className="progress-input-group">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editingProject.overallProgress}
                      onChange={(e) => updateProjectField('overallProgress', Number(e.target.value))}
                      className="progress-slider"
                    />
                    <span className="progress-value">{editingProject.overallProgress}%</span>
                  </div>
                </div>

                <div className="form-group full-width">
                  <label>项目描述</label>
                  <textarea
                    value={editingProject.description}
                    onChange={(e) => updateProjectField('description', e.target.value)}
                    className="form-textarea"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>开始日期</label>
                  <input
                    type="date"
                    value={editingProject.startDate.toISOString().split('T')[0]}
                    onChange={(e) => updateProjectField('startDate', new Date(e.target.value))}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>结束日期</label>
                  <input
                    type="date"
                    value={editingProject.endDate.toISOString().split('T')[0]}
                    onChange={(e) => updateProjectField('endDate', new Date(e.target.value))}
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'milestones' && (
            <div className="milestones-edit-section">
              <h4>里程碑管理</h4>
              
              {editingProject.milestones.map(milestone => (
                <div key={milestone.id} className="milestone-edit-card">
                  <div className="milestone-header">
                    <h5>{milestone.name}</h5>
                    <span className={`status-badge ${milestone.status}`}>
                      {getStatusOptions('milestone').find(s => s.value === milestone.status)?.label}
                    </span>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>里程碑名称</label>
                      <input
                        type="text"
                        value={milestone.name}
                        onChange={(e) => updateMilestone(milestone.id, 'name', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label>状态</label>
                      <select
                        value={milestone.status}
                        onChange={(e) => updateMilestone(milestone.id, 'status', e.target.value)}
                        className="form-select"
                      >
                        {getStatusOptions('milestone').map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>进度</label>
                      <div className="progress-input-group">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={milestone.progress}
                          onChange={(e) => updateMilestone(milestone.id, 'progress', Number(e.target.value))}
                          className="progress-slider"
                        />
                        <span className="progress-value">{milestone.progress}%</span>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>计划日期</label>
                      <input
                        type="date"
                        value={milestone.plannedDate.toISOString().split('T')[0]}
                        onChange={(e) => updateMilestone(milestone.id, 'plannedDate', new Date(e.target.value))}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group full-width">
                      <label>描述</label>
                      <textarea
                        value={milestone.description}
                        onChange={(e) => updateMilestone(milestone.id, 'description', e.target.value)}
                        className="form-textarea"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'tasks' && (
            <div className="tasks-edit-section">
              <h4>任务管理</h4>
              
              {editingProject.milestones.map(milestone => (
                <div key={milestone.id} className="milestone-tasks-group">
                  <h5>📍 {milestone.name}</h5>
                  
                  {milestone.tasks.map(task => (
                    <div key={task.id} className="task-edit-card">
                      <div className="task-header">
                        <span className="task-title">{task.title}</span>
                        <span className={`status-badge ${task.status}`}>
                          {getStatusOptions('task').find(s => s.value === task.status)?.label}
                        </span>
                      </div>

                      <div className="form-grid compact">
                        <div className="form-group">
                          <label>任务标题</label>
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) => updateTask(milestone.id, task.id, 'title', e.target.value)}
                            className="form-input"
                          />
                        </div>

                        <div className="form-group">
                          <label>状态</label>
                          <select
                            value={task.status}
                            onChange={(e) => updateTask(milestone.id, task.id, 'status', e.target.value)}
                            className="form-select"
                          >
                            {getStatusOptions('task').map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group">
                          <label>负责人</label>
                          <input
                            type="text"
                            value={task.assignee}
                            onChange={(e) => updateTask(milestone.id, task.id, 'assignee', e.target.value)}
                            className="form-input"
                          />
                        </div>

                        <div className="form-group">
                          <label>优先级</label>
                          <select
                            value={task.priority}
                            onChange={(e) => updateTask(milestone.id, task.id, 'priority', e.target.value)}
                            className="form-select"
                          >
                            <option value="high">高</option>
                            <option value="medium">中</option>
                            <option value="low">低</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label>预估工时</label>
                          <input
                            type="number"
                            value={task.estimatedHours}
                            onChange={(e) => updateTask(milestone.id, task.id, 'estimatedHours', Number(e.target.value))}
                            className="form-input"
                            min="0"
                            step="0.5"
                          />
                        </div>

                        <div className="form-group">
                          <label>实际工时</label>
                          <input
                            type="number"
                            value={task.actualHours || 0}
                            onChange={(e) => updateTask(milestone.id, task.id, 'actualHours', Number(e.target.value))}
                            className="form-input"
                            min="0"
                            step="0.5"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {activeSection === 'review' && (
            <div className="review-section">
              <div className="review-header">
                <h4>变更审核</h4>
                <div className="review-controls">
                  <input
                    type="text"
                    placeholder="搜索变更..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="search-input"
                  />
                  <select
                    value={changeFilter}
                    onChange={(e) => setChangeFilter(e.target.value as any)}
                    className="filter-select"
                  >
                    <option value="all">所有变更</option>
                    <option value="project">项目变更</option>
                    <option value="milestone">里程碑变更</option>
                    <option value="task">任务变更</option>
                  </select>
                </div>
              </div>

              <div className="changes-list">
                {filteredChanges.length === 0 ? (
                  <div className="no-changes">
                    {pendingChanges.length === 0 ? '暂无变更' : '没有匹配的变更'}
                  </div>
                ) : (
                  filteredChanges.map(change => (
                    <div key={change.id} className="change-item">
                      <div className="change-content">
                        <div className="change-description">{change.description}</div>
                        <div className="change-details">
                          <span className="change-type">{change.type}</span>
                          <span className="change-field">{getFieldLabel(change.field)}</span>
                          <span className="change-values">
                            <span className="old-value">{String(change.oldValue)}</span>
                            <span className="arrow">→</span>
                            <span className="new-value">{String(change.newValue)}</span>
                          </span>
                        </div>
                      </div>
                      <button 
                        className="remove-change-btn"
                        onClick={() => removeChange(change.id)}
                        title="移除此变更"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部操作区 */}
        <div className="overlay-footer">
          <div className="footer-left">
            {pendingChanges.length > 0 && (
              <button 
                className="clear-btn"
                onClick={clearAllChanges}
              >
                清空所有变更
              </button>
            )}
          </div>
          
          <div className="footer-right">
            <button 
              className="cancel-btn"
              onClick={onCancel}
            >
              取消
            </button>
            <button 
              className="save-btn"
              onClick={saveAllChanges}
              disabled={pendingChanges.length === 0}
            >
              保存变更 ({pendingChanges.length})
            </button>
          </div>
        </div>
      </div>

      {/* 样式 */}
      <style>{`
        .editable-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .overlay-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
        }

        .overlay-content {
          position: relative;
          width: 90vw;
          max-width: 1200px;
          height: 80vh;
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .overlay-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          background: #f8f9fa;
          border-bottom: 1px solid #e0e0e0;
        }

        .overlay-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #333;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .changes-count {
          font-size: 12px;
          color: #666;
          background: #f0f0f0;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .close-btn {
          width: 32px;
          height: 32px;
          border: none;
          background: #f0f0f0;
          border-radius: 50%;
          cursor: pointer;
          font-size: 18px;
          color: #666;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          background: #e0e0e0;
        }

        .section-tabs {
          display: flex;
          background: white;
          border-bottom: 1px solid #e0e0e0;
        }

        .section-tabs button {
          padding: 12px 20px;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 14px;
          color: #666;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }

        .section-tabs button:hover {
          color: #333;
          background: #f8f9fa;
        }

        .section-tabs button.active {
          color: #1890ff;
          border-bottom-color: #1890ff;
          background: #f8f9fa;
        }

        .overlay-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .overlay-body h4 {
          margin: 0 0 20px 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .overlay-body h5 {
          margin: 0 0 16px 0;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .form-grid.compact {
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group.full-width {
          grid-column: 1 / -1;
        }

        .form-group label {
          font-size: 12px;
          font-weight: 500;
          color: #666;
        }

        .form-input,
        .form-select,
        .form-textarea {
          padding: 8px 12px;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          font-size: 14px;
          background: white;
        }

        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          outline: none;
          border-color: #1890ff;
          box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
        }

        .progress-input-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .progress-slider {
          flex: 1;
        }

        .progress-value {
          font-size: 12px;
          font-weight: 600;
          color: #333;
          min-width: 40px;
        }

        .milestone-edit-card,
        .task-edit-card {
          background: #fafafa;
          border: 1px solid #f0f0f0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .milestone-header,
        .task-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .milestone-tasks-group {
          margin-bottom: 24px;
        }

        .task-title {
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }

        .status-badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
          color: white;
        }

        .status-badge.planning,
        .status-badge.todo { background: #d9d9d9; color: #666; }
        .status-badge.in-progress { background: #1890ff; }
        .status-badge.at-risk { background: #fa8c16; }
        .status-badge.delayed,
        .status-badge.blocked { background: #ff4d4f; }
        .status-badge.completed,
        .status-badge.done { background: #52c41a; }
        .status-badge.on-track { background: #52c41a; }

        .review-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .review-controls {
          display: flex;
          gap: 12px;
        }

        .search-input,
        .filter-select {
          padding: 6px 12px;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          font-size: 12px;
        }

        .changes-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .no-changes {
          text-align: center;
          padding: 40px;
          color: #666;
          font-size: 14px;
        }

        .change-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 12px;
          background: #f8f9fa;
          border: 1px solid #f0f0f0;
          border-radius: 6px;
        }

        .change-content {
          flex: 1;
        }

        .change-description {
          font-size: 14px;
          font-weight: 500;
          color: #333;
          margin-bottom: 6px;
        }

        .change-details {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
        }

        .change-type {
          background: #e6f7ff;
          color: #1890ff;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
        }

        .change-field {
          background: #f6ffed;
          color: #52c41a;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
        }

        .change-values {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .old-value {
          color: #ff4d4f;
          text-decoration: line-through;
        }

        .arrow {
          color: #666;
        }

        .new-value {
          color: #52c41a;
          font-weight: 500;
        }

        .remove-change-btn {
          width: 24px;
          height: 24px;
          border: none;
          background: #ff4d4f;
          color: white;
          border-radius: 50%;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .remove-change-btn:hover {
          background: #ff7875;
        }

        .overlay-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          background: #f8f9fa;
          border-top: 1px solid #e0e0e0;
        }

        .footer-left,
        .footer-right {
          display: flex;
          gap: 12px;
        }

        .clear-btn,
        .cancel-btn,
        .save-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .clear-btn {
          background: #f0f0f0;
          color: #666;
        }

        .clear-btn:hover {
          background: #e0e0e0;
        }

        .cancel-btn {
          background: #f0f0f0;
          color: #666;
        }

        .cancel-btn:hover {
          background: #e0e0e0;
        }

        .save-btn {
          background: #1890ff;
          color: white;
          font-weight: 500;
        }

        .save-btn:hover:not(:disabled) {
          background: #40a9ff;
        }

        .save-btn:disabled {
          background: #d9d9d9;
          color: #bbb;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export { EditableOverlay };