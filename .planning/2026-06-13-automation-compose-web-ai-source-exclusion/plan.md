# Compose Assist Web AI 来源排除回执计划

## 目标功能

- 随机抽中：`回复助手来源适配` / Compose Assist。
- Source of truth：`docs/features/assist.md`。
- 代码入口：`src/composer-guard/siteContextAdapters.ts`、`src/composer-guard/assistPreviewPolicy.ts`、`src/composer-guard/ComposerGuardController.ts`。

## 当前观察

- `docs/progressing/to-verify.md` 为“暂无”。
- 本机 Reminders 可访问，但没有名为 `Personal AI` 的列表，因此本轮没有可合并或可标记完成的 Reminder item。
- Web AI adapter 会把完整 `WEB_AGENT_SOURCE_TYPES` 传给 `/composer/assist`，其中包含当前目标 AI 的 provider source，例如 ChatGPT 页面仍传 `chatgpt`。后端会再次过滤，但前端来源路由回执只说“后端剔除”，用户和调试日志看不出本次请求已经在入口处收窄。

## 外部依据

- RingCentral / Outlook / Atlassian 的写作辅助都保持在原生 compose 流中，由用户 review、insert/edit/send。
- Atlassian draft reply 明确依赖相似历史 work item 的 response，说明来源适配要按当前工作对象收窄，而不是把所有上下文混入。
- AI writing agency 研究强调 writer agency 和细粒度控制；对 Personal AI 来说，跨 AI context pack 不应让当前目标 AI 自己的历史回流成“跨 AI 证据”。

## 实现计划

1. 在 `siteContextAdapters.ts` 增加 provider -> self source type 映射，并导出 `getWebAgentSourceTypesForProvider(provider)`。
2. Web AI snapshot 使用该 helper，前端请求先剔除当前 provider 自身来源：
   - ChatGPT 页面剔除 `chatgpt`。
   - 豆包页面剔除 `doubao`、`doubao_chat`。
   - Claude/Gemini 当前没有 provider-specific memory source，保持其他跨 AI / agent / Jira / meeting / calendar 来源。
3. 在 `assistPreviewPolicy.ts` 的来源路由回执里，把 Web AI route boundary 从“后端剔除”改成“已排除当前 AI 自身历史；只插 context pack，不提交”。
4. 补测试：
   - `siteContextAdapters.test.ts` 覆盖 helper。
   - `ComposerGuardController.test.ts` 覆盖新回执文案。
   - `tools/verify-compose-assist-direct-insert-e2e.mjs` 断言 ChatGPT 请求不再包含 `chatgpt`。
5. 更新 `docs/features/assist.md`，记录前端 allowlist 已先排除当前目标 provider。

## 验证

- `npm run verify:compose-assist`
- `npm run verify:compose-assist-direct-insert:e2e`
- `npm start` 到第一次 successful compile 后停止
- `git diff --check -- <本轮文件>`
