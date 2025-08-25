/**
 * 测试实体类型获取功能
 */

import { memorySystem, EntityTypeInfo } from '../memory';

async function testGetEntityTypes() {
  console.log('🧪 开始测试 getEntityTypes 方法...');
  
  try {
    // 初始化记忆系统
    console.log('📋 初始化记忆系统...');
    await memorySystem.initialize();
    
    // 测试获取实体类型
    console.log('📋 获取实体类型列表...');
    const entityTypes = await memorySystem.getEntityTypes();
    
    console.log('📋 获取到的实体类型:');
    entityTypes.forEach((type: EntityTypeInfo) => {
      console.log(`  - ${type.icon} ${type.name} (${type.type}): ${type.count} 个实体`);
      console.log(`    描述: ${type.description}`);
    });
    
    console.log(`✅ 测试完成，共获取到 ${entityTypes.length} 个实体类型`);
    
    // 验证返回的数据结构
    const isValid = entityTypes.every((type: EntityTypeInfo) => {
      return type.type && type.name && type.icon && typeof type.count === 'number' && type.description;
    });
    
    if (isValid) {
      console.log('✅ 数据结构验证通过');
    } else {
      console.error('❌ 数据结构验证失败');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 如果直接运行此文件，执行测试
if (typeof window === 'undefined') {
  testGetEntityTypes();
}

export { testGetEntityTypes };
