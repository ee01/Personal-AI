# Jira Automation Import secret re-entry map

## 目标功能

- 随机命中功能：`secret value 脱敏`
- 所属能力：Jira Automation Import
- 主文档：`docs/features/jira_automation_import.md`

## 外部参考

- Atlassian Jira Automation 导入规则：导入规则默认 disabled，用户需要手动启用；同名规则会改名处理。
  https://confluence.atlassian.com/spaces/AUTOMATION/pages/1141480606/Import%2Band%2Bexport%2BJira%2Bautomation%2Brules
- Atlassian masked secret keys：Jira Automation 支持 masked secret keys，说明凭据应留在目标 Jira 的安全配置里，而不是依赖导出文件恢复。
  https://confluence.atlassian.com/spaces/AUTOMATION/pages/1283362517/Create%2Band%2Bedit%2Bmasked%2Bsecret%2Bkeys%2Bfor%2Bautomation%2Brules
- Zapier app connections：连接状态、重连和权限属于独立管理对象，自动化流程只引用连接，不应让用户误以为迁移文件恢复了凭据。
  https://help.zapier.com/hc/en-us/articles/8496290788109-Manage-your-app-connections
- GitHub Actions secure use：日志脱敏依赖具体 secret 可见性，结构化 secret 和派生值可能漏脱敏，因此预览和导入描述需要明确哪些字段被替换或脱敏。
  https://docs.github.com/en/actions/reference/security/secure-use
- TAP 安全/可用性研究：用户难以推理触发-动作链路的安全和隐私影响，迁移前后的凭据、外部动作和链式触发边界需要显式可见。
  https://www.usenix.org/system/files/soups2023-mccall.pdf

## 用户体验问题

当前实现已经会脱敏 `secret=true`、URL token、Bearer、API key、password、description/body/label 中的自由文本 secret，并在预览、复制包、POST payload 和错误回执里避免原值泄漏。

但真实用户在导入前后仍有一个操作缺口：界面告诉用户“存在 secret / sensitive values”，却没有一张紧凑、可复制、不会泄漏值的字段路径清单。用户离开预览后需要重新推断哪些位置只是 `PERSONAL_AI_REENTER_SECRET` 或 `REDACTED`，容易误以为 disabled copy 已恢复了凭据。

## 实施计划

1. 在 `src/jira-automation-import/transform.ts` 增加 `JiraAutomationImportSecretReentrySlot` 和 `collectJiraAutomationImportSecretReentrySlots()`。
2. map 只输出安全 path、可展示 label、处理原因，不输出原始 secret 值。
3. 将 map 写入：
   - `Activation plan`
   - `Copy review packet`
   - 导入副本 description 的 `Personal AI import review`
   - 预览详情行
   - `Import boundary receipt`
   - post-import success receipt
4. 更新单元测试和 E2E，证明：
   - map 出现于预览/成功回执/description/packet
   - map 包含安全路径
   - 原始 token、Bearer、secret path、email 仍不出现
5. 更新 `docs/features/jira_automation_import.md`，只记录用户可感知行为，不写过细实现。

## 验证计划

- `npm run verify:jira-automation-import`
- `npm start` 等首次 webpack dev 编译成功后停止 watch
- `npm run verify:jira-automation-import:e2e`
- `git diff --check -- src/jira-automation-import/transform.ts src/contentScriptJiraAutomation.ts src/jira-automation-import/__tests__/transform.test.ts tools/verify-jira-automation-import-e2e.mjs docs/features/jira_automation_import.md .planning/2026-06-18-automation-jira-secret-reentry-map/plan.md`

