# Task Plan: 修复托管 Jira Rule 编辑后 Automation_Link 丢失

## Goal
托管后的 JiraAutomation 行在编辑保存时保留 `Automation_Link`，后续改 Topic 仍能同步到对应 Jira Rule 名称。

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] 确认两个现象都发生在托管后的编辑保存
- [x] 核对 Sheet 历史：托管时有 link，编辑时被删
- [x] 定位写回路径：`getInitialFormData` 未带 `Automation_Link` → submit 写成 `undefined` → `updateMessage` 整行覆盖为空
- **Status:** complete

### Phase 2: Planning & Structure
- [x] 表单初始化补上 `Automation_Link`
- [x] 保存时用现有 link 兜底；`updateMessage` 对 `undefined` 不覆盖已有 link
- [x] 抽出可测 helper，覆盖 title 同步仍依赖 link 的路径
- **Status:** complete

### Phase 3: Implementation
- [x] 增加 `resolveAutomationLinkForSave` / merge 保护
- [x] 修改编辑表单初始化与 submit
- [x] 更新 feature doc
- [x] 补 targeted tests
- **Status:** complete

### Phase 4: Testing & Verification
- [x] 跑 helper / service 相关测试（11 pass）
- [x] `npm start` 首次 compile 成功（1 个无关 eslint warning）
- [x] dist 已含新 helper；已 reload unpacked extension
- [ ] 真实 Sheet 最后两行未自动回填：webpage-mcp 不可用，当前 Chrome 也没打开该表
- **Status:** complete

### Phase 5: Delivery
- [x] 用中文说明根因、修复和验证证据
- [x] 未提交 git
- **Status:** complete

## Key Questions
1. 第一次改 title 能同步、后面不能，是不是因为第一次还拿得到内存里的 link？是。
2. `Automation_Link` 是编辑写空，还是托管转换时丢掉？编辑写空。

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 表单 + `updateMessage` 双层保护 | 表单漏字段是主因；service 对 `undefined` 不覆盖，避免同类整行写回再踩坑 |
| Outreach 仍可省略 form link，但 service/helper 会保留已有 link | 切到 Outreach 不必删掉 Jira 规则入口；空字符串才表示显式清空 |
| 抽出纯函数测试，不渲染整个管理页 | 管理页组件过大，helper 能锁住回归 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| user-webpage-mcp 认证超时 / server error | 1 | 未改真实 Sheet；改用代码层验证 + 扩展 reload |
| AppleScript 未找到该 spreadsheet tab | 1 | 不新开前台标签；把已知 URL 交给用户手动回填 |

## Notes
- 用户表最后一行应恢复为 `https://jira.ringcentral.com/secure/AutomationProjectAdminAction!default.jspa?projectKey=NOVA#/rule/2956`
- 倒数第二行 link 需用户从 Sheet 编辑历史确认
