/**
 * 风险面板组件 - 项目风险监控和管理
 * 支持风险等级分类、处理状态跟踪和缓解措施管理
 */

import * as React from 'react';
import { useState, useEffect } from 'react';

interface Risk {
  id: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  probability: number; // 0-100%
  impact: string;
  mitigation: string;
  owner: string;
  status: 'open' | 'mitigating' | 'resolved';
  identifiedDate: Date;
  targetResolutionDate: Date;
  actualResolutionDate?: Date;
  category?: 'technical' | 'resource' | 'schedule' | 'business' | 'external';
  tags?: string[];
}

interface RiskPanelProps {
  risks: Risk[];
  onRiskUpdate?: (riskId: string, changes: Partial<Risk>) => void;
}

interface RiskMetrics {
  totalRisks: number;
  highSeverityRisks: number;
  openRisks: number;
  overdueMitigations: number;
  riskScore: number;
  trendDirection: 'improving' | 'stable' | 'worsening';
}

const RiskPanel: React.FC<RiskPanelProps> = ({
  risks,
  onRiskUpdate
}) => {
  const [filteredRisks, setFilteredRisks] = useState<Risk[]>(risks);
  const [filter, setFilter] = useState<'all' | 'high' | 'open' | 'overdue'>('all');
  const [sortBy, setSortBy] = useState<'severity' | 'probability' | 'date'>('severity');
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<RiskMetrics>({
    totalRisks: 0,
    highSeverityRisks: 0,
    openRisks: 0,
    overdueMitigations: 0,
    riskScore: 0,
    trendDirection: 'stable'
  });

  useEffect(() => {
    calculateMetrics();
    applyFiltersAndSort();
  }, [risks, filter, sortBy]);

  // 计算风险指标
  const calculateMetrics = () => {
    const totalRisks = risks.length;
    const highSeverityRisks = risks.filter(r => r.severity === 'high').length;
    const openRisks = risks.filter(r => r.status === 'open').length;
    
    const now = new Date();
    const overdueMitigations = risks.filter(r => 
      r.status !== 'resolved' && r.targetResolutionDate < now
    ).length;

    // 计算风险评分 (0-100)
    const riskScore = risks.reduce((total, risk) => {
      const severityWeight = risk.severity === 'high' ? 3 : risk.severity === 'medium' ? 2 : 1;
      const statusWeight = risk.status === 'open' ? 1 : risk.status === 'mitigating' ? 0.5 : 0;
      return total + (risk.probability / 100) * severityWeight * statusWeight;
    }, 0) / Math.max(totalRisks, 1) * 20; // 归一化到0-100

    // 简单的趋势分析 (基于最近识别的风险)
    const recentRisks = risks.filter(r => {
      const daysAgo = (now.getTime() - r.identifiedDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo <= 30;
    });
    
    const trendDirection: RiskMetrics['trendDirection'] = 
      recentRisks.length > totalRisks * 0.3 ? 'worsening' :
      recentRisks.length < totalRisks * 0.1 ? 'improving' : 'stable';

    setMetrics({
      totalRisks,
      highSeverityRisks,
      openRisks,
      overdueMitigations,
      riskScore: Math.round(riskScore),
      trendDirection
    });
  };

  // 应用过滤和排序
  const applyFiltersAndSort = () => {
    let filtered = [...risks];

    // 应用过滤器
    switch (filter) {
      case 'high':
        filtered = filtered.filter(r => r.severity === 'high');
        break;
      case 'open':
        filtered = filtered.filter(r => r.status === 'open');
        break;
      case 'overdue':
        const now = new Date();
        filtered = filtered.filter(r => 
          r.status !== 'resolved' && r.targetResolutionDate < now
        );
        break;
    }

    // 应用排序
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'severity':
          const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        case 'probability':
          return b.probability - a.probability;
        case 'date':
          return b.identifiedDate.getTime() - a.identifiedDate.getTime();
        default:
          return 0;
      }
    });

    setFilteredRisks(filtered);
  };

  // 获取风险优先级
  const getRiskPriority = (risk: Risk): number => {
    const severityWeight = risk.severity === 'high' ? 3 : risk.severity === 'medium' ? 2 : 1;
    return (risk.probability / 100) * severityWeight;
  };

  // 获取风险状态颜色
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'open': return '#ff4d4f';
      case 'mitigating': return '#fa8c16';
      case 'resolved': return '#52c41a';
      default: return '#d9d9d9';
    }
  };

  // 获取严重程度颜色
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'high': return '#ff4d4f';
      case 'medium': return '#fa8c16';
      case 'low': return '#52c41a';
      default: return '#d9d9d9';
    }
  };

  // 处理风险状态更新
  const handleStatusUpdate = (riskId: string, newStatus: Risk['status']) => {
    if (onRiskUpdate) {
      const updates: Partial<Risk> = { status: newStatus };
      if (newStatus === 'resolved') {
        updates.actualResolutionDate = new Date();
      }
      onRiskUpdate(riskId, updates);
    }
  };

  // 获取风险类别图标
  const getCategoryIcon = (category?: string): string => {
    switch (category) {
      case 'technical': return '⚙️';
      case 'resource': return '👥';
      case 'schedule': return '📅';
      case 'business': return '💼';
      case 'external': return '🌐';
      default: return '⚠️';
    }
  };

  return (
    <div className="risk-panel">
      {/* 头部和指标 */}
      <div className="panel-header">
        <h4>⚠️ 风险监控</h4>
        <div className="risk-score">
          <span className="score-label">风险评分</span>
          <span className={`score-value ${
            metrics.riskScore > 70 ? 'high' : 
            metrics.riskScore > 40 ? 'medium' : 'low'
          }`}>
            {metrics.riskScore}
          </span>
        </div>
      </div>

      {/* 指标卡片 */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-value">{metrics.totalRisks}</div>
          <div className="metric-label">总风险</div>
        </div>
        <div className="metric-card">
          <div className="metric-value critical">{metrics.highSeverityRisks}</div>
          <div className="metric-label">高风险</div>
        </div>
        <div className="metric-card">
          <div className="metric-value warning">{metrics.openRisks}</div>
          <div className="metric-label">待处理</div>
        </div>
        <div className="metric-card">
          <div className="metric-value danger">{metrics.overdueMitigations}</div>
          <div className="metric-label">已逾期</div>
        </div>
      </div>

      {/* 趋势指示器 */}
      <div className="trend-indicator">
        <span className="trend-label">趋势:</span>
        <span className={`trend-value ${metrics.trendDirection}`}>
          {metrics.trendDirection === 'improving' ? '📈 改善' :
           metrics.trendDirection === 'worsening' ? '📉 恶化' : '➡️ 稳定'}
        </span>
      </div>

      {/* 过滤和排序控件 */}
      <div className="controls">
        <div className="filter-group">
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">全部风险</option>
            <option value="high">高风险</option>
            <option value="open">待处理</option>
            <option value="overdue">已逾期</option>
          </select>
        </div>
        
        <div className="sort-group">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="severity">按严重程度</option>
            <option value="probability">按概率</option>
            <option value="date">按日期</option>
          </select>
        </div>
      </div>

      {/* 风险列表 */}
      <div className="risks-list">
        {filteredRisks.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">✅</span>
            <div className="empty-text">
              {filter === 'all' ? '暂无风险记录' : '当前过滤条件下无风险'}
            </div>
          </div>
        ) : (
          filteredRisks.map(risk => (
            <div 
              key={risk.id} 
              className={`risk-item ${expandedRisk === risk.id ? 'expanded' : ''}`}
            >
              <div 
                className="risk-header"
                onClick={() => setExpandedRisk(expandedRisk === risk.id ? null : risk.id)}
              >
                <div className="risk-basic-info">
                  <div className="risk-title">
                    <span className="category-icon">{getCategoryIcon(risk.category)}</span>
                    <span className="title-text">{risk.title}</span>
                  </div>
                  
                  <div className="risk-indicators">
                    <span 
                      className="severity-badge"
                      style={{ backgroundColor: getSeverityColor(risk.severity) }}
                    >
                      {risk.severity === 'high' ? '高' : 
                       risk.severity === 'medium' ? '中' : '低'}
                    </span>
                    
                    <span className="probability-badge">
                      {risk.probability}%
                    </span>
                    
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(risk.status) }}
                    >
                      {risk.status === 'open' ? '待处理' :
                       risk.status === 'mitigating' ? '处理中' : '已解决'}
                    </span>
                  </div>
                </div>

                <div className="risk-meta">
                  <div className="priority-bar">
                    <div 
                      className="priority-fill"
                      style={{ 
                        width: `${getRiskPriority(risk) * 33.33}%`,
                        backgroundColor: getSeverityColor(risk.severity)
                      }}
                    />
                  </div>
                  <div className="owner">👤 {risk.owner}</div>
                </div>
              </div>

              {expandedRisk === risk.id && (
                <div className="risk-details">
                  <div className="description-section">
                    <h6>描述</h6>
                    <p>{risk.description}</p>
                  </div>

                  <div className="impact-section">
                    <h6>影响</h6>
                    <p>{risk.impact}</p>
                  </div>

                  <div className="mitigation-section">
                    <h6>缓解措施</h6>
                    <p>{risk.mitigation}</p>
                  </div>

                  <div className="dates-section">
                    <div className="date-item">
                      <label>识别日期:</label>
                      <span>{risk.identifiedDate.toLocaleDateString()}</span>
                    </div>
                    <div className="date-item">
                      <label>目标解决:</label>
                      <span className={risk.targetResolutionDate < new Date() ? 'overdue' : ''}>
                        {risk.targetResolutionDate.toLocaleDateString()}
                      </span>
                    </div>
                    {risk.actualResolutionDate && (
                      <div className="date-item">
                        <label>实际解决:</label>
                        <span>{risk.actualResolutionDate.toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {risk.tags && risk.tags.length > 0 && (
                    <div className="tags-section">
                      <h6>标签</h6>
                      <div className="tags">
                        {risk.tags.map((tag, index) => (
                          <span key={index} className="tag">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {onRiskUpdate && (
                    <div className="actions-section">
                      <h6>操作</h6>
                      <div className="action-buttons">
                        {risk.status === 'open' && (
                          <button
                            className="action-btn mitigating"
                            onClick={() => handleStatusUpdate(risk.id, 'mitigating')}
                          >
                            开始处理
                          </button>
                        )}
                        {risk.status === 'mitigating' && (
                          <button
                            className="action-btn resolved"
                            onClick={() => handleStatusUpdate(risk.id, 'resolved')}
                          >
                            标记解决
                          </button>
                        )}
                        {risk.status === 'resolved' && (
                          <button
                            className="action-btn reopen"
                            onClick={() => handleStatusUpdate(risk.id, 'open')}
                          >
                            重新打开
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 样式 */}
      <style>{`
        .risk-panel {
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

        .risk-score {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .score-label {
          font-size: 10px;
          color: #666;
          text-transform: uppercase;
        }

        .score-value {
          font-size: 18px;
          font-weight: bold;
          padding: 4px 8px;
          border-radius: 4px;
          color: white;
        }

        .score-value.low { background: #52c41a; }
        .score-value.medium { background: #fa8c16; }
        .score-value.high { background: #ff4d4f; }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          padding: 16px 20px;
          background: #fafafa;
        }

        .metric-card {
          text-align: center;
          padding: 12px;
          background: white;
          border-radius: 6px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .metric-value {
          font-size: 20px;
          font-weight: bold;
          color: #333;
          margin-bottom: 4px;
        }

        .metric-value.critical { color: #ff4d4f; }
        .metric-value.warning { color: #fa8c16; }
        .metric-value.danger { color: #ff4d4f; }

        .metric-label {
          font-size: 12px;
          color: #666;
        }

        .trend-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: white;
          border-bottom: 1px solid #f0f0f0;
        }

        .trend-label {
          font-size: 12px;
          color: #666;
          font-weight: 500;
        }

        .trend-value {
          font-size: 12px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .trend-value.improving { color: #52c41a; background: #f6ffed; }
        .trend-value.stable { color: #1890ff; background: #e6f7ff; }
        .trend-value.worsening { color: #ff4d4f; background: #fff2f0; }

        .controls {
          display: flex;
          gap: 12px;
          padding: 12px 20px;
          background: white;
          border-bottom: 1px solid #f0f0f0;
        }

        .filter-group select,
        .sort-group select {
          padding: 6px 8px;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          font-size: 12px;
          background: white;
        }

        .risks-list {
          flex: 1;
          overflow-y: auto;
          padding: 0 20px;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
        }

        .empty-icon {
          font-size: 32px;
          margin-bottom: 12px;
        }

        .empty-text {
          font-size: 14px;
          color: #666;
        }

        .risk-item {
          border-bottom: 1px solid #f0f0f0;
          transition: all 0.2s;
        }

        .risk-item:hover {
          background: #fafafa;
        }

        .risk-item.expanded {
          background: #f8f9fa;
        }

        .risk-header {
          padding: 16px 0;
          cursor: pointer;
        }

        .risk-basic-info {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .risk-title {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .category-icon {
          font-size: 16px;
        }

        .title-text {
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }

        .risk-indicators {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }

        .severity-badge,
        .probability-badge,
        .status-badge {
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
          color: white;
        }

        .probability-badge {
          background: #1890ff;
        }

        .risk-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .priority-bar {
          width: 100px;
          height: 4px;
          background: #f0f0f0;
          border-radius: 2px;
          overflow: hidden;
        }

        .priority-fill {
          height: 100%;
          transition: width 0.3s;
        }

        .owner {
          font-size: 12px;
          color: #666;
        }

        .risk-details {
          padding: 0 0 16px 0;
          border-top: 1px solid #f0f0f0;
          margin-top: 8px;
        }

        .risk-details h6 {
          margin: 16px 0 8px 0;
          font-size: 12px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
        }

        .risk-details p {
          margin: 0;
          font-size: 13px;
          color: #333;
          line-height: 1.4;
        }

        .dates-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 8px;
          margin: 16px 0;
        }

        .date-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .date-item label {
          font-size: 11px;
          color: #666;
          font-weight: 500;
        }

        .date-item span {
          font-size: 12px;
          color: #333;
        }

        .date-item span.overdue {
          color: #ff4d4f;
          font-weight: 500;
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .tag {
          padding: 2px 6px;
          background: #f0f0f0;
          color: #666;
          border-radius: 4px;
          font-size: 11px;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .action-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn.mitigating {
          background: #fa8c16;
          color: white;
        }

        .action-btn.resolved {
          background: #52c41a;
          color: white;
        }

        .action-btn.reopen {
          background: #d9d9d9;
          color: #666;
        }

        .action-btn:hover {
          opacity: 0.8;
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
};

export { RiskPanel };