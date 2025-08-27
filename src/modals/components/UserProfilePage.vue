<template>
  <div class="user-profile-section">
    <div class="profile-header">
      <h2>👤 用户画像分析</h2>
      <p>基于您的行为模式和兴趣偏好生成的个性化画像</p>
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
                v-for="(project, idx) in userProfileAnalysis.topInterests.projects" 
                :key="idx" 
                class="interest-item"
              >
                <span class="interest-icon">🚀</span>
                <span>{{ project }}</span>
              </div>
            </div>
          </div>
          
          <div class="interest-category">
            <h4>👥 人员</h4>
            <div class="interest-list">
              <div 
                v-for="(person, idx) in userProfileAnalysis.topInterests.people" 
                :key="idx" 
                class="interest-item"
              >
                <span class="interest-icon">👤</span>
                <span>{{ person }}</span>
              </div>
            </div>
          </div>
          
          <div class="interest-category">
            <h4>💡 主题</h4>
            <div class="interest-list">
              <div 
                v-for="(topic, idx) in userProfileAnalysis.topInterests.topics" 
                :key="idx" 
                class="interest-item"
              >
                <span class="interest-icon">💭</span>
                <span>{{ topic }}</span>
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
const userProfile = ref<UserProfile | null>(null);
const userProfileAnalysis = ref<UserProfileAnalysis | null>(null);

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

onMounted(() => {
  loadUserProfile();
});
</script>
