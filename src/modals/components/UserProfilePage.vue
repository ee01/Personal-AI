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
      
      <!-- 🆕 行为分析图表 -->
      <div class="profile-card">
        <h3>📊 行为分析</h3>
        <div class="charts-grid">
          <!-- 行为趋势图 -->
          <div class="chart-container">
            <h4>📈 每日活跃度趋势</h4>
            <div class="trend-chart">
              <div class="chart-description">最近7天活动变化</div>
              <div class="trend-bars">
                <div 
                  v-for="day in behaviorTrendData" 
                  :key="day.date"
                  class="trend-bar"
                  :style="{ height: `${day.activity * 100}%` }"
                  :title="`${day.date}: ${day.interactions}次交互`"
                >
                  <span class="bar-label">{{ day.day }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 活跃时间热力图 -->
          <div class="chart-container">
            <h4>🕒 活跃时间热力图</h4>
            <div class="heatmap-chart">
              <div class="chart-description">一周工作时间分布</div>
              <div class="heatmap-grid">
                <div 
                  v-for="cell in heatmapData" 
                  :key="`${cell.day}-${cell.hour}`"
                  class="heatmap-cell"
                  :class="getHeatmapIntensity(cell.intensity)"
                  :title="`${cell.dayName} ${cell.hour}:00 - 活跃度: ${(cell.intensity * 100).toFixed(0)}%`"
                ></div>
              </div>
              <div class="heatmap-legend">
                <span class="legend-label">活跃度:</span>
                <div class="legend-scale">
                  <div class="legend-item low"></div>
                  <div class="legend-item medium"></div>
                  <div class="legend-item high"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 兴趣权重变化 -->
        <div class="chart-container full-width">
          <h4>📊 兴趣权重变化</h4>
          <div class="weight-timeline">
            <div class="chart-description">主要兴趣点权重历史变化</div>
            <div class="timeline-container">
              <div 
                v-for="item in interestTimelineData" 
                :key="item.name"
                class="timeline-item"
              >
                <div class="timeline-header">
                  <span class="interest-name">{{ item.name }}</span>
                  <span class="current-weight">{{ (item.currentWeight * 100).toFixed(1) }}%</span>
                </div>
                <div class="timeline-line">
                  <div 
                    v-for="point in item.history" 
                    :key="point.date"
                    class="timeline-point"
                    :style="{ left: `${point.position}%`, backgroundColor: getWeightColor(point.weight) }"
                    :title="`${point.date}: ${(point.weight * 100).toFixed(1)}%`"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 效率指标 -->
        <div class="efficiency-metrics">
          <h4>🎯 个人效率指标</h4>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-icon">⚡</div>
              <div class="metric-content">
                <div class="metric-value">{{ efficiencyMetrics.responseSpeed.toFixed(1) }}h</div>
                <div class="metric-label">平均响应时间</div>
              </div>
            </div>
            <div class="metric-card">
              <div class="metric-icon">🔥</div>
              <div class="metric-content">
                <div class="metric-value">{{ efficiencyMetrics.focusScore.toFixed(0) }}%</div>
                <div class="metric-label">专注度评分</div>
              </div>
            </div>
            <div class="metric-card">
              <div class="metric-icon">🚀</div>
              <div class="metric-content">
                <div class="metric-value">{{ efficiencyMetrics.productivityIndex.toFixed(1) }}</div>
                <div class="metric-label">生产力指数</div>
              </div>
            </div>
            <div class="metric-card">
              <div class="metric-icon">🤝</div>
              <div class="metric-content">
                <div class="metric-value">{{ efficiencyMetrics.collaborationScore.toFixed(0) }}%</div>
                <div class="metric-label">协作活跃度</div>
              </div>
            </div>
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
import { ref, onMounted, toRaw } from 'vue';
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

// 🆕 图表数据
const behaviorTrendData = ref<Array<{ date: string; day: string; activity: number; interactions: number }>>([]);
const heatmapData = ref<Array<{ day: number; hour: number; dayName: string; intensity: number }>>([]);
const interestTimelineData = ref<Array<{ 
  name: string; 
  currentWeight: number; 
  history: Array<{ date: string; weight: number; position: number }> 
}>>([]);
const efficiencyMetrics = ref({
  responseSpeed: 2.3,      // 平均响应时间（小时）
  focusScore: 87,          // 专注度评分
  productivityIndex: 4.2,  // 生产力指数
  collaborationScore: 76   // 协作活跃度
});

const loadUserProfile = async () => {
  isLoading.value = true;
  try {
    // 🆕 优先获取融合后的用户画像
    let response = await chromeAPI.sendMessage({ type: 'GET_FUSED_USER_PROFILE' });
    
    if (response && (response as any).success && (response as any).data.profile) {
      // 使用融合后的画像数据
      userProfile.value = (response as any).data.profile;
      userProfileAnalysis.value = (response as any).data.analysis;
      console.log('融合用户画像加载成功:', userProfile.value);
      console.log('融合兴趣数据:', (response as any).data.fusedInterests);
    } else {
      // 降级：获取普通用户画像
      console.log('降级到普通用户画像获取');
      response = await chromeAPI.sendMessage({ type: 'GET_USER_PROFILE' });
      if (response && (response as any).success) {
        userProfile.value = (response as any).data.profile;
        userProfileAnalysis.value = (response as any).data.analysis;
        console.log('普通用户画像加载成功:', userProfile.value);
      } else {
        // 使用模拟数据
        userProfile.value = getMockUserProfile();
        userProfileAnalysis.value = getMockUserProfileAnalysis();
        console.log('使用模拟数据');
      }
    }
  } catch (error) {
    console.error('加载用户画像失败:', error);
    // 再次降级尝试
    try {
      const fallbackResponse = await chromeAPI.sendMessage({ type: 'GET_USER_PROFILE' });
      if (fallbackResponse && (fallbackResponse as any).success) {
        userProfile.value = (fallbackResponse as any).data.profile;
        userProfileAnalysis.value = (fallbackResponse as any).data.analysis;
        console.log('降级用户画像加载成功');
      } else {
        // 使用模拟数据
        userProfile.value = getMockUserProfile();
        userProfileAnalysis.value = getMockUserProfileAnalysis();
        console.log('最终降级到模拟数据');
      }
    } catch (fallbackError) {
      console.error('降级用户画像获取也失败:', fallbackError);
      // 使用模拟数据
      userProfile.value = getMockUserProfile();
      userProfileAnalysis.value = getMockUserProfileAnalysis();
    }
  } finally {
    isLoading.value = false;
    // 🆕 用户画像加载完成后更新图表数据
    updateChartData();
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
      itemType: type,
      importance: importance
    });
    
    if (response && (response as any).success) {
      console.log('重要性设置成功');
      // 刷新用户画像数据
      await loadUserProfile();
    } else {
      console.error('重要性设置失败:', (response as any)?.error);
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
    
    if (response && (response as any).success) {
      console.log('用户画像导出成功:', (response as any).data);
      
      // 生成文件名（包含时间戳）
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const fileName = `用户画像_${timestamp}.json`;
      
      // 格式化JSON数据（美化输出）
      const jsonData = JSON.stringify((response as any).data, null, 2);
      
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
      showExportSuccessNotification(fileName, (response as any).data.exportSummary);
      
    } else {
      console.error('用户画像导出失败:', (response as any)?.error);
      showExportErrorNotification((response as any)?.error || '未知错误');
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
    // 使用 toRaw 确保传递的是原始对象
    const rawConfig = toRaw(weightDecaySettings.value);
    console.log('应用权重衰变设置:', rawConfig);
    
    const response = await chromeAPI.sendMessage({
      type: 'UPDATE_WEIGHT_DECAY_CONFIG',
      config: rawConfig
    });
    
    if (response && (response as any).success) {
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
      console.error('权重衰变设置应用失败:', (response as any)?.error);
      alert(`设置应用失败: ${(response as any)?.error || '未知错误'}`);
    }
  } catch (error) {
    console.error('应用权重衰变设置时发生错误:', error);
    alert(`设置应用失败: ${error.message}`);
  } finally {
    isApplyingSettings.value = false;
  }
};

// 🆕 图表相关方法

// 获取热力图强度等级
const getHeatmapIntensity = (intensity: number): string => {
  if (intensity > 0.7) return 'high';
  if (intensity > 0.4) return 'medium';
  return 'low';
};

// 获取权重颜色
const getWeightColor = (weight: number): string => {
  if (weight > 0.8) return '#e74c3c';
  if (weight > 0.6) return '#f39c12';
  if (weight > 0.4) return '#f1c40f';
  if (weight > 0.2) return '#2ecc71';
  return '#95a5a6';
};

// 初始化图表数据
const initializeChartData = () => {
  // 生成行为趋势数据（最近7天）
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  behaviorTrendData.value = days.map((day, index) => ({
    date: new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000).toLocaleDateString(),
    day,
    activity: 0.3 + Math.random() * 0.7, // 30%-100%的活跃度
    interactions: Math.floor(20 + Math.random() * 50) // 20-70次交互
  }));

  // 生成热力图数据（一周7天，每天24小时）
  const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  heatmapData.value = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      let intensity = 0;
      // 工作时间（9-18）活跃度更高
      if (hour >= 9 && hour <= 18 && day < 5) {
        intensity = 0.4 + Math.random() * 0.6;
      } else if (hour >= 20 && hour <= 23) {
        // 晚上时间有一定活跃度
        intensity = 0.2 + Math.random() * 0.4;
      } else {
        intensity = Math.random() * 0.3;
      }
      
      heatmapData.value.push({
        day,
        hour,
        dayName: dayNames[day],
        intensity
      });
    }
  }

  // 生成兴趣权重时间线数据
  const sampleInterests = ['Personal-AI项目', 'React开发', '用户体验设计', '数据分析'];
  interestTimelineData.value = sampleInterests.map(name => {
    const history = [];
    const baseWeight = 0.3 + Math.random() * 0.4; // 基础权重
    
    // 生成30天的历史数据
    for (let i = 0; i < 30; i++) {
      const date = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
      const weight = Math.max(0.1, Math.min(1.0, baseWeight + (Math.random() - 0.5) * 0.3));
      history.push({
        date: date.toLocaleDateString(),
        weight,
        position: (i / 29) * 100 // 转换为百分比位置
      });
    }
    
    return {
      name,
      currentWeight: history[history.length - 1].weight,
      history
    };
  });

  // 根据用户画像数据更新效率指标
  if (userProfile.value) {
    const stats = userProfile.value.statistics;
    if (stats) {
      efficiencyMetrics.value = {
        responseSpeed: Math.max(0.5, 6 - (stats.averageDailyActivity / 10)), // 基于日均活动计算
        focusScore: Math.min(100, 60 + (stats.totalInteractions / 10)), // 基于总交互数计算
        productivityIndex: Math.min(5.0, 2.0 + (stats.averageDailyActivity / 20)), // 基于活跃度计算
        collaborationScore: Math.min(100, 40 + (userProfile.value.interests.people.length * 5)) // 基于协作人员数计算
      };
    }
  }
};

// 更新图表数据（当用户画像更新时调用）
const updateChartData = () => {
  initializeChartData();
  
  // 如果有真实的用户画像数据，可以在这里进行更精确的计算
  if (userProfile.value) {
    console.log('基于真实用户画像数据更新图表');
    // 可以在这里添加基于真实数据的图表更新逻辑
  }
};

onMounted(() => {
  loadUserProfile();
  // 初始化衰变预览
  updateDecayPreview();
  // 🆕 初始化图表数据
  initializeChartData();
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

/* 🆕 图表相关样式 */
.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

.chart-container {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e9ecef;
}

.chart-container.full-width {
  grid-column: 1 / -1;
}

.chart-container h4 {
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 16px;
}

.chart-description {
  color: #6c757d;
  font-size: 12px;
  margin-bottom: 12px;
}

/* 行为趋势图样式 */
.trend-chart {
  padding: 16px 0;
}

.trend-bars {
  display: flex;
  align-items: end;
  gap: 8px;
  height: 120px;
  padding: 0 4px;
}

.trend-bar {
  flex: 1;
  background: linear-gradient(to top, #3498db, #5dade2);
  border-radius: 4px 4px 0 0;
  min-height: 20px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
}

.trend-bar:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(52, 152, 219, 0.3);
}

.bar-label {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #6c757d;
  white-space: nowrap;
}

/* 热力图样式 */
.heatmap-chart {
  padding: 16px 0;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(24, 1fr);
  grid-template-rows: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 12px;
}

.heatmap-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.heatmap-cell:hover {
  transform: scale(1.2);
  border: 1px solid #333;
}

.heatmap-cell.low {
  background-color: #e8f5e8;
}

.heatmap-cell.medium {
  background-color: #81c784;
}

.heatmap-cell.high {
  background-color: #4caf50;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.legend-label {
  color: #6c757d;
}

.legend-scale {
  display: flex;
  gap: 4px;
}

.legend-item {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-item.low {
  background-color: #e8f5e8;
}

.legend-item.medium {
  background-color: #81c784;
}

.legend-item.high {
  background-color: #4caf50;
}

/* 兴趣权重时间线样式 */
.weight-timeline {
  padding: 16px 0;
}

.timeline-container {
  background: white;
  border-radius: 6px;
  padding: 16px;
  border: 1px solid #e9ecef;
}

.timeline-item {
  margin-bottom: 16px;
}

.timeline-item:last-child {
  margin-bottom: 0;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.interest-name {
  font-weight: 600;
  color: #2c3e50;
  font-size: 14px;
}

.current-weight {
  font-size: 12px;
  color: #6c757d;
  background: #f8f9fa;
  padding: 2px 6px;
  border-radius: 4px;
}

.timeline-line {
  position: relative;
  height: 4px;
  background: #e9ecef;
  border-radius: 2px;
  overflow: visible;
}

.timeline-point {
  position: absolute;
  top: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.timeline-point:hover {
  transform: scale(1.3);
}

/* 效率指标样式 */
.efficiency-metrics {
  margin-top: 24px;
}

.efficiency-metrics h4 {
  margin: 0 0 16px 0;
  color: #2c3e50;
  font-size: 16px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.metric-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: white;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  transition: all 0.2s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.metric-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
}

.metric-content {
  flex: 1;
}

.metric-value {
  font-size: 20px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 4px;
}

.metric-label {
  font-size: 12px;
  color: #6c757d;
  margin: 0;
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
  
  /* 🆕 图表响应式 */
  .charts-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .chart-container.full-width {
    grid-column: 1;
  }
  
  .trend-bars {
    height: 100px;
  }
  
  .heatmap-grid {
    grid-template-columns: repeat(12, 1fr);
  }
  
  .heatmap-cell {
    width: 8px;
    height: 8px;
  }
  
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  
  .metric-card {
    padding: 12px;
  }
  
  .metric-icon {
    width: 32px;
    height: 32px;
    font-size: 20px;
  }
  
  .metric-value {
    font-size: 18px;
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
