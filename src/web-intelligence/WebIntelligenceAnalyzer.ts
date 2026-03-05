/**
 * 网页智能分析器
 * 负责分析网页内容，识别与用户项目相关的信息
 *
 * Migrated from UserProfileManager to MemoryServiceClient HTTP backend.
 */

import { ChromeBuiltInAIAnalyzer } from './ChromeBuiltInAI';
import { getMemoryServiceClient, MemoryServiceClient } from '../services/MemoryServiceClient';

export interface PageContent {
  title: string;
  url: string;
  domain: string;
  mainContent: string;
  metadata: Record<string, any>;
  pageType: string;
  timestamp: number;
  wordCount: number;
  language: string;
}

export interface WebAnalysisResult {
  isRelevant: boolean;
  confidence: number;
  extractedInfo: {
    projects?: string[];
    people?: string[];
    deadlines?: Date[];
    actionItems?: string[];
    topics?: string[];
    technologies?: string[];
    organizations?: string[];
  };
  suggestedStorage: boolean;
  relevantContent: string;
  reasoning: string;
  categories: string[];
}

export interface DetailedAnalysisResult extends WebAnalysisResult {
  summary: string;
  keyInsights: string[];
  relationships: Array<{
    source: string;
    target: string;
    type: string;
    confidence: number;
  }>;
  actionableItems: Array<{
    type: 'task' | 'deadline' | 'follow_up' | 'decision';
    content: string;
    priority: 'high' | 'medium' | 'low';
    deadline?: Date;
    assignee?: string;
  }>;
  relevantMemories: Array<{
    id: string;
    similarity: number;
    snippet: string;
  }>;
}

interface AnalysisContext {
  userProjects: string[];
  userKeywords: string[];
  recentTopics: string[];
  organizationContext: string[];
  analysisHistory: Array<{
    url: string;
    relevance: number;
    timestamp: number;
  }>;
}

/**
 * Lightweight in-memory representation of user profile data retrieved
 * from the MemoryServiceClient, used only for analysis-context enrichment.
 */
interface UserProfileSnapshot {
  interests: {
    projects: Array<{ name: string; weight: number }>;
    topics: Array<{ name: string; weight: number }>;
    focusAreas: string[];
  };
}

export class WebIntelligenceAnalyzer {
  private analysisContext: AnalysisContext | null = null;
  private modelCache: Map<string, any> = new Map();
  private chromeAI: ChromeBuiltInAIAnalyzer;
  private client: MemoryServiceClient;
  private userProfileSnapshot: UserProfileSnapshot | null = null;

  constructor() {
    this.client = getMemoryServiceClient();
    this.loadAnalysisContext();
    this.chromeAI = new ChromeBuiltInAIAnalyzer();
    this.initializeUserProfile();
  }

  /**
   * 初始化用户画像 — fetches data from the Memory Service backend.
   */
  private async initializeUserProfile(): Promise<void> {
    try {
      const [, profileItemsResult] = await Promise.all([
        this.client.getUserCore(),
        this.client.getProfileItems({ limit: 100 }),
      ]);

      // Build a lightweight snapshot used for analysis enrichment
      const projects: Array<{ name: string; weight: number }> = [];
      const topics: Array<{ name: string; weight: number }> = [];
      const focusAreas: string[] = [];

      for (const item of profileItemsResult.items) {
        const name = item.itemKey || item.itemValue || '';
        const weight = item.confidence ?? item.salienceScore ?? 0.5;
        if (item.itemType === 'project') {
          projects.push({ name, weight });
        } else if (item.itemType === 'topic') {
          topics.push({ name, weight });
        } else if (item.itemType === 'technology' || item.itemType === 'focus_area') {
          focusAreas.push(name);
        }
      }

      this.userProfileSnapshot = { interests: { projects, topics, focusAreas } };

      console.log('用户画像初始化成功');
    } catch (error) {
      console.error('用户画像初始化失败:', error);
    }
  }

  /**
   * 加载分析上下文
   */
  private async loadAnalysisContext(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([
        'userProjects', 'userKeywords', 'recentTopics',
        'organizationContext', 'analysisHistory'
      ]);

      // 从存储获取基本上下文
      const baseContext = {
        userProjects: result.userProjects || [],
        userKeywords: result.userKeywords || [],
        recentTopics: result.recentTopics || [],
        organizationContext: result.organizationContext || [],
        analysisHistory: result.analysisHistory || []
      };

      // 从用户画像快照补充上下文
      if (this.userProfileSnapshot) {
        // 添加用户最关注的项目
        baseContext.userProjects = [
          ...new Set([
            ...baseContext.userProjects,
            ...this.userProfileSnapshot.interests.projects.map(p => p.name)
          ])
        ];

        // 添加用户关注的主题
        baseContext.recentTopics = [
          ...new Set([
            ...baseContext.recentTopics,
            ...this.userProfileSnapshot.interests.topics.map(t => t.name)
          ])
        ];

        // 添加专业领域作为关键词
        baseContext.userKeywords = [
          ...new Set([
            ...baseContext.userKeywords,
            ...this.userProfileSnapshot.interests.focusAreas
          ])
        ];
      }

      this.analysisContext = baseContext;
    } catch (error) {
      console.warn('Failed to load analysis context:', error);
      this.analysisContext = {
        userProjects: [],
        userKeywords: [],
        recentTopics: [],
        organizationContext: [],
        analysisHistory: []
      };
    }
  }

  /**
   * 快速分析网页内容（智能分层：Chrome AI → 规则引擎）
   */
  async quickAnalyze(pageContent: PageContent): Promise<WebAnalysisResult> {
    try {
      let result: WebAnalysisResult;

      // 优先尝试使用Chrome内置AI
      if (this.chromeAI.isAvailable()) {
        console.log('使用Chrome内置AI分析');
        result = await this.analyzeWithChromeAI(pageContent);
      } else {
        console.log('Chrome AI不可用，使用规则引擎');
        result = await this.analyzeWithRuleEngine(pageContent);
      }

      // 如果页面相关，更新用户画像
      if (result.isRelevant) {
        await this.updateUserProfileFromAnalysis(pageContent, result);
      }

      return result;

    } catch (error) {
      console.error('Quick analysis failed:', error);
      // Chrome AI失败时回退到规则引擎
      if (this.chromeAI.isAvailable()) {
        console.log('Chrome AI失败，回退到规则引擎');
        return await this.analyzeWithRuleEngine(pageContent);
      }
      return this.getDefaultResult();
    }
  }

  /**
   * 使用Chrome内置AI分析
   */
  private async analyzeWithChromeAI(pageContent: PageContent): Promise<WebAnalysisResult> {
    try {
      const startTime = Date.now();
      const chromeResult = await this.chromeAI.analyzeWithChromeAI(
        pageContent.mainContent,
        pageContent.title,
        pageContent.url
      );

      const processingTime = Date.now() - startTime;
      console.log(`Chrome AI分析完成 (${processingTime}ms)`);

      // 转换Chrome AI实体格式为标准格式
      const convertedEntities = this.convertChromeAIEntities(chromeResult.entities);

      return {
        isRelevant: chromeResult.relevance > 0.5,
        confidence: chromeResult.relevance,
        extractedInfo: convertedEntities,
        suggestedStorage: chromeResult.shouldStore,
        relevantContent: this.extractRelevantContent(pageContent, convertedEntities),
        reasoning: `Chrome AI分析 (${processingTime}ms): ${chromeResult.reasoning}`,
        categories: this.categorizeContent(pageContent, convertedEntities)
      };

    } catch (error) {
      console.error('Chrome AI analysis failed:', error);
      throw error;
    }
  }

  /**
   * 使用规则引擎分析（原有逻辑）
   */
  private async analyzeWithRuleEngine(pageContent: PageContent): Promise<WebAnalysisResult> {
    try {
      const startTime = Date.now();

      // 1. 基于规则的快速筛选
      const ruleBasedResult = this.ruleBasedAnalysis(pageContent);

      // 2. 关键词匹配分析
      const keywordResult = this.keywordAnalysis(pageContent);

      // 3. 实体提取
      const extractedInfo = this.extractBasicEntities(pageContent);

      // 4. 计算综合相关性得分
      const confidence = this.calculateConfidence(ruleBasedResult, keywordResult, extractedInfo);

      // 5. 生成推理说明
      const reasoning = this.generateReasoning(ruleBasedResult, keywordResult, extractedInfo);

      const processingTime = Date.now() - startTime;
      console.log(`规则引擎分析完成 (${processingTime}ms)`);

      return {
        isRelevant: confidence > 0.5,
        confidence,
        extractedInfo,
        suggestedStorage: confidence > 0.7,
        relevantContent: this.extractRelevantContent(pageContent, extractedInfo),
        reasoning: `规则引擎分析 (${processingTime}ms): ${reasoning}`,
        categories: this.categorizeContent(pageContent, extractedInfo)
      };

    } catch (error) {
      console.error('Rule engine analysis failed:', error);
      return this.getDefaultResult();
    }
  }

  /**
   * 深度分析网页内容（调用LLM）
   */
  async deepAnalyze(pageContent: PageContent): Promise<DetailedAnalysisResult> {
    try {
      // 首先进行快速分析
      const quickResult = await this.quickAnalyze(pageContent);

      // 准备LLM分析的上下文
      const analysisPrompt = this.buildAnalysisPrompt(pageContent, quickResult);

      // 调用LLM进行深度分析
      const llmResult = await this.callLLMForAnalysis(analysisPrompt);

      // 查找相关记忆
      const relevantMemories = await this.findRelevantMemories(pageContent.mainContent);

      // 合并结果
      return {
        ...quickResult,
        summary: llmResult.summary,
        keyInsights: llmResult.keyInsights,
        relationships: llmResult.relationships,
        actionableItems: llmResult.actionableItems,
        relevantMemories
      };

    } catch (error) {
      console.error('Deep analysis failed:', error);

      // 返回快速分析结果作为后备
      const quickResult = await this.quickAnalyze(pageContent);
      return {
        ...quickResult,
        summary: '深度分析暂时不可用，显示基础分析结果',
        keyInsights: [],
        relationships: [],
        actionableItems: [],
        relevantMemories: []
      };
    }
  }

  /**
   * 基于规则的分析
   */
  private ruleBasedAnalysis(pageContent: PageContent): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    // URL模式匹配
    const urlPatterns = {
      jira: /jira.*\/browse\//i,
      confluence: /confluence/i,
      github: /github\.com/i,
      docs: /docs\.google\.com/i,
      slack: /slack\.com/i,
      notion: /notion\.so/i
    };

    for (const [platform, pattern] of Object.entries(urlPatterns)) {
      if (pattern.test(pageContent.url)) {
        score += 0.3;
        reasons.push(`检测到${platform}平台`);
        break;
      }
    }

    // 页面类型相关性
    const relevantPageTypes = ['jira', 'confluence', 'github', 'google_docs', 'technical_doc'];
    if (relevantPageTypes.includes(pageContent.pageType)) {
      score += 0.2;
      reasons.push(`页面类型相关: ${pageContent.pageType}`);
    }

    // 内容长度检查
    if (pageContent.wordCount > 100 && pageContent.wordCount < 10000) {
      score += 0.1;
      reasons.push('内容长度适中');
    }

    // 元数据检查
    if (pageContent.metadata.description) {
      score += 0.1;
      reasons.push('包含页面描述');
    }

    return { score: Math.min(score, 1), reasons };
  }

  /**
   * 关键词匹配分析
   */
  private keywordAnalysis(pageContent: PageContent): { score: number; matches: string[] } {
    if (!this.analysisContext) {
      return { score: 0, matches: [] };
    }

    const content = (pageContent.title + ' ' + pageContent.mainContent).toLowerCase();
    const matches: string[] = [];
    let score = 0;

    // 项目关键词匹配
    for (const project of this.analysisContext.userProjects) {
      if (content.includes(project.toLowerCase())) {
        // 检查用户画像快照中的项目权重
        let weight = 0.3;
        if (this.userProfileSnapshot) {
          const profileProject = this.userProfileSnapshot.interests.projects.find(
            p => p.name.toLowerCase() === project.toLowerCase()
          );
          if (profileProject) {
            // 根据用户画像中的权重调整得分
            weight = 0.3 * (0.5 + profileProject.weight * 0.5);
          }
        }
        matches.push(`项目: ${project}`);
        score += weight;
      }
    }

    // 用户关键词匹配
    for (const keyword of this.analysisContext.userKeywords) {
      if (content.includes(keyword.toLowerCase())) {
        matches.push(`关键词: ${keyword}`);
        score += 0.2;
      }
    }

    // 最近话题匹配
    for (const topic of this.analysisContext.recentTopics) {
      if (content.includes(topic.toLowerCase())) {
        matches.push(`话题: ${topic}`);
        score += 0.15;
      }
    }

    // 组织上下文匹配
    for (const org of this.analysisContext.organizationContext) {
      if (content.includes(org.toLowerCase())) {
        matches.push(`组织: ${org}`);
        score += 0.1;
      }
    }

    return { score: Math.min(score, 1), matches };
  }

  /**
   * 提取基础实体
   */
  private extractBasicEntities(pageContent: PageContent): WebAnalysisResult['extractedInfo'] {
    const content = pageContent.title + ' ' + pageContent.mainContent;
    const extractedInfo: WebAnalysisResult['extractedInfo'] = {};

    // 提取人名（简单模式）
    const peoplePatterns = [
      /([A-Z][a-z]+ [A-Z][a-z]+)/g, // 英文姓名
      /([\u4e00-\u9fff]{2,4})/g      // 中文姓名
    ];

    const people = new Set<string>();
    for (const pattern of peoplePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (match.length > 1 && match.length < 20) {
            people.add(match.trim());
          }
        });
      }
    }
    extractedInfo.people = Array.from(people).slice(0, 10);

    // 提取项目名称
    const projectPatterns = [
      /项目[：:]\s*([^\n\r,，。.]{2,30})/g,
      /project[：:]\s*([^\n\r,，。.]{2,30})/gi,
      /([A-Z][A-Z0-9_-]{2,20})/g // 项目代号
    ];

    const projects = new Set<string>();
    for (const pattern of projectPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleaned = match.replace(/项目[：:]|project[：:]/gi, '').trim();
          if (cleaned.length > 1) {
            projects.add(cleaned);
          }
        });
      }
    }
    extractedInfo.projects = Array.from(projects).slice(0, 10);

    // 提取日期和截止时间
    const datePatterns = [
      /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/g,
      /(\d{1,2}[-/]\d{1,2}[-/]\d{4})/g,
      /(截止|deadline|due).*?(\d{4}[-/]\d{1,2}[-/]\d{1,2})/gi
    ];

    const dates = new Set<string>();
    for (const pattern of datePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const dateMatch = match.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}/);
          if (dateMatch) {
            dates.add(dateMatch[0]);
          }
        });
      }
    }
    extractedInfo.deadlines = Array.from(dates).map(date => new Date(date)).filter(date => !isNaN(date.getTime()));

    // 提取行动项
    const actionPatterns = [
      /(TODO|待办|需要|要求|应该).*?[。.!！\n]/gi,
      /action.*?item.*?[：:]\s*([^\n\r]{5,100})/gi
    ];

    const actionItems = new Set<string>();
    for (const pattern of actionPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleaned = match.replace(/TODO|待办|需要|要求|应该|action.*?item.*?[：:]/gi, '').trim();
          if (cleaned.length > 5) {
            actionItems.add(cleaned);
          }
        });
      }
    }
    extractedInfo.actionItems = Array.from(actionItems).slice(0, 5);

    // 提取技术相关词汇
    const techKeywords = [
      'API', 'SDK', 'JavaScript', 'Python', 'React', 'Vue', 'Angular',
      'Node.js', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP',
      'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch'
    ];

    const technologies = new Set<string>();
    const contentUpper = content.toUpperCase();
    for (const tech of techKeywords) {
      if (contentUpper.includes(tech.toUpperCase())) {
        technologies.add(tech);
      }
    }
    extractedInfo.technologies = Array.from(technologies);

    // 提取主题
    const topicPatterns = [
      /(会议|meeting).*?主题[：:]\s*([^\n\r]{5,50})/gi,
      /(讨论|discuss).*?([^\n\r]{5,50})/gi,
      /关于\s*([^\n\r]{5,50})/g
    ];

    const topics = new Set<string>();
    for (const pattern of topicPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const topicMatch = match.match(/[：:]\s*([^\n\r]{5,50})/);
          if (topicMatch) {
            topics.add(topicMatch[1].trim());
          }
        });
      }
    }
    extractedInfo.topics = Array.from(topics).slice(0, 5);

    return extractedInfo;
  }

  /**
   * 计算综合置信度
   */
  private calculateConfidence(
    ruleResult: { score: number; reasons: string[] },
    keywordResult: { score: number; matches: string[] },
    extractedInfo: WebAnalysisResult['extractedInfo']
  ): number {
    let confidence = 0;

    // 规则得分权重 40%
    confidence += ruleResult.score * 0.4;

    // 关键词得分权重 30%
    confidence += keywordResult.score * 0.3;

    // 实体提取得分权重 30%
    let entityScore = 0;
    if (extractedInfo.projects && extractedInfo.projects.length > 0) entityScore += 0.3;
    if (extractedInfo.people && extractedInfo.people.length > 0) entityScore += 0.2;
    if (extractedInfo.deadlines && extractedInfo.deadlines.length > 0) entityScore += 0.2;
    if (extractedInfo.actionItems && extractedInfo.actionItems.length > 0) entityScore += 0.2;
    if (extractedInfo.technologies && extractedInfo.technologies.length > 0) entityScore += 0.1;

    confidence += Math.min(entityScore, 1) * 0.3;

    return Math.min(confidence, 1);
  }

  /**
   * 生成推理说明
   */
  private generateReasoning(
    ruleResult: { score: number; reasons: string[] },
    keywordResult: { score: number; matches: string[] },
    extractedInfo: WebAnalysisResult['extractedInfo']
  ): string {
    const reasons: string[] = [];

    if (ruleResult.reasons.length > 0) {
      reasons.push(`页面特征: ${ruleResult.reasons.join(', ')}`);
    }

    if (keywordResult.matches.length > 0) {
      reasons.push(`关键词匹配: ${keywordResult.matches.join(', ')}`);
    }

    const entityReasons: string[] = [];
    if (extractedInfo.projects && extractedInfo.projects.length > 0) {
      entityReasons.push(`${extractedInfo.projects.length}个项目`);
    }
    if (extractedInfo.people && extractedInfo.people.length > 0) {
      entityReasons.push(`${extractedInfo.people.length}个人员`);
    }
    if (extractedInfo.deadlines && extractedInfo.deadlines.length > 0) {
      entityReasons.push(`${extractedInfo.deadlines.length}个时间点`);
    }
    if (extractedInfo.actionItems && extractedInfo.actionItems.length > 0) {
      entityReasons.push(`${extractedInfo.actionItems.length}个行动项`);
    }

    if (entityReasons.length > 0) {
      reasons.push(`实体识别: ${entityReasons.join(', ')}`);
    }

    return reasons.length > 0 ? reasons.join('; ') : '基于页面内容的综合评估';
  }

  /**
   * 提取相关内容片段
   */
  private extractRelevantContent(pageContent: PageContent, extractedInfo: WebAnalysisResult['extractedInfo']): string {
    const content = pageContent.mainContent;
    const relevantSentences: string[] = [];

    // 包含实体的句子
    const sentences = content.split(/[。.!！\n]/);

    for (const sentence of sentences) {
      if (sentence.trim().length < 10) continue;

      let isRelevant = false;

      // 检查是否包含提取的实体
      if (extractedInfo.projects) {
        for (const project of extractedInfo.projects) {
          if (sentence.includes(project)) {
            isRelevant = true;
            break;
          }
        }
      }

      if (!isRelevant && extractedInfo.people) {
        for (const person of extractedInfo.people) {
          if (sentence.includes(person)) {
            isRelevant = true;
            break;
          }
        }
      }

      if (!isRelevant && extractedInfo.actionItems) {
        for (const action of extractedInfo.actionItems) {
          if (sentence.includes(action.substring(0, 10))) {
            isRelevant = true;
            break;
          }
        }
      }

      if (isRelevant) {
        relevantSentences.push(sentence.trim());
      }
    }

    // 如果没有找到相关句子，返回前几段
    if (relevantSentences.length === 0) {
      const paragraphs = content.split('\n').filter(p => p.trim().length > 20);
      return paragraphs.slice(0, 3).join('\n').substring(0, 500);
    }

    return relevantSentences.slice(0, 5).join(' ').substring(0, 500);
  }

  /**
   * 内容分类
   */
  private categorizeContent(pageContent: PageContent, extractedInfo: WebAnalysisResult['extractedInfo']): string[] {
    const categories: string[] = [];

    // 基于页面类型
    if (pageContent.pageType !== 'general') {
      categories.push(pageContent.pageType);
    }

    // 基于内容特征
    if (extractedInfo.projects && extractedInfo.projects.length > 0) {
      categories.push('项目相关');
    }

    if (extractedInfo.deadlines && extractedInfo.deadlines.length > 0) {
      categories.push('时间敏感');
    }

    if (extractedInfo.actionItems && extractedInfo.actionItems.length > 0) {
      categories.push('行动导向');
    }

    if (extractedInfo.technologies && extractedInfo.technologies.length > 0) {
      categories.push('技术文档');
    }

    // 基于URL分析
    if (pageContent.url.includes('jira')) {
      categories.push('任务管理');
    } else if (pageContent.url.includes('confluence')) {
      categories.push('知识文档');
    } else if (pageContent.url.includes('github')) {
      categories.push('代码仓库');
    }

    return Array.from(new Set(categories));
  }

  /**
   * 根据分析结果更新用户画像 — uses MemoryServiceClient.createProfileItem
   * to record discovered interests for each entity category.
   */
  private async updateUserProfileFromAnalysis(
    pageContent: PageContent,
    analysisResult: WebAnalysisResult
  ): Promise<void> {
    try {
      const extractedInfo = analysisResult.extractedInfo;

      // Helper to create a profile item for a discovered entity
      const recordInterest = async (type: string, name: string, weight: number) => {
        try {
          await this.client.createProfileItem({
            itemType: type,
            itemKey: name,
            itemValue: JSON.stringify({
              source: pageContent.domain,
              url: pageContent.url,
              title: pageContent.title,
              analysisConfidence: analysisResult.confidence,
              discoveredAt: Date.now(),
            }),
            confidence: weight,
          });
        } catch (err) {
          // Non-critical — log and continue
          console.warn(`Failed to record interest ${type}/${name}:`, err);
        }
      };

      // 更新项目兴趣
      if (extractedInfo.projects) {
        for (const project of extractedInfo.projects) {
          await recordInterest('project', project, analysisResult.confidence * 0.2);
        }
      }

      // 更新人员兴趣
      if (extractedInfo.people) {
        for (const person of extractedInfo.people) {
          await recordInterest('person', person, analysisResult.confidence * 0.15);
        }
      }

      // 更新技术兴趣
      if (extractedInfo.technologies) {
        for (const tech of extractedInfo.technologies) {
          await recordInterest('technology', tech, analysisResult.confidence * 0.1);
        }
      }

      // 更新主题兴趣
      if (extractedInfo.topics) {
        for (const topic of extractedInfo.topics) {
          await recordInterest('topic', topic, analysisResult.confidence * 0.15);
        }
      }

      console.log('用户画像已更新');
    } catch (error) {
      console.error('更新用户画像失败:', error);
    }
  }

  /**
   * 构建LLM分析提示
   */
  private buildAnalysisPrompt(pageContent: PageContent, quickResult: WebAnalysisResult): string {
    return `
请分析以下网页内容，识别其与项目管理和工作相关的信息：

**页面信息:**
- 标题: ${pageContent.title}
- URL: ${pageContent.url}
- 页面类型: ${pageContent.pageType}

**内容摘要:**
${pageContent.mainContent.substring(0, 2000)}

**已识别的实体:**
- 项目: ${quickResult.extractedInfo.projects?.join(', ') || '无'}
- 人员: ${quickResult.extractedInfo.people?.join(', ') || '无'}
- 时间: ${quickResult.extractedInfo.deadlines?.map(d => d.toLocaleDateString()).join(', ') || '无'}
- 行动项: ${quickResult.extractedInfo.actionItems?.join('; ') || '无'}

**用户上下文:**
- 关注项目: ${this.analysisContext?.userProjects.join(', ') || '无'}
- 关键词: ${this.analysisContext?.userKeywords.join(', ') || '无'}

请提供以下分析结果（JSON格式）：
{
  "summary": "内容的简短摘要（100字以内）",
  "keyInsights": ["关键洞察1", "关键洞察2", "关键洞察3"],
  "relationships": [
    {
      "source": "实体1",
      "target": "实体2",
      "type": "关系类型",
      "confidence": 0.8
    }
  ],
  "actionableItems": [
    {
      "type": "task|deadline|follow_up|decision",
      "content": "具体内容",
      "priority": "high|medium|low",
      "deadline": "2024-01-01" (可选),
      "assignee": "负责人" (可选)
    }
  ]
}
`;
  }

  /**
   * 调用LLM进行分析
   */
  private async callLLMForAnalysis(prompt: string): Promise<any> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'LLM_ANALYSIS_REQUEST',
        prompt: prompt,
        model: 'gpt-4',
        maxTokens: 1000
      });

      if (response.success) {
        return JSON.parse(response.content);
      } else {
        throw new Error(response.error || 'LLM analysis failed');
      }
    } catch (error) {
      console.error('LLM analysis error:', error);
      return {
        summary: '分析暂时不可用',
        keyInsights: [],
        relationships: [],
        actionableItems: []
      };
    }
  }

  /**
   * 查找相关记忆 — uses MemoryServiceClient.recall for semantic search.
   */
  private async findRelevantMemories(content: string): Promise<DetailedAnalysisResult['relevantMemories']> {
    try {
      const recallResult = await this.client.recall(content.substring(0, 500), {
        topK: 5,
        channels: ['vector', 'fts'],
      });

      return recallResult.items.map(item => ({
        id: item.id,
        similarity: item.score,
        snippet: item.content.substring(0, 200),
      }));
    } catch (error) {
      console.error('Memory search error:', error);
    }

    return [];
  }

  /**
   * 获取默认分析结果
   */
  private getDefaultResult(): WebAnalysisResult {
    return {
      isRelevant: false,
      confidence: 0,
      extractedInfo: {},
      suggestedStorage: false,
      relevantContent: '',
      reasoning: '分析失败',
      categories: []
    };
  }

  /**
   * 更新分析上下文
   */
  async updateAnalysisContext(updates: Partial<AnalysisContext>): Promise<void> {
    if (!this.analysisContext) {
      await this.loadAnalysisContext();
    }

    this.analysisContext = { ...this.analysisContext!, ...updates };

    try {
      await chrome.storage.local.set({
        userProjects: this.analysisContext.userProjects,
        userKeywords: this.analysisContext.userKeywords,
        recentTopics: this.analysisContext.recentTopics,
        organizationContext: this.analysisContext.organizationContext,
        analysisHistory: this.analysisContext.analysisHistory
      });
    } catch (error) {
      console.error('Failed to save analysis context:', error);
    }
  }

  /**
   * 记录分析历史
   */
  async recordAnalysisHistory(url: string, relevance: number): Promise<void> {
    if (!this.analysisContext) {
      await this.loadAnalysisContext();
    }

    this.analysisContext!.analysisHistory.unshift({
      url,
      relevance,
      timestamp: Date.now()
    });

    // 只保留最近100条记录
    this.analysisContext!.analysisHistory = this.analysisContext!.analysisHistory.slice(0, 100);

    await this.updateAnalysisContext({
      analysisHistory: this.analysisContext!.analysisHistory
    });
  }

  /**
   * 转换Chrome AI实体格式为标准格式
   */
  private convertChromeAIEntities(chromeEntities: any): WebAnalysisResult['extractedInfo'] {
    const convertedEntities: WebAnalysisResult['extractedInfo'] = {};

    if (chromeEntities.projects) {
      convertedEntities.projects = chromeEntities.projects;
    }
    if (chromeEntities.people) {
      convertedEntities.people = chromeEntities.people;
    }
    if (chromeEntities.deadlines) {
      // 转换字符串日期为Date对象
      convertedEntities.deadlines = chromeEntities.deadlines.map((dateStr: string) => {
        try {
          return new Date(dateStr);
        } catch (error) {
          // 如果解析失败，尝试智能解析
          return this.parseSmartDate(dateStr);
        }
      }).filter((date: Date | null) => date && !isNaN(date.getTime())) as Date[];
    }
    if (chromeEntities.actions) {
      // Chrome AI返回actions，转换为actionItems
      convertedEntities.actionItems = chromeEntities.actions;
    }
    if (chromeEntities.technologies) {
      convertedEntities.technologies = chromeEntities.technologies;
    }
    if (chromeEntities.topics) {
      convertedEntities.topics = chromeEntities.topics;
    }
    if (chromeEntities.organizations) {
      convertedEntities.organizations = chromeEntities.organizations;
    }

    return convertedEntities;
  }

  /**
   * 智能日期解析
   */
  private parseSmartDate(dateStr: string): Date | null {
    const now = new Date();
    const lowerStr = dateStr.toLowerCase();

    if (lowerStr.includes('明天')) {
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else if (lowerStr.includes('后天')) {
      return new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    } else if (lowerStr.includes('下周')) {
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (lowerStr.includes('下个月')) {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      return nextMonth;
    } else if (lowerStr.includes('本月底')) {
      return new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    // 尝试标准日期解析
    try {
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取Chrome AI状态信息
   */
  getChromeAIStatus(): any {
    return {
      isAvailable: this.chromeAI.isAvailable(),
      capabilities: this.chromeAI.getCapabilities(),
      usageStats: this.chromeAI.getUsageStats()
    };
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (this.chromeAI) {
      this.chromeAI.destroy();
    }
  }
}

export default WebIntelligenceAnalyzer;
