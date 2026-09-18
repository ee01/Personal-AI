# Findings

## User must do (cannot be coded away)
- Google 授权：写 Sheet 必须用扩展里的 token
- L2 初始化：Sheet + Apps Script + Jira 执行规则，☁️ lane 才能真正被 Jira 领取
- 域策略：受管账号禁止匿名 Web App，☁️ AsMe 凭据改了也部署不上去
- memory-service 生产在另一台机器：本地改完需要部署才对线上账本生效
- Phase 4 切流、OpenClaw「记一笔」插件：要用户明确同意后再做

## Code landed this round
- Task Center ☁️ save/pause/resume/delete/complete writes the Sheet mirror
- Scheduled Messages create/update/toggle/delete registers or unregisters the ledger row
- Glip compose / AR / ADD_SCHEDULED_MESSAGE register after Sheet write
- Glip compose without L2 writes 🏠 `memory_cron`
- Inbox chip (`failed` / `dead_letter` / `input_required`) + same-title reflection fold
- PATCH mirrorRef also fills `idempotency_key = jira_sheet:<id>` when empty, so reverse register dedupes

## Mapping
- Ledger scheduledAt is unix seconds; Sheet uses local YYYY-MM-DD + HH:mm
- Recurrence spec fields match Sheet Repeat_* names
- agent → Push_Method AgentTask; asme/bot from notifyVia
- Reverse idempotency key: `jira_sheet:<Sheet ID>`

## Still deferred
- Phase 3 rest: plan gate UI, depends_on/parent editor, artifact review, worker-side reflection attach
- Phase 4: Sheet read-only, GAS DOMAIN
- Chapter 11: intent-fragments, MCP create_ledger_task, OpenClaw skill
- Credential MS→Sheet push + Jira rule redeploy
