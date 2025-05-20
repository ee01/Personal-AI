/**
 * 智能Agent工具适配器
 * 在新的IntelligentAgentNext和旧的IntelligentAgent系统之间桥接工具
 */

import { ThoughtStep } from './interfaces/analysisInterfaces';
import { getToolDescriptions } from './intelligentAgent'; // 从旧系统导入工具描述

/**
 * 工具描述接口
 */
export interface ToolDescription {
  id: string;
  name: string;
  description: string;
  parameters?: Array<{
    name: string;
    description: string;
    type?: string;
    required?: boolean;
    options?: string[];
  }>;
}

/**
 * 工具执行接口
 */
export interface ToolExecution {
  id: string;
  params: Record<string, any>;
  callback?: (result: any) => void;
}

/**
 * 工具错误结果接口
 */
interface ToolErrorResult {
  error: true;
  message: string;
  details?: any;
}

/**
 * 工具适配器类
 * 管理工具注册和执行
 */
export class AgentToolAdapter {
  private toolRegistry: Record<string, any> = {};
  
  constructor() {
    // 初始化时从旧系统导入工具
    this.importToolsFromLegacySystem();
  }
  
  /**
   * 从旧系统导入工具
   */
  private importToolsFromLegacySystem(): void {
    try {
      // 获取旧系统的工具描述
      const legacyToolDescriptions = getToolDescriptions();
      
      // 由于我们无法直接访问工具处理函数，所以这里仅保存工具描述
      // 实际调用时会通过原始系统的方法进行
      for (const toolDesc of legacyToolDescriptions) {
        this.toolRegistry[toolDesc.id] = {
          description: toolDesc,
          // 具体执行逻辑将在调用时处理
          handler: async (params: any) => {
            // 假设我们通过某种方式调用旧系统工具
            // 实际实现时需要连接到旧系统的工具执行逻辑
            console.log(`调用旧系统工具: ${toolDesc.id} 参数:`, params);
            return { result: `工具 ${toolDesc.id} 执行结果 (模拟)` };
          }
        };
      }
      
      console.log(`成功从旧系统导入${legacyToolDescriptions.length}个工具描述`);
    } catch (error) {
      console.error('从旧系统导入工具失败:', error);
    }
  }
  
  /**
   * 注册新工具
   */
  registerTool(id: string, handler: Function, description?: ToolDescription): void {
    if (this.toolRegistry[id]) {
      console.warn(`工具'${id}'已存在，将被覆盖`);
    }
    
    this.toolRegistry[id] = {
      handler,
      description: description || {
        id,
        name: id,
        description: '无描述'
      }
    };
    
    console.log(`工具'${id}'注册成功`);
  }
  
  /**
   * 获取所有工具描述
   */
  getToolDescriptions(): ToolDescription[] {
    return Object.entries(this.toolRegistry).map(([id, tool]) => {
      if (tool.description) {
        return tool.description;
      } else {
        return {
          id,
          name: id,
          description: '无描述'
        };
      }
    });
  }
  
  /**
   * 执行工具
   */
  async executeTool(id: string, params: Record<string, any>): Promise<any> {
    const tool = this.toolRegistry[id];
    
    if (!tool) {
      const error: ToolErrorResult = {
        error: true,
        message: `工具'${id}'不存在`
      };
      return error;
    }
    
    try {
      // 检查工具参数
      this.validateToolParams(id, params);
      
      // 执行工具
      const result = await tool.handler(params);
      return result;
    } catch (error) {
      console.error(`执行工具'${id}'失败:`, error);
      
      const errorResult: ToolErrorResult = {
        error: true,
        message: `执行工具'${id}'失败: ${error.message}`,
        details: error
      };
      
      return errorResult;
    }
  }
  
  /**
   * 批量执行工具
   */
  async executeTools(tools: ToolExecution[], thoughtStep?: ThoughtStep): Promise<any[]> {
    const results = [];
    
    for (const tool of tools) {
      try {
        // 执行单个工具
        const result = await this.executeTool(tool.id, tool.params);
        
        // 记录到思考步骤
        if (thoughtStep) {
          thoughtStep.toolUsed = tool.id;
          thoughtStep.result = result;
        }
        
        // 添加到结果列表
        results.push(result);
        
        // 执行回调
        if (tool.callback) {
          tool.callback(result);
        }
      } catch (error) {
        console.error(`批量执行工具'${tool.id}'失败:`, error);
        
        const errorResult: ToolErrorResult = {
          error: true,
          message: `执行工具'${tool.id}'失败: ${error.message}`,
          details: error
        };
        
        results.push(errorResult);
      }
    }
    
    return results;
  }
  
  /**
   * 验证工具参数
   */
  private validateToolParams(id: string, params: Record<string, any>): void {
    const tool = this.toolRegistry[id];
    
    if (!tool.description || !tool.description.parameters) {
      return; // 没有参数描述，跳过验证
    }
    
    // 检查必需参数
    for (const param of tool.description.parameters) {
      if (param.required && (params[param.name] === undefined || params[param.name] === null)) {
        throw new Error(`工具'${id}'缺少必需参数'${param.name}'`);
      }
    }
  }
  
  /**
   * 获取可用工具列表
   */
  getAvailableTools(): string[] {
    return Object.keys(this.toolRegistry);
  }
}

// 创建单例
export const toolAdapter = new AgentToolAdapter();

// 便捷函数
export function getToolList(): string[] {
  return toolAdapter.getAvailableTools();
}

export function getToolDetails(): ToolDescription[] {
  return toolAdapter.getToolDescriptions();
}

export async function runTool(id: string, params: Record<string, any>): Promise<any> {
  return toolAdapter.executeTool(id, params);
} 