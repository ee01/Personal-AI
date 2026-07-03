# Findings

## Selection
- Random selection from docs/features/index.md after excluding the freshest exact feature families selected `Memory Exploring / 时间轴/搜索安全跳转`.
- Source doc: docs/features/memory_system.md.
- Primary code surfaces: src/modals/searchResultPresentation.ts, src/modals/timelinePresentation.ts, src/modals/components/TimelinePage.vue, src/modals/components/SearchResultPage.vue.
- Existing harnesses: npm run verify:memory-search-results, npm run verify:memory-timeline, npm run verify:memory-timeline:e2e.

## Reminder Check
- Local Reminders lists: We, Next actions, Moives, Shopping List, 家庭, 人名记忆, 宝宝需要办理, 吃吃看, 出门前检查, 装修待办, Reading, 菜头.
- There is no `Personal AI` list, so no target reminder item was available.

## Industry And Research Signals
- Google Safe Browsing and Chrome unsafe-site warnings make link risk visible before navigation where possible.
- OWASP guidance for unsafe redirects recommends allowlisted destinations or a warning for untrusted redirects.
- PIM / Keeping Found Things Found research frames source re-finding as a core value of personal memory tools.
- URL/phishing UI research supports clear URL identity and warning context; hiding dangerous or credential-bearing links should be paired with understandable recovery.

## Code Findings
- Search and Timeline already use `getMemoryLinkSafetyState()` from searchResultPresentation.ts.
- Current policy blocks unsupported internal routes, non-http(s), username/password URLs, sensitive query params, and signed URL credentials.
- Timeline and Search currently show block reasons as scattered inline chips inside action rows. This is correct but weak for scanning: the user must visually parse button absence and tiny chips.
- A shared status view can expose `可在记忆中查看`, `可打开来源: host`, `来源已隐藏`, or `暂无可打开目标` before click without changing actual open behavior.
