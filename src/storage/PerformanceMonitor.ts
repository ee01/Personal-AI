/**
 * 存储性能监控器
 * 监控各层存储的性能指标，提供预警和优化建议
 */

export interface PerformanceMetrics {
  // 存储层性能
  storage: {
    vectorStore: {
      insertLatency: number;     // 向量插入延迟
      queryLatency: number;      // 向量查询延迟
      cloudConnectivity: boolean; // 云端连接状态
      lastCheckTime: number;
    };
    graphStore: {
      entityOperationLatency: number;    // 实体操作延迟
      relationshipQueryLatency: number;  // 关系查询延迟
      localStorageUsage: number;         // 本地存储使用率
      lastCheckTime: number;
    };
  };
  
  // 业务层性能
  business: {
    messageProcessingLatency: number;   // 消息处理总延迟
    entityMergingLatency: number;       // 实体合并延迟
    memoryLifecycleLatency: number;     // 记忆管理延迟
    lastCheckTime: number;
  };
  
  // 用户体验性能
  userExperience: {
    queryResponseTime: number;          // 查询响应时间
    dashboardLoadTime: number;          // 仪表盘加载时间
    entityEditResponseTime: number;     // 实体编辑响应时间
    lastCheckTime: number;
  };
}

export interface PerformanceThresholds {
  storage: {
    vectorInsert: number;      // <500ms
    vectorQuery: number;       // <200ms
    entityOperation: number;   // <100ms
    relationshipQuery: number; // <50ms
  };
  business: {
    messageProcessing: number; // <2s
    entityMerging: number;     // <1s
    memoryLifecycle: number;   // <3s
  };
  userExperience: {
    queryResponse: number;     // <1s
    dashboardLoad: number;     // <2s
    entityEdit: number;        // <300ms
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'info' | 'warning' | 'error';
  category: 'storage' | 'business' | 'userExperience';
  metric: string;
  currentValue: number;
  threshold: number;
  message: string;
  suggestions: string[];
  timestamp: number;
}

export interface PerformanceReport {
  overall: 'healthy' | 'warning' | 'critical';
  metrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
  trends: {
    metric: string;
    trend: 'improving' | 'stable' | 'degrading';
    changePercent: number;
  }[];
  recommendations: string[];
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private thresholds: PerformanceThresholds;
  private alerts: PerformanceAlert[] = [];
  private metricsHistory: Map<string, number[]> = new Map();
  private operationTimes: Map<string, number> = new Map();
  
  constructor() {
    this.initializeThresholds();
    this.initializeMetrics();
    this.startPeriodicChecks();
  }

  /**
   * 初始化性能阈值
   */
  private initializeThresholds(): void {
    this.thresholds = {
      storage: {
        vectorInsert: 500,    // 500ms
        vectorQuery: 200,     // 200ms
        entityOperation: 100, // 100ms
        relationshipQuery: 50 // 50ms
      },
      business: {
        messageProcessing: 2000, // 2s
        entityMerging: 1000,     // 1s
        memoryLifecycle: 3000    // 3s
      },
      userExperience: {
        queryResponse: 1000,    // 1s
        dashboardLoad: 2000,    // 2s
        entityEdit: 300         // 300ms
      }
    };
  }

  /**
   * 初始化性能指标
   */
  private initializeMetrics(): void {
    const now = Date.now();
    this.metrics = {
      storage: {
        vectorStore: {
          insertLatency: 0,
          queryLatency: 0,
          cloudConnectivity: true,
          lastCheckTime: now
        },
        graphStore: {
          entityOperationLatency: 0,
          relationshipQueryLatency: 0,
          localStorageUsage: 0,
          lastCheckTime: now
        }
      },
      business: {
        messageProcessingLatency: 0,
        entityMergingLatency: 0,
        memoryLifecycleLatency: 0,
        lastCheckTime: now
      },
      userExperience: {
        queryResponseTime: 0,
        dashboardLoadTime: 0,
        entityEditResponseTime: 0,
        lastCheckTime: now
      }
    };
  }

  /**
   * 记录操作开始时间
   */
  startTiming(operationId: string): void {
    this.operationTimes.set(operationId, Date.now());
  }

  /**
   * 记录操作完成并更新指标
   */
  recordOperation(category: 'storage' | 'business' | 'userExperience', operationType: string, operationId?: string): number {
    const now = Date.now();
    let duration = 0;

    if (operationId && this.operationTimes.has(operationId)) {
      duration = now - this.operationTimes.get(operationId)!;
      this.operationTimes.delete(operationId);
    }

    // 更新相应的指标
    this.updateMetric(category, operationType, duration);
    
    // 检查是否超过阈值
    this.checkThreshold(category, operationType, duration);
    
    return duration;
  }

  /**
   * 直接记录性能数据
   */
  recordPerformance(category: 'storage' | 'business' | 'userExperience', operationType: string, value: number): void {
    this.updateMetric(category, operationType, value);
    this.checkThreshold(category, operationType, value);
  }

  /**
   * 记录错误
   */
  recordError(category: 'storage' | 'business' | 'userExperience', error: Error): void {
    const alert: PerformanceAlert = {
      id: `error_${Date.now()}`,
      type: 'error',
      category,
      metric: 'error_rate',
      currentValue: 1,
      threshold: 0,
      message: `${category}发生错误: ${error.message}`,
      suggestions: ['检查网络连接', '查看详细错误日志', '考虑重试机制'],
      timestamp: Date.now()
    };

    this.alerts.unshift(alert);
    
    // 保持告警列表在合理大小
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(0, 50);
    }

    console.warn(`⚠️ 性能监控发现错误:`, alert);
  }

  /**
   * 更新指标
   */
  private updateMetric(category: 'storage' | 'business' | 'userExperience', operationType: string, value: number): void {
    const now = Date.now();

    switch (category) {
      case 'storage':
        if (operationType === 'vector_insert') {
          this.metrics.storage.vectorStore.insertLatency = value;
          this.metrics.storage.vectorStore.lastCheckTime = now;
        } else if (operationType === 'vector_query') {
          this.metrics.storage.vectorStore.queryLatency = value;
          this.metrics.storage.vectorStore.lastCheckTime = now;
        } else if (operationType === 'entity_operation') {
          this.metrics.storage.graphStore.entityOperationLatency = value;
          this.metrics.storage.graphStore.lastCheckTime = now;
        } else if (operationType === 'relationship_query') {
          this.metrics.storage.graphStore.relationshipQueryLatency = value;
          this.metrics.storage.graphStore.lastCheckTime = now;
        }
        break;

      case 'business':
        if (operationType === 'message_processing') {
          this.metrics.business.messageProcessingLatency = value;
        } else if (operationType === 'entity_merging') {
          this.metrics.business.entityMergingLatency = value;
        } else if (operationType === 'memory_lifecycle') {
          this.metrics.business.memoryLifecycleLatency = value;
        }
        this.metrics.business.lastCheckTime = now;
        break;

      case 'userExperience':
        if (operationType === 'query_response') {
          this.metrics.userExperience.queryResponseTime = value;
        } else if (operationType === 'dashboard_load') {
          this.metrics.userExperience.dashboardLoadTime = value;
        } else if (operationType === 'entity_edit') {
          this.metrics.userExperience.entityEditResponseTime = value;
        }
        this.metrics.userExperience.lastCheckTime = now;
        break;
    }

    // 记录历史数据用于趋势分析
    const metricKey = `${category}_${operationType}`;
    if (!this.metricsHistory.has(metricKey)) {
      this.metricsHistory.set(metricKey, []);
    }
    
    const history = this.metricsHistory.get(metricKey)!;
    history.push(value);
    
    // 保持历史数据在合理大小（最近100个数据点）
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * 检查阈值并生成告警
   */
  private checkThreshold(category: 'storage' | 'business' | 'userExperience', operationType: string, value: number): void {
    let threshold = 0;
    let metricName = '';

    // 获取相应的阈值
    switch (category) {
      case 'storage':
        switch (operationType) {
          case 'vector_insert':
            threshold = this.thresholds.storage.vectorInsert;
            metricName = '向量插入延迟';
            break;
          case 'vector_query':
            threshold = this.thresholds.storage.vectorQuery;
            metricName = '向量查询延迟';
            break;
          case 'entity_operation':
            threshold = this.thresholds.storage.entityOperation;
            metricName = '实体操作延迟';
            break;
          case 'relationship_query':
            threshold = this.thresholds.storage.relationshipQuery;
            metricName = '关系查询延迟';
            break;
        }
        break;

      case 'business':
        switch (operationType) {
          case 'message_processing':
            threshold = this.thresholds.business.messageProcessing;
            metricName = '消息处理延迟';
            break;
          case 'entity_merging':
            threshold = this.thresholds.business.entityMerging;
            metricName = '实体合并延迟';
            break;
          case 'memory_lifecycle':
            threshold = this.thresholds.business.memoryLifecycle;
            metricName = '记忆管理延迟';
            break;
        }
        break;

      case 'userExperience':
        switch (operationType) {
          case 'query_response':
            threshold = this.thresholds.userExperience.queryResponse;
            metricName = '查询响应时间';
            break;
          case 'dashboard_load':
            threshold = this.thresholds.userExperience.dashboardLoad;
            metricName = '仪表盘加载时间';
            break;
          case 'entity_edit':
            threshold = this.thresholds.userExperience.entityEdit;
            metricName = '实体编辑响应时间';
            break;
        }
        break;
    }

    if (threshold > 0 && value > threshold) {
      const alert: PerformanceAlert = {
        id: `threshold_${Date.now()}`,
        type: value > threshold * 2 ? 'error' : 'warning',
        category,
        metric: operationType,
        currentValue: value,
        threshold,
        message: `${metricName}超过阈值: ${value}ms > ${threshold}ms`,
        suggestions: this.getSuggestions(category, operationType),
        timestamp: Date.now()
      };

      this.alerts.unshift(alert);
      
      if (this.alerts.length > 50) {
        this.alerts = this.alerts.slice(0, 50);
      }

      console.warn(`🚨 性能告警:`, alert);
    }
  }

  /**
   * 获取优化建议
   */
  private getSuggestions(category: string, operationType: string): string[] {
    const suggestions: Record<string, string[]> = {
      'storage_vector_insert': [
        '检查网络连接到ChromaDB',
        '考虑批量插入以提高效率',
        '优化向量维度以减少数据大小'
      ],
      'storage_vector_query': [
        '优化查询条件和过滤器',
        '考虑增加本地缓存',
        '检查向量索引是否需要重建'
      ],
      'storage_entity_operation': [
        '检查Chrome Storage的使用情况',
        '考虑清理过期的实体数据',
        '优化实体数据结构'
      ],
      'business_message_processing': [
        '检查LLM API的响应时间',
        '考虑使用本地模型进行预处理',
        '优化实体提取算法'
      ],
      'userExperience_query_response': [
        '优化搜索算法',
        '增加结果缓存',
        '考虑分页加载结果'
      ]
    };

    const key = `${category}_${operationType}`;
    return suggestions[key] || ['检查系统资源使用情况', '考虑重启相关服务'];
  }

  /**
   * 获取性能报告
   */
  getReport(): PerformanceReport {
    const trends = this.calculateTrends();
    const overall = this.calculateOverallHealth();

    return {
      overall,
      metrics: this.metrics,
      alerts: this.alerts.slice(0, 10), // 最近10个告警
      trends,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * 计算趋势
   */
  private calculateTrends(): { metric: string; trend: 'improving' | 'stable' | 'degrading'; changePercent: number; }[] {
    const trends: { metric: string; trend: 'improving' | 'stable' | 'degrading'; changePercent: number; }[] = [];

    for (const [metricKey, history] of this.metricsHistory.entries()) {
      if (history.length < 10) continue; // 需要足够的历史数据

      const recent = history.slice(-5); // 最近5个数据点
      const previous = history.slice(-10, -5); // 之前5个数据点

      const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
      const previousAvg = previous.reduce((sum, val) => sum + val, 0) / previous.length;

      if (previousAvg === 0) continue;

      const changePercent = ((recentAvg - previousAvg) / previousAvg) * 100;
      let trend: 'improving' | 'stable' | 'degrading';

      if (Math.abs(changePercent) < 5) {
        trend = 'stable';
      } else if (changePercent < 0) {
        trend = 'improving'; // 延迟减少是改善
      } else {
        trend = 'degrading';
      }

      trends.push({
        metric: metricKey,
        trend,
        changePercent: Math.abs(changePercent)
      });
    }

    return trends;
  }

  /**
   * 计算整体健康状态
   */
  private calculateOverallHealth(): 'healthy' | 'warning' | 'critical' {
    const recentAlerts = this.alerts.filter(a => Date.now() - a.timestamp < 30 * 60 * 1000); // 最近30分钟
    const errorAlerts = recentAlerts.filter(a => a.type === 'error');
    const warningAlerts = recentAlerts.filter(a => a.type === 'warning');

    if (errorAlerts.length > 0) {
      return 'critical';
    } else if (warningAlerts.length > 3) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const recentAlerts = this.alerts.filter(a => Date.now() - a.timestamp < 60 * 60 * 1000); // 最近1小时
    
    if (recentAlerts.length === 0) {
      recommendations.push('系统运行良好，继续保持！');
      return recommendations;
    }

    // 分析告警类型并给出建议
    const alertsByCategory = new Map<string, number>();
    for (const alert of recentAlerts) {
      const count = alertsByCategory.get(alert.category) || 0;
      alertsByCategory.set(alert.category, count + 1);
    }

    if (alertsByCategory.get('storage') || 0 > 2) {
      recommendations.push('存储层性能问题较多，建议检查网络连接和存储配置');
    }

    if (alertsByCategory.get('business') || 0 > 2) {
      recommendations.push('业务逻辑处理缓慢，建议优化算法和API调用');
    }

    if (alertsByCategory.get('userExperience') || 0 > 2) {
      recommendations.push('用户体验指标不佳，建议优化界面响应和数据加载');
    }

    return recommendations;
  }

  /**
   * 启动定期检查
   */
  private startPeriodicChecks(): void {
    // 每分钟检查一次连接状态
    setInterval(() => {
      this.checkConnectivity();
    }, 60 * 1000);

    // 每5分钟清理过期告警
    setInterval(() => {
      this.cleanupExpiredAlerts();
    }, 5 * 60 * 1000);
  }

  /**
   * 检查连接状态
   */
  private async checkConnectivity(): Promise<void> {
    try {
      // 检查ChromaDB连接（简单的fetch测试）
      const chromaConnected = await this.testChromaConnection();
      this.metrics.storage.vectorStore.cloudConnectivity = chromaConnected;
      
      if (!chromaConnected) {
        this.recordError('storage', new Error('ChromaDB连接失败'));
      }
    } catch (error) {
      console.error('连接检查失败:', error);
    }
  }

  /**
   * 测试Chroma连接
   */
  private async testChromaConnection(): Promise<boolean> {
    try {
      // 这里应该实际测试ChromaDB连接
      // 暂时返回true
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 清理过期告警
   */
  private cleanupExpiredAlerts(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.alerts = this.alerts.filter(alert => alert.timestamp > oneHourAgo);
  }

  /**
   * 获取当前指标
   */
  getCurrentMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取最近的告警
   */
  getRecentAlerts(count: number = 10): PerformanceAlert[] {
    return this.alerts.slice(0, count);
  }

  /**
   * 调整阈值
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('🔧 性能阈值已更新:', this.thresholds);
  }
}

export default PerformanceMonitor;
