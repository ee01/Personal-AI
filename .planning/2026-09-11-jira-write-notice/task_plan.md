# Task Plan: 无扩展时 Jira 回写提示

## Goal
无 Chrome 扩展的用户在 Roadmap 上改会回写 Jira 的字段（Target Start/End、assignee）时，看到一行提示 +「安装插件开启同步」小按钮；拉取 Jira 保持静默。

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] 对照创建 Jira 引导，查清 Tag/Star/End 与现有回写路径
- [x] 确认 Target End 无扩展时静默；assignee 仅 toast
- **Status:** complete

### Phase 2: Planning & Structure
- [x] 写路径：无扩展跳过 PAT，弹出一行 notice
- [x] 拉路径：继续静默（团队缓存 + 用户未主动点）
- **Status:** complete

### Phase 3: Implementation
- [x] `useExtensionGate` 增加 `syncJira` + notice 状态
- [x] `JiraWriteNotice.vue` 一行文案 + 文本按钮
- [x] GanttPanel Target 回写 / Owner 回写接入
- [x] 文档、demo、verify needle、单测
- **Status:** complete

### Phase 4: Testing & Verification
- [x] vitest + deploy + verify:roadmap-service
- **Status:** complete

### Phase 5: Delivery
- [x] 中文回复：现状、改动、拉取建议
- **Status:** complete

## Key Questions
1. Tag/Star 是否有独立回写？没有；当前写 Jira 只有 Target Start/End 与 assignee。
2. 无扩展是否仍走服务端 PAT？否，避免「已回写」与「没装扩展」矛盾。
3. 拉取是否加常驻条？否，保持静默。

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 无扩展跳过 PAT | 用户心智是「没插件就不能改 Jira」；PAT 成功 toast 会误导 |
| 一行 snackbar 而非弹窗 | 排期仍要落在 Roadmap，只补一句同步失败 |
| 拉取保持静默 | 打开页自动发生，不是用户动作；缓存可给协作者看 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|          | 1       |            |
