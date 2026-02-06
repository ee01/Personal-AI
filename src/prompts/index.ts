/**
 * Prompts 模块索引文件
 * 
 * 统一管理所有 LLM Prompt 模板，方便导入和维护
 */

// 消息分析相关
export {
    buildMessageFilterSystemPrompt,
    buildLLMReviewPrompt
} from './messageAnalysis';

// 实体提取相关
export {
    buildEntityExtractionPrompt,
    buildQueryIntentAnalysisPrompt
} from './entityExtraction';

// 自动答复相关
export {
    buildAutoReplyPrompt
} from './autoReply';
