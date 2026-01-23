/**
 * Google Slides API操作工具
 * 用于读取和更新Google Slides内容
 */

// Google Slides API参考: https://developers.google.com/slides/api/reference/rest
import {
  GooglePresentation,
  GoogleSlide,
  SlidesBatchUpdateResponse
} from './interfaces/googleSlides';

// 静态导入分析器相关模块，避免动态加载问题
import { SlideAnalyzerFactoryImpl } from './analyzers/analyzerFactory';
import { LLMContentAnalyzer } from './analyzers/llmAnalyzer';
import { JiraTicket } from './types';

/**
 * 项目数据接口定义
 */
export interface ProjectData {
  id: string;              // 项目ID或Jira工单号
  name: string;            // 项目名称
  status: string;          // 当前状态
  owner: string;           // 负责人
  track?: string;          // 所属赛道
  comments?: string;       // 备注/行动项
  description?: string;    // 项目描述
  slideElementId?: string; // 幻灯片元素ID
  row?: number;            // 表格行号
  slideId?: string;        // 幻灯片ID
  tableId?: string;        // 表格ID
  columnIndices?: {        // 各列索引
    status?: number;
    description?: number;
    owner?: number;
    track?: number;
    comments?: number;
  };
  [key: string]: any;      // 支持其他动态属性
}

/**
 * 项目更新建议接口
 */
export interface ProjectUpdateSuggestion {
  projectId: string;
  projectName: string;
  currentStatus: string;
  suggestedStatus?: string;
  suggestedStatusReason?: string;
  currentOwner: string;
  suggestedOwner?: string;
  suggestedOwnerReason?: string;
  currentTrack?: string;
  suggestedTrack?: string;
  suggestedTrackReason?: string;
  currentComments?: string;
  suggestedComments?: string;
  suggestedCommentsReason?: string;
  reason: string[];
  sourceInfo: {
    jiraIssues?: JiraTicket[];
    chatHistory?: Array<{
      content: string;
      source: string;
      timestamp: string;
    }>;
  };
  confidence: number;
  slideId?: string;
  tableId?: string;
  rowIndex?: number;
  columnIndices?: {
    status?: number;
    owner?: number;
    track?: number;
    comments?: number;
  };
}

/**
 * 从URL获取演示文稿ID
 * @param url Google Slides URL
 * @returns 演示文稿ID
 */
export function getPresentationIdFromUrl(url: string): string {
  const match = url.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  throw new Error('无法从URL获取演示文稿ID');
}

/**
 * 从URL获取当前幻灯片ID
 * @param url Google Slides URL
 * @returns 当前幻灯片ID或undefined
 */
export function getCurrentSlideIdFromUrl(url: string): string | undefined {
  // 例如：https://docs.google.com/presentation/d/1AbCdEfG123456/edit#slide=id.g123456abcde_0_123
  const match = url.match(/slide=id\.([a-zA-Z0-9_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return undefined;
}

/**
 * 从Google Slides获取表格数据
 * @param presentationId Google Slides演示文稿ID
 * @param token OAuth token
 * @param slideId 可选的特定幻灯片ID，不提供则获取当前幻灯片或所有幻灯片
 * @param currentUrl 当前URL，用于提取当前幻灯片ID
 * @param options 可选的配置选项
 * @returns 包含项目数据的数组
 */
export async function getProjectsFromSlide(
  presentationId: string, 
  token: string,
  slideId?: string,
  currentUrl?: string,
  options?: {
    useLLMFallback?: boolean;  // 是否在常规分析失败时使用LLM
    minConfidence?: number;    // 最小置信度阈值
  }
): Promise<ProjectData[]> {
  try {
    // 使用静态导入的工厂
    const analyzerFactory = new SlideAnalyzerFactoryImpl({
      useLLMFallback: options?.useLLMFallback || false
    });
    
    // 首先获取演示文稿内容
    const presentationData = await fetchPresentationData(presentationId, token);
    
    // 如果没有提供slideId，尝试从URL获取当前幻灯片ID
    let currentSlideId: string | undefined;
    if (!slideId && currentUrl) {
      currentSlideId = getCurrentSlideIdFromUrl(currentUrl);
    }
    
    // 决定处理哪些幻灯片
    let slidesToProcess = presentationData.slides;
    
    // 优先使用传入的slideId
    if (slideId) {
      slidesToProcess = presentationData.slides.filter((slide: GoogleSlide) => slide.objectId === slideId);
    } 
    // 其次使用从URL解析的当前幻灯片ID
    else if (currentSlideId) {
      slidesToProcess = presentationData.slides.filter((slide: GoogleSlide) => slide.objectId === currentSlideId);
    }
    
    if (!slidesToProcess || slidesToProcess.length === 0) {
      console.warn('未找到幻灯片内容');
      return [];
    }
    
    console.log('需要处理的目标slide数量: ', slidesToProcess.length);

    // 保存分析结果
    const allProjects: ProjectData[] = [];
    const warnings: string[] = [];
    
    // 设置最小置信度阈值
    const minConfidence = options?.minConfidence || 0.3;
    
    // 分析每个幻灯片
    for (const slide of slidesToProcess) {
      try {
        console.log(`开始分析幻灯片: ${slide.objectId}`);
        
        // 使用工厂创建合适的分析器
        const analyzer = analyzerFactory.createAnalyzer(slide);
        
        // 分析幻灯片
        const analysisResult = await analyzer.analyze(slide);
        
        console.log(`分析完成: 找到${analysisResult.projects.length}个项目，置信度${analysisResult.confidence.toFixed(2)}`);
        
        // 检查置信度是否达到阈值
        if (analysisResult.confidence < minConfidence) {
          warnings.push(`[幻灯片 ${slide.objectId}] 分析置信度(${analysisResult.confidence.toFixed(2)})低于阈值，结果可能不准确`);
          
          // 如果启用了LLM后备且当前不是LLM分析器，尝试使用LLM
          if (options?.useLLMFallback && !(analyzer instanceof LLMContentAnalyzer)) {
            try {
              console.log(`尝试使用LLM分析幻灯片: ${slide.objectId}`);
              const llmAnalyzer = new LLMContentAnalyzer();
              const llmResult = await llmAnalyzer.analyze(slide);
              
              // 如果LLM分析结果更好，使用LLM结果
              if (llmResult.confidence > analysisResult.confidence) {
                console.log(`LLM分析结果更好: 置信度${llmResult.confidence.toFixed(2)} > ${analysisResult.confidence.toFixed(2)}`);
                Object.assign(analysisResult, llmResult);
              }
            } catch (llmError) {
              console.error(`LLM分析失败: ${llmError instanceof Error ? llmError.message : String(llmError)}`);
            }
          }
        }
        
        // 添加幻灯片ID到项目数据
        const slideProjects = analysisResult.projects.map(project => ({
          ...project,
          slideId: slide.objectId
        }));
        
        // 合并项目数据
        allProjects.push(...slideProjects);
        
        // 收集警告
        if (analysisResult.warnings && analysisResult.warnings.length > 0) {
          warnings.push(...analysisResult.warnings.map(w => `[幻灯片 ${slide.objectId}] ${w}`));
        }
      } catch (error) {
        console.error(`分析幻灯片 ${slide.objectId} 时出错:`, error);
        warnings.push(`[幻灯片 ${slide.objectId}] 分析失败: ${error instanceof Error ? error.message : String(error)}`);
        
        // 如果启用了LLM后备，尝试使用LLM作为最后的补救措施
        if (options?.useLLMFallback) {
          try {
            console.log(`尝试使用LLM分析失败的幻灯片: ${slide.objectId}`);
            const llmAnalyzer = new LLMContentAnalyzer();
            const llmResult = await llmAnalyzer.analyze(slide);
            
            // 添加幻灯片ID到项目数据
            const slideProjects = llmResult.projects.map(project => ({
              ...project,
              slideId: slide.objectId
            }));
            
            // 添加LLM分析结果
            allProjects.push(...slideProjects);
            
            console.log(`LLM分析成功: 找到${llmResult.projects.length}个项目，置信度${llmResult.confidence.toFixed(2)}`);
            
            // 添加LLM警告
            if (llmResult.warnings && llmResult.warnings.length > 0) {
              warnings.push(...llmResult.warnings.map(w => `[幻灯片 ${slide.objectId}] ${w}`));
            }
          } catch (llmError) {
            console.error(`LLM分析也失败: ${llmError instanceof Error ? llmError.message : String(llmError)}`);
          }
        }
      }
    }
    
    // 输出警告（如果有）
    if (warnings.length > 0) {
      console.warn('幻灯片分析警告:', warnings);
    }
    
    return allProjects;
  } catch (error) {
    console.error('获取幻灯片项目数据失败:', error);
    throw error;
  }
}

/**
 * 应用项目更新到Google Slides
 * @param presentationId Google Slides演示文稿ID
 * @param token OAuth token
 * @param updates 要应用的更新数组
 * @returns 更新结果
 */
export async function applyProjectUpdates(
  presentationId: string,
  token: string,
  updates: ProjectUpdateSuggestion[]
): Promise<{ success: boolean; updatedCount: number; errors?: string[] }> {
  try {
    // 准备批量更新请求
    const requests = [];
    const errors = [];
    let updatedFieldCount = 0;
    
    for (const update of updates) {
      // 确保有必要的定位信息
      if (!update.slideId || !update.tableId || update.rowIndex === undefined) {
        errors.push(`缺少更新位置信息: ${update.projectId} - ${update.projectName}`);
        continue;
      }
      
      // 添加状态更新请求
      if (update.suggestedStatus && update.columnIndices?.status !== undefined) {
        try {
          // 删除文本请求
          requests.push({
            deleteText: {
              objectId: update.tableId,
              cellLocation: {
                rowIndex: update.rowIndex,
                columnIndex: update.columnIndices.status
              }
            }
          });
          
          // 插入文本请求
          requests.push({
            insertText: {
              objectId: update.tableId,
              cellLocation: {
                rowIndex: update.rowIndex,
                columnIndex: update.columnIndices.status
              },
              text: update.suggestedStatus
            }
          });
          
          updatedFieldCount++;
          console.log(`准备更新项目 "${update.projectName}" 的状态: ${update.currentStatus} -> ${update.suggestedStatus}`);
        } catch (error) {
          const errorMsg = `更新状态失败 (${update.projectId}): ${error instanceof Error ? error.message : String(error)}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
      
      // 添加负责人更新请求
      if (update.suggestedOwner && update.columnIndices?.owner !== undefined) {
        try {
          // 删除文本请求
          requests.push({
            deleteText: {
              objectId: update.tableId,
              cellLocation: {
                rowIndex: update.rowIndex,
                columnIndex: update.columnIndices.owner
              }
            }
          });
          
          // 插入文本请求
          requests.push({
            insertText: {
              objectId: update.tableId,
              cellLocation: {
                rowIndex: update.rowIndex,
                columnIndex: update.columnIndices.owner
              },
              text: update.suggestedOwner
            }
          });
          
          updatedFieldCount++;
          console.log(`准备更新项目 "${update.projectName}" 的负责人: ${update.currentOwner} -> ${update.suggestedOwner}`);
        } catch (error) {
          const errorMsg = `更新负责人失败 (${update.projectId}): ${error instanceof Error ? error.message : String(error)}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
      
      // 添加赛道更新请求
      if (update.suggestedTrack && update.columnIndices?.track !== undefined) {
        try {
          // 删除文本请求
          requests.push({
            deleteText: {
              objectId: update.tableId,
              cellLocation: {
                rowIndex: update.rowIndex,
                columnIndex: update.columnIndices.track
              }
            }
          });
          
          // 插入文本请求
          requests.push({
            insertText: {
              objectId: update.tableId,
              cellLocation: {
                rowIndex: update.rowIndex,
                columnIndex: update.columnIndices.track
              },
              text: update.suggestedTrack
            }
          });
          
          updatedFieldCount++;
          console.log(`准备更新项目 "${update.projectName}" 的赛道: ${update.currentTrack || '空'} -> ${update.suggestedTrack}`);
        } catch (error) {
          const errorMsg = `更新赛道失败 (${update.projectId}): ${error instanceof Error ? error.message : String(error)}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
      
      // 添加备注更新请求
      if (update.suggestedComments && update.columnIndices?.comments !== undefined) {
        try {
          // 检查是否是添加而不是完全替换
          const finalText = update.currentComments 
            ? `${update.currentComments}\n${update.suggestedComments}`
            : update.suggestedComments;
          
          // 删除文本请求
          requests.push({
            deleteText: {
              objectId: update.tableId,
              cellLocation: {
                rowIndex: update.rowIndex,
                columnIndex: update.columnIndices.comments
              }
            }
          });
          
          // 插入文本请求
          requests.push({
            insertText: {
              objectId: update.tableId,
              cellLocation: {
                rowIndex: update.rowIndex,
                columnIndex: update.columnIndices.comments
              },
              text: finalText
            }
          });
          
          updatedFieldCount++;
          console.log(`准备更新项目 "${update.projectName}" 的备注${update.currentComments ? '(附加)' : ''}`);
        } catch (error) {
          const errorMsg = `更新备注失败 (${update.projectId}): ${error instanceof Error ? error.message : String(error)}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
    }
    
    // 如果没有任何请求，直接返回
    if (requests.length === 0) {
      console.log('没有要应用的更新');
      return {
        success: true,
        updatedCount: 0,
        errors: errors.length > 0 ? errors : undefined
      };
    }
    
    console.log(`即将发送${requests.length}个请求(${updatedFieldCount}个字段更新)`);
    
    // 准备符合API规范的请求正文
    const requestBody = {
      requests: requests
    };
    
    // 发送批量更新请求
    const response = await fetch(
      `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      const errorMsg = `Google Slides API错误: ${JSON.stringify(errorData)}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    const result = await response.json() as SlidesBatchUpdateResponse;
    console.log('Slides API更新成功，响应:', JSON.stringify(result));
    
    return {
      success: true,
      updatedCount: updatedFieldCount,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error('应用项目更新失败:', error);
    return {
      success: false,
      updatedCount: 0,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

// ============ Google Auth Token 重导出 ============
// 统一使用 utils/googleAuth.ts 中的实现
// 这里的导出是为了向后兼容，避免大规模修改现有代码

import { 
  getGoogleAuthToken, 
  getGoogleAuthTokenSilently 
} from './utils/googleAuth';

/**
 * 获取Google API认证token（会弹出认证窗口）
 * @deprecated 请直接使用 getGoogleAuthToken({ caller: 'xxx' })
 * @returns OAuth token
 */
export async function getAuthToken(): Promise<string | null> {
  return getGoogleAuthToken({ caller: 'slide.getAuthToken' });
}

/**
 * 获取缓存的Google API认证token（不弹出认证窗口）
 * 用于后台自动任务，避免在用户无操作时弹出授权窗口
 * @deprecated 请直接使用 getGoogleAuthTokenSilently({ caller: 'xxx' })
 * @returns OAuth token，如果没有缓存则返回 null
 */
export async function getCachedAuthToken(): Promise<string | null> {
  return getGoogleAuthTokenSilently({ caller: 'slide.getCachedAuthToken' });
}

/**
 * 获取演示文稿数据
 * @param presentationId 演示文稿ID
 * @param token OAuth token
 * @returns 演示文稿数据
 */
async function fetchPresentationData(presentationId: string, token: string): Promise<GooglePresentation> {
  const response = await fetch(
    `https://slides.googleapis.com/v1/presentations/${presentationId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Google Slides API错误: ${JSON.stringify(errorData)}`);
  }
  
  return await response.json() as GooglePresentation;
} 