# Today Pilot 筛选原因拆分计划

## 目标功能

- 随机抽中：`今天排序与噪声控制`
- 所属能力：Today Pilot
- 主文档：`docs/features/today_pilot.md`

## 检查结论

- `docs/progressing/to-verify.md` 当前无待校验事项。
- 本机 Reminders 中没有 `Personal AI` 列表，本轮不合并或标记 Reminder 条目。
- 现有代码已经实现 Today Pilot 顶部筛选口径、反馈 pending、可见 sourceStats、catch-up 和 popup 失败快照。
- 发现的 UX 问题：顶部和 popup 把 `总扫描信号 - 入选证据` 合并为 `降噪/未入选`，用户无法区分“通过行动性门槛但没进首页”的候选，和“一开始就被规则过滤/降噪”的信号。

## 外部参考

- Microsoft 365 Copilot Plan My Day 强调 top three to five urgent/impactful items，并按业务影响、时间敏感度、战略一致性、被阻塞人群排序。
- Gemini Daily Brief 从 Gmail、Calendar 和 Gemini chats 生成每日 brief，并允许查看具体数据来源。
- Microsoft Viva Daily Briefing / AI-powered reminders 研究强调协作承诺、请求和 follow-up 比泛泛信息更适合被 AI reminder 推出。
- Adaptive notification / attention management 研究提醒主动通知需要控制信息过载，避免不可解释的打断。

## 实施步骤

1. 首页 `筛选口径` 拆成四个数字：候选池、入选证据、候选未入选、前置降噪。
2. Popup Top 3 的 scope receipt 使用同样拆分，保留 Top 3 快照和不执行边界。
3. 更新 `docs/features/today_pilot.md` 说明筛选口径如何区分排序落选和规则降噪。
4. 扩展 `tools/verify-day-pilot-home.ts` 和 `tools/verify-today-pilot-home-e2e.mjs`。
5. 验证：focused verifier、`npm start` 首次成功编译、Today Pilot E2E、scoped `git diff --check`。

## 非目标

- 不改变 Today Pilot 排序算法、候选扫描、反馈写入、Reminder 状态或外部执行行为。
- 不部署 memory-service，不写入真实用户数据。
