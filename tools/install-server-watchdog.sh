#!/usr/bin/env bash
# Installs LaunchAgent on the deploy host (rcadmin@10.32.56.212) for public-stack watchdog.
set -euo pipefail

HOST="${WATCHDOG_INSTALL_HOST:-rcadmin@10.32.56.212}"
REMOTE_DIR="${WATCHDOG_INSTALL_PATH:-/Users/rcadmin/personal-ai}"
PLIST_NAME="com.personal-ai.public-stack-watchdog.plist"
REMOTE_PLIST="$HOME/Library/LaunchAgents/${PLIST_NAME}"

ssh -o StrictHostKeyChecking=accept-new "$HOST" "bash -s" <<EOF
set -euo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:\$PATH"
REMOTE_DIR="${REMOTE_DIR}"
chmod +x "\${REMOTE_DIR}/tools/server-public-stack-watchdog.sh"
mkdir -p "\$HOME/Library/LaunchAgents"
cat > "\$HOME/Library/LaunchAgents/${PLIST_NAME}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.personal-ai.public-stack-watchdog</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>\${REMOTE_DIR}/tools/server-public-stack-watchdog.sh</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>120</integer>
  <key>StandardOutPath</key>
  <string>/tmp/public-stack-watchdog.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/public-stack-watchdog.log</string>
</dict>
</plist>
PLIST
launchctl bootout "gui/\$(id -u)" "\$HOME/Library/LaunchAgents/${PLIST_NAME}" 2>/dev/null || true
launchctl bootstrap "gui/\$(id -u)" "\$HOME/Library/LaunchAgents/${PLIST_NAME}"
launchctl enable "gui/\$(id -u)/com.personal-ai.public-stack-watchdog"
"\${REMOTE_DIR}/tools/server-public-stack-watchdog.sh"
EOF

echo "Watchdog installed on ${HOST}"
