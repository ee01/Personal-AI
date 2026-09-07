#!/bin/sh
# Resume Tier 2 entity extraction until done.
# FILTER=high-value (default) | all-outage
set -eu

DB_PATH="${DB_PATH:-/app/data/users/esone.qiu/memory.db}"
LOG="${LOG:-/tmp/backfill-tier2-loop.log}"
FILTER="${FILTER:-all-outage}"

remaining() {
  if [ "$FILTER" = "high-value" ]; then
    /usr/local/bin/docker exec memory-service node /app/scripts/inspect-tier2-candidates.mjs "$DB_PATH" 2>/dev/null \
      | sed -n 's/.*"highValueMissingEntitiesJson": \([0-9]*\).*/\1/p' | head -1
  else
    /usr/local/bin/docker exec memory-service node /app/scripts/inspect-tier2-candidates.mjs "$DB_PATH" 2>/dev/null \
      | sed -n 's/.*"missingEntitiesJsonSinceOutage": \([0-9]*\).*/\1/p' | head -1
  fi
}

echo "[$(date -Iseconds)] tier2 loop starting filter=${FILTER}" | tee -a "$LOG"

while true; do
  LEFT="$(remaining || echo 99999)"
  echo "[$(date -Iseconds)] remaining (${FILTER}): ${LEFT}" | tee -a "$LOG"
  if [ "${LEFT}" = "0" ]; then
    echo "[$(date -Iseconds)] tier2 ${FILTER} complete" | tee -a "$LOG"
    break
  fi

  /usr/local/bin/docker exec memory-service node /app/scripts/backfill-tier2-entities.mjs \
    --db-path "$DB_PATH" --apply --filter "$FILTER" --batch-size 20 --pause-ms 300 \
    >> "$LOG" 2>&1 || echo "[$(date -Iseconds)] tier2 batch exited non-zero" | tee -a "$LOG"

  sleep 10
done
