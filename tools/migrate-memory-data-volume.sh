#!/usr/bin/env bash
#
# Move memory-service data off the ./memory-service/data bind mount and into the
# `memory-data` named volume.
#
# Why: the deploy host is Docker Desktop on macOS. Bind mounts there are served
# by virtiofs, which does not give SQLite the file-locking and fsync ordering it
# assumes. That is the root cause behind the recurring "database disk image is
# malformed" on chunks_fts; switching journal_mode to DELETE+FULL only lowered
# the odds. A named volume lives inside the Linux VM's ext4 filesystem and
# behaves like a normal POSIX disk.
#
# The switch is driven by MEMORY_DATA_MOUNT in the compose project's .env, so
# rollback is one line. This script is non-destructive: the bind-mount directory
# is left in place as a cold backup.
#
# Run this on the deploy host, in a maintenance window. Expect the service to be
# down for as long as the copy takes.
#
# Usage:
#   tools/migrate-memory-data-volume.sh              # copy + verify, service left down
#   tools/migrate-memory-data-volume.sh --commit     # copy + verify + flip .env + start
#   tools/migrate-memory-data-volume.sh --rollback   # unset the flip, back to bind mount
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

SOURCE_DIR="$PROJECT_ROOT/memory-service/data"
ENV_FILE="$PROJECT_ROOT/.env"
VOLUME_NAME="$(basename "$PROJECT_ROOT" | tr -cd '[:alnum:]_-')_memory-data"
IMAGE="alpine:3.20"
MODE="copy"

for arg in "$@"; do
  case "$arg" in
    --commit) MODE="commit" ;;
    --rollback) MODE="rollback" ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [ "$MODE" = "rollback" ]; then
  echo "==> reverting to the bind mount"
  if [ -f "$ENV_FILE" ]; then
    # Leave a dated copy: this file holds unrelated deploy config too.
    cp "$ENV_FILE" "$ENV_FILE.bak-$(date +%Y%m%d%H%M%S)"
    grep -v '^MEMORY_DATA_MOUNT=' "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
  fi
  docker compose up -d --force-recreate memory-service
  docker compose ps memory-service
  echo "Back on $SOURCE_DIR. The named volume $VOLUME_NAME is untouched."
  exit 0
fi

if [ ! -d "$SOURCE_DIR" ]; then
  echo "source data directory not found: $SOURCE_DIR" >&2
  exit 1
fi

echo "==> source : $SOURCE_DIR"
echo "==> volume : $VOLUME_NAME"
du -sh "$SOURCE_DIR" 2>/dev/null || true

# The copy must see a quiesced database. A live writer would hand us a torn
# snapshot, which is exactly the failure we are migrating away from.
echo "==> stopping memory-service"
docker compose stop memory-service 2>/dev/null || true

if docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  EXISTING="$(docker run --rm -v "$VOLUME_NAME:/to" "$IMAGE" sh -c 'ls -A /to 2>/dev/null | head -1')"
  if [ -n "$EXISTING" ]; then
    echo "volume $VOLUME_NAME already has data; refusing to overwrite." >&2
    echo "inspect it, then 'docker volume rm $VOLUME_NAME' for a clean re-copy." >&2
    exit 1
  fi
else
  docker volume create "$VOLUME_NAME" >/dev/null
fi

echo "==> copying into the volume (multi-GB data dir takes a while)"
docker run --rm \
  -v "$SOURCE_DIR:/from:ro" \
  -v "$VOLUME_NAME:/to" \
  "$IMAGE" \
  sh -c 'cp -a /from/. /to/ && sync'

echo "==> verifying"
SRC_USERS="$(ls "$SOURCE_DIR/users" 2>/dev/null | wc -l | tr -d ' ')"
SRC_DBS="$(find "$SOURCE_DIR" -name memory.db | wc -l | tr -d ' ')"
DST_USERS="$(docker run --rm -v "$VOLUME_NAME:/to" "$IMAGE" sh -c 'ls /to/users 2>/dev/null | wc -l' | tr -d ' ')"
DST_DBS="$(docker run --rm -v "$VOLUME_NAME:/to" "$IMAGE" sh -c 'find /to -name memory.db | wc -l' | tr -d ' ')"

echo "user dirs : source=$SRC_USERS volume=$DST_USERS"
echo "memory.db : source=$SRC_DBS volume=$DST_DBS"

if [ "$SRC_USERS" != "$DST_USERS" ] || [ "$SRC_DBS" != "$DST_DBS" ]; then
  echo "counts do not match; not flipping the mount. Investigate before retrying." >&2
  exit 1
fi

if [ "$MODE" != "commit" ]; then
  echo
  echo "Copy verified. Service is still stopped and still configured for the bind mount."
  echo "Re-run with --commit to flip MEMORY_DATA_MOUNT and start, or:"
  echo "  docker compose up -d memory-service   # start on the old bind mount"
  exit 0
fi

echo "==> pointing MEMORY_DATA_MOUNT at the volume"
touch "$ENV_FILE"
cp "$ENV_FILE" "$ENV_FILE.bak-$(date +%Y%m%d%H%M%S)"
grep -v '^MEMORY_DATA_MOUNT=' "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
echo "MEMORY_DATA_MOUNT=memory-data" >> "$ENV_FILE"

docker compose up -d --force-recreate memory-service
docker compose ps memory-service

echo
echo "==> post-checks"
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3210/health >/dev/null 2>&1; then
    echo "health OK"
    break
  fi
  sleep 2
done
docker compose exec -T memory-service sh -c 'ls /app/data && ls /app/data/users | head' || true

echo
echo "Done. $SOURCE_DIR is still on disk as a cold backup - keep it until you trust the volume."
echo "Rollback: tools/migrate-memory-data-volume.sh --rollback"
