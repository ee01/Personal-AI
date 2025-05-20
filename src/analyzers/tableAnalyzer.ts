/**
 * 表格内容分析器实现
 */

import { GoogleSlide, GooglePageElement, GoogleTableCell, GoogleTableRow, GoogleTextElement } from '../interfaces/googleSlides';
import { 
  SlideContentType, 
  TableContentAnalyzer, 
  SlideAnalysisResult 
} from '../interfaces/slideAnalyzer';
import { BaseSlideAnalyzer } from './baseAnalyzer';
import { ProjectData } from '../slide';

/**
 * 表格分析器类
 * 专门处理表格样式的项目数据
 */
export class TableContentAnalyzerImpl extends BaseSlideAnalyzer implements TableContentAnalyzer {
  // 识别项目状态的常见列名
  private static readonly STATUS_COLUMNS = ['status', 'state', 'stage', '状态', '阶段'];
  
  // 识别项目描述的常见列名
  private static readonly DESCRIPTION_COLUMNS = ['project', 'description', 'summary', 'name', 'title', '项目', '描述', '名称', '标题'];
  
  // 识别项目负责人的常见列名
  private static readonly OWNER_COLUMNS = ['owner', 'assignee', 'responsible', 'person', 'lead', 'reporter', '负责人', '责任人', '所有者', '执行者'];
  
  // 识别赛道/团队的常见列名
  private static readonly TRACK_COLUMNS = ['track', 'team', 'group', 'department', 'area', '赛道', '团队', '组别', '部门', '分类'];
  
  // 识别备注/注释的常见列名
  private static readonly COMMENTS_COLUMNS = ['comment', 'note', 'action', 'item', 'todo', 'remarks', 'hightlight', '备注', '注释', '行动项', '待办'];

  /**
   * 判断是否可以处理此类型的幻灯片
   * @param slide 幻灯片对象
   * @returns 是否可以处理
   */
  public canHandle(slide: GoogleSlide): boolean {
    // 检查是否有表格元素
    if (!slide.pageElements) return false;
    
    const hasTable = slide.pageElements.some(element => element.table !== undefined);
    if (!hasTable) return false;
    
    // 如果有表格，进一步检查表格是否可能包含项目数据
    const contentType = this.determineContentType(slide);
    return contentType === SlideContentType.TABLE || contentType === SlideContentType.MIXED;
  }
  
  /**
   * 分析表格内容
   * @param slide 幻灯片对象
   * @param contentType 内容类型
   * @returns 分析结果
   */
  protected async analyzeContent(
    slide: GoogleSlide, 
    contentType: SlideContentType
  ): Promise<Partial<SlideAnalysisResult>> {
    if (!slide.pageElements) {
      return { projects: [], confidence: 0 };
    }
    
    // 查找所有表格元素
    const tableElements = slide.pageElements.filter(element => element.table);
    if (tableElements.length === 0) {
      return { projects: [], confidence: 0 };
    }
    
    // 分析所有表格，找出最可能包含项目数据的表格
    const allTableResults: Array<{
      projects: ProjectData[];
      tableElement: GooglePageElement;
      confidence: number;
      columnMapping: Record<string, number>;
      projectFields: string[];
    }> = [];
    
    for (const tableElement of tableElements) {
      try {
        const result = await this.analyzeTable(tableElement);
        
        // 计算此表格的置信度
        const confidence = this.calculateTableConfidence(
          result.headers, 
          result.columnMapping, 
          result.projectRows
        );
        
        // 提取项目字段名称
        const projectFields = Object.keys(result.columnMapping).filter(field => 
          result.columnMapping[field] !== -1
        );
        
        allTableResults.push({
          projects: result.projectRows,
          tableElement,
          confidence,
          columnMapping: result.columnMapping,
          projectFields
        });
      } catch (error) {
        console.error('表格分析错误:', error);
        // 继续分析下一个表格
      }
    }
    
    // 如果没有找到任何项目数据，返回空结果
    if (allTableResults.length === 0) {
      return { projects: [], confidence: 0 };
    }
    
    // 选择置信度最高的表格结果
    allTableResults.sort((a, b) => b.confidence - a.confidence);
    const bestResult = allTableResults[0];
    
    const warnings: string[] = [];
    
    // 如果有多个表格，但无法确定主表格，添加警告
    if (allTableResults.length > 1 && 
        bestResult.confidence > 0 && 
        allTableResults[1].confidence > bestResult.confidence * 0.8) {
      warnings.push('幻灯片包含多个可能的项目表格，已选择最可能的一个进行分析');
    }
    
    // 如果最佳表格的置信度仍然很低，添加警告
    if (bestResult.confidence < 0.5) {
      warnings.push('表格结构识别置信度较低，可能不是标准项目表格');
    }
    
    return {
      projects: bestResult.projects,
      confidence: bestResult.confidence,
      projectFields: bestResult.projectFields,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
  
  /**
   * 分析表格结构
   * @param tableElement 表格元素
   * @returns 表格分析结果
   */
  public async analyzeTable(tableElement: GooglePageElement): Promise<{
    headers: string[];
    columnMapping: Record<string, number>;
    projectRows: ProjectData[];
  }> {
    if (!tableElement.table || !tableElement.table.tableRows) {
      throw new Error('无效的表格元素');
    }
    
    const tableData = tableElement.table;
    const tableId = tableElement.objectId;
    
    if (tableData.tableRows.length < 2) {
      throw new Error('表格行数不足');
    }
    
    // 获取表头行
    const headerRow = tableData.tableRows[0];
    if (!headerRow.tableCells) {
      throw new Error('表头行不包含单元格');
    }
    
    // 解析表头
    const headers = headerRow.tableCells.map((cell: GoogleTableCell) => {
      if (!cell.text || !cell.text.textElements) return '';
      return cell.text.textElements
        .map((textElement: GoogleTextElement) => textElement.textRun?.content || '')
        .join('')
        .toLowerCase()
        .trim();
    });
    
    // 识别列索引，采用更智能的列名匹配
    const columnMapping = this.mapColumnIndices(headers);
    
    // 处理数据行
    const projectRows: ProjectData[] = [];
    
    for (let i = 1; i < tableData.tableRows.length; i++) {
      const row = tableData.tableRows[i];
      if (!row.tableCells) continue;
      
      const cells = row.tableCells;
      
      // 确保有足够的单元格
      const requiredColumns = [
        columnMapping.description, 
        columnMapping.status
      ].filter(idx => idx !== -1);
      
      const maxRequiredColumn = Math.max(...requiredColumns);
      if (cells.length <= maxRequiredColumn) {
        // 跳过没有足够列的行
        continue;
      }
      
      try {
        // 提取项目数据
        const project = this.extractProjectFromRow(
          tableId,
          cells,
          columnMapping,
          i
        );
        
        if (project) {
          projectRows.push(project);
        }
      } catch (error) {
        console.warn(`处理第${i}行时出错:`, error);
        // 继续处理下一行
      }
    }
    
    return {
      headers,
      columnMapping,
      projectRows
    };
  }
  
  /**
   * 智能匹配列索引
   * 使用模糊匹配和同义词来识别列的用途
   * @param headers 表头文本数组
   * @returns 列映射
   */
  private mapColumnIndices(headers: string[]): Record<string, number> {
    const columnMapping: Record<string, number> = {
      status: -1,
      description: -1,
      owner: -1,
      track: -1,
      comments: -1
    };
    
    // 对每个表头，检查是否匹配任一类型的列
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      
      // 状态列检查
      if (TableContentAnalyzerImpl.STATUS_COLUMNS.some(keyword => header.includes(keyword))) {
        columnMapping.status = i;
      }
      
      // 描述列检查
      if (TableContentAnalyzerImpl.DESCRIPTION_COLUMNS.some(keyword => header.includes(keyword))) {
        columnMapping.description = i;
      }
      
      // 负责人列检查
      if (TableContentAnalyzerImpl.OWNER_COLUMNS.some(keyword => header.includes(keyword))) {
        columnMapping.owner = i;
      }
      
      // 赛道列检查
      if (TableContentAnalyzerImpl.TRACK_COLUMNS.some(keyword => header.includes(keyword))) {
        columnMapping.track = i;
      }
      
      // 备注列检查
      if (TableContentAnalyzerImpl.COMMENTS_COLUMNS.some(keyword => header.includes(keyword))) {
        columnMapping.comments = i;
      }
    }
    
    // 如果找不到显式的描述列，尝试使用第一列作为描述列
    if (columnMapping.description === -1 && headers.length > 0) {
      columnMapping.description = 0;
    }
    
    return columnMapping;
  }
  
  /**
   * 从表格行提取项目数据
   * @param tableId 表格ID
   * @param cells 行单元格
   * @param columnMapping 列索引映射
   * @param rowIndex 行索引
   * @returns 项目数据
   */
  private extractProjectFromRow(
    tableId: string,
    cells: GoogleTableCell[],
    columnMapping: Record<string, number>,
    rowIndex: number
  ): ProjectData | null {
    // 提取描述单元格内容
    if (columnMapping.description === -1) {
      return null; // 缺少描述列，无法识别项目
    }
    
    const descriptionCell = cells[columnMapping.description];
    if (!descriptionCell.text || !descriptionCell.text.textElements) {
      return null; // 描述单元格为空
    }
    
    const descriptionText = descriptionCell.text.textElements
      .map((textElement: GoogleTextElement) => textElement.textRun?.content || '')
      .join('');
    
    // 如果描述为空，跳过此行
    if (!descriptionText.trim()) {
      return null;
    }
    
    // 提取Jira工单ID
    const jiraTicketMatch = descriptionText.match(/([A-Z]+-\d+)/);
    const jiraTicketId = jiraTicketMatch ? jiraTicketMatch[0] : '';
    
    // 提取项目名称
    let projectName = descriptionText;
    if (jiraTicketId) {
      projectName = projectName.replace(jiraTicketId, '').trim();
      // 如果有冒号，取冒号后的部分
      if (projectName.includes(':')) {
        projectName = projectName.split(':')[1].trim();
      }
    }
    
    // 获取状态信息
    let statusText = '';
    if (columnMapping.status !== -1) {
      const statusCell = cells[columnMapping.status];
      statusText = statusCell.text && statusCell.text.textElements 
        ? statusCell.text.textElements
            .map((textElement: GoogleTextElement) => textElement.textRun?.content || '')
            .join('')
            .trim()
        : '';
    }
    
    // 获取负责人信息
    let ownerText = '';
    if (columnMapping.owner !== -1) {
      const ownerCell = cells[columnMapping.owner];
      ownerText = ownerCell.text && ownerCell.text.textElements 
        ? ownerCell.text.textElements
            .map((textElement: GoogleTextElement) => textElement.textRun?.content || '')
            .join('')
            .trim()
        : '';
    }
    
    // 创建项目数据对象
    const project: ProjectData = {
      id: jiraTicketId || `project-${tableId}-${rowIndex}`,
      name: projectName,
      status: statusText,
      owner: ownerText,
      tableId: tableId,
      row: rowIndex,
      columnIndices: columnMapping
    };
    
    // 添加可选字段
    if (columnMapping.track !== -1) {
      const trackCell = cells[columnMapping.track];
      project.track = trackCell.text && trackCell.text.textElements 
        ? trackCell.text.textElements
            .map((textElement: GoogleTextElement) => textElement.textRun?.content || '')
            .join('')
            .trim()
        : '';
    }
    
    if (columnMapping.comments !== -1) {
      const commentsCell = cells[columnMapping.comments];
      project.comments = commentsCell.text && commentsCell.text.textElements 
        ? commentsCell.text.textElements
            .map((textElement: GoogleTextElement) => textElement.textRun?.content || '')
            .join('')
            .trim()
        : '';
    }
    
    return project;
  }
  
  /**
   * 计算表格的项目数据置信度
   * @param headers 表头
   * @param columnMapping 列映射
   * @param projects 提取的项目数据
   * @returns 置信度分数(0-1)
   */
  private calculateTableConfidence(
    headers: string[],
    columnMapping: Record<string, number>,
    projects: ProjectData[]
  ): number {
    let score = 0;
    
    // 1. 检查是否识别到关键列
    if (columnMapping.status !== -1) score += 0.2;
    if (columnMapping.description !== -1) score += 0.2;
    if (columnMapping.owner !== -1) score += 0.1;
    if (columnMapping.track !== -1) score += 0.05;
    if (columnMapping.comments !== -1) score += 0.05;
    
    // 2. 检查项目数据有效性
    if (projects.length === 0) {
      return 0; // 没有提取到项目
    }
    
    // 计算包含Jira工单ID的项目比例
    const jiraProjects = projects.filter(p => /[A-Z]+-\d+/.test(p.id));
    const jiraRatio = jiraProjects.length / projects.length;
    score += jiraRatio * 0.2;
    
    // 3. 检查表格结构
    if (headers.length >= 3) score += 0.1; // 表格列数适中
    if (projects.length >= 2) score += 0.1; // 有多行项目数据
    
    return Math.min(1, score);
  }
} 