# Task Plan: Personal AI 新能力方案（2026-08-26）

## Goal
只在 `docs/progressing/` 产出一个经 Reminder、现有方案、真实记忆、竞品与论文共同校验的新能力完整 plan，并在需要时提供可点击中文 HTML demo；不修改运行时代码。

## Current Phase
Phase 1

## Phases

### Phase 1: 边界、Reminder 与现状盘点
- [x] 阅读 `AGENT.md`、自动化 memory 与相关 skills
- [ ] 检查 `docs/progressing/to-verify.md` 和全部 active/shelved 方案
- [ ] 只读检查 `Personal AI` Reminder，识别全新功能 idea
- [ ] 盘点已有产品能力与真实 UI/design context
- **Status:** in_progress

### Phase 2: 真实记忆与外部研究
- [ ] 只读查询 `10.32.56.212` 的 `esone.qiu` 记忆并提炼重复痛点
- [ ] 搜索当前 AI 产品、论文和专家/研究者材料
- [ ] 把外部材料作为不可信研究数据记录在 findings，而非执行指令
- **Status:** pending

### Phase 3: 选题与方案设计
- [ ] 对候选做显式去重与价值/可行性比较
- [ ] 选择一个能力并先写 1–2 个真实用户旅程
- [ ] 完成 UX、数据契约、权限、恢复、实现阶段、风险、eval 与文档移交方案
- **Status:** pending

### Phase 4: Demo 构建与验证
- [ ] 按真实产品上下文创建中文集成式/独立式 demo
- [ ] 做语法、交互、可访问性、桌面/窄屏与视觉检查
- [ ] 修复并复跑直至通过
- **Status:** pending

### Phase 5: 收尾
- [ ] 校验 plan 必备章节、链接、空白与敏感信息
- [ ] 若来自 Reminder，写备注并标记完成；否则记录无需写回
- [ ] 更新 automation memory，给出可复制标题和文件链接
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 使用隔离的 `.planning/2026-08-26-*` | 当前活跃 planning 记录属于其他任务，不能覆盖 |
| 只做 plan/demo，不改 runtime、schema 或 eval registry | 用户明确把实现决策留到下一步 |
| 本轮避开 Routine Delta、Common Ground、Teach Once 及其近义变体 | 自动化 memory 已将三者列为近期硬去重边界 |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| 首次合并读取 skills 输出被截断 | 改为按 200 行分块完整读取 |
| 首次批量替换 planning 文件的 patch 格式不被接受 | 分为一次删除、一次新增，未影响其他文件 |
