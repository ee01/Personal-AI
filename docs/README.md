# Personal AI 项目文档

此目录包含Personal AI浏览器扩展的所有文档。

## 目录结构

- `features/` - 功能详细设计文档
  - 每个功能有独立的`.md`文件描述其设计和实现
- `prompts/` - 对应的`_prompt.md`文件记录开发过程中的关键AI对话

## 功能文档索引

### 核心分析系统
- [`agent_thinking.md`](features/agent_thinking.md) - 智能Agent思考系统
- [`agent_workflow.md`](features/agent_workflow.md) - Agent工作流系统 
- [`message_analysis_filter.md`](features/message_analysis_filter.md) - AI智能消息分析过滤功能
- [`memory_system.md`](features/memory_system.md) - 实体记忆系统综合设计文档 **(完整实现)**

### 专项功能
- [`custom_prompts.md`](features/custom_prompts.md) - 自定义提示词功能
- [`google_slides_analyzer.md`](features/google_slides_analyzer.md) - Google幻灯片分析器

### 集成功能
- [`jira_automation_import.md`](features/jira_automation_import.md) - Jira自动化导入
- [`jira_design_links.md`](features/jira_design_links.md) - Jira设计链接功能

## 文档维护指南

1. **新功能文档**：为每个新功能创建详细的设计文档
2. **保持同步**：确保代码变更时更新相应文档
3. **记录决策**：记录重要设计决策和思考过程
4. **包含图表**：使用图表和流程图增强文档可读性

## 文档命名规范

- 功能文档：`feature_name.md`
- 提示记录：`feature_name_prompt.md`

## 文档编写指南

### 功能文档结构
1. **功能概述** - 简要描述功能的核心价值
2. **系统架构** - 详细的技术架构说明
3. **接口定义** - 关键接口和数据结构
4. **使用方法** - 配置和使用指南
5. **性能优化** - 性能相关的说明
6. **故障排除** - 常见问题和解决方案
7. **未来规划** - 功能发展方向

### 更新原则
- 代码功能更新时同步更新文档
- 保持文档的时效性和准确性
- 使用清晰的标题和分段
- 包含必要的代码示例和配置说明 