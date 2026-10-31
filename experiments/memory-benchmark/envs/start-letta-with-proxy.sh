#!/usr/bin/env bash
# Start Letta App Server with OpenRouter traffic routed through the memory-benchmark proxy.
set -euo pipefail
BENCH_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LETTA="${LETTA_CHECKOUT:-$(cd "$BENCH_ROOT/../../../personal-ai-letta" 2>/dev/null && pwd)}"
PROXY_PORT="${MEMORY_BENCHMARK_PROXY_PORT:-4555}"
PROXY_BASE="${MEMORY_BENCHMARK_PROXY_URL:-http://127.0.0.1:${PROXY_PORT}/v1}"
PROXY_BASE="${PROXY_BASE%/}"

cd "$LETTA"
export LETTA_CONFIG_DIR="${LETTA_CONFIG_DIR:-$LETTA/local-state/config}"
export LETTA_HOME="${LETTA_HOME:-$LETTA/local-state/home}"
export LETTA_TELEMETRY_DISABLED=1
export OPENAI_API_BASE_URL="$PROXY_BASE"
export OPENAI_BASE_URL="$PROXY_BASE"
set -a
source "$BENCH_ROOT/.env"
set +a
mkdir -p "$LETTA_CONFIG_DIR" "$LETTA_HOME"
echo "[letta] OPENAI_API_BASE_URL=$OPENAI_API_BASE_URL (proxy must already be listening)" >&2
exec ./letta.js server --backend local --listen ws://127.0.0.1:4500
