#!/bin/sh
# Auto-resume Tier 1 embedding until all message chunks have vectors.
# Survives container OOM / OrbStack restarts via checkpoint in backfill_progress.
set -eu

DB_PATH="${DB_PATH:-/app/data/users/esone.qiu/memory.db}"
VOLUME="${VOLUME:-personal-ai_memory-data}"
SCRIPT_HOST="${SCRIPT_HOST:-/tmp/backfill-message-index.mjs}"
LOG="${LOG:-/tmp/backfill-tier1-loop.log}"

remaining() {
  /usr/local/bin/docker run --rm \
    -v "${VOLUME}:/app/data" \
    -v "${SCRIPT_HOST}:/app/scripts/backfill-message-index.mjs:ro" \
    personal-ai-memory-service \
    node /app/scripts/backfill-message-index.mjs \
      --db-path "${DB_PATH}" --tier tier1 2>/dev/null \
    | sed -n 's/.*"msgChunksMissingVec": \([0-9]*\).*/\1/p' | head -1
}

echo "[$(date -Iseconds)] tier1 loop starting" | tee -a "${LOG}"
/usr/local/bin/docker stop memory-service 2>/dev/null || true
/usr/local/bin/docker rm -f memory-backfill 2>/dev/null || true

while true; do
  LEFT="$(remaining || echo 99999)"
  echo "[$(date -Iseconds)] remaining message chunks without vec: ${LEFT}" | tee -a "${LOG}"
  if [ "${LEFT}" = "0" ]; then
    echo "[$(date -Iseconds)] tier1 complete" | tee -a "${LOG}"
    break
  fi

  /usr/local/bin/docker rm -f memory-backfill 2>/dev/null || true
  echo "[$(date -Iseconds)] running tier1 batch..." | tee -a "${LOG}"
  /usr/local/bin/docker run --rm --name memory-backfill \
    -v "${VOLUME}:/app/data" \
    -v "${SCRIPT_HOST}:/app/scripts/backfill-message-index.mjs:ro" \
    personal-ai-memory-service \
    node /app/scripts/backfill-message-index.mjs \
      --db-path "${DB_PATH}" --apply --skip-backup --tier tier1 \
      --batch-size 10 --pause-ms 0 --sequential-embed \
    >> "${LOG}" 2>&1 || echo "[$(date -Iseconds)] tier1 run exited non-zero, will retry" | tee -a "${LOG}"

  sleep 15
done

/usr/local/bin/docker start memory-service 2>/dev/null || true
echo "[$(date -Iseconds)] memory-service started" | tee -a "${LOG}"
