/**
 * 幻灯片内容分析器基类
 */

import { GoogleSlide } from '../interfaces/googleSlides';
import { 
  SlideContentAnalyzer, 
  SlideContentType, 
  ProjectStructureType, 
  SlideAnalysisResult 
} from '../interfaces/slideAnalyzer';
import { extractJiraTicketKeys } from '../utils/slidesAnalyzerSuggestions';

/**
 * 基础分析器抽象类
 * 提供通用功能和框架，具体分析由子类实现
 */
export abstract class BaseSlideAnalyzer implements SlideContentAnalyzer {
  /**
   * 分析幻灯片内容
   * @param slide 幻灯片对象
   * @returns 分析结果
   */
  public async analyze(slide: GoogleSlide): Promise<SlideAnalysisResult> {
    // 进行基本幻灯片元素分析
    const metadata = this.analyzeSlideMetadata(slide);
    const contentType = this.determineContentType(slide);
    
    // 初始化结果
    const result: SlideAnalysisResult = {
      contentType,
      projectStructure: ProjectStructureType.UNKNOWN,
      projectFields: [],
      projects: [],
      confidence: 0,
      metadata
    };
    
    try {
      // 分析项目结构
      result.projectStructure = this.analyzeProjectStructure(slide);
      
      // 进行具体内容分析，由子类实现
      const analysisResult = await this.analyzeContent(slide, contentType);
      
      // 合并分析结果
      Object.assign(result, analysisResult);
      
      return result;
    } catch (error) {
      console.error('幻灯片分析错误:', error);
      result.warnings = [`分析错误: ${error instanceof Error ? error.message : String(error)}`];
      return result;
    }
  }
  
  /**
   * 判断是否可以处理此类型的幻灯片
   * 子类应该重写此方法以提供具体的判断逻辑
   * @param slide 幻灯片对象
   * @returns 是否可以处理
   */
  public abstract canHandle(slide: GoogleSlide): boolean;
  
  /**
   * 分析具体内容
   * 子类需要实现此方法进行具体分析逻辑
   * @param slide 幻灯片对象
   * @param contentType 内容类型
   * @returns 部分分析结果
   */
  protected abstract analyzeContent(
    slide: GoogleSlide, 
    contentType: SlideContentType
  ): Promise<Partial<SlideAnalysisResult>>;
  
  /**
   * 分析幻灯片元数据
   * @param slide 幻灯片对象
   * @returns 幻灯片元数据
   */
  protected analyzeSlideMetadata(slide: GoogleSlide) {
    const pageElements = slide.pageElements || [];
    
    // 计数不同类型的元素
    let tableCount = 0;
    let textCount = 0;
    let shapeCount = 0;
    let listCount = 0;
    
    for (const element of pageElements) {
      if (element.table) tableCount++;
      if (element.shape?.text) {
        textCount++;
        // 检查文本是否包含列表
        if (this.containsList(element.shape.text.textElements)) {
          listCount++;
        }
      }
      if (element.shape && !element.shape.text) shapeCount++;
    }
    
    return {
      slideId: slide.objectId,
      elementCount: pageElements.length,
      hasTable: tableCount > 0,
      hasText: textCount > 0,
      hasShapes: shapeCount > 0,
      hasLists: listCount > 0
    };
  }
  
  /**
   * 确定幻灯片内容类型
   * @param slide 幻灯片对象
   * @returns 内容类型
   */
  protected determineContentType(slide: GoogleSlide): SlideContentType {
    const metadata = this.analyzeSlideMetadata(slide);
    
    if (metadata.hasTable) {
      // 如果有表格，可以是表格或混合
      return metadata.hasText && !this.isTableDominant(slide) 
        ? SlideContentType.MIXED 
        : SlideContentType.TABLE;
    } else if (metadata.hasLists) {
      // 如果有列表但没有表格
      return SlideContentType.LIST;
    } else if (metadata.hasText) {
      // 如果有文本但没有表格和列表
      return SlideContentType.TEXT;
    } else if (metadata.hasShapes) {
      // 只有形状
      return SlideContentType.SHAPE;
    }
    
    return SlideContentType.UNKNOWN;
  }
  
  /**
   * 分析项目结构类型
   * @param slide 幻灯片对象
   * @returns 项目结构类型
   */
  protected analyzeProjectStructure(slide: GoogleSlide): ProjectStructureType {
    // 查找幻灯片标题或文本内容中的关键词
    const textContent = this.extractAllTextContent(slide);
    const lowerText = textContent.toLowerCase();
    
    // 根据关键词判断项目结构类型
    if (lowerText.includes('sprint') || lowerText.includes('迭代') || 
        lowerText.includes('iteration') || lowerText.includes('周报')) {
      return ProjectStructureType.SPRINT;
    } else if (lowerText.includes('epic') || lowerText.includes('特性') || 
               lowerText.includes('feature')) {
      return ProjectStructureType.EPIC;
    } else if (lowerText.includes('release') || lowerText.includes('发布') || 
               lowerText.includes('版本')) {
      return ProjectStructureType.RELEASE;
    } else if (this.containsMultipleJiraTickets(textContent)) {
      // 如果检测到多个Jira工单ID，但没有其他关键词，默认为混合结构
      return ProjectStructureType.MIXED;
    } else if (this.containsSingleJiraTicket(textContent)) {
      // 如果只检测到一个Jira工单ID
      return ProjectStructureType.SINGLE_TICKET;
    }
    
    // 默认为自定义结构
    return ProjectStructureType.CUSTOM;
  }
  
  /**
   * 提取幻灯片所有文本内容
   * @param slide 幻灯片对象
   * @returns 所有文本内容
   */
  protected extractAllTextContent(slide: GoogleSlide): string {
    const textContent: string[] = [];
    
    if (!slide.pageElements) return '';
    
    for (const element of slide.pageElements) {
      // 从表格中提取文本
      if (element.table && element.table.tableRows) {
        for (const row of element.table.tableRows) {
          if (!row.tableCells) continue;
          
          for (const cell of row.tableCells) {
            if (!cell.text || !cell.text.textElements) continue;
            
            const cellText = cell.text.textElements
              .map(e => e.textRun?.content || '')
              .join('');
            
            if (cellText.trim()) {
              textContent.push(cellText);
            }
          }
        }
      }
      
      // 从形状中提取文本
      if (element.shape && element.shape.text && element.shape.text.textElements) {
        const shapeText = element.shape.text.textElements
          .map(e => e.textRun?.content || '')
          .join('');
        
        if (shapeText.trim()) {
          textContent.push(shapeText);
        }
      }
    }
    
    return textContent.join('\n');
  }
  
  /**
   * 检查是否包含单个Jira工单
   * @param text 文本内容
   * @returns 是否包含单个Jira工单
   */
  protected containsSingleJiraTicket(text: string): boolean {
    return extractJiraTicketKeys(text).length === 1;
  }
  
  /**
   * 检查是否包含多个Jira工单
   * @param text 文本内容
   * @returns 是否包含多个Jira工单
   */
  protected containsMultipleJiraTickets(text: string): boolean {
    return extractJiraTicketKeys(text).length > 1;
  }
  
  /**
   * 检查文本元素是否包含列表
   * @param textElements 文本元素数组
   * @returns 是否包含列表
   */
  protected containsList(textElements?: GoogleTextElement[]): boolean {
    if (!textElements) return false;
    
    return textElements.some(element => 
      element.paragraphMarker?.style?.bulletPreset !== undefined
    );
  }
  
  /**
   * 判断表格是否是幻灯片的主要内容
   * @param slide 幻灯片对象
   * @returns 表格是否为主要内容
   */
  protected isTableDominant(slide: GoogleSlide): boolean {
    if (!slide.pageElements) return false;
    
    const totalElements = slide.pageElements.length;
    const tableElements = slide.pageElements.filter(e => e.table).length;
    
    // 如果表格元素占比超过50%，或者只有一个表格和少量其他元素
    return (tableElements / totalElements > 0.5) || 
           (tableElements === 1 && totalElements <= 3);
  }
  
  /**
   * 从文本中提取所有Jira工单ID
   * @param text 文本内容
   * @returns Jira工单ID数组
   */
  protected extractJiraTickets(text: string): string[] {
    return extractJiraTicketKeys(text);
  }
}
