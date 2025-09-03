<template>
  <div class="user-profile-section">
    <div class="profile-header">
      <div class="header-content">
        <div class="header-text">
          <h2>👤 用户画像分析</h2>
          <p>基于您的行为模式和兴趣偏好生成的个性化画像</p>
        </div>
        <div class="header-actions">
          <button 
            class="export-btn"
            :disabled="isExporting"
            @click="exportUserProfile"
          >
            <span v-if="!isExporting">📥 导出画像</span>
            <span v-else>⏳ 导出中...</span>
          </button>
        </div>
      </div>
    </div>
    
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <span>加载用户画像数据...</span>
    </div>
    
    <div v-else-if="userProfile && userProfileAnalysis" class="profile-content">
      <!-- 核心兴趣概览 -->
      <div class="profile-card">
        <h3>🎯 当前关注重点</h3>
        <div class="interest-grid">
          <div class="interest-category">
            <h4>📁 项目</h4>
            <div class="interest-list">
              <div 
                v-for="(project, idx) in getProjectsWithImportance()" 
                :key="project.id || idx" 
                class="interest-item"
              >
                <span class="interest-icon">🚀</span>
                <span class="interest-name">{{ project.name }}</span>
                <div class="importance-rating">
                  <div class="stars">
                    <span 
                      v-for="star in 5" 
                      :key="star"
                      class="star"
                      :class="{ active: star <= (project.explicitImportance || 0) * 5 }"
                      @click="setImportance(project.id, 'project', star / 5)"
                    >
                      ★
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="interest-category">
            <h4>👥 人员</h4>
            <div class="interest-list">
              <div 
                v-for="(person, idx) in getPeopleWithImportance()" 
                :key="person.id || idx" 
                class="interest-item"
              >
                <span class="interest-icon">👤</span>
                <span class="interest-name">{{ person.name }}</span>
                <div class="importance-rating">
                  <div class="stars">
                    <span 
                      v-for="star in 5" 
                      :key="star"
                      class="star"
                      :class="{ active: star <= (person.explicitImportance || 0) * 5 }"
                      @click="setImportance(person.id, 'person', star / 5)"
                    >
                      ★
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="interest-category">
            <h4>💡 主题</h4>
            <div class="interest-list">
              <div 
                v-for="(topic, idx) in getTopicsWithImportance()" 
                :key="topic.id || idx" 
                class="interest-item"
              >
                <span class="interest-icon">💭</span>
                <span class="interest-name">{{ topic.name }}</span>
                <div class="importance-rating">
                  <div class="stars">
                    <span 
                      v-for="star in 5" 
                      :key="star"
                      class="star"
                      :class="{ active: star <= (topic.explicitImportance || 0) * 5 }"
                      @click="setImportance(topic.id, 'topic', star / 5)"
                    >
                      ★
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 行为洞察 -->
      <div class="profile-card">
        <h3>🔍 行为洞察</h3>
        <div class="insights-grid">
          <div class="insight-item">
            <h4>⏰ 工作模式</h4>
            <p>{{ userProfileAnalysis.insights.workingPattern }}</p>
          </div>
          <div class="insight-item">
            <h4>🤝 协作风格</h4>
            <p>{{ userProfileAnalysis.insights.collaborationStyle }}</p>
          </div>
          <div class="insight-item">
            <h4>🎓 专业领域</h4>
            <div class="tag-list">
              <span 
                v-for="(area, idx) in userProfileAnalysis.insights.focusAreas" 
                :key="idx" 
                class="focus-tag"
              >
                {{ area }}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 智能推荐 -->
      <div class="profile-card">
        <h3>💡 智能推荐</h3>
        <div class="suggestions-list">
          <div 
            v-for="(suggestion, idx) in userProfileAnalysis.insights.suggestedContent" 
            :key="idx" 
            class="suggestion-item"
          >
            <span class="suggestion-icon">📌</span>
            <span>{{ suggestion }}</span>
          </div>
        </div>
      </div>
      
      <!-- 预测兴趣 -->
      <div v-if="userProfileAnalysis.predictedInterests.length > 0" class="profile-card">
        <h3>🔮 预测您可能感兴趣的内容</h3>
        <div class="predictions-list">
          <div 
            v-for="(prediction, idx) in userProfileAnalysis.predictedInterests" 
            :key="idx" 
            class="prediction-item"
          >
            <div class="prediction-header">
              <span class="prediction-type">{{ prediction.type }}</span>
              <span class="prediction-confidence">
                置信度: {{ Math.round(prediction.confidence * 100) }}%
              </span>
            </div>
            <div class="prediction-name">{{ prediction.name }}</div>
            <div class="prediction-reason">{{ prediction.reason }}</div>
          </div>
        </div>
      </div>
      
      <!-- 统计数据 -->
      <div class="profile-card">
        <h3>📊 活动统计</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ userProfile.statistics.totalInteractions }}</div>
            <div class="stat-label">总交互次数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ userProfile.statistics.averageDailyActivity.toFixed(1) }}</div>
            <div class="stat-label">日均活动</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ userProfile.interests.projects.length }}</div>
            <div class="stat-label">关注项目数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ userProfile.interests.people.length }}</div>
            <div class="stat-label">协作人员数</div>
          </div>
        </div>
      </div>
      
      <!-- 🆕 权重衰变设置 -->
      <div class="profile-card">
        <div class="settings-header">
          <h3>⚙️ 高级设置</h3>
          <button 
            class="toggle-settings-btn"
            @click="showAdvancedSettings = !showAdvancedSettings"
          >
            {{ showAdvancedSettings ? '收起设置' : '展开设置' }}
          </button>
        </div>
        
        <div v-if="showAdvancedSettings" class="advanced-settings">
          <!-- 权重衰变配置 -->
          <div class="setting-section">
            <h4>🔧 权重衰变配置</h4>
            <p class="setting-description">
              权重衰变控制兴趣项的重要性如何随时间自动调整。较高的衰变率会让不常用的项目更快降低重要性。
            </p>
            
            <div class="setting-group">
              <label>基础衰变率 (每天)</label>
              <div class="slider-container">
                <input 
                  type="range" 
                  min="0.01" 
                  max="0.2" 
                  step="0.01"
                  v-model.number="weightDecaySettings.baseDecayRate"
                  @input="updateDecayPreview"
                />
                <span class="slider-value">{{ (weightDecaySettings.baseDecayRate * 100).toFixed(1) }}%</span>
              </div>
              <div class="setting-hint">推荐值: 3-8%</div>
            </div>
            
            <div class="setting-group">
              <label>最大权重</label>
              <div class="slider-container">
                <input 
                  type="range" 
                  min="0.5" 
                  max="2.0" 
                  step="0.1"
                  v-model.number="weightDecaySettings.maxWeight"
                  @input="updateDecayPreview"
                />
                <span class="slider-value">{{ weightDecaySettings.maxWeight.toFixed(1) }}</span>
              </div>
            </div>
            
            <div class="setting-group">
              <label>最小权重</label>
              <div class="slider-container">
                <input 
                  type="range" 
                  min="0.001" 
                  max="0.1" 
                  step="0.001"
                  v-model.number="weightDecaySettings.minWeight"
                  @input="updateDecayPreview"
                />
                <span class="slider-value">{{ (weightDecaySettings.minWeight * 100).toFixed(1) }}%</span>
              </div>
            </div>
          </div>
          
          <!-- 行为权重配置 -->
          <div class="setting-section">
            <h4>🎯 行为权重配置</h4>
            <p class="setting-description">
              不同行为对兴趣权重的贡献程度。
            </p>
            
            <div class="action-weights">
              <div 
                v-for="(weight, action) in weightDecaySettings.actionWeights" 
                :key="action"
                class="action-weight-item"
              >
                <label>{{ getActionDisplayName(action) }}</label>
                <div class="slider-container">
                  <input 
                    type="range" 
                    min="0.05" 
                    max="0.8" 
                    step="0.05"
                    v-model.number="weightDecaySettings.actionWeights[action]"
                    @input="updateDecayPreview"
                  />
                  <span class="slider-value">{{ (weight * 100).toFixed(0) }}%</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 衰变预览 -->
          <div class="setting-section">
            <h4>📊 衰变效果预览</h4>
            <div class="decay-preview">
              <div class="preview-chart">
                <div class="chart-description">
                  权重衰变示意图 (30天)
                </div>
                <div class="chart-bars">
                  <div 
                    v-for="day in decayPreviewData" 
                    :key="day.day"
                    class="chart-bar"
                    :style="{ height: `${day.weight * 100}%` }"
                    :title="`第${day.day}天: ${(day.weight * 100).toFixed(1)}%`"
                  ></div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 设置操作按钮 -->
          <div class="setting-actions">
            <button 
              class="reset-btn"
              @click="resetToDefaults"
            >
              恢复默认
            </button>
            <button 
              class="apply-btn"
              :disabled="isApplyingSettings"
              @click="applyDecaySettings"
            >
              <span v-if="!isApplyingSettings">应用设置</span>
              <span v-else>⏳ 应用中...</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <span>👤</span>
      <p>暂无用户画像数据</p>
      <p class="empty-hint">随着您使用系统，我们将逐步为您建立个性化画像</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { chromeAPI } from '../memory-store';

// 类型定义（基于memory.tsx中的接口）
interface UserProfile {
  userId: string;
  interests: {
    projects: any[];
    people: any[];
    topics: any[];
    jiraItems: any[];
    technologies: any[];
    documents: any[];
  };
  statistics: {
    totalInteractions: number;
    averageDailyActivity: number;
    lastActiveTime: number;
  };
  lastUpdated: number;
}

interface UserProfileAnalysis {
  topInterests: {
    projects: string[];
    people: string[];
    topics: string[];
  };
  insights: {
    workingPattern: string;
    collaborationStyle: string;
    focusAreas: string[];
    suggestedContent: string[];
  };
  predictedInterests: Array<{
    type: string;
    name: string;
    confidence: number;
    reason: string;
  }>;
  lastUpdated: number;
}

const isLoading = ref(true);
const isExporting = ref(false);
const showAdvancedSettings = ref(false);
const isApplyingSettings = ref(false);
const userProfile = ref<UserProfile | null>(null);
const userProfileAnalysis = ref<UserProfileAnalysis | null>(null);

// 🆕 权重衰变设置
const weightDecaySettings = ref({
  baseDecayRate: 0.05,
  maxWeight: 1.0,
  minWeight: 0.01,
  actionWeights: {
    view: 0.1,
    edit: 0.3,
    create: 0.4,
    link: 0.25,
    mention: 0.2,
    search: 0.15,
    favorite: 0.5
  }
});

// 衰变预览数据
const decayPreviewData = ref<Array<{ day: number; weight: number }>>([]);

const loadUserProfile = async () => {
  isLoading.value = true;
  try {
    const response = await chromeAPI.sendMessage({ type: 'GET_USER_PROFILE' });
    if (response && response.success) {
      userProfile.value = response.data.profile;
      userProfileAnalysis.value = response.data.analysis;
    } else {
      // 使用模拟数据
      userProfile.value = getMockUserProfile();
      userProfileAnalysis.value = getMockUserProfileAnalysis();
    }
  } catch (error) {
    console.error('加载用户画像失败:', error);
    // 使用模拟数据
    userProfile.value = getMockUserProfile();
    userProfileAnalysis.value = getMockUserProfileAnalysis();
  } finally {
    isLoading.value = false;
  }
};

const getMockUserProfile = (): UserProfile => {
  return {
    userId: 'default_user',
    interests: {
      projects: [
        { id: 'personal-ai', name: 'Personal-AI', weight: 0.9 },
        { id: 'data-pipeline', name: 'Data Pipeline', weight: 0.7 }
      ],
      people: [
        { id: 'zhangsan', name: '张三', weight: 0.8 },
        { id: 'lisi', name: '李四', weight: 0.6 }
      ],
      topics: [
        { id: 'ai-workflow', name: 'AI工作流自动化', weight: 0.9 },
        { id: 'frontend-opt', name: '前端性能优化', weight: 0.7 }
      ],
      jiraItems: [],
      technologies: [],
      documents: []
    },
    statistics: {
      totalInteractions: 156,
      averageDailyActivity: 12.3,
      lastActiveTime: Date.now()
    },
    lastUpdated: Date.now()
  };
};

const getMockUserProfileAnalysis = (): UserProfileAnalysis => {
  return {
    topInterests: {
      projects: ['Personal-AI', 'Data Pipeline', 'Web Platform'],
      people: ['张三', '李四', '王五'],
      topics: ['AI工作流自动化', '前端性能优化', '产品设计思维']
    },
    insights: {
      workingPattern: '您倾向于在上午9-11点进行深度思考工作，下午主要处理协作和沟通任务。',
      collaborationStyle: '您是一个积极的团队协作者，经常主动分享技术见解和参与讨论。',
      focusAreas: ['前端开发', 'AI技术', '性能优化', '用户体验'],
      suggestedContent: [
        '《Clean Architecture》读书笔记复习',
        'React 18 新特性深度解析',
        'AI驱动的代码审查工具探索',
        '前端性能监控最佳实践'
      ]
    },
    predictedInterests: [
      {
        type: '技术话题',
        name: 'Web3.0 前端开发',
        confidence: 0.82,
        reason: '基于您对前端技术和新兴技术的关注'
      },
      {
        type: '项目协作',
        name: '敏捷开发方法论',
        confidence: 0.75,
        reason: '您经常参与项目讨论和团队协作'
      }
    ],
    lastUpdated: Date.now()
  };
};

// 🆕 获取包含重要性信息的项目列表
const getProjectsWithImportance = () => {
  if (!userProfile.value?.interests?.projects) {
    // 返回mock数据格式，包含重要性信息
    return [
      { id: 'personal-ai', name: 'Personal-AI', explicitImportance: 0.9 },
      { id: 'data-pipeline', name: 'Data Pipeline', explicitImportance: 0.7 },
      { id: 'web-platform', name: 'Web Platform', explicitImportance: 0.6 }
    ];
  }
  return userProfile.value.interests.projects.map(project => ({
    id: project.id,
    name: project.name,
    explicitImportance: project.explicitImportance || 0
  }));
};

// 🆕 获取包含重要性信息的人员列表
const getPeopleWithImportance = () => {
  if (!userProfile.value?.interests?.people) {
    return [
      { id: 'zhangsan', name: '张三', explicitImportance: 0.8 },
      { id: 'lisi', name: '李四', explicitImportance: 0.6 },
      { id: 'wangwu', name: '王五', explicitImportance: 0.5 }
    ];
  }
  return userProfile.value.interests.people.map(person => ({
    id: person.id,
    name: person.name,
    explicitImportance: person.explicitImportance || 0
  }));
};

// 🆕 获取包含重要性信息的主题列表
const getTopicsWithImportance = () => {
  if (!userProfile.value?.interests?.topics) {
    return [
      { id: 'ai-workflow', name: 'AI工作流自动化', explicitImportance: 0.9 },
      { id: 'frontend-opt', name: '前端性能优化', explicitImportance: 0.7 },
      { id: 'design-thinking', name: '产品设计思维', explicitImportance: 0.6 }
    ];
  }
  return userProfile.value.interests.topics.map(topic => ({
    id: topic.id,
    name: topic.name,
    explicitImportance: topic.explicitImportance || 0
  }));
};

// 🆕 设置重要性标记
const setImportance = async (itemId: string, type: string, importance: number) => {
  if (!itemId) {
    console.warn('设置重要性失败：缺少项目ID');
    return;
  }
  
  try {
    console.log(`设置重要性: ${itemId} (${type}) -> ${importance}`);
    
    const response = await chromeAPI.sendMessage({
      type: 'SET_EXPLICIT_IMPORTANCE',
      itemId: itemId,
      type: type,
      importance: importance
    });
    
    if (response && response.success) {
      console.log('重要性设置成功');
      // 刷新用户画像数据
      await loadUserProfile();
    } else {
      console.error('重要性设置失败:', response?.error);
    }
  } catch (error) {
    console.error('设置重要性时发生错误:', error);
  }
};

// 🆕 导出用户画像功能
const exportUserProfile = async () => {
  if (isExporting.value) {
    return; // 防止重复导出
  }
  
  isExporting.value = true;
  
  try {
    console.log('开始导出用户画像...');
    
    const response = await chromeAPI.sendMessage({
      type: 'EXPORT_USER_PROFILE'
    });
    
    if (response && response.success) {
      console.log('用户画像导出成功:', response.data);
      
      // 生成文件名（包含时间戳）
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const fileName = `用户画像_${timestamp}.json`;
      
      // 格式化JSON数据（美化输出）
      const jsonData = JSON.stringify(response.data, null, 2);
      
      // 创建下载链接
      const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      // 创建临时下载链接
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      
      // 触发下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 清理URL对象
      URL.revokeObjectURL(url);
      
      console.log(`用户画像已导出到文件: ${fileName}`);
      
      // 显示成功提示（可选：使用浏览器通知或自定义提示）
      showExportSuccessNotification(fileName, response.data.exportSummary);
      
    } else {
      console.error('用户画像导出失败:', response?.error);
      showExportErrorNotification(response?.error || '未知错误');
    }
  } catch (error) {
    console.error('导出用户画像时发生错误:', error);
    showExportErrorNotification(error.message);
  } finally {
    isExporting.value = false;
  }
};

// 🆕 显示导出成功通知
const showExportSuccessNotification = (fileName: string, summary: any) => {
  // 使用简单的alert，也可以替换为更好的通知组件
  const message = `
📥 导出成功！

文件名: ${fileName}
画像完整性: ${summary?.profileCompleteness || '未知'}
总交互次数: ${summary?.totalInteractions || 0}
日均活动量: ${summary?.averageDailyActivity?.toFixed(1) || 0}
数据质量: ${summary?.dataQuality || '未知'}

文件已保存到下载文件夹。
  `.trim();
  
  alert(message);
};

// 🆕 显示导出错误通知
const showExportErrorNotification = (error: string) => {
  const message = `
❌ 导出失败

错误信息: ${error}

请稍后重试或联系技术支持。
  `.trim();
  
  alert(message);
};

// 🆕 权重衰变设置相关方法

// 获取行为显示名称
const getActionDisplayName = (action: string): string => {
  const actionNames: Record<string, string> = {
    view: '📖 查看',
    edit: '✏️ 编辑',
    create: '➕ 创建',
    link: '🔗 关联',
    mention: '💬 提及',
    search: '🔍 搜索',
    favorite: '⭐ 收藏'
  };
  return actionNames[action] || action;
};

// 更新衰变预览
const updateDecayPreview = () => {
  const data: Array<{ day: number; weight: number }> = [];
  let currentWeight = 1.0; // 初始权重100%
  
  // 模拟30天的衰变过程
  for (let day = 0; day <= 30; day += 2) {
    data.push({
      day: day,
      weight: Math.max(weightDecaySettings.value.minWeight, currentWeight)
    });
    
    // 应用衰变（每天）
    if (day > 0) {
      currentWeight *= (1 - weightDecaySettings.value.baseDecayRate);
    }
  }
  
  decayPreviewData.value = data;
};

// 重置为默认设置
const resetToDefaults = () => {
  if (confirm('确定要重置为默认设置吗？')) {
    weightDecaySettings.value = {
      baseDecayRate: 0.05,
      maxWeight: 1.0,
      minWeight: 0.01,
      actionWeights: {
        view: 0.1,
        edit: 0.3,
        create: 0.4,
        link: 0.25,
        mention: 0.2,
        search: 0.15,
        favorite: 0.5
      }
    };
    updateDecayPreview();
  }
};

// 应用衰变设置
const applyDecaySettings = async () => {
  if (isApplyingSettings.value) {
    return;
  }
  
  isApplyingSettings.value = true;
  
  try {
    console.log('应用权重衰变设置:', weightDecaySettings.value);
    
    const response = await chromeAPI.sendMessage({
      type: 'UPDATE_WEIGHT_DECAY_CONFIG',
      config: weightDecaySettings.value
    });
    
    if (response && response.success) {
      console.log('权重衰变设置应用成功');
      
      // 显示成功通知
      const message = `
✅ 设置应用成功！

基础衰变率: ${(weightDecaySettings.value.baseDecayRate * 100).toFixed(1)}%
权重范围: ${weightDecaySettings.value.minWeight.toFixed(3)} - ${weightDecaySettings.value.maxWeight.toFixed(1)}

新的权重衰变配置已生效。
      `.trim();
      
      alert(message);
      
      // 可选：重新加载用户画像以应用新设置
      await loadUserProfile();
    } else {
      console.error('权重衰变设置应用失败:', response?.error);
      alert(`设置应用失败: ${response?.error || '未知错误'}`);
    }
  } catch (error) {
    console.error('应用权重衰变设置时发生错误:', error);
    alert(`设置应用失败: ${error.message}`);
  } finally {
    isApplyingSettings.value = false;
  }
};

onMounted(() => {
  loadUserProfile();
  // 初始化衰变预览
  updateDecayPreview();
});
</script>

<style scoped>
/* 🎨 用户画像页面样式 */
.user-profile-section {
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.profile-header {
  margin-bottom: 24px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
}

.header-text h2 {
  color: #2c3e50;
  margin: 0 0 8px 0;
}

.header-text p {
  color: #7f8c8d;
  margin: 0;
}

/* 🎨 导出按钮样式 */
.header-actions {
  flex-shrink: 0;
}

.export-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  display: flex;
  align-items: center;
  gap: 8px;
}

.export-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
}

.export-btn:active {
  transform: translateY(0);
}

.export-btn:disabled {
  background: #95a5a6;
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 2px 4px rgba(149, 165, 166, 0.3);
}

.export-btn:disabled:hover {
  transform: none;
  box-shadow: 0 2px 4px rgba(149, 165, 166, 0.3);
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  color: #7f8c8d;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #ecf0f1;
  border-left: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.profile-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border: 1px solid #e1e8ed;
}

.profile-card h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #2c3e50;
  font-size: 18px;
}

/* 🌟 兴趣网格布局 */
.interest-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.interest-category h4 {
  margin: 0 0 16px 0;
  color: #34495e;
  font-size: 16px;
}

.interest-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 🌟 兴趣项样式 - 带重要性评分 */
.interest-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  transition: all 0.2s ease;
}

.interest-item:hover {
  background: #e3f2fd;
  border-color: #2196f3;
  transform: translateY(-1px);
}

.interest-icon {
  margin-right: 12px;
  font-size: 16px;
}

.interest-name {
  flex-grow: 1;
  font-weight: 500;
  color: #2c3e50;
}

/* 🌟 重要性评分星级样式 */
.importance-rating {
  display: flex;
  align-items: center;
}

.stars {
  display: flex;
  gap: 2px;
}

.star {
  cursor: pointer;
  font-size: 18px;
  color: #ddd;
  transition: all 0.2s ease;
  user-select: none;
}

.star:hover {
  color: #ffd700;
  transform: scale(1.1);
}

.star.active {
  color: #ffd700;
  text-shadow: 0 0 3px rgba(255, 215, 0, 0.5);
}

/* 洞察网格 */
.insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.insight-item h4 {
  margin: 0 0 12px 0;
  color: #2c3e50;
  font-size: 16px;
}

.insight-item p {
  color: #7f8c8d;
  line-height: 1.5;
  margin: 0;
}

/* 焦点标签 */
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.focus-tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 500;
}

/* 推荐列表 */
.suggestions-list,
.predictions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.suggestion-item,
.prediction-item {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #3498db;
}

.suggestion-icon {
  margin-right: 12px;
  font-size: 16px;
  color: #3498db;
}

/* 预测兴趣样式 */
.prediction-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.prediction-type {
  background: #e8f5e8;
  color: #2e7d32;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.prediction-confidence {
  background: #fff3e0;
  color: #f57c00;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.prediction-name {
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
}

.prediction-reason {
  color: #7f8c8d;
  font-size: 14px;
}

/* 统计数据网格 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.stat-card {
  text-align: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 8px;
}

.stat-label {
  color: #7f8c8d;
  font-size: 14px;
  font-weight: 500;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #7f8c8d;
}

.empty-state span {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 8px 0;
  font-size: 16px;
}

.empty-hint {
  font-size: 14px;
  opacity: 0.7;
}

/* 🆕 权重衰变设置样式 */
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.toggle-settings-btn {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-settings-btn:hover {
  background: #e9ecef;
  border-color: #adb5bd;
}

.advanced-settings {
  border-top: 2px solid #e9ecef;
  padding-top: 24px;
}

.setting-section {
  margin-bottom: 32px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.setting-section h4 {
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 16px;
}

.setting-description {
  color: #6c757d;
  font-size: 14px;
  margin: 0 0 20px 0;
  line-height: 1.5;
}

.setting-group {
  margin-bottom: 20px;
}

.setting-group label {
  display: block;
  font-weight: 600;
  color: #495057;
  margin-bottom: 8px;
  font-size: 14px;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.slider-container input[type="range"] {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #e9ecef;
  outline: none;
  -webkit-appearance: none;
}

.slider-container input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #007bff;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,123,255,0.3);
}

.slider-container input[type="range"]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #007bff;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0,123,255,0.3);
}

.slider-value {
  min-width: 50px;
  text-align: right;
  font-weight: 600;
  color: #007bff;
  font-size: 14px;
}

.setting-hint {
  color: #6c757d;
  font-size: 12px;
  font-style: italic;
}

/* 行为权重配置样式 */
.action-weights {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.action-weight-item {
  background: white;
  padding: 16px;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.action-weight-item label {
  margin-bottom: 8px;
  font-size: 14px;
}

/* 衰变预览图表样式 */
.decay-preview {
  background: white;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #e9ecef;
}

.preview-chart {
  text-align: center;
}

.chart-description {
  font-size: 14px;
  color: #6c757d;
  margin-bottom: 16px;
}

.chart-bars {
  display: flex;
  align-items: end;
  justify-content: space-between;
  height: 120px;
  padding: 0 8px;
  background: linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 4px;
  gap: 2px;
}

.chart-bar {
  background: linear-gradient(to top, #007bff 0%, #6610f2 100%);
  min-height: 2px;
  flex: 1;
  border-radius: 2px 2px 0 0;
  transition: all 0.3s ease;
  opacity: 0.8;
}

.chart-bar:hover {
  opacity: 1;
  transform: scaleY(1.05);
}

/* 设置操作按钮样式 */
.setting-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 24px;
  border-top: 1px solid #e9ecef;
}

.reset-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-btn:hover {
  background: #5a6268;
  transform: translateY(-1px);
}

.apply-btn {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
}

.apply-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(40, 167, 69, 0.4);
}

.apply-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .header-actions {
    align-self: flex-start;
  }
  
  .export-btn {
    width: auto;
    padding: 10px 20px;
    font-size: 14px;
  }
  
  .interest-grid {
    grid-template-columns: 1fr;
  }
  
  .insights-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .interest-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .importance-rating {
    align-self: flex-end;
  }
  
  /* 设置页面响应式 */
  .action-weights {
    grid-template-columns: 1fr;
  }
  
  .setting-actions {
    justify-content: stretch;
  }
  
  .setting-actions button {
    flex: 1;
  }
}

@media (max-width: 480px) {
  .user-profile-section {
    padding: 16px;
  }
  
  .export-btn {
    width: 100%;
    justify-content: center;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .settings-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .toggle-settings-btn {
    align-self: center;
  }
  
  .setting-section {
    padding: 16px;
  }
  
  .slider-value {
    min-width: 45px;
    font-size: 13px;
  }
  
  .chart-bars {
    height: 80px;
  }
}
</style>
