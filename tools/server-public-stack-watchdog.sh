#!/usr/bin/env bash
# Keeps roadmap.xmnup.com / memory.xmnup.com reachable after OrbStack/Docker restarts.
# Install: tools/install-server-watchdog.sh (LaunchAgent on deploy host).
set -euo pipefail

export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:${PATH:-}"

LOG_TAG="public-stack-watchdog"
NPM_DIR="/Users/rcadmin/nginxproxymanager"
NPM_DATA="${NPM_DIR}/data/nginx/proxy_host"
PERSONAL_AI_DIR="/Users/rcadmin/personal-ai"
ROADMAP_URL="http://127.0.0.1/health"
ROADMAP_HOST="roadmap.xmnup.com"
MEMORY_HOST="memory.xmnup.com"
ROADMAP_PORT=3220
MEMORY_PORT=3210

log() { echo "[${LOG_TAG}] $*"; }

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log "docker not found; skipping"
    exit 0
  fi
}

npm_gateway_ip() {
  docker network inspect nginxproxymanager_default --format '{{(index .IPAM.Config 0).Gateway}}' 2>/dev/null || true
}

ensure_gitlab_not_on_port_80() {
  if docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E '^gitlab ' | grep -q '0.0.0.0:80->'; then
    log "gitlab is binding host port 80; restarting gitlab on 8080:80"
    local gitlab_compose="/Users/rcadmin/Desktop/docker/gitlab/docker-compose.yml"
    if [[ -f "$gitlab_compose" ]]; then
      sed -i '' "s/'80:80'/'8080:80'/g" "$gitlab_compose"
      (cd /Users/rcadmin/Desktop/docker/gitlab && docker compose up -d)
    fi
  fi
}

ensure_npm_running() {
  if ! docker ps --format '{{.Names}}' | grep -qx 'nginxproxymanager-app-1'; then
    log "NPM container missing; starting nginxproxymanager stack"
  (cd "$NPM_DIR" && docker compose up -d)
    sleep 3
  fi

  local networks
  networks="$(docker inspect nginxproxymanager-app-1 --format '{{json .NetworkSettings.Networks}}' 2>/dev/null || echo '{}')"
  if [[ "$networks" == "{}" ]]; then
    log "NPM has no Docker network; recreating nginxproxymanager stack"
    (cd "$NPM_DIR" && docker compose down && docker compose up -d)
    sleep 3
  fi
}

patch_npm_upstream() {
  local gateway="$1"
  local host="$2"
  local port="$3"
  local conf_file="$4"

  if [[ ! -f "$conf_file" ]]; then
    return 0
  fi

  if ! grep -q "server_name ${host};" "$conf_file"; then
    return 0
  fi

  # Route via Docker bridge gateway -> host-published port (stable across container IP changes).
  sed -i '' \
    -e "s/set \$server         \"[^\"]*\";/set \$server         \"${gateway}\";/" \
    "$conf_file"
  sed -i '' \
    -e "s/set \$port           [0-9]*;/set \$port           ${port};/" \
    "$conf_file"
}

ensure_core_services() {
  if [[ -d "$PERSONAL_AI_DIR" ]]; then
    (
      cd "$PERSONAL_AI_DIR"
      docker compose up -d roadmap-service memory-service 2>/dev/null || true
    )
  fi
}

wait_for_health() {
  local url="$1"
  local attempts="${2:-30}"
  for _ in $(seq 1 "$attempts"); do
    if curl -fsS -m 3 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

public_roadmap_ok() {
  curl -fsS -m 5 -H "Host: ${ROADMAP_HOST}" "$ROADMAP_URL" >/dev/null 2>&1
}

reload_npm() {
  if docker ps --format '{{.Names}}' | grep -qx 'nginxproxymanager-app-1'; then
    docker exec nginxproxymanager-app-1 nginx -t >/dev/null 2>&1 && \
      docker exec nginxproxymanager-app-1 nginx -s reload >/dev/null 2>&1 || true
  fi
}

main() {
  require_docker
  ensure_gitlab_not_on_port_80
  ensure_npm_running
  ensure_core_services

  local gateway
  gateway="$(npm_gateway_ip)"
  if [[ -z "$gateway" ]]; then
    log "nginxproxymanager_default gateway not found"
    exit 1
  fi

  patch_npm_upstream "$gateway" "$ROADMAP_HOST" "$ROADMAP_PORT" "${NPM_DATA}/5.conf"
  patch_npm_upstream "$gateway" "$MEMORY_HOST" "$MEMORY_PORT" "${NPM_DATA}/4.conf"
  reload_npm

  if ! wait_for_health "http://127.0.0.1:${ROADMAP_PORT}/health" 15; then
    log "roadmap-service health failed; force-recreating"
    (cd "$PERSONAL_AI_DIR" && docker compose up -d --force-recreate roadmap-service)
    wait_for_health "http://127.0.0.1:${ROADMAP_PORT}/health" 30 || true
  fi

  if ! public_roadmap_ok; then
    log "public roadmap probe failed; restarting NPM"
    (cd "$NPM_DIR" && docker compose restart)
    sleep 3
    reload_npm
    public_roadmap_ok || log "public roadmap still failing after NPM restart"
  else
    log "ok gateway=${gateway} roadmap public probe passed"
  fi
}

main "$@"
