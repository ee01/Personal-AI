/**
 * 用户画像演示和测试
 * 展示新的分散式向量存储功能
 */

import { CloudStorage } from '../storage/CloudStorage';
import { UserProfileManager } from './UserProfileManager';
import { UserProfileQueryService } from './UserProfileQueryService';
import { UserProfile, UserInterestItem } from '../types/userProfile';

export class UserProfileDemo {
  private cloudStorage: CloudStorage;
  private queryService: UserProfileQueryService;

  constructor() {
    this.cloudStorage = new CloudStorage();
    this.queryService = new UserProfileQueryService(this.cloudStorage);
  }

  /**
   * 运行完整的演示
   */
  async runFullDemo(): Promise<void> {
    console.log('🚀 开始用户画像演示...\n');

    try {
      // 1. 初始化
      await this.initializeDemo();

      // 2. 创建演示数据
      await this.createDemoData();

      // 3. 演示查询场景
      await this.demonstrateQueryScenarios();

      // 4. 演示维护功能
      await this.demonstrateMaintenanceFeatures();

      console.log('\n✅ 用户画像演示完成！');
    } catch (error) {
      console.error('❌ 演示过程中出现错误:', error);
    }
  }

  /**
   * 初始化演示环境
   */
  private async initializeDemo(): Promise<void> {
    console.log('📋 初始化演示环境...');
    
    // 检查CloudStorage连接
    const isConnected = await this.cloudStorage.isConnected();
    if (!isConnected) {
      console.log('⚠️ CloudStorage未连接，尝试初始化...');
      const initialized = await this.cloudStorage.initialize();
      if (!initialized) {
        throw new Error('CloudStorage初始化失败');
      }
    }

    console.log('✅ CloudStorage连接成功');
    
    // 获取存储统计
    const stats = await this.cloudStorage.getVectorStorageStats();
    console.log('📊 当前向量存储统计:', {
      总记录数: stats.total_records,
      用户数: Object.keys(stats.records_by_user).length,
      记录类型: Object.keys(stats.records_by_type),
      健康度: stats.health_score.toFixed(2)
    });
  }

  /**
   * 创建演示数据
   */
  private async createDemoData(): Promise<void> {
    console.log('\n📝 创建演示数据...');

    // 创建几个示例用户画像
    const demoUsers = [
      this.createDemoUser('user001', 'React开发者', ['React', 'TypeScript', 'Node.js']),
      this.createDemoUser('user002', 'Python工程师', ['Python', 'Django', 'Machine Learning']),
      this.createDemoUser('user003', '全栈开发者', ['React', 'Python', 'Docker']),
      this.createDemoUser('user004', '八卦达人', ['社交', '团队文化', '非正式交流'])
    ];

    // 直接使用新接口存储
    let totalRecords = 0;
    for (const userProfile of demoUsers) {
      const manager = new UserProfileManager(userProfile.userId, this.cloudStorage);
      await manager.initialize();
      
      try {
        // 逐个添加兴趣项 - 从 interests 对象中提取
        const allInterests = [
          ...(userProfile.interests?.projects || []),
          ...(userProfile.interests?.people || []),
          ...(userProfile.interests?.topics || []),
          ...(userProfile.interests?.technologies || []),
          ...(userProfile.interests?.documents || []),
          ...(userProfile.interests?.jiraTickets || [])
        ];
        
        for (const item of allInterests) {
          await manager.updateInterestItem({
            userId: userProfile.userId,
            targetItem: {
              id: item.id,
              type: item.type,
              name: item.name,
              metadata: item.metadata || {}
            },
            action: {
              actionType: 'view' as const, // 默认操作
              timestamp: Date.now(),
              weight: 0.1,
              context: 'demo data creation'
            }
          });
          totalRecords++;
        }
        
        console.log(`✅ 用户 ${userProfile.userId} 的画像已向量化`);
      } catch (error) {
        console.log(`❌ 用户 ${userProfile.userId} 的画像向量化失败:`, error);
      }
    }

    console.log(`📊 总共创建了 ${totalRecords} 条向量化记录`);
  }

  /**
   * 演示查询场景
   */
  private async demonstrateQueryScenarios(): Promise<void> {
    console.log('\n🔍 演示查询场景...\n');

    // 场景1：找到兴趣偏好最相似的用户
    console.log('📌 场景1：找到与user001兴趣最相似的用户');
    const similarUsers = await this.queryService.findUsersWithSimilarInterests('user001', {
      limit: 3,
      includeReasons: true
    });
    
    console.log('🎯 相似用户结果:');
    similarUsers.forEach(user => {
      console.log(`  - ${user.user_id}: 相似度 ${(user.similarity_score * 100).toFixed(1)}%`);
      console.log(`    匹配维度: ${user.matching_categories.map(c => c.category).join(', ')}`);
      if (user.matching_categories[0]?.matching_items.length > 0) {
        console.log(`    共同兴趣: ${user.matching_categories[0].matching_items.slice(0, 3).join(', ')}`);
      }
    });

    // 场景2：找到最喜欢聊八卦的人
    console.log('\n📌 场景2：找到最喜欢聊八卦的人');
    const gossipLovers = await this.queryService.findGossipLovers('user001', { limit: 2 });
    
    console.log('🗣️ 八卦爱好者结果:');
    gossipLovers.forEach(user => {
      console.log(`  - ${user.user_id}: 八卦倾向 ${(user.similarity_score * 100).toFixed(1)}%`);
      console.log(`    匹配维度数: ${(user as any).matching_dimensions || 1}`);
    });

    // 场景3：找到与特定话题相关的高频兴趣项
    console.log('\n📌 场景3：查找与"前端开发"相关的用户高频兴趣');
    const topicInterests = await this.queryService.findTopicRelatedHighFrequencyInterests(
      'user001', 
      '前端开发', 
      { limit: 3 }
    );
    
    console.log('🎯 话题相关兴趣:');
    topicInterests.forEach(interest => {
      console.log(`  - ${interest.metadata.name}: 相关度 ${(interest.relevance_score * 100).toFixed(1)}%, 频率分数 ${(interest.frequency_score * 100).toFixed(1)}%`);
    });

    // 场景4：用户兼容性分析
    console.log('\n📌 场景4：分析user001与user003的协作兼容性');
    const compatibility = await this.queryService.analyzeUserCompatibility('user001', ['user003']);
    
    if (compatibility.length > 0) {
      const result = compatibility[0];
      console.log('🤝 兼容性分析:');
      console.log(`  - 兼容性分数: ${(result.compatibility_score * 100).toFixed(1)}%`);
      console.log(`  - 协作潜力: ${result.collaboration_potential}`);
      console.log(`  - 推荐交互类型: ${result.recommended_interaction_type.join(', ')}`);
      
      result.compatibility_reasons.forEach(reason => {
        console.log(`    ${reason.category}: ${(reason.score * 100).toFixed(1)}%`);
        if (reason.shared_items.length > 0) {
          console.log(`      共同点: ${reason.shared_items.slice(0, 3).join(', ')}`);
        }
      });
    }

    // 场景5：发现趋势兴趣
    console.log('\n📌 场景5：发现当前趋势兴趣');
    const trendingInterests = await this.queryService.discoverTrendingInterests({
      timeWindow: 30,
      minUsers: 2,
      limit: 3
    });
    
    console.log('📈 趋势兴趣:');
    trendingInterests.forEach(trend => {
      console.log(`  - ${trend.interest_name} (${trend.interest_category})`);
      console.log(`    趋势分数: ${trend.trending_score.toFixed(2)}, 用户数: ${trend.user_count}`);
      console.log(`    增长率: ${(trend.recent_growth_rate * 100).toFixed(1)}%`);
    });

    // 场景6：技能缺口分析
    console.log('\n📌 场景6：分析user001的技能缺口');
    const skillGaps = await this.queryService.analyzeSkillGaps('user001', {
      comparisonUserIds: ['user002', 'user003']
    });
    
    console.log('🎯 技能分析:');
    console.log(`  技能缺口 (${skillGaps.skill_gaps.length}个):`);
    skillGaps.skill_gaps.slice(0, 3).forEach(gap => {
      console.log(`    - ${gap.skill_name}: ${gap.gap_level} (学习时间: ${gap.estimated_learning_time})`);
      if (gap.recommended_mentors.length > 0) {
        console.log(`      推荐导师: ${gap.recommended_mentors.join(', ')}`);
      }
    });
    
    console.log(`  技能优势 (${skillGaps.skill_strengths.length}个):`);
    skillGaps.skill_strengths.slice(0, 3).forEach(strength => {
      console.log(`    - ${strength.skill_name}: 熟练度 ${(strength.proficiency_level * 100).toFixed(1)}%`);
    });
  }

  /**
   * 演示维护功能
   */
  private async demonstrateMaintenanceFeatures(): Promise<void> {
    console.log('\n🔧 演示维护功能...\n');

    // 获取存储统计
    console.log('📊 当前存储状态:');
    const stats = await this.cloudStorage.getVectorStorageStats();
    console.log(`  - 总记录数: ${stats.total_records}`);
    console.log(`  - 用户数: ${Object.keys(stats.records_by_user).length}`);
    console.log(`  - 存储大小: ${stats.storage_size_mb}MB`);
    console.log(`  - 健康度: ${(stats.health_score * 100).toFixed(1)}%`);

    // 执行维护操作
    console.log('\n🔧 执行向量化数据维护...');
    const maintenanceResult = await this.cloudStorage.performVectorMaintenance();
    
    console.log('维护结果:');
    console.log(`  - 清理记录: ${maintenanceResult.cleaned_records}条`);
    console.log(`  - 更新记录: ${maintenanceResult.updated_records}条`);
    console.log(`  - 创建概要: ${maintenanceResult.created_summaries}个`);
    
    if (maintenanceResult.errors.length > 0) {
      console.log(`  - 错误: ${maintenanceResult.errors.length}个`);
      maintenanceResult.errors.forEach(error => console.log(`    ${error}`));
    }

    // 演示实时更新
    console.log('\n🔄 演示实时更新功能...');
    const manager = new UserProfileManager('user001', this.cloudStorage);
    await manager.initialize();

    // 模拟用户行为更新
    const mockUpdate = {
      userId: 'user001',
      targetItem: {
        id: 'vue-js',
        type: 'technology' as const,
        name: 'Vue.js',
        metadata: { description: '渐进式JavaScript框架' }
      },
      action: {
        actionType: 'view' as const,
        timestamp: Date.now(),
        weight: 0.2,
        context: 'learning new framework'
      }
    };

    const updateSuccess = await manager.updateInterestItem(mockUpdate);
    console.log(`兴趣项更新: ${updateSuccess ? '成功' : '失败'}`);

    // 验证更新结果
    const updatedInterests = await manager.queryInterestItems({
      category: 'technology',
      searchQuery: 'Vue'
    });
    
    if (updatedInterests.length > 0) {
      console.log('更新后的技术兴趣:');
      updatedInterests.forEach(interest => {
        console.log(`  - ${interest.metadata.name}: 权重 ${interest.metadata.current_weight.toFixed(3)}`);
      });
    }
  }

  /**
   * 运行性能测试
   */
  async runPerformanceTest(): Promise<void> {
    console.log('\n⚡ 运行性能测试...\n');

    const testUserIds = ['user001', 'user002', 'user003'];
    const iterations = 5;

    // 测试查询性能
    console.log('🔍 测试查询性能...');
    const queryStartTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      for (const userId of testUserIds) {
        await this.queryService.findUsersWithSimilarInterests(userId, { limit: 5 });
      }
    }
    
    const queryTotalTime = Date.now() - queryStartTime;
    const avgQueryTime = queryTotalTime / (iterations * testUserIds.length);
    console.log(`  - 平均查询时间: ${avgQueryTime.toFixed(2)}ms`);
    console.log(`  - 总查询次数: ${iterations * testUserIds.length}`);

    // 测试批量存储性能
    console.log('\n💾 测试批量存储性能...');
    const storeStartTime = Date.now();
    
    const testRecords = this.generateTestRecords('perf_test_user', 20);
    const storeCount = await this.cloudStorage.storeUserprofilesRecordsBatch(testRecords);
    
    const storeTotalTime = Date.now() - storeStartTime;
    console.log(`  - 批量存储时间: ${storeTotalTime}ms`);
    console.log(`  - 存储记录数: ${storeCount}/${testRecords.length}`);
    console.log(`  - 平均存储时间: ${(storeTotalTime / testRecords.length).toFixed(2)}ms/记录`);

    // 清理测试数据
    await this.cloudStorage.deleteUserVectorizedRecords('perf_test_user');
    console.log('🧹 测试数据已清理');
  }

  /**
   * 运行错误处理测试
   */
  async runErrorHandlingTest(): Promise<void> {
    console.log('\n🛡️ 运行错误处理测试...\n');

    // 测试无效用户ID
    console.log('测试无效用户ID查询...');
    const invalidUserResult = await this.queryService.findUsersWithSimilarInterests('invalid_user_999');
    console.log(`无效用户查询结果: ${invalidUserResult.length}个用户`);

    // 测试空查询
    console.log('测试空查询...');
    const emptyQueryResult = await this.cloudStorage.queryUserprofiles({
      user_id: 'user001',
      limit: 1
    });
    console.log(`空查询结果: ${emptyQueryResult.records.length}条记录`);

    // 测试极端参数
    console.log('测试极端参数...');
    const extremeResult = await this.queryService.findUsersWithSimilarInterests('user001', {
      limit: -1,
      similarityThreshold: 2.0
    });
    console.log(`极端参数查询结果: ${extremeResult.length}个用户`);

    console.log('✅ 错误处理测试完成');
  }

  // =================== 辅助方法 ===================

  /**
   * 创建演示用户
   */
  private createDemoUser(userId: string, description: string, technologies: string[]): UserProfile {
    const now = Date.now();
    const baseTime = now - (Math.random() * 30 * 24 * 60 * 60 * 1000); // 最近30天内的随机时间

    return {
      userId,
      createdAt: baseTime,
      lastUpdated: now,
      interests: {
        projects: this.createDemoProjects(userId, description),
        people: this.createDemoPeople(userId),
        topics: this.createDemoTopics(description),
        jiraTickets: [],
        technologies: this.createDemoTechnologies(technologies, baseTime),
        documents: []
      },
      behaviorPatterns: {
        activeTimeZones: this.createDemoTimeZones(),
        primaryWorkAreas: [description.split(' ')[0]],
        communicationStyle: this.createDemoCommunicationStyle(userId),
        toolUsageFrequency: this.createDemoToolUsage(technologies)
      },
      derivedPreferences: {
        preferredProjectTypes: [description],
        keyCollaborators: this.getRandomCollaborators(),
        expertiseAreas: technologies.slice(0, 3),
        riskSensitivity: 'medium',
        updateFrequency: 'daily'
      },
      statistics: {
        totalInteractions: Math.floor(Math.random() * 500) + 100,
        averageDailyActivity: Math.random() * 20 + 5,
        mostActiveDay: '2024-01-15',
        topInteractionTypes: {
          'view': Math.floor(Math.random() * 100) + 50,
          'edit': Math.floor(Math.random() * 50) + 20,
          'create': Math.floor(Math.random() * 30) + 10
        }
      }
    };
  }

  /**
   * 创建演示项目
   */
  private createDemoProjects(userId: string, description: string): UserInterestItem[] {
    const projects = [
      `${userId}-主项目`,
      `团队${description}项目`,
      '开源贡献项目'
    ];

    return projects.map((name, index) => ({
      id: `project_${userId}_${index}`,
      type: 'project',
      name,
      firstSeen: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
      lastAccessed: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
      accessCount: Math.floor(Math.random() * 50) + 10,
      userActions: [
        {
          actionType: 'create',
          timestamp: Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000,
          weight: 0.4,
          context: '项目创建'
        },
        {
          actionType: 'edit',
          timestamp: Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000,
          weight: 0.3,
          context: '项目更新'
        }
      ],
      currentWeight: Math.random() * 0.5 + 0.3,
      decayFactor: 1.0,
      metadata: { projectType: description, status: 'active' }
    }));
  }

  /**
   * 创建演示人员
   */
  private createDemoPeople(userId: string): UserInterestItem[] {
    const people = ['张三', '李四', '王五', '赵六'];
    
    return people.map((name, index) => ({
      id: `person_${userId}_${index}`,
      type: 'person',
      name,
      firstSeen: Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000,
      lastAccessed: Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000,
      accessCount: Math.floor(Math.random() * 30) + 5,
      userActions: [
        {
          actionType: 'mention',
          timestamp: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
          weight: 0.2,
          context: '协作讨论'
        }
      ],
      currentWeight: Math.random() * 0.4 + 0.2,
      decayFactor: 1.0,
      metadata: { role: '团队成员', department: '技术部' }
    }));
  }

  /**
   * 创建演示主题
   */
  private createDemoTopics(description: string): UserInterestItem[] {
    const baseTopics = ['技术分享', '团队建设', '项目管理'];
    const specificTopics = description.includes('八卦') ? 
      ['八卦讨论', '社交话题', '非正式交流', '团队文化'] : 
      ['代码审查', '架构设计', '性能优化'];

    const allTopics = [...baseTopics, ...specificTopics];
    
    return allTopics.map((name, index) => ({
      id: `topic_${index}`,
      type: 'topic',
      name,
      firstSeen: Date.now() - Math.random() * 45 * 24 * 60 * 60 * 1000,
      lastAccessed: Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000,
      accessCount: Math.floor(Math.random() * 25) + 3,
      userActions: [
        {
          actionType: 'view',
          timestamp: Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000,
          weight: 0.1,
          context: '话题讨论'
        }
      ],
      currentWeight: Math.random() * 0.6 + 0.2,
      decayFactor: 1.0,
      metadata: { 
        category: description.includes('八卦') ? 'social' : 'technical',
        keywords: [name.split(' ')[0]]
      }
    }));
  }

  /**
   * 创建演示技术
   */
  private createDemoTechnologies(technologies: string[], baseTime: number): UserInterestItem[] {
    return technologies.map((tech, index) => ({
      id: `tech_${tech.toLowerCase().replace(/\./g, '_')}`,
      type: 'technology',
      name: tech,
      firstSeen: baseTime + index * 24 * 60 * 60 * 1000,
      lastAccessed: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
      accessCount: Math.floor(Math.random() * 40) + 15,
      userActions: [
        {
          actionType: 'view',
          timestamp: Date.now() - Math.random() * 2 * 24 * 60 * 60 * 1000,
          weight: 0.1,
          context: '技术学习'
        },
        {
          actionType: 'edit',
          timestamp: Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000,
          weight: 0.3,
          context: '代码编写'
        }
      ],
      currentWeight: Math.random() * 0.4 + 0.4,
      decayFactor: 1.0,
      metadata: { 
        stack: tech,
        category: 'programming',
        proficiency: Math.random() * 0.5 + 0.5
      }
    }));
  }

  /**
   * 创建演示时区活动
   */
  private createDemoTimeZones(): any[] {
    const activeHours = [9, 10, 11, 14, 15, 16, 17];
    const workDays = [1, 2, 3, 4, 5]; // 周一到周五

    const timeZones = [];
    for (const day of workDays) {
      for (const hour of activeHours) {
        timeZones.push({
          hour,
          dayOfWeek: day,
          activityLevel: Math.random() * 0.5 + 0.3
        });
      }
    }
    return timeZones;
  }

  /**
   * 创建演示沟通风格
   */
  private createDemoCommunicationStyle(userId: string): any {
    const isGossipper = userId === 'user004';
    
    return {
      formality: isGossipper ? 'casual' : 'semi-formal',
      detailLevel: isGossipper ? 'low' : 'medium',
      responseSpeed: isGossipper ? 'quick' : 'normal',
      preferredChannels: isGossipper ? ['chat', 'informal'] : ['email', 'meeting', 'chat']
    };
  }

  /**
   * 创建演示工具使用
   */
  private createDemoToolUsage(technologies: string[]): any[] {
    const toolMap: Record<string, string[]> = {
      'React': ['VS Code', 'Chrome DevTools', 'npm'],
      'Python': ['PyCharm', 'Jupyter', 'pip'],
      'TypeScript': ['VS Code', 'TSC', 'npm'],
      'Docker': ['Docker Desktop', 'kubectl', 'Docker Compose']
    };

    const tools = new Set<string>();
    technologies.forEach(tech => {
      const techTools = toolMap[tech] || [tech];
      techTools.forEach(tool => tools.add(tool));
    });

    return Array.from(tools).map(tool => ({
      toolName: tool,
      frequency: Math.random() * 10 + 2,
      lastUsed: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
      primaryUseCase: '开发工作'
    }));
  }

  /**
   * 获取随机协作者
   */
  private getRandomCollaborators(): string[] {
    const allCollaborators = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank'];
    const count = Math.floor(Math.random() * 3) + 2;
    return allCollaborators.slice(0, count);
  }

  /**
   * 生成测试记录
   */
  private generateTestRecords(userId: string, count: number): any[] {
    const records = [];
    
    for (let i = 0; i < count; i++) {
      records.push({
        id: `${userId}_test_record_${i}`,
        document: `测试记录 ${i}: 用于性能测试的向量化记录`,
        metadata: {
          record_type: 'interest_item',
          interest_category: 'test',
          user_id: userId,
          created_at: Date.now(),
          updated_at: Date.now(),
          name: `测试项目${i}`,
          current_weight: Math.random(),
          access_count: Math.floor(Math.random() * 10) + 1,
          first_seen: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
          recent_action_types: ['view'],
          interaction_frequency: Math.random() * 5,
          trend: 'stable'
        }
      });
    }
    
    return records;
  }
}

// 导出演示函数，便于在其他地方调用
export async function runUserProfileDemo(): Promise<void> {
  const demo = new UserProfileDemo();
  await demo.runFullDemo();
}

export async function runUserProfilePerformanceTest(): Promise<void> {
  const demo = new UserProfileDemo();
  await demo.runPerformanceTest();
}

export async function runUserProfileErrorTest(): Promise<void> {
  const demo = new UserProfileDemo();
  await demo.runErrorHandlingTest();
}
