#!/usr/bin/env bash
# Installs the memory-service health watchdog LaunchAgent on the deploy host.
set -euo pipefail

HOST="${WATCHDOG_INSTALL_HOST:-rcadmin@10.32.56.212}"
REMOTE_DIR="${WATCHDOG_INSTALL_PATH:-/Users/rcadmin/personal-ai}"
PLIST_NAME="com.personalai.memory-service-watchdog.plist"
REMOTE_BIN="${REMOTE_DIR}/tools/pai-memory-service-watchdog.sh"

ssh -o StrictHostKeyChecking=accept-new "$HOST" "bash -s" <<EOF
set -euo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:\$PATH"
REMOTE_DIR="${REMOTE_DIR}"
REMOTE_BIN="${REMOTE_BIN}"
chmod +x "\${REMOTE_DIR}/tools/pai-memory-service-watchdog.sh"
mkdir -p "\$HOME/Library/LaunchAgents" "\$HOME/Library/Logs" "\$HOME/Library/Caches"
# Clear stale lock from a prior crash/reboot so the new watchdog can run.
rmdir "\$HOME/Library/Caches/pai-memory-service-watchdog.lock" 2>/dev/null || true
cat > "\$HOME/Library/LaunchAgents/${PLIST_NAME}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.personalai.memory-service-watchdog</string>
  <key>ProgramArguments</key>
  <array>
    <string>\${REMOTE_BIN}</string>
  </array>
  <key>StartInterval</key>
  <integer>60</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>\$HOME/Library/Logs/pai-memory-service-watchdog.launchd.log</string>
  <key>StandardErrorPath</key>
  <string>\$HOME/Library/Logs/pai-memory-service-watchdog.launchd.err</string>
</dict>
</plist>
PLIST
launchctl bootout "gui/\$(id -u)" "\$HOME/Library/LaunchAgents/${PLIST_NAME}" 2>/dev/null || true
launchctl bootstrap "gui/\$(id -u)" "\$HOME/Library/LaunchAgents/${PLIST_NAME}"
launchctl enable "gui/\$(id -u)/com.personalai.memory-service-watchdog"
"\${REMOTE_BIN}" || true
EOF

echo "Memory-service watchdog installed on ${HOST}"
