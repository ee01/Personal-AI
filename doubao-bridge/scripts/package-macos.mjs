import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bridgeRoot = path.resolve(__dirname, '..');
const releaseDir = path.join(bridgeRoot, 'release');
const bundleRoot = path.join(releaseDir, 'doubao-bridge-macos');
const bundledBridgeRoot = path.join(bundleRoot, 'bridge');
const bundledBinRoot = path.join(bundledBridgeRoot, 'bin');
const pkgStageRoot = path.join(releaseDir, 'pkg-root');
const pkgScriptsRoot = path.join(releaseDir, 'pkg-scripts');
const installDirName = 'Doubao Bridge';
const installPath = `/Applications/${installDirName}`;
const pkgOutputPath = path.join(releaseDir, 'Doubao-Bridge-Installer.pkg');

async function resetDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

async function copy(src, dest) {
  await fs.cp(src, dest, { recursive: true });
}

async function writeExecutable(filePath, contents) {
  await fs.writeFile(filePath, contents, 'utf8');
  await fs.chmod(filePath, 0o755);
}

async function run(command, args, options = {}) {
  return execFileAsync(command, args, {
    cwd: bridgeRoot,
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
}

async function readPackageVersion() {
  const packageJson = JSON.parse(await fs.readFile(path.join(bridgeRoot, 'package.json'), 'utf8'));
  return packageJson.version;
}

function makeBootstrapScript() {
  return `#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BRIDGE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SUPPORT_DIR="$HOME/Library/Application Support/PersonalAI/DoubaoBridge"
LOG_DIR="$HOME/Library/Logs/PersonalAI"
ENV_FILE="$SUPPORT_DIR/.env"

mkdir -p "$SUPPORT_DIR" "$LOG_DIR"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if [ -z "\${NVM_DIR:-}" ]; then
  export NVM_DIR="$HOME/.nvm"
fi

if [ -s "$NVM_DIR/nvm.sh" ]; then
  source "$NVM_DIR/nvm.sh"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Doubao Bridge could not find Node.js 20+ in this shell environment."
  osascript -e 'display alert "Doubao Bridge could not find Node.js 20+" message "If you use nvm, make sure ~/.nvm/nvm.sh exists and rerun the installed package. Homebrew paths are also checked automatically."'
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Doubao Bridge could not find npm in this shell environment."
  osascript -e 'display alert "Doubao Bridge could not find npm" message "If you use nvm, make sure ~/.nvm/nvm.sh exists and rerun the installed package."'
  exit 1
fi

cd "$BRIDGE_DIR"

if [ ! -d node_modules ]; then
  echo "Installing bridge dependencies..."
  npm install --omit=dev
fi

if [ ! -f "$SUPPORT_DIR/.playwright-ready" ]; then
  echo "Installing Playwright Chromium (first run only)..."
  npx playwright install chromium
  touch "$SUPPORT_DIR/.playwright-ready"
fi

export DOUBAO_BRIDGE_DATA_DIR="$SUPPORT_DIR/data"
export DOUBAO_BRIDGE_PROFILE_DIR="$SUPPORT_DIR/profile"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi
`;
}

function makeRunBridgeScript() {
  return `#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/bootstrap.sh"

exec node dist/index.js
`;
}

function makeForegroundCommand() {
  return `#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Starting Doubao Bridge in foreground mode."
echo "Do not close this Terminal window if you want the foreground bridge to keep running."
echo ""
"$SCRIPT_DIR/bridge/bin/run-bridge.sh"
echo ""
echo "Doubao Bridge exited. Press Enter to close."
read
`;
}

function makeInstallBackgroundCommand() {
  return `#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="com.personalai.doubao-bridge"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
LAUNCH_AGENT_PATH="$LAUNCH_AGENTS_DIR/$APP_NAME.plist"
LOG_DIR="$HOME/Library/Logs/PersonalAI"

mkdir -p "$LAUNCH_AGENTS_DIR" "$LOG_DIR"

cat > "$LAUNCH_AGENT_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>$APP_NAME</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/zsh</string>
      <string>-lc</string>
      <string>"$SCRIPT_DIR/bridge/bin/run-bridge.sh" >> "$HOME/Library/Logs/PersonalAI/doubao-bridge.log" 2>&1</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>$SCRIPT_DIR/bridge</string>
  </dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "$LAUNCH_AGENT_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$LAUNCH_AGENT_PATH"
launchctl kickstart -k "gui/$(id -u)/$APP_NAME" >/dev/null 2>&1 || true

echo "Doubao Bridge background sync installed."
echo "You can now close this Terminal window."
read -k 1 "REPLY?Press any key to close..."
echo
`;
}

function makeStopCommand() {
  return `#!/bin/zsh
set -euo pipefail

LAUNCH_AGENT_PATH="$HOME/Library/LaunchAgents/com.personalai.doubao-bridge.plist"

launchctl bootout "gui/$(id -u)" "$LAUNCH_AGENT_PATH" >/dev/null 2>&1 || true
pkill -f 'Doubao Bridge/bridge/dist/index.js' >/dev/null 2>&1 || true

echo "Doubao Bridge stopped."
read -k 1 "REPLY?Press any key to close..."
echo
`;
}

function makeUninstallBackgroundCommand() {
  return `#!/bin/zsh
set -euo pipefail

LAUNCH_AGENT_PATH="$HOME/Library/LaunchAgents/com.personalai.doubao-bridge.plist"

launchctl bootout "gui/$(id -u)" "$LAUNCH_AGENT_PATH" >/dev/null 2>&1 || true
rm -f "$LAUNCH_AGENT_PATH"

echo "Doubao Bridge background sync uninstalled."
read -k 1 "REPLY?Press any key to close..."
echo
`;
}

function makeOpenLogsCommand() {
  return `#!/bin/zsh
set -euo pipefail

LOG_DIR="$HOME/Library/Logs/PersonalAI"
LOG_FILE="$LOG_DIR/doubao-bridge.log"
mkdir -p "$LOG_DIR"
touch "$LOG_FILE"
open -a TextEdit "$LOG_FILE"
`;
}

function makePkgPostinstallScript() {
  return `#!/bin/zsh
set -euo pipefail

INSTALL_DIR="${installPath}"

if [ -d "$INSTALL_DIR" ]; then
  chmod +x "$INSTALL_DIR"/*.command >/dev/null 2>&1 || true
  chmod +x "$INSTALL_DIR"/bridge/bin/*.sh >/dev/null 2>&1 || true
  xattr -dr com.apple.quarantine "$INSTALL_DIR" >/dev/null 2>&1 || true
fi

exit 0
`;
}

function makeEnvExample() {
  return `# Copy this file to:
# ~/Library/Application Support/PersonalAI/DoubaoBridge/.env
#
# Then edit the values and restart Doubao Bridge.

MEMORY_SERVICE_BASE_URL=http://127.0.0.1:3210
MEMORY_SERVICE_USER_ID=your-user-id
# MEMORY_SERVICE_API_KEY=

DOUBAO_BRIDGE_AUTO_SYNC=true
DOUBAO_BRIDGE_PROVIDER=doubao

# Optional cadence overrides
# DOUBAO_BRIDGE_POLL_INTERVAL_MS=300000
# DOUBAO_BRIDGE_STABLE_SYNC_INTERVAL_MS=43200000
# DOUBAO_BRIDGE_MOBILE_SYNC_INTERVAL_MS=14400000
# DOUBAO_BRIDGE_REMINDER_SYNC_INTERVAL_MS=900000
`;
}

function makeUserReadme() {
  return `# Doubao Bridge for macOS

This package installs Doubao Bridge into:

${installPath}

If you are looking for the latest downloadable release, use:

https://github.com/ee01/personal-ai/releases/latest

## First-time setup

1. Open the installer package and complete installation.
2. Open ${installPath} in Finder.
3. Double-click \`Start Doubao Bridge.command\`.
4. Open the extension popup and use the Doubao Bridge page to pair and log in.

## Background mode

- After installation, open ${installPath}.
- Double-click \`Install Background Sync.command\`.
- Use \`Stop Doubao Bridge.command\` to stop the process.
- Use \`Uninstall Background Sync.command\` to remove the launchd job.

## Logs

- Use \`Open Doubao Bridge Logs.command\`.

## Optional auto-sync config

Copy \`bridge/.env.example\` to:

\`~/Library/Application Support/PersonalAI/DoubaoBridge/.env\`

Then fill in your Memory Service values and restart the bridge.
`;
}

async function ensurePackagingTools() {
  try {
    await run('/usr/bin/xcrun', ['--find', 'pkgbuild']);
    await run('/usr/bin/xcrun', ['--find', 'productbuild']);
  } catch {
    throw new Error('pkgbuild/productbuild are required to create the macOS installer package.');
  }
}

async function buildInstallerPkg(version) {
  await ensurePackagingTools();
  await fs.rm(pkgOutputPath, { force: true });

  const args = [
    '--root',
    pkgStageRoot,
    '--identifier',
    'com.personalai.doubao-bridge',
    '--version',
    version,
    '--install-location',
    '/',
    '--scripts',
    pkgScriptsRoot,
  ];

  const signingIdentity = process.env.APPLE_INSTALLER_SIGNING_IDENTITY;
  if (signingIdentity) {
    args.push('--sign', signingIdentity);
  }

  args.push(pkgOutputPath);
  await run('/usr/bin/pkgbuild', args, { cwd: releaseDir });

  const notaryProfile = process.env.APPLE_NOTARY_KEYCHAIN_PROFILE || process.env.APPLE_NOTARY_PROFILE;
  if (signingIdentity && notaryProfile) {
    await run('/usr/bin/xcrun', ['notarytool', 'submit', pkgOutputPath, '--keychain-profile', notaryProfile, '--wait']);
    await run('/usr/bin/xcrun', ['stapler', 'staple', pkgOutputPath]);
  }
}

async function main() {
  const version = await readPackageVersion();
  const distDir = path.join(bridgeRoot, 'dist');
  await fs.access(distDir);

  await fs.rm(releaseDir, { recursive: true, force: true });
  await fs.mkdir(bundledBridgeRoot, { recursive: true });
  await fs.mkdir(bundledBinRoot, { recursive: true });
  await resetDir(pkgStageRoot);
  await resetDir(pkgScriptsRoot);

  await copy(distDir, path.join(bundledBridgeRoot, 'dist'));
  await copy(path.join(bridgeRoot, 'package.json'), path.join(bundledBridgeRoot, 'package.json'));
  await copy(path.join(bridgeRoot, 'package-lock.json'), path.join(bundledBridgeRoot, 'package-lock.json'));

  await fs.writeFile(path.join(bundledBridgeRoot, '.env.example'), makeEnvExample(), 'utf8');
  await fs.writeFile(path.join(bundleRoot, 'README.txt'), makeUserReadme(), 'utf8');

  await writeExecutable(path.join(bundledBinRoot, 'bootstrap.sh'), makeBootstrapScript());
  await writeExecutable(path.join(bundledBinRoot, 'run-bridge.sh'), makeRunBridgeScript());

  await writeExecutable(path.join(bundleRoot, 'Start Doubao Bridge.command'), makeForegroundCommand());
  await writeExecutable(path.join(bundleRoot, 'Install Background Sync.command'), makeInstallBackgroundCommand());
  await writeExecutable(path.join(bundleRoot, 'Stop Doubao Bridge.command'), makeStopCommand());
  await writeExecutable(path.join(bundleRoot, 'Uninstall Background Sync.command'), makeUninstallBackgroundCommand());
  await writeExecutable(path.join(bundleRoot, 'Open Doubao Bridge Logs.command'), makeOpenLogsCommand());
  await writeExecutable(path.join(pkgScriptsRoot, 'postinstall'), makePkgPostinstallScript());

  const installedAppRoot = path.join(pkgStageRoot, 'Applications', installDirName);
  await fs.mkdir(path.dirname(installedAppRoot), { recursive: true });
  await copy(bundleRoot, installedAppRoot);

  await buildInstallerPkg(version);

  console.log(`Created macOS bundle at: ${bundleRoot}`);
  console.log(`Created macOS installer package at: ${pkgOutputPath}`);
  if (process.env.APPLE_INSTALLER_SIGNING_IDENTITY) {
    if (process.env.APPLE_NOTARY_KEYCHAIN_PROFILE || process.env.APPLE_NOTARY_PROFILE) {
      console.log('Installer package was signed and notarized.');
    } else {
      console.log('Installer package was signed but not notarized (missing APPLE_NOTARY_KEYCHAIN_PROFILE/APPLE_NOTARY_PROFILE).');
    }
  } else {
    console.log('Installer package was built unsigned. Configure APPLE_INSTALLER_SIGNING_IDENTITY for a Gatekeeper-friendly release.');
  }
}

main().catch((error) => {
  console.error('Failed to package Doubao Bridge macOS installer:', error);
  process.exit(1);
});
