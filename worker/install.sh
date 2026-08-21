#!/usr/bin/env bash
set -euo pipefail

SERVER=""
TOKEN=""
VERSION="${WORKER_VERSION:-}"
REPO="${GITHUB_REPOSITORY:-ee01/Personal-AI}"
INSTALL_DIR="${WORKER_INSTALL_DIR:-$HOME/.personal-ai/worker}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server) SERVER="$2"; shift 2 ;;
    --token) TOKEN="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --dir) INSTALL_DIR="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$SERVER" || -z "$TOKEN" ]]; then
  echo "Usage: install.sh --server <memory-service-url> --token <pairing-token>" >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

download_release() {
  local api="https://api.github.com/repos/${REPO}/releases"
  local tag=""
  if [[ -n "$VERSION" ]]; then
    tag="$VERSION"
  else
    tag="$(curl -fsSL "$api" | node -e '
      let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{
        const releases=JSON.parse(s);
        const hit=(releases||[]).find(r => String(r.tag_name||"").startsWith("worker-v"));
        if(!hit) { process.exit(2); }
        process.stdout.write(hit.tag_name);
      });
    ')" || true
  fi
  if [[ -z "$tag" ]]; then
    return 1
  fi
  local ver="${tag#worker-v}"
  curl -fsSL -o "$TMP/worker.tgz" "https://github.com/${REPO}/releases/download/${tag}/worker-${ver}.tgz"
}

if ! download_release; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  if [[ -f "$SCRIPT_DIR/src/index.ts" ]]; then
    echo "No worker-v* GitHub release found; using local worker/ sources."
    tar -C "$SCRIPT_DIR/.." -czf "$TMP/worker.tgz" worker
  else
    echo "Unable to download a worker release and no local sources found." >&2
    exit 1
  fi
fi

tar -xzf "$TMP/worker.tgz" -C "$INSTALL_DIR" --strip-components=1
cd "$INSTALL_DIR"
if [[ -f package.json ]]; then
  npm install --omit=dev --no-audit --no-fund >/dev/null 2>&1 || true
  if [[ -f tsconfig.json ]]; then
    npx --yes tsc >/dev/null 2>&1 || true
  fi
fi

ENTRY="dist/index.js"
if [[ ! -f "$ENTRY" ]]; then
  ENTRY="src/index.ts"
fi

cat > "$INSTALL_DIR/run.sh" <<EOF
#!/usr/bin/env bash
cd "$INSTALL_DIR"
exec node ${ENTRY} --server "$SERVER" --token "$TOKEN" --data-dir "$INSTALL_DIR/data"
EOF
chmod +x "$INSTALL_DIR/run.sh"

if [[ "$(uname -s)" == "Darwin" ]]; then
  PLIST="$HOME/Library/LaunchAgents/com.personalai.worker.plist"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0//EN">
<plist version="1.0"><dict>
  <key>Label</key><string>com.personalai.worker</string>
  <key>ProgramArguments</key>
  <array><string>$INSTALL_DIR/run.sh</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
EOF
  launchctl unload "$PLIST" >/dev/null 2>&1 || true
  launchctl load "$PLIST"
  echo "Installed launchd agent: $PLIST"
else
  mkdir -p "$HOME/.config/systemd/user"
  SERVICE="$HOME/.config/systemd/user/personal-ai-worker.service"
  cat > "$SERVICE" <<EOF
[Unit]
Description=Personal AI worker
After=network.target
[Service]
ExecStart=$INSTALL_DIR/run.sh
Restart=always
[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now personal-ai-worker.service
  echo "Installed systemd user service: $SERVICE"
fi

echo "Worker installed to $INSTALL_DIR"
echo "Server: $SERVER"
