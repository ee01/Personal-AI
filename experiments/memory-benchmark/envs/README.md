# Candidate base local environments

These environments are parallel upstream checkouts in sibling directories. Do not copy them into `src/`. Local model data, API credentials, and smoke records stay outside Git. The benchmark dataset is not loaded by these smoke checks. Telemetry is disabled for all three candidates.

Test host: macOS Apple Silicon, Python 3.12 (uv), Node 24 / Bun 1.3.9, Colima Docker 28.3.3, Ollama 0.11.10. All local listeners bind to loopback. LLM calls use OpenRouter (`https://openrouter.ai/api/v1`) with shared `fast` tier `z-ai/glm-5.3-flash`; embeddings remain local `bge-m3` (1024 dimensions). Letta is configured with the same OpenRouter model. No memory SaaS is used. Telemetry is disabled for all three candidates. The key is sourced from ignored `experiments/memory-benchmark/.env`; it is never stored here.

## Memory-benchmark cost proxy (E-167)

Full-matrix harness runs (**A–E**) should route **all** OpenRouter-compatible LLM traffic through the local accounting proxy so `proxy_usd` matches OpenRouter key usage.

**Startup order (strict):**

1. **Proxy (foreground or dedicated terminal):** `cd experiments/memory-benchmark && npm run proxy` — listens on `127.0.0.1:4555` by default (`MEMORY_BENCHMARK_PROXY_PORT`).
2. **Export reuse URL for harness:** `export MEMORY_BENCHMARK_PROXY_URL=http://127.0.0.1:4555/v1` (harness registers the active run on the proxy; D/E server calls without `X-Benchmark-Run` use that window).
3. **D/E only when needed:** Supermemory @ `6767`, Letta App Server @ `4500`, with OpenAI-compatible base URL pointing at the proxy (not raw OpenRouter):
   - `envs/start-supermemory-with-proxy.sh`
   - `envs/start-letta-with-proxy.sh`
4. **Harness / matrix:** `npm run verify-cost-proxy` or `npm run run -- --scheme … --fixture synthetic-mini`.
5. **Teardown:** stop Letta and Supermemory, then stop the proxy (Ctrl-C).

**Attribution:** in-process harness calls may send `X-Benchmark-Run` / `X-Benchmark-Scheme`; Mem0 Python worker gets an explicit `OPENAI_API_BASE_URL` to the proxy (not env inheritance). Supermemory / Letta rely on the active run window while a harness run is in progress.

## Pinned sources and models

Official quickstarts: [Mem0 OSS Python](https://docs.mem0.ai/open-source/python-quickstart) and [local Ollama](https://docs.mem0.ai/cookbooks/companions/local-companion-ollama); [Supermemory Local](https://github.com/supermemoryai/supermemory/blob/main/apps/docs/self-hosting/quickstart.mdx) and [multilingual embeddings](https://github.com/supermemoryai/supermemory/blob/main/apps/docs/self-hosting/embeddings.mdx); [Letta App Server](https://docs.letta.com/self-hosting/app-server/quickstart) and [MemFS](https://docs.letta.com/letta-code/memfs).

| Candidate | Checkout / release | Local model configuration | Runtime |
|---|---|---|---|
| Mem0 OSS | `../personal-ai-mem0`, `mem0ai` 2.2.1, `ts-v3.3.1-9-g26cdefb4`, detached commit `26cdefb46600c0fa5953c4b5ee5003c125539fc4` | OpenRouter `z-ai/glm-5.3-flash`; Ollama `bge-m3` (1024 dimensions); Qdrant local disk | Python library in process; embeddings use Ollama `127.0.0.1:11434`; model config: `local-state/smoke.py` |
| Supermemory Local | Public SDK/docs checkout `../personal-ai-supermemory`, detached commit `a619e2727d9118607cde5cc1a407d84f223ff022`; Local server release tag `server-v0.0.9`, tag commit `4036c7d4470d335022952e67da0c56048f341d23` | OpenRouter `z-ai/glm-5.3-flash`; local `Xenova/bge-m3`, 1024 dimensions, ONNX weight SHA-256 `0826f8c1ab9edf1801db86c61919d4d108e8bfc0b809ec823ad366882ff0b77d` | `127.0.0.1:6767`; local state under sibling checkout; model config: service launch environment |
| Letta | `../personal-ai-letta` (`letta-code`), package 0.34.33, commit `ebc496e532f1a34da9ac8d7e2da41c5920ea77e6` | OpenRouter `z-ai/glm-5.3-flash`; MemFS local Git-backed memory (no separate embedding service) | App Server `ws://127.0.0.1:4500`; config: `local-state/config/lc-local-backend/providers/auth.json`, `local-state/smoke.mjs` |

Supermemory Local's server binary is not built from the public repository: the official docs state that the self-hosted server is a separately distributed binary. The public source checkout is retained for the SDK and docs. Installed official binary `0.0.9`, SHA-256 `b908080270df6d2eb5712637cb833ebd4fc99a6ee15771d38a555084961332e8`. No container image is used by this native run, so image digests are not applicable.

## Common model service

Ollama is installed locally and listens on `127.0.0.1:11434`. It serves local `bge-m3` embeddings for Mem0. All three candidates use OpenRouter for LLM inference; Letta and Supermemory were stopped after smoke.

```bash
ollama serve
ollama pull bge-m3
```

Ollama model IDs observed locally: `qwen3:1.7b` (`8f68893c685c`), `qwen3:4b` (`359d7dd4bcda`), and `bge-m3:latest` (`790764642607`). A `qwen2.5:3b` pull was stopped at 94% after the local registry transfer slowed below 1 MB/s; it is not available in `ollama list` and is not used by these environments.

## Mem0 OSS

Install the exact cloned source into its isolated environment:

```bash
cd ../personal-ai-mem0
uv python install 3.12
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -e '.[llms]'
MEM0_TELEMETRY=false .venv/bin/python local-state/smoke.py
```

The smoke config uses Mem0's `openai` LLM provider with `OPENAI_MODEL=z-ai/glm-5.3-flash`, base URL `https://openrouter.ai/api/v1`, and `OPENAI_API_KEY` mapped from ignored `experiments/memory-benchmark/.env`. Ollama `bge-m3` (1024 dimensions) remains the embedder, with Qdrant's embedded local store at `local-state/qdrant`. This is the OSS Python library quickstart (add, search, delete), not Mem0 Platform or the self-hosted Postgres server. `MEM0_TELEMETRY=false` prevents the SDK's default PostHog telemetry.

Start: `ollama serve` only for the local embedder (no Mem0 daemon; the Python process is the client/runtime). Stop: stop that Python process; stop Ollama with Ctrl-C if it was started for this experiment. With an explicit date, `Memory.add("I will attend the product review in Hangzhou on November 5, 2026.")` returned the same date and city. The rerun retrieved it for `Where is the product review on November 5, 2026?` (score `0.747`) and `11月5日的产品评审在哪座城市？` (score `0.643`); delete removed it and the user scope was empty afterward. A preliminary relative-date probe (`next Thursday`) was retrieved but normalized incorrectly to November 3, 2026 (Tuesday); this is a known extraction-quality issue for relative dates and should be evaluated separately. No extraction exception occurred with the API model, so there is no adapter crash to hand to E-150. Earlier Ollama trials: qwen3:1.7b extracted no record; qwen3:4b failed with `Error parsing extraction response: Expecting ',' delimiter`. SDK emitted non-fatal notices that optional spaCy and fastembed extras are not installed; this configuration uses Ollama vectors and Qdrant, not fastembed/BM25.

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
export OPENAI_BASE_URL=http://127.0.0.1:4555/v1
export OPENAI_MODEL=z-ai/glm-5.3-flash
set -a && source ../personal-ai/experiments/memory-benchmark/.env && set +a
export OPENAI_API_KEY="$OPENROUTER_API_KEY"
"$HOME/.supermemory/bin/supermemory-server"
```

Stop with Ctrl-C. The server booted on port 6767 with `Xenova/bge-m3` 1024-dimensional multilingual local embeddings; its cache is present (560 MB; quantized ONNX weight SHA-256 above). For the rerun, the LLM variables map to OpenRouter `z-ai/glm-5.3-flash`, matching Mem0 and Letta; the key comes from ignored `experiments/memory-benchmark/.env` and is not copied into the private state directory or this README. POST `/ns/benchmark-smoke/document` with `I will attend the product review in Hangzhou next Thursday.` returned `{"id":"benchmark-smoke-zh","status":"queued"}`. Immediate status GET was `queued`; subsequent GETs remained queued twice and then returned `done` after about 1.1 seconds. Once `done`, exact-source search (`query` equal to the English source, `limit:5`, `threshold:0`) returned the chunk at similarity `1.000` on the first request. Chinese search (`下周四的产品评审在哪座城市？`, same limit and threshold) returned the English chunk at similarity `0.721` on the first request. A probe while still queued returned 0 exact-source results; a retry 2.5 seconds later found it. After `done`, no extra wait was needed in the confirmed run. DELETE returned count 1 and follow-up GET returned 404. Request and response bodies were recorded in the local smoke output; no API credentials are logged.

## Letta Code + App Server + MemFS

The smoke agent selects `openrouter/z-ai/glm-5.3-flash` in `local-state/smoke.mjs`. The server reads `OPENROUTER_API_KEY` from the ignored benchmark `.env` at launch; do not persist it through `letta connect`.

```bash
cd ../personal-ai-letta
bun install --frozen-lockfile --registry=https://registry.npmjs.org
bun run build
export LETTA_CONFIG_DIR="$PWD/local-state/config"
export LETTA_HOME="$PWD/local-state/home"
export LETTA_TELEMETRY_DISABLED=1
export OPENAI_API_BASE_URL=http://127.0.0.1:4555/v1
export OPENAI_BASE_URL=http://127.0.0.1:4555/v1
set -a && source ../personal-ai/experiments/memory-benchmark/.env && set +a
mkdir -p "$LETTA_CONFIG_DIR" "$LETTA_HOME"
./letta.js server --backend local --listen ws://127.0.0.1:4500
```

Keep the App Server in the foreground; stop with Ctrl-C. Local state is isolated from the user's default `~/.letta`. Smoke result: **passed** — created an unpinned local agent, wrote and read a MemFS file with required v2 frontmatter, deleted the file, and deleted the temporary agent. The first write attempt without frontmatter was rejected by the MemFS validator; the corrected v2-format write passed.

## Smoke outcomes and known issues

| Candidate | Write | Retrieve | Delete | Known issues |
|---|---|---|---|---|
| Mem0 OSS | Passed with OpenRouter `z-ai/glm-5.3-flash` and local `bge-m3` | Passed (English exact-date query 0.747; Chinese query 0.643) | Passed | Both queries retrieved the extracted Hangzhou fact. Optional spaCy/fastembed warnings are non-fatal. This smoke did not capture provider token usage or billed cost. |
| Supermemory Local | Passed with OpenRouter `z-ai/glm-5.3-flash`; initial status `queued`, then `done` | Passed (exact English source 1.000; Chinese query 0.721) | Passed; follow-up GET returned 404 | Both queries passed after ingestion reached `done`. Official 0.0.9 binary runs natively; public repository does not contain the server implementation. Token usage and billed cost were not exposed by the smoke. |
| Letta | Passed with OpenRouter `z-ai/glm-5.3-flash` agent configuration | Passed (exact MemFS read) | Passed | This smoke validates MemFS writes, reads and deletion; it does not invoke model-generated extraction or report token usage/cost. MemFS v2 requires `name` and `description` frontmatter except on `MEMORY.md`. |

Ollama cleanup: `ollama rm qwen2.5:3b` reported `model not found`. `ollama list` contains only `qwen3:1.7b`, `qwen3:4b`, and `bge-m3`; all local blobs are referenced by manifests, and no `qwen2.5` manifest, partial/temp file, or orphan blob was found under `~/.ollama/models`. No manual deletion was performed.

Smoke request/response evidence contains only synthetic text and remains in each sibling checkout local-state directory. Per-run token usage and cost were not surfaced by these SDK/scripts; check OpenRouter activity for billing. No API credential is included in the evidence or this README.
