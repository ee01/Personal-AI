/**
 * Chrome 内置AI接口集成
 * 利用Chrome的Gemini Nano本地模型进行网页内容分析
 */

// Chrome AI API类型定义
interface ChromeAI {
  languageModel: {
    capabilities(): Promise<AICapabilities>;
    create(options?: AISessionOptions): Promise<AISession>;
  };
  summarizer?: {
    capabilities(): Promise<AISummarizerCapabilities>;
    create(options?: AISummarizerCreateOptions): Promise<AISummarizer>;
  };
  translator?: {
    capabilities(): Promise<AITranslatorCapabilities>;
    create(options?: AITranslatorCreateOptions): Promise<AITranslator>;
  };
  languageDetector?: {
    capabilities(): Promise<AILanguageDetectorCapabilities>;
    create(): Promise<AILanguageDetector>;
  };
  writer?: {
    capabilities(): Promise<AIWriterCapabilities>;
    create(options?: AIWriterCreateOptions): Promise<AIWriter>;
  };
}

interface AICapabilities {
  available: 'readily' | 'after-download' | 'no';
  defaultTopK?: number;
  maxTopK?: number;
  defaultTemperature?: number;
}

interface AISessionOptions {
  topK?: number;
  temperature?: number;
  systemPrompt?: string;
}

interface AISession {
  prompt(input: string): Promise<string>;
  promptStreaming(input: string): ReadableStream;
  destroy(): void;
}

interface AISummarizerCapabilities {
  available: 'readily' | 'after-download' | 'no';
  type?: 'text' | 'key-points' | 'tl;dr' | 'teaser' | 'headline';
  length?: 'short' | 'medium' | 'long';
}

interface AISummarizer {
  summarize(input: string): Promise<string>;
  summarizeStreaming(input: string): ReadableStream;
  destroy(): void;
}

// 扩展Window接口
declare global {
  interface Window {
    ai?: ChromeAI;
    chrome?: {
      ai?: ChromeAI;
    };
  }
}

/**
 * Chrome内置AI分析器
 * 结合本地Gemini Nano模型和规则引擎进行智能分析
 */
export class ChromeBuiltInAIAnalyzer {
  private aiSession: AISession | null = null;
  private summarizer: AISummarizer | null = null;
  private capabilities: AICapabilities | null = null;
  private isInitialized = false;
  private fallbackToRules = true;

  constructor() {
    this.initialize();
  }

  /**
   * 初始化Chrome AI
   */
  async initialize(): Promise<void> {
    try {
      console.log('🧠 初始化Chrome内置AI...');
      
      // 检查Chrome AI可用性
      const ai = window.ai || window.chrome?.ai;
      if (!ai) {
        console.warn('⚠️ Chrome AI API不可用，将使用规则引擎');
        this.fallbackToRules = true;
        return;
      }

      // 检查能力
      this.capabilities = await ai.languageModel.capabilities();
      console.log('🔍 Chrome AI能力检查:', this.capabilities);

      if (this.capabilities.available === 'readily') {
        // 创建语言模型会话
        this.aiSession = await ai.languageModel.create({
          temperature: 0.3,
          topK: 3,
          systemPrompt: `你是一个专业的网页内容分析专家。你的任务是：
1. 分析网页内容的项目相关性（0-1分）
2. 提取关键信息：项目名称、人员、截止日期、行动项
3. 判断内容是否值得存储到知识库
4. 提供简洁的分析理由

请用JSON格式返回结果，包含：
{
  "relevance": 0.8,
  "shouldStore": true,
  "entities": {
    "projects": ["项目名称"],
    "people": ["人员"],
    "deadlines": ["日期"],
    "actions": ["行动项"]
  },
  "reasoning": "分析理由"
}`
        });

        // 尝试创建摘要器
        if (ai.summarizer) {
          try {
            const summarizerCaps = await ai.summarizer.capabilities();
            if (summarizerCaps.available === 'readily') {
              this.summarizer = await ai.summarizer.create({
                type: 'key-points',
                length: 'medium'
              });
              console.log('✅ Chrome AI摘要器已启用');
            }
          } catch (error) {
            console.warn('⚠️ 摘要器初始化失败:', error);
          }
        }

        this.fallbackToRules = false;
        this.isInitialized = true;
        console.log('✅ Chrome内置AI初始化成功');

        // 运行测试验证
        await this.runInitializationTest();

      } else if (this.capabilities.available === 'after-download') {
        console.log('📥 Chrome AI需要下载模型，请稍候...');
        // 可以提示用户等待模型下载
        await this.waitForModelDownload();
        
      } else {
        console.warn('❌ Chrome AI在此设备上不可用');
        this.fallbackToRules = true;
      }

    } catch (error) {
      console.error('❌ Chrome AI初始化失败:', error);
      this.fallbackToRules = true;
    }
  }

  /**
   * 等待模型下载完成
   */
  private async waitForModelDownload(): Promise<void> {
    const maxWaitTime = 5 * 60 * 1000; // 最多等待5分钟
    const checkInterval = 10000; // 每10秒检查一次
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const ai = window.ai || window.chrome?.ai;
        if (ai) {
          const caps = await ai.languageModel.capabilities();
          if (caps.available === 'readily') {
            console.log('✅ Chrome AI模型下载完成');
            await this.initialize();
            return;
          }
        }
      } catch (error) {
        // 忽略检查错误
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    console.warn('⏰ Chrome AI模型下载超时，使用规则引擎');
    this.fallbackToRules = true;
  }

  /**
   * 运行初始化测试
   */
  private async runInitializationTest(): Promise<void> {
    if (!this.aiSession) return;

    try {
      const testPrompt = '分析以下内容的项目相关性：这是一个关于React开发的技术博客';
      const result = await this.aiSession.prompt(testPrompt);
      console.log('🧪 Chrome AI测试结果:', result);
    } catch (error) {
      console.warn('⚠️ Chrome AI测试失败，回退到规则引擎:', error);
      this.fallbackToRules = true;
    }
  }

  /**
   * 使用Chrome AI分析网页内容
   */
  async analyzeWithChromeAI(content: string, title: string, url: string): Promise<ChromeAIAnalysisResult> {
    if (!this.isInitialized || !this.aiSession || this.fallbackToRules) {
      throw new Error('Chrome AI not available');
    }

    try {
      const analysisPrompt = `分析以下网页内容的项目相关性：

标题: ${title}
URL: ${url}
内容: ${content.substring(0, 1500)}

请根据以下标准评估：
1. 是否与项目管理、软件开发、团队协作相关？
2. 是否包含具体的项目信息、任务、人员、时间节点？
3. 内容质量是否值得保存到知识库？

请用JSON格式返回分析结果。`;

      const response = await this.aiSession.prompt(analysisPrompt);
      
      // 解析AI响应
      const parsedResult = this.parseAIResponse(response);
      
      return {
        success: true,
        relevance: parsedResult.relevance || 0,
        shouldStore: parsedResult.shouldStore || false,
        entities: parsedResult.entities || {},
        reasoning: parsedResult.reasoning || 'Chrome AI分析结果',
        model: 'gemini-nano',
        processingTime: Date.now()
      };

    } catch (error) {
      console.error('Chrome AI分析失败:', error);
      throw error;
    }
  }

  /**
   * 使用Chrome AI生成内容摘要
   */
  async summarizeWithChromeAI(content: string): Promise<string> {
    if (this.summarizer) {
      try {
        return await this.summarizer.summarize(content);
      } catch (error) {
        console.warn('Chrome AI摘要失败:', error);
      }
    }

    // 回退到Prompt API进行摘要
    if (this.aiSession) {
      try {
        const summaryPrompt = `请为以下内容生成简洁的摘要（不超过200字）：\n\n${content.substring(0, 2000)}`;
        return await this.aiSession.prompt(summaryPrompt);
      } catch (error) {
        console.error('Chrome AI摘要失败:', error);
        throw error;
      }
    }

    throw new Error('Chrome AI summarizer not available');
  }

  /**
   * 流式分析（实时响应）
   */
  async analyzeStreaming(content: string, title: string, url: string): Promise<ReadableStream> {
    if (!this.isInitialized || !this.aiSession || this.fallbackToRules) {
      throw new Error('Chrome AI not available');
    }

    const analysisPrompt = `分析网页内容的项目相关性：

标题: ${title}
URL: ${url}
内容: ${content.substring(0, 1500)}

请提供详细的分析过程和结果。`;

    return this.aiSession.promptStreaming(analysisPrompt);
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(response: string): any {
    try {
      // 尝试提取JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // 如果不是JSON格式，尝试解析文本
      return this.parseTextResponse(response);
    } catch (error) {
      console.warn('AI响应解析失败:', error);
      return {
        relevance: this.extractRelevanceFromText(response),
        shouldStore: response.toLowerCase().includes('应该') || response.toLowerCase().includes('值得'),
        entities: {},
        reasoning: response
      };
    }
  }

  /**
   * 从文本响应中提取相关性分数
   */
  private extractRelevanceFromText(text: string): number {
    const scoreMatches = text.match(/(\d+(?:\.\d+)?)\s*分|(\d+(?:\.\d+)?)%|相关性[：:]\s*(\d+(?:\.\d+)?)/);
    if (scoreMatches) {
      const score = parseFloat(scoreMatches[1] || scoreMatches[2] || scoreMatches[3]);
      return scoreMatches[2] ? score / 100 : score; // 如果是百分比，转换为0-1
    }
    
    // 基于关键词推断
    if (text.includes('非常相关') || text.includes('高度相关')) return 0.9;
    if (text.includes('相关') || text.includes('有关')) return 0.7;
    if (text.includes('可能相关') || text.includes('部分相关')) return 0.5;
    if (text.includes('不相关') || text.includes('无关')) return 0.1;
    
    return 0.5; // 默认中等相关性
  }

  /**
   * 解析文本格式的响应
   */
  private parseTextResponse(text: string): any {
    const result: any = {
      relevance: this.extractRelevanceFromText(text),
      shouldStore: false,
      entities: {},
      reasoning: text
    };

    // 提取项目名称
    const projectMatches = text.match(/项目[：:]?\s*([^\s,，。]{2,20})/g);
    if (projectMatches) {
      result.entities.projects = projectMatches.map(match => 
        match.replace(/项目[：:]?\s*/, '').trim()
      );
    }

    // 提取人员
    const peopleMatches = text.match(/@([a-zA-Z0-9\u4e00-\u9fa5]{2,20})|([^\s,，。]{2,10})\s*[负责开发设计]/g);
    if (peopleMatches) {
      result.entities.people = peopleMatches.map(match => 
        match.replace(/@|负责|开发|设计/g, '').trim()
      );
    }

    // 判断是否应该存储
    result.shouldStore = result.relevance > 0.6 || 
                        text.includes('应该保存') || 
                        text.includes('值得记录');

    return result;
  }

  /**
   * 检查Chrome AI是否可用
   */
  isAvailable(): boolean {
    return this.isInitialized && !this.fallbackToRules;
  }

  /**
   * 获取AI能力信息
   */
  getCapabilities(): AICapabilities | null {
    return this.capabilities;
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (this.aiSession) {
      this.aiSession.destroy();
      this.aiSession = null;
    }
    if (this.summarizer) {
      this.summarizer.destroy();
      this.summarizer = null;
    }
    this.isInitialized = false;
  }

  /**
   * 获取使用统计
   */
  getUsageStats(): ChromeAIUsageStats {
    return {
      isEnabled: this.isAvailable(),
      model: 'gemini-nano',
      capabilities: this.capabilities,
      sessionActive: !!this.aiSession,
      summarizerAvailable: !!this.summarizer,
      fallbackMode: this.fallbackToRules
    };
  }
}

// 接口定义
export interface ChromeAIAnalysisResult {
  success: boolean;
  relevance: number;
  shouldStore: boolean;
  entities: {
    projects?: string[];
    people?: string[];
    deadlines?: string[];
    actions?: string[];
  };
  reasoning: string;
  model: string;
  processingTime: number;
}

export interface ChromeAIUsageStats {
  isEnabled: boolean;
  model: string;
  capabilities: AICapabilities | null;
  sessionActive: boolean;
  summarizerAvailable: boolean;
  fallbackMode: boolean;
}

/**
 * Chrome AI功能检测工具
 */
export class ChromeAIDetector {
  /**
   * 检测Chrome AI支持情况
   */
  static async detectSupport(): Promise<ChromeAISupportInfo> {
    const support: ChromeAISupportInfo = {
      hasAPI: false,
      promptAPI: false,
      summarizerAPI: false,
      translatorAPI: false,
      writerAPI: false,
      chromeVersion: '',
      requirements: {
        minVersion: '127.0.0.0',
        requiresFlags: true,
        platformSupport: ['Windows', 'macOS', 'Linux'],
        minRAM: '4GB',
        minStorage: '22GB'
      }
    };

    try {
      // 检测Chrome版本
      const userAgent = navigator.userAgent;
      const chromeVersionMatch = userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
      if (chromeVersionMatch) {
        support.chromeVersion = chromeVersionMatch[1];
      }

      // 检测API可用性
      const ai = window.ai || window.chrome?.ai;
      if (ai) {
        support.hasAPI = true;

        // 检测各个API
        if (ai.languageModel) {
          try {
            const caps = await ai.languageModel.capabilities();
            support.promptAPI = caps.available !== 'no';
          } catch (error) {
            support.promptAPI = false;
          }
        }

        if (ai.summarizer) {
          try {
            const caps = await ai.summarizer.capabilities();
            support.summarizerAPI = caps.available !== 'no';
          } catch (error) {
            support.summarizerAPI = false;
          }
        }

        if (ai.translator) {
          try {
            const caps = await ai.translator.capabilities();
            support.translatorAPI = caps.available !== 'no';
          } catch (error) {
            support.translatorAPI = false;
          }
        }

        if (ai.writer) {
          try {
            const caps = await ai.writer.capabilities();
            support.writerAPI = caps.available !== 'no';
          } catch (error) {
            support.writerAPI = false;
          }
        }
      }

    } catch (error) {
      console.error('Chrome AI支持检测失败:', error);
    }

    return support;
  }

  /**
   * 生成启用指南
   */
  static generateEnableGuide(): ChromeAIEnableGuide {
    return {
      steps: [
        {
          step: 1,
          title: '安装Chrome Canary',
          description: '下载并安装Chrome Canary (版本 127+)',
          url: 'https://www.google.com/chrome/canary/'
        },
        {
          step: 2,
          title: '启用实验性功能',
          description: '在地址栏输入以下URL并启用相应功能：',
          flags: [
            {
              url: 'chrome://flags/#optimization-guide-on-device-model',
              setting: 'Enabled BypassPerfRequirement'
            },
            {
              url: 'chrome://flags/#prompt-api-for-gemini-nano',
              setting: 'Enabled'
            }
          ]
        },
        {
          step: 3,
          title: '重启Chrome',
          description: '启用标志后重启Chrome浏览器'
        },
        {
          step: 4,
          title: '下载模型',
          description: '访问 chrome://components，找到"Optimization Guide On Device Model"并点击"Check for update"'
        },
        {
          step: 5,
          title: '验证安装',
          description: '在开发者控制台运行：(await window.ai?.languageModel.capabilities()).available'
        }
      ],
      troubleshooting: [
        {
          issue: '模型下载失败',
          solution: '确保有足够的存储空间（22GB+）和网络连接'
        },
        {
          issue: 'API不可用',
          solution: '检查Chrome版本和实验性标志设置'
        },
        {
          issue: '性能问题',
          solution: '确保设备有足够的RAM（4GB+）和GPU支持'
        }
      ]
    };
  }
}

export interface ChromeAISupportInfo {
  hasAPI: boolean;
  promptAPI: boolean;
  summarizerAPI: boolean;
  translatorAPI: boolean;
  writerAPI: boolean;
  chromeVersion: string;
  requirements: {
    minVersion: string;
    requiresFlags: boolean;
    platformSupport: string[];
    minRAM: string;
    minStorage: string;
  };
}

export interface ChromeAIEnableGuide {
  steps: Array<{
    step: number;
    title: string;
    description: string;
    url?: string;
    flags?: Array<{
      url: string;
      setting: string;
    }>;
  }>;
  troubleshooting: Array<{
    issue: string;
    solution: string;
  }>;
}

export default ChromeBuiltInAIAnalyzer;