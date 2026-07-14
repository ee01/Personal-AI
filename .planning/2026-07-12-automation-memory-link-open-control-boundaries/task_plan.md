# 时间轴/搜索安全跳转控件边界 Plan

## Goal

从 `docs/features/index.md` 随机抽到并确认本轮目标为 `时间轴/搜索安全跳转`。在不改变安全跳转行为的前提下，把搜索结果和时间轴里实际按钮的 hover / 读屏边界补齐，让用户在点击前就知道这是内部跳转、外部新标签、详情页 fallback，还是复制本机安全诊断。

## Scope

- 目标文档：`docs/features/memory_system.md` 与 `docs/features/index.md`
- 目标代码：`src/modals/components/SearchResultPage.vue`、`src/modals/components/TimelinePage.vue`
- 目标验证：现有搜索/时间轴 verifier 和 E2E，外加 dev extension compile
- 非目标：不放宽 URL allowlist，不改变 signed URL / credential URL 拦截，不改 Memory Service 召回、反馈写入、路由行为或外部打开行为

## Plan

1. 已完成：读取 `AGENT.md`、`docs/progressing/to-verify.md`、自动化记忆、Reminders 和功能索引；避开刚覆盖过的精确表面。
2. 已完成：核对代码和文档现状，确认已有安全拦截、点击后回执和部分来源按钮 title，但搜索/时间轴的内链、详情 fallback、复制诊断和搜索主打开按钮缺少完整控件级边界。
3. 已完成：检索业内产品和研究，提炼建设性方向：敏感 URL 参数应拦截，外部新标签要 opener/referrer 隔离，链接目的地和安全后果应在点击前可见。
4. 已完成：实现 button-level `title` / `aria-label`，复用现有安全状态和回执语义，保持行为不变。
5. 已完成：更新 `docs/features/memory_system.md` 和索引中该行的简述。
6. 已完成：扩展现有 E2E 断言控件级 title / aria 边界，运行 targeted verifier、`npm start` 首次成功编译、E2E 和 `git diff --check`。

## Reminder Result

AppleScript 没有列出 `Personal AI`，EventKit 找到本地 `Personal AI` 列表，合计 4 项、未完成 0 项；全部是已完成的历史 Doubao / notification 反馈，与本轮搜索/时间轴安全跳转无关。本轮不需要标记 Reminder done。

## External References

- OWASP: URL query string 中的敏感数据会出现在 Referer、日志、浏览器历史等位置，HTTPS 不能消除这个泄露面。
- MDN `window.open`: `noopener` 会切断 opener，`noreferrer` 会省略 Referer 并隐含 `noopener`。
- Microsoft Recall: 本地回忆/快照产品会把敏感信息、网站和私密浏览过滤做成用户可见控制。
- Google Chrome Safe Browsing: 危险站点/相似 URL 会在访问前警告用户。
- USENIX Security 2025 URL inspection tasks: 让用户在访问前关注域名和 URL 结构能显著降低 phishing 成功率。

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| None |  |  |
