# Quick Ask 状态卡数量口径计划

## 目标功能

- 随机抽中的小功能点：`Quick Ask 状态卡`
- 主文档：`docs/features/doubao_bridge.md`
- 主要代码：`desktop-app/app/quick-ask.js`
- 现有验证：`npm run verify:quick-ask:e2e`

## 发现

- 文档已经描述状态卡会展示快照新鲜度、状态构成、来源和处理边界。
- 代码已经从 `runtime.items[*].count` 拿到聚合数量，并在状态构成里显示总量。
- 弱点是单个状态行主要展示一条示例摘要、来源和 action boundary；如果一行代表多条 pending approval / queued action，用户需要从 badge 或 details 里推断这一行到底覆盖多少对象。
- 点击状态行生成的追问草稿也没有稳定带上 count 口径，排查时容易把“示例一条”误读成“总共一条”。

## 实施计划

1. 增加状态行 count/basis 文案，直接说明当前行代表几个对象、来自哪类运行态来源，并强调这只是当前快照的只读口径。
2. 将同一 count/basis 文案写入 `data-status-count-basis`，点击行生成追问草稿时一起带入。
3. 更新 Quick Ask E2E 覆盖：多条外部询问、混合状态、旧快照追问草稿都要看到 count/basis。
4. 更新 `docs/features/doubao_bridge.md` 和 `docs/index.md`，只记录用户可见行为变化，不展开实现细节。
5. 验证：`node --check`、`npm run verify:quick-ask:e2e`、必要的 dev compile、scoped `git diff --check`。

## 非目标

- 不改变 `/assistant/runtime-summary` 数据结构或排序。
- 不改变 pending approval、outreach、action queue、sync issue 的真实处理逻辑。
- 不在状态卡里新增 approve / retry / send / cancel / archive 等动作。
