/**
 * 团队指标面板组件 - 团队状态和工作负载可视化
 * 支持团队成员状态、工作负载分布、协作效率分析
 */

import * as React from 'react';
import { useState, useEffect } from 'react';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  currentWorkload: number; // 0-100%
  availability: number; // 0-100%
  skills: string[];
  email?: string;
  timezone?: string;
  status?: 'available' | 'busy' | 'away' | 'offline';
}

interface Milestone {
  id: string;
  name: string;
  assignees: TeamMember[];
  tasks: Task[];
  progress: number;
}

interface Task {
  id: string;
  title: string;
  assignee: string;
  status: 'todo' | 'in-progress' | 'done' | 'blocked';
  estimatedHours: number;
  actualHours?: number;
  priority: 'high' | 'medium' | 'low';
}

interface TeamMetricsPanelProps {
  team: TeamMember[];
  milestones: Milestone[];
}

interface TeamMetrics {
  averageWorkload: number;
  teamUtilization: number;
  activeMembers: number;
  overloadedMembers: number;
  bottleneckRisk: 'low' | 'medium' | 'high';
  collaborationScore: number;
}

interface WorkloadDistribution {
  memberId: string;
  memberName: string;
  workload: number;
  capacity: number;
  efficiency: number;
  tasksInProgress: number;
  tasksCompleted: number;
  hoursThisWeek: number;
}

const TeamMetricsPanel: React.FC<TeamMetricsPanelProps> = ({
  team,
  milestones
}) => {
  const [metrics, setMetrics] = useState<TeamMetrics>({
    averageWorkload: 0,
    teamUtilization: 0,
    activeMembers: 0,
    overloadedMembers: 0,
    bottleneckRisk: 'low',
    collaborationScore: 0
  });
  
  const [workloadData, setWorkloadData] = useState<WorkloadDistribution[]>([]);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'workload' | 'skills'>('overview');

  useEffect(() => {
    calculateTeamMetrics();
    calculateWorkloadDistribution();
  }, [team, milestones]);

  // 计算团队指标
  const calculateTeamMetrics = () => {
    if (team.length === 0) {
      setMetrics({
        averageWorkload: 0,
        teamUtilization: 0,
        activeMembers: 0,
        overloadedMembers: 0,
        bottleneckRisk: 'low',
        collaborationScore: 0
      });
      return;
    }

    const activeMembers = team.filter(member => 
      member.status === 'available' || member.status === 'busy'
    ).length;

    const totalWorkload = team.reduce((sum, member) => sum + member.currentWorkload, 0);
    const averageWorkload = totalWorkload / team.length;

    const totalAvailability = team.reduce((sum, member) => sum + member.availability, 0);
    const teamUtilization = (totalWorkload / totalAvailability) * 100;

    const overloadedMembers = team.filter(member => member.currentWorkload > 85).length;

    // 评估瓶颈风险
    const highWorkloadMembers = team.filter(member => member.currentWorkload > 80).length;
    const bottleneckRisk: TeamMetrics['bottleneckRisk'] = 
      highWorkloadMembers > team.length * 0.5 ? 'high' :
      highWorkloadMembers > team.length * 0.3 ? 'medium' : 'low';

    // 计算协作评分（基于任务分布的均匀程度）
    const workloadVariance = team.reduce((sum, member) => 
      sum + Math.pow(member.currentWorkload - averageWorkload, 2), 0
    ) / team.length;
    const collaborationScore = Math.max(0, 100 - workloadVariance);

    setMetrics({
      averageWorkload: Math.round(averageWorkload),
      teamUtilization: Math.round(teamUtilization),
      activeMembers,
      overloadedMembers,
      bottleneckRisk,
      collaborationScore: Math.round(collaborationScore)
    });
  };

  // 计算工作负载分布
  const calculateWorkloadDistribution = () => {
    const distribution: WorkloadDistribution[] = team.map(member => {
      // 获取成员的所有任务
      const memberTasks: Task[] = [];
      milestones.forEach(milestone => {
        milestone.tasks.forEach(task => {
          if (task.assignee === member.id) {
            memberTasks.push(task);
          }
        });
      });

      const tasksInProgress = memberTasks.filter(t => t.status === 'in-progress').length;
      const tasksCompleted = memberTasks.filter(t => t.status === 'done').length;
      
      // 计算本周工时（简化计算）
      const hoursThisWeek = memberTasks
        .filter(t => t.status === 'in-progress' || t.status === 'done')
        .reduce((sum, task) => sum + (task.actualHours || task.estimatedHours), 0);

      // 计算效率（完成任务数/进行中任务数的比例）
      const efficiency = tasksInProgress > 0 ? 
        (tasksCompleted / (tasksCompleted + tasksInProgress)) * 100 : 
        tasksCompleted > 0 ? 100 : 0;

      return {
        memberId: member.id,
        memberName: member.name,
        workload: member.currentWorkload,
        capacity: member.availability,
        efficiency: Math.round(efficiency),
        tasksInProgress,
        tasksCompleted,
        hoursThisWeek: Math.round(hoursThisWeek)
      };
    });

    setWorkloadData(distribution);
  };

  // 获取成员状态颜色
  const getStatusColor = (status?: string): string => {
    switch (status) {
      case 'available': return '#52c41a';
      case 'busy': return '#fa8c16';
      case 'away': return '#d9d9d9';
      case 'offline': return '#ff4d4f';
      default: return '#d9d9d9';
    }
  };

  // 获取工作负载颜色
  const getWorkloadColor = (workload: number): string => {
    if (workload > 85) return '#ff4d4f';
    if (workload > 70) return '#fa8c16';
    if (workload > 50) return '#1890ff';
    return '#52c41a';
  };

  // 获取风险等级颜色
  const getRiskColor = (risk: string): string => {
    switch (risk) {
      case 'high': return '#ff4d4f';
      case 'medium': return '#fa8c16';
      case 'low': return '#52c41a';
      default: return '#d9d9d9';
    }
  };

  // 获取技能匹配度
  const getSkillCoverage = (): { skill: string; coverage: number; members: string[] }[] => {
    const skillMap = new Map<string, string[]>();
    
    team.forEach(member => {
      member.skills.forEach(skill => {
        if (!skillMap.has(skill)) {
          skillMap.set(skill, []);
        }
        skillMap.get(skill)!.push(member.name);
      });
    });

    return Array.from(skillMap.entries()).map(([skill, members]) => ({
      skill,
      coverage: (members.length / team.length) * 100,
      members
    })).sort((a, b) => b.coverage - a.coverage);
  };

  const skillCoverage = getSkillCoverage();

  return (
    <div className="team-metrics-panel">
      {/* 头部 */}
      <div className="panel-header">
        <h4>👥 团队状态</h4>
        <div className="view-switcher">
          <button 
            className={viewMode === 'overview' ? 'active' : ''}
            onClick={() => setViewMode('overview')}
          >
            概览
          </button>
          <button 
            className={viewMode === 'workload' ? 'active' : ''}
            onClick={() => setViewMode('workload')}
          >
            负载
          </button>
          <button 
            className={viewMode === 'skills' ? 'active' : ''}
            onClick={() => setViewMode('skills')}
          >
            技能
          </button>
        </div>
      </div>

      {/* 关键指标 */}
      <div className="key-metrics">
        <div className="metric-item">
          <div className="metric-value">{metrics.activeMembers}/{team.length}</div>
          <div className="metric-label">活跃成员</div>
        </div>
        <div className="metric-item">
          <div className={`metric-value ${metrics.averageWorkload > 80 ? 'warning' : ''}`}>
            {metrics.averageWorkload}%
          </div>
          <div className="metric-label">平均负载</div>
        </div>
        <div className="metric-item">
          <div className={`metric-value ${metrics.overloadedMembers > 0 ? 'danger' : ''}`}>
            {metrics.overloadedMembers}
          </div>
          <div className="metric-label">超负荷</div>
        </div>
      </div>

      {/* 风险指示器 */}
      <div className="risk-indicator">
        <span className="risk-label">瓶颈风险:</span>
        <span 
          className="risk-badge"
          style={{ backgroundColor: getRiskColor(metrics.bottleneckRisk) }}
        >
          {metrics.bottleneckRisk === 'high' ? '高' : 
           metrics.bottleneckRisk === 'medium' ? '中' : '低'}
        </span>
        <span className="collaboration-score">
          协作评分: {metrics.collaborationScore}
        </span>
      </div>

      {/* 内容区域 */}
      <div className="panel-content">
        {viewMode === 'overview' && (
          <div className="overview-section">
            <h5>团队成员</h5>
            <div className="members-list">
              {team.map(member => (
                <div 
                  key={member.id} 
                  className={`member-card ${selectedMember === member.id ? 'selected' : ''}`}
                  onClick={() => setSelectedMember(selectedMember === member.id ? null : member.id)}
                >
                  <div className="member-avatar">
                    {member.avatar ? (
                      <img src={member.avatar} alt={member.name} />
                    ) : (
                      <div className="avatar-placeholder">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div 
                      className="status-indicator"
                      style={{ backgroundColor: getStatusColor(member.status) }}
                    />
                  </div>
                  
                  <div className="member-info">
                    <div className="member-name">{member.name}</div>
                    <div className="member-role">{member.role}</div>
                    <div className="workload-bar">
                      <div 
                        className="workload-fill"
                        style={{ 
                          width: `${member.currentWorkload}%`,
                          backgroundColor: getWorkloadColor(member.currentWorkload)
                        }}
                      />
                      <span className="workload-text">{member.currentWorkload}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedMember && (() => {
              const member = team.find(m => m.id === selectedMember);
              const memberData = workloadData.find(w => w.memberId === selectedMember);
              if (!member || !memberData) return null;

              return (
                <div className="member-details">
                  <h6>{member.name} 详细信息</h6>
                  <div className="details-grid">
                    <div className="detail-item">
                      <label>当前负载:</label>
                      <span>{member.currentWorkload}%</span>
                    </div>
                    <div className="detail-item">
                      <label>可用性:</label>
                      <span>{member.availability}%</span>
                    </div>
                    <div className="detail-item">
                      <label>进行中任务:</label>
                      <span>{memberData.tasksInProgress}</span>
                    </div>
                    <div className="detail-item">
                      <label>已完成任务:</label>
                      <span>{memberData.tasksCompleted}</span>
                    </div>
                    <div className="detail-item">
                      <label>本周工时:</label>
                      <span>{memberData.hoursThisWeek}h</span>
                    </div>
                    <div className="detail-item">
                      <label>效率:</label>
                      <span>{memberData.efficiency}%</span>
                    </div>
                  </div>
                  
                  {member.skills.length > 0 && (
                    <div className="skills-section">
                      <label>技能:</label>
                      <div className="skills-tags">
                        {member.skills.map((skill, index) => (
                          <span key={index} className="skill-tag">{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {viewMode === 'workload' && (
          <div className="workload-section">
            <h5>工作负载分析</h5>
            <div className="workload-chart">
              {workloadData.map(data => (
                <div key={data.memberId} className="workload-row">
                  <div className="member-name-column">{data.memberName}</div>
                  <div className="workload-bar-column">
                    <div className="workload-container">
                      <div 
                        className="workload-bar-bg"
                        style={{ width: `${data.capacity}%` }}
                      />
                      <div 
                        className="workload-bar-fill"
                        style={{ 
                          width: `${data.workload}%`,
                          backgroundColor: getWorkloadColor(data.workload)
                        }}
                      />
                      <span className="workload-label">
                        {data.workload}% / {data.capacity}%
                      </span>
                    </div>
                  </div>
                  <div className="workload-stats">
                    <span className="stat-item">
                      🔄 {data.tasksInProgress}
                    </span>
                    <span className="stat-item">
                      ✅ {data.tasksCompleted}
                    </span>
                    <span className="stat-item">
                      ⏱️ {data.hoursThisWeek}h
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'skills' && (
          <div className="skills-section">
            <h5>技能覆盖度</h5>
            <div className="skills-analysis">
              {skillCoverage.map((item, index) => (
                <div key={index} className="skill-item">
                  <div className="skill-header">
                    <span className="skill-name">{item.skill}</span>
                    <span className="skill-coverage">{Math.round(item.coverage)}%</span>
                  </div>
                  <div className="skill-bar">
                    <div 
                      className="skill-fill"
                      style={{ 
                        width: `${item.coverage}%`,
                        backgroundColor: item.coverage > 50 ? '#52c41a' : 
                                       item.coverage > 25 ? '#fa8c16' : '#ff4d4f'
                      }}
                    />
                  </div>
                  <div className="skill-members">
                    {item.members.join(', ')}
                  </div>
                </div>
              ))}
            </div>

            {/* 技能分布建议 */}
            <div className="skills-recommendations">
              <h6>📋 建议</h6>
              <div className="recommendations-list">
                {skillCoverage.filter(s => s.coverage < 50).map((skill, index) => (
                  <div key={index} className="recommendation-item">
                    <span className="warning-icon">⚠️</span>
                    <span>
                      {skill.skill} 技能覆盖度较低 ({Math.round(skill.coverage)}%)，
                      建议增加相关培训或招聘
                    </span>
                  </div>
                ))}
                {skillCoverage.filter(s => s.members.length === 1).map((skill, index) => (
                  <div key={index} className="recommendation-item">
                    <span className="risk-icon">🚨</span>
                    <span>
                      {skill.skill} 仅有 {skill.members[0]} 掌握，存在单点风险
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 样式 */}
      <style>{`
        .team-metrics-panel {
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

        .view-switcher {
          display: flex;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          overflow: hidden;
        }

        .view-switcher button {
          padding: 4px 8px;
          border: none;
          background: white;
          cursor: pointer;
          font-size: 11px;
          border-right: 1px solid #d0d0d0;
        }

        .view-switcher button:last-child {
          border-right: none;
        }

        .view-switcher button.active {
          background: #1890ff;
          color: white;
        }

        .key-metrics {
          display: flex;
          justify-content: space-around;
          padding: 16px 20px;
          background: #fafafa;
          border-bottom: 1px solid #f0f0f0;
        }

        .metric-item {
          text-align: center;
        }

        .metric-value {
          font-size: 18px;
          font-weight: bold;
          color: #333;
          margin-bottom: 4px;
        }

        .metric-value.warning { color: #fa8c16; }
        .metric-value.danger { color: #ff4d4f; }

        .metric-label {
          font-size: 11px;
          color: #666;
        }

        .risk-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: white;
          border-bottom: 1px solid #f0f0f0;
          font-size: 12px;
        }

        .risk-label {
          color: #666;
          font-weight: 500;
        }

        .risk-badge {
          padding: 2px 6px;
          border-radius: 4px;
          color: white;
          font-weight: 500;
          font-size: 10px;
        }

        .collaboration-score {
          margin-left: auto;
          color: #666;
          font-weight: 500;
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .panel-content h5 {
          margin: 0 0 16px 0;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .panel-content h6 {
          margin: 0 0 12px 0;
          font-size: 13px;
          font-weight: 600;
          color: #333;
        }

        .members-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 20px;
        }

        .member-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid #f0f0f0;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .member-card:hover {
          background: #fafafa;
          border-color: #d0d0d0;
        }

        .member-card.selected {
          background: #e6f7ff;
          border-color: #1890ff;
        }

        .member-avatar {
          position: relative;
          width: 36px;
          height: 36px;
        }

        .member-avatar img,
        .avatar-placeholder {
          width: 36px;
          height: 36px;
          border-radius: 50%;
        }

        .avatar-placeholder {
          background: #1890ff;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
        }

        .status-indicator {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid white;
        }

        .member-info {
          flex: 1;
          min-width: 0;
        }

        .member-name {
          font-size: 13px;
          font-weight: 500;
          color: #333;
          margin-bottom: 2px;
        }

        .member-role {
          font-size: 11px;
          color: #666;
          margin-bottom: 6px;
        }

        .workload-bar {
          position: relative;
          height: 16px;
          background: #f0f0f0;
          border-radius: 8px;
          overflow: hidden;
        }

        .workload-fill {
          height: 100%;
          transition: width 0.3s;
        }

        .workload-text {
          position: absolute;
          top: 50%;
          right: 8px;
          transform: translateY(-50%);
          font-size: 10px;
          font-weight: 500;
          color: white;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }

        .member-details {
          background: #f8f9fa;
          padding: 16px;
          border-radius: 6px;
          border: 1px solid #e0e0e0;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
        }

        .detail-item label {
          color: #666;
          font-weight: 500;
        }

        .detail-item span {
          color: #333;
          font-weight: 600;
        }

        .skills-section {
          margin-top: 12px;
        }

        .skills-section label {
          display: block;
          font-size: 12px;
          color: #666;
          font-weight: 500;
          margin-bottom: 8px;
        }

        .skills-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .skill-tag {
          padding: 2px 6px;
          background: #f0f0f0;
          color: #666;
          border-radius: 4px;
          font-size: 10px;
        }

        .workload-chart {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .workload-row {
          display: grid;
          grid-template-columns: 80px 1fr 120px;
          gap: 12px;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .member-name-column {
          font-size: 12px;
          font-weight: 500;
          color: #333;
        }

        .workload-container {
          position: relative;
          height: 20px;
          background: #f0f0f0;
          border-radius: 10px;
          overflow: hidden;
        }

        .workload-bar-bg {
          position: absolute;
          height: 100%;
          background: #e0e0e0;
          opacity: 0.5;
        }

        .workload-bar-fill {
          position: absolute;
          height: 100%;
          transition: width 0.3s;
        }

        .workload-label {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 10px;
          font-weight: 500;
          color: #333;
        }

        .workload-stats {
          display: flex;
          gap: 8px;
          font-size: 10px;
        }

        .stat-item {
          color: #666;
        }

        .skills-analysis {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 20px;
        }

        .skill-item {
          padding: 12px;
          background: #fafafa;
          border-radius: 6px;
        }

        .skill-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .skill-name {
          font-size: 13px;
          font-weight: 500;
          color: #333;
        }

        .skill-coverage {
          font-size: 12px;
          font-weight: 600;
          color: #666;
        }

        .skill-bar {
          height: 6px;
          background: #f0f0f0;
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 6px;
        }

        .skill-fill {
          height: 100%;
          transition: width 0.3s;
        }

        .skill-members {
          font-size: 11px;
          color: #666;
        }

        .skills-recommendations {
          background: #fff7e6;
          padding: 12px;
          border-radius: 6px;
          border: 1px solid #ffd591;
        }

        .recommendations-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .recommendation-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 11px;
          color: #333;
          line-height: 1.4;
        }

        .warning-icon,
        .risk-icon {
          font-size: 12px;
          flex-shrink: 0;
          margin-top: 1px;
        }
      `}</style>
    </div>
  );
};

export { TeamMetricsPanel };