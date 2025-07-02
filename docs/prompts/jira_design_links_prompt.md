---
description: 
globs: 
alwaysApply: true
---
# Jira 设计链接显示功能 - 开发提示记录

本文档记录开发Jira设计链接显示功能过程中的关键提示和思考过程。

## 初始需求提示 (2024-12-20)

### 用户提示
```
现在的逻辑是 先判断是 Epic 的话，从 dom 结构获取 parentLink，拿到 parentLink 后再获取其下的有关 UX开头的 tickets。

能不能帮我调整成增加两个获取更多 design link 的入口
1. 同时查找 dom 中 description 是否有 figma 的链接
2. 同时从 dom 获取到 links 的 tickets，然后抽取出 links 中有 UX开头的 tickets
3. 如果不是 epic，查找上级 epic 后同样从 epic 中查找相关 UX 开头的 links tickets
最后可以一起展示多个结果，展示结果从只展示 超链接 修改为"[icon] Design LInk: [UX ticket summary](design超链接)
```

### 分析结果

用户需要扩展现有的设计链接检测逻辑，从单一的Epic/Parent关联扩展到多渠道检测：

1. **Description扫描**: 直接从ticket描述中提取figma链接
2. **DOM Links分析**: 从当前页面的Issue Links中提取UX tickets
3. **Epic层级分析**: 无论是否为Epic都要检查上级Epic的关联
4. **统一展示**: 改进UI展示多个设计链接，显示ticket summary而非原始URL

核心架构变更：
- 从单一findUXTicket改为findUXTickets，支持返回多个结果
- 新增getFigmaLinksFromDescription()和getUXTicketsFromLinkedIssues()函数
- 修改displayDesignLink为displayDesignLinks，支持多链接展示
- 增加来源标识，方便用户了解链接来源

技术实现要点：
- 使用正则表达式提取figma链接
- DOM选择器精确定位Issue Links区域
- API调用优化，批量获取设计链接
- 去重处理避免重复显示

## 文档创建提示 (2024-12-20)

### 用户提示
```
把这个获取 design ticket 的逻辑写一个新的 md 稳定到 docs/features 目录下，也可以帮我的 prompt 写入 docs/prompts 目录
```

### 响应

为Jira设计链接功能创建了完整的文档体系：

1. **功能文档** (`docs/features/jira_design_links.md`)
   - 完整的功能概述和使用方法
   - 详细的技术架构和实现细节
   - 配置选项和故障排除指南
   - 未来发展规划

2. **Prompt文档** (`docs/prompts/jira_design_links_prompt.md`)
   - 记录关键的开发需求和prompt
   - 保存重要的架构决策过程
   - 便于未来功能迭代和维护

文档结构遵循项目现有的风格和格式，包含frontmatter元数据，支持与代码的关联和自动更新。

这种文档管理方式类似于"架构决策记录"(ADR)的最佳实践，有助于：
- 知识传承和团队协作
- 快速理解功能设计思路
- 减少重复开发工作
- 提升维护效率

文档将作为"文档即代码"的重要组成部分，随着功能演进持续更新。

## 技术实现要点总结

### 关键技术决策

1. **多渠道检测策略**
   - Description直接扫描：使用正则表达式和DOM查询
   - Links DOM分析：精确定位`.links-list .links-section`
   - Epic API调用：复用现有的fetchTicketData逻辑

2. **数据结构设计**
   - 统一的DesignData接口支持不同类型的设计链接
   - 来源标识字段便于用户理解和调试
   - 去重逻辑基于URL避免重复展示

3. **UI展示优化**
   - 动态高度计算适应不同数量的链接
   - 来源标签提供清晰的数据来源标识
   - 悬停效果增强用户体验

4. **性能优化考虑**
   - 异步并行获取设计链接内容
   - DOM操作最小化减少页面影响
   - 错误处理机制保证稳定性

### 代码组织方式

- 保持函数职责单一，便于测试和维护
- API调用与DOM操作分离
- 统一的错误处理和日志记录
- 清晰的数据流和状态管理

这些设计决策确保了功能的可扩展性和维护性，为未来的功能增强奠定了基础。 