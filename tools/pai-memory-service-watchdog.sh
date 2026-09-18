#!/bin/zsh
# Restarts memory-service only after sustained health failures, with backoff.
# Does NOT quit OrbStack (that amplified 502 storms on the deploy host).
#
# Install: tools/install-memory-service-watchdog.sh
set -u

PATH=/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin
LOG="${PMS_WATCHDOG_LOG:-$HOME/Library/Logs/pai-memory-service-watchdog.log}"
STATE="${PMS_WATCHDOG_STATE:-$HOME/Library/Caches/pai-memory-service-watchdog.state}"
LOCKDIR="${PMS_WATCHDOG_LOCK:-$HOME/Library/Caches/pai-memory-service-watchdog.lock}"
HEALTH_URL="${PMS_HEALTH_URL:-http://127.0.0.1:3210/health}"
SERVICE_DIR="${PMS_SERVICE_DIR:-$HOME/personal-ai}"
DOCKER="${PMS_DOCKER:-/usr/local/bin/docker}"

HEALTH_TIMEOUT_SEC="${HEALTH_TIMEOUT_SEC:-15}"
LOCK_TTL_SEC="${LOCK_TTL_SEC:-1800}"
MIN_RESTART_INTERVAL_SEC="${MIN_RESTART_INTERVAL_SEC:-600}"
REQUIRED_FAILURES="${REQUIRED_FAILURES:-3}"

ts() { date "+%Y-%m-%d %H:%M:%S%z"; }
log() { echo "$(ts) $*" >> "$LOG"; }

check_health() {
  curl -fsS -m "$HEALTH_TIMEOUT_SEC" "$HEALTH_URL" >/dev/null 2>&1
}

read_state() {
  typeset -A st
  st[failures]=0
  st[last_restart]=0
  if [[ -f "$STATE" ]]; then
    while IFS='=' read -r key val; do
      [[ -n "$key" ]] && st[$key]="${val:-0}"
    done < "$STATE"
  fi
  echo "${st[failures]} ${st[last_restart]}"
}

write_state() {
  local failures="$1"
  local last_restart="$2"
  mkdir -p "$(dirname "$STATE")"
  printf 'failures=%s\nlast_restart=%s\n' "$failures" "$last_restart" > "$STATE"
}

clear_stale_lock() {
  if [[ ! -d "$LOCKDIR" ]]; then
    return 0
  fi
  local lock_mtime now
  lock_mtime=$(stat -f %m "$LOCKDIR" 2>/dev/null || echo 0)
  now=$(date +%s)
  if (( now - lock_mtime > LOCK_TTL_SEC )); then
    log "stale lock older than ${LOCK_TTL_SEC}s; removing"
    rmdir "$LOCKDIR" 2>/dev/null || true
  fi
}

clear_stale_lock

if ! mkdir "$LOCKDIR" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "$LOCKDIR" 2>/dev/null || true' EXIT

if check_health; then
  read _ last_restart <<< "$(read_state)"
  write_state 0 "${last_restart:-0}"
  exit 0
fi

read failures last_restart <<< "$(read_state)"
failures=$(( failures + 1 ))
now=$(date +%s)
close_wait_count=$(lsof -nP -iTCP:3210 2>/dev/null | grep -c "(CLOSE_WAIT)" || true)
log "health check failed (${failures}/${REQUIRED_FAILURES}); close_wait=${close_wait_count}; timeout=${HEALTH_TIMEOUT_SEC}s"

if (( failures < REQUIRED_FAILURES )); then
  write_state "$failures" "${last_restart:-0}"
  exit 0
fi

if (( last_restart > 0 && now - last_restart < MIN_RESTART_INTERVAL_SEC )); then
  remaining=$(( MIN_RESTART_INTERVAL_SEC - (now - last_restart) ))
  log "backoff active (${remaining}s left); not restarting yet"
  exit 0
fi

log "sustained health failure; restarting memory-service container"
if [[ -d "$SERVICE_DIR" ]]; then
  (cd "$SERVICE_DIR" && "$DOCKER" compose restart memory-service) >> "$LOG" 2>&1 || true
fi

for _ in {1..20}; do
  if check_health; then
    log "recovered after container restart"
    write_state 0 "$now"
    exit 0
  fi
  sleep 3
done

log "still unhealthy after container restart (will retry after backoff)"
write_state 0 "$now"
exit 1
