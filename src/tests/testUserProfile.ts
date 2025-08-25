/**
 * 用户画像系统测试脚本
 * 用于验证用户画像的创建、更新和查询功能
 */

import { UserProfileManager } from '../services/UserProfileManager';
import { UserAction } from '../types/userProfile';

async function testUserProfileSystem() {
  console.log('🧪 开始测试用户画像系统...\n');
  
  // 1. 初始化测试
  console.log('1️⃣ 测试初始化...');
  const profileManager = new UserProfileManager('test_user@example.com');
  const profile = await profileManager.initialize();
  console.log('✅ 用户画像初始化成功');
  console.log(`- 用户ID: ${profile.userId}`);
  console.log(`- 创建时间: ${new Date(profile.createdAt).toLocaleString()}\n`);
  
  // 2. 测试行为记录
  console.log('2️⃣ 测试行为记录...');
  
  // 记录项目查看行为
  await profileManager.updateProfile({
    userId: 'test_user@example.com',
    action: {
      actionType: 'view',
      timestamp: Date.now(),
      context: 'test_script',
      weight: 0.1,
      metadata: { source: 'jira' }
    },
    targetItem: {
      id: 'proj_001',
      type: 'project',
      name: 'Personal-AI项目',
      metadata: {
        status: 'active',
        priority: 'high'
      }
    }
  });
  console.log('✅ 记录项目查看行为');
  
  // 记录人员交互
  await profileManager.updateProfile({
    userId: 'test_user@example.com',
    action: {
      actionType: 'mention',
      timestamp: Date.now(),
      context: 'test_script',
      weight: 0.2,
      metadata: { channel: 'slack' }
    },
    targetItem: {
      id: 'person_001',
      type: 'person',
      name: '张三',
      metadata: {
        role: '前端开发',
        team: '产品团队'
      }
    }
  });
  console.log('✅ 记录人员交互行为');
  
  // 记录技术关注
  await profileManager.updateProfile({
    userId: 'test_user@example.com',
    action: {
      actionType: 'search',
      timestamp: Date.now(),
      context: 'test_script',
      weight: 0.15,
      metadata: { query: 'React性能优化' }
    },
    targetItem: {
      id: 'tech_001',
      type: 'technology',
      name: 'React',
      metadata: {
        category: 'frontend',
        version: '18.x'
      }
    }
  });
  console.log('✅ 记录技术关注行为\n');
  
  // 3. 测试查询功能
  console.log('3️⃣ 测试查询功能...');
  
  // 查询所有兴趣
  const allInterests = await profileManager.queryProfile({
    sortBy: 'weight',
    limit: 5
  });
  console.log(`✅ 查询到 ${allInterests.length} 个兴趣项:`);
  allInterests.forEach(item => {
    console.log(`  - ${item.type}: ${item.name} (权重: ${item.currentWeight.toFixed(2)})`);
  });
  console.log('');
  
  // 查询项目兴趣
  const projectInterests = await profileManager.queryProfile({
    interestTypes: ['project'],
    minWeight: 0.05
  });
  console.log(`✅ 查询到 ${projectInterests.length} 个项目兴趣\n`);
  
  // 4. 测试画像分析
  console.log('4️⃣ 测试画像分析...');
  const analysis = await profileManager.analyzeProfile();
  console.log('✅ 生成用户画像分析:');
  console.log(`- 工作模式: ${analysis.insights.workingPattern}`);
  console.log(`- 协作风格: ${analysis.insights.collaborationStyle}`);
  console.log(`- 专业领域: ${analysis.insights.focusAreas.join(', ')}`);
  
  if (analysis.predictedInterests.length > 0) {
    console.log('\n预测的兴趣:');
    analysis.predictedInterests.forEach(pred => {
      console.log(`  - ${pred.item} (${pred.type}): ${pred.reason}`);
    });
  }
  
  // 5. 测试权重衰变
  console.log('\n5️⃣ 测试权重衰变...');
  console.log('⏳ 应用权重衰变...');
  await profileManager.applyWeightDecay();
  console.log('✅ 权重衰变完成');
  
  // 6. 测试明确重要性设置
  console.log('\n6️⃣ 测试明确重要性设置...');
  await profileManager.setExplicitImportance('proj_001', 'project', 0.9);
  console.log('✅ 设置项目明确重要性为 0.9');
  
  // 获取最终画像
  const finalProfile = profileManager.getProfile();
  console.log('\n📊 最终用户画像统计:');
  console.log(`- 总交互次数: ${finalProfile?.statistics.totalInteractions}`);
  console.log(`- 关注项目数: ${finalProfile?.interests.projects.length}`);
  console.log(`- 关注人员数: ${finalProfile?.interests.people.length}`);
  console.log(`- 关注技术数: ${finalProfile?.interests.technologies.length}`);
  
  console.log('\n✨ 用户画像系统测试完成！');
}

// 运行测试
if (typeof window !== 'undefined') {
  (window as any).testUserProfile = testUserProfileSystem;
  console.log('💡 提示: 在控制台运行 testUserProfile() 开始测试');
} else {
  // Node.js 环境直接运行
  testUserProfileSystem().catch(console.error);
}

export { testUserProfileSystem };
