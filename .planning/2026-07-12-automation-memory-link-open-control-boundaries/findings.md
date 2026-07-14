# Findings

## Repo Context

- `docs/progressing/to-verify.md` 当前为“暂无”。
- 自动化记忆最近精确覆盖了 Rehearsal、系统观察规则、备份/导入、Evidence Watch、Source Memory、App Script、Memory Search feedback、Project Dashboard、Compose Assist、Relationship Radar、Notification、Auto Reply 等；本轮避开这些新近表面。
- 随机样本中 `时间轴/搜索安全跳转` 足够独立，且现有代码有清晰 verifier。
- Worktree 已有大量无关 dirty 文件；本轮只接管本 plan、`.planning/.active_plan`、本功能相关代码/docs/verifier和自动化记忆。

## Reminder Context

- AppleScript list names: 没有暴露 `Personal AI`。
- EventKit list names: 找到 `Personal AI`。
- `Personal AI` total 4, incomplete 0。
- 四项均为已完成历史 Doubao / notification / test 反馈，与搜索/时间轴安全跳转无关。

## Code Findings

- `SearchResultPage.vue` 和 `TimelinePage.vue` 共用 `getMemoryLinkSafetyState` / `formatMemoryLinkSafetyStatus`，已拦截非 http(s)、账号密码、敏感参数、signed URL、异常内部 route。
- Timeline 的外部来源按钮已有简短 `title` / `aria-label`，但 `在记忆中查看`、`复制安全诊断` 没有控件级边界。
- Search Result 的主 `打开结果` 只有 `aria-label` 无 `title`；`在记忆中查看`、`查看详情`、`复制安全诊断` 没有控件级边界；`打开来源` title 过短，没有说明新标签、noopener/noreferrer、无重新读取/同步/确认。
- 这属于 presentation / accessibility 层，不需要改 URL sanitizer 或路由行为。

## External Research

- OWASP 明确指出 query string 中的用户名、token、数据库细节等敏感数据会泄露到 Referer、日志、共享系统、浏览器历史和缓存等位置；仅使用 HTTPS 不能解决。
- MDN `window.open` 文档说明 `noopener` 会让新窗口无法访问来源窗口的 `Window.opener`，`noreferrer` 会省略 Referer 并同时设置 noopener。
- Microsoft Recall 的隐私文档把“可过滤 app/website/private browsing/sensitive information”放在用户可控制和可验证的体验中，说明本地记忆/回忆类产品也需要把保存/访问边界显性化。
- Chrome Safe Browsing 在访问危险/相似站点前给出 warning，强调 URL 目的地与用户意图匹配应在访问前处理。
- USENIX Security 2025 的 URL inspection tasks 研究显示，让用户在访问前关注 URL/domain 结构可以显著降低 phishing 成功率；对本功能的启发是：不是只在点击后回执，而是把目的地 host、打开方式和无副作用边界放到按钮本身。
