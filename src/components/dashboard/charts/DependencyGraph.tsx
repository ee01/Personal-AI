/**
 * 依赖关系图组件 - 项目依赖关系可视化
 * 支持交互式编辑和依赖路径分析
 */

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';

interface Dependency {
  id: string;
  type: 'design' | 'backend' | 'external' | 'internal';
  source: string;
  target: string;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  criticality: 'high' | 'medium' | 'low';
  estimatedCompletion: Date;
  actualCompletion?: Date;
  blockerReason?: string;
  contactPerson?: string;
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
  tasks: any[];
}

interface DependencyGraphProps {
  dependencies: Dependency[];
  milestones: Milestone[];
  editable?: boolean;
  onDependencyEdit?: (itemType: string, itemId: string, changes: any) => void;
}

interface GraphNode {
  id: string;
  name: string;
  type: 'milestone' | 'external' | 'team' | 'system';
  status: string;
  progress: number;
  x: number;
  y: number;
  level: number;
  dependencies: string[];
  dependents: string[];
  critical: boolean;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'design' | 'backend' | 'external' | 'internal';
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  criticality: 'high' | 'medium' | 'low';
  label?: string;
}

const DependencyGraph: React.FC<DependencyGraphProps> = ({
  dependencies,
  milestones,
  editable = false,
  onDependencyEdit
}) => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [layout, setLayout] = useState<'hierarchical' | 'force' | 'circular'>('hierarchical');
  const [showCriticalPath, setShowCriticalPath] = useState(true);
  const [criticalPath, setCriticalPath] = useState<string[]>([]);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    buildGraph();
  }, [dependencies, milestones, layout]);

  useEffect(() => {
    if (showCriticalPath) {
      calculateCriticalPath();
    }
  }, [nodes, edges, showCriticalPath]);

  // 构建图数据
  const buildGraph = () => {
    const nodeMap = new Map<string, GraphNode>();
    const edgeList: GraphEdge[] = [];

    // 创建里程碑节点
    milestones.forEach(milestone => {
      nodeMap.set(milestone.id, {
        id: milestone.id,
        name: milestone.name,
        type: 'milestone',
        status: milestone.status,
        progress: milestone.progress,
        x: 0,
        y: 0,
        level: 0,
        dependencies: milestone.dependencies,
        dependents: [],
        critical: false
      });
    });

    // 处理依赖关系
    dependencies.forEach(dep => {
      // 确保源和目标节点存在
      if (!nodeMap.has(dep.source)) {
        nodeMap.set(dep.source, {
          id: dep.source,
          name: dep.source,
          type: dep.type === 'external' ? 'external' : 'system',
          status: 'unknown',
          progress: 0,
          x: 0,
          y: 0,
          level: 0,
          dependencies: [],
          dependents: [],
          critical: false
        });
      }

      if (!nodeMap.has(dep.target)) {
        nodeMap.set(dep.target, {
          id: dep.target,
          name: dep.target,
          type: 'system',
          status: 'unknown',
          progress: 0,
          x: 0,
          y: 0,
          level: 0,
          dependencies: [],
          dependents: [],
          critical: false
        });
      }

      // 创建边
      edgeList.push({
        id: dep.id,
        source: dep.source,
        target: dep.target,
        type: dep.type,
        status: dep.status,
        criticality: dep.criticality,
        label: dep.blockerReason
      });

      // 更新依赖关系
      const sourceNode = nodeMap.get(dep.source)!;
      const targetNode = nodeMap.get(dep.target)!;
      
      if (!sourceNode.dependents.includes(dep.target)) {
        sourceNode.dependents.push(dep.target);
      }
      if (!targetNode.dependencies.includes(dep.source)) {
        targetNode.dependencies.push(dep.source);
      }
    });

    const nodeList = Array.from(nodeMap.values());
    
    // 计算层级
    calculateLevels(nodeList);
    
    // 应用布局
    applyLayout(nodeList, edgeList);
    
    setNodes(nodeList);
    setEdges(edgeList);
  };

  // 计算节点层级
  const calculateLevels = (nodeList: GraphNode[]) => {
    const visited = new Set<string>();
    const levels = new Map<string, number>();

    const calculateLevel = (nodeId: string): number => {
      if (levels.has(nodeId)) {
        return levels.get(nodeId)!;
      }

      if (visited.has(nodeId)) {
        // 检测到循环依赖
        console.warn('检测到循环依赖:', nodeId);
        return 0;
      }

      visited.add(nodeId);
      const node = nodeList.find(n => n.id === nodeId);
      
      if (!node || node.dependencies.length === 0) {
        levels.set(nodeId, 0);
        visited.delete(nodeId);
        return 0;
      }

      const maxDependencyLevel = Math.max(
        ...node.dependencies.map(depId => calculateLevel(depId))
      );
      
      const level = maxDependencyLevel + 1;
      levels.set(nodeId, level);
      visited.delete(nodeId);
      
      return level;
    };

    nodeList.forEach(node => {
      node.level = calculateLevel(node.id);
    });
  };

  // 应用布局算法
  const applyLayout = (nodeList: GraphNode[], edgeList: GraphEdge[]) => {
    const containerWidth = 800;
    const containerHeight = 600;

    switch (layout) {
      case 'hierarchical':
        applyHierarchicalLayout(nodeList, containerWidth, containerHeight);
        break;
      case 'force':
        applyForceLayout(nodeList, edgeList, containerWidth, containerHeight);
        break;
      case 'circular':
        applyCircularLayout(nodeList, containerWidth, containerHeight);
        break;
    }
  };

  // 层次布局
  const applyHierarchicalLayout = (nodeList: GraphNode[], width: number, height: number) => {
    const levelGroups = new Map<number, GraphNode[]>();
    const maxLevel = Math.max(...nodeList.map(n => n.level));

    // 按层级分组
    nodeList.forEach(node => {
      if (!levelGroups.has(node.level)) {
        levelGroups.set(node.level, []);
      }
      levelGroups.get(node.level)!.push(node);
    });

    // 分配位置
    for (let level = 0; level <= maxLevel; level++) {
      const nodesInLevel = levelGroups.get(level) || [];
      const levelY = (height / (maxLevel + 1)) * (level + 1);
      
      nodesInLevel.forEach((node, index) => {
        node.x = (width / (nodesInLevel.length + 1)) * (index + 1);
        node.y = levelY;
      });
    }
  };

  // 力导向布局 (简化版)
  const applyForceLayout = (nodeList: GraphNode[], edgeList: GraphEdge[], width: number, height: number) => {
    // 初始随机位置
    nodeList.forEach(node => {
      node.x = Math.random() * width;
      node.y = Math.random() * height;
    });

    // 简单的力导向算法
    for (let iteration = 0; iteration < 100; iteration++) {
      // 斥力
      for (let i = 0; i < nodeList.length; i++) {
        for (let j = i + 1; j < nodeList.length; j++) {
          const node1 = nodeList[i];
          const node2 = nodeList[j];
          const dx = node2.x - node1.x;
          const dy = node2.y - node1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0) {
            const force = 1000 / (distance * distance);
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            node1.x -= fx * 0.1;
            node1.y -= fy * 0.1;
            node2.x += fx * 0.1;
            node2.y += fy * 0.1;
          }
        }
      }

      // 引力 (连接的节点之间)
      edgeList.forEach(edge => {
        const source = nodeList.find(n => n.id === edge.source);
        const target = nodeList.find(n => n.id === edge.target);
        
        if (source && target) {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0) {
            const force = distance * 0.01;
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            source.x += fx;
            source.y += fy;
            target.x -= fx;
            target.y -= fy;
          }
        }
      });

      // 边界约束
      nodeList.forEach(node => {
        node.x = Math.max(50, Math.min(width - 50, node.x));
        node.y = Math.max(50, Math.min(height - 50, node.y));
      });
    }
  };

  // 圆形布局
  const applyCircularLayout = (nodeList: GraphNode[], width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;
    
    nodeList.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodeList.length;
      node.x = centerX + radius * Math.cos(angle);
      node.y = centerY + radius * Math.sin(angle);
    });
  };

  // 计算关键路径
  const calculateCriticalPath = () => {
    // 简化的关键路径算法
    const path: string[] = [];
    const visited = new Set<string>();
    
    // 找到最长路径
    const findLongestPath = (nodeId: string, currentPath: string[]): string[] => {
      if (visited.has(nodeId)) return currentPath;
      
      visited.add(nodeId);
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return currentPath;
      
      const newPath = [...currentPath, nodeId];
      
      if (node.dependents.length === 0) {
        return newPath; // 叶子节点
      }
      
      let longestPath = newPath;
      node.dependents.forEach(dependentId => {
        const path = findLongestPath(dependentId, newPath);
        if (path.length > longestPath.length) {
          longestPath = path;
        }
      });
      
      visited.delete(nodeId);
      return longestPath;
    };

    // 从没有依赖的节点开始
    const rootNodes = nodes.filter(n => n.dependencies.length === 0);
    let criticalPath: string[] = [];
    
    rootNodes.forEach(root => {
      const path = findLongestPath(root.id, []);
      if (path.length > criticalPath.length) {
        criticalPath = path;
      }
    });

    setCriticalPath(criticalPath);
    
    // 标记关键路径上的节点
    setNodes(prev => prev.map(node => ({
      ...node,
      critical: criticalPath.includes(node.id)
    })));
  };

  // 处理节点点击
  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(selectedNode === nodeId ? null : nodeId);
    setSelectedEdge(null);
  };

  // 处理边点击
  const handleEdgeClick = (edgeId: string) => {
    setSelectedEdge(selectedEdge === edgeId ? null : edgeId);
    setSelectedNode(null);
  };

  return (
    <div className="dependency-graph" ref={containerRef}>
      {/* 控制面板 */}
      <div className="graph-controls">
        <div className="graph-title">
          <h3>🕸️ 依赖关系图</h3>
          <div className="graph-stats">
            <span>节点: {nodes.length}</span>
            <span>依赖: {edges.length}</span>
            {criticalPath.length > 0 && (
              <span>关键路径: {criticalPath.length} 步</span>
            )}
          </div>
        </div>

        <div className="control-group">
          <div className="layout-selector">
            <label>布局:</label>
            <select value={layout} onChange={(e) => setLayout(e.target.value as any)}>
              <option value="hierarchical">层次布局</option>
              <option value="force">力导向布局</option>
              <option value="circular">圆形布局</option>
            </select>
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showCriticalPath}
              onChange={(e) => setShowCriticalPath(e.target.checked)}
            />
            显示关键路径
          </label>

          {editable && (
            <div className="edit-indicator">
              ✏️ 编辑模式
            </div>
          )}
        </div>
      </div>

      {/* 图例 */}
      <div className="graph-legend">
        <div className="legend-item">
          <div className="node-example milestone"></div>
          <span>里程碑</span>
        </div>
        <div className="legend-item">
          <div className="node-example external"></div>
          <span>外部依赖</span>
        </div>
        <div className="legend-item">
          <div className="node-example system"></div>
          <span>系统/团队</span>
        </div>
        <div className="legend-item">
          <div className="edge-example high"></div>
          <span>高优先级</span>
        </div>
        <div className="legend-item">
          <div className="edge-example blocked"></div>
          <span>阻塞状态</span>
        </div>
      </div>

      {/* SVG 图形区域 */}
      <div className="graph-container">
        <svg
          ref={svgRef}
          width="100%"
          height="600"
          viewBox="0 0 800 600"
          className="dependency-svg"
        >
          {/* 定义箭头标记 */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
            </marker>
            <marker
              id="arrowhead-critical"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#ff4d4f" />
            </marker>
          </defs>

          {/* 渲染边 */}
          {edges.map(edge => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            
            if (!sourceNode || !targetNode) return null;

            const isCritical = showCriticalPath && 
              criticalPath.includes(edge.source) && 
              criticalPath.includes(edge.target);
            
            const isSelected = selectedEdge === edge.id;

            return (
              <g key={edge.id}>
                <line
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke={
                    isCritical ? '#ff4d4f' :
                    edge.status === 'blocked' ? '#ff7875' :
                    edge.criticality === 'high' ? '#fa8c16' :
                    edge.criticality === 'medium' ? '#1890ff' : '#d9d9d9'
                  }
                  strokeWidth={
                    isSelected ? 4 :
                    isCritical ? 3 :
                    edge.criticality === 'high' ? 2 : 1
                  }
                  strokeDasharray={edge.status === 'pending' ? '5,5' : 'none'}
                  markerEnd={isCritical ? 'url(#arrowhead-critical)' : 'url(#arrowhead)'}
                  className="dependency-edge"
                  onClick={() => handleEdgeClick(edge.id)}
                />
                
                {/* 边标签 */}
                {(isSelected || edge.label) && (
                  <text
                    x={(sourceNode.x + targetNode.x) / 2}
                    y={(sourceNode.y + targetNode.y) / 2 - 10}
                    textAnchor="middle"
                    className="edge-label"
                    fontSize="10"
                    fill="#666"
                  >
                    {edge.label || getEdgeTypeLabel(edge.type)}
                  </text>
                )}
              </g>
            );
          })}

          {/* 渲染节点 */}
          {nodes.map(node => {
            const isSelected = selectedNode === node.id;
            const isCritical = showCriticalPath && node.critical;

            return (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isSelected ? 25 : isCritical ? 22 : 20}
                  fill={getNodeColor(node.type, node.status)}
                  stroke={
                    isCritical ? '#ff4d4f' :
                    isSelected ? '#1890ff' : '#d9d9d9'
                  }
                  strokeWidth={isSelected ? 3 : isCritical ? 2 : 1}
                  className="graph-node"
                  onClick={() => handleNodeClick(node.id)}
                />
                
                {/* 进度指示器 */}
                {node.type === 'milestone' && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={15}
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeDasharray={`${node.progress * 0.94} ${100 - node.progress * 0.94}`}
                    strokeDashoffset="25"
                    transform={`rotate(-90 ${node.x} ${node.y})`}
                  />
                )}

                {/* 节点图标 */}
                <text
                  x={node.x}
                  y={node.y + 4}
                  textAnchor="middle"
                  className="node-icon"
                  fontSize="14"
                  fill="white"
                >
                  {getNodeIcon(node.type)}
                </text>

                {/* 节点标签 */}
                <text
                  x={node.x}
                  y={node.y + 35}
                  textAnchor="middle"
                  className="node-label"
                  fontSize="12"
                  fill="#333"
                >
                  {node.name.length > 10 ? node.name.substring(0, 10) + '...' : node.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 详情面板 */}
      {(selectedNode || selectedEdge) && (
        <div className="graph-details">
          {selectedNode && (() => {
            const node = nodes.find(n => n.id === selectedNode);
            if (!node) return null;
            
            return (
              <div className="node-details">
                <h4>{getNodeIcon(node.type)} {node.name}</h4>
                <div className="details-grid">
                  <div className="detail-item">
                    <label>类型:</label>
                    <span>{getNodeTypeLabel(node.type)}</span>
                  </div>
                  <div className="detail-item">
                    <label>状态:</label>
                    <span className={`status status-${node.status}`}>
                      {getStatusLabel(node.status)}
                    </span>
                  </div>
                  {node.type === 'milestone' && (
                    <div className="detail-item">
                      <label>进度:</label>
                      <span>{node.progress}%</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <label>依赖数:</label>
                    <span>{node.dependencies.length}</span>
                  </div>
                  <div className="detail-item">
                    <label>被依赖数:</label>
                    <span>{node.dependents.length}</span>
                  </div>
                  {showCriticalPath && (
                    <div className="detail-item">
                      <label>关键路径:</label>
                      <span>{node.critical ? '是' : '否'}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {selectedEdge && (() => {
            const edge = edges.find(e => e.id === selectedEdge);
            const dep = dependencies.find(d => d.id === selectedEdge);
            if (!edge || !dep) return null;
            
            return (
              <div className="edge-details">
                <h4>🔗 依赖关系</h4>
                <div className="details-grid">
                  <div className="detail-item">
                    <label>类型:</label>
                    <span>{getEdgeTypeLabel(edge.type)}</span>
                  </div>
                  <div className="detail-item">
                    <label>状态:</label>
                    <span className={`status status-${edge.status}`}>
                      {getStatusLabel(edge.status)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>优先级:</label>
                    <span className={`priority priority-${edge.criticality}`}>
                      {edge.criticality === 'high' ? '高' : 
                       edge.criticality === 'medium' ? '中' : '低'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>预计完成:</label>
                    <span>{dep.estimatedCompletion.toLocaleDateString()}</span>
                  </div>
                  {dep.actualCompletion && (
                    <div className="detail-item">
                      <label>实际完成:</label>
                      <span>{dep.actualCompletion.toLocaleDateString()}</span>
                    </div>
                  )}
                  {dep.contactPerson && (
                    <div className="detail-item">
                      <label>联系人:</label>
                      <span>{dep.contactPerson}</span>
                    </div>
                  )}
                  {dep.blockerReason && (
                    <div className="detail-item blocker">
                      <label>阻塞原因:</label>
                      <span>{dep.blockerReason}</span>
                    </div>
                  )}
                </div>

                {editable && onDependencyEdit && (
                  <div className="edit-actions">
                    <button
                      onClick={() => onDependencyEdit('dependency', edge.id, {
                        status: edge.status === 'completed' ? 'in-progress' : 'completed'
                      })}
                      className="edit-btn"
                    >
                      {edge.status === 'completed' ? '标记为进行中' : '标记为完成'}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          <button 
            className="close-details"
            onClick={() => {
              setSelectedNode(null);
              setSelectedEdge(null);
            }}
          >
            关闭
          </button>
        </div>
      )}

      {/* 样式 */}
      <style>{`
        .dependency-graph {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: white;
          border-radius: 8px;
          overflow: hidden;
        }

        .graph-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e0e0e0;
        }

        .graph-title h3 {
          margin: 0 0 4px 0;
          font-size: 18px;
          font-weight: 600;
        }

        .graph-stats {
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

        .layout-selector {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .layout-selector label {
          font-size: 14px;
          font-weight: 500;
        }

        .layout-selector select {
          padding: 4px 8px;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          font-size: 12px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          cursor: pointer;
        }

        .edit-indicator {
          padding: 4px 8px;
          background: #52c41a;
          color: white;
          border-radius: 4px;
          font-size: 12px;
        }

        .graph-legend {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 12px 20px;
          background: #fafafa;
          border-bottom: 1px solid #e0e0e0;
          font-size: 12px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .node-example {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .node-example.milestone { background: #1890ff; }
        .node-example.external { background: #fa8c16; }
        .node-example.system { background: #52c41a; }

        .edge-example {
          width: 16px;
          height: 2px;
        }

        .edge-example.high { background: #fa8c16; }
        .edge-example.blocked { background: #ff7875; }

        .graph-container {
          flex: 1;
          overflow: auto;
          background: #fafafa;
        }

        .dependency-svg {
          background: white;
          border: 1px solid #e0e0e0;
        }

        .graph-node {
          cursor: pointer;
          transition: all 0.2s;
        }

        .graph-node:hover {
          filter: brightness(1.1);
        }

        .dependency-edge {
          cursor: pointer;
          transition: all 0.2s;
        }

        .dependency-edge:hover {
          stroke-width: 3;
        }

        .node-icon {
          font-weight: bold;
          pointer-events: none;
        }

        .node-label {
          pointer-events: none;
          font-weight: 500;
        }

        .edge-label {
          pointer-events: none;
          font-weight: 500;
        }

        .graph-details {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: white;
          border-top: 1px solid #e0e0e0;
          box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
          padding: 20px;
          max-height: 200px;
          overflow-y: auto;
        }

        .node-details h4,
        .edge-details h4 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .detail-item.blocker {
          grid-column: 1 / -1;
          background: #fff2f0;
          padding: 8px;
          border-radius: 4px;
        }

        .detail-item label {
          font-weight: 500;
          color: #666;
          font-size: 12px;
        }

        .detail-item span {
          font-size: 14px;
        }

        .status {
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
          text-transform: uppercase;
          font-size: 10px;
        }

        .status-pending { background: #f0f0f0; color: #666; }
        .status-in-progress { background: #e6f7ff; color: #1890ff; }
        .status-completed { background: #f6ffed; color: #52c41a; }
        .status-blocked { background: #fff2f0; color: #ff4d4f; }
        .status-on-track { background: #f6ffed; color: #52c41a; }
        .status-at-risk { background: #fff7e6; color: #fa8c16; }
        .status-delayed { background: #fff2f0; color: #ff4d4f; }

        .priority {
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
          font-size: 10px;
        }

        .priority-high { background: #fff2f0; color: #ff4d4f; }
        .priority-medium { background: #fff7e6; color: #fa8c16; }
        .priority-low { background: #f6ffed; color: #52c41a; }

        .edit-actions {
          margin-top: 12px;
        }

        .edit-btn {
          padding: 6px 12px;
          background: #1890ff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .edit-btn:hover {
          background: #40a9ff;
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
function getNodeColor(type: string, status: string): string {
  if (status === 'blocked') return '#ff7875';
  
  switch (type) {
    case 'milestone':
      return status === 'completed' ? '#52c41a' : '#1890ff';
    case 'external':
      return '#fa8c16';
    case 'team':
      return '#722ed1';
    case 'system':
      return '#13c2c2';
    default:
      return '#d9d9d9';
  }
}

function getNodeIcon(type: string): string {
  switch (type) {
    case 'milestone': return '🎯';
    case 'external': return '🔗';
    case 'team': return '👥';
    case 'system': return '⚙️';
    default: return '📦';
  }
}

function getNodeTypeLabel(type: string): string {
  const labels = {
    'milestone': '里程碑',
    'external': '外部依赖',
    'team': '团队',
    'system': '系统'
  };
  return labels[type] || type;
}

function getEdgeTypeLabel(type: string): string {
  const labels = {
    'design': '设计依赖',
    'backend': '后端依赖',
    'external': '外部依赖',
    'internal': '内部依赖'
  };
  return labels[type] || type;
}

function getStatusLabel(status: string): string {
  const labels = {
    'pending': '待处理',
    'in-progress': '进行中',
    'completed': '已完成',
    'blocked': '已阻塞',
    'on-track': '正常',
    'at-risk': '风险',
    'delayed': '延期'
  };
  return labels[status] || status;
}

export { DependencyGraph };