#!/bin/sh
# Run full tier2, then export backup zip to /tmp on the memory host.
set -eu

export FILTER=all-outage
export LOG=/tmp/backfill-tier2-full.log

echo "[pipeline] tier2 full outage backfill..."
FILTER=all-outage /tmp/run-tier2-until-done.sh

echo "[pipeline] export backup..."
API_KEY="$(/usr/local/bin/docker exec memory-service printenv API_KEY 2>/dev/null | tr -d '\r')"
if [ -z "$API_KEY" ]; then
  echo "[pipeline] API_KEY not found in memory-service container" >&2
  exit 1
fi
API_KEY="$API_KEY" /tmp/export-backup-local.sh

echo "[pipeline] done"
