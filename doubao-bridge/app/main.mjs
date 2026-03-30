import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, shell } from 'electron';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(
  await fs.readFile(path.join(__dirname, '..', 'package.json'), 'utf8'),
);
const appVersion = packageJson.version || app.getVersion();

const appSupportDir = path.join(app.getPath('appData'), 'PersonalAI', 'DoubaoBridge');
const logsDir = path.join(app.getPath('home'), 'Library', 'Logs', 'PersonalAI');
const appLogFile = path.join(logsDir, 'doubao-bridge-app.log');
const bridgeLogFile = path.join(logsDir, 'doubao-bridge-agent.log');
const bridgePidFile = path.join(appSupportDir, 'bridge-agent.pid');
const legacyLaunchAgentFile = path.join(
  app.getPath('home'),
  'Library',
  'LaunchAgents',
  'com.personalai.doubao-bridge.plist',
);
const bridgeEntry = path.join(__dirname, '..', 'dist', 'index.js');
const backgroundMode = process.argv.includes('--background');
const bridgeHost = process.env.DOUBAO_BRIDGE_HOST || '127.0.0.1';
const bridgePort = Number(process.env.DOUBAO_BRIDGE_PORT || '46321');
const bridgeBaseUrl = `http://${bridgeHost}:${bridgePort}`;
const disableLoginItem = process.env.DOUBAO_BRIDGE_DISABLE_LOGIN_ITEM === '1';
const packagedPlaywrightBrowsersDir = path.join(process.resourcesPath, 'playwright-browsers');
const assetsDir = app.isPackaged
  ? path.join(process.resourcesPath, 'app', 'assets')
  : path.join(__dirname, '..', 'assets');
const trayIconPath = path.join(assetsDir, 'tray-icon.png');
const appIconPath = path.join(assetsDir, 'app-icon.png');

let mainWindow = null;
let bridgeProcess = null;
let tray = null;
let allowQuit = false;

function getAppBundlePath() {
  return path.dirname(path.dirname(path.dirname(process.execPath)));
}

async function ensureDirs() {
  await fs.mkdir(appSupportDir, { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });
}

function syncLoginItem(openAtLogin) {
  if (process.platform !== 'darwin' || disableLoginItem) return;
  app.setLoginItemSettings({
    openAtLogin,
    openAsHidden: true,
    args: ['--background'],
  });
}

async function appendLog(filePath, line) {
  await fs.appendFile(filePath, `${new Date().toISOString()} ${line}\n`, 'utf8').catch(() => undefined);
}

function getBridgeEnv() {
  return {
    ...process.env,
    DOUBAO_BRIDGE_DATA_DIR: path.join(appSupportDir, 'data'),
    DOUBAO_BRIDGE_PROFILE_DIR: path.join(appSupportDir, 'profile'),
    PLAYWRIGHT_BROWSERS_PATH:
      process.env.PLAYWRIGHT_BROWSERS_PATH || (app.isPackaged ? packagedPlaywrightBrowsersDir : '0'),
  };
}

async function getBridgeHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1_500);
  try {
    const response = await fetch(`${bridgeBaseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    return payload;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function isCompatibleBridge(payload) {
  return payload?.service === 'doubao-bridge' && payload?.version === appVersion;
}

async function isBridgeReachable() {
  return isCompatibleBridge(await getBridgeHealth());
}

async function waitForBridgeReady(timeoutMs = 8_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isBridgeReachable()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function findListeningProcessPid(port) {
  try {
    const { stdout } = await execFileAsync('/usr/sbin/lsof', [
      '-nP',
      `-iTCP:${port}`,
      '-sTCP:LISTEN',
      '-t',
    ]);
    const pid = Number(stdout.trim().split(/\s+/)[0]);
    return Number.isFinite(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}

async function terminatePid(pid) {
  if (!pid || pid === process.pid) return false;
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return false;
  }

  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    return true;
  }
  return true;
}

async function ensureBridgeProcess() {
  const existingHealth = await getBridgeHealth();
  if (isCompatibleBridge(existingHealth)) {
    return;
  }

  if (existingHealth?.service === 'doubao-bridge') {
    const pid = await findListeningProcessPid(bridgePort);
    await appendLog(
      appLogFile,
      `[warn] replacing incompatible bridge on port ${bridgePort} (version=${existingHealth.version || 'unknown'}, pid=${pid || 'unknown'})`,
    );
    if (pid) {
      await terminatePid(pid);
    }
  } else if (existingHealth) {
    throw new Error(`Port ${bridgePort} is already in use by another local service.`);
  }

  if (bridgeProcess && !bridgeProcess.killed) {
    return;
  }

  await ensureDirs();
  bridgeProcess = spawn(process.execPath, [bridgeEntry], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...getBridgeEnv(),
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (bridgeProcess.pid) {
    await fs.writeFile(bridgePidFile, String(bridgeProcess.pid), 'utf8').catch(() => undefined);
  }

  bridgeProcess.stdout?.on('data', (chunk) => {
    void appendLog(bridgeLogFile, String(chunk).trim());
  });
  bridgeProcess.stderr?.on('data', (chunk) => {
    void appendLog(bridgeLogFile, `[stderr] ${String(chunk).trim()}`);
  });
  bridgeProcess.on('exit', (code, signal) => {
    void appendLog(bridgeLogFile, `[exit] code=${code ?? 'null'} signal=${signal ?? 'null'}`);
    void fs.rm(bridgePidFile, { force: true }).catch(() => undefined);
    bridgeProcess = null;
  });

  const ready = await waitForBridgeReady();
  if (!ready) {
    await appendLog(bridgeLogFile, `[warn] bridge did not become healthy within timeout at ${bridgeBaseUrl}`);
  }
}

async function stopBridgeProcess() {
  let targetPid = bridgeProcess?.pid;
  if (!targetPid) {
    const rawPid = await fs.readFile(bridgePidFile, 'utf8').catch(() => '');
    const parsedPid = Number(rawPid.trim());
    targetPid = Number.isFinite(parsedPid) && parsedPid > 0 ? parsedPid : undefined;
  }

  if (!targetPid) return;

  try {
    process.kill(targetPid, 'SIGTERM');
  } catch {
    await fs.rm(bridgePidFile, { force: true }).catch(() => undefined);
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 1_500));
  try {
    process.kill(targetPid, 0);
    process.kill(targetPid, 'SIGKILL');
  } catch {
    // Process already exited.
  }
  await fs.rm(bridgePidFile, { force: true }).catch(() => undefined);
}

function showMainWindow() {
  syncWindowPresence(true);
  if (!mainWindow) {
    createWindow();
  } else {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
}

function applyMacUiMode() {
  if (process.platform !== 'darwin') return;
  app.setActivationPolicy(backgroundMode ? 'accessory' : 'regular');
  if (backgroundMode) {
    app.dock?.hide();
  } else {
    app.dock?.show();
  }
}

function syncWindowPresence(showWindow) {
  if (process.platform !== 'darwin') return;
  app.setActivationPolicy(showWindow ? 'regular' : 'accessory');
  if (showWindow) {
    app.dock?.show();
  } else {
    app.dock?.hide();
  }
}

function createTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Open Doubao Bridge',
      click: () => showMainWindow(),
    },
    {
      label: 'Open Logs',
      click: () => {
        void shell.openPath(bridgeLogFile);
      },
    },
    { type: 'separator' },
    {
      label: 'Uninstall Doubao Bridge...',
      click: () => {
        void handleUninstall();
      },
    },
    {
      label: 'Stop Background and Quit',
      click: async () => {
        allowQuit = true;
        syncLoginItem(false);
        await stopBridgeProcess();
        app.quit();
      },
    },
  ]);
}

function createTray() {
  if (process.platform !== 'darwin' || tray) return;
  const icon = nativeImage.createFromPath(trayIconPath);
  const trayImage = icon.isEmpty()
    ? nativeImage.createEmpty()
    : icon.resize({ width: 18, height: 18 });
  trayImage.setTemplateImage?.(true);

  tray = new Tray(trayImage);
  tray.setToolTip('Doubao Bridge');
  tray.setContextMenu(createTrayMenu());
  tray.on('click', () => {
    showMainWindow();
  });
}

async function scheduleUninstallCleanup() {
  await ensureDirs();
  const uninstallScript = path.join(os.tmpdir(), `doubao-bridge-uninstall-${Date.now()}.sh`);
  const appBundlePath = getAppBundlePath();
  const escapedSupportDir = appSupportDir.replaceAll("'", "'\"'\"'");
  const escapedLogsDir = logsDir.replaceAll("'", "'\"'\"'");
  const escapedAppLogFile = appLogFile.replaceAll("'", "'\"'\"'");
  const escapedBridgeLogFile = bridgeLogFile.replaceAll("'", "'\"'\"'");
  const escapedLegacyLaunchAgent = legacyLaunchAgentFile.replaceAll("'", "'\"'\"'");
  const escapedAppBundlePath = appBundlePath.replaceAll("'", "'\"'\"'");
  const shellScript = `#!/bin/zsh
set -euo pipefail

APP_PID="${process.pid}"
APP_PATH='${escapedAppBundlePath}'
SUPPORT_DIR='${escapedSupportDir}'
LOGS_DIR='${escapedLogsDir}'
APP_LOG_FILE='${escapedAppLogFile}'
BRIDGE_LOG_FILE='${escapedBridgeLogFile}'
LEGACY_LAUNCH_AGENT='${escapedLegacyLaunchAgent}'

for _ in {1..120}; do
  if ! kill -0 "$APP_PID" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

launchctl bootout "gui/$(id -u)" "$LEGACY_LAUNCH_AGENT" >/dev/null 2>&1 || true
rm -f "$LEGACY_LAUNCH_AGENT" >/dev/null 2>&1 || true
rm -rf "$SUPPORT_DIR" >/dev/null 2>&1 || true
rm -f "$APP_LOG_FILE" "$BRIDGE_LOG_FILE" >/dev/null 2>&1 || true
rmdir "$LOGS_DIR" >/dev/null 2>&1 || true

open -R "$APP_PATH" >/dev/null 2>&1 || true

rm -f '${uninstallScript.replaceAll("'", "'\"'\"'")}' >/dev/null 2>&1 || true
`;

  await fs.writeFile(uninstallScript, shellScript, 'utf8');
  await fs.chmod(uninstallScript, 0o755);
  const child = spawn('/bin/zsh', [uninstallScript], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

async function handleUninstall() {
  const response = await dialog.showMessageBox(mainWindow ?? null, {
    type: 'warning',
    buttons: ['取消', '卸载'],
    defaultId: 1,
    cancelId: 0,
    title: '卸载 Doubao Bridge',
    message: '这会停止后台同步，并删除本地配置、日志和后台服务。',
    detail:
      '清理完成后会自动在 Finder 中定位 Doubao Bridge.app。最后一步请手动把它拖到废纸篓。',
  });

  if (response.response !== 1) {
    return;
  }

  allowQuit = true;
  syncLoginItem(false);
  await stopBridgeProcess();
  await scheduleUninstallCleanup();
  app.quit();
}

function createMenu() {
  const appMenu = {
    label: 'Doubao Bridge',
    submenu: [
      {
        label: 'Open Doubao Bridge',
        click: () => showMainWindow(),
      },
      {
        label: 'Hide Window',
        accelerator: 'CmdOrCtrl+W',
        click: () => {
          syncWindowPresence(false);
          mainWindow?.hide();
        },
      },
      { type: 'separator' },
      {
        label: 'Open Logs',
        click: () => {
          void shell.openPath(bridgeLogFile);
        },
      },
      {
        label: 'Advanced',
        submenu: [
          {
            label: 'Uninstall Doubao Bridge...',
            click: () => {
              void handleUninstall();
            },
          },
        ],
      },
      { type: 'separator' },
      {
        label: 'Stop Background and Quit',
        click: async () => {
          allowQuit = true;
          syncLoginItem(false);
          await stopBridgeProcess();
          app.quit();
        },
      },
    ],
  };

  const template = process.platform === 'darwin'
    ? [
        appMenu,
        { role: 'editMenu' },
        {
          label: 'Window',
          submenu: [
            {
              label: 'Open Doubao Bridge',
              click: () => showMainWindow(),
            },
            { role: 'minimize' },
            { role: 'close' },
            { type: 'separator' },
            { role: 'front' },
          ],
        },
      ]
    : [appMenu];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 860,
    minWidth: 920,
    minHeight: 760,
    title: 'Doubao Bridge',
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('show', () => {
    syncWindowPresence(true);
  });
  mainWindow.on('hide', () => {
    syncWindowPresence(false);
  });
  mainWindow.on('close', (event) => {
    if (allowQuit) return;
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('bridge-app:get-meta', async () => {
  await ensureDirs();
  return {
    version: appVersion,
    supportDir: appSupportDir,
    logsDir,
    bridgeLogFile,
    appLogFile,
  };
});

ipcMain.handle('bridge-app:open-log-file', async () => {
  await ensureDirs();
  return shell.openPath(bridgeLogFile);
});

ipcMain.handle('bridge-app:open-support-dir', async () => {
  await ensureDirs();
  return shell.openPath(appSupportDir);
});

ipcMain.handle('bridge-app:stop-background-and-quit', async () => {
  allowQuit = true;
  syncLoginItem(false);
  await stopBridgeProcess();
  app.quit();
  return { ok: true };
});

ipcMain.handle('bridge-app:show-window', async () => {
  showMainWindow();
  return { ok: true };
});

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  allowQuit = true;
  app.quit();
}

app.on('second-instance', () => {
  showMainWindow();
});

app.on('before-quit', (event) => {
  if (allowQuit) return;
  event.preventDefault();
  syncWindowPresence(false);
  mainWindow?.hide();
});

app.on('window-all-closed', () => {
  // Keep background service alive on macOS.
});

app.on('activate', () => {
  showMainWindow();
});

app.whenReady().then(async () => {
  applyMacUiMode();
  syncLoginItem(true);
  createMenu();
  createTray();
  try {
    await ensureBridgeProcess();
  } catch (error) {
    await appendLog(appLogFile, `[error] ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!backgroundMode) {
    createWindow();
    syncWindowPresence(true);
  } else {
    syncWindowPresence(false);
  }
  await appendLog(appLogFile, `Doubao Bridge app started (background=${backgroundMode ? 'yes' : 'no'})`);
});
