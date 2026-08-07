# 定时消息一键初始化请求回执改进计划

## 目标

从 `docs/index.md` 随机抽中 `定时消息一键初始化`。本轮只优化首次初始化路径的状态可见性，不改变 Google Sheet、Apps Script、Web App、触发器或 Config 的创建契约。

## 观察

- `docs/progressing/to-verify.md` 当前为空。
- 本机 Reminders 可读取列表名，但没有 `Personal AI` 列表；本轮没有可关联或可标记完成的 Reminder item。
- 现有代码已经在授权后展示初始化收据，但用户点击“一键生成维护表”后的等待阶段只显示当前步骤，缺少一条清楚说明“已经提交什么、还没发生什么、失败会停在哪”的请求回执。

## 外部参考

- Google Apps Script 的 installable/time-driven trigger 和授权模型说明，初始化流程需要把授权、触发器创建和脚本部署拆成可恢复步骤。
- Twilio Scheduled Messages 和 Zapier Zap History 都把 scheduled/canceled/errored/history 等状态显式留给用户检查，适合借鉴为初始化前后的状态边界。
- Human-AI interaction / automation-bias 研究支持在多步自动化开始时暴露当前范围、未确认副作用和恢复路径，降低用户把“请求中”误解成“已经执行完成”的风险。

## 实施步骤

1. 在 `OneClickSetup` 中增加一键初始化 / 授权后继续初始化的请求回执。
2. 在完成收据 helper 中补充“不会立即发送正式消息、不会 anyone-with-link 共享”的边界行。
3. 更新 one-click setup verifier 和 E2E，覆盖请求回执和完成收据新增边界。
4. 更新 `docs/features/scheduled_messages_manager.md` 的一键初始化描述。
5. 验证：`npm run verify:scheduled-messages-one-click-setup`、`npm start -- --progress` 首次成功编译、`npm run verify:scheduled-messages-one-click-setup:e2e`、`npm run verify:i18n`、scoped `git diff --check`。
