# Jira 自动化规则导入功能

## 功能介绍

该功能允许在 Jira 自动化管理页面导入之前导出的自动化规则。Personal AI 会在项目自动化页面注入 `Import rule` 按钮，对 Jira Automation JSON 做预检、项目映射、风险摘要和禁用态导入，降低误导入后立即触发的风险。

## 使用方法

1. **访问 Jira 自动化页面**
   - 打开 Jira 项目的自动化管理页面
   - URL 格式：`https://jira.ringcentral.com/secure/AutomationProjectAdminAction!default.jspa?projectKey=YOUR_PROJECT_KEY`

2. **导入规则**
   - 在页面加载完成后，会在 "Create rule" 按钮旁边看到新的 "Import rule" 按钮
   - 点击 "Import rule" 按钮
   - 选择之前从 Jira Automation 导出的 JSON 文件
   - 如果文件中有多条规则，先在预览弹窗中选择要导入的一条
   - 确认目标项目、触发器、组件数量、Web request / external action / secret / JQL / URL / account / schedule 摘要和导入警告后再执行导入
   - 如果源规则允许被其它规则触发，预览会默认阻止导入副本继承这个链式触发能力；确实需要时可手动保留

3. **导入完成**
   - 导入成功后会显示成功消息
   - 新规则默认是 `DISABLED`，需要用户检查后在 Jira 中手动启用
   - 页面会跳转到新导入的规则详情

## 支持的文件格式

导入功能支持 5MB 以内的 Jira 标准导出格式 JSON 文件，包含以下结构：

```json
{
  "rules": [
    {
      "name": "规则名称",
      "state": "ENABLED",
      "canOtherRuleTrigger": false,
      "notifyOnError": "FIRSTERROR",
      "authorAccountId": "用户ID",
      "trigger": { ... },
      "components": [ ... ],
      "projects": [ ... ],
      "labels": [ ... ]
    }
  ],
  "cloud": false
}
```

## 技术实现

### 核心功能

1. **JSON 格式转换**
   - 将导出格式转换为 API 创建格式
   - 递归生成新的组件 ID，避免嵌套 action / condition 沿用源规则 ID
   - 更新项目信息为当前项目
   - 多项目来源会折叠为当前项目，避免重复项目 scope
   - 导入时强制新规则为 `DISABLED`
   - 导入 UI 默认关闭链式触发开关，避免启用后被其它规则意外触发
   - 对超长规则名做截断，降低 Jira API 因名称长度拒绝创建的概率
   - 通过当前 Jira 项目 key 解析 numeric projectId，避免把 projectKey 当作 API projectId
   - 尽量把 `authorAccountId` / `actorAccountId` 设置为当前 Jira 用户，减少跨项目导入后的权限歧义
   - 扫描规则内部的 JQL/filter、硬编码 URL、邮箱/账号和源项目引用，提示用户启用前完成环境迁移检查

2. **API 调用**
   - 使用 `/rest/cb-automation/latest/project/{projectId}/rule` 接口
   - 自动处理认证和请求头

3. **用户界面**
   - 在 iframe 内动态添加导入按钮
   - 如果 Jira Automation 工具栏异步渲染，会继续等待 `Create rule` 按钮出现再插入
   - 提供文件选择、规则选择、导入预览和进度反馈
   - 预览中突出显示 Web request、外部集成动作、secret 引用、JQL/filter、硬编码 URL、账号引用、源项目引用、scheduled trigger、链式触发和版本兼容风险，提醒用户启用前复核
   - 链式触发保护在预览里可见、可切换，目标状态会直接显示在摘要中
   - 显示成功/错误消息

### 文件列表

- `src/contentScriptJiraAutomation.ts` - 主要实现文件
- `src/jira-automation-import/transform.ts` - 导入 JSON 校验与转换逻辑
- 已在 `src/manifest.json` 中配置相应的 content script
- 已在 `webpack.common.cjs` 中添加构建配置

## 错误处理

- 文件格式验证
- 5MB 文件大小限制
- 缺少项目 ID / projectKey 时阻止导入
- 缺少目标 projectId 时阻止转换
- 对环境绑定值做导入前预检，但不会自动改写 JQL、URL 或账号
- API 调用错误处理
- 用户友好的错误消息提示

## 注意事项

1. 导入的规则会使用当前项目的 projectId
2. 如果文件包含多个规则，需要在预览弹窗中选择其中一条
3. 导入的规则会被标记为新规则（isNewRule: true）
4. 原有的规则 ID 会被替换为新的临时 ID
5. 导入后的规则默认暂停，避免导入后立即执行
6. Jira 官方导入要求导出 JSON 与当前 Jira Automation 版本兼容；Personal AI 会提示该风险，但最终兼容性仍以 Jira API 返回为准
7. Web request URL、外部集成账号、secret、JQL、链式触发和定时计划不会自动判断业务正确性，启用前仍需人工复核；预检只负责把疑似环境绑定值提前暴露出来
8. 链式触发默认按安全导入处理；如果业务需要其它 automation rule 继续触发它，需要在预览里明确保留

## 验证建议

- 转换逻辑：`TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/jira-automation-import/__tests__/transform.test.ts`
- 扩展构建：运行 `npm start`，等第一次 webpack 编译成功后停止 watch
- 端到端：用导出的 Jira Automation JSON 在项目自动化页触发预览，确认新规则是 disabled copy 后再手动启用
