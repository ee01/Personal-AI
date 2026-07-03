# Memory Coverage Map Backup Scope Boundary Plan

## 目标

- 随机目标：`记忆覆盖地图 / Memory Coverage Map`，主文档 `docs/features/memory_coverage_map.md`。
- 本轮只处理 `录入` 抽屉里的备份恢复路径，不扩大到 Coverage API 聚合或导入解析逻辑。
- 用户问题：备份 zip 恢复时仍显示普通资料的 `work/personal` 写入范围。作为用户会误以为 restore 只影响某个范围；如果在 dry-run 后切换范围，还会清空已识别的备份状态。

## 外部参考

- Microsoft 365 Copilot connector connection details 会把连接统计、索引完整性、部分索引、out-of-sync 和刷新动作拆开展示，说明状态刷新和数据写入/索引影响应分层表达。
- Microsoft 365 Copilot connector error docs 把错误码、次数、日志下载和认证/权限/队列问题分开，支持在恢复或同步失败时保留明确的下一步而不是只给失败 toast。
- Notion Enterprise Search 文档强调 connected app 权限、定期权限同步、删除/断开后的数据保留边界，说明跨来源记忆覆盖页需要把权限/保留/恢复目标边界放在用户操作前。
- Data Transfer Initiative 的 data portability compendium 强调大批量原始数据下载/迁移需要安全和隐私风险提示。
- Mem0 论文把长期记忆的抽取、巩固和检索拆开评估，支持 Coverage Map 不把“恢复/导入成功”直接等同于内容事实可靠或可进入个性化上下文。

## 实施步骤

1. 在 `MemoryCoveragePage.vue` 中增加 backup restore 目标回执，说明备份恢复目标来自当前 Memory Service 用户空间，`work/personal` 只用于普通资料导入。
2. 当用户处于 `backup` 模式或已识别 `backup_zip` 时隐藏普通资料 `写入范围` 控件，避免切换范围清掉 backup dry-run 状态。
3. 保留普通资料、普通 zip、外部 AI 历史导入的 `work/personal` 范围选择；从备份入口选了普通 zip 后仍回到普通资料路径。
4. 扩展 `tools/verify-memory-coverage-e2e.mjs`，覆盖：备份模式下不显示 scope；备份目标回执出现；从备份入口误选普通 zip 后 scope 恢复可见。
5. 更新 `docs/features/memory_coverage_map.md`，用简短文档说明备份恢复目标不受普通资料 scope 控件影响。
6. 验证：运行 memory coverage 相关 E2E、`npm start` 首次成功编译、必要的 scoped `git diff --check`。
