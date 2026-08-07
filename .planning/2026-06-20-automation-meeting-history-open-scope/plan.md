# 会议历史归档打开范围回执

## 随机目标

- 来源：`docs/index.md`
- 抽样命中：`会议历史归档`
- 近期避重：跳过刚刚触达的 Memory Coverage Map exact/family；本轮选择 Meeting Pilot 的历史归档页。
- Reminder：本机 Reminders 可访问，但没有 `Personal AI` 列表，因此没有可合并或可标记完成的反馈项。

## 外部参考

- Microsoft Teams Recap 把 recording、transcript、files、notes、summary、agenda 和 follow-up tasks 放在同一 recap 入口，并要求录制/转写等前置条件。
- Microsoft Teams Intelligent recap 明确区分 AI notes、recommended tasks、timeline markers、speakers、chapters、sharing 和权限。
- Zoom AI Companion Meeting Summary 由 host 启动，用 speech-to-text 生成 summary，并可按 host 配置分享给参会者。
- LLM-powered meeting recap 研究指出 highlights 与 hierarchical minutes 服务不同复盘场景，编辑/删除/协作动作应作为 recap 体验的一部分，而不是混同为自动执行。

## 现状

- 会议历史页已经有读取回执，说明刷新、筛选、分页只读。
- 卡片已经显示 Digest/PDF 状态、处理建议、结构化数量，并拦截非 http(s) PDF。
- 仍然容易误读的点：卡片底部只有 `打开 Panorama` 和 `打开 PDF`，没有逐条说明点击后只是打开复核/外部 PDF，不会重跑分析、补发 PDF、发送纪要、写 Memory Service 或修改行动项；PDF 禁用原因也主要靠上方状态推断。

## 实施计划

1. 在每张会议卡片的按钮前加入 `打开范围` 区块。
2. 对安全 PDF、PDF blocked、Digest failed、Digest completed but missing PDF、processing、only archived 六类状态给出不同说明。
3. 保持原打开逻辑不变：Panorama 继续只传安全 PDF URL，PDF 按钮仍只允许安全 http(s)。
4. 更新 `docs/features/meeting_pilot.md` 和 `docs/index.md`，只写用户可见行为，不展开实现细节。
5. 验证：`npm start` 首次 compile、`npm run test:meeting-pilot-history`、scoped `git diff --check`，并检查无残留 webpack watcher。
