/**
 * 幻灯片分析器工厂实现
 */

import { GoogleSlide } from '../interfaces/googleSlides';
import { 
  SlideAnalyzerFactory, 
  SlideContentAnalyzer, 
  SlideContentType
} from '../interfaces/slideAnalyzer';
import { BaseSlideAnalyzer } from './baseAnalyzer';
import { TableContentAnalyzerImpl } from './tableAnalyzer';
import { TextContentAnalyzerImpl } from './textAnalyzer';
import { LLMContentAnalyzer } from './llmAnalyzer';

/**
 * 分析器工厂类
 * 根据幻灯片内容类型创建合适的分析器
 */
export class SlideAnalyzerFactoryImpl implements SlideAnalyzerFactory {
  private readonly analyzerCache: Map<string, SlideContentAnalyzer> = new Map();
  private readonly useLLMFallback: boolean = false; // 是否使用LLM作为后备分析器
  
  /**
   * 构造函数
   * @param options 可选的配置选项
   */
  constructor(options?: { useLLMFallback?: boolean }) {
    if (options) {
      this.useLLMFallback = options.useLLMFallback || false;
    }
  }
  
  /**
   * 创建适合幻灯片内容的分析器
   * @param slide 幻灯片对象
   * @returns 适合的内容分析器
   */
  public createAnalyzer(slide: GoogleSlide): SlideContentAnalyzer {
    // 如果缓存中已有此幻灯片的分析器，直接返回
    if (slide.objectId && this.analyzerCache.has(slide.objectId)) {
      return this.analyzerCache.get(slide.objectId)!;
    }
    
    // 创建所有可用的分析器，按优先级排序
    const availableAnalyzers: SlideContentAnalyzer[] = [
      new TableContentAnalyzerImpl(),
      new TextContentAnalyzerImpl()
    ];
    
    // 如果启用了LLM后备，添加LLM分析器（最低优先级）
    if (this.useLLMFallback) {
      availableAnalyzers.push(new LLMContentAnalyzer());
    }
    
    // 查找能处理此幻灯片的分析器
    for (const analyzer of availableAnalyzers) {
      if (analyzer.canHandle(slide)) {
        // 缓存并返回找到的分析器
        if (slide.objectId) {
          this.analyzerCache.set(slide.objectId, analyzer);
        }
        return analyzer;
      }
    }
    
    // 如果没有找到，优先使用LLM分析器（如果启用），否则使用默认分析器
    const defaultAnalyzer = this.useLLMFallback 
      ? new LLMContentAnalyzer() 
      : availableAnalyzers[0];
      
    if (slide.objectId) {
      this.analyzerCache.set(slide.objectId, defaultAnalyzer);
    }
    return defaultAnalyzer;
  }
  
  /**
   * 清除分析器缓存
   */
  public clearCache(): void {
    this.analyzerCache.clear();
  }
} 