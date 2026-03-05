# Memory Service 迁移方案

> 生成日期: 2026-02-25 | 更新日期: 2026-02-26
> 目的: 将旧的 Chrome 扩展内存记忆系统（memory.ts + CloudStorage + LocalStorage）迁移到独立后端 memory-service

---

## 0. 多用户架构（✅ 已实现）

### 实现状态

memory-service 已完成 Per-User Database + Directory 方案，每个用户拥有完全独立的存储空间。

| 组件 | 文件 | 状态 | 说明 |
|------|------|------|------|
| **UserContextManager** | `src/core/UserContextManager.ts` | ✅ | 管理 userId → {db, database, userDataManager, profileManager} 映射，懒加载，30min 空闲回收 |
| **认证中间件** | `src/middleware/auth.ts` | ✅ | 从 `X-User-Id` header 提取 userId，缺省回退 `"default"`，正则校验防路径遍历 |
| **路由改造** | 所有 `src/routes/*.ts` | ✅ | 全部改为从 `request.userContext` 获取 per-user db/userDataManager/profileManager |
| **ProactiveScheduler** | `src/core/ProactiveScheduler.ts` | ✅ | 通过 `ucm.getRegisteredUserIds()` 遍历所有用户目录，逐用户执行心跳/整合/做梦 |
| **UserDataManager** | `src/storage/UserDataManager.ts` | ✅ | 不再使用 singleton，每个 UserContext 独立实例，根目录为 `data/users/{userId}/` |
| **Server 启动** | `src/server.ts` | ✅ | 创建 UserContextManager → 注册 auth 中间件 → 路由 → ProactiveScheduler(ucm) → shutdown 时 closeAll() |
| **Fastify 类型扩展** | `src/types/index.ts` | ✅ | `FastifyRequest` 增加 `userId: string` 和 `userContext: UserContext` |
| **数据迁移脚本** | `scripts/migrate-to-multiuser.ts` | ✅ | 将旧单用户 `data/` 布局迁移到 `data/users/{userId}/` |
| **迁移测试** | `src/__tests__/migrate-to-multiuser.test.ts` | ✅ |  |

### 数据目录结构

```
data/
├── users/
│   ├── default/                        ← 未传 X-User-Id 时的默认用户
│   │   ├── memory.db                   ← 独立 SQLite（消息/实体/关系/记忆元数据/画像）
│   │   ├── CORE_MEMORY.md
│   │   ├── USER_CORE.md               ← 用户画像渲染（ProfileManager 生成）
│   │   ├── WATCHED_PROJECTS.md
│   │   ├── daily/                      ← 每日日志
│   │   ├── projects/                   ← 项目摘要
│   │   ├── entities/                   ← 实体档案（people/topics/orgs/tech）
│   │   ├── skills/
│   │   ├── reflections/                ← 反思
│   │   └── dreams/                     ← 做梦
│   │
│   └── user_abc123/                    ← 其他用户（完全隔离）
│       ├── memory.db
│       └── ... (同上结构)
```

### 请求流程

```
Client ──(X-User-Id: alice)──→ Fastify
                                  │
                           auth middleware
                            ├─ 校验 userId 格式（/^[a-zA-Z0-9._-]+$/）
                            ├─ request.userId = "alice"
                            └─ request.userContext = ucm.getContext("alice")
                                  │
                            UserContextManager
                            ├─ 缓存命中 → 返回已有 context
                            └─ 缓存未命中 → 创建:
                                 ├─ data/users/alice/memory.db (SQLite + migrations)
                                 ├─ UserDataManager(data/users/alice/)
                                 ├─ ProfileManager(db) + ensureSeedProfiles()
                                 └─ 缓存到 Map，设置 lastAccessedAt
                                  │
                            Route Handler
                            ├─ const { db, userDataManager, profileManager } = request.userContext;
                            └─ new IngestionPipeline(db, userDataManager, ...) / RecallEngine(db) / ...
```

### ~~⚠️ 多用户遗留问题~~（✅ 已修复，除认证外）

| 问题 | 位置 | 状态 | 修复方式 |
|------|------|------|---------|
| ~~ConsolidationEngine USER_CORE.md 路径~~ | `core/ConsolidationEngine.ts` | ✅ 已修复 | 改用 `this.userDataManager.writeFile('USER_CORE.md', ...)` |
| ~~HeartbeatLoop USER_CORE.md 路径~~ | `core/HeartbeatLoop.ts` | ✅ 已修复 | 添加 UserDataManager 参数 + per-user 路径 |
| ~~EventBus/SSE 无用户过滤~~ | `routes/events.ts` | ✅ 已修复 | 按 userId 过滤 SSE 事件 |
| ~~Config 路由全局共享~~ | `routes/config.ts` | ✅ 已修复 | 改用 per-user 配置路径 |
| ~~Ask 路由路径硬编码~~ | `routes/ask.ts` | ✅ 已修复 | 使用 `request.userContext.userDataManager` |
| ~~MarkdownManager 单例~~ | `core/MarkdownManager.ts` | ✅ 已修复 | 改为 per-dataDir Map |
| **无真实认证** | `middleware/auth.ts` | 🟡 待定 | 需添加 token/API key 校验（非功能性，可后续处理） |

---

## 1. 架构变更总览

```
旧架构:
Chrome Extension ──直连──→ ChromaDB (向量数据库)
       └─ chrome.storage.local (本地缓存)

新架构（多用户）:
Chrome Extension ──HTTP (+X-User-Id)──→ Memory Service (Fastify, port 3210)
                                              │
                                        UserContextManager
                                         ├─ alice/ → {db, udm, pm}
                                         └─ bob/   → {db, udm, pm}
                                              │
                                        每用户独立:
                                         ├─ SQLite + sqlite-vec + FTS5
                                         ├─ Markdown (日志/实体/项目/反思)
                                         ├─ Human Model (user_profile_items)
                                         ├─ Agent Model (IDENTITY/SOUL/POLICY)
                                         └─ Proactive Loop (心跳/整合/做梦)
```

**关键变化：**
- 存储从 ChromaDB 迁移到 SQLite + sqlite-vec（本地嵌入 Xenova/all-MiniLM-L6-v2）
- Chrome 扩展不再直接操作数据库，通过 `MemoryServiceClient` HTTP 调用
- 新增记忆生命周期管理：显著性评分、遗忘衰减、整合压缩、真值维护
- 新增主动循环：心跳(15min) + 日整合(23:00) + 周做梦(周日03:00)
- 新增 Dual Persona 系统：Human Model（用户画像）+ Agent Model（AI persona）
- **每用户独立存储空间**：独立 SQLite + 独立 Markdown 目录 + 独立 Agent Persona

---

## 2. 涉及文件清单（共 30+ 个文件）

### 2.1 核心记忆系统（需要重写/废弃）

| 文件 | 当前角色 | 迁移后状态 |
|------|---------|-----------|
| `src/memory.ts` | 统一接口层（3660行） | **废弃** → 用 `MemoryServiceClient` 替代 |
| `src/storage/CloudStorage.ts` | ChromaDB 直连存储（4400行） | **废弃** → 后端 IngestionPipeline/RecallEngine 替代 |
| `src/storage/LocalStorage.ts` | chrome.storage 本地缓存（1585行） | **废弃** → 后端自带缓存，或保留极轻量本地缓存 |
| `src/storage/EntitySimilarityTool.ts` | 实体去重合并 | **废弃** → 后端 IngestionPipeline 内置去重 |
| `src/storage/SystemMaintenanceTool.ts` | 系统维护 | **废弃** → 后端 HeartbeatLoop + ConsolidationEngine |
| `src/storage/EntityRebuildTool.tsx` | 实体重建工具 | **废弃** → 后端 ConsolidationEngine.reindex |
| `src/storage/EntityEmbeddingRebuildTool.tsx` | 嵌入重建 | **废弃** → 后端 MarkdownManager.reindexFile |
| `src/storage/V6DataMigrationTool.tsx` | V6 数据迁移 | **保留** → 一次性迁移工具，迁移完成后移除 |
| `src/embeddings.ts` | Offscreen 嵌入生成 | **废弃** → 后端 EmbeddingClient 本地嵌入 |

### 2.2 需要改造的业务文件

| 文件 | 旧调用 | 新调用 | 改造难度 |
|------|--------|--------|---------|
| `src/messageDealing.ts` | `memorySystem.storeMessage()`, `cloudStorage.getMessageByPostId()` | `client.ingest()`, 去重由后端处理 | ⭐⭐ 中等 |
| `src/background.ts` | `memorySystem.ask()`, `storeMessage()`, `performHealthCheck()`, `updateUserProfile()` | `client.ask()`, `client.ingest()`, `client.getHealth()` | ⭐⭐⭐ 较高 |
| `src/agentThinking.ts` | `cloudStorage.getSimilarMessages()` | `client.recall()` | ⭐ 简单 |
| `src/agentWorkflow.ts` | `cloudStorage.getSimilarMessages()`, `getAllKnownPeople()`, `getAllKnownProjects()`, `storeMessage()` | `client.recall()`, `client.getEntities('Person')`, `client.getEntities('Project')`, `client.ingest()` | ⭐⭐ 中等 |
| `src/llm.ts` | `memorySystem.ask()`, `cloudStorage.getSimilarMessages()`, `getAllKnownPeople/Projects/Topics()` | `client.ask()`, `client.recall()`, `client.getEntities()` | ⭐⭐ 中等 |
| `src/services/TaskScheduler.ts` | `memorySystem.syncCache()`, `performHealthCheck()`, `performSystemMaintenance()`, `applyUserProfileDecay()`, `CloudStorage` 独立实例 | `client.getHealth()`, `client.getStats()`, 后端 ProactiveScheduler 自动处理 | ⭐⭐ 中等 |
| `src/message-reaction/FollowThreadHandler.ts` | `memorySystem.cloudStorage` (ChromaDB follow thread 存储) | `client.ingest()` + metadata | ⭐⭐ 中等 |
| `src/proactive-notifications/TaskProcessors.ts` | `cloudStorage.getSimilarMessages()` | `client.recall()` | ⭐ 简单 |
| `src/modals/memory-exploring-messageHandler.ts` | `cloudStorage.queryEntities()`, `searchByVector()`, `getEntity()`, `updateEntity()`, `storeEntity()`, `getTimeline()`, `localStorage.*` | `client.getEntities()`, `client.getEntityDetail()`, `client.recall()` | ⭐⭐⭐ 较高 |
| `src/modals/memory-store.ts` | `memorySystem.ask()` | `client.ask()` | ⭐ 简单 |
| `src/utils/dashboardIntegration.ts` | `cloudStorage.getSimilarMessages()`, `getAllKnownProjects()` | `client.recall()`, `client.getWatchedProjects()` | ⭐ 简单 |
| `src/components/dashboard/ProjectDashboard.tsx` | `cloudStorage.getAllKnownProjects()` | `client.getWatchedProjects()` | ⭐ 简单 |

### 2.3 用户画像相关（后端 API ✅ 已实现，前端尚未切换）

> **状态更新**：memory-service 后端已完整实现 Dual Persona 系统（见第 6 节），但扩展端仍然通过旧的 `CloudStorage` + `UserProfileManager` 操作 ChromaDB。`MemoryServiceClient.ts` 尚未添加 profile/agent 相关方法。

| 文件 | 当前状态 | 需要的改造 |
|------|---------|-----------|
| `src/services/MemoryServiceClient.ts` | ⚠️ 无 profile/agent 方法 | 新增 profile items / social / opinions / agent persona 方法 |
| `src/services/UserProfileManager.ts` | ❌ 仍用 `CloudStorage` (ChromaDB) | **废弃** → 后端 IngestionPipeline + OnlineReflection 自动提取画像 |
| `src/services/UserProfileQueryService.ts` | ❌ 仍用 `CloudStorage` | **废弃** → 改用 `client.getProfileItems()` |
| `src/services/UserProfileMessageHandler.ts` | ❌ 仍用 `memorySystem.*` | 改用 `MemoryServiceClient` 的 profile 方法 |
| `src/services/UserProfileDemo.ts` | ❌ 仍用 `CloudStorage` + `UserProfileManager` | **废弃** 或改为调用新 API |
| `src/web-intelligence/WebIntelligenceAnalyzer.ts` | ❌ 仍用 `new UserProfileManager()` | 改用 `MemoryServiceClient` |
| `src/modals/components/UserProfilePage.vue` | ❌ 通过旧的消息处理 | 改为直接调用 `MemoryServiceClient` |
| `src/tests/testUserProfile.ts` | ❌ 仍用旧 API | 改为调用新 API 或移除 |

---

## 3. 新旧 API 映射表

### 3.1 已覆盖（可直接迁移）

| 旧 API | 新 API (MemoryServiceClient) | 说明 |
|--------|------------------------------|------|
| `memorySystem.initialize()` | 无需调用，后端始终在线 | 移除所有 initialize 调用 |
| `memorySystem.storeMessage({id, content, metadata})` | `client.ingest({ content, sourceType, sender, groupId, ... })` | 元数据格式需适配 |
| `cloudStorage.getMessageByPostId(postId)` | 后端 IngestionPipeline 自动去重 | 无需前端去重 |
| `cloudStorage.getSimilarMessages(query, options)` | `client.recall(query, { topK, channels, timeRange })` | channels 可选 vector/fts/graph/time |
| `memorySystem.ask(question)` | `client.ask(query, context, includeEvidence)` | 返回格式需适配 |
| `cloudStorage.getAllKnownPeople()` | `client.getEntities('Person')` | 返回 EntityListResponse |
| `cloudStorage.getAllKnownProjects()` | `client.getEntities('Project')` 或 `client.getWatchedProjects()` | 两个 API 可选 |
| `cloudStorage.getAllKnownTopics()` | `client.getEntities('Topic')` | 返回 EntityListResponse |
| `cloudStorage.queryEntities(type, query, options)` | `client.getEntities(type, search, limit, offset)` | 参数格式略有差异 |
| `cloudStorage.getEntity(entityId)` | `client.getEntityDetail(id)` | 返回 EntityDetailResponse |
| `cloudStorage.searchByVector(query, type, options)` | `client.recall(query, { entityTypes, channels: ['vector'] })` | 限定 vector 通道 |
| `memorySystem.performHealthCheck()` | `client.getHealth()` | 返回 HealthResponse |
| `memorySystem.performSystemMaintenance()` | 后端 ProactiveScheduler 自动执行 | 无需前端触发 |
| `memorySystem.syncCache()` | 后端自带，无需同步 | 移除调用 |
| `localStorage.getEntityStatistics()` | `client.getStats()` | 返回 StatsResponse |
| `localStorage.clearExpiredCache()` | 后端 ForgettingEngine 自动处理 | 移除调用 |

### 3.2 部分覆盖（需适配）

| 旧 API | 新 API | 差异说明 |
|--------|--------|---------|
| `cloudStorage.updateEntity(id, data)` | 无直接 API | ⚠️ memory-service 需新增 `PUT /entities/:id` |
| `cloudStorage.storeEntity(entity)` | 通过 `ingest()` 间接创建 | ⚠️ 无直接创建实体 API，需新增 `POST /entities` |
| `cloudStorage.getTimeline(limit)` | `client.getEntityTimeline(id)` | 旧 API 是全局时间轴，新 API 是单实体时间轴 |
| `memorySystem.getEntityTypes()` | `client.getStats()` → `entities.byType` | 需从统计数据推导 |
| `memorySystem.getEntityDetails(id)` | `client.getEntityDetail(id)` + `client.getEntityRelationships(id)` | 需组合两个 API |
| `localStorage.cacheEntity(entity)` | 无需（后端管理） | 或保留轻量本地缓存 |

### 3.3 用户画像：后端 API 已就位，需在 MemoryServiceClient 中添加方法

> 以下 API 在 memory-service 后端 **已实现**，但 `MemoryServiceClient.ts` 中 **尚未封装** 对应方法。

| 旧 API (前端) | 后端 API (已实现) | Client 方法 (需新增) | 状态 |
|--------------|-------------------|---------------------|------|
| `storeUserprofilesRecord(record)` | `POST /api/v1/profile/items` | `client.createProfileItem(body)` | 🔧 需加到 Client |
| `queryUserprofiles(options)` | `GET /api/v1/profile/items?type=&status=&key=` | `client.getProfileItems(filters)` | 🔧 需加到 Client |
| `updateUserProfile(update)` | `PUT /api/v1/profile/items/:id` | `client.updateProfileItem(id, body)` | 🔧 需加到 Client |
| — | `DELETE /api/v1/profile/items/:id` | `client.deleteProfileItem(id)` | 🔧 需加到 Client |
| — | `POST /api/v1/profile/items/:id/confirm` | `client.confirmProfileItem(id)` | 🔧 需加到 Client |
| `getUserProfile()` | `GET /api/v1/profile/core` | `client.getUserCore()` | 🔧 需加到 Client |
| — | `GET /api/v1/profile/social` | `client.getSocialEdges(limit, offset)` | 🔧 需加到 Client |
| — | `POST /api/v1/profile/social` | `client.createSocialEdge(body)` | 🔧 需加到 Client |
| — | `GET /api/v1/profile/opinions` | `client.getOpinions(filters)` | 🔧 需加到 Client |
| — | `POST /api/v1/profile/opinions/:id/confirm` | `client.confirmOpinion(id, action)` | 🔧 需加到 Client |
| — | `GET /api/v1/agent/:kind` | `client.getAgentProfile(kind)` | 🔧 需加到 Client |
| — | `PUT /api/v1/agent/:kind` | `client.updateAgentProfile(kind, content)` | 🔧 需加到 Client |
| — | `GET /api/v1/agent/:kind/history` | `client.getAgentHistory(kind, limit)` | 🔧 需加到 Client |

### 3.4 旧画像 API → 新系统的迁移映射

> 旧的 UserProfileManager 概念与新的 Dual Persona 在模型层面完全不同。旧系统将画像作为 ChromaDB 向量记录；新系统将画像拆分为 `user_profile_items`（事实/偏好/习惯/兴趣/约束）+ `social_edges`（社交关系）+ `opinion_items`（观点态度），并由 IngestionPipeline **自动从消息中提取**。

| 旧 API | 新系统替代方案 | 说明 |
|--------|--------------|------|
| `getUserProfile()` | `GET /profile/core` 返回 USER_CORE.md | 后端自动从 profile items 渲染 |
| `updateUserProfile(update)` | `POST /profile/items` + `PUT /profile/items/:id` | 用户显式添加/更新 |
| `setUserExplicitImportance(id, type, val)` | `PUT /profile/items/:id` (修改 salienceScore) | 更新 salience 即可 |
| `getFusedUserProfile()` | `GET /profile/core` + `GET /profile/social` | 组合两个 API |
| `fuseUserContextConfig(config)` | 无直接对应 | ⚠️ 考虑是否仍需要此功能 |
| `adaptiveWeightAdjustment()` | 后端 ConsolidationEngine 自动处理 | 无需前端触发 |
| `applyUserProfileDecay()` | 后端 ForgettingEngine 自动衰减 salience | 无需前端触发 |
| `storeIndependentUserConfig(config)` | `POST /profile/items` (itemType='preference') | 用配置项作为偏好存储 |
| `getIndependentUserConfig()` | `GET /profile/items?type=preference` | 按类型过滤 |
| `generateProactiveRecommendations()` | 后端 ProactivityPolicy + HeartbeatLoop | 无需前端触发 |
| `searchByVector(query)` (画像相关) | `POST /recall` (channels: ['vector']) | 统一走 recall |
| `findSimilarUsers(userId, query)` | 无对应 | 多用户系统中每用户数据隔离，不支持跨用户搜索 |
| 自动画像提取 | IngestionPipeline `profile_candidates` | ✅ 消息 ingest 时自动提取 |
| 画像整合 | ConsolidationEngine 合并重复项 + 重建 USER_CORE.md | ✅ 每日整合自动执行 |
| 画像冲突检测 | TruthMaintainer 检测 `user_profile_items` 冲突 | ✅ 心跳循环自动执行 |

### 3.5 仍需 memory-service 新增的 API

| API | 方法 | 路径 | 说明 | 优先级 |
|-----|------|------|------|--------|
| 更新实体 | PUT | `/api/v1/entities/:id` | 支持更新 tags、status、description 等 | P1 |
| 创建实体 | POST | `/api/v1/entities` | 手动创建实体（UI 场景） | P1 |
| 全局时间轴 | GET | `/api/v1/timeline` | 跨实体的最近活动时间轴 | P2 |

---

## 4. 推荐迁移顺序

### ~~Phase 0: 多用户架构~~（✅ 已完成）

> 已实现 Per-User Database + Directory 方案，详见第 0 节。

### ~~Phase 0.1: 多用户遗留 bug 修复~~（✅ 已完成）

> 已修复 6 个多用户 bug：
> - ConsolidationEngine USER_CORE.md 路径 → 使用 `this.userDataManager.writeFile()`
> - HeartbeatLoop USER_CORE.md 路径 → 添加 UserDataManager 参数，使用 per-user 路径
> - EventBus/SSE 用户过滤 → 按 userId 过滤事件
> - config.ts 全局配置 → 改为 per-user 配置路径
> - ask.ts 硬编码路径 → 使用 `request.userContext.userDataManager`
> - MarkdownManager 单例 → 改为 per-dataDir Map

### ~~Phase 1: 核心消息流~~（✅ 已完成）

**目标**：让消息的存储和检索走新系统

| 步骤 | 文件 | 改造内容 |
|------|------|---------|
| 1.1 | `src/messageDealing.ts` | 将 `memorySystem.storeMessage()` 替换为 `client.ingest()`，移除 `cloudStorage.getMessageByPostId()` 去重（后端自动处理） |
| 1.2 | `src/agentThinking.ts` | 将 `cloudStorage.getSimilarMessages()` 替换为 `client.recall()` |
| 1.3 | `src/agentWorkflow.ts` | 将 `getSimilarMessages/getAllKnownPeople/getAllKnownProjects/storeMessage` 替换为 `client.recall()/getEntities()/ingest()` |
| 1.4 | `src/llm.ts` | 将 `memorySystem.ask()` 替换为 `client.ask()`，实体查询走 `client.getEntities()` |
| 1.5 | `src/background.ts` | 将 `ask/storeMessage/performHealthCheck` 替换，移除 `initialize()` 调用 |

> **注意**：所有前端 `MemoryServiceClient` 调用需要在 header 中设置 `X-User-Id`，确保数据存入正确用户的独立空间。

**改造示例 (messageDealing.ts)**:

```typescript
// 旧代码
import { memorySystem, StoreResult } from './memory';
await memorySystem.initialize();
const storeResult = await memorySystem.storeMessage({
  id: messageId,
  content: originalMessage.messageContent,
  metadata: messageMetadata
});

// 新代码
import { getMemoryServiceClient } from './services/MemoryServiceClient';
const client = getMemoryServiceClient();
const ingestResult = await client.ingest({
  content: originalMessage.messageContent,
  sourceType: 'glip',
  sender: messageMetadata.sender,
  groupId: messageMetadata.groupId,
  groupName: messageMetadata.groupName,
  sourceUrl: messageMetadata.groupUrl,
  timestamp: Math.floor(messageMetadata.datetime / 1000),
  metadata: {
    postId: postId,
    matchedRules: messageMetadata.matchedRules,
    summary: messageMetadata.summary,
    userRelationType: messageMetadata.user_relation_type,
    sentiment: messageMetadata.metadata?.sentiment,
    priority: messageMetadata.metadata?.priority,
    replyAdvice: messageMetadata.replyAdvice
  }
});
```

**改造示例 (agentThinking.ts)**:

```typescript
// 旧代码
await memorySystem.initialize();
const similarMessages = await memorySystem.cloudStorage.getSimilarMessages(query, {
  limit: 5,
  minRelevanceScore: 0.6,
  timeRange: { start, end }
});

// 新代码
const client = getMemoryServiceClient();
const recallResult = await client.recall(query, {
  topK: 5,
  channels: ['vector', 'fts'],
  timeRange: { start, end },
  minSalience: 0.3
});
```

### ~~Phase 2: 通知与任务调度~~（✅ 已完成）

| 步骤 | 文件 | 状态 |
|------|------|------|
| 2.1 | `src/proactive-notifications/TaskProcessors.ts` | ✅ `getSimilarMessages()` → `client.recall()` |
| 2.2 | `src/services/TaskScheduler.ts` | ✅ 移除 CloudStorage 实例，syncCache/maintenance → no-op（后端自动处理） |
| 2.3 | `src/message-reaction/FollowThreadHandler.ts` | ✅ `cloudStorage` → `client.ingest()` + `client.recall()` |

### ~~Phase 3: UI 模态框~~（✅ 已完成）

| 步骤 | 文件 | 状态 |
|------|------|------|
| 3.1 | `src/modals/memory-store.ts` | ✅ `memorySystem.ask()` → `client.ask()` |
| 3.2 | `src/modals/memory-exploring-messageHandler.ts` | ✅ 替换所有 `cloudStorage/localStorage` → `client.*` (14 handlers) |
| 3.3 | `src/utils/dashboardIntegration.ts` | ✅ `getSimilarMessages/getAllKnownProjects` → `client.recall/getEntities` |
| 3.4 | `src/components/dashboard/ProjectDashboard.tsx` | ✅ `getAllKnownProjects` → `client.getEntities('Project')` |

**待补充 API**（非阻塞，已用 `client.ingest()` + TODO 注释替代）：
- `PUT /api/v1/entities/:id` — 更新实体
- `POST /api/v1/entities` — 直接创建实体

### ~~Phase 4: 用户画像系统~~（✅ 已完成）

| 步骤 | 文件 | 状态 |
|------|------|------|
| 4.1 | ~~memory-service routes/profile.ts~~ | ✅ |
| 4.2 | ~~memory-service routes/agent.ts~~ | ✅ |
| 4.3 | ~~memory-service core/ProfileManager.ts~~ | ✅ |
| 4.4 | ~~memory-service 002_profiles.sql~~ | ✅ |
| 4.5 | ~~memory-service 多用户画像隔离~~ | ✅ |
| 4.6 | `src/services/MemoryServiceClient.ts` | ✅ 新增 13 个 profile/agent/social/opinion 方法 |
| 4.7 | `src/services/UserProfileMessageHandler.ts` | ✅ 全部 10 个 handler 迁移到 `client.*` |
| 4.8 | `src/background.ts` | ✅ 迁移到 `client.ingest/ask/getHealth/createProfileItem` |
| 4.9 | `src/services/UserProfileManager.ts` | 待废弃（无活跃调用者） |
| 4.10 | `src/services/UserProfileQueryService.ts` | 待废弃（无活跃调用者） |
| 4.11 | `src/services/UserProfileDemo.ts` | 待废弃（无活跃调用者） |
| 4.12 | `src/web-intelligence/WebIntelligenceAnalyzer.ts` | ✅ `UserProfileManager` → `client.*` |
| 4.13 | `src/modals/components/UserProfilePage.vue` | ⚠️ 待迁移（Vue 组件，需单独处理） |

### Phase 5: 清理废弃代码 ✅ 已完成

| 步骤 | 文件 | 操作 |
|------|------|------|
| 5.1 | `src/memory.ts` | ✅ 已删除 |
| 5.2 | `src/storage/CloudStorage.ts` | ✅ 已删除 |
| 5.3 | `src/storage/LocalStorage.ts` | ✅ 已删除 |
| 5.4 | `src/storage/EntitySimilarityTool.ts` | ✅ 已删除 |
| 5.5 | `src/storage/SystemMaintenanceTool.ts` | ✅ 已删除 |
| 5.6 | `src/storage/EntityRebuildTool.tsx` | ✅ 已删除 |
| 5.7 | `src/storage/EntityEmbeddingRebuildTool.tsx` | ✅ 已删除 |
| 5.8 | `src/services/UserProfileManager.ts` | ✅ 已删除 |
| 5.9 | `src/services/UserProfileQueryService.ts` | ✅ 已删除 |
| 5.10 | `src/services/UserProfileDemo.ts` | ✅ 已删除 |
| 5.11 | `src/embeddings.ts` + `src/offscreen.ts` + `static/offscreen.html` | ✅ 已删除 |
| 5.12 | `docker-compose.yml` | ✅ 已移除 ChromaDB 服务（仅保留 memory-service） |
| 5.13 | `src/manifest.json` | ✅ 已移除 offscreen 权限和 offscreen.html 资源 |
| 5.14 | `src/types/userProfile.ts` | ✅ 已删除 |
| 5.15 | `src/storage/DatabaseMaintenanceTool.tsx` | ✅ 已删除 |
| 5.16 | `src/storage/V6DataMigrationTool.tsx` | ✅ 已删除 |
| 5.17 | `src/tests/testEntityTypes.ts` | ✅ 已删除 |
| 5.18 | `src/tests/testUserProfile.ts` | ✅ 已删除 |
| 5.19 | `src/options.tsx` | ✅ 已移除废弃工具导入、向量数据库设置 UI、数据库维护 UI、UserProfileDemoTool 组件 |
| 5.20 | `src/background.ts` | ✅ 已移除 embeddings.ts 导入、offscreen 文档创建、EXEC_EMBEDDING_REQUEST handler |
| 5.21 | `src/storage/` 目录 | ✅ 已删除（空目录） |

---

## 5. 当前 MemoryServiceClient 缺失的方法

`src/services/MemoryServiceClient.ts` 需要新增以下方法才能支持 Phase 4：

```typescript
// === Profile Items (Human Model) ===
getProfileItems(filters?: {
  type?: string; status?: string; key?: string;
  confirmedOnly?: boolean; limit?: number; offset?: number;
}): Promise<{ items: ProfileItem[]; total: number }>;

createProfileItem(body: {
  itemType: string; itemKey: string; itemValue: string;
  evidenceRefs?: unknown[]; confidence?: number;
}): Promise<ProfileItem>;

updateProfileItem(id: string, body: {
  itemValue?: string; confidence?: number;
  salienceScore?: number; status?: string;
}): Promise<ProfileItem>;

deleteProfileItem(id: string): Promise<{ id: string; deleted: boolean }>;

confirmProfileItem(id: string): Promise<ProfileItem>;

getUserCore(): Promise<{ content: string }>;

// === Social Edges ===
getSocialEdges(limit?: number, offset?: number):
  Promise<{ items: SocialEdge[]; total: number }>;

createSocialEdge(body: {
  fromEntityId: string; toEntityId: string;
  relationType: string; strength?: number;
}): Promise<SocialEdge>;

// === Opinions ===
getOpinions(filters?: {
  status?: string; dimension?: string;
  limit?: number; offset?: number;
}): Promise<{ items: OpinionItem[]; total: number }>;

confirmOpinion(id: string, action: 'accept' | 'reject'):
  Promise<OpinionItem>;

// === Agent Profile (Agent Model) ===
getAgentProfile(kind: 'identity' | 'soul' | 'policy'):
  Promise<{ kind: string; content: string; updatedAt: number }>;

updateAgentProfile(kind: string, content: string, rationale?: string):
  Promise<{ id: string; kind: string }>;

getAgentHistory(kind: string, limit?: number):
  Promise<{ kind: string; versions: AgentProfileVersion[] }>;
```

> **多用户注意**：`MemoryServiceClient` 需在所有请求的 header 中设置 `X-User-Id`，以确保后端路由到正确用户的独立空间。

---

## 6. memory-service 后端实现现状

### 6.1 多用户架构（✅ 已实现）

| 组件 | 文件 | 功能 |
|------|------|------|
| **UserContextManager** | `core/UserContextManager.ts` | per-user context 懒加载/缓存/空闲回收（30min），提供 {db, database, userDataManager, profileManager} |
| **Auth 中间件** | `middleware/auth.ts` | `X-User-Id` header → userId → `request.userContext`；缺省 `"default"`；校验 `/^[a-zA-Z0-9._-]+$/` |
| **Fastify 类型扩展** | `types/index.ts` | `FastifyRequest` 增加 `userId`、`userContext` |
| **ProactiveScheduler** | `core/ProactiveScheduler.ts` | `ucm.getRegisteredUserIds()` → 逐用户执行心跳/整合/做梦 |
| **数据迁移** | `scripts/migrate-to-multiuser.ts` | 旧 flat 布局 → `data/users/{userId}/` |

### 6.2 Dual Persona 系统（✅ 已实现）

| 组件 | 文件 | 功能 |
|------|------|------|
| **数据库 Schema** | `002_profiles.sql` | `user_profile_items`, `social_edges`, `opinion_items`, `agent_profile_versions`, `profile_sync_state` |
| **Profile API** | `routes/profile.ts` | 10 个端点：profile items CRUD + confirm + USER_CORE.md + social edges + opinions |
| **Agent API** | `routes/agent.ts` | 3 个端点：agent persona 读取/更新/历史 |
| **ProfileManager** | `core/ProfileManager.ts` | Agent persona seed/CRUD + USER_CORE.md 渲染，per-user 实例 |
| **自动画像提取** | `core/IngestionPipeline.ts` | LLM 提取 `profile_candidates` → 写入 `user_profile_items` + 设置 `profile_dirty` |
| **在线反思** | `core/OnlineReflection.ts` | `/ask` 后自动提取用户偏好和事实 → 写入 `user_profile_items` |
| **日整合** | `core/ConsolidationEngine.ts` | 合并重复画像项 + 重建 USER_CORE.md |
| **心跳刷新** | `core/HeartbeatLoop.ts` | 检测 `profile_dirty` → 重建 USER_CORE.md |
| **兴趣相关度** | `core/SalienceScorer.ts` | 基于 `user_profile_items` 中 interests 计算消息与用户兴趣的相关度 |
| **冲突检测** | `core/TruthMaintainer.ts` | 检测 `user_profile_items` 中矛盾的属性 |
| **通知决策** | `core/ProactivityPolicy.ts` | 基于 `user_profile_items` 中偏好计算通知的用户对齐度 |
| **观点提取** | `core/IngestionPipeline.ts` | 情感检测 → 自动创建 `opinion_items` (status=pending_confirm) |

### 6.3 核心引擎多用户就绪状态

| 引擎 | DB 来源 | 多用户就绪 | 说明 |
|------|---------|-----------|------|
| ProactiveScheduler | UserContextManager | ✅ | 遍历所有注册用户 |
| IngestionPipeline | 构造函数 db + udm | ✅ | 路由传入 request.userContext |
| RecallEngine | 构造函数 db | ✅ | 路由传入 request.userContext.db |
| ProfileManager | 构造函数 db | ✅ | 每用户独立实例 |
| ConsolidationEngine | 构造函数 db + udm | ⚠️ 部分 | USER_CORE.md 路径 bug |
| HeartbeatLoop | 构造函数 db | ⚠️ 部分 | 缺少 UserDataManager 参数，USER_CORE.md 路径 bug |
| GenerativeReplay | 构造函数 db + udm | ✅ | ProactiveScheduler 传入 ctx |
| ForgettingEngine | 构造函数 db | ✅ | |
| SalienceScorer | 构造函数 db | ✅ | |
| TruthMaintainer | 构造函数 db | ✅ | |
| ProactivityPolicy | 构造函数 db | ✅ | |
| ExportEngine | 构造函数 db + udm | ✅ | |

### 6.4 数据流：画像如何自动生成（多用户）

```
消息 ingest (X-User-Id: alice)
   → auth middleware → request.userContext = ucm.getContext("alice")
   → IngestionPipeline(alice.db, alice.udm)
        ├─ LLM 提取 profile_candidates
        │    └─ 写入 alice.db → user_profile_items (source_kind='inferred')
        ├─ 情感分析 + Person 实体 → alice.db → opinion_items (pending_confirm)
        └─ 设置 alice.db → profile_sync_state.profile_dirty = 1

ProactiveScheduler (定时遍历所有用户)
   → for userId of ucm.getRegisteredUserIds():
       ctx = ucm.getContext(userId)
       HeartbeatLoop(ctx.db) → 检测 profile_dirty → ProfileManager.renderUserCore()
                                                       → 输出 USER_CORE.md (⚠️ 路径 bug)

每日 23:00 → ConsolidationEngine(ctx.db, ctx.udm) per user
                ├─ 合并重复 profile items
                ├─ 重建 USER_CORE.md (⚠️ 路径 bug)
                └─ 重置 profile_dirty = 0
```

---

## 7. 已发现的 Bug/问题

| 问题 | 位置 | 优先级 | 说明 |
|------|------|--------|------|
| ~~无多用户隔离~~ | ~~全局~~ | ~~P0~~ | ✅ **已修复** — UserContextManager + auth 中间件 + 路由改造 |
| 🔴 **ConsolidationEngine USER_CORE.md 路径** | `core/ConsolidationEngine.ts` `phaseProfileConsolidate()` | P0 | 使用 `join(config.dataDir, 'USER_CORE.md')` 写全局路径，多用户下会互相覆盖。应改用 `this.userDataManager.writeFile()` |
| 🔴 **HeartbeatLoop USER_CORE.md 路径** | `core/HeartbeatLoop.ts` `checkProfileDirty()` | P0 | 同上且更严重：构造函数不接收 UserDataManager，无法获取用户目录。需重构接口 |
| 🟡 **EventBus/SSE 无用户过滤** | `routes/events.ts` | P1 | 全局广播，用户 A 可收到用户 B 的事件。`_sseUserId` 已计算但未用于过滤 |
| 🟡 **Config 路由全局共享** | `routes/config.ts` | P1 | 使用全局 `config.dataDir/config.json`，不区分用户 |
| 🟡 **无真实认证** | `middleware/auth.ts` | P1 | 任何客户端可冒充任意用户，无 token/API key 校验 |
| 通知表名不一致 | `routes/notifications.ts` | P1 | 代码中可能使用 `notifications` 但 schema 中为 `notification_records` |
| OnlineReflection 未集成 | `routes/ask.ts` | P2 | `/ask` 路由未调用 OnlineReflection 后处理 |
| Ask 路由路径硬编码 | `routes/ask.ts` | P3 | 使用 `join(config.dataDir, 'users', request.userId)` 绕过 UserDataManager 抽象 |
| MarkdownManager 单例 | `core/MarkdownManager.ts` | P3 | singleton 模式不适合多用户，但当前未在多用户流中直接使用 |
| ExportEngine 未使用 | `routes/export.ts` | P3 | 只用了 UserDataManager，未使用 ExportEngine 的 JSON 导出 |
| MemoryServiceClient 无 profile 方法 | `src/services/MemoryServiceClient.ts` | P1 | 后端 API 已就绪但 Client 未封装 |
| IngestionPipeline 的 evidence_refs 列名 | `core/IngestionPipeline.ts` | P2 | 使用 `evidence_refs_json` 但 schema 中列名为 `evidence_refs`，需确认 |

---

## 8. 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| ~~多用户数据混乱~~ | ~~极高~~ | ✅ **已解决** — Per-User Database 方案已实现 |
| **ConsolidationEngine/HeartbeatLoop 路径 bug** | 高 | 多用户下画像数据会写入错误位置，需优先修复 |
| 迁移期间数据丢失 | 高 | 实现 V6DataMigration 工具将 ChromaDB 数据导入 SQLite |
| 网络不可用时记忆系统不工作 | 中 | 考虑保留极轻量本地队列，断网时暂存，联网后批量 ingest |
| memory-service 崩溃影响扩展 | 中 | MemoryServiceClient 已有超时和错误处理，添加重试机制 |
| 嵌入模型差异导致搜索质量变化 | 低 | 旧系统用 Chrome offscreen embedding，新系统用 Xenova/all-MiniLM-L6-v2，维度一致(384) |
| 旧画像数据无法迁移 | 中 | 旧 ChromaDB 中的 userprofiles 数据格式与新 user_profile_items 不兼容，需写一次性转换脚本 |
| Per-User SQLite 文件数量增长 | 低 | Personal AI 场景用户数有限；UserContextManager 已实现空闲 30min 自动回收连接 |
| ~~SSE 事件泄露~~ | ~~中~~ | ✅ **已修复** — EventBus 已按 userId 过滤 |

---

## 9. 预估工时

| Phase | 工作量 | 依赖 | 进度 |
|-------|--------|------|------|
| ~~Phase 0 (多用户架构)~~ | ~~2-3 天~~ | ~~无~~ | ✅ **已完成** |
| ~~Phase 0.1 (遗留 bug 修复)~~ | ~~0.5 天~~ | ~~无~~ | ✅ **已完成** |
| ~~Phase 1 (核心消息流)~~ | ~~2-3 天~~ | ~~Phase 0.1~~ | ✅ **已完成** |
| ~~Phase 2 (通知与调度)~~ | ~~1-2 天~~ | ~~Phase 1~~ | ✅ **已完成** |
| ~~Phase 3 (UI 模态框)~~ | ~~2-3 天~~ | ~~Phase 1~~ | ✅ **已完成** |
| ~~Phase 4 (用户画像前端切换)~~ | ~~1-2 天~~ | ~~Phase 1~~ | ✅ **已完成** |
| ~~Phase 5 (清理废弃代码)~~ | ~~0.5 天~~ | ~~Phase 1-4~~ | ✅ **已完成** |
| **总计** | **全部完成** | | ✅ |

> **注**: Phase 0-5 已全部完成。迁移工作已结束。

---

## 10. 决策点（需 Review）

1. ~~**用户画像迁移方案**~~：✅ **已决定** — 方案 A（后端实现 Dual Persona），且已完成后端开发
2. ~~**多用户隔离方案**~~：✅ **已决定** — Per-User Database + Directory 方案，已实现
   - **用户标识方式**：✅ `X-User-Id` header，缺省回退 `"default"`
   - **用户创建流程**：✅ 首次请求时自动创建（UserContextManager 懒加载）
   - **ProactiveScheduler 策略**：✅ 单 scheduler 遍历所有注册用户
   - **连接池**：✅ 空闲 30min 自动回收
3. **真实认证**：当前只有 `X-User-Id` header，无校验。是否需要加入 token/API key 认证？
4. **本地队列**：是否需要断网暂存 + 联网批量同步的降级方案？
5. ~~**ChromaDB 保留**~~：✅ **已决定** — Phase 5 已完全移除 ChromaDB 服务（docker-compose.yml）及相关代码
6. **数据迁移**：是否需要将 ChromaDB 中已有数据（含旧画像）迁移到新 SQLite？
7. **memory-exploring UI**：是否要在迁移时同步重构记忆浏览界面？
8. **旧画像功能取舍**：`fuseUserContextConfig`、`findSimilarUsers` 等旧 API 在新系统中无直接对应，是否需要保留？
