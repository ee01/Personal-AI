# Jira 自动化规则导入功能

## 功能介绍

该功能允许在 Jira 自动化管理页面导入之前导出的自动化规则。Personal AI 会在项目自动化页面注入 `Import rule` 按钮，对 Jira Automation JSON 做预检、项目映射、风险摘要和禁用态导入，降低误导入后立即触发的风险。

## 大白话运行逻辑

这个功能不是“直接把规则导进去并启用”，而是先把导出的 Jira Automation JSON 拆开检查，告诉用户里面有什么触发器、外部请求、secret、JQL、schedule 和跨项目绑定，再创建一个默认禁用的副本。

结果主要受这些因素影响：

1. 导出 JSON 是否标准：格式、大小、规则数量和字段完整性决定能否进入预览。
2. 目标项目映射：project key、custom field、filter、connection、account 等环境绑定越多，迁移风险越高。
3. 高风险动作：Web request、secret、外部 URL、schedule、链式触发会要求更明确的复核。
4. 重名规则处理：目标项目已有同名副本时会自动生成编号名称，避免覆盖或混淆。
5. 禁用态导入：导入成功只是创建待检查规则，真正启用仍由用户在 Jira 中完成。

## 使用方法

1. **访问 Jira 自动化页面**
   - 打开 Jira 项目的自动化管理页面
   - URL 格式：`https://jira.ringcentral.com/secure/AutomationProjectAdminAction!default.jspa?projectKey=YOUR_PROJECT_KEY`

2. **导入规则**
   - 在页面加载完成后，会在 "Create rule" 按钮旁边看到新的 "Import rule" 按钮
   - 点击 "Import rule" 按钮
   - 选择之前从 Jira Automation 导出的 JSON 文件
   - 如果文件中有多条规则，先在预览弹窗中选择要导入的一条
   - 确认目标项目、触发器、组件数量、Web request / external action / secret / sensitive or hidden value / JQL / URL / custom field / filter / connection / account / smart value / schedule 摘要、迁移复核清单和导入警告后再执行导入
   - 预览会显示最终导入规则名；如果目标项目里已经有同名导入副本，会自动生成编号名称，避免重复导入后难以区分
   - 预览会汇总启用前检查数量，并把精简复核备注和关键环境绑定样例写入导入副本的描述，方便跳转到 Jira 规则详情后继续检查
   - 预览会生成 `Activation plan`，把导入后到启用前最该做的几步排出来：保持 disabled、映射目标项目查询依赖、重连外部请求/secret/账号、测试 schedule / smart value / 链式触发，再确认 actor 权限和 audit 结果
   - 预览里可复制一份脱敏的启用前复核包，包含目标项目、最终导入名、高/中/低风险检查、环境绑定样例、Activation plan 和导入警告，便于在 Jira 规则详情或审查线程里继续跟进
   - 如果预检发现高风险项，需要先勾选高风险复核确认，才能创建这个禁用态副本
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
   - 生成 `(Imported by Personal AI) ...` 导入名，并在目标项目已有同名规则时追加编号
   - 保留原规则描述，并追加 Personal AI 导入复核备注，记录目标项目、环境绑定摘要、Activation plan 和链式触发状态
   - 复核备注会保留关键 JQL/filter、URL、secret、敏感或隐藏值、custom field、saved filter、connection、账号/收件人、smart value 和源项目引用样例；复核备注中的敏感值只记录脱敏标签，URL 中的 token/API key/password 等参数和常见 webhook path token 会写成 `REDACTED`
   - 对没有安全显示名的 `secret=true` 字段只记录通用 secret 标签，不把 `keyOrValue` 里的原始值写进预览或描述，也不再把隐藏值二次识别成 URL、JQL、smart value 或 source project 样例
   - 导入 UI 默认关闭链式触发开关，避免启用后被其它规则意外触发
   - 转换层默认不保留链式触发能力，只有用户在预览中明确保留时才会写入
   - 对超长规则名做截断，降低 Jira API 因名称长度拒绝创建的概率
   - 通过当前 Jira 项目 key 解析 numeric projectId，避免把 projectKey 当作 API projectId
   - 尽量把 `authorAccountId` / `actorAccountId` 设置为当前 Jira 用户，减少跨项目导入后的权限歧义
   - 扫描规则内部的 JQL/filter、硬编码 URL、custom field、saved filter、connection/credential、邮箱/账号、敏感或隐藏值、smart value 和源项目引用，提示用户启用前完成环境迁移检查

2. **API 调用**
   - 使用 `/rest/cb-automation/latest/project/{projectId}/rule` 接口
   - 自动处理认证和请求头

3. **用户界面**
   - 在 iframe 内动态添加导入按钮
   - 如果 Jira Automation 工具栏异步渲染，会继续等待 `Create rule` 按钮出现再插入；慢加载时会有限重试，避免按钮只尝试一次后消失
   - 提供文件选择、规则选择、导入预览和进度反馈
   - 预览中突出显示 Web request、外部集成动作、secret 引用、敏感或隐藏值、JQL/filter、custom field、saved filter、connection/credential、硬编码 URL、账号引用、smart value、源项目引用、scheduled trigger、链式触发和版本兼容风险，并按高 / 中 / 低风险生成启用前复核清单
   - 预览中显示最终导入名称和同名冲突状态
   - 预览顶部显示导入结果摘要，明确新规则会作为 disabled copy 创建
   - 预览中按类别展示检测到的环境绑定，和导入后写入描述的复核样例保持一致
   - 预览中显示高 / 中 / 低风险检查数量，并说明复核备注会随规则一起导入
   - 预览中的 `Activation plan` 复用同一套风险扫描结果，给出启用前的下一步顺序；这份计划也会写入复制包和导入副本描述，避免用户离开预览后丢失复核路径
   - 预览中提供 `Copy review packet`，复制内容复用同一套脱敏检查结果，不额外暴露 secret、token 或隐藏 payload
   - 检测到高风险项时，导入按钮会先保持禁用，直到用户确认已经阅读高风险复核项
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
- 对环境绑定值做导入前预检，但不会自动改写 JQL、URL、custom field、saved filter、connection、账号、敏感/隐藏值或 smart value；预览和复核备注会脱敏 URL query / fragment 和常见 webhook path 里的凭据样本
- `secret=true` 容器会被视为不可展开的 secret 引用，只展示安全标签或 `hidden secret value`，避免隐藏 payload 通过其它扫描类别被回显
- API 调用错误处理
- 用户友好的错误消息提示

## 注意事项

1. 导入的规则会使用当前项目的 projectId
2. 如果文件包含多个规则，需要在预览弹窗中选择其中一条
3. 导入的规则会被标记为新规则（isNewRule: true）
4. 原有的规则 ID 会被替换为新的临时 ID
5. 导入后的规则默认暂停，避免导入后立即执行
6. Jira 官方导入要求导出 JSON 与当前 Jira Automation 版本兼容；Personal AI 会提示该风险，但最终兼容性仍以 Jira API 返回为准
7. Web request URL、外部集成账号、secret、敏感或隐藏值、JQL、custom field、saved filter、connection、smart value、链式触发和定时计划不会自动判断业务正确性，启用前仍需人工复核；预检只负责把疑似环境绑定值提前暴露出来
8. 链式触发默认按安全导入处理；如果业务需要其它 automation rule 继续触发它，需要在预览里明确保留

## 验证建议

- 转换逻辑：`npm run verify:jira-automation-import`
- 扩展构建：运行 `npm start`，等第一次 webpack 编译成功后停止 watch
- 端到端模拟：`npm run verify:jira-automation-import:e2e`
- 端到端：用导出的 Jira Automation JSON 在项目自动化页触发预览，确认新规则是 disabled copy 后再手动启用
