---
description: 
globs: 
alwaysApply: true
---
# Google Slides 项目分析器 - 开发提示记录

本文档记录开发Google Slides项目分析器功能过程中的关键提示和思考过程。无需记录修复bug或者其他细微的需求调整。

## 初始需求分析提示 (2023-10-15)

### 用户提示
```
现在要做一个全新的功能，针对 google slide 页面上的项目相关的slide，可以根据jira ticket的内容，聊天历史记录等信息，一键分析项目进展情况，展示分析结果病并帮助更新slide。

我们先拆解下这个功能，首先针对 google slide页面， @popup.tsx 都会多一个按钮「分析 Slide 项目信息并更新」
1. 一般看到的项目信息主要有可能会包含项目名字以及相关的 jira ticket 链接，有可能是这种结构：
 Status | Description | Owner | Track | Comment/Actions
 Not started | MTR-123407 mThor: AI Notes for Meetings - Alpha | April | Video | Design is under review\nBE is working\nRIO: AIT-11063 starts in late May\nNo ETA/timeline so far

2. 分析项目信息的时候会查找出相关的 jira ticket并获取 jira ticket的内容以及状态信息，还有特别留意comment信息。

3. 分析项目信息可以适当的查询聊天历史以及其他相关信息

针对 2,3 两步，我希望能直接复用 @intelligentAgent.ts 的能力，让AI自动思考需要收集哪些信息。

4. 最终将收集到的信息一起汇总，然后分析是否需要更新 slide上的内容。

5. 把需要更新slide的内容用弹窗展示出来，让用户勾选是否要执行更新。并且在下方列出这个页面的项目分析汇总情况，甚至可以附上相关的检索信息。

请先不要开始编码，系统性的分析思考用户作为项目经理，需要整理 slide汇总项目信息来汇报给美国高层，可能会关注和修改更新哪些信息。如何设计更好的体验给到用户。
并且分析整个功能，并用可视化的图例展示出来让我确认。
```

### 分析结果

作为项目经理，用户需要整理slide汇总项目信息向美国高层汇报时，关注以下核心信息：

1. **项目状态变化**: 从"未开始"变为"进行中"或"已完成"
2. **负责人变更**: 项目负责人是否发生变化
3. **截止日期更新**: 项目时间线是否有变化，是否有延期风险
4. **范围变更**: 项目范围是否扩大或缩小
5. **阻塞问题**: 是否有新出现的阻碍项目进展的问题
6. **资源分配**: 相关资源是否充足或需要调整
7. **里程碑达成**: 是否达到关键里程碑

系统架构设计包括:
- Google Slides页面内容脚本
- 项目分析结果弹窗
- agentThinking.ts项目数据分析引擎
- Slides API和Jira API调用集成
- 聊天历史查询功能

用户交互流程从点击"分析Slide项目信息并更新"按钮开始，经过信息抽取、数据分析、生成更新建议，到用户确认更新、执行修改的完整过程。

UI设计包括Popup页面中的新按钮、项目分析结果弹窗和项目分析详情展开视图等界面元素。

## 文档建立提示 (2023-10-15)

### 用户提示
```
大致没问题。帮我创建一个放cursor mdc文件的目录，我需要把项目的功能文档记录下来，把以上内容沉淀到文档中。文档文件夹中先针对这个功能使用一个mdc文件，并且再创建一个 {同名}_prompt.mdc 的文件，来记录我关键的几次对 AI prompt的需求原文(改bug等或者小调整就不需要记录了)，包括prompt时间等。

1. 帮我列出文档结构和内容让我确认。
2. 并且告诉我cursor 的mdc文件的建议用法，我的希望是能未来所有的更新自动更新相关文档，是否能达到我期望的作为 「文档即代码」的目标运作？
3. 我提出的 xxx_prompt.mdc 文件是否有存储意义？业界是否有人这么操作？我实现这个能力是因为 cursor的 chat没有随项目存储能力，而且也不便翻查重要修改prompt。
4. 是否可以有一种cursor rule或者借助其他能力或工具实现，能够让我之后与cursor chat对话的过程，自动的判断是否有需要更新需求文档来自动更新操作？
```

### 响应
建议创建以下文档结构：
```
docs/
  ├── features/
  │   ├── google_slides_analyzer.mdc
  │   └── google_slides_analyzer_prompt.mdc
  ├── README.md
  └── CONTRIBUTING.md
```

Cursor MDC文件的最佳实践包括文档结构化、与代码关联、自动化更新和版本管理等方面。通过良好的组织和自动化工具，可以实现"文档即代码"的目标。

存储prompt文件确实有重要意义，类似于"架构决策记录"(ADR)的概念，有助于知识传承和提升效率。这已成为使用AI辅助开发团队中的新兴最佳实践。

可以通过自定义Cursor规则、专门的文档更新命令、定期文档同步会话或结合外部工具等方式实现自动更新文档功能。建议结合.cursorrules中的文档更新提醒和定期专门的文档审查会话。

## 实施开始提示 (2023-10-15)

### 用户提示
```
好的，按照你的建议，帮我创建 docs/ 以及相关文档。并且开始实现这个需求的具体功能。
```

### 响应
正在创建文档目录并开始实现功能...

## API实现方法转换提示 (2023-10-20)

### 用户提示
```
@extractProjectsFromSlide() 我查看了 google slide的 dom结构，所有页面上的元素都是类似这样的节点：
<path fill="#fff" fill-opacity="0" pointer-events="visiblePainted" d="M 217980.86 17029 L 244932.86 17029 244932.86 40672 217980.86 40672 Z"></path>

我推测也许无法使用dom读取的方式来获取 slide内容，应该要改为尝试 api的方式，可以建立 slide.ts 来规整相关 slide读写操作。
```

### 响应
确实，Google Slides页面使用SVG路径渲染内容，DOM解析方法不适用。创建了slide.ts模块，使用Google Slides API来处理幻灯片内容的读取和修改。

API方法主要包括：
1. 获取OAuth token以访问Google API
2. 使用presentations API获取幻灯片内容
3. 解析表格数据提取项目信息
4. 通过batchUpdate API一次提交多个更新

这种方法比DOM解析更可靠，也能确保正确处理复杂的幻灯片结构。同时修改了contentScriptGoogleSlide.tsx，替换原来的DOM解析逻辑，转为调用slide.ts中的API函数。 