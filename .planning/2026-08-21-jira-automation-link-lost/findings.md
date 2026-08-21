# Findings & Decisions

## Requirements
- 托管 Jira Automation 规则后，编辑 Messages 行不能丢掉 `Automation_Link`
- 之后每次改 Topic，只要 link 还在，就应继续同步到 Jira Rule title
- 用户实测表：`https://docs.google.com/spreadsheets/d/1_E0sei4HkBGScliHHQNlbS2l4E9yZHJJEv7ehPmwulU/edit?gid=378544991#gid=378544991`
- 最后一行丢失的 link：`https://jira.ringcentral.com/secure/AutomationProjectAdminAction!default.jspa?projectKey=NOVA#/rule/2956`

## Research Findings
- `contentScriptJiraAutomation.ts` 导入/托管时会写入 `Automation_Link`。截图编辑历史也证明托管当下 cell 里是有 URL 的。
- 真正丢 link 的是管理页编辑保存，不是 Jira 转换 webhook。
- `AddMessageDialog.getInitialFormData()` 复制了 Topic、AI_Endpoint 等，但没复制 `Automation_Link`。
- submit 明确写了 `Automation_Link: formData.Push_Method === 'Outreach' ? undefined : formData.Automation_Link`。编辑 JiraAutomation 时这个值是 `undefined`。
- `ScheduledMessageService.updateMessage` 做 `{ ...previous, ...updates }`。`Automation_Link: undefined` 会覆盖原值。
- `messageToRow` 把 `undefined/null` 写成 `''`，所以整行 PUT 会把 Sheet 单元格清空。这与 2026-08-21 2:31 PM Esone Qiu Deleted URL 的历史一致。
- Title 同步在 `updateMessage` 之后，用的是内存里的 `editingMessage.Automation_Link`。第一次编辑时内存里还有 link，所以能同步；保存后 Sheet 已空，第二次 `loadMessages` 读到空 link，条件 `editingMessage.Automation_Link` 失败，后面都不同步。两个 bug 是同一根因。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 初始化带上 `Automation_Link` | 编辑表单本就该保留托管规则入口，列表 link icon 也靠它 |
| save helper 用 existing link 兜底 | 即使以后表单再漏字段，提交也不会写成 undefined |
| `updateMessage` 忽略 undefined 的 Automation_Link | 整行写回的最后一道闸；空字符串仍表示显式清空 |
| Title 同步改用 saved/editing 两处 link | 避免再只依赖可能被写空的那一份 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
- `src/scheduled-messages/ScheduledMessagesManager.tsx`：getInitialFormData、handleSubmit、syncJiraRuleName、takeover
- `src/scheduled-messages/ScheduledMessageService.ts`：updateMessage、messageToRow
- `src/contentScriptJiraAutomation.ts`：导入时写 Automation_Link
- `docs/features/scheduled_messages_manager.md`

## Visual/Browser Findings
- Sheet 编辑历史：Esone Qiu，August 21, 2:31 PM，Deleted `https://jira.ringcentral.com/secure/AutomationProjectAdminAction!default.jspa?projectKey=NOVA#/rule/2956`
- 当时 Status=Active，Next_Exec=2026-08-26，Exec_Count=0
- 可见列：Automation_Link、Status、Last_Exec、Next_Exec、Exec_Count
