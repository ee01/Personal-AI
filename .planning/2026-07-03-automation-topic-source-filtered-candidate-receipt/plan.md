# Topic 来源链接安全候选过滤回执计划

## 目标

随机选中 `Topic 来源链接安全展示`。当前安全规则已经会跳过 `#`、非 `http(s)`、格式错误和带账号信息的 URL，并继续寻找后续可信候选；但当后续候选可打开时，前面被过滤的候选不会在首屏显露。用户只能看到最终安全链接，容易误以为所有来源候选都干净，也难判断为什么打开的是 fallback。

## 外部参考

- Slack / Zulip 都把消息、话题或资源链接作为回到原上下文的稳定锚点，链接需要可追溯而不是只给一个泛化入口。
- Notion AI Connectors 会引用具体来源，说明聚合结果需要保留 provenance。
- Microsoft Defender Safe Links 和 URL inspection 研究都指向同一个 UX 原则：链接安全不能只依赖 hover 或完整 URL，用户需要看到真实目标和被拦截原因。
- RFC 3986 对 URL userinfo 有明确风险提示，支持继续隐藏 `user:password@host` 候选并说明原因。

## 实施步骤

1. 在 Topic 详情页的安全来源链接旁增加 `候选已过滤` 徽标，仅当同一候选组同时有安全链接和 blocked 候选时显示。
2. 徽标复用现有 `getBlocked*SourceResults()` 与 hidden-label helper，展示数量和主要原因；不展示原始不可信 URL。
3. 聊天、资源、网页三个来源区域共用同一展示口径；现有无安全链接时的 `来源已隐藏` 保持不变。
4. 更新 `verify-topic-based-messages` 和 E2E，覆盖「前置不可信候选 + 后续安全 fallback」同时显示可打开链接与过滤徽标。
5. 更新 `docs/features/topic_based_messages.md`，说明 fallback 安全链接不会吞掉被过滤候选的可见回执。

## 验证

- `npm run verify:topic-based-messages`
- `npm start -- --progress` 首次成功编译后停止
- `npm run verify:topic-based-messages:e2e`
- scoped `git diff --check`
