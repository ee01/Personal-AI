## User request

针对 Roadmap Service 的 jira 信息同步，我有一个问题。

如果 A 用户没有安装 Chrome Extension，打开 Roadmap Service 编辑了甘特图的长度，也就是 task end 的时间。这个时候，他应该无法把这个信息同步到 Gira 上，但 Roadmap Service 记录并存储了这个信息。

之后 B 用户打开 Roadmap Service，这时他应该有两个操作需要做：

1. 加载 jira 上最新的信息。
2. 把其他没有安装 Chrome Extension 时存储的信息，例如刚刚 A 用户修改的 target end，同步到 jira。

这两件事情会发生冲突吗？比如，会先同步出 jira 的信息，刷新掉 A 用户存储的修改吗？如何做到先帮其他用户的修改提交同步？
