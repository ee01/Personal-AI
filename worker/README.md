# Personal AI Worker

纯 Node 执行节点：向 memory-service 出站 pair / heartbeat / claim / report，在本机经 ACP 跑 Codex / Claude Code。

```bash
curl -fsSL https://raw.githubusercontent.com/ee01/Personal-AI/develop/worker/install.sh \
  | bash -s -- --server https://memory.example --token wpt....
```

Desktop App 内嵌同一份代码，普通用户不必单独安装。

零安装（平台调度）：在 Cursor / Codex 的 schedule 里周期性执行：

```bash
node dist/index.js --server https://memory.example --token wpt.... --once
```

`--once` 会 pair（如需要）、heartbeat、领取最多一条任务并回传后退出。
