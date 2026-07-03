# Quick Ask 状态卡处理入口计划

## 目标

随机目标：`Quick Ask 状态卡`（Doubao Bridge）。

这次只处理一个用户体验缺口：状态卡已经能说明运行态来源和新鲜度，但“下一步该去哪里处理”仍偏像静态 hint。用户点击后容易误解为已经执行了确认、重试或发送。

## 实施步骤

1. 在状态卡每个状态项里增加明确的处理入口条，区分打开设置与继续追问。
2. 保持边界：除 `setup_blocker` 打开设置外，其它状态只把上下文填入 Quick Ask 输入框，不直接 approve、retry、send、cancel 或写入。
3. 让追问草稿带上处理入口边界，说明点击状态项只是带入排查上下文。
4. 更新 `docs/features/doubao_bridge.md` 的状态卡说明。
5. 扩展 Quick Ask 状态卡 E2E，覆盖处理入口、设置跳转和非设置项不执行外部动作。

## 验证

- `npm run verify:quick-ask:e2e`
- `npm start` 首次成功编译后停止
- `npm run verify:quick-ask:e2e` 作为构建后的浏览器级回归
- `git diff --check -- desktop-app/app/quick-ask.js desktop-app/app/quick-ask.css desktop-app/scripts/quick-ask-status-card-check.mjs docs/features/doubao_bridge.md .planning/2026-06-19-automation-quick-ask-status-action-receipt/plan.md`
