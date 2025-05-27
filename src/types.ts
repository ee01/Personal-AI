/**
 * 类型定义导出文件
 * 包含项目中使用的所有主要类型
 */

export interface JiraTicket {
  key: string;
  issuetype: string;
  summary: string;
  status: string;
  assignee: string;
  reporter: string;
  priority: string;
  labels?: string;
  components?: string;
  fixVersions?: string;
  affectsVersions?: string;
  linkedIssues?: string;
  epicLink?: string;
  sprint?: string;
  storyPoints?: string;
  created?: string;
  updated?: string;
  duedate?: string;
  description?: string;
}

// 新的智能Agent系统类型导出
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
