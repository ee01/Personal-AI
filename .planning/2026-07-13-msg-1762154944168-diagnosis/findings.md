# Findings

- Chrome 控制连接当前只发现 Codex 内置浏览器，没有可用的 Chrome extension backend；无法按现有标签页检查，但 Google Sheets connector 可直接只读访问目标表，因此继续走精确 metadata/row reads。
- Google Sheets live-read 安全规则要求先读 metadata，使用真实 sheet title/sheetId，再在小范围内搜索目标 ID；不猜工作表名、不整表扫描。
- Live spreadsheet metadata：标题 `Esone - 定时消息管理`，时区 `Etc/GMT`；`Messages` sheetId `378544991`（820x42，冻结首行和前两列）、`Logs` sheetId `1685955364`（1990x26）、`Config` sheetId `1096103477`（993x26）。用户链接 gid 正确指向 `Messages`。
- `Messages!A3:AK3`（目标行实际为第 3 行）：`msg_1762154944168`，Topic `weekly slide 提醒编辑`，Schedule `2025-11-03 9:28`，每 `1 Week`、`Repeat_Days=1`，`Push_Method=Bot`，team `110560968710`，`Status=Active`，`Last_Exec=2026-06-08 9:28`，`Next_Exec=2026-06-15`，`Exec_Count=30`，`Exec_Log=✅ 推送成功`。关键异常是 Next_Exec 已停在 2026-06-15，但行仍 Active 且无 End_Date/Repeat_Count 上限。
- `Logs!A1:M1990` 对该 Message_ID 有 28 条命中，全部 Success；最晚一条为 `2026-06-08 9:28:06`、Exec_Count 30、Execution_Key `...CURRENT_MINUTE:202606080928...`。此前基本每周成功，没有 2026-06-15 之后的成功或失败日志，因此不是“发送失败后留错”，而是从 6/15 起根本没有被领取/记账。
- Config 非敏感状态：App Script `2.9.1`，RingCentral sender enabled，Jira executor rule `2709 / v1.4.3`，最后规则更新时间 2026-05-15，Config 最后同步 2026-07-08。规则版本落后于 repo `1.5.2`，但版本差异不直接改变普通 Bot 的领取门禁。
- 当前代码复算：`Repeat_Days=1` 是周一；Repeat_Count 空不会因 Exec_Count=30 停止；`Next_Exec` 只在执行回调后计算/写入，不参与领取。目标在周一 09:28-09:58（当前分钟+30 分钟补偿）都应命中。
- 普通 Bot 采用“先发、成功后回调记账”：Apps Script 每轮按表格顺序只返回第一条匹配消息，普通 Bot 不会领取即标记；Jira 调 Bot API 后才调用 `markBotMessageExecuted`。如果 Bot 群组 webhook 或后续回调中断，Messages/Logs 会完全不变，并可能在补偿窗内反复占队头。
- 因此目前最可能根因是 Bot 群组发送/成功回调链路，而不是该行的周重复字段、Next_Exec、次数门禁或整个 Sheet/AppScript 调度停止。仍需用 Jira Rule 2709 audit 区分 token/全 Bot 通道、team 110560968710 权限/目标、或 callback 中断。
- 整体执行器未停：`Logs` 在 2026-06-15 仍有 7 条 AI/JiraAutomation Success，在 2026-07-13 仍有 7 条 AsMe/AI/JiraAutomation Success。目标缺失不是 Jira scheduled trigger/AppScript/Sheet 写回的全局中断。
- 同一 team `110560968710` 的 Logs 只来自本消息，最后仍是 2026-06-08；Sheet 无第二条同目标消息可帮助区分“team 权限/成员变化”与“Bot group 通道问题”。
- 本地 `.env.development` 与 `.env` 的 BOT_TOKEN 均为 JWT，`exp=2035-02-17` 且当前未过期；这不能证明 Jira rule 内嵌 token 未漂移，但排除了“当前 repo token 在 2026-06 中旬自然过期”的简单解释。
- 已建议安装 Atlassian Rovo 以查看 Jira Rule 2709 audit，但本轮用户尚未确认安装；无法直接读取审计日志，因此最终结论需保留“Bot group send vs success callback”二选一边界。
