# Message Analysis 空导出回执计划

随机目标：`docs/index.md` 中的 `记忆入口规则` / Message Analysis。

## 需要改进的点

规则页当前导出路径在手动规则列表为空时仍会下载一个空的 `<topics></topics>` XML，并显示“已导出 0 条本机手动规则”。这会让用户误以为拿到了有效备份；实际只是成功读取到了空结果。

## 实施计划

1. 保留现有正常导出逻辑；仅在 `topics.length === 0` 时阻止下载文件。
2. 复用现有 `导出规则回执` 容器，新增零结果口径：明确未生成 XML、没有替换/同步/删除 Memory Service，也不会暂停或启动后台采集。
3. 新增聚焦 E2E：正常导出仍触发 download；清空手动规则后再点击导出时断言不会触发 download，并显示空导出回执。
4. 更新 `docs/features/message_analysis.md`，把空导出作为当前产品边界写入导入/导出说明。
5. 验证：运行 `node --check`、`npm start` 首次成功编译、Message Analysis 空导出 E2E、路径限定 `git diff --check`。

## 验证注意

`tools/verify-message-analysis-rule-diagnostics-e2e.mjs` 当前仍等待 `system-observation-banner` / 手动分析范围回执，但当前 `src/modals/topic-modal.tsx` 已没有这些渲染入口；该旧 E2E 在进入本轮导出路径前就失败。为避免把本轮小修扩大成系统观察 UI 复原，本轮只新增聚焦导出 E2E。

## Reminders

本机 Reminders 可读，但没有 `Personal AI` 列表；本轮没有可纳入或标记完成的 Reminder 条目。
