# Memory Service — 类人记忆系统架构

*最后更新: 2026-02-26 (v8 Memory Service 迁移完成)*

## 系统概述

Memory Service 是一套独立部署的**类人记忆后端服务**，取代了原有的 Chrome Extension 内嵌记忆系统（memory.ts + ChromaDB + Chrome Storage）。它模拟人脑的记忆机制 —— 自动摄入、显著性评估、多通道召回、遗忘衰减、离线巩固与生成式重放（"做梦"），并提供双人格模型（用户画像 + AI 自我认知）。

```
┌─────────────────────────────────────────────────────────────┐
│  Chrome Extension / 其他客户端                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ 消息处理  │  │ Agent流   │  │ Web分析   │  │ 用户画像    │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬─────┘  │
│       └──────────────┴─────────────┴───────────────┘        │
│                          │ HTTP + X-User-Id                  │
└──────────────────────────┼──────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Memory Service  (Fastify · port 3210)                       │
│                                                              │
│  ┌─────────┐ ┌───────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Ingest  │ │  Recall   │ │   Ask    │ │   Profile     │  │
│  │ Pipeline│ │  Engine   │ │  (RAG)   │ │   Manager     │  │
│  └────┬────┘ └─────┬─────┘ └────┬─────┘ └───────┬───────┘  │
│       │             │            │                │          │
│  ┌────┴─────────────┴────────────┴────────────────┴──────┐  │
│  │              Core Engines                              │  │
│  │  Salience · Forgetting · Truth · Consolidation · Dream │  │
│  └────────────────────────┬──────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────┴──────────────────────────────┐  │
│  │  SQLite (WAL) + sqlite-vec (384d) + FTS5             │  │
│  │  Per-user DB: data/users/{userId}/memory.db           │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 技术选型

| 层 | 方案 | 说明 |
|---|---|---|
| 运行时 | Node.js 20 + Fastify 5 | 高性能异步 HTTP |
| 数据库 | SQLite (better-sqlite3, WAL) | 单文件、零运维、per-user 隔离 |
| 向量检索 | sqlite-vec (384 维) | 与 DB 同进程，无外部依赖 |
| 全文检索 | FTS5 (BM25) | SQLite 原生 |
| Embedding | Xenova/all-MiniLM-L6-v2 (本地) | 无需外部 API |
| LLM | OpenAI / Groq / Ollama / Dify | 可插拔 |
| 调度 | node-cron | 巩固 & 做梦 定时任务 |

---

## 核心引擎一览

```
  消息进入
     │
     ▼
┌──────────────────┐     ┌──────────────────┐
│ IngestionPipeline│────▶│  SalienceScorer  │
│ 去重·LLM抽取·    │     │ 重要性+频率+新近  │
│ 实体·关系·嵌入   │     │ +意外性−冗余度    │
└──────────────────┘     └──────────────────┘
         │                        │
         ▼                        ▼
┌──────────────────┐     ┌──────────────────┐
│ TruthMaintainer  │     │ ForgettingEngine │
│ 双时态属性管理    │     │ 指数衰减·可配置   │
│ 冲突→确认队列    │     │ 半衰期           │
└──────────────────┘     └──────────────────┘

         ┌─── 定时循环 ───┐
         ▼                ▼
┌──────────────────┐  ┌──────────────────┐
│ Consolidation    │  │ GenerativeReplay │
│ 每晚 23:00       │  │ 每周日 03:00      │
│ 6阶段巩固压缩    │  │ "做梦"发现隐含    │
│                  │  │ 关联              │
└──────────────────┘  └──────────────────┘
```

| 引擎 | 职责 |
|---|---|
| **IngestionPipeline** | 去重 → LLM 抽取实体/摘要 → 显著性 → 嵌入 → 写入 |
| **RecallEngine** | 4 通道并行召回 + MMR 重排序 |
| **SalienceScorer** | S = importance + frequency + recency + surprise − redundancy |
| **ForgettingEngine** | 指数衰减，可配半衰期 |
| **TruthMaintainer** | 双时态属性 (valid_from/to + tx_start/end)，冲突确认队列 |
| **ConsolidationEngine** | 每晚 6 阶段：压缩→去噪→结构化→清理→重索引→反思 |
| **GenerativeReplay** | 每周"做梦"：发现隐含关系 |
| **OnlineReflection** | 查询后即时反思强化 |
| **ProfileManager** | 双人格：用户画像 + AI 自我认知 (Identity/Soul/Policy) |

---

## 4 通道召回 (RecallEngine)

```
         Query
           │
     ┌─────┼─────────┬────────────┐
     ▼     ▼         ▼            ▼
  Vector   FTS     Graph        Time
  余弦相似  BM25   实体名+      时间表达式
  messages  chunks  1-2跳关系    解析
  +chunks   _fts   遍历
     │     │         │            │
     └─────┴─────────┴────────────┘
                  │
                  ▼
           Merge + Dedup
                  │
                  ▼
          MMR Reranking (λ=0.7)
          + 新近度/显著性加权
                  │
                  ▼
            Top-K Results
```

---

## 数据模型

### 核心表

| 表 | 用途 |
|---|---|
| `messages_raw` | 原始消息 (content, summary, source, sender, entities_json) |
| `chunks` / `chunks_fts` / `chunks_vec` | 文本分块 + FTS5 + 384 维向量 |
| `messages_vec` | 消息级 384 维向量 |
| `entities` | 知识图谱节点 (Person, Project, Task, Organization, Document, Technology, Topic) |
| `entity_properties` | 双时态属性 (valid_from/to, tx_start/end, confidence, superseded_by) |
| `relationships` | 图谱边 (relation_type, strength, co_occurrence_count) |
| `memory_metadata` | 显著性 & 衰减 & 巩固等级 |

### 人格表

| 表 | 用途 |
|---|---|
| `user_profile_items` | 用户事实/偏好/习惯/兴趣 |
| `social_edges` | 社交关系 (colleague, manager, friend…) |
| `opinion_items` | 对人/事的态度 (valence, intensity) |
| `agent_profile_versions` | AI 人格版本 (identity, soul, policy) |

---

## 主动循环

| 循环 | 频率 | 动作 |
|---|---|---|
| Heartbeat | 每 15 分钟 | 微巩固、通知检查、关注项目更新 |
| Daily | 每晚 23:00 | 6 阶段巩固（压缩/去噪/结构化/清理/重索引/反思） |
| Weekly | 周日 03:00 | 生成式重放（"做梦"发现隐含关联） |

---

## 多用户隔离

```
data/
└── users/
    ├── alice/
    │   ├── memory.db          ← 独立 SQLite
    │   └── daily/2026-02-26.md
    ├── bob/
    │   ├── memory.db
    │   └── daily/...
    └── default/
        └── ...
```

- 认证：`X-User-Id` 请求头
- UserContextManager 按需加载、30 分钟空闲回收

---

## API 概览

| 操作 | 端点 | 说明 |
|---|---|---|
| 摄入 | `POST /ingest` | 单条消息存储 |
| 批量摄入 | `POST /ingest/batch` | 批量写入 |
| 召回 | `POST /recall` | 多通道记忆检索 |
| 问答 | `POST /ask` | RAG 风格自然语言问答 |
| 实体 | `GET /entities` | 知识图谱查询 |
| 用户画像 | `GET /profile/core` | 核心画像 |
| 通知 | `GET /notifications` | 主动通知列表 |
| 巩固 | `POST /consolidate` | 手动触发巩固 |
| 导出 | `POST /export` | Markdown 格式导出 |
| 健康 | `GET /health` | 服务状态 |

完整 API 文档：`http://localhost:3210/docs` (Swagger UI)

---

## 部署

```yaml
# docker-compose.yml
services:
  memory-service:
    build: ./memory-service
    ports: ["3210:3210"]
    volumes: ["./memory-service/data:/app/data"]
    env_file: ["./memory-service/.env"]
    restart: unless-stopped
```

---

## 与业界记忆系统对比

| 能力维度 | 本系统 (Memory Service) | OpenClaw (mem0/memory-core) | MemGPT / Letta | Mem0 (SaaS) |
|---|---|---|---|---|
| **存储** | SQLite + sqlite-vec + FTS5，单文件零运维 | Markdown 文件 + SQLite | 分层 archival/recall/core | 托管向量数据库 |
| **检索** | 4 通道并行 (Vector + FTS + Graph + Time) + MMR | 向量 + BM25 混合 | 向量 + 分页 | 向量检索 |
| **知识图谱** | 内建实体/关系/双时态属性 | ✗ 无 | ✗ 无 | 有限图谱 |
| **真值维护** | 双时态 + 冲突确认队列 | ✗ 覆盖写入 | ✗ 仅追加 | ✗ 无 |
| **遗忘机制** | 指数衰减 + 显著性 + 巩固等级 | ✗ 手动删除 | 手动 archival | ✗ 无 |
| **离线巩固** | 每晚 6 阶段 + 每周做梦 | ✗ 无 | ✗ 无 | ✗ 无 |
| **主动通知** | Heartbeat 循环 + 关注项目 + 安静时段 | ✗ 无 | ✗ 无 | ✗ 无 |
| **用户画像** | 双人格（用户 + AI）+ 社交图 + 态度 | USER.md + SOUL.md | 核心记忆摘要 | 用户标签 |
| **多用户** | Per-user DB 隔离 + 空闲回收 | 单用户 | 单用户 | 多租户 |
| **部署** | Docker 自托管 / 无外部依赖 | 进程内 | Docker | SaaS |
| **隐私** | 数据完全本地，不出用户设备/服务器 | 本地 | 本地 | 云端 |
| **Embedding** | 本地模型 (MiniLM)，不依赖外部 API | 依赖 API | 依赖 API | 依赖 API |

### 核心差异化

1. **"活的"记忆** — 不是被动存取，而是有显著性评估、自动衰减和定期巩固的生命周期
2. **真值维护** — 双时态属性让事实可追溯，冲突自动检测并请求用户确认
3. **做梦机制** — 周期性生成式重放，发现用户未显式表达的关联
4. **4 通道召回** — 向量、全文、图谱、时间四路并行，比单纯向量检索更全面
5. **完全自主可控** — 本地 Embedding + 本地 SQLite，无需任何云服务依赖
