import * as React from 'react';
import { useState, useEffect } from 'react';
import { ThoughtStep } from './intelligentAgent';

interface AgentVisualizerProps {
  thoughtProcess: ThoughtStep[];
  isProcessing?: boolean;
}

const AgentVisualizer: React.FC<AgentVisualizerProps> = ({ thoughtProcess, isProcessing = false }) => {
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);
  
  // 当一个新的思考步骤被添加时，自动展开它
  useEffect(() => {
    if (thoughtProcess.length > 0) {
      setExpandedSteps(prevExpanded => {
        if (!prevExpanded.includes(thoughtProcess.length - 1)) {
          return [...prevExpanded, thoughtProcess.length - 1];
        }
        return prevExpanded;
      });
    }
  }, [thoughtProcess.length]);
  
  // 切换展开/折叠状态
  const toggleExpand = (index: number) => {
    setExpandedSteps(prevExpanded => {
      if (prevExpanded.includes(index)) {
        return prevExpanded.filter(i => i !== index);
      } else {
        return [...prevExpanded, index];
      }
    });
  };
  
  // 格式化时间戳
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };
  
  // 格式化工具结果，限制显示长度
  const formatToolResult = (result: any) => {
    if (!result) return '无结果';
    
    try {
      const resultStr = JSON.stringify(result, null, 2);
      if (resultStr.length > 500) {
        return resultStr.substring(0, 500) + '...';
      }
      return resultStr;
    } catch (e) {
      return '无法显示结果';
    }
  };
  
  // 获取步骤类型的颜色和图标
  const getStepStyle = (step: ThoughtStep) => {
    if (step.action === 'finish') {
      return { color: '#4CAF50', icon: '✓' }; // 完成-绿色
    }
    
    if (step.toolUsed) {
      // 检查是否有错误
      if (step.result && step.result.error) {
        return { color: '#F44336', icon: '✗' }; // 错误-红色
      }
      return { color: '#2196F3', icon: '🔧' }; // 工具调用-蓝色
    }
    
    return { color: '#FF9800', icon: '💭' }; // 思考-橙色
  };
  
  return (
    <div className="agent-visualizer">
      <h3>智能Agent处理流程 {isProcessing && <span className="processing-indicator">处理中...</span>}</h3>
      
      {thoughtProcess.length === 0 ? (
        <div className="empty-state">
          {isProcessing ? '等待Agent开始处理...' : '没有处理记录'}
        </div>
      ) : (
        <div className="thought-timeline">
          {thoughtProcess.map((step, index) => {
            const isExpanded = expandedSteps.includes(index);
            const { color, icon } = getStepStyle(step);
            
            return (
              <div 
                key={index} 
                className={`thought-step ${isExpanded ? 'expanded' : ''}`}
                style={{ borderLeftColor: color }}
              >
                <div className="step-header" onClick={() => toggleExpand(index)}>
                  <span className="step-icon" style={{ backgroundColor: color }}>{icon}</span>
                  <span className="step-time">{formatTime(step.timestamp)}</span>
                  <span className="step-title">
                    {step.toolUsed 
                      ? `使用工具: ${step.toolUsed}` 
                      : (step.action === 'finish' 
                        ? '完成处理' 
                        : '思考分析')}
                  </span>
                  <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                </div>
                
                {isExpanded && (
                  <div className="step-details">
                    <div className="thought-content">
                      <h4>思考过程:</h4>
                      <p>{step.thought}</p>
                    </div>
                    
                    <div className="action-content">
                      <h4>决定的行动:</h4>
                      <p>{step.action}</p>
                    </div>
                    
                    {step.toolUsed && (
                      <div className="tool-result">
                        <h4>工具结果:</h4>
                        <pre>{formatToolResult(step.result)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// 创建一个流程图组件，以可视化方式展示Agent处理流程
const AgentFlowVisualizer: React.FC<AgentVisualizerProps> = ({ thoughtProcess }) => {
  if (thoughtProcess.length === 0) {
    return (
      <div className="agent-flow-visualizer empty">
        <p>没有处理记录</p>
      </div>
    );
  }
  
  // 构建流程数据
  const flowSteps: {type: string; name: string; result?: string; time: string}[] = [];
  
  // 添加初始分析步骤
  flowSteps.push({
    type: 'analysis',
    name: '初始分析',
    time: formatTime(thoughtProcess[0].timestamp - 1000)
  });
  
  // 添加每个思考和工具调用步骤
  thoughtProcess.forEach((step, index) => {
    if (step.toolUsed) {
      flowSteps.push({
        type: 'tool',
        name: step.toolUsed,
        result: step.result && step.result.error 
          ? '失败'
          : '成功',
        time: formatTime(step.timestamp)
      });
    } else if (index > 0 || step.action !== 'finish') {
      flowSteps.push({
        type: 'thought',
        name: '思考分析',
        time: formatTime(step.timestamp)
      });
    }
  });
  
  // 添加决策步骤
  flowSteps.push({
    type: 'decision',
    name: '最终决策',
    time: formatTime(thoughtProcess[thoughtProcess.length - 1].timestamp + 1000)
  });
  
  function formatTime(timestamp: number) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }
  
  return (
    <div className="agent-flow-visualizer">
      <h3>处理流程图</h3>
      
      <div className="flow-diagram">
        {flowSteps.map((step, index) => {
          let iconClass = '';
          switch (step.type) {
            case 'analysis':
              iconClass = 'icon-analysis';
              break;
            case 'thought':
              iconClass = 'icon-thought';
              break;
            case 'tool':
              iconClass = 'icon-tool';
              break;
            case 'decision':
              iconClass = 'icon-decision';
              break;
          }
          
          return (
            <React.Fragment key={index}>
              <div className={`flow-node ${step.type} ${step.result === '失败' ? 'error' : ''}`}>
                <div className={`node-icon ${iconClass}`}></div>
                <div className="node-content">
                  <div className="node-title">{step.name}</div>
                  <div className="node-time">{step.time}</div>
                </div>
              </div>
              
              {index < flowSteps.length - 1 && (
                <div className="flow-connector"></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// Agent处理结果组件
interface AgentResultSummaryProps {
  result: {
    isImportant: boolean;
    shouldStore: boolean;
    shouldNotify: boolean;
    confidence: number;
    summary: string;
    reasonsToStore?: string[];
  };
}

const AgentResultSummary: React.FC<AgentResultSummaryProps> = ({ result }) => {
  return (
    <div className="agent-result-summary">
      <h3>处理结果</h3>
      
      <div className="result-card">
        <div className="result-header">
          <div className="confidence-meter" title={`置信度: ${Math.round(result.confidence * 100)}%`}>
            <div 
              className="confidence-fill" 
              style={{ width: `${Math.round(result.confidence * 100)}%` }}
            ></div>
          </div>
        </div>
        
        <div className="result-body">
          <div className="summary-section">
            <h4>消息总结</h4>
            <p>{result.summary}</p>
          </div>
          
          <div className="decisions-section">
            <div className={`decision-badge ${result.isImportant ? 'important' : 'not-important'}`}>
              {result.isImportant ? '重要' : '非重要'}
            </div>
            
            <div className={`decision-badge ${result.shouldStore ? 'store' : 'no-store'}`}>
              {result.shouldStore ? '已存储' : '未存储'}
            </div>
            
            <div className={`decision-badge ${result.shouldNotify ? 'notify' : 'no-notify'}`}>
              {result.shouldNotify ? '已通知' : '未通知'}
            </div>
          </div>
          
          {result.reasonsToStore && result.reasonsToStore.length > 0 && (
            <div className="reasons-section">
              <h4>存储理由</h4>
              <ul>
                {result.reasonsToStore.map((reason, index) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { AgentVisualizer, AgentFlowVisualizer, AgentResultSummary }; 