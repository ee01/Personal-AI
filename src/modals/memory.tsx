import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import { ENTITY_TYPE_CONFIG } from '../storage/HybridGraphStore';

// 扩展Window接口
declare global {
  interface Window {
    hideLoadingOverlay?: () => void;
  }
}

// 数据接口定义
interface EntityType {
  type: string;
  name: string;
  icon: string;
  count: number;
}

interface EntityItem {
  id: string;
  name: string;
  type: string;
  description?: string;
  importance?: number;
  accessCount?: number;
  lastAccessed?: number;
  updated?: number;
  relationshipsCount?: number;
  relatedMessagesCount?: number;
  relatedWebpagesCount?: number;
  tags?: string[];
  status?: string;
  avatarUrl?: string;
}

interface TimelineEvent {
  id: string;
  type: 'message' | 'webpage' | 'relation_created' | 'entity_updated';
  title: string;
  content: string;
  timestamp: number;
  source?: string;
  metadata?: any;
}

interface OverviewStats {
  totalEntities: number;
  totalRelationships: number;
  entitiesCreatedToday: number;
  entitiesCreatedThisWeek: number;
  entitiesCreatedThisMonth: number;
  entityCounts: Record<string, number>;
  topEntitiesByType: Record<string, EntityItem[]>;
}

// 实体记忆查询组件
const MemoryInterface = () => {
  // 状态管理
  const [activeView, setActiveView] = useState<'overview' | 'timeline' | 'entity-detail'>('overview');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('overview');
  const [selectedEntity, setSelectedEntity] = useState<EntityItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);

  // 实体类型配置已从 HybridGraphStore 导入

  // 初始化数据
  useEffect(() => {
    initializeMemoryInterface();
    
    // 额外的安全措施：延迟隐藏loading overlay以防初始化过快
    const hideLoadingTimeout = setTimeout(() => {
      const loadingOverlay = document.getElementById('loading-overlay');
      if (loadingOverlay && !loadingOverlay.classList.contains('hidden')) {
        loadingOverlay.classList.add('hidden');
        console.log('⏰ 延迟隐藏加载遮罩（安全措施）');
      }
    }, 2000);

    // 清理定时器
    return () => {
      clearTimeout(hideLoadingTimeout);
    };
  }, []);

  // 监听搜索变化
  useEffect(() => {
    if (searchQuery.length > 2) {
      performSearch(searchQuery);
    } else if (selectedEntityType !== 'overview' && selectedEntityType !== 'timeline') {
      loadEntitiesByType(selectedEntityType);
    }
  }, [searchQuery, selectedEntityType]);

  // 初始化接口
  const initializeMemoryInterface = async () => {
    setIsLoading(true);
    console.log('🚀 开始初始化记忆界面...');
    try {
      // 加载概览统计
      console.log('📊 加载概览统计...');
      await loadOverviewStats();
      
      // 加载实体类型统计
      console.log('📋 加载实体类型...');
      await loadEntityTypes();
      
      // 加载最近时间轴
      if (activeView === 'timeline') {
        console.log('⏰ 加载时间轴...');
        await loadRecentTimeline();
      }

      console.log('✅ 记忆界面初始化完成');
    } catch (error) {
      console.error('❌ 初始化记忆界面失败:', error);
    } finally {
      setIsLoading(false);
      
      // 直接操作DOM隐藏HTML中的加载遮罩
      const loadingOverlay = document.getElementById('loading-overlay');
      if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
        console.log('📱 加载遮罩已隐藏');
      }
    }
  };

  // 加载概览统计
  const loadOverviewStats = async () => {
    try {
      console.log('📊 请求实体统计数据...');
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ENTITY_STATISTICS'
      });

      console.log('📊 实体统计响应:', response);
      if (response && response.success) {
        console.log('📊 设置概览统计数据:', response.data);
        setOverviewStats(response.data);
      } else {
        console.warn('📊 获取实体统计失败:', response?.error);
      }
    } catch (error) {
      console.error('❌ 加载概览统计失败:', error);
      // 设置默认数据
      const defaultStats = {
        totalEntities: 0,
        totalRelationships: 0,
        entitiesCreatedToday: 0,
        entitiesCreatedThisWeek: 0,
        entitiesCreatedThisMonth: 0,
        entityCounts: {},
        topEntitiesByType: {}
      };
      console.log('📊 使用默认统计数据:', defaultStats);
      setOverviewStats(defaultStats);
    }
  };

  // 加载实体类型
  const loadEntityTypes = async () => {
    try {
      console.log('📋 请求实体类型数据...');
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ENTITY_TYPES'
      });

      console.log('📋 实体类型响应:', response);
      if (response && response.success) {
        // 使用新的API响应格式
        if (response.data.entityTypes && Array.isArray(response.data.entityTypes)) {
          console.log('📋 使用新格式的实体类型数据:', response.data.entityTypes);
          const types: EntityType[] = response.data.entityTypes.map((entityType: any) => ({
            type: entityType.type,
            name: entityType.name,
            icon: entityType.icon,
            count: entityType.count
          }));
          console.log('📋 设置实体类型:', types);
          setEntityTypes(types);
        } else {
          // 向后兼容：使用entityCounts
          console.log('📋 使用向后兼容格式:', response.data.entityCounts);
          const types: EntityType[] = Object.entries(response.data.entityCounts || {}).map(([type, count]) => ({
            type,
            name: ENTITY_TYPE_CONFIG[type]?.name || type,
            icon: ENTITY_TYPE_CONFIG[type]?.icon || '📂',
            count: count as number
          }));
          console.log('📋 设置兼容格式实体类型:', types);
          setEntityTypes(types);
        }
      } else {
        console.warn('📋 获取实体类型失败:', response?.error);
      }
    } catch (error) {
      console.error('❌ 加载实体类型失败:', error);
      // 设置默认类型
      const defaultTypes = Object.entries(ENTITY_TYPE_CONFIG).map(([type, config]) => ({
        type,
        name: config.name,
        icon: config.icon,
        count: 0
      }));
      console.log('📋 使用默认实体类型:', defaultTypes);
      setEntityTypes(defaultTypes);
    }
  };

  // 按类型加载实体
  const loadEntitiesByType = async (entityType: string) => {
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ENTITIES_BY_TYPE',
        entityType,
        limit: 50
      });

      if (response && response.success) {
        setEntities(response.data || []);
      }
    } catch (error) {
      console.error('加载实体失败:', error);
      setEntities([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 执行搜索
  const performSearch = async (query: string) => {
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SEARCH_ENTITIES',
        query,
        entityType: selectedEntityType !== 'overview' && selectedEntityType !== 'timeline' 
          ? selectedEntityType : undefined,
        limit: 30
      });

      if (response && response.success) {
        setEntities(response.data || []);
      }
    } catch (error) {
      console.error('搜索实体失败:', error);
      setEntities([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 加载最近时间轴
  const loadRecentTimeline = async () => {
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_RECENT_TIMELINE',
        limit: 50
      });

      if (response && response.success) {
        setTimeline(response.data || []);
      }
    } catch (error) {
      console.error('加载时间轴失败:', error);
      setTimeline([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 选择实体类型
  const handleEntityTypeSelect = (type: string) => {
    setSelectedEntityType(type);
    setSelectedEntity(null);
    setSearchQuery('');
    
    if (type === 'overview') {
      setActiveView('overview');
    } else if (type === 'timeline') {
      setActiveView('timeline');
      loadRecentTimeline();
    } else {
      setActiveView('entity-detail');
      loadEntitiesByType(type);
    }
  };

  // 查看实体详情
  const handleEntityClick = async (entity: EntityItem) => {
    setSelectedEntity(entity);
    
    // 更新访问统计
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_ENTITY_ACCESS',
        entityId: entity.id
      });
    } catch (error) {
      console.error('更新实体访问失败:', error);
    }
  };

  // 执行搜索
  const handleSearch = () => {
    if (searchQuery.trim()) {
      performSearch(searchQuery.trim());
    }
  };

  // 处理搜索输入
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 调试功能
  const handleDiagnoseData = async () => {
    console.log('🔍 开始诊断数据状态...');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DIAGNOSE_ENTITY_DATA'
      });
      
      console.log('🔍 诊断结果:', response);
      if (response.success) {
        const diagnosis = response.data;
        alert(`诊断结果：
实体数量: ${diagnosis.entitiesCount}
关系数量: ${diagnosis.relationshipsCount}
实体类型: ${diagnosis.entityTypes.join(', ')}

问题: ${diagnosis.issues.join('; ')}
建议: ${diagnosis.suggestions.join('; ')}`);
      }
    } catch (error) {
      console.error('诊断失败:', error);
      alert('诊断失败: ' + error.message);
    }
  };

  const handleInitializeSampleData = async () => {
    if (!confirm('确定要初始化示例数据吗？这将创建一些测试实体和关系。')) {
      return;
    }
    
    console.log('🚀 开始初始化示例数据...');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'INITIALIZE_SAMPLE_DATA'
      });
      
      console.log('🚀 初始化结果:', response);
      if (response.success) {
        alert(response.data.message);
        // 刷新界面数据
        await initializeMemoryInterface();
      } else {
        alert('初始化失败: ' + (response.error || response.data?.message));
      }
    } catch (error) {
      console.error('初始化失败:', error);
      alert('初始化失败: ' + error.message);
    }
  };

  const handleRebuildIndexes = async () => {
    if (!confirm('确定要重建实体索引吗？')) {
      return;
    }
    
    console.log('🔄 开始重建索引...');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'REBUILD_ENTITY_INDEXES'
      });
      
      console.log('🔄 重建结果:', response);
      alert(response.message);
      if (response.success) {
        // 刷新界面数据
        await initializeMemoryInterface();
      }
    } catch (error) {
      console.error('重建失败:', error);
      alert('重建失败: ' + error.message);
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;
    return new Date(timestamp).toLocaleDateString();
  };

  // 标记为重点项目
  const handleMarkAsHighlightProject = async (entity: EntityItem) => {
    try {
      // 获取现有的重点项目列表
      const result = await chrome.storage.local.get('highlightProjects');
      const highlightProjects = result.highlightProjects || [];
      
      // 检查是否已经是重点项目
      const isAlreadyHighlighted = highlightProjects.some((p: any) => p.id === entity.id);
      
      if (isAlreadyHighlighted) {
        // 移除重点标记
        const updatedProjects = highlightProjects.filter((p: any) => p.id !== entity.id);
        await chrome.storage.local.set({ highlightProjects: updatedProjects });
        
        // 可以显示一个提示
        alert(`已将 "${entity.name}" 从重点项目中移除`);
      } else {
        // 添加为重点项目
        const projectInfo = {
          id: entity.id,
          name: entity.name,
          description: entity.description,
          addedAt: Date.now(),
          lastViewed: entity.lastAccessed,
          importance: entity.importance,
          tags: entity.tags || []
        };
        
        const updatedProjects = [...highlightProjects, projectInfo];
        await chrome.storage.local.set({ highlightProjects: updatedProjects });
        
        // 设置实体标签，标记为重点项目
        await chrome.runtime.sendMessage({
          type: 'SET_ENTITY_TAGS',
          entityId: entity.id,
          tags: [...(entity.tags || []), 'highlight-project']
        });
        
        alert(`已将 "${entity.name}" 标记为重点项目`);
      }
      
      // 刷新当前视图
      if (selectedEntityType === 'Project') {
        loadEntitiesByType('Project');
      }
      
    } catch (error) {
      console.error('标记重点项目失败:', error);
      alert('操作失败，请稍后重试');
    }
  };

  // 打开项目仪表盘
  const openProjectDashboard = async (entity: EntityItem) => {
    try {
      // 先确保项目在重点项目列表中
      const result = await chrome.storage.local.get('highlightProjects');
      const highlightProjects = result.highlightProjects || [];
      const isHighlighted = highlightProjects.some((p: any) => p.id === entity.id);
      
      if (!isHighlighted) {
        // 如果不在重点项目中，询问是否添加
        const shouldAdd = confirm(`"${entity.name}" 不在重点项目列表中，是否添加并打开仪表盘？`);
        if (shouldAdd) {
          await handleMarkAsHighlightProject(entity);
        }
      }
      
      // 打开项目仪表盘
      const dashboardUrl = chrome.runtime.getURL(`project-dashboard.html?projectId=${entity.id}&projectName=${encodeURIComponent(entity.name)}`);
      
      // 使用弹窗方式打开
      chrome.windows.create({
        url: dashboardUrl,
        type: 'popup',
        width: 1200,
        height: 900,
        focused: true
      });
      
    } catch (error) {
      console.error('打开项目仪表盘失败:', error);
      alert('打开仪表盘失败，请稍后重试');
    }
  };

  // 获取实体图标
  const getEntityIcon = (type: string) => {
    return ENTITY_TYPE_CONFIG[type]?.icon || '📂';
  };

  // 获取时间轴事件图标
  const getTimelineIcon = (type: string) => {
    const icons: Record<string, string> = {
      'message': '💬',
      'webpage': '🌐',
      'relation_created': '🔗',
      'entity_updated': '📝'
    };
    return icons[type] || '📅';
  };

  return (
    <div className="memory-container">
      {/* 左侧导航 */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo">🧠 记忆查询系统</div>
        </div>
        
        <div className="entity-types">
          <div 
            className={`entity-type ${selectedEntityType === 'overview' ? 'active' : ''}`}
            onClick={() => handleEntityTypeSelect('overview')}
          >
            <div className="entity-icon">🏠</div>
            <div className="entity-name">首页概览</div>
          </div>
          
          <div 
            className={`entity-type ${selectedEntityType === 'timeline' ? 'active' : ''}`}
            onClick={() => handleEntityTypeSelect('timeline')}
          >
            <div className="entity-icon">⏰</div>
            <div className="entity-name">时间轴</div>
          </div>
          
          <hr className="sidebar-divider" />
          
          {entityTypes.map((entityType) => (
            <div 
              key={entityType.type}
              className={`entity-type ${selectedEntityType === entityType.type ? 'active' : ''}`}
              onClick={() => handleEntityTypeSelect(entityType.type)}
            >
              <div className="entity-icon">{entityType.icon}</div>
              <div className="entity-name">{entityType.name}</div>
              <div className="entity-count">{entityType.count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="main-content">
        {/* 搜索头部 */}
        <div className="search-header">
          <div className="search-box">
            <div className="search-icon">🔍</div>
            <input 
              type="text" 
              className="search-input" 
              placeholder="搜索任何内容、实体或关键词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleSearchKeyPress}
            />
          </div>
          <div className="filter-btn" onClick={handleSearch}>
            📊 搜索
          </div>
          <div className="filter-btn" onClick={() => setSearchQuery('')}>
            🔄 重置
          </div>
          <div className="filter-btn debug-btn" onClick={handleDiagnoseData} title="诊断数据状态">
            🔍 诊断
          </div>
          <div className="filter-btn debug-btn" onClick={handleInitializeSampleData} title="初始化示例数据">
            🚀 示例数据
          </div>
          <div className="filter-btn debug-btn" onClick={handleRebuildIndexes} title="重建索引">
            🔄 重建索引
          </div>
        </div>

        {/* 首页概览 */}
        {activeView === 'overview' && (
          <div className="overview-section">
            <div className="greeting-card">
              <div className="greeting-title">
                <span>🌅</span>
                <span>欢迎来到记忆查询系统</span>
              </div>
              <div className="greeting-content">
                <p>您的个人知识图谱中包含:</p>
                <ul className="quick-summary">
                  <li>📊 {overviewStats?.totalEntities || 0} 个实体，{overviewStats?.totalRelationships || 0} 个关系</li>
                  <li>📈 今日新增 {overviewStats?.entitiesCreatedToday || 0} 个实体</li>
                  <li>📅 本周新增 {overviewStats?.entitiesCreatedThisWeek || 0} 个实体</li>
                  <li>📆 本月新增 {overviewStats?.entitiesCreatedThisMonth || 0} 个实体</li>
                </ul>
                <p>点击左侧类别开始探索您的记忆 👈</p>
              </div>
            </div>

            <div className="content-grid">
              {entityTypes.slice(0, 6).map((entityType) => (
                <div key={entityType.type} className="content-card" onClick={() => handleEntityTypeSelect(entityType.type)}>
                  <div className="card-header">
                    <div className="card-title">
                      <span>{entityType.icon}</span>
                      <span>{entityType.name}</span>
                    </div>
                    <div className="card-badge">{entityType.count} 个</div>
                  </div>
                  <div className="card-content">
                    最近活跃的{entityType.name}信息
                  </div>
                  <div className="info-list">
                    {overviewStats?.topEntitiesByType[entityType.type]?.slice(0, 3).map((entity) => (
                      <div key={entity.id} className="info-item">
                        <span>{getEntityIcon(entity.type)}</span>
                        <span>{entity.name}</span>
                        <span className="info-time">{formatTime(entity.lastAccessed || entity.updated || Date.now())}</span>
                      </div>
                    ))}
                  </div>
                  <div className="view-more-btn">
                    <span>查看全部{entityType.name}</span>
                    <span>→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 时间轴视图 */}
        {activeView === 'timeline' && (
          <div className="timeline-view">
            <h2>⏰ 最近活动时间轴</h2>
            
            {isLoading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <span>加载时间轴数据...</span>
              </div>
            ) : (
              <div className="timeline-container">
                {timeline.map((event, index) => (
                  <div key={event.id} className="timeline-item">
                    <div className="timeline-dot">{getTimelineIcon(event.type)}</div>
                    <div className="timeline-content">
                      <div className="timeline-time">{formatTime(event.timestamp)}</div>
                      <div className="content-card">
                        <div className="card-title">{event.title}</div>
                        <div className="card-content">{event.content}</div>
                        {event.source && (
                          <div className="event-source">来源: {event.source}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {timeline.length === 0 && (
                  <div className="empty-state">
                    <span>📭</span>
                    <p>暂无时间轴数据</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 实体详情视图 */}
        {activeView === 'entity-detail' && (
          <div className="entity-detail">
            <div className="entity-header">
              <div className="entity-avatar">{getEntityIcon(selectedEntityType)}</div>
              <div className="entity-info">
                <h2>{ENTITY_TYPE_CONFIG[selectedEntityType]?.name || selectedEntityType}</h2>
                <div className="entity-meta">
                  共 {entities.length} 个{ENTITY_TYPE_CONFIG[selectedEntityType]?.name || '实体'} 
                  {searchQuery && ` • 搜索: "${searchQuery}"`}
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <span>加载实体数据...</span>
              </div>
            ) : (
              <div className="entities-grid">
                {entities.map((entity) => (
                  <div 
                    key={entity.id} 
                    className="entity-card"
                    onClick={() => handleEntityClick(entity)}
                  >
                    <div className="entity-card-header">
                      <div className="entity-card-title">
                        <span>{getEntityIcon(entity.type)}</span>
                        <span>{entity.name}</span>
                      </div>
                      {entity.importance !== undefined && (
                        <div className="importance-indicator">
                          <div 
                            className="importance-bar" 
                            style={{ width: `${entity.importance * 100}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                    
                    {entity.description && (
                      <div className="entity-description">{entity.description}</div>
                    )}
                    
                    <div className="entity-stats">
                      <div className="stat-item">
                        <span>🔗</span>
                        <span>{entity.relationshipsCount || 0} 关系</span>
                      </div>
                      <div className="stat-item">
                        <span>💬</span>
                        <span>{entity.relatedMessagesCount || 0} 消息</span>
                      </div>
                      <div className="stat-item">
                        <span>🌐</span>
                        <span>{entity.relatedWebpagesCount || 0} 网页</span>
                      </div>
                      <div className="stat-item">
                        <span>👁️</span>
                        <span>{entity.accessCount || 0} 访问</span>
                      </div>
                    </div>
                    
                    {/* 项目特殊操作按钮 */}
                    {entity.type === 'Project' && (
                      <div className="project-actions">
                        <button 
                          className="project-action-btn highlight"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsHighlightProject(entity);
                          }}
                          title="标记为重点项目"
                        >
                          ⭐ 重点项目
                        </button>
                        <button 
                          className="project-action-btn dashboard"
                          onClick={(e) => {
                            e.stopPropagation();
                            openProjectDashboard(entity);
                          }}
                          title="打开项目仪表盘"
                        >
                          📊 仪表盘
                        </button>
                      </div>
                    )}
                    
                    {entity.tags && entity.tags.length > 0 && (
                      <div className="entity-tags">
                        {entity.tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="entity-tag">{tag}</span>
                        ))}
                        {entity.tags.length > 3 && (
                          <span className="entity-tag more-tags">+{entity.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                    
                    <div className="entity-footer">
                      <span className="last-accessed">
                        最后访问: {formatTime(entity.lastAccessed || Date.now())}
                      </span>
                      {entity.status && (
                        <span className={`status-indicator ${entity.status}`}>
                          {entity.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                
                {entities.length === 0 && !isLoading && (
                  <div className="empty-state">
                    <span>{getEntityIcon(selectedEntityType)}</span>
                    <p>暂无{ENTITY_TYPE_CONFIG[selectedEntityType]?.name || '实体'}数据</p>
                    {searchQuery && (
                      <p>尝试修改搜索条件或清空搜索框</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 样式 */}
      <style>{`
        .memory-container {
          display: flex;
          min-height: 100vh;
          font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%);
          color: #ffffff;
        }

        /* 左侧导航样式 */
        .sidebar {
          width: 280px;
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(20px);
          border-right: 1px solid rgba(148, 163, 184, 0.1);
          padding: 2rem 0;
        }

        .sidebar-header {
          padding: 0 2rem 2rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }

        .logo {
          font-size: 1.5rem;
          font-weight: 700;
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .entity-types {
          padding: 1.5rem 0;
        }

        .entity-type {
          display: flex;
          align-items: center;
          padding: 0.75rem 2rem;
          margin: 0.25rem 0;
          cursor: pointer;
          transition: all 0.3s ease;
          border-left: 3px solid transparent;
        }

        .entity-type:hover {
          background: rgba(59, 130, 246, 0.1);
          border-left-color: #60a5fa;
        }

        .entity-type.active {
          background: rgba(59, 130, 246, 0.2);
          border-left-color: #60a5fa;
        }

        .entity-icon {
          width: 1.5rem;
          height: 1.5rem;
          margin-right: 0.75rem;
          font-size: 1.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .entity-name {
          font-weight: 500;
          flex: 1;
        }

        .entity-count {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          padding: 0.25rem 0.5rem;
          border-radius: 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .sidebar-divider {
          margin: 1rem 0;
          border: none;
          border-top: 1px solid rgba(148, 163, 184, 0.1);
        }

        /* 主内容区样式 */
        .main-content {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
        }

        /* 搜索头部样式 */
        .search-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .search-box {
          flex: 1;
          position: relative;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 3rem;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 0.75rem;
          color: #ffffff;
          font-size: 1rem;
          transition: all 0.3s ease;
        }

        .search-input:focus {
          outline: none;
          border-color: #60a5fa;
          box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1);
        }

        .search-input::placeholder {
          color: #64748b;
        }

        .search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }

        .filter-btn {
          padding: 0.75rem 1.5rem;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 0.75rem;
          color: #60a5fa;
          cursor: pointer;
          transition: all 0.3s ease;
          white-space: nowrap;
        }

        .filter-btn:hover {
          background: rgba(59, 130, 246, 0.2);
        }

        .filter-btn.debug-btn {
          background: rgba(255, 165, 0, 0.1);
          border-color: rgba(255, 165, 0, 0.3);
          color: #ffb366;
          font-size: 0.75rem;
        }

        .filter-btn.debug-btn:hover {
          background: rgba(255, 165, 0, 0.2);
        }

        /* 概览部分样式 */
        .overview-section {
          animation: fadeInUp 0.6s ease-out;
        }

        .greeting-card {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1));
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 1rem;
          padding: 2rem;
          margin-bottom: 2rem;
          backdrop-filter: blur(10px);
        }

        .greeting-title {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .greeting-content {
          color: #cbd5e1;
          line-height: 1.6;
        }

        .quick-summary {
          list-style: none;
          margin: 1rem 0;
          padding: 0;
        }

        .quick-summary li {
          padding: 0.5rem 0;
          border-left: 3px solid #60a5fa;
          padding-left: 1rem;
          margin: 0.5rem 0;
        }

        /* 内容网格样式 */
        .content-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .content-card {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 1rem;
          padding: 1.5rem;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
          cursor: pointer;
        }

        .content-card:hover {
          transform: translateY(-2px);
          border-color: rgba(59, 130, 246, 0.3);
          box-shadow: 0 8px 32px rgba(59, 130, 246, 0.1);
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .card-title {
          font-size: 1.1rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .card-badge {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .card-content {
          color: #cbd5e1;
          line-height: 1.5;
          margin-bottom: 1rem;
        }

        .info-list {
          margin: 1rem 0;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
          transition: all 0.3s ease;
        }

        .info-item:hover {
          background: rgba(59, 130, 246, 0.05);
          border-radius: 0.5rem;
          padding-left: 0.5rem;
        }

        .info-item:last-child {
          border-bottom: none;
        }

        .info-time {
          color: #64748b;
          font-size: 0.875rem;
          margin-left: auto;
        }

        .view-more-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: #60a5fa;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .view-more-btn:hover {
          color: #93c5fd;
        }

        /* 时间轴样式 */
        .timeline-view {
          animation: fadeInUp 0.6s ease-out;
        }

        .timeline-view h2 {
          margin-bottom: 2rem;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .timeline-container {
          position: relative;
        }

        .timeline-item {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          position: relative;
        }

        .timeline-item:not(:last-child)::before {
          content: '';
          position: absolute;
          left: 1.25rem;
          top: 3rem;
          width: 2px;
          height: calc(100% + 1rem);
          background: linear-gradient(to bottom, #60a5fa, rgba(96, 165, 250, 0.3));
        }

        .timeline-dot {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          color: white;
          flex-shrink: 0;
          z-index: 1;
        }

        .timeline-content {
          flex: 1;
        }

        .timeline-time {
          color: #64748b;
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
        }

        .event-source {
          color: #94a3b8;
          font-size: 0.75rem;
          margin-top: 0.5rem;
        }

        /* 实体详情样式 */
        .entity-detail {
          animation: fadeInUp 0.6s ease-out;
        }

        .entity-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }

        .entity-avatar {
          width: 3rem;
          height: 3rem;
          border-radius: 50%;
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
        }

        .entity-info h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .entity-meta {
          color: #64748b;
          font-size: 0.875rem;
        }

        /* 实体网格样式 */
        .entities-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1rem;
        }

        .entity-card {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 0.75rem;
          padding: 1rem;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .entity-card:hover {
          border-color: rgba(59, 130, 246, 0.3);
          transform: translateY(-2px);
        }

        .entity-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .entity-card-title {
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .importance-indicator {
          width: 60px;
          height: 4px;
          background: rgba(148, 163, 184, 0.2);
          border-radius: 2px;
          overflow: hidden;
        }

        .importance-bar {
          height: 100%;
          background: linear-gradient(90deg, #60a5fa, #a78bfa);
          transition: width 0.3s ease;
        }

        .entity-description {
          color: #cbd5e1;
          font-size: 0.875rem;
          line-height: 1.5;
          margin-bottom: 0.75rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .entity-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .entity-tags {
          display: flex;
          gap: 0.25rem;
          flex-wrap: wrap;
          margin-bottom: 0.75rem;
        }

        .entity-tag {
          padding: 0.125rem 0.375rem;
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          border-radius: 0.25rem;
          font-size: 0.625rem;
        }

        .entity-tag.more-tags {
          background: rgba(148, 163, 184, 0.2);
          color: #94a3b8;
        }

        .entity-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          color: #64748b;
        }

        /* 项目操作按钮样式 */
        .project-actions {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .project-action-btn {
          padding: 0.375rem 0.75rem;
          border: none;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          flex: 1;
        }

        .project-action-btn.highlight {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: white;
        }

        .project-action-btn.highlight:hover {
          background: linear-gradient(135deg, #d97706, #b45309);
          transform: translateY(-1px);
        }

        .project-action-btn.dashboard {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
        }

        .project-action-btn.dashboard:hover {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          transform: translateY(-1px);
        }

        .last-accessed {
          color: #64748b;
        }

        .status-indicator {
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.625rem;
          font-weight: 500;
        }

        .status-indicator.active {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .status-indicator.inactive {
          background: rgba(148, 163, 184, 0.2);
          color: #94a3b8;
        }

        /* 加载和空状态样式 */
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          color: #94a3b8;
        }

        .loading-spinner {
          width: 2rem;
          height: 2rem;
          border: 2px solid rgba(96, 165, 250, 0.3);
          border-top: 2px solid #60a5fa;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          color: #94a3b8;
          text-align: center;
        }

        .empty-state span {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        /* 动画 */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* 响应式设计 */
        @media (max-width: 768px) {
          .memory-container {
            flex-direction: column;
          }

          .sidebar {
            width: 100%;
            height: auto;
            position: static;
          }

          .main-content {
            padding: 1rem;
          }

          .content-grid,
          .entities-grid {
            grid-template-columns: 1fr;
          }

          .search-header {
            flex-direction: column;
            gap: 0.5rem;
          }

          .search-box {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

// 渲染组件
ReactDOM.render(
  <React.StrictMode>
    <MemoryInterface />
  </React.StrictMode>,
  document.getElementById('memory-root')
);
