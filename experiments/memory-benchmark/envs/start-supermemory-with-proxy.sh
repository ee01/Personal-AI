#!/usr/bin/env bash
# Start Supermemory Local with OpenRouter traffic routed through the memory-benchmark proxy.
set -euo pipefail
BENCH_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SM="${SUPERMEMORY_CHECKOUT:-$(cd "$BENCH_ROOT/../../../personal-ai-supermemory" 2>/dev/null && pwd)}"
PROXY_PORT="${MEMORY_BENCHMARK_PROXY_PORT:-4555}"
PROXY_BASE="${MEMORY_BENCHMARK_PROXY_URL:-http://127.0.0.1:${PROXY_PORT}/v1}"
PROXY_BASE="${PROXY_BASE%/}"

cd "$SM"
export SUPERMEMORY_DATA_DIR="${SUPERMEMORY_DATA_DIR:-$SM/local-state/data}"
export SUPERMEMORY_DISABLE_TELEMETRY=1 SUPERMEMORY_NO_UPDATE_CHECK=1
export SUPERMEMORY_NO_OPEN=1 SUPERMEMORY_HIDE_API_KEY_IN_LOGS=1
export SUPERMEMORY_EMBEDDING_PROVIDER=local
export SUPERMEMORY_EMBEDDING_MODEL=Xenova/bge-m3
export SUPERMEMORY_EMBEDDING_DIMENSIONS=1024
export OPENAI_BASE_URL="$PROXY_BASE"
export OPENAI_MODEL=z-ai/glm-5.3-flash
set -a
source "$BENCH_ROOT/.env"
set +a
export OPENAI_API_KEY="$OPENROUTER_API_KEY"
echo "[supermemory] OPENAI_BASE_URL=$OPENAI_BASE_URL (proxy must already be listening)" >&2
exec "$HOME/.supermemory/bin/supermemory-server"
