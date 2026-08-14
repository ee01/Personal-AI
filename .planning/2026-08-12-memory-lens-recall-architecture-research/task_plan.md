# Task Plan: Memory Lens Recall Architecture Research

## Goal
定位 AI 结果总结入口和 Memory Lens 当前链路，诊断弱相关问题属于意图、召回还是展示层，并基于官方代码库与论文对比 Personal AI、LLM wiki/knowledge graph、OpenClaw/Hermes 类 harness，给出可落地的分层架构建议。

## Current Phase
Complete

## Phases

### Phase 1: Local Architecture Audit
- [x] 定位用户入口与 Memory Lens 的完整调用链
- [x] 确认各阶段是否调用 LLM、MD 是否参与在线检索
- [x] 区分 query formation、retrieval、rerank、presentation gate 的责任
- **Status:** completed

### Phase 2: Industry And Paper Research
- [x] 确认用户提到项目的准确身份与官方资料
- [x] 对比热门 memory/wiki/knowledge graph 项目
- [x] 对比 OpenClaw/Hermes 类长期记忆与 agent harness
- [x] 查阅相关检索、意图预测、memory architecture 论文
- **Status:** completed

### Phase 3: Architecture Diagnosis And Options
- [x] 判断底层重构还是 Lens 专项改造优先
- [x] 设计按场景分级的 latency/quality policy
- [x] 给出数据层、索引层、query planning、rerank、展示层方案
- **Status:** completed

### Phase 4: Delivery
- [x] 给出入口位置、现状事实、对比矩阵和分阶段建议
- [x] 说明证据边界与仍需实测的假设
- **Status:** completed

## Decisions

| Decision | Rationale |
|---|---|
| 本轮只分析和建议，不改运行时代码 | 用户请求专业研究与架构意见，而非实施 |
| 外部资料只采用官方仓库、官方文档和论文 | 技术研究需要一手资料 |

## Errors

| Error | Resolution |
|---|---|
