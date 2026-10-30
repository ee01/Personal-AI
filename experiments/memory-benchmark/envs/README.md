# Candidate base local environments

These environments are parallel upstream checkouts in sibling directories. Do not copy them into `src/`. Local model data, API credentials, and smoke records stay outside Git. The benchmark dataset is not loaded by these smoke checks. Telemetry is disabled for all three candidates.

Test host: macOS Apple Silicon, Python 3.12 (uv), Node 24 / Bun 1.3.9, Colima Docker 28.3.3, Ollama 0.11.10. All listeners bind to loopback. LLM inference is configured through local Ollama; no memory SaaS is used.

## Pinned sources and models

Official quickstarts: [Mem0 OSS Python](https://docs.mem0.ai/open-source/python-quickstart) and [local Ollama](https://docs.mem0.ai/cookbooks/companions/local-companion-ollama); [Supermemory Local](https://github.com/supermemoryai/supermemory/blob/main/apps/docs/self-hosting/quickstart.mdx) and [multilingual embeddings](https://github.com/supermemoryai/supermemory/blob/main/apps/docs/self-hosting/embeddings.mdx); [Letta App Server](https://docs.letta.com/self-hosting/app-server/quickstart) and [MemFS](https://docs.letta.com/letta-code/memfs).

| Candidate | Checkout / release | Local model configuration | Runtime |
|---|---|---|---|
| Mem0 OSS | `../personal-ai-mem0`, `mem0ai` 2.2.1, `ts-v3.3.1-9-g26cdefb4`, detached commit `26cdefb46600c0fa5953c4b5ee5003c125539fc4` | Ollama `qwen3:4b`; `bge-m3` (1024 dimensions); Qdrant local disk | Python library in process; Ollama `127.0.0.1:11434` |
| Supermemory Local | Public SDK/docs checkout `../personal-ai-supermemory`, detached commit `a619e2727d9118607cde5cc1a407d84f223ff022`; Local server release tag `server-v0.0.9`, tag commit `4036c7d4470d335022952e67da0c56048f341d23` | Local `Xenova/bge-m3`, 1024 dimensions, ONNX weight SHA-256 `0826f8c1ab9edf1801db86c61919d4d108e8bfc0b809ec823ad366882ff0b77d`; Ollama `qwen3:4b` via OpenAI-compatible API | `127.0.0.1:6767`; local state under sibling checkout |
| Letta | `../personal-ai-letta` (`letta-code`), package 0.34.33, commit `ebc496e532f1a34da9ac8d7e2da41c5920ea77e6` | Ollama `qwen3:1.7b`; MemFS local Git-backed memory (no separate embedding service) | App Server `ws://127.0.0.1:4500`; local state isolated under sibling checkout |

Supermemory Local's server binary is not built from the public repository: the official docs state that the self-hosted server is a separately distributed binary. The public source checkout is retained for the SDK and docs. Installed official binary `0.0.9`, SHA-256 `b908080270df6d2eb5712637cb833ebd4fc99a6ee15771d38a555084961332e8`. No container image is used by this native run, so image digests are not applicable.

## Common model service

Ollama is installed locally and listens on `127.0.0.1:11434`.

```bash
ollama serve
ollama pull qwen3:1.7b
ollama pull qwen3:4b
ollama pull bge-m3
```

Ollama model IDs observed locally: `qwen3:1.7b` (`8f68893c685c`), `qwen3:4b` (`359d7dd4bcda`), and `bge-m3:latest` (`790764642607`). A `qwen2.5:3b` pull was stopped at 94% after the local registry transfer slowed below 1 MB/s; it is not available in `ollama list` and is not used by these environments. Its incomplete cache files remain in Ollama's model directory because automatic review rejected a direct `rm -f` cleanup command.

## Mem0 OSS

Install the exact cloned source into its isolated environment:

```bash
cd ../personal-ai-mem0
uv python install 3.12
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -e '.[llms]'
MEM0_TELEMETRY=false .venv/bin/python local-state/smoke.py
```

The smoke config sets Ollama as both LLM and embedder, with Qdrant's embedded local store at `local-state/qdrant`. This is the OSS Python library quickstart (add, search, delete), not Mem0 Platform or the self-hosted Postgres server. `MEM0_TELEMETRY=false` prevents the SDK's default PostHog telemetry.

Start: `ollama serve` (no Mem0 daemon; the Python process is the client/runtime). Stop: stop that Python process; stop Ollama with Ctrl-C if it was started for this experiment. Smoke on `qwen3:1.7b`: **failed** because `Memory.add()` returned no extracted records and the Chinese search returned zero hits. Retried with `qwen3:4b`: Mem0 emitted `Error parsing extraction response: Expecting ',' delimiter` and again returned zero hits. No record existed to delete. SDK emitted non-fatal notices that optional spaCy and fastembed extras are not installed; this configuration uses Ollama vectors and Qdrant, not fastembed/BM25.

## Supermemory Local

Pinned official installation command:

```bash
curl -fsSL https://supermemory.ai/install | bash -s -- 0.0.9
```

Start on the pinned local release with telemetry and update checks disabled. The first boot initializes local storage and downloads/loads `Xenova/bge-m3`:

```bash
cd ../personal-ai-supermemory
export SUPERMEMORY_DATA_DIR="$PWD/local-state/data"
export SUPERMEMORY_DISABLE_TELEMETRY=1 SUPERMEMORY_NO_UPDATE_CHECK=1
export SUPERMEMORY_NO_OPEN=1 SUPERMEMORY_HIDE_API_KEY_IN_LOGS=1
export SUPERMEMORY_EMBEDDING_PROVIDER=local
export SUPERMEMORY_EMBEDDING_MODEL=Xenova/bge-m3
export SUPERMEMORY_EMBEDDING_DIMENSIONS=1024
export OPENAI_BASE_URL=http://127.0.0.1:11434/v1
export OPENAI_API_KEY=ollama OPENAI_MODEL=qwen3:4b
"$HOME/.supermemory/bin/supermemory-server"
```

Stop with Ctrl-C. The server booted on port 6767 with the requested `Xenova/bge-m3` 1024-dimensional multilingual local embedder; its first cache download completed (560 MB; quantized ONNX weight SHA-256 above). Two smoke writes reached document status `done` and produced a chunk, but Chinese search **failed** (zero results for both the semantic question and exact source text, including `searchMode=chunks` and threshold 0) with both `qwen3:1.7b` and `qwen3:4b`. Delete **passed** (count 1 and follow-up GET returned 404). `qwen2.5:3b` could not be installed locally during this run due the slowed model transfer (see common model service). The API key is generated locally with mode 0600; keep it in the private state directory and never copy it into this README.

## Letta Code + App Server + MemFS

```bash
cd ../personal-ai-letta
bun install --frozen-lockfile --registry=https://registry.npmjs.org
bun run build
export LETTA_CONFIG_DIR="$PWD/local-state/config"
export LETTA_HOME="$PWD/local-state/home"
export LETTA_TELEMETRY_DISABLED=1
mkdir -p "$LETTA_CONFIG_DIR" "$LETTA_HOME"
./letta.js --backend local connect ollama --base-url http://127.0.0.1:11434/v1
./letta.js server --backend local --listen ws://127.0.0.1:4500
```

Keep the App Server in the foreground; stop with Ctrl-C. Local state is isolated from the user's default `~/.letta`. Smoke result: **passed** — created an unpinned local agent, wrote and read a MemFS file with required v2 frontmatter, deleted the file, and deleted the temporary agent. The first write attempt without frontmatter was rejected by the MemFS validator; the corrected v2-format write passed.

## Smoke outcomes and known issues

| Candidate | Write | Retrieve | Delete | Known issues |
|---|---|---|---|---|
| Mem0 OSS | Failed with `qwen3:1.7b` (no extracted record) and `qwen3:4b` (invalid extraction JSON) | Failed (0 results) | Not reached | Optional spaCy/fastembed warnings are non-fatal. Qwen2.5 retry not installed because download was stopped at 94%. |
| Supermemory Local | Passed (document ingested and chunked) | Failed (0 hits with Qwen3 1.7B and 4B) | Passed | Official 0.0.9 binary runs natively; public repository does not contain the server implementation. Multilingual embedder initialized successfully, but local search returned no results. Qwen2.5 retry not installed because download was stopped at 94%. |
| Letta | Passed | Passed (MemFS read) | Passed | MemFS v2 requires `name` and `description` frontmatter on files other than `MEMORY.md`. |
