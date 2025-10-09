/**
 * 燃尽图组件 - 项目进度和速度可视化
 * 支持理想线、实际进度线和团队速度分析
 */

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';

interface ProjectData {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  milestones: Milestone[];
  overallProgress: number;
}

interface Milestone {
  id: string;
  name: string;
  plannedDate: Date;
  actualDate?: Date;
  progress: number;
  status: 'on-track' | 'at-risk' | 'delayed' | 'completed';
  tasks: Task[];
}

interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done' | 'blocked';
  estimatedHours: number;
  actualHours?: number;
  startDate: Date;
  endDate: Date;
}

interface BurndownChartProps {
  project: ProjectData;
  showIdealLine?: boolean;
  showVelocity?: boolean;
}

interface DataPoint {
  date: Date;
  remaining: number;
  completed: number;
  ideal: number;
  velocity?: number;
}

interface VelocityData {
  week: string;
  planned: number;
  actual: number;
  efficiency: number;
}

const BurndownChart: React.FC<BurndownChartProps> = ({
  project,
  showIdealLine = true,
  showVelocity = true
}) => {
  const [chartData, setChartData] = useState<DataPoint[]>([]);
  const [velocityData, setVelocityData] = useState<VelocityData[]>([]);
  const [viewType, setViewType] = useState<'burndown' | 'velocity' | 'both'>('both');
  const [timeRange, setTimeRange] = useState<'all' | 'recent' | 'upcoming'>('all');
  const [selectedMetric, setSelectedMetric] = useState<'hours' | 'tasks' | 'story_points'>('hours');

  const chartRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (project) {
      generateChartData();
      generateVelocityData();
    }
  }, [project, selectedMetric, timeRange]);

  // 生成燃尽图数据
  const generateChartData = () => {
    const startDate = new Date(project.startDate);
    const endDate = new Date(project.endDate);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // 计算总工作量
    const totalWork = calculateTotalWork(project);
    
    const data: DataPoint[] = [];
    const currentDate = new Date();
    
    // 生成每日数据点
    for (let day = 0; day <= totalDays; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + day);
      
      // 只生成到当前日期或项目结束日期
      if (date > currentDate && date <= endDate) {
        // 对于未来日期，只添加理想线数据
        data.push({
          date: new Date(date),
          remaining: -1, // 标记为未来数据
          completed: -1,
          ideal: totalWork * (1 - day / totalDays),
          velocity: undefined
        });
      } else if (date <= currentDate) {
        const completed = calculateCompletedWork(project, date);
        const remaining = Math.max(0, totalWork - completed);
        const ideal = totalWork * (1 - day / totalDays);
        
        data.push({
          date: new Date(date),
          remaining,
          completed,
          ideal: Math.max(0, ideal),
          velocity: day > 0 ? calculateVelocity(data, day) : 0
        });
      }
    }
    
    // 应用时间范围过滤
    const filteredData = applyTimeRangeFilter(data);
    setChartData(filteredData);
  };

  // 生成速度数据
  const generateVelocityData = () => {
    const velocityData: VelocityData[] = [];
    const startDate = new Date(project.startDate);
    const currentDate = new Date();
    
    // 按周计算速度
    let weekStart = new Date(startDate);
    let weekNumber = 1;
    
    while (weekStart < currentDate) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const plannedWork = calculatePlannedWorkForWeek(project, weekStart, weekEnd);
      const actualWork = calculateCompletedWorkForWeek(project, weekStart, weekEnd);
      const efficiency = plannedWork > 0 ? (actualWork / plannedWork) * 100 : 0;
      
      velocityData.push({
        week: `第${weekNumber}周`,
        planned: plannedWork,
        actual: actualWork,
        efficiency
      });
      
      weekStart.setDate(weekStart.getDate() + 7);
      weekNumber++;
    }
    
    setVelocityData(velocityData);
  };

  // 计算总工作量
  const calculateTotalWork = (project: ProjectData): number => {
    let total = 0;
    
    project.milestones.forEach(milestone => {
      milestone.tasks.forEach(task => {
        switch (selectedMetric) {
          case 'hours':
            total += task.estimatedHours;
            break;
          case 'tasks':
            total += 1;
            break;
          case 'story_points':
            // 假设根据工时估算故事点
            total += Math.ceil(task.estimatedHours / 8);
            break;
        }
      });
    });
    
    return total;
  };

  // 计算已完成工作量
  const calculateCompletedWork = (project: ProjectData, date: Date): number => {
    let completed = 0;
    
    project.milestones.forEach(milestone => {
      milestone.tasks.forEach(task => {
        if (task.status === 'done' && task.endDate <= date) {
          switch (selectedMetric) {
            case 'hours':
              completed += task.actualHours || task.estimatedHours;
              break;
            case 'tasks':
              completed += 1;
              break;
            case 'story_points':
              completed += Math.ceil(task.estimatedHours / 8);
              break;
          }
        }
      });
    });
    
    return completed;
  };

  // 计算某周的计划工作量
  const calculatePlannedWorkForWeek = (project: ProjectData, weekStart: Date, weekEnd: Date): number => {
    let planned = 0;
    
    project.milestones.forEach(milestone => {
      milestone.tasks.forEach(task => {
        // 检查任务是否在这一周内计划执行
        if (task.startDate <= weekEnd && task.endDate >= weekStart) {
          switch (selectedMetric) {
            case 'hours':
              planned += task.estimatedHours;
              break;
            case 'tasks':
              planned += 1;
              break;
            case 'story_points':
              planned += Math.ceil(task.estimatedHours / 8);
              break;
          }
        }
      });
    });
    
    return planned;
  };

  // 计算某周的完成工作量
  const calculateCompletedWorkForWeek = (project: ProjectData, weekStart: Date, weekEnd: Date): number => {
    let completed = 0;
    
    project.milestones.forEach(milestone => {
      milestone.tasks.forEach(task => {
        if (task.status === 'done' && task.endDate >= weekStart && task.endDate <= weekEnd) {
          switch (selectedMetric) {
            case 'hours':
              completed += task.actualHours || task.estimatedHours;
              break;
            case 'tasks':
              completed += 1;
              break;
            case 'story_points':
              completed += Math.ceil(task.estimatedHours / 8);
              break;
          }
        }
      });
    });
    
    return completed;
  };

  // 计算速度
  const calculateVelocity = (data: DataPoint[], currentDay: number): number => {
    if (currentDay < 7) return 0;
    
    const weekAgo = data[currentDay - 7];
    const today = data[currentDay];
    
    if (weekAgo && today) {
      return weekAgo.remaining - today.remaining;
    }
    
    return 0;
  };

  // 应用时间范围过滤
  const applyTimeRangeFilter = (data: DataPoint[]): DataPoint[] => {
    const currentDate = new Date();
    
    switch (timeRange) {
      case 'recent':
        // 显示最近30天
        const thirtyDaysAgo = new Date(currentDate);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return data.filter(d => d.date >= thirtyDaysAgo);
        
      case 'upcoming':
        // 显示未来30天
        const thirtyDaysLater = new Date(currentDate);
        thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
        return data.filter(d => d.date <= thirtyDaysLater && d.date >= currentDate);
        
      default:
        return data;
    }
  };

  // 获取图表尺寸
  const getChartDimensions = () => {
    return {
      width: 760,
      height: 400,
      margin: { top: 20, right: 30, bottom: 40, left: 60 }
    };
  };

  // 获取数据范围
  const getDataRange = () => {
    if (chartData.length === 0) return { minY: 0, maxY: 100, minDate: new Date(), maxDate: new Date() };
    
    const validData = chartData.filter(d => d.remaining >= 0);
    const allValues = validData.flatMap(d => [d.remaining, d.completed, d.ideal]);
    
    return {
      minY: 0,
      maxY: Math.max(...allValues, 1) * 1.1,
      minDate: chartData[0].date,
      maxDate: chartData[chartData.length - 1].date
    };
  };

  // 转换坐标
  const getCoordinates = (date: Date, value: number) => {
    const { width, height, margin } = getChartDimensions();
    const { minY, maxY, minDate, maxDate } = getDataRange();
    
    const x = margin.left + ((date.getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * (width - margin.left - margin.right);
    const y = margin.top + ((maxY - value) / (maxY - minY)) * (height - margin.top - margin.bottom);
    
    return { x, y };
  };

  // 生成SVG路径
  const generatePath = (data: DataPoint[], valueKey: 'remaining' | 'completed' | 'ideal'): string => {
    const validData = data.filter(d => d[valueKey] >= 0);
    if (validData.length === 0) return '';
    
    return validData.map((d, index) => {
      const { x, y } = getCoordinates(d.date, d[valueKey]);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const { width, height, margin } = getChartDimensions();
  const { minY, maxY, minDate, maxDate } = getDataRange();

  return (
    <div className="burndown-chart">
      {/* 控制面板 */}
      <div className="chart-controls">
        <div className="chart-title">
          <h3>📈 燃尽图分析</h3>
          <div className="chart-stats">
            <span>总进度: {project.overallProgress}%</span>
            <span>数据点: {chartData.filter(d => d.remaining >= 0).length}</span>
          </div>
        </div>

        <div className="control-group">
          <div className="view-selector">
            <button 
              className={viewType === 'burndown' ? 'active' : ''}
              onClick={() => setViewType('burndown')}
            >
              燃尽图
            </button>
            <button 
              className={viewType === 'velocity' ? 'active' : ''}
              onClick={() => setViewType('velocity')}
            >
              速度图
            </button>
            <button 
              className={viewType === 'both' ? 'active' : ''}
              onClick={() => setViewType('both')}
            >
              组合视图
            </button>
          </div>

          <div className="metric-selector">
            <select 
              value={selectedMetric} 
              onChange={(e) => setSelectedMetric(e.target.value as any)}
            >
              <option value="hours">工时</option>
              <option value="tasks">任务数</option>
              <option value="story_points">故事点</option>
            </select>
          </div>

          <div className="time-range-selector">
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value as any)}
            >
              <option value="all">全部时间</option>
              <option value="recent">最近30天</option>
              <option value="upcoming">未来30天</option>
            </select>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="chart-container" ref={chartRef}>
        {(viewType === 'burndown' || viewType === 'both') && (
          <div className="burndown-section">
            <h4>燃尽趋势</h4>
            <svg
              ref={svgRef}
              width={width}
              height={height}
              className="burndown-svg"
            >
              {/* 网格线 */}
              <g className="grid">
                {/* 水平网格线 */}
                {Array.from({ length: 6 }, (_, i) => {
                  const y = margin.top + (height - margin.top - margin.bottom) * i / 5;
                  const value = maxY - (maxY - minY) * i / 5;
                  return (
                    <g key={i}>
                      <line
                        x1={margin.left}
                        y1={y}
                        x2={width - margin.right}
                        y2={y}
                        stroke="#f0f0f0"
                        strokeWidth="1"
                      />
                      <text
                        x={margin.left - 10}
                        y={y + 4}
                        textAnchor="end"
                        fontSize="12"
                        fill="#666"
                      >
                        {Math.round(value)}
                      </text>
                    </g>
                  );
                })}

                {/* 垂直网格线 */}
                {Array.from({ length: 8 }, (_, i) => {
                  const x = margin.left + (width - margin.left - margin.right) * i / 7;
                  const dateRatio = i / 7;
                  const date = new Date(minDate.getTime() + (maxDate.getTime() - minDate.getTime()) * dateRatio);
                  return (
                    <g key={i}>
                      <line
                        x1={x}
                        y1={margin.top}
                        x2={x}
                        y2={height - margin.bottom}
                        stroke="#f0f0f0"
                        strokeWidth="1"
                      />
                      <text
                        x={x}
                        y={height - margin.bottom + 20}
                        textAnchor="middle"
                        fontSize="12"
                        fill="#666"
                      >
                        {date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* 理想线 */}
              {showIdealLine && (
                <path
                  d={generatePath(chartData, 'ideal')}
                  fill="none"
                  stroke="#d9d9d9"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  className="ideal-line"
                />
              )}

              {/* 实际剩余工作量线 */}
              <path
                d={generatePath(chartData, 'remaining')}
                fill="none"
                stroke="#1890ff"
                strokeWidth="3"
                className="remaining-line"
              />

              {/* 完成工作量线 */}
              <path
                d={generatePath(chartData, 'completed')}
                fill="none"
                stroke="#52c41a"
                strokeWidth="2"
                className="completed-line"
              />

              {/* 数据点 */}
              {chartData.filter(d => d.remaining >= 0).map((d, index) => {
                const { x: remainingX, y: remainingY } = getCoordinates(d.date, d.remaining);
                const { x: completedX, y: completedY } = getCoordinates(d.date, d.completed);
                
                return (
                  <g key={index}>
                    <circle
                      cx={remainingX}
                      cy={remainingY}
                      r="4"
                      fill="#1890ff"
                      className="data-point"
                    />
                    <circle
                      cx={completedX}
                      cy={completedY}
                      r="3"
                      fill="#52c41a"
                      className="data-point"
                    />
                  </g>
                );
              })}

              {/* 当前日期线 */}
              {(() => {
                const currentDate = new Date();
                if (currentDate >= minDate && currentDate <= maxDate) {
                  const { x } = getCoordinates(currentDate, 0);
                  return (
                    <line
                      x1={x}
                      y1={margin.top}
                      x2={x}
                      y2={height - margin.bottom}
                      stroke="#ff4d4f"
                      strokeWidth="2"
                      strokeDasharray="3,3"
                      className="current-date-line"
                    />
                  );
                }
                return null;
              })()}

              {/* 图例 */}
              <g className="legend" transform={`translate(${width - 150}, ${margin.top + 20})`}>
                <rect
                  width="140"
                  height="80"
                  fill="white"
                  stroke="#e0e0e0"
                  strokeWidth="1"
                  rx="4"
                />
                
                <g transform="translate(10, 15)">
                  <line x1="0" y1="0" x2="20" y2="0" stroke="#1890ff" strokeWidth="3" />
                  <text x="25" y="4" fontSize="12" fill="#333">剩余工作</text>
                </g>
                
                <g transform="translate(10, 35)">
                  <line x1="0" y1="0" x2="20" y2="0" stroke="#52c41a" strokeWidth="2" />
                  <text x="25" y="4" fontSize="12" fill="#333">已完成</text>
                </g>
                
                {showIdealLine && (
                  <g transform="translate(10, 55)">
                    <line x1="0" y1="0" x2="20" y2="0" stroke="#d9d9d9" strokeWidth="2" strokeDasharray="5,5" />
                    <text x="25" y="4" fontSize="12" fill="#333">理想线</text>
                  </g>
                )}
              </g>

              {/* Y轴标签 */}
              <text
                x="20"
                y="20"
                fontSize="14"
                fill="#333"
                textAnchor="middle"
                transform={`rotate(-90, 20, 20)`}
              >
                {selectedMetric === 'hours' ? '工时' : 
                 selectedMetric === 'tasks' ? '任务数' : '故事点'}
              </text>
            </svg>
          </div>
        )}

        {/* 速度图表 */}
        {(viewType === 'velocity' || viewType === 'both') && showVelocity && (
          <div className="velocity-section">
            <h4>团队速度分析</h4>
            <div className="velocity-chart">
              {velocityData.map((item, index) => (
                <div key={index} className="velocity-bar-group">
                  <div className="week-label">{item.week}</div>
                  <div className="bars">
                    <div 
                      className="bar planned"
                      style={{ height: `${(item.planned / Math.max(...velocityData.map(v => Math.max(v.planned, v.actual)))) * 100}%` }}
                      title={`计划: ${item.planned}`}
                    />
                    <div 
                      className="bar actual"
                      style={{ height: `${(item.actual / Math.max(...velocityData.map(v => Math.max(v.planned, v.actual)))) * 100}%` }}
                      title={`实际: ${item.actual}`}
                    />
                  </div>
                  <div className="efficiency">
                    <span className={`efficiency-value ${item.efficiency >= 80 ? 'good' : item.efficiency >= 60 ? 'ok' : 'poor'}`}>
                      {Math.round(item.efficiency)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="velocity-legend">
              <div className="legend-item">
                <div className="color-box planned"></div>
                <span>计划工作量</span>
              </div>
              <div className="legend-item">
                <div className="color-box actual"></div>
                <span>实际完成量</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 分析摘要 */}
      <div className="analysis-summary">
        <div className="summary-section">
          <h5>📊 项目分析</h5>
          <div className="summary-grid">
            <div className="summary-item">
              <label>当前进度:</label>
              <span className="value">{project.overallProgress}%</span>
            </div>
            <div className="summary-item">
              <label>预计完成:</label>
              <span className="value">{project.endDate.toLocaleDateString()}</span>
            </div>
            {velocityData.length > 0 && (
              <>
                <div className="summary-item">
                  <label>平均效率:</label>
                  <span className="value">
                    {Math.round(velocityData.reduce((sum, v) => sum + v.efficiency, 0) / velocityData.length)}%
                  </span>
                </div>
                <div className="summary-item">
                  <label>本周速度:</label>
                  <span className="value">
                    {velocityData.length > 0 ? velocityData[velocityData.length - 1].actual : 0}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 趋势分析 */}
        <div className="trend-analysis">
          <h5>📈 趋势分析</h5>
          <div className="trend-indicators">
            {(() => {
              const recentData = chartData.slice(-7).filter(d => d.remaining >= 0);
              if (recentData.length < 2) return <span>数据不足</span>;
              
              const trend = recentData[recentData.length - 1].remaining - recentData[0].remaining;
              const isOnTrack = trend < 0; // 剩余工作在减少说明进展良好
              
              return (
                <div className={`trend-indicator ${isOnTrack ? 'positive' : 'negative'}`}>
                  {isOnTrack ? '📈 进展良好' : '⚠️ 需要关注'}
                  <span className="trend-detail">
                    最近7天变化: {trend > 0 ? '+' : ''}{Math.round(trend)}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* 样式 */}
      <style>{`
        .burndown-chart {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: white;
          border-radius: 8px;
          overflow: hidden;
        }

        .chart-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e0e0e0;
        }

        .chart-title h3 {
          margin: 0 0 4px 0;
          font-size: 18px;
          font-weight: 600;
        }

        .chart-stats {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: #666;
        }

        .control-group {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .view-selector {
          display: flex;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          overflow: hidden;
        }

        .view-selector button {
          padding: 6px 12px;
          background: white;
          border: none;
          cursor: pointer;
          font-size: 12px;
          border-right: 1px solid #d0d0d0;
        }

        .view-selector button:last-child {
          border-right: none;
        }

        .view-selector button.active {
          background: #1890ff;
          color: white;
        }

        .metric-selector select,
        .time-range-selector select {
          padding: 6px 12px;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          font-size: 12px;
          background: white;
        }

        .chart-container {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
        }

        .burndown-section,
        .velocity-section {
          margin-bottom: 30px;
        }

        .burndown-section h4,
        .velocity-section h4 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .burndown-svg {
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          background: white;
        }

        .data-point {
          cursor: pointer;
          transition: r 0.2s;
        }

        .data-point:hover {
          r: 6;
        }

        .velocity-chart {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          height: 200px;
          padding: 20px;
          background: #fafafa;
          border-radius: 8px;
          overflow-x: auto;
        }

        .velocity-bar-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 60px;
        }

        .week-label {
          font-size: 12px;
          color: #666;
          margin-bottom: 8px;
          white-space: nowrap;
        }

        .bars {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 140px;
          margin-bottom: 8px;
        }

        .bar {
          width: 16px;
          min-height: 2px;
          border-radius: 2px 2px 0 0;
          transition: opacity 0.2s;
        }

        .bar.planned {
          background: #1890ff;
          opacity: 0.6;
        }

        .bar.actual {
          background: #52c41a;
        }

        .bar:hover {
          opacity: 1;
        }

        .efficiency {
          font-size: 10px;
          text-align: center;
        }

        .efficiency-value.good { color: #52c41a; }
        .efficiency-value.ok { color: #fa8c16; }
        .efficiency-value.poor { color: #ff4d4f; }

        .velocity-legend {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-top: 16px;
          font-size: 12px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .color-box {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }

        .color-box.planned {
          background: #1890ff;
          opacity: 0.6;
        }

        .color-box.actual {
          background: #52c41a;
        }

        .analysis-summary {
          display: flex;
          gap: 20px;
          padding: 20px;
          background: #f8f9fa;
          border-top: 1px solid #e0e0e0;
        }

        .summary-section {
          flex: 1;
        }

        .summary-section h5,
        .trend-analysis h5 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
        }

        .summary-item label {
          color: #666;
        }

        .summary-item .value {
          font-weight: 600;
          color: #333;
        }

        .trend-analysis {
          flex: 1;
        }

        .trend-indicators {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .trend-indicator {
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }

        .trend-indicator.positive {
          background: #f6ffed;
          color: #52c41a;
        }

        .trend-indicator.negative {
          background: #fff7e6;
          color: #fa8c16;
        }

        .trend-detail {
          display: block;
          font-size: 11px;
          opacity: 0.8;
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
};

export { BurndownChart };