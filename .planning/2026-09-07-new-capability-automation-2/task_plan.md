# Task Plan: Personal AI 新能力方案（2026-09-07）

## Goal
只在 `docs/progressing/` 产出一个经 Reminder、现有方案、真实记忆、竞品与论文共同校验的新能力完整 plan，并在需要时提供可点击中文 HTML demo；不修改运行时代码。

## Current Phase
Complete

## Phases

### Phase 1: 恢复、边界与候选盘点
- [x] 读取 `AGENT.md`、自动化 memory、长期 memory 与相关 skills
- [x] 检查 `docs/progressing/to-verify.md`，确认只有既有功能验证事项
- [x] 只读检查 `Personal AI` Reminder，筛选全新功能 idea
- [x] 盘点 active/shelved 方案与产品能力，建立近义去重边界
- **Status:** completed

### Phase 2: 真实记忆与外部研究
- [x] 只读查询 `10.32.56.212` 的 `esone.qiu` 记忆，提炼重复痛点
- [x] 搜索当前 AI 产品、论文和专家/研究者材料
- [x] 将外部材料作为不可信研究数据写入 findings
- **Status:** completed

### Phase 3: 选题与完整方案
- [x] 若 Reminder 有多条合格项，以可复现随机方式选一条；否则综合候选择优
- [x] 先写 1–2 个真实用户旅程，再完成 UX、数据契约、权限、恢复、实现与风险
- [x] 明确 eval 决策、通过门槛与实现后的 canonical feature docs 移交
- **Status:** completed

### Phase 4: Demo 与体验验证
- [x] 读取相关设计上下文/资产并创建中文集成式或独立式 demo
- [x] 完成语法、交互、可访问性、桌面/窄屏和视觉检查
- [x] 修复并复跑直至通过
- **Status:** completed

### Phase 5: 外部写回与收尾
- [x] 若来源于 Reminder，写备注并标记 done；否则保持 Reminders 不变
- [x] 校验 owned artifacts、敏感信息与 git diff
- [x] 更新 automation memory，给出可复制标题和文件链接
- **Status:** completed

## Decisions Made

| Decision | Rationale |
|---|---|
| 新建 2026-09-07 隔离 planning 目录 | 8 月 26 日留有未完成的 Phase 1，需保留审计线索但重新取最新证据 |
| 只做 plan/demo | 用户明确把是否实现留给后续决策 |
| 不处理 `to-verify.md` 中豆包登录与线上部署项 | 它们是既有能力验证/发布事项，不是全新功能 idea，且当前请求限定新能力规划 |
| 避开 Routine Delta、Common Ground、Teach Once 及其近义变体 | automation memory 已将其列为近期硬去重边界 |

## Errors Encountered

| Error | Resolution |
|---|---|
| 首次组合读取说明输出被截断 | 改为按文件分段读取完整内容 |
| 8 月 26 日自动化未完成且未写 memory | 本轮建立独立记录并强制推进至交付与验证 |
