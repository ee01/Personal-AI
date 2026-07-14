# Findings

- `RelationshipRadarService.buildContextCard()` 已优先复用 stored card，并在默认模式下过滤敏感 alias、事实、关系、证据、open loop 和检索提示。
- `RelationshipRadarPage.vue` 已有 `上下文卡请求回执`、`上下文卡刷新失败回执` 和 `上下文复制回执`，但点击前控制点没有等价的 hover / screen-reader 文案。
- 现有 E2E 覆盖了敏感范围请求失败后保留旧快照、复制旧快照、成功包含敏感上下文、恢复默认隐藏和 contextMd 中保留 receipt。
- 本轮最小高价值改进是把这些已有真相下沉到按钮 `title` / `aria-label`，让用户点击前就知道隐私范围和副作用边界。
