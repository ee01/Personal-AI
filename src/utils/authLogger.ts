/**
 * 授权日志记录器（向后兼容层）
 * 现在使用通用 Logger 服务
 * 
 * @deprecated 请直接使用 Logger.auth() 或 import { Logger } from './logger'
 */

export { 
  logAuthCall,
  getAuthLogs,
  clearAuthLogs,
  printAuthLogs,
  exportAuthLogsAsText,
} from './logger';

// 重新导出 Logger 以便迁移
export { Logger } from './logger';
