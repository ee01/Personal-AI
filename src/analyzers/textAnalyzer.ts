/**
 * 文本内容分析器实现
 */

import { GoogleSlide, GooglePageElement, GoogleShape } from '../interfaces/googleSlides';
import { 
  SlideContentType, 
  TextContentAnalyzer, 
  SlideAnalysisResult 
} from '../interfaces/slideAnalyzer';
import { BaseSlideAnalyzer } from './baseAnalyzer';

/**
 * 文本结构类型
 */
enum TextStructureType {
  PARAGRAPH = 'paragraph',
  BULLET_LIST = 'bullet_list',
  NUMBERED_LIST = 'numbered_list',
  MIXED = 'mixed'
}

/**
 * 文本块信息
 */
interface TextBlock {
  elementId: string;
  content: string;
  type: TextStructureType;
  level: number;
  fontSize?: number;
  isBold?: boolean;
  isTitle?: boolean;
  index: number;
  children?: TextBlock[];
}

/**
 * 文本内容分析器类
 * 处理基于文本和列表的项目信息
 */
export class TextContentAnalyzerImpl extends BaseSlideAnalyzer implements TextContentAnalyzer {
  // Jira工单ID模式
  private static readonly JIRA_TICKET_PATTERN = /([A-Z]+-\d+)/;
  
  // 项目状态关键词和正则表达式
  private static readonly STATUS_PATTERNS = [
    /状态[:：]\s*([^,，。\n]+)/i,
    /status[:：]\s*([^,，。\n]+)/i,
    /\[(进行中|完成|待办|阻塞|延期|取消)\]/i,
    /\[(in progress|done|todo|blocked|delayed|cancelled)\]/i
  ];
  
  // 负责人关键词和正则表达式
  private static readonly OWNER_PATTERNS = [
    /负责人[:：]\s*([^,，。\n]+)/i,
    /owner[:：]\s*([^,，。\n]+)/i,
    /责任人[:：]\s*([^,，。\n]+)/i,
    /assignee[:：]\s*([^,，。\n]+)/i,
    /@([^\s]+)/
  ];
  
  // 赛道/团队关键词和正则表达式
  private static readonly TRACK_PATTERNS = [
    /赛道[:：]\s*([^,，。\n]+)/i,
    /团队[:：]\s*([^,，。\n]+)/i,
    /track[:：]\s*([^,，。\n]+)/i,
    /team[:：]\s*([^,，。\n]+)/i
  ];

  /**
   * 判断是否可以处理此类型的幻灯片
   * @param slide 幻灯片对象
   * @returns 是否可以处理
   */
  public canHandle(slide: GoogleSlide): boolean {
    if (!slide.pageElements) return false;
    
    const metadata = this.analyzeSlideMetadata(slide);
    const contentType = this.determineContentType(slide);
    
    // 能处理文本、列表或混合(但不以表格为主)的幻灯片
    return contentType === SlideContentType.TEXT ||
           contentType === SlideContentType.LIST ||
           (contentType === SlideContentType.MIXED && !metadata.hasTable);
  }
  
  /**
   * 分析文本内容
   * @param slide 幻灯片对象
   * @param contentType 内容类型
   * @returns 分析结果
   */
  protected async analyzeContent(
    slide: GoogleSlide, 
    _contentType: SlideContentType
  ): Promise<Partial<SlideAnalysisResult>> {
    if (!slide.pageElements) {
      return { projects: [], confidence: 0 };
    }
    
    // 获取所有文本元素
    const textElements = slide.pageElements.filter(element => 
      (element.shape && element.shape.text) || 
      (element.table && element.table.tableRows)
    );
    
    if (textElements.length === 0) {
      return { projects: [], confidence: 0 };
    }
    
    try {
      // 分析文本元素
      const result = await this.analyzeTextElements(textElements);
      
      // 计算置信度
      const confidence = this.calculateTextConfidence(result.projects);
      
      // 生成警告
      const warnings: string[] = [];
      if (confidence < 0.4) {
        warnings.push('文本结构识别置信度较低，可能无法准确提取所有项目信息');
      }
      
      if (result.projects.length === 0) {
        warnings.push('未能从文本中提取项目数据，请检查幻灯片内容格式');
      }
      
      return {
        projects: result.projects,
        projectFields: result.projectFields,
        confidence,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      console.error('文本分析错误:', error);
      return { 
        projects: [], 
        confidence: 0,
        warnings: [`文本分析错误: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }
  
  /**
   * 分析文本元素
   * @param elements 页面元素数组
   * @returns 文本分析结果
   */
  public async analyzeTextElements(elements: GooglePageElement[]): Promise<{
    projectFields: string[];
    projects: ProjectData[];
  }> {
    // 提取文本块
    const textBlocks = this.extractTextBlocks(elements);
    
    // 构建文本结构树
    const structuredBlocks = this.buildTextStructureTree(textBlocks);
    
    // 根据结构提取项目
    const projects = this.extractProjectsFromTextStructure(structuredBlocks);
    
    // 确定项目共有字段
    const projectFields = this.determineCommonFields(projects);
    
    return {
      projectFields,
      projects
    };
  }
  
  /**
   * 从页面元素中提取文本块
   * @param elements 页面元素数组
   * @returns 文本块数组
   */
  private extractTextBlocks(elements: GooglePageElement[]): TextBlock[] {
    const blocks: TextBlock[] = [];
    let index = 0;
    
    for (const element of elements) {
      // 处理形状中的文本
      if (element.shape && element.shape.text && element.shape.text.textElements) {
        const shapeBlocks = this.extractTextBlocksFromShape(element.shape, element.objectId, index);
        blocks.push(...shapeBlocks);
        index += shapeBlocks.length;
      }
    }
    
    return blocks;
  }
  
  /**
   * 从形状中提取文本块
   * @param shape 形状对象
   * @param elementId 元素ID
   * @param startIndex 起始索引
   * @returns 文本块数组
   */
  private extractTextBlocksFromShape(shape: GoogleShape, elementId: string, startIndex: number): TextBlock[] {
    const blocks: TextBlock[] = [];
    
    if (!shape.text || !shape.text.textElements) {
      return blocks;
    }
    
    let currentBlock: TextBlock | null = null;
    let currentContent: string[] = [];
    let currentType = TextStructureType.PARAGRAPH;
    let currentLevel = 0;
    let isBold = false;
    let fontSize = 0;
    
    // 遍历文本元素
    for (const textElement of shape.text.textElements) {
      // 处理段落标记
      if (textElement.paragraphMarker) {
        // 如果已经有内容，保存当前块
        if (currentContent.length > 0 && currentBlock) {
          currentBlock.content = currentContent.join('').trim();
          if (currentBlock.content) {
            blocks.push(currentBlock);
          }
        }
        
        // 开始新块
        currentContent = [];
        
        // 确定块类型
        if (textElement.paragraphMarker.style?.bulletPreset) {
          currentType = TextStructureType.BULLET_LIST;
          
          // 根据缩进确定级别
          const indent = textElement.paragraphMarker.style.indent?.magnitude || 0;
          currentLevel = Math.floor(indent / 20); // 假设每级缩进20单位
        } else {
          currentType = TextStructureType.PARAGRAPH;
          currentLevel = 0;
        }
        
        currentBlock = {
          elementId,
          content: '',
          type: currentType,
          level: currentLevel,
          isBold: false,
          fontSize: 0,
          isTitle: false,
          index: startIndex + blocks.length
        };
      }
      
      // 处理文本内容
      if (textElement.textRun) {
        // 获取样式信息
        const style = textElement.textRun.style;
        if (style) {
          isBold = style.bold || false;
          fontSize = style.fontSize?.magnitude || 0;
        }
        
        // 添加文本
        const content = textElement.textRun.content || '';
        currentContent.push(content);
        
        // 如果是第一个文本元素，更新块的样式信息
        if (currentBlock && currentContent.length === 1) {
          currentBlock.isBold = isBold;
          currentBlock.fontSize = fontSize;
          currentBlock.isTitle = fontSize > 14 || isBold; // 根据字体大小和粗体判断是否是标题
        }
      }
    }
    
    // 保存最后一个块
    if (currentContent.length > 0 && currentBlock) {
      currentBlock.content = currentContent.join('').trim();
      if (currentBlock.content) {
        blocks.push(currentBlock);
      }
    }
    
    return blocks;
  }
  
  /**
   * 构建文本结构树
   * @param blocks 文本块数组
   * @returns 结构化的文本块数组
   */
  private buildTextStructureTree(blocks: TextBlock[]): TextBlock[] {
    // 按索引排序
    blocks.sort((a, b) => a.index - b.index);
    
    // 构建层级结构树
    const rootBlocks: TextBlock[] = [];
    const stack: TextBlock[] = [];
    
    for (const block of blocks) {
      // 重置堆栈，直到找到适当的父级
      while (stack.length > 0 && stack[stack.length - 1].level >= block.level) {
        stack.pop();
      }
      
      if (stack.length === 0) {
        // 顶层块
        rootBlocks.push(block);
      } else {
        // 添加为子块
        const parent = stack[stack.length - 1];
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(block);
      }
      
      // 如果不是列表项，或者是标题，不入栈
      if (block.type !== TextStructureType.BULLET_LIST || block.isTitle) {
        continue;
      }
      
      // 当前块入栈
      stack.push(block);
    }
    
    return rootBlocks;
  }
  
  /**
   * 从文本结构中提取项目
   * @param blocks 结构化的文本块数组
   * @returns 项目数据数组
   */
  private extractProjectsFromTextStructure(blocks: TextBlock[]): ProjectData[] {
    const projects: ProjectData[] = [];
    
    // 识别不同的项目结构模式并提取
    
    // 模式1: 标题或列表项是项目名称，子项是项目详情
    this.extractProjectsFromTitleChildrenPattern(blocks, projects);
    
    // 模式2: 列表项包含完整的项目信息
    this.extractProjectsFromListItemPattern(blocks, projects);
    
    // 模式3: 段落文本包含完整的项目信息
    this.extractProjectsFromParagraphPattern(blocks, projects);
    
    return projects;
  }
  
  /**
   * 从标题-子项模式中提取项目
   * @param blocks 文本块数组
   * @param projects 项目数组（输出）
   */
  private extractProjectsFromTitleChildrenPattern(blocks: TextBlock[], projects: ProjectData[]): void {
    for (const block of blocks) {
      // 只考虑有子项的标题或列表项
      if (!block.children || block.children.length === 0) {
        continue;
      }
      
      // 尝试从标题中提取项目ID和名称
      const titleText = block.content;
      const jiraMatch = TextContentAnalyzerImpl.JIRA_TICKET_PATTERN.exec(titleText);
      
      if (!jiraMatch) {
        // 如果没有Jira ID，可能不是项目标题，递归处理子项
        if (block.children) {
          this.extractProjectsFromTitleChildrenPattern(block.children, projects);
        }
        continue;
      }
      
      const jiraId = jiraMatch[1];
      let projectName = titleText.replace(jiraId, '').trim();
      
      // 如果有冒号，取冒号后的部分
      if (projectName.includes(':')) {
        projectName = projectName.split(':')[1].trim();
      } else if (projectName.includes('：')) {
        projectName = projectName.split('：')[1].trim();
      }
      
      // 从子项中提取项目详情
      let status = '';
      let owner = '';
      let track = '';
      let comments = '';
      
      for (const child of block.children) {
        const childText = child.content.toLowerCase();
        
        // 尝试匹配状态
        for (const pattern of TextContentAnalyzerImpl.STATUS_PATTERNS) {
          const match = pattern.exec(child.content);
          if (match) {
            status = match[1] || match[0];
            break;
          }
        }
        
        // 如果没有通过模式匹配找到，通过关键词查找
        if (!status && (childText.includes('状态') || childText.includes('status'))) {
          status = child.content.replace(/状态[:：]|status[:：]/i, '').trim();
        }
        
        // 尝试匹配负责人
        for (const pattern of TextContentAnalyzerImpl.OWNER_PATTERNS) {
          const match = pattern.exec(child.content);
          if (match) {
            owner = match[1] || match[0];
            break;
          }
        }
        
        // 如果没有通过模式匹配找到，通过关键词查找
        if (!owner && (childText.includes('负责人') || childText.includes('责任人') || childText.includes('owner') || childText.includes('assignee'))) {
          owner = child.content.replace(/负责人[:：]|责任人[:：]|owner[:：]|assignee[:：]/i, '').trim();
        }
        
        // 尝试匹配赛道/团队
        for (const pattern of TextContentAnalyzerImpl.TRACK_PATTERNS) {
          const match = pattern.exec(child.content);
          if (match) {
            track = match[1] || match[0];
            break;
          }
        }
        
        // 添加其他未识别内容为备注
        if (!childText.includes('状态') && !childText.includes('status') &&
            !childText.includes('负责人') && !childText.includes('责任人') && 
            !childText.includes('owner') && !childText.includes('assignee') &&
            !childText.includes('赛道') && !childText.includes('团队') &&
            !childText.includes('track') && !childText.includes('team')) {
          if (comments) {
            comments += '\n';
          }
          comments += child.content;
        }
      }
      
      // 创建项目数据
      projects.push({
        id: jiraId,
        name: projectName,
        status: status,
        owner: owner,
        track: track,
        comments: comments,
        slideElementId: block.elementId
      });
    }
  }
  
  /**
   * 从列表项模式中提取项目
   * @param blocks 文本块数组
   * @param projects 项目数组（输出）
   */
  private extractProjectsFromListItemPattern(blocks: TextBlock[], projects: ProjectData[]): void {
    for (const block of blocks) {
      if (block.type !== TextStructureType.BULLET_LIST && block.type !== TextStructureType.NUMBERED_LIST) {
        // 递归处理子项
        if (block.children) {
          this.extractProjectsFromListItemPattern(block.children, projects);
        }
        continue;
      }
      
      const content = block.content;
      const jiraMatch = TextContentAnalyzerImpl.JIRA_TICKET_PATTERN.exec(content);
      
      if (!jiraMatch) {
        // 递归处理子项
        if (block.children) {
          this.extractProjectsFromListItemPattern(block.children, projects);
        }
        continue;
      }
      
      const jiraId = jiraMatch[1];
      let projectName = content.replace(jiraId, '').trim();
      
      // 分离项目名称和其他信息
      let status = '';
      let owner = '';
      const track = '';
      let comments = '';
      
      // 尝试提取状态（通常在方括号或其他标记中）
      const statusMatches = content.match(/\[(.*?)\]/);
      if (statusMatches) {
        status = statusMatches[1];
        projectName = projectName.replace(/\[.*?\]/, '').trim();
      }
      
      // 尝试提取负责人（通常使用@符号）
      const ownerMatches = content.match(/@([^\s]+)/);
      if (ownerMatches) {
        owner = ownerMatches[1];
        projectName = projectName.replace(/@[^\s]+/, '').trim();
      }
      
      // 提取项目名称（通常在冒号后）
      if (projectName.includes(':')) {
        const parts = projectName.split(':');
        if (parts.length >= 2) {
          comments = parts.slice(2).join(':').trim();
          projectName = parts[1].trim();
        }
      } else if (projectName.includes('：')) {
        const parts = projectName.split('：');
        if (parts.length >= 2) {
          comments = parts.slice(2).join('：').trim();
          projectName = parts[1].trim();
        }
      }
      
      // 创建项目数据
      projects.push({
        id: jiraId,
        name: projectName,
        status: status,
        owner: owner,
        track: track,
        comments: comments,
        slideElementId: block.elementId
      });
      
      // 递归处理子项（如果有）
      if (block.children) {
        // 将子项内容作为当前项目的评论/备注
        for (const child of block.children) {
          if (projects[projects.length - 1].comments) {
            projects[projects.length - 1].comments += '\n';
          } else {
            projects[projects.length - 1].comments = '';
          }
          projects[projects.length - 1].comments += child.content;
        }
      }
    }
  }
  
  /**
   * 从段落模式中提取项目
   * @param blocks 文本块数组
   * @param projects 项目数组（输出）
   */
  private extractProjectsFromParagraphPattern(blocks: TextBlock[], projects: ProjectData[]): void {
    for (const block of blocks) {
      if (block.type !== TextStructureType.PARAGRAPH) {
        // 递归处理子项
        if (block.children) {
          this.extractProjectsFromParagraphPattern(block.children, projects);
        }
        continue;
      }
      
      const content = block.content;
      const jiraMatches = content.match(/[A-Z]+-\d+/g);
      
      if (!jiraMatches || jiraMatches.length === 0) {
        continue;
      }
      
      // 对于每个匹配的Jira ID，尝试提取相关项目信息
      for (const jiraId of jiraMatches) {
        const jiraIndex = content.indexOf(jiraId);
        const textAfterJira = content.substring(jiraIndex + jiraId.length);
        
        // 提取项目名称（假设在Jira ID后面的文本到下一个分隔符）
        let projectName = textAfterJira.trim();
        let status = '';
        let owner = '';
        let comments = '';
        
        // 处理冒号后的内容
        if (projectName.startsWith(':')) {
          projectName = projectName.substring(1).trim();
        }
        
        // 提取状态（如果有）
        const statusMatch = textAfterJira.match(/\[(.*?)\]/);
        if (statusMatch) {
          status = statusMatch[1];
          projectName = projectName.replace(/\[.*?\]/, '').trim();
        }
        
        // 提取负责人（如果有）
        const ownerMatch = textAfterJira.match(/@([^\s]+)/);
        if (ownerMatch) {
          owner = ownerMatch[1];
          projectName = projectName.replace(/@[^\s]+/, '').trim();
        }
        
        // 如果有多个句子，可能后面的是评论
        const sentences = projectName.split(/[.。]/);
        if (sentences.length > 1) {
          projectName = sentences[0].trim();
          comments = sentences.slice(1).join('.').trim();
        }
        
        // 创建项目数据
        projects.push({
          id: jiraId,
          name: projectName,
          status: status,
          owner: owner,
          comments: comments,
          slideElementId: block.elementId
        });
      }
    }
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
  
  /**
   * 计算文本分析的置信度
   * @param projects 提取的项目
   * @returns 置信度分数(0-1)
   */
  private calculateTextConfidence(projects: ProjectData[]): number {
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
} 