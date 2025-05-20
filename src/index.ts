/**
 * 主导出文件
 * 导出所有公共API组件和函数
 */

// 旧版智能Agent导出 - 注意：这里需要根据实际存在的导出内容进行调整
export { 
  processMessage, 
  registerTool, 
  getToolDescriptions 
} from './intelligentAgent';

// 新版智能Agent导出
export {
  IntelligentAgentNext,
  intelligentAgentNext,
  processMessageCompatible,
  MessageProcessResult
} from './IntelligentAgentNext';

// 分析接口导出
export {
  BaseAnalysisResult,
  MessageAnalysisResult,
  ProjectAnalysisResult,
  MeetingAnalysisResult,
  DocumentAnalysisResult,
  GenericAnalysisResult,
  AnalysisResult,
  AnalysisConfig,
  AnalysisContext,
  ThoughtStep
} from './interfaces/analysisInterfaces';

// 工具适配器导出
export {
  toolAdapter,
  getToolList,
  getToolDetails,
  runTool,
  ToolDescription,
  ToolExecution
} from './agentToolAdapter';

// 其他核心功能导出
// 注意：根据实际存在的模块调整以下导出内容
export * from './background';
export * from './messageDealing';
export * from './utils';
export * from './llm';
export * from './vectorStore';

/**
 * Google Slides分析器主入口
 */

// 导出核心功能
export {
  getProjectsFromSlide,
  applyProjectUpdates,
  getAuthToken,
  getPresentationIdFromUrl,
  getCurrentSlideIdFromUrl,
  type ProjectData,
  type ProjectUpdateSuggestion
} from './slide';

// 导出分析器接口
export {
  type SlideContentAnalyzer,
  type SlideAnalysisResult,
  SlideContentType,
  ProjectStructureType,
  type TableContentAnalyzer,
  type TextContentAnalyzer,
  type SlideAnalyzerFactory,
  type ElementReference
} from './interfaces/slideAnalyzer';

// 导出分析器基类
export { BaseSlideAnalyzer } from './analyzers/baseAnalyzer';

// 导出分析器工厂
export { SlideAnalyzerFactoryImpl } from './analyzers/analyzerFactory';

// 导出具体分析器实现
export { TableContentAnalyzerImpl } from './analyzers/tableAnalyzer';
export { TextContentAnalyzerImpl } from './analyzers/textAnalyzer';
export { LLMContentAnalyzer } from './analyzers/llmAnalyzer';

/**
 * 创建项目分析器
 * @param options 分析器选项
 * @returns 项目分析功能集合
 */
export function createProjectAnalyzer(options?: {
  useLLMFallback?: boolean;
  minConfidence?: number;
}) {
  /**
   * 分析幻灯片项目
   * @param presentationId 演示文稿ID
   * @param token 验证token
   * @param slideId 可选的幻灯片ID
   * @param currentUrl 当前URL
   * @returns 项目数据数组
   */
  const analyzeSlide = async (
    presentationId: string,
    token: string,
    slideId?: string,
    currentUrl?: string
  ) => {
    // 使用静态导入以避免加载问题
    const { getProjectsFromSlide } = await import('./slide');
    return getProjectsFromSlide(presentationId, token, slideId, currentUrl, options);
  };
  
  /**
   * 应用项目更新
   * @param presentationId 演示文稿ID
   * @param token 验证token
   * @param updates 更新内容
   * @returns 更新结果
   */
  const applyUpdates = async (
    presentationId: string,
    token: string,
    updates: import('./slide').ProjectUpdateSuggestion[]
  ) => {
    // 使用静态导入以避免加载问题
    const { applyProjectUpdates } = await import('./slide');
    return applyProjectUpdates(presentationId, token, updates);
  };
  
  /**
   * 获取验证token
   * @returns 验证token
   */
  const getToken = async () => {
    // 使用静态导入以避免加载问题
    const { getAuthToken } = await import('./slide');
    return getAuthToken();
  };
  
  return {
    analyzeSlide,
    applyUpdates,
    getToken
  };
} 