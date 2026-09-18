## User request

Scheduled Message功能在打开新建弹窗的时候，帮我提示未配置，但是我已经配置了。

我看了网络请求，是 `config` 这个请求401了，应该是后端新增的 OSS 验证。这个请求中没有使用公共方法，而公共方法应该会使用已经下发的 OSS Key 来发起认证请求。

[http://memory.xmnup.com/api/v1/users/me/keys](http://memory.xmnup.com/api/v1/users/me/keys)

[http://memory.xmnup.com/api/v1/config](http://memory.xmnup.com/api/v1/config) {
    "error": "authentication_required",
    "message": "Authorization Bearer required. Use a personal API key (pak.…), or the service key with X-User-Id."
}

⚠️ **无法验证配置**——当前 tab 可先填写草稿；保存会被阻止，不会写入 Messages、不会创建 Jira Rule 或同步 runtime。 帮我问暂时无法读取 Memory Service 配置（无法读取 memory-service runtime 配置（http://memory.xmnup.com/api/v1）：MemoryService) 401: authentication_required）；这不代表 RingCentral 未配置。
