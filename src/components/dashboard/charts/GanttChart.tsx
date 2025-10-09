/**
 * 甘特图组件 - 项目时间线和任务可视化
 * 支持交互式编辑和依赖关系展示
 */

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done' | 'blocked';
  assignee: string;
  estimatedHours: number;
  actualHours?: number;
  priority: 'high' | 'medium' | 'low';
  jiraTicketId?: string;
  dependencies: string[];
  startDate: Date;
  endDate: Date;
}

interface Milestone {
  id: string;
  name: string;
  description: string;
  progress: number;
  plannedDate: Date;
  actualDate?: Date;
  status: 'on-track' | 'at-risk' | 'delayed' | 'completed';
  dependencies: string[];
  assignees: any[];
  tasks: Task[];
}

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

interface GanttChartProps {
  project: ProjectData;
  editable?: boolean;
  onTaskEdit?: (itemType: string, itemId: string, changes: any) => void;
  onMilestoneEdit?: (itemType: string, itemId: string, changes: any) => void;
}

interface GanttBarData {
  id: string;
  name: string;
  type: 'milestone' | 'task';
  startDate: Date;
  endDate: Date;
  progress: number;
  status: string;
  assignee?: string;
  dependencies: string[];
  level: number; // 层级，用于缩进
}

const GanttChart: React.FC<GanttChartProps> = ({
  project,
  editable = false,
  onTaskEdit,
  onMilestoneEdit
}) => {
  const [ganttData, setGanttData] = useState<GanttBarData[]>([]);
  const [timeScale, setTimeScale] = useState<'day' | 'week' | 'month'>('week');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragData, setDragData] = useState<{
    itemId: string;
    startX: number;
    originalStart: Date;
    originalEnd: Date;
  } | null>(null);

  const chartRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (project) {
      const data = buildGanttData(project);
      setGanttData(data);
    }
  }, [project]);

  // 构建甘特图数据
  const buildGanttData = (project: ProjectData): GanttBarData[] => {
    const data: GanttBarData[] = [];
    
    // 添加项目本身
    data.push({
      id: project.id,
      name: project.name,
      type: 'milestone',
      startDate: project.startDate,
      endDate: project.endDate,
      progress: project.overallProgress,
      status: project.status,
      dependencies: [],
      level: 0
    });

    // 添加里程碑和任务
    project.milestones.forEach(milestone => {
      data.push({
        id: milestone.id,
        name: milestone.name,
        type: 'milestone',
        startDate: milestone.tasks.length > 0 
          ? new Date(Math.min(...milestone.tasks.map(t => t.startDate.getTime())))
          : milestone.plannedDate,
        endDate: milestone.actualDate || milestone.plannedDate,
        progress: milestone.progress,
        status: milestone.status,
        dependencies: milestone.dependencies,
        level: 1
      });

      // 添加里程碑下的任务
      milestone.tasks.forEach(task => {
        data.push({
          id: task.id,
          name: task.title,
          type: 'task',
          startDate: task.startDate,
          endDate: task.endDate,
          progress: task.status === 'done' ? 100 : 
                   task.status === 'in-progress' ? 50 : 0,
          status: task.status,
          assignee: task.assignee,
          dependencies: task.dependencies,
          level: 2
        });
      });
    });

    return data;
  };

  // 计算时间范围
  const getTimeRange = () => {
    if (ganttData.length === 0) {
      const now = new Date();
      return {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      };
    }

    const startDate = new Date(Math.min(...ganttData.map(item => item.startDate.getTime())));
    const endDate = new Date(Math.max(...ganttData.map(item => item.endDate.getTime())));
    
    // 添加一些缓冲时间
    const buffer = (endDate.getTime() - startDate.getTime()) * 0.1;
    return {
      start: new Date(startDate.getTime() - buffer),
      end: new Date(endDate.getTime() + buffer)
    };
  };

  // 生成时间标尺
  const generateTimeMarkers = () => {
    const { start, end } = getTimeRange();
    const markers: Date[] = [];
    const current = new Date(start);

    switch (timeScale) {
      case 'day':
        while (current <= end) {
          markers.push(new Date(current));
          current.setDate(current.getDate() + 1);
        }
        break;
      case 'week':
        // 对齐到周一
        current.setDate(current.getDate() - current.getDay() + 1);
        while (current <= end) {
          markers.push(new Date(current));
          current.setDate(current.getDate() + 7);
        }
        break;
      case 'month':
        current.setDate(1);
        while (current <= end) {
          markers.push(new Date(current));
          current.setMonth(current.getMonth() + 1);
        }
        break;
    }

    return markers;
  };

  // 计算条形图位置
  const calculateBarPosition = (item: GanttBarData) => {
    const { start, end } = getTimeRange();
    const totalDuration = end.getTime() - start.getTime();
    const itemStart = item.startDate.getTime() - start.getTime();
    const itemDuration = item.endDate.getTime() - item.startDate.getTime();

    const left = (itemStart / totalDuration) * 100;
    const width = (itemDuration / totalDuration) * 100;

    return { left: `${left}%`, width: `${width}%` };
  };

  // 处理条形图点击
  const handleBarClick = (item: GanttBarData) => {
    setSelectedItem(selectedItem === item.id ? null : item.id);
  };

  // 处理拖拽开始
  const handleDragStart = (e: React.MouseEvent, item: GanttBarData) => {
    if (!editable) return;
    
    e.preventDefault();
    setIsDragging(true);
    setDragData({
      itemId: item.id,
      startX: e.clientX,
      originalStart: item.startDate,
      originalEnd: item.endDate
    });
  };

  // 处理拖拽
  const handleDragMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragData) return;

    const deltaX = e.clientX - dragData.startX;
    const { start, end } = getTimeRange();
    const totalDuration = end.getTime() - start.getTime();
    const chartWidth = chartRef.current?.offsetWidth || 1000;
    const timeDelta = (deltaX / chartWidth) * totalDuration;

    // 计算新的开始和结束时间
    const newStart = new Date(dragData.originalStart.getTime() + timeDelta);
    const newEnd = new Date(dragData.originalEnd.getTime() + timeDelta);

    // 更新UI (临时)
    setGanttData(prev => prev.map(item => 
      item.id === dragData.itemId 
        ? { ...item, startDate: newStart, endDate: newEnd }
        : item
    ));
  };

  // 处理拖拽结束
  const handleDragEnd = () => {
    if (!isDragging || !dragData) return;

    setIsDragging(false);
    
    // 找到被拖拽的项目
    const draggedItem = ganttData.find(item => item.id === dragData.itemId);
    if (draggedItem && (onTaskEdit || onMilestoneEdit)) {
      const changes = {
        startDate: draggedItem.startDate,
        endDate: draggedItem.endDate
      };

      if (draggedItem.type === 'task' && onTaskEdit) {
        onTaskEdit('task', draggedItem.id, changes);
      } else if (draggedItem.type === 'milestone' && onMilestoneEdit) {
        onMilestoneEdit('milestone', draggedItem.id, changes);
      }
    }

    setDragData(null);
  };

  const timeMarkers = generateTimeMarkers();

  return (
    <div className="gantt-chart" ref={chartRef}>
      {/* 头部控制区 */}
      <div className="gantt-header">
        <div className="gantt-title">
          <h3>📊 项目甘特图</h3>
          <div className="gantt-info">
            <span>总任务: {ganttData.filter(d => d.type === 'task').length}</span>
            <span>里程碑: {ganttData.filter(d => d.type === 'milestone').length}</span>
          </div>
        </div>
        
        <div className="gantt-controls">
          <div className="time-scale-selector">
            <button 
              className={timeScale === 'day' ? 'active' : ''}
              onClick={() => setTimeScale('day')}
            >
              按天
            </button>
            <button 
              className={timeScale === 'week' ? 'active' : ''}
              onClick={() => setTimeScale('week')}
            >
              按周
            </button>
            <button 
              className={timeScale === 'month' ? 'active' : ''}
              onClick={() => setTimeScale('month')}
            >
              按月
            </button>
          </div>
          
          {editable && (
            <div className="edit-indicator">
              ✏️ 编辑模式
            </div>
          )}
        </div>
      </div>

      {/* 甘特图主体 */}
      <div className="gantt-container">
        {/* 任务列表区域 */}
        <div className="gantt-sidebar">
          <div className="timeline-header">任务</div>
          <div className="task-list">
            {ganttData.map(item => (
              <div 
                key={item.id}
                className={`task-row ${selectedItem === item.id ? 'selected' : ''}`}
                style={{ paddingLeft: `${item.level * 20}px` }}
                onClick={() => handleBarClick(item)}
              >
                <div className="task-info">
                  <div className="task-name">
                    {item.type === 'milestone' ? '🎯' : '📋'} {item.name}
                  </div>
                  <div className="task-meta">
                    {item.assignee && <span className="assignee">👤 {item.assignee}</span>}
                    <span className={`status status-${item.status}`}>
                      {getStatusLabel(item.status)}
                    </span>
                    <span className="progress">{item.progress}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 时间轴和条形图区域 */}
        <div className="gantt-timeline" ref={timelineRef}>
          {/* 时间标尺 */}
          <div className="timeline-header">
            <div className="time-markers">
              {timeMarkers.map((marker, index) => (
                <div 
                  key={index}
                  className="time-marker"
                  style={{ 
                    left: `${(marker.getTime() - getTimeRange().start.getTime()) / 
                           (getTimeRange().end.getTime() - getTimeRange().start.getTime()) * 100}%` 
                  }}
                >
                  <div className="marker-line"></div>
                  <div className="marker-label">
                    {formatTimeMarker(marker, timeScale)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 甘特条形图 */}
          <div 
            className="gantt-bars"
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
          >
            {ganttData.map((item, index) => {
              const position = calculateBarPosition(item);
              return (
                <div key={item.id} className="bar-row">
                  <div 
                    className={`gantt-bar ${item.type} status-${item.status} ${
                      selectedItem === item.id ? 'selected' : ''
                    } ${editable ? 'editable' : ''}`}
                    style={position}
                    onMouseDown={(e) => handleDragStart(e, item)}
                    onClick={() => handleBarClick(item)}
                  >
                    <div className="bar-content">
                      <div className="bar-progress" style={{ width: `${item.progress}%` }}></div>
                      <div className="bar-label">{item.name}</div>
                    </div>
                    
                    {/* 依赖关系线 */}
                    {item.dependencies.map(depId => {
                      const depItem = ganttData.find(d => d.id === depId);
                      if (depItem) {
                        return (
                          <div key={depId} className="dependency-line">
                            {/* SVG 依赖关系箭头 */}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 详情面板 */}
      {selectedItem && (
        <div className="gantt-details">
          {(() => {
            const item = ganttData.find(d => d.id === selectedItem);
            if (!item) return null;
            
            return (
              <div className="details-content">
                <h4>{item.name}</h4>
                <div className="details-info">
                  <div className="info-item">
                    <label>类型:</label>
                    <span>{item.type === 'milestone' ? '里程碑' : '任务'}</span>
                  </div>
                  <div className="info-item">
                    <label>开始时间:</label>
                    <span>{item.startDate.toLocaleDateString()}</span>
                  </div>
                  <div className="info-item">
                    <label>结束时间:</label>
                    <span>{item.endDate.toLocaleDateString()}</span>
                  </div>
                  <div className="info-item">
                    <label>进度:</label>
                    <span>{item.progress}%</span>
                  </div>
                  <div className="info-item">
                    <label>状态:</label>
                    <span className={`status status-${item.status}`}>
                      {getStatusLabel(item.status)}
                    </span>
                  </div>
                  {item.assignee && (
                    <div className="info-item">
                      <label>负责人:</label>
                      <span>{item.assignee}</span>
                    </div>
                  )}
                </div>
                
                <button 
                  className="close-details"
                  onClick={() => setSelectedItem(null)}
                >
                  关闭
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* 样式 */}
      <style>{`
        .gantt-chart {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: white;
          border-radius: 8px;
          overflow: hidden;
        }

        .gantt-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e0e0e0;
        }

        .gantt-title h3 {
          margin: 0 0 4px 0;
          font-size: 18px;
          font-weight: 600;
        }

        .gantt-info {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: #666;
        }

        .gantt-controls {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .time-scale-selector {
          display: flex;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          overflow: hidden;
        }

        .time-scale-selector button {
          padding: 6px 12px;
          background: white;
          border: none;
          cursor: pointer;
          font-size: 12px;
          border-right: 1px solid #d0d0d0;
        }

        .time-scale-selector button:last-child {
          border-right: none;
        }

        .time-scale-selector button.active {
          background: #1890ff;
          color: white;
        }

        .edit-indicator {
          padding: 4px 8px;
          background: #52c41a;
          color: white;
          border-radius: 4px;
          font-size: 12px;
        }

        .gantt-container {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .gantt-sidebar {
          width: 300px;
          border-right: 1px solid #e0e0e0;
          display: flex;
          flex-direction: column;
        }

        .timeline-header {
          height: 60px;
          padding: 16px;
          background: #f8f9fa;
          border-bottom: 1px solid #e0e0e0;
          font-weight: 600;
          display: flex;
          align-items: center;
        }

        .task-list {
          flex: 1;
          overflow-y: auto;
        }

        .task-row {
          height: 48px;
          padding: 8px 16px;
          border-bottom: 1px solid #f0f0f0;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: background-color 0.2s;
        }

        .task-row:hover {
          background: #f8f9fa;
        }

        .task-row.selected {
          background: #e6f7ff;
          border-color: #1890ff;
        }

        .task-info {
          flex: 1;
        }

        .task-name {
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 4px;
        }

        .task-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #666;
        }

        .assignee {
          background: #f0f0f0;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .status {
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
          text-transform: uppercase;
          font-size: 10px;
        }

        .status-todo { background: #f0f0f0; color: #666; }
        .status-in-progress { background: #e6f7ff; color: #1890ff; }
        .status-done { background: #f6ffed; color: #52c41a; }
        .status-blocked { background: #fff2f0; color: #ff4d4f; }
        .status-on-track { background: #f6ffed; color: #52c41a; }
        .status-at-risk { background: #fff7e6; color: #fa8c16; }
        .status-delayed { background: #fff2f0; color: #ff4d4f; }
        .status-completed { background: #f0f0f0; color: #666; }

        .progress {
          font-weight: 600;
        }

        .gantt-timeline {
          flex: 1;
          overflow-x: auto;
          position: relative;
        }

        .time-markers {
          position: relative;
          height: 100%;
        }

        .time-marker {
          position: absolute;
          top: 0;
          height: 100%;
        }

        .marker-line {
          width: 1px;
          height: 100%;
          background: #e0e0e0;
        }

        .marker-label {
          position: absolute;
          top: 20px;
          left: 4px;
          font-size: 12px;
          color: #666;
          white-space: nowrap;
        }

        .gantt-bars {
          position: relative;
          user-select: none;
        }

        .bar-row {
          height: 48px;
          position: relative;
          border-bottom: 1px solid #f0f0f0;
        }

        .gantt-bar {
          position: absolute;
          top: 8px;
          height: 32px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          overflow: hidden;
        }

        .gantt-bar.milestone {
          background: linear-gradient(135deg, #1890ff, #40a9ff);
          box-shadow: 0 2px 4px rgba(24, 144, 255, 0.3);
        }

        .gantt-bar.task {
          background: linear-gradient(135deg, #52c41a, #73d13d);
          box-shadow: 0 2px 4px rgba(82, 196, 26, 0.3);
        }

        .gantt-bar.selected {
          transform: scale(1.05);
          z-index: 10;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .gantt-bar.editable:hover {
          transform: scale(1.02);
          cursor: grab;
        }

        .bar-content {
          position: relative;
          height: 100%;
          display: flex;
          align-items: center;
          color: white;
          padding: 0 8px;
        }

        .bar-progress {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          background: rgba(255, 255, 255, 0.3);
          transition: width 0.3s;
        }

        .bar-label {
          position: relative;
          z-index: 1;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .gantt-details {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border-top: 1px solid #e0e0e0;
          box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
          z-index: 20;
        }

        .details-content {
          padding: 20px;
        }

        .details-content h4 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .details-info {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .info-item label {
          font-weight: 500;
          color: #666;
          min-width: 80px;
        }

        .close-details {
          padding: 8px 16px;
          background: #f0f0f0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .close-details:hover {
          background: #e0e0e0;
        }
      `}</style>
    </div>
  );
};

// 辅助函数
function getStatusLabel(status: string): string {
  const labels = {
    'todo': '待办',
    'in-progress': '进行中',
    'done': '已完成',
    'blocked': '阻塞',
    'on-track': '正常',
    'at-risk': '风险',
    'delayed': '延期',
    'completed': '已完成',
    'planning': '规划中'
  };
  return labels[status] || status;
}

function formatTimeMarker(date: Date, scale: 'day' | 'week' | 'month'): string {
  switch (scale) {
    case 'day':
      return `${date.getMonth() + 1}/${date.getDate()}`;
    case 'week':
      return `${date.getMonth() + 1}/${date.getDate()}`;
    case 'month':
      return `${date.getFullYear()}/${date.getMonth() + 1}`;
    default:
      return date.toLocaleDateString();
  }
}

export { GanttChart };