/**
 * 实体数据初始化和诊断工具
 * 用于解决记忆查询界面显示0个实体的问题
 */

import HybridGraphStore, { GraphEntity } from './HybridGraphStore';

/**
 * 实体数据初始化器
 */
export class EntityDataInitializer {
  private hybridGraphStore: HybridGraphStore;

  constructor(hybridGraphStore: HybridGraphStore) {
    this.hybridGraphStore = hybridGraphStore;
  }

  /**
   * 诊断当前数据状态
   */
  async diagnoseDataState(): Promise<{
    hasLocalData: boolean;
    hasCloudData: boolean;
    entitiesCount: number;
    relationshipsCount: number;
    entityTypes: string[];
    issues: string[];
    suggestions: string[];
  }> {
    console.log('🔍 开始诊断实体数据状态...');
    
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    try {
      // 获取统计信息
      const stats = await this.hybridGraphStore.getEntityStatistics();
      const syncStats = await this.hybridGraphStore.getSyncStatistics();
      
      console.log('📊 数据统计:', {
        totalEntities: stats.totalEntities,
        totalRelationships: stats.totalRelationships,
        entityTypes: Object.keys(stats.entityCounts),
        localStats: syncStats
      });

      // 检查问题
      if (stats.totalEntities === 0) {
        issues.push('没有找到任何实体数据');
        
        if (stats.totalRelationships > 0) {
          issues.push('存在关系数据但没有实体数据，可能是数据同步问题');
          suggestions.push('尝试从消息数据重建关系表');
        } else {
          issues.push('既没有实体数据也没有关系数据');
          suggestions.push('可能需要初始化示例数据或检查消息处理流程');
        }
      }

      if (!syncStats.isInitialized) {
        issues.push('HybridGraphStore未正确初始化');
        suggestions.push('重新初始化图存储系统');
      }

      if (syncStats.localEntityTypes === 0) {
        issues.push('没有实体类型索引');
        suggestions.push('重建实体类型索引');
      }

      return {
        hasLocalData: stats.totalEntities > 0,
        hasCloudData: syncStats.isInitialized,
        entitiesCount: stats.totalEntities,
        relationshipsCount: stats.totalRelationships,
        entityTypes: Object.keys(stats.entityCounts),
        issues,
        suggestions
      };

    } catch (error) {
      console.error('❌ 诊断数据状态失败:', error);
      issues.push(`诊断失败: ${error.message}`);
      suggestions.push('检查HybridGraphStore初始化状态');
      
      return {
        hasLocalData: false,
        hasCloudData: false,
        entitiesCount: 0,
        relationshipsCount: 0,
        entityTypes: [],
        issues,
        suggestions
      };
    }
  }

  /**
   * 初始化示例数据（用于测试和演示）
   */
  async initializeSampleData(): Promise<{
    success: boolean;
    entitiesCreated: number;
    relationshipsCreated: number;
    message: string;
  }> {
    console.log('🚀 开始初始化示例数据...');
    
    try {
      const sampleEntities: Omit<GraphEntity, 'id' | 'created' | 'updated'>[] = [
        {
          type: 'Person',
          name: '张三',
          description: '项目经理，负责AI助手项目的整体规划和协调',
          properties: {
            role: '项目经理',
            department: '产品部',
            email: 'zhangsan@company.com',
            skills: ['项目管理', '产品规划', '团队协调']
          },
          importance: 0.9,
          tags: ['核心成员', '项目负责人'],
          status: 'active'
        },
        {
          type: 'Person', 
          name: '李四',
          description: '前端开发工程师，负责用户界面的开发',
          properties: {
            role: '前端开发工程师',
            department: '技术部',
            email: 'lisi@company.com',
            skills: ['React', 'TypeScript', 'UI/UX']
          },
          importance: 0.8,
          tags: ['开发团队', '前端专家'],
          status: 'active'
        },
        {
          type: 'Person',
          name: '王五',
          description: '后端开发工程师，负责API和数据库设计',
          properties: {
            role: '后端开发工程师',
            department: '技术部',
            email: 'wangwu@company.com',
            skills: ['Node.js', '数据库设计', 'API开发']
          },
          importance: 0.8,
          tags: ['开发团队', '后端专家'],
          status: 'active'
        },
        {
          type: 'Project',
          name: 'Personal AI助手',
          description: '基于ChromaDB和LLM的个人AI助手项目，提供智能消息分析和知识管理功能',
          properties: {
            status: '开发中',
            priority: 'high',
            deadline: '2024-06-30',
            budget: '500000',
            phase: 'MVP开发'
          },
          importance: 1.0,
          tags: ['重点项目', 'AI', '知识管理'],
          status: 'active'
        },
        {
          type: 'Project',
          name: '记忆查询系统',
          description: '实体记忆查询界面，提供直观的知识图谱查询和管理功能',
          properties: {
            status: '开发中',
            priority: 'high',
            parentProject: 'Personal AI助手',
            phase: '界面开发'
          },
          importance: 0.9,
          tags: ['子项目', '用户界面', '知识图谱'],
          status: 'active'
        },
        {
          type: 'Task',
          name: '修复实体数据显示问题',
          description: '解决记忆查询界面显示0个实体的问题',
          properties: {
            status: '进行中',
            assignee: '李四',
            priority: 'high',
            estimatedHours: 8,
            project: '记忆查询系统'
          },
          importance: 0.8,
          tags: ['bug修复', '紧急'],
          status: 'active'
        },
        {
          type: 'Technology',
          name: 'ChromaDB',
          description: '开源向量数据库，用于存储和查询嵌入向量',
          properties: {
            category: '向量数据库',
            version: '0.4.x',
            usedIn: ['Personal AI助手'],
            documentation: 'https://docs.trychroma.com/'
          },
          importance: 0.7,
          tags: ['向量数据库', '核心技术'],
          status: 'active'
        },
        {
          type: 'Technology',
          name: 'React + TypeScript',
          description: '前端技术栈，用于构建用户界面',
          properties: {
            category: '前端框架',
            version: 'React 18 + TS 5',
            usedIn: ['记忆查询系统', '项目仪表盘'],
            documentation: 'https://react.dev/'
          },
          importance: 0.7,
          tags: ['前端技术', '核心技术'],
          status: 'active'
        },
        {
          type: 'Organization',
          name: '产品开发部',
          description: '负责产品规划、设计和开发的核心部门',
          properties: {
            type: '内部部门',
            headCount: 15,
            location: '北京',
            established: '2020-01-01'
          },
          importance: 0.6,
          tags: ['内部组织', '核心部门'],
          status: 'active'
        },
        {
          type: 'Topic',
          name: '知识图谱',
          description: '用图结构表示实体及其关系的知识表示方法',
          properties: {
            category: '技术概念',
            relatedProjects: ['Personal AI助手', '记忆查询系统'],
            keywords: ['实体', '关系', '图数据库', '语义网络']
          },
          importance: 0.8,
          tags: ['核心概念', '技术领域'],
          status: 'active'
        }
      ];

      let entitiesCreated = 0;
      let relationshipsCreated = 0;
      const createdEntityIds: { [key: string]: string } = {};

      // 创建实体
      for (const entityData of sampleEntities) {
        const entity = await this.hybridGraphStore.upsertEntity(entityData);
        if (entity) {
          entitiesCreated++;
          createdEntityIds[entity.name] = entity.id;
          console.log(`✅ 创建实体: ${entity.type} - ${entity.name}`);
        }
      }

      // 创建关系
      const sampleRelationships = [
        {
          type: 'WORKS_ON',
          fromId: createdEntityIds['张三'],
          toId: createdEntityIds['Personal AI助手'],
          properties: { role: '项目负责人', startDate: '2024-01-01' },
          strength: 0.9
        },
        {
          type: 'WORKS_ON',
          fromId: createdEntityIds['李四'],
          toId: createdEntityIds['记忆查询系统'],
          properties: { role: '前端开发', startDate: '2024-03-01' },
          strength: 0.8
        },
        {
          type: 'WORKS_ON',
          fromId: createdEntityIds['王五'],
          toId: createdEntityIds['Personal AI助手'],
          properties: { role: '后端开发', startDate: '2024-01-15' },
          strength: 0.8
        },
        {
          type: 'ASSIGNED_TO',
          fromId: createdEntityIds['修复实体数据显示问题'],
          toId: createdEntityIds['李四'],
          properties: { assignedDate: Date.now(), priority: 'high' },
          strength: 0.9
        },
        {
          type: 'BELONGS_TO',
          fromId: createdEntityIds['记忆查询系统'],
          toId: createdEntityIds['Personal AI助手'],
          properties: { relationship: '子项目' },
          strength: 0.8
        },
        {
          type: 'BELONGS_TO',
          fromId: createdEntityIds['修复实体数据显示问题'],
          toId: createdEntityIds['记忆查询系统'],
          properties: { relationship: '项目任务' },
          strength: 0.7
        },
        {
          type: 'USES_TECHNOLOGY',
          fromId: createdEntityIds['Personal AI助手'],
          toId: createdEntityIds['ChromaDB'],
          properties: { purpose: '向量存储', importance: 'critical' },
          strength: 0.9
        },
        {
          type: 'USES_TECHNOLOGY',
          fromId: createdEntityIds['记忆查询系统'],
          toId: createdEntityIds['React + TypeScript'],
          properties: { purpose: '前端开发', importance: 'critical' },
          strength: 0.9
        },
        {
          type: 'COLLABORATES_WITH',
          fromId: createdEntityIds['李四'],
          toId: createdEntityIds['王五'],
          properties: { context: '前后端协作', frequency: 'daily' },
          strength: 0.7
        },
        {
          type: 'MEMBER_OF',
          fromId: createdEntityIds['张三'],
          toId: createdEntityIds['产品开发部'],
          properties: { role: '部门负责人', joinDate: '2020-01-01' },
          strength: 0.8
        },
        {
          type: 'MEMBER_OF',
          fromId: createdEntityIds['李四'],
          toId: createdEntityIds['产品开发部'],
          properties: { role: '高级开发工程师', joinDate: '2022-03-01' },
          strength: 0.7
        },
        {
          type: 'RELATED_TO',
          fromId: createdEntityIds['Personal AI助手'],
          toId: createdEntityIds['知识图谱'],
          properties: { relationship: '核心技术应用', relevance: 'high' },
          strength: 0.8
        }
      ];

      for (const relationshipData of sampleRelationships) {
        if (relationshipData.fromId && relationshipData.toId) {
          const relationship = await this.hybridGraphStore.createRelationship(relationshipData);
          if (relationship) {
            relationshipsCreated++;
            console.log(`🔗 创建关系: ${relationship.type}`);
          }
        }
      }

      const message = `✅ 示例数据初始化完成: ${entitiesCreated}个实体, ${relationshipsCreated}个关系`;
      console.log(message);

      return {
        success: true,
        entitiesCreated,
        relationshipsCreated,
        message
      };

    } catch (error) {
      const errorMessage = `❌ 示例数据初始化失败: ${error.message}`;
      console.error(errorMessage, error);
      return {
        success: false,
        entitiesCreated: 0,
        relationshipsCreated: 0,
        message: errorMessage
      };
    }
  }

  /**
   * 重建索引
   */
  async rebuildIndexes(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔄 开始重建实体索引...');
      
      // 这里可以调用HybridGraphStore的重建方法
      // 当前简化实现：重新初始化
      await this.hybridGraphStore.initialize();
      
      console.log('✅ 实体索引重建完成');
      return {
        success: true,
        message: '实体索引重建完成'
      };
    } catch (error) {
      const errorMessage = `❌ 重建索引失败: ${error.message}`;
      console.error(errorMessage, error);
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * 清空所有数据（慎用）
   */
  async clearAllData(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🗑️ 开始清空所有数据...');
      
      // 清空本地存储
      await chrome.storage.local.remove([
        'entityIndex',
        'typeToEntities', 
        'graphRelationships',
        'graphIndexes',
        'entities'
      ]);
      
      // 重置内存状态
      this.hybridGraphStore.destroy();
      await this.hybridGraphStore.initialize();
      
      console.log('✅ 所有数据已清空');
      return {
        success: true,
        message: '所有数据已清空，可以重新初始化'
      };
    } catch (error) {
      const errorMessage = `❌ 清空数据失败: ${error.message}`;
      console.error(errorMessage, error);
      return {
        success: false,
        message: errorMessage
      };
    }
  }
}

export default EntityDataInitializer;
