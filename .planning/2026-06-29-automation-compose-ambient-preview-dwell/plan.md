# Compose Assist 无感校准预览采样计划

## 目标

- 随机目标功能：`回复助手无感校准`（Compose Assist / Memory System）。
- 本轮问题：`sent_without_insert` 当前在 `pointerenter` 时立即记录“看过预览”的候选。用户只是鼠标扫过 Personal AI icon 后自己发送，也可能被算作“看过但没采用”，污染 ambient calibration。
- UX 原则：只有用户确实停留查看了建议、键盘聚焦建议，或主动打开锁定复核，才把后续发送作为 `sent_without_insert` 学习信号。显式 thumb-down、Escape dismiss、撤销和插入后发送继续走已有更强路径。

## 外部参考

- Gmail Smart Compose 支持开关、个性化和反馈，建议仍由用户主动接受。
- Copilot in Outlook 生成草稿后要求用户 review，并可继续调整。
- Smart Compose 论文强调低延迟、低打扰和高质量建议服务，但接受动作仍由用户控制。
- Interaction-Required Suggestions 论文强调 human agency、ownership 和 fine-grained control。

## 实施步骤

1. 在 `ComposerGuardController` 增加预览 dwell 计时：hover 需要短暂停留后才调用 `rememberPreviewedAssist()`；focus 和锁定复核仍立即记录。
2. 在清理路径取消未完成的 dwell 计时，避免旧 hover 在页面状态变化后补记候选。
3. 扩展 ambient calibration E2E：快速 pointerover/pointerout 后发送不应产生 `sent_without_insert`；停留 hover 后发送仍应产生。
4. 更新 `docs/features/compose_assist.md`，把“hover 预览”改成“实际停留/键盘聚焦预览”才进入被动 no-insert 校准。
5. 验证：运行 ambient calibration E2E、`npm start` 首次成功编译、`npm run verify:i18n` 和 scoped `git diff --check`。

## 非目标

- 不改 `/composer/assist` 后端召回、生成或 privacy gate。
- 不改 thumb-down、Rehearsal structured feedback、accepted/inserted 校准的写入契约。
- 不新增反馈表单或来源浏览器。
