/**
 * LLM辅助分析器实现
 */

import { GoogleSlide } from '../interfaces/googleSlides';
import { 
  SlideContentType, 
  SlideContentAnalyzer, 
  SlideAnalysisResult
} from '../interfaces/slideAnalyzer';
import { BaseSlideAnalyzer } from './baseAnalyzer';
import { callLLMJsonAPI } from '../llm';

/**
 * LLM辅助分析器类
 * 使用LLM分析难以结构化解析的幻灯片内容
 */
export class LLMContentAnalyzer extends BaseSlideAnalyzer implements SlideContentAnalyzer {
  // 最小需要的置信度阈值
  private static readonly MIN_CONFIDENCE_THRESHOLD = 0.4;
  
  /**
   * 判断是否可以处理此类型的幻灯片
   * @param slide 幻灯片对象
   * @returns 是否可以处理
   */
  public canHandle(_slide: GoogleSlide): boolean {
    // 这是后备分析器，可以处理任何幻灯片，但优先级较低
    return true;
  }
  
  /**
   * 分析具体内容
   * @param slide 幻灯片对象
   * @param contentType 内容类型
   * @returns 部分分析结果
   */
  protected async analyzeContent(
    slide: GoogleSlide, 
    _contentType: SlideContentType
  ): Promise<Partial<SlideAnalysisResult>> {
    try {
      // 生成分析提示
      const { prompt, elementMap } = this.generateAnalysisPrompt(slide);
      
      // 调用LLM API进行分析
      const llmResponse = await this.callLLMAPI(prompt);
      
      // 解析LLM响应
      const projects = this.parseLLMResponse(llmResponse, elementMap, slide.objectId);
      
      // 计算置信度和项目字段
      const confidence = this.calculateLLMConfidence(projects, llmResponse);
      const projectFields = this.determineCommonFields(projects);
      
      return {
        projects,
        projectFields,
        confidence,
        warnings: confidence < LLMContentAnalyzer.MIN_CONFIDENCE_THRESHOLD ? 
          ['LLM分析置信度较低，可能需要手动检查项目数据'] : undefined
      };
    } catch (error) {
      console.error('LLM分析错误:', error);
      return {
        projects: [],
        confidence: 0,
        warnings: [`LLM分析错误: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }
  
  /**
   * 生成分析提示
   * @param slide 幻灯片对象
   * @returns 分析提示和元素映射
   */
  private generateAnalysisPrompt(slide: GoogleSlide): { 
    prompt: string; 
    elementMap: Map<string, string> 
  } {
    const elementMap = new Map<string, string>();
    let slideContent = '';
    
    // 提取幻灯片内容，同时生成元素ID映射
    if (slide.pageElements) {
      slideContent = this.extractSlideContent(slide, elementMap);
    }
    
    // 构建LLM提示
    const prompt = `
分析以下Google Slides幻灯片内容，提取其中的项目信息：

=== 幻灯片内容 ===
${slideContent}
=== 幻灯片内容结束 ===

从以上内容中提取所有项目信息，包括：
1. 项目ID/Jira工单号（如有，通常是形如"ABC-123"的格式）
2. 项目名称
3. 项目状态（如：进行中、完成、阻塞等）
4. 项目负责人/Owner
5. 项目赛道/团队（如有）
6. 项目备注/行动项（如有）

对于每个识别的项目，请同时提供其对应的元素ID，方便后续定位和更新。
如果从内容中无法确定某些字段，请将其留空。

返回JSON格式如下：
{
  "projects": [
    {
      "id": "项目ID或Jira工单号",
      "name": "项目名称",
      "status": "项目状态",
      "owner": "负责人",
      "track": "赛道/团队",
      "comments": "备注/行动项",
      "elementId": "对应的元素ID"
    }
  ],
  "confidence": 0.8, // 分析结果的置信度(0-1)
  "analysis": "分析过程和考虑因素的简要说明"
}
`;
    
    return { prompt, elementMap };
  }
  
  /**
   * 提取幻灯片内容并创建元素ID映射
   * @param slide 幻灯片对象
   * @param elementMap 元素ID映射表
   * @returns 幻灯片内容文本
   */
  private extractSlideContent(slide: GoogleSlide, elementMap: Map<string, string>): string {
    const contentParts: string[] = [];
    let elementIndex = 0;
    
    if (!slide.pageElements) {
      return '';
    }
    
    // 处理所有页面元素
    for (const element of slide.pageElements) {
      const elementId = element.objectId;
      const mappedId = `element_${elementIndex++}`;
      elementMap.set(mappedId, elementId);
      
      // 根据元素类型提取内容
      if (element.shape && element.shape.text) {
        // 处理形状中的文本
        const textContent = this.extractTextFromTextElements(element.shape.text.textElements || []);
        if (textContent) {
          contentParts.push(`[文本元素 ID:${mappedId}]\n${textContent}\n`);
        }
      } else if (element.table) {
        // 处理表格
        const tableContent = this.extractTableContent(element.table);
        if (tableContent) {
          contentParts.push(`[表格元素 ID:${mappedId}]\n${tableContent}\n`);
        }
      }
      // 可以添加更多元素类型的提取逻辑
    }
    
    return contentParts.join('\n');
  }
  
  /**
   * 从文本元素数组中提取文本
   * @param textElements 文本元素数组
   * @returns 提取的文本
   */
  private extractTextFromTextElements(textElements: any[]): string {
    return textElements
      .map(element => element.textRun?.content || '')
      .join('')
      .trim();
  }
  
  /**
   * 提取表格内容
   * @param table 表格对象
   * @returns 表格内容文本表示
   */
  private extractTableContent(table: any): string {
    if (!table.tableRows) {
      return '';
    }
    
    const rows: string[] = [];
    
    // 遍历表格行
    for (const row of table.tableRows) {
      if (!row.tableCells) continue;
      
      const cells: string[] = [];
      
      // 遍历单元格
      for (const cell of row.tableCells) {
        const cellText = cell.text && cell.text.textElements
          ? this.extractTextFromTextElements(cell.text.textElements)
          : '';
        
        cells.push(cellText);
      }
      
      // 添加行，用|分隔单元格
      rows.push(cells.join(' | '));
    }
    
    return rows.join('\n');
  }
  
  /**
   * 调用LLM API进行分析
   * 注意：这里需要实现具体的API调用逻辑，可以使用Chrome extension的消息传递机制
   * @param prompt 提示内容
   * @returns LLM响应
   */
  private async callLLMAPI(prompt: string): Promise<any> {
    try {
      // 使用callLLMJsonAPI函数调用实际的LLM API
      console.log('调用LLM API进行分析', prompt.substring(0, 100) + '...');
      
      // 准备请求体
      const requestBody = {
        prompt: prompt,
        type: 'analyze', // 根据实际需要调整类型
      };
      
      // 调用API并获取响应
      const response = await callLLMJsonAPI(requestBody);
      
      // 如果没有有效响应，提供默认结构
      if (!response || typeof response !== 'object') {
        return {
          projects: [],
          confidence: 0,
          analysis: "LLM分析未返回有效数据"
        };
      }
      
      return response;
    } catch (error) {
      console.error('LLM API调用错误:', error);
      // 出错时返回默认结构
      return {
        projects: [],
        confidence: 0,
        analysis: `LLM API调用错误: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * 解析LLM响应
   * @param response LLM响应对象
   * @param elementMap 元素ID映射表
   * @param slideId 幻灯片ID
   * @returns 项目数据数组
   */
  private parseLLMResponse(
    response: any, 
    elementMap: Map<string, string>,
    slideId: string
  ): ProjectData[] {
    if (!response || !response.projects || !Array.isArray(response.projects)) {
      return [];
    }
    
    // 转换LLM返回的项目数据
    return response.projects.map((project: any) => {
      // 获取实际元素ID
      const mappedElementId = project.elementId && elementMap.has(project.elementId)
        ? elementMap.get(project.elementId)
        : undefined;
      
      // 创建项目数据对象
      const projectData: ProjectData = {
        id: project.id || `llm-project-${slideId}-${Math.random().toString(36).substr(2, 9)}`,
        name: project.name || '',
        status: project.status || '',
        owner: project.owner || '',
        slideId: slideId,
        slideElementId: mappedElementId
      };
      
      // 添加可选字段
      if (project.track) {
        projectData.track = project.track;
      }
      
      if (project.comments) {
        projectData.comments = project.comments;
      }
      
      return projectData;
    });
  }
  
  /**
   * 计算LLM分析结果的置信度
   * @param projects 项目数据数组
   * @param llmResponse LLM响应
   * @returns 置信度(0-1)
   */
  private calculateLLMConfidence(projects: ProjectData[], llmResponse: any): number {
    // 如果LLM提供了置信度，直接使用
    if (llmResponse.confidence !== undefined && 
        typeof llmResponse.confidence === 'number' &&
        llmResponse.confidence >= 0 && 
        llmResponse.confidence <= 1) {
      return llmResponse.confidence;
    }
    
    // 否则计算基于项目数据的置信度
    if (projects.length === 0) {
      return 0;
    }
    
    let score = 0;
    
    // 1. 项目数量评分
    if (projects.length >= 3) {
      score += 0.3;
    } else if (projects.length >= 1) {
      score += 0.1;
    }
    
    // 2. 字段完整性评分
    let completenessScore = 0;
    let totalFields = 0;
    
    for (const project of projects) {
      let projectFields = 0;
      let filledFields = 0;
      
      for (const field of ['id', 'name', 'status', 'owner', 'track', 'comments']) {
        projectFields++;
        if (project[field as keyof ProjectData]) {
          filledFields++;
        }
      }
      
      completenessScore += filledFields / projectFields;
      totalFields++;
    }
    
    score += (completenessScore / totalFields) * 0.4;
    
    // 3. Jira ID评分
    const jiraProjects = projects.filter(p => /[A-Z]+-\d+/.test(p.id));
    score += (jiraProjects.length / projects.length) * 0.3;
    
    return Math.min(1, score);
  }
  
  /**
   * 确定项目共有的字段
   * @param projects 项目数组
   * @returns 共有字段名数组
   */
  private determineCommonFields(projects: ProjectData[]): string[] {
    if (projects.length === 0) {
      return [];
    }
    
    const fields = new Set<string>(['id', 'name']);
    
    // 计算每个字段的存在比例
    const fieldCounts: Record<string, number> = {
      status: 0,
      owner: 0,
      track: 0,
      comments: 0
    };
    
    for (const project of projects) {
      if (project.status) fieldCounts.status++;
      if (project.owner) fieldCounts.owner++;
      if (project.track) fieldCounts.track++;
      if (project.comments) fieldCounts.comments++;
    }
    
    // 如果字段在超过30%的项目中存在，认为是共有字段
    const threshold = projects.length * 0.3;
    
    for (const [field, count] of Object.entries(fieldCounts)) {
      if (count >= threshold) {
        fields.add(field);
      }
    }
    
    return Array.from(fields);
  }
} 