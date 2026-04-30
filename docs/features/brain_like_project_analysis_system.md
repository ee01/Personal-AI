# 类人脑项目分析系统

*最后更新: 2026-04-30*

## 当前定位

类人脑项目分析系统是 Personal AI 的项目知识工作台：它把网页感知、实体记忆、项目仪表盘和主动提醒串起来，让用户能从聊天、网页、Slide、Jira 线索中沉淀项目上下文，再回到一个可操作的项目视图。

当前最完整的用户入口是：

- `memory-exploring.html`：查看实体、主题、项目相关记忆。
- `project-dashboard.html`：查看项目鱼骨时间线、里程碑、任务、Jira 链接和健康摘要。
- Web Intelligence / Context Recall：在网页或会话场景里提示相关记忆。
- Memory Service：提供实体、召回、关注项目、通知、反思等后端能力。

## 已实现能力

### 感知层

- RingCentral / 网页内容脚本会抽取上下文，并通过 Memory Service 做相关记忆召回。
- Web Intelligence 会基于用户画像、项目关键词、页面内容进行轻量项目相关性判断。
- Google Slides Analyzer 可以从 Slides 表格/文本里识别项目状态并生成更新建议。

### 记忆层

- Memory Service 已提供实体、记忆、召回、关注项目、通知中心等 HTTP API。
- `memory-exploring` 负责把 Topic、Project、Person 等实体以列表/详情方式展示。
- 项目相关网页提示会回链到 `memory-exploring.html` 的稳定深链。

### 项目分析层

- `project-dashboard.html` 当前使用 React 鱼骨时间线展示项目。
- 支持新增项目、新增任务、编辑任务、关联 Jira、导入/导出 JSON 报告。
- 新增项目时会保留用户配置的里程碑，并把仪表盘数据持久化到 `chrome.storage.local`。
- 每个项目卡片会前置健康摘要：完成数、阻塞数、过期任务、近 7 天到期任务和下个里程碑。

### 决策层

- 当前以用户可见的健康摘要和通知中心为主。
- 自动风险预测仍是后续方向；现阶段只做规则化提示，不自动替用户改项目计划。

## 本轮调研结论

- Atlassian Jira / Rovo 强调把 AI 放进项目计划、趋势识别、风险提示和跨工具上下文里，同时保留人工控制。
- Asana 项目状态更新强调“先给项目健康状态，再附上里程碑、过期任务、图表和统一模板”。
- Microsoft Planner 的高级计划能力把依赖、报告、Timeline/Gantt、目标和 Copilot 放在同一项目管理路径里。
- 软件项目风险预测论文说明，风险视图至少应把阻塞、过期、近期到期和影响因素结构化呈现，后续再接模型预测。
- Jira 集成自动化研究强调有界自动化：结构化上下文、重新校验、恢复路径和人工审阅门槛比“全自动”更可靠。

## 当前边界

- 项目仪表盘数据仍是扩展本地维护的工作台数据，不是 Jira/GitHub/Confluence 的权威快照。
- “同步数据”当前还是模拟结果，真实多源同步需要进一步接入外部 API。
- 健康摘要是可解释规则，不是 ML 风险模型。
- Memory Service 的关注项目 API 与前端鱼骨仪表盘还没有完全合并成同一个数据源。

## 下一步建议

1. 把项目仪表盘的本地项目与 Memory Service watched projects 做双向同步。
2. 为健康摘要增加来源证据，例如关联 Jira、最近会话、Slides 更新建议。
3. 增加“生成状态更新草稿”，按健康摘要、里程碑、阻塞项组织成可复制报告。
4. 对接真实 Jira 数据后，再引入风险预测评分，避免在数据质量不足时给用户过度自动化结论。

相关文档：

- [项目进度仪表盘使用指南](project_dashboard_usage_guide.md)
- [网页记忆检测](webpage_memory_detection.md)
- [记忆系统](memory_system.md)
- [Agent Thinking](agent_thinking.md)
