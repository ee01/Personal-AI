/**
 * 智能网页分析集成器
 * 将Chrome AI分析结果集成到agentThinking工作流
 */

import { WebIntelligenceAnalyzer, PageContent, WebAnalysisResult } from './WebIntelligenceAnalyzer';
import { IntelligentAgent } from '../agentThinking';
import { WebpageAnalysisInput, WebpageAnalysisResult, AnalysisConfig } from '../interfaces/analysisInterfaces';
import { ChromeAIAnalysisResult } from './ChromeBuiltInAI';

export interface WebIntelligenceIntegrationConfig {
  /** 是否启用Chrome AI预分析 */
  enableChromeAI: boolean;
  
  /** Chrome AI相关性阈值，超过此值才进行深度分析 */
  chromeAIRelevanceThreshold: number;
  
  /** agentThinking分析配置 */
  agentConfig: Partial<AnalysisConfig>;
  
  /** 用户上下文信息 */
  userContext?: {
    currentProjects?: string[];
    concernedTopics?: string[];
    teamMembers?: string[];
  };
}

export interface IntegratedAnalysisResult {
  /** 快速分析结果 */
  quickAnalysis: WebAnalysisResult;
  
  /** 深度分析结果（可选，当relevance足够高时才进行） */
  deepAnalysis?: WebpageAnalysisResult;
  
  /** 分析流程统计 */
  analysisFlow: {
    chromeAIUsed: boolean;
    deepAnalysisTriggered: boolean;
    totalProcessingTime: number;
    chromeAITime?: number;
    agentThinkingTime?: number;
  };
  
  /** 最终决策 */
  finalDecision: {
    shouldStore: boolean;
    shouldNotify: boolean;
    confidence: number;
    reasoning: string;
  };
}

/**
 * 智能网页分析集成器
 * 协调Chrome AI和agentThinking的工作流
 */
export class WebIntelligenceIntegrator {
  private webAnalyzer: WebIntelligenceAnalyzer;
  private intelligentAgent: IntelligentAgent;
  
  constructor() {
    this.webAnalyzer = new WebIntelligenceAnalyzer();
    this.intelligentAgent = new IntelligentAgent();
  }

  /**
   * 主要的集成分析方法
   * 从网页内容到最终决策的完整流程
   */
  async analyzeWebpage(
    pageContent: PageContent,
    config: WebIntelligenceIntegrationConfig
  ): Promise<IntegratedAnalysisResult> {
    const startTime = Date.now();
    let chromeAITime: number | undefined;
    let agentThinkingTime: number | undefined;
    
    console.log('🚀 开始集成网页分析:', pageContent.title);

    try {
      // 第一阶段：快速分析（Chrome AI + 规则引擎）
      const chromeAIStartTime = Date.now();
      const quickAnalysis = await this.webAnalyzer.quickAnalyze(pageContent);
      chromeAITime = Date.now() - chromeAIStartTime;
      
      console.log(`⚡ 快速分析完成 (${chromeAITime}ms):`, {
        isRelevant: quickAnalysis.isRelevant,
        confidence: quickAnalysis.confidence,
        suggestedStorage: quickAnalysis.suggestedStorage
      });

      // 检查是否需要进行深度分析
      const shouldDeepAnalyze = this.shouldTriggerDeepAnalysis(quickAnalysis, config);
      
      let deepAnalysis: WebpageAnalysisResult | undefined;
      
      if (shouldDeepAnalyze) {
        console.log('🧠 触发深度分析...');
        
        // 第二阶段：深度分析（agentThinking）
        const agentStartTime = Date.now();
        deepAnalysis = await this.performDeepAnalysis(pageContent, quickAnalysis, config);
        agentThinkingTime = Date.now() - agentStartTime;
        
        console.log(`🎯 深度分析完成 (${agentThinkingTime}ms):`, {
          contentRelevance: deepAnalysis.contentRelevance,
          shouldStore: deepAnalysis.shouldStore,
          shouldNotify: deepAnalysis.shouldNotify
        });
      }

      // 第三阶段：综合决策
      const finalDecision = this.makeFinalDecision(quickAnalysis, deepAnalysis);
      
      const totalTime = Date.now() - startTime;
      
      const result: IntegratedAnalysisResult = {
        quickAnalysis,
        deepAnalysis,
        analysisFlow: {
          chromeAIUsed: quickAnalysis.reasoning.includes('Chrome AI'),
          deepAnalysisTriggered: !!deepAnalysis,
          totalProcessingTime: totalTime,
          chromeAITime,
          agentThinkingTime
        },
        finalDecision
      };

      console.log(`✅ 集成分析完成 (${totalTime}ms):`, finalDecision);
      return result;

    } catch (error) {
      console.error('❌ 集成分析失败:', error);
      
      // 返回失败的默认结果
      return {
        quickAnalysis: {
          isRelevant: false,
          confidence: 0,
          extractedInfo: {},
          suggestedStorage: false,
          relevantContent: [],
          reasoning: `集成分析失败: ${error.message}`,
          categories: []
        },
        analysisFlow: {
          chromeAIUsed: false,
          deepAnalysisTriggered: false,
          totalProcessingTime: Date.now() - startTime
        },
        finalDecision: {
          shouldStore: false,
          shouldNotify: false,
          confidence: 0,
          reasoning: '分析失败，跳过存储和通知'
        }
      };
    }
  }

  /**
   * 判断是否需要触发深度分析
   */
  private shouldTriggerDeepAnalysis(
    quickAnalysis: WebAnalysisResult,
    config: WebIntelligenceIntegrationConfig
  ): boolean {
    // 1. 如果快速分析认为不相关，直接跳过深度分析
    if (!quickAnalysis.isRelevant) {
      console.log('⏭️ 快速分析认为不相关，跳过深度分析');
      return false;
    }

    // 2. 检查confidence阈值
    if (quickAnalysis.confidence < config.chromeAIRelevanceThreshold) {
      console.log(`⏭️ 置信度${quickAnalysis.confidence}低于阈值${config.chromeAIRelevanceThreshold}，跳过深度分析`);
      return false;
    }

    // 3. 如果建议存储，触发深度分析
    if (quickAnalysis.suggestedStorage) {
      console.log('✅ 建议存储，触发深度分析');
      return true;
    }

    // 4. 如果提取到重要实体，触发深度分析
    const hasImportantEntities = 
      (quickAnalysis.extractedInfo.projects && quickAnalysis.extractedInfo.projects.length > 0) ||
      (quickAnalysis.extractedInfo.deadlines && quickAnalysis.extractedInfo.deadlines.length > 0) ||
      (quickAnalysis.extractedInfo.actionItems && quickAnalysis.extractedInfo.actionItems.length > 0);
    
    if (hasImportantEntities) {
      console.log('✅ 检测到重要实体，触发深度分析');
      return true;
    }

    console.log('⏭️ 不满足深度分析条件，跳过');
    return false;
  }

  /**
   * 执行深度分析
   */
  private async performDeepAnalysis(
    pageContent: PageContent,
    quickAnalysis: WebAnalysisResult,
    config: WebIntelligenceIntegrationConfig
  ): Promise<WebpageAnalysisResult> {
    // 构建Chrome AI结果（用于传递给agentThinking）
    const chromeAIResult = this.convertToChroMeAIResult(quickAnalysis);
    
    // 构建agentThinking输入
    const webpageInput: WebpageAnalysisInput = {
      title: pageContent.title,
      url: pageContent.url,
      domain: pageContent.domain,
      mainContent: pageContent.mainContent,
      metadata: pageContent.metadata,
      chromeAIResult,
      userContext: config.userContext
    };

    // 构建分析配置
    const analysisConfig: AnalysisConfig = {
      type: 'webpage',
      analysisDepth: 'normal',
      maxActions: 3,
      preferredTools: ['entityExtraction', 'historySearch'],
      ...config.agentConfig
    };

    // 调用agentThinking进行深度分析
    const result = await this.intelligentAgent.analyze(webpageInput, analysisConfig);
    
    if (result.type !== 'webpage') {
      throw new Error('agentThinking返回了错误的结果类型');
    }
    
    return result as WebpageAnalysisResult;
  }

  /**
   * 将WebAnalysisResult转换为ChromeAIAnalysisResult格式
   */
  private convertToChroMeAIResult(quickAnalysis: WebAnalysisResult): ChromeAIAnalysisResult {
    return {
      relevance: quickAnalysis.confidence,
      shouldStore: quickAnalysis.suggestedStorage,
      entities: {
        projects: quickAnalysis.extractedInfo.projects || [],
        people: quickAnalysis.extractedInfo.people || [],
        deadlines: quickAnalysis.extractedInfo.deadlines?.map(d => d.toISOString()) || [],
        actions: quickAnalysis.extractedInfo.actionItems || [],
        technologies: quickAnalysis.extractedInfo.technologies || [],
        topics: quickAnalysis.extractedInfo.topics || [],
        organizations: quickAnalysis.extractedInfo.organizations || []
      },
      reasoning: quickAnalysis.reasoning,
      summary: quickAnalysis.relevantContent.join(' '),
      keyInsights: quickAnalysis.categories,
      actionableItems: quickAnalysis.extractedInfo.actionItems || []
    };
  }

  /**
   * 综合快速分析和深度分析结果，做出最终决策
   */
  private makeFinalDecision(
    quickAnalysis: WebAnalysisResult,
    deepAnalysis?: WebpageAnalysisResult
  ): IntegratedAnalysisResult['finalDecision'] {
    
    // 如果有深度分析结果，以深度分析为准
    if (deepAnalysis) {
      return {
        shouldStore: deepAnalysis.shouldStore,
        shouldNotify: deepAnalysis.shouldNotify,
        confidence: deepAnalysis.confidence,
        reasoning: `深度分析决策: ${deepAnalysis.summary}`
      };
    }
    
    // 否则使用快速分析结果
    return {
      shouldStore: quickAnalysis.suggestedStorage,
      shouldNotify: false, // 快速分析不触发通知
      confidence: quickAnalysis.confidence,
      reasoning: `快速分析决策: ${quickAnalysis.reasoning}`
    };
  }

  /**
   * 获取Chrome AI状态
   */
  getChromeAIStatus() {
    return this.webAnalyzer.getChromeAIStatus();
  }

  /**
   * 手动触发深度分析（用于测试或特殊情况）
   */
  async forceDeepAnalysis(
    pageContent: PageContent,
    config: WebIntelligenceIntegrationConfig
  ): Promise<WebpageAnalysisResult> {
    console.log('🔧 手动触发深度分析');
    
    const quickAnalysis = await this.webAnalyzer.quickAnalyze(pageContent);
    return await this.performDeepAnalysis(pageContent, quickAnalysis, config);
  }

  /**
   * 批量分析多个网页
   */
  async analyzeBatch(
    pages: PageContent[],
    config: WebIntelligenceIntegrationConfig,
    onProgress?: (result: IntegratedAnalysisResult, index: number) => void
  ): Promise<IntegratedAnalysisResult[]> {
    const results: IntegratedAnalysisResult[] = [];
    
    for (let i = 0; i < pages.length; i++) {
      const result = await this.analyzeWebpage(pages[i], config);
      results.push(result);
      
      if (onProgress) {
        onProgress(result, i);
      }
    }
    
    return results;
  }

  /**
   * 销毁集成器，清理资源
   */
  destroy(): void {
    if (this.webAnalyzer && typeof this.webAnalyzer.destroy === 'function') {
      this.webAnalyzer.destroy();
    }
  }
}

export default WebIntelligenceIntegrator;