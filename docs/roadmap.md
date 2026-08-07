# Personal AI - 功能路线图

*最后更新: 2025-10-29*

---

## 📋 目录

1. [已完成功能](#已完成功能)
2. [进行中的功能](#进行中的功能)
3. [短期规划 (1-2个月)](#短期规划-1-2个月)
4. [中期规划 (2-4个月)](#中期规划-2-4个月)
5. [长期规划 (6个月以上)](#长期规划-6个月以上)
6. [技术架构演进](#技术架构演进)

---

## ✅ 已完成功能

### 🧠 核心系统

#### 智能代理系统
- ✅ **Agent思考引擎** (`agentThinking.ts`) - 2768行完整实现
  - 多工具协同调用
  - 思考过程可视化
  - 完整的思考链记录
- ✅ **向量存储系统** (`vectorStore.ts`) - ChromaDB 集成
- ✅ **消息分析过滤** (`messageDealing.ts`) - 智能消息处理

#### Personal Roadmap（团队排期站）✅
详见功能文档 [`docs/features/personal_roadmap.md`](./features/personal_roadmap.md)；静态 Demo：`docs/demo/roadmap-demo.html`。

> **文档归属**：Personal Roadmap 的**实现说明 / 行为契约**写在 `docs/features/personal_roadmap.md`；本文件（`docs/roadmap.md`）只记产品级完成状态与规划条目。新增细节请改 features 文档，不要把长篇实现说明堆进本文件。

- ✅ 团队 Gantt / Backlog / 人员视图、两档分享、activity SSE、手动 draft、两阶段创建 Jira
- ✅ 阶段节点与外部依赖 Markers（标记轨 / 缺 ETA 角标 / 扩展读 Target End）
- ✅ Expand 本机化（URL `expand=`，多人不同步）
- ✅ 协作 SyncTicker + 头像 hover 用户名
- ✅ **导入 Task**：扩展 Options `JIRA_API_TOKEN`；无扩展不显示按钮
- ✅ **拖动回写 Target**：扩展 Options token 优先 → 服务端 `JIRA_PAT` fallback → 皆无静默
- ✅ 发布时间表标尺：团队 Google Sheet（Release/Phase/Date）→ Sprint 双轴表头；配置存 `teams.release_sheet_json`，Apps Script token 前端写死

#### 内容脚本集成
- ✅ **多平台支持** - Jira、Google Docs、聊天平台
- ✅ **Web Intelligence** - 网页智能分析和相关性检测
- ✅ **实时数据捕获** - 自动识别和保存项目信息

#### 用户界面
- ✅ **React 组件化架构** - 模块化、可复用
- ✅ **记忆探索界面** (`memory-exploring.vue`) - 实体查询和可视化
- ✅ **Agent 可视化器** (`agent-visualizer.tsx`) - 思考过程展示

### 👤 用户画像系统 (2024-12-20)

- ✅ **多维度兴趣建模** (`src/types/userProfile.ts`)
  - 项目、人员、主题、技术等维度
  - 用户行为追踪记录
  - 智能权重衰变机制（基于埃宾浩斯遗忘曲线）

- ✅ **UserProfileManager** (`src/services/UserProfileManager.ts`)
  - 用户画像初始化和加载
  - 实时行为更新
  - 智能兴趣预测

- ✅ **界面集成** (`memory.tsx`)
  - 用户画像可视化界面
  - 用户行为自动记录
  - 全局 API 接口

- ✅ **Web Intelligence 深度集成**
  - 根据用户画像权重调整分析相关性
  - 自动更新用户兴趣
  - 个性化内容识别

### 🧠 记忆系统

- ✅ **实体记忆存储** - 基于 ChromaDB 的向量存储
- ✅ **ask() 智能检索 API** (2025-10-21)
  - 向量相似度检索
  - 2-hop 实体关系扩展
  - 智能去重和排序
- ✅ **实体关系管理** - 自动发现和维护实体关系

### 📊 项目仪表盘系统

- ✅ **基础项目进度展示**
- ✅ **Jira 数据集成**
- ✅ **多项目切换**
- ✅ **实时数据更新**

### ⏰ 定时消息管理系统 (2025-10-29)

#### Phase 1: 核心功能 (Email 推送) - 已完成 ✅

- ✅ **统一数据模型** - Google Sheet 作为统一存储
- ✅ **一键初始化系统**
  - 自动创建 Google Sheet 和 Apps Script 项目
  - 自动配置触发器和 Web App
  - 添加示例数据
- ✅ **AppScript 执行引擎**
  - 每分钟触发器（Hourly 类型消息）
  - 每日触发器（Daily 和 Periodic 类型）
  - 自动判断消息类型
  - Email 推送到 Glip
- ✅ **Chrome Extension 管理界面**
  - 独立弹出窗口
  - 消息列表展示
  - 筛选和搜索
  - 状态管理

#### Phase 2: Bot API 支持 - 部分完成 🚧

- ✅ **AppScript Web App 端点**
  - `getMessagesToExecute()` - 获取待执行的 Bot 消息
  - 支持 `timeScope` 参数（minute/day）
  - 自动时间过滤
  
- ✅ **JiraAutomationService**
  - 测试 Jira 连接
  - 创建 Bot 执行器规则
  - 规则管理（获取、删除、检查）
  - 使用模板化配置
  
- ✅ **Bot 配置对话框**
  - 用户友好的配置界面
  - 三步配置流程（输入 → 测试 → 创建）
  - 实时状态显示

---

## 🚧 进行中的功能

### ⏰ 定时消息管理系统 - 未完成部分

#### Phase 2 剩余功能

##### 1. Jira Automation 规则导入 (高优先级) 🎯
**目标**：允许用户导入现有的 Jira Automation 规则到 Personal AI 管理

**实现计划**：
- [ ] **Content Script 集成** (`src/contentScriptJiraAutomation.ts`)
  - 在 Jira Automation 列表页添加"导入到 Personal AI"按钮
  - 识别页面上的 automation 规则
  - 提取规则信息（名称、触发器、动作等）
  
- [ ] **规则导入逻辑** (`src/scheduled-messages/JiraRuleImporter.ts`)
  ```typescript
  interface JiraRuleImportResult {
    imported: number;
    skipped: number;
    errors: string[];
  }
  
  class JiraRuleImporter {
    // 批量导入 Scheduled 类型的规则
    async batchImportScheduledRules(rules: JiraRule[]): Promise<JiraRuleImportResult>
    
    // 单个规则导入
    async importSingleRule(rule: JiraRule): Promise<void>
    
    // 规则转换（Jira Rule → ScheduledMessage）
    private convertJiraRuleToMessage(rule: JiraRule): ScheduledMessage
  }
  ```

- [ ] **UI 集成**
  - 在管理界面添加"从 Jira 导入"按钮
  - 显示导入进度和结果
  - 支持选择性导入（勾选需要导入的规则）

**技术要点**：
- 解析 Jira Automation 规则的 cron 表达式
- 提取 Groovy Script 中的消息内容
- 映射 Jira 规则字段到 ScheduledMessage 格式

**预期完成时间**: 1-2 周

---

##### 2. 每日同步功能 (高优先级) 🎯
**目标**：自动同步 Jira Automation 规则的变更到 Google Sheet

**实现计划**：
- [ ] **Background Service 扩展** (`src/background.ts`)
  ```typescript
  class ScheduledMessageSyncService {
    // 每日同步任务
    async performDailySync(): Promise<SyncResult>
    
    // 检测规则变更
    private async detectChanges(
      localMessages: ScheduledMessage[], 
      jiraRules: JiraRule[]
    ): Promise<ChangeSet>
    
    // 应用变更到 Sheet
    private async applyChanges(changes: ChangeSet): Promise<void>
    
    // 冲突解决策略
    private resolveConflicts(conflicts: Conflict[]): Resolution[]
  }
  ```

- [ ] **Chrome Alarms 配置**
  ```typescript
  // 每天凌晨 2 点执行同步
  chrome.alarms.create('scheduledMessageSync', {
    when: Date.now() + getMillisecondsUntil2AM(),
    periodInMinutes: 24 * 60
  });
  ```

- [ ] **同步策略**
  - **单向同步**：Jira → Sheet（Jira 为主）
  - **变更检测**：
    - 触发时间变更
    - 消息内容变更
    - 状态变更（启用/禁用）
  - **冲突处理**：
    - 记录冲突到日志
    - 用户手动选择保留哪个版本

- [ ] **同步状态展示**
  - 在管理界面显示上次同步时间
  - 显示同步结果（新增/更新/删除数量）
  - 提供手动触发同步的按钮

**预期完成时间**: 1-2 周

---

##### 3. 批量导入 Scheduled 规则 (中优先级) 🔧
**目标**：在 Jira Automation 列表页识别并批量导入 Scheduled 类型的规则

**实现计划**：
- [ ] **规则识别逻辑**
  ```typescript
  interface RuleClassifier {
    // 判断规则是否为 Scheduled 类型
    isScheduledRule(rule: JiraRule): boolean
    
    // 识别规则的触发方式（cron/date/recurring）
    identifyTriggerType(rule: JiraRule): 'Hourly' | 'Daily' | 'Periodic'
    
    // 提取触发时间信息
    extractScheduleInfo(rule: JiraRule): ScheduleInfo
  }
  ```

- [ ] **Content Script 增强**
  - 在 Jira Automation 列表页添加"批量导入"按钮
  - 自动勾选所有 Scheduled 类型的规则
  - 显示预览信息（规则数量、类型分布）

- [ ] **批量导入对话框**
  - 显示待导入规则列表
  - 支持取消勾选不需要的规则
  - 显示每个规则的详细信息（名称、触发时间、动作）
  - 确认导入

**预期完成时间**: 1 周

---

#### Phase 3: 高级功能

##### 4. RingCentral 聊天集成 (低优先级) 📱
**目标**：在 RingCentral 聊天界面中添加一键定时回复功能

**实现计划**：
- [ ] **Content Script 注入** (`src/contentScriptRingCentral.ts`)
  - 在消息输入框旁边添加"⏰ 定时回复"按钮
  - 获取当前聊天上下文（对话人、群组 ID、消息内容）

- [ ] **一键回复对话框**
  ```typescript
  interface QuickReplyDialog {
    // 预填充消息内容（当前输入框内容 或 引用的消息）
    prefillContent: string
    
    // 自动识别推送目标
    autoDetectTarget: {
      type: 'private' | 'group'
      id: string
      name: string
    }
    
    // 快速时间选择
    quickTimeOptions: [
      '5分钟后', '30分钟后', '1小时后', 
      '明天上午9点', '明天下午2点'
    ]
  }
  ```

- [ ] **智能上下文理解**
  - 识别当前对话主题
  - 提取关键信息（项目名、任务 ID 等）
  - 自动填充消息主题

**预期完成时间**: 2-3 周

---

##### 5. AI 建议回复时间 (低优先级) 🤖
**目标**：基于消息内容和上下文，智能建议最佳回复时间

**实现计划**：
- [ ] **AI 分析服务** (`src/scheduled-messages/AIScheduleSuggestion.ts`)
```typescript
  interface AIScheduleSuggestion {
    // 分析消息内容和上下文
    analyzeContext(context: MessageContext): Promise<ScheduleSuggestion>
    
    // 建议时间和理由
    suggestSchedule(message: string): Promise<{
      suggestedTime: Date
      reason: string
      confidence: number
      alternatives: Date[]
    }>
  }
  ```

- [ ] **考虑因素**
  - **消息紧急程度**：根据关键词识别（urgent、ASAP、今天等）
  - **对方工作时间**：避免非工作时间打扰
  - **历史互动模式**：分析与该用户的历史消息时间
  - **消息类型**：
    - 提醒类：提前 5-10 分钟
    - 报告类：工作日上午 9-10 点
    - 问题类：立即或工作时间内
    - 祝福类：节日当天早上

- [ ] **UI 集成**
  - 在创建消息时显示 AI 建议
  - 显示建议理由
  - 一键采用建议时间
  - 显示置信度

**预期完成时间**: 2-3 周

---

##### 6. 完整的 CRUD 操作界面 (中优先级) 🔧
**目标**：在管理界面实现完整的消息创建、编辑、删除功能

**当前状态**：
- ✅ 创建功能已实现
- ✅ 删除功能已实现
- ✅ 状态切换已实现

**待实现**：
- [ ] **编辑功能**
  - 点击消息行或编辑按钮打开编辑对话框
  - 预填充现有数据
  - 支持修改所有字段
  - 保存后更新 Sheet

- [ ] **批量操作**
  - 多选消息
  - 批量删除
  - 批量暂停/启用
  - 批量导出

- [ ] **高级筛选和搜索**
  - 按推送方式筛选（AsMe/Bot）
  - 按消息类型筛选（Daily/Hourly/Periodic）
  - 按状态筛选（Active/Paused/Completed/Error）
  - 按时间范围筛选（今天/本周/本月）
  - 全文搜索（主题、内容）

- [ ] **排序功能**
  - 按创建时间排序
  - 按下次执行时间排序
  - 按执行次数排序
  - 按状态排序

**预期完成时间**: 1-2 周

---

##### 7. Bot 推送失败重试机制 (中优先级) 🔧
**目标**：当 Bot API 调用失败时，自动重试并记录错误

**实现计划**：
- [ ] **Groovy Script 增强** (在 Jira Automation 中)
  ```groovy
  def maxRetries = 3
  def retryDelayMs = 5000 // 5 秒
  
  def sendWithRetry(msg, retries = 0) {
    try {
      // 发送消息
      def response = callBotAPI(msg)
      if (response.success) {
        logger.info("消息发送成功: ${msg.id}")
        return true
      }
    } catch (Exception e) {
      if (retries < maxRetries) {
        logger.warn("发送失败，${retryDelayMs/1000}秒后重试 (${retries+1}/${maxRetries})")
        Thread.sleep(retryDelayMs)
        return sendWithRetry(msg, retries + 1)
      } else {
        logger.error("消息发送失败，已达最大重试次数: ${msg.id}")
        return false
      }
    }
  }
  ```

- [ ] **失败记录**
  - 在 Sheet 中添加"Retry_Count"列
  - 记录失败原因
  - 标记为"Error"状态

- [ ] **失败消息面板**
  - 在管理界面显示失败的消息
  - 提供手动重试按钮
  - 显示失败原因和重试历史

**预期完成时间**: 1 周

---

##### 8. 测试 Bot API 连接功能 (低优先级) 🔧
**目标**：在配置 Bot 时测试 Bot API 是否可访问

**实现计划**：
- [ ] **测试接口**
  ```typescript
  class BotAPITester {
    // 测试 Bot API 连接
    async testConnection(
      endpoint: string, 
      token: string
    ): Promise<TestResult>
    
    // 发送测试消息
    async sendTestMessage(
      endpoint: string,
      token: string,
      targetId: string
    ): Promise<boolean>
  }
  ```

- [ ] **UI 集成**
  - 在 Bot 配置对话框添加"测试连接"按钮
  - 显示测试结果（成功/失败）
  - 显示响应时间
  - 提供发送测试消息功能

**预期完成时间**: 3-5 天

---

### 🧠 记忆系统优化

#### ask() 智能检索系统优化 (高优先级) 🎯

**短期优化（1-2周）**：

1. **🧪 实际测试验证**
   - [ ] 使用真实查询测试 ask() 接口
   - [ ] 验证准确率（目标90-95%）和召回率（目标85-90%）
   - [ ] 收集性能数据和用户反馈
   - 状态：核心功能已完成，需要实际验证

2. **🎨 UI 集成**
   - [ ] 在 memory-exploring.vue 中集成 ask() 接口
   - [ ] 实现搜索结果展示（分类显示实体）
   - [ ] 添加实体详情跳转功能
   - [ ] 展示实体相关度和扩展深度
   - 状态：API 已就绪，等待前端集成

**中期优化（2-4周）**：

1. **💾 缓存优化**
   - [ ] 缓存热门查询结果（LRU策略）
   - [ ] 缓存实体扩展结果
   - [ ] 实现查询建议（基于历史查询）

2. **🔄 重排序机制**
   - [ ] 添加 Cross-Encoder 重排序
   - [ ] 优化实体相关度计算算法
   - [ ] 支持用户反馈学习

**长期优化（1-3个月）**：

1. **🔍 BM25 集成**
   - [ ] 添加关键词精确匹配能力
   - [ ] 混合向量 + BM25 检索
   - [ ] 动态调整混合权重

2. **📊 查询分析系统**
   - [ ] 收集用户查询模式
   - [ ] 优化扩展策略（动态调整2-hop阈值）
   - [ ] 个性化推荐和查询建议

---

## 📅 短期规划 (1-2个月)

### 🎯 用户画像系统扩展

#### 1. 📊 图表数据生成逻辑完善 (高优先级) 🎯
**目标**：为可视化图表实现真实数据生成

**待实现**：
- [ ] 行为趋势图数据计算
  - 按天/周/月聚合行为数据
  - 计算活跃度趋势
  - 识别行为模式变化

- [ ] 兴趣热力图生成
  - 按项目、人员、主题维度生成热力数据
  - 计算权重分布
  - 可视化配置

- [ ] 兴趣权重变化曲线
  - 跟踪关键兴趣点的权重变化
  - 预测未来趋势
  - 标注重要事件

**相关文档**: `docs/features/user_profile_system.md`  
**预期完成时间**: 1-2 周

---

#### 2. 🤖 主动推荐系统完善 (高优先级) 🎯
**目标**：基于用户画像生成个性化推荐

**当前状态**：
- ✅ `generateProactiveRecommendations()` API 已实现
- 🚧 前端展示待开发

**待实现**：
- [ ] 推荐卡片组件
  - 显示推荐内容（文档、任务、人员）
  - 显示推荐理由和相关度
  - 一键操作（查看、保存、忽略）

- [ ] 推荐面板集成
  - 在主界面添加推荐区域
  - 支持刷新推荐
  - 显示推荐历史

- [ ] 用户反馈机制
  - 记录用户点击行为
  - 采集"喜欢/不喜欢"反馈
  - 根据反馈优化推荐算法

**预期完成时间**: 1-2 周

---

#### 3. 🔄 prompt-config 导入导出功能 (中优先级) 🔧
**目标**：完善配置管理功能

**待实现**：
- [ ] 导出功能
  - 导出为 JSON 文件
  - 支持选择性导出（勾选需要的配置）
  - 包含元数据（导出时间、版本等）

- [ ] 导入功能
  - 从 JSON 文件导入
  - 冲突检测和解决
  - 导入预览

- [ ] 模板市场
  - 分享配置模板
  - 浏览和下载社区模板
  - 评分和评论

**相关文档**: `docs/features/custom_prompts.md`  
**预期完成时间**: 1 周

---

### 📊 项目仪表盘系统

#### 1. 📈 趋势预测功能 (高优先级) 🎯
**目标**：基于历史数据预测项目完成时间

**待实现**：
- [ ] 数据收集和预处理
  - 收集历史任务完成数据
  - 计算速度趋势（Velocity）
  - 识别影响因素（节假日、团队变动等）

- [ ] 预测算法
  - 线性回归预测
  - 考虑周期性因素
  - 置信区间计算

- [ ] UI 展示
  - 预测完成时间范围
  - 显示置信度
  - 趋势曲线可视化

**相关文档**: `docs/features/project_dashboard_usage_guide.md`  
**预期完成时间**: 2-3 周

---

#### 2. 🔔 智能提醒系统 (中优先级) 🔧
**目标**：基于规则生成智能提醒

**待实现**：
- [ ] 规则引擎
  - 里程碑临近提醒
  - 任务延期提醒
  - 依赖阻塞提醒
  - 资源瓶颈提醒

- [ ] 提醒配置
  - 自定义提醒规则
  - 设置提醒渠道（浏览器通知、邮件、聊天）
  - 提醒频率控制

- [ ] 提醒面板
  - 显示所有提醒
  - 标记已读/未读
  - 快速操作

**预期完成时间**: 2 周

---

## 🗓️ 中期规划 (2-4个月)

### 👥 团队画像聚合
**目标**：基于个人画像构建团队整体兴趣

**实现计划**：
- [ ] 团队兴趣聚合算法
- [ ] 团队技能图谱
- [ ] 团队协作模式分析
- [ ] 团队推荐引擎

---

### 📈 时序分析功能
**目标**：分析兴趣变化趋势，预测未来关注点

**实现计划**：
- [ ] 时间序列数据存储
- [ ] 趋势识别算法
- [ ] 预测模型训练
- [ ] 可视化展示

---

### 🌐 Web智能分析增强

#### Chrome 本地 AI 集成
**目标**：集成 Chrome 实验性 AI 功能

**技术依赖**：等待 Chrome AI API 稳定

**实现计划**：
- [ ] 集成 Chrome Prompt API
- [ ] 本地 LLM 推理
- [ ] 减少云端 API 调用
- [ ] 提升分析速度和隐私性

**相关文档**: `docs/features/web_intelligence_detailed_explanation.md`

---

### 🎯 消息过滤精度提升
**目标**：将相关性判断准确率从 80% 提升到 95%

**实现计划**：
- [ ] 收集标注数据
- [ ] 训练优化模型
- [ ] A/B 测试验证
- [ ] 用户反馈闭环

**相关文档**: `docs/features/message_analysis_filter.md`

---

### 🤖 AI 驱动的缓存策略
**目标**：使用机器学习优化缓存命中率

**实现计划**：
- [ ] 收集缓存访问模式
- [ ] 训练预测模型
- [ ] 动态调整缓存策略
- [ ] 性能评估

**相关文档**: `docs/memory_system.md`

---

## 🚀 长期规划 (6个月以上)

### 🗄️ 存储架构升级

#### 图数据库迁移（可选）
**目标**：升级为 Neo4j 或 ArangoDB

**优势**：
- 原生图查询能力
- 更高效的关系遍历
- 复杂关系模式支持

**评估标准**：
- 数据规模超过 100 万条实体
- 关系查询成为性能瓶颈
- 需要复杂的图算法（PageRank、社区发现等）

**相关文档**: `docs/features/storage_architecture_recommendations.md`

---

### 🤝 协同过滤推荐
**目标**：基于相似用户推荐内容

**实现计划**：
- [ ] 用户相似度计算
- [ ] 协同过滤算法
- [ ] 冷启动问题解决
- [ ] 推荐解释生成

---

### 🌐 知识图谱构建
**目标**：构建个人知识网络图

**实现计划**：
- [ ] 知识提取算法
- [ ] 知识融合和消歧
- [ ] 图谱可视化
- [ ] 知识推理能力

---

### 🔌 API 开放生态
**目标**：第三方应用集成

**实现计划**：
- [ ] RESTful API 设计
- [ ] API 文档和 SDK
- [ ] 开发者平台
- [ ] 应用市场

---

## 🏗️ 技术架构演进

### 算法层面

- **🤖 机器学习模型**
  - 引入更 sophisticated 的个性化算法
  - 用户行为预测
  - 内容推荐优化

- **📊 预测分析**
  - 项目风险预测
  - 机会识别
  - 资源优化建议

- **🧠 自然语言理解**
  - 更精准的内容分析
  - 多语言支持
  - 上下文理解增强

---

### 架构层面

- **🔧 微服务化**
  - 画像服务独立部署
  - 分析服务拆分
  - 提升可扩展性

- **⚡ 实时计算**
  - 流式处理用户行为数据
  - 实时推荐更新
  - 降低延迟

- **🌐 边缘计算**
  - 本地 AI 推理
  - 减少网络依赖
  - 提升隐私保护

---

### 生态层面

- **🏢 企业版本**
  - 团队和组织级别的画像分析
  - 数据隔离和权限管理
  - 企业级 SLA

- **🔒 隐私保护**
  - 联邦学习
  - 差分隐私
  - 数据加密存储

---

## 📊 优先级总结

### 🚀 即时优先级（1-2周）

1. **⏰ Jira Automation 规则导入** - 完善定时消息管理
2. **⏰ 每日同步功能** - 确保数据一致性
3. **📊 用户画像图表数据生成** - 完善可视化效果
4. **🤖 主动推荐 UI 集成** - 将 API 集成到界面

### 🎯 高优先级（2-4周）

5. **⏰ 完整的 CRUD 操作界面** - 完善消息管理功能
6. **🧠 ask() UI 集成** - 提升检索体验
7. **📈 趋势预测功能** - 增强项目仪表盘
8. **👥 团队画像聚合** - 团队协作分析

### 🔧 中优先级（1-3个月）

9. **⏰ Bot 推送失败重试** - 提升可靠性
10. **⏰ 批量导入 Scheduled 规则** - 简化导入流程
11. **🔔 智能提醒系统** - 主动通知
12. **🎯 消息过滤精度提升** - 优化相关性判断
13. **🤖 AI 驱动的缓存策略** - 性能优化

### 📈 长期规划（6个月以上）

14. **⏰ RingCentral 聊天集成** - 一键定时回复
15. **⏰ AI 建议回复时间** - 智能调度
16. **🗄️ 图数据库升级** - 架构优化
17. **🤝 协同过滤推荐** - 社交化推荐
18. **🌐 知识图谱构建** - 知识网络
19. **🔌 API 开放生态** - 第三方集成

---

## 📝 文档说明

### 相关文档索引

- **定时消息管理**: `docs/features/scheduled_messages_manager.md`
- **用户画像系统**: `docs/features/user_profile_system.md`
- **记忆系统**: `docs/memory_system.md`
- **项目仪表盘**: `docs/features/project_dashboard_usage_guide.md`
- **Web 智能分析**: `docs/features/web_intelligence_detailed_explanation.md`
- **消息分析过滤**: `docs/features/message_analysis_filter.md`
- **Jira 集成**: `docs/features/jira_design_links.md`
- **存储架构**: `docs/features/storage_architecture_recommendations.md`
- **自定义 Prompts**: `docs/features/custom_prompts.md`

---

*本路线图持续更新，反映项目的最新进展和规划。*
