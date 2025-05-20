/**
 * 幻灯片分析器接口定义
 */

import { GoogleSlide, GooglePageElement } from './googleSlides';
import { ProjectData } from '../slide';

/**
 * 幻灯片内容类型枚举
 */
export enum SlideContentType {
  TABLE = 'table',
  TEXT = 'text',
  SHAPE = 'shape',
  LIST = 'list',
  MIXED = 'mixed',
  UNKNOWN = 'unknown'
}

/**
 * 项目结构类型枚举
 */
export enum ProjectStructureType {
  SINGLE_TICKET = 'single_ticket',  // 单个Jira工单
  SPRINT = 'sprint',                // Sprint/迭代
  EPIC = 'epic',                    // Epic/特性
  RELEASE = 'release',              // 发布
  MIXED = 'mixed',                  // 混合结构
  CUSTOM = 'custom',                // 自定义结构
  UNKNOWN = 'unknown'               // 未知结构
}

/**
 * 幻灯片内容分析结果
 */
export interface SlideAnalysisResult {
  contentType: SlideContentType;
  projectStructure: ProjectStructureType;
  projectFields: string[];
  projects: ProjectData[];
  confidence: number;
  metadata: {
    slideId: string;
    elementCount: number;
    hasTable: boolean;
    hasText: boolean;
    hasShapes: boolean;
    hasLists: boolean;
  };
  warnings?: string[];
}

/**
 * 幻灯片内容分析器接口
 */
export interface SlideContentAnalyzer {
  /**
   * 分析幻灯片内容
   * @param slide 幻灯片对象
   * @returns 分析结果
   */
  analyze(slide: GoogleSlide): Promise<SlideAnalysisResult>;
  
  /**
   * 判断是否可以处理此类型的幻灯片
   * @param slide 幻灯片对象
   * @returns 是否可以处理
   */
  canHandle(slide: GoogleSlide): boolean;
}

/**
 * 表格内容分析器接口
 */
export interface TableContentAnalyzer extends SlideContentAnalyzer {
  /**
   * 分析表格结构
   * @param tableElement 表格元素
   * @returns 表格分析结果
   */
  analyzeTable(tableElement: GooglePageElement): Promise<{
    headers: string[];
    columnMapping: Record<string, number>;
    projectRows: ProjectData[];
  }>;
}

/**
 * 文本内容分析器接口
 */
export interface TextContentAnalyzer extends SlideContentAnalyzer {
  /**
   * 分析文本内容
   * @param textElements 文本元素数组
   * @returns 文本分析结果
   */
  analyzeTextElements(textElements: GooglePageElement[]): Promise<{
    projectFields: string[];
    projects: ProjectData[];
  }>;
}

/**
 * 元素引用记录
 */
export interface ElementReference {
  slideId: string;
  elementId: string;
  elementType: string;
  contentPath?: string[]; // 用于定位元素内的特定内容
}

/**
 * 带有元素引用的项目数据
 */
export interface ProjectDataWithReferences extends ProjectData {
  elementReferences: Record<string, ElementReference>; // 字段名到元素引用的映射
}

/**
 * 项目字段建议
 */
export interface ProjectFieldSuggestion {
  fieldName: string;
  confidence: number;
  possibleValues?: string[];
  isRequired?: boolean;
  description?: string;
}

/**
 * 幻灯片分析器工厂接口
 */
export interface SlideAnalyzerFactory {
  /**
   * 创建合适的分析器
   * @param slide 幻灯片对象
   * @returns 适合的分析器
   */
  createAnalyzer(slide: GoogleSlide): SlideContentAnalyzer;
} 