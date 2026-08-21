#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

rand() {
  node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
}

if [[ ! -f .env ]]; then
  API_KEY="$(rand)"
  BOOTSTRAP_API_KEY="$(rand)"
  cat > .env <<EOF
API_KEY=${API_KEY}
BOOTSTRAP_API_KEY=${BOOTSTRAP_API_KEY}
ALLOWED_ORIGINS=
MEMORY_SERVICE_TAG=latest
ROADMAP_SERVICE_TAG=latest
EOF
  echo "Wrote $ROOT/.env with random API_KEY and BOOTSTRAP_API_KEY."
else
  echo "Using existing $ROOT/.env"
  # shellcheck disable=SC1091
  set -a
  source .env
  set +a
fi

mkdir -p data/memory-service data/roadmap-service
docker compose pull memory-service
docker compose up -d memory-service

echo "Waiting for health..."
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3210/health >/dev/null; then
    echo "memory-service is healthy."
    echo
    echo "Extension Options:"
    echo "  记忆服务 API 地址: http://127.0.0.1:3210/api/v1"
    echo "  Bootstrap 密钥:    ${BOOTSTRAP_API_KEY:-see .env}"
    echo "Do not put API_KEY into the Chrome extension."
    exit 0
  fi
  sleep 2
done

echo "Health check failed. See: docker compose logs memory-service" >&2
exit 1
