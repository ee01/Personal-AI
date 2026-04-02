import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
  shell,
} from 'electron';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(
  await fs.readFile(path.join(__dirname, '..', 'package.json'), 'utf8'),
);
const appVersion = packageJson.version || app.getVersion();

const appSupportDir = path.join(app.getPath('appData'), 'PersonalAI', 'DoubaoBridge');
const tempDir = path.join(appSupportDir, 'tmp');
const logsDir = path.join(app.getPath('home'), 'Library', 'Logs', 'PersonalAI');
const appLogFile = path.join(logsDir, 'doubao-bridge-app.log');
const bridgeLogFile = path.join(logsDir, 'doubao-bridge-agent.log');
const bridgePidFile = path.join(appSupportDir, 'bridge-agent.pid');
const uninstallMarkerFile = path.join(appSupportDir, 'uninstall-pending');
const quickAskStateFile = path.join(appSupportDir, 'quick-ask-window.json');
const shortcutHelperSourcePath = path.join(__dirname, 'native', 'shortcut-helper.swift');
const shortcutHelperBinaryPath = path.join(
  __dirname,
  'native',
  'bin',
  'doubao-bridge-shortcut-helper',
);
const speechHelperSourcePath = path.join(__dirname, 'native', 'speech-helper.swift');
const speechHelperBinaryPath = path.join(
  __dirname,
  'native',
  'bin',
  'doubao-bridge-speech-helper',
);
const keyStateHelperSourcePath = path.join(__dirname, 'native', 'key-state-helper.swift');
const keyStateHelperBinaryPath = path.join(
  __dirname,
  'native',
  'bin',
  'doubao-bridge-key-state-helper',
);
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

await fs.mkdir(tempDir, { recursive: true }).catch(() => undefined);
process.env.TMPDIR = tempDir;
process.env.TMP = tempDir;
process.env.TEMP = tempDir;

let mainWindow = null;
let askWindow = null;
let bridgeProcess = null;
let tray = null;
let allowQuit = false;
let shortcutHelperProcess = null;
let shortcutHelperBuffer = '';
let shortcutFallbackRegistered = false;
let speechHelperProcess = null;
let speechHelperBuffer = '';
let pendingShortcutGesture = null;
let askWindowAnchor = null;
let askWindowStateSaveTimer = null;
let voiceLocalePreference = 'zh-CN';
let shortcutStatus = {
  usingNativeHelper: false,
  fallbackEnabled: false,
  permissionGranted: true,
  mainProcessPermissionGranted: true,
  message:
    process.platform === 'darwin'
      ? '短按 Option+A 打开或关闭窗口；按住不放约 320ms 可切换到语音输入。'
      : '当前仅支持短按 Option+A 打开或关闭窗口。',
};

const ASK_WINDOW_WIDTH = 540;
const ASK_WINDOW_COMPACT_HEIGHT = 146;
const ASK_WINDOW_VOICE_HEIGHT = 214;
const ASK_WINDOW_MIN_EXPANDED_HEIGHT = 428;
const ASK_WINDOW_DEFAULT_EXPANDED_HEIGHT = 500;
const ASK_WINDOW_VERTICAL_MARGIN = 64;

function normalizeVoiceLocale(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return 'zh-CN';
  if (normalized === 'auto') return 'auto';
  return normalized;
}

function getVoicePreferences() {
  return {
    voiceLocale: voiceLocalePreference,
  };
}

function setVoiceLocalePreference(value) {
  voiceLocalePreference = normalizeVoiceLocale(value);
  scheduleSaveQuickAskWindowState();
  return getVoicePreferences();
}

function sendToWindow(targetWindow, channel, payload) {
  if (!targetWindow || targetWindow.isDestroyed()) return;

  const dispatch = () => {
    if (!targetWindow.isDestroyed()) {
      targetWindow.webContents.send(channel, payload);
    }
  };

  if (targetWindow.webContents.isLoadingMainFrame()) {
    targetWindow.webContents.once('did-finish-load', dispatch);
    return;
  }

  dispatch();
}

function broadcastShortcutStatus() {
  sendToWindow(mainWindow, 'bridge-app:shortcut-status', shortcutStatus);
  sendToWindow(askWindow, 'quick-ask:shortcut-status', shortcutStatus);
}

function updateShortcutStatus(patch) {
  shortcutStatus = {
    ...shortcutStatus,
    ...patch,
  };
  broadcastShortcutStatus();
}

function getAppBundlePath() {
  return path.dirname(path.dirname(path.dirname(process.execPath)));
}

async function ensureDirs() {
  await fs.mkdir(appSupportDir, { recursive: true });
  await fs.mkdir(tempDir, { recursive: true });
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

async function cancelPendingUninstall() {
  const previousMarker = await fs.readFile(uninstallMarkerFile, 'utf8').catch(() => '');
  if (previousMarker.trim()) {
    await appendLog(appLogFile, '[info] cancelling pending uninstall because app was reopened');
  }
  await fs.rm(uninstallMarkerFile, { force: true }).catch(() => undefined);
}

async function loadQuickAskWindowState() {
  try {
    const raw = await fs.readFile(quickAskStateFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (
      Number.isFinite(parsed?.x) &&
      Number.isFinite(parsed?.y)
    ) {
      askWindowAnchor = {
        x: Number(parsed.x),
        y: Number(parsed.y),
      };
    }
    voiceLocalePreference = normalizeVoiceLocale(parsed?.voiceLocale);
  } catch {
    askWindowAnchor = null;
    voiceLocalePreference = 'zh-CN';
  }
}

async function saveQuickAskWindowState() {
  await fs.writeFile(
    quickAskStateFile,
    JSON.stringify({
      ...(askWindowAnchor || {}),
      voiceLocale: voiceLocalePreference,
    }),
    'utf8',
  ).catch(() => undefined);
}

function scheduleSaveQuickAskWindowState() {
  if (askWindowStateSaveTimer) {
    clearTimeout(askWindowStateSaveTimer);
  }
  askWindowStateSaveTimer = setTimeout(() => {
    askWindowStateSaveTimer = null;
    void saveQuickAskWindowState();
  }, 120);
}

function getBridgeEnv() {
  return {
    ...process.env,
    DOUBAO_BRIDGE_DATA_DIR: path.join(appSupportDir, 'data'),
    DOUBAO_BRIDGE_PROFILE_DIR: path.join(appSupportDir, 'profile'),
    TMPDIR: tempDir,
    TMP: tempDir,
    TEMP: tempDir,
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

function getAskWindowBounds(height = ASK_WINDOW_COMPACT_HEIGHT) {
  const currentDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const workArea = currentDisplay.workArea;
  const width = Math.min(ASK_WINDOW_WIDTH, workArea.width - 32);
  const safeHeight = Math.max(
    ASK_WINDOW_COMPACT_HEIGHT,
    Math.min(height, workArea.height - ASK_WINDOW_VERTICAL_MARGIN),
  );
  const fallbackX = Math.round(workArea.x + (workArea.width - width) / 2);
  const fallbackCompactTop = Math.round(
    workArea.y + Math.max(18, Math.min(28, workArea.height * 0.045)),
  );
  const desiredX = askWindowAnchor?.x ?? fallbackX;
  const desiredCompactTop = askWindowAnchor?.y ?? fallbackCompactTop;
  const x = Math.max(workArea.x + 16, Math.min(desiredX, workArea.x + workArea.width - width - 16));
  const compactTop = Math.max(
    workArea.y + 12,
    Math.min(desiredCompactTop, workArea.y + workArea.height - ASK_WINDOW_COMPACT_HEIGHT - 12),
  );
  const anchoredBottom = compactTop + ASK_WINDOW_COMPACT_HEIGHT;
  const y = Math.max(workArea.y + 14, anchoredBottom - safeHeight);
  return {
    x,
    y,
    width,
    height: safeHeight,
  };
}

function applyAskWindowBounds(height, animate = true) {
  if (!askWindow || askWindow.isDestroyed()) return;
  askWindow.setBounds(getAskWindowBounds(height), animate);
}

function focusAskComposer() {
  sendToWindow(askWindow, 'quick-ask:focus-input');
}

function clearPendingShortcutGesture() {
  if (!pendingShortcutGesture) return;
  clearTimeout(pendingShortcutGesture.timer);
  pendingShortcutGesture = null;
}

function resolvePendingShortcutGesture() {
  if (!pendingShortcutGesture) return;
  const gesture = pendingShortcutGesture;
  clearTimeout(gesture.timer);
  pendingShortcutGesture = null;
  if (gesture.actionOnTap === 'hide') {
    void appendLog(appLogFile, '[info] shortcut gesture resolved as hide-on-tap');
    hideAskWindow();
    return;
  }
  void appendLog(appLogFile, '[info] shortcut gesture resolved as text mode');
  setTimeout(() => {
    focusAskComposer();
  }, 20);
}

async function readShortcutHoldState() {
  if (process.platform !== 'darwin') {
    return { aDown: false, optionDown: false };
  }

  try {
    const helperPath = await ensureKeyStateHelperBinary();
    if (!helperPath) {
      return { aDown: false, optionDown: false };
    }
    const { stdout } = await execFileAsync(helperPath, []);
    const parsed = JSON.parse(stdout);
    return {
      aDown: Boolean(parsed?.aDown),
      optionDown: Boolean(parsed?.optionDown),
    };
  } catch (error) {
    void appendLog(
      appLogFile,
      `[warn] failed to read current shortcut key state: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { aDown: false, optionDown: false };
  }
}

async function triggerPendingShortcutHold() {
  if (!pendingShortcutGesture) return;
  const gesture = pendingShortcutGesture;
  clearTimeout(gesture.timer);
  pendingShortcutGesture = null;

  const keyState = await readShortcutHoldState();
  if (keyState.aDown && keyState.optionDown) {
    await appendLog(appLogFile, '[info] shortcut promoted to voice mode after confirmed A+Option hold');
    sendToWindow(askWindow, 'quick-ask:native-shortcut', { type: 'enter-voice' });
    return;
  }

  await appendLog(
    appLogFile,
    `[info] hold threshold reached but key state did not qualify (aDown=${keyState.aDown ? 'yes' : 'no'}, optionDown=${keyState.optionDown ? 'yes' : 'no'})`,
  );
  pendingShortcutGesture = gesture;
  resolvePendingShortcutGesture();
}

function beginPendingShortcutGesture(actionOnTap = askWindow?.isVisible() ? 'hide' : 'show') {
  clearPendingShortcutGesture();
  if (actionOnTap === 'show') {
    showAskWindow({ focus: true, focusInput: false });
  } else if (askWindow && !askWindow.isDestroyed()) {
    askWindow.focus();
  }
  pendingShortcutGesture = {
    actionOnTap,
    timer: setTimeout(() => {
      void triggerPendingShortcutHold();
    }, 320),
  };
}

function resetAskSession() {
  sendToWindow(askWindow, 'quick-ask:reset-session');
}

function rememberAskWindowAnchor(bounds) {
  if (!bounds) return;
  askWindowAnchor = {
    x: bounds.x,
    y: bounds.y + (bounds.height - ASK_WINDOW_COMPACT_HEIGHT),
  };
  scheduleSaveQuickAskWindowState();
}

function createAskWindow() {
  if (askWindow && !askWindow.isDestroyed()) return askWindow;

  askWindow = new BrowserWindow({
    ...getAskWindowBounds(),
    show: false,
    frame: false,
    transparent: true,
    roundedCorners: true,
    hasShadow: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    title: 'Personal AI Quick Ask',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  askWindow.setAlwaysOnTop(true, 'floating');
  askWindow.loadFile(path.join(__dirname, 'quick-ask.html'));
  askWindow.webContents.once('did-finish-load', () => {
    broadcastShortcutStatus();
  });
  askWindow.webContents.on('before-input-event', (_event, input) => {
    if (!pendingShortcutGesture || input.type !== 'keyUp') return;
    const key = typeof input.key === 'string' ? input.key.toLowerCase() : '';
    const code = typeof input.code === 'string' ? input.code : '';
    if (
      key === 'a' ||
      key === 'alt' ||
      code === 'KeyA' ||
      code === 'AltLeft' ||
      code === 'AltRight'
    ) {
      resolvePendingShortcutGesture();
    }
  });
  askWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  askWindow.on('will-move', (_event, newBounds) => {
    rememberAskWindowAnchor(newBounds);
  });

  askWindow.on('hide', () => {
    clearPendingShortcutGesture();
    applyAskWindowBounds(ASK_WINDOW_COMPACT_HEIGHT, false);
    void shutdownSpeechHelper();
    sendToWindow(askWindow, 'quick-ask:prepare-hide');
  });

  askWindow.on('closed', () => {
    clearPendingShortcutGesture();
    void shutdownSpeechHelper();
    askWindow = null;
  });

  return askWindow;
}

function showAskWindow({ focus = true, focusInput = true } = {}) {
  const window = createAskWindow();
  applyAskWindowBounds(window.isVisible() ? window.getBounds().height : ASK_WINDOW_COMPACT_HEIGHT, false);
  window.show();
  if (focus) {
    window.focus();
    if (focusInput) {
      setTimeout(() => {
        focusAskComposer();
      }, 30);
    }
  }
}

function hideAskWindow() {
  if (!askWindow || askWindow.isDestroyed()) return;
  clearPendingShortcutGesture();
  askWindow.hide();
}

function toggleAskWindow() {
  if (askWindow?.isVisible()) {
    hideAskWindow();
    return;
  }
  showAskWindow();
}

async function ensureShortcutHelperBinary() {
  if (process.platform !== 'darwin') return null;

  if (app.isPackaged) {
    return shortcutHelperBinaryPath;
  }

  const sourceStat = await fs.stat(shortcutHelperSourcePath).catch(() => null);
  if (!sourceStat) return null;

  const binaryStat = await fs.stat(shortcutHelperBinaryPath).catch(() => null);
  if (binaryStat && binaryStat.mtimeMs >= sourceStat.mtimeMs) {
    return shortcutHelperBinaryPath;
  }

  await fs.mkdir(path.dirname(shortcutHelperBinaryPath), { recursive: true });
  await execFileAsync('/usr/bin/xcrun', [
    'swiftc',
    '-O',
    '-framework',
    'Carbon',
    shortcutHelperSourcePath,
    '-o',
    shortcutHelperBinaryPath,
  ]);
  await fs.chmod(shortcutHelperBinaryPath, 0o755);
  return shortcutHelperBinaryPath;
}

async function ensureSpeechHelperBinary() {
  if (process.platform !== 'darwin') return null;

  if (app.isPackaged) {
    return speechHelperBinaryPath;
  }

  const sourceStat = await fs.stat(speechHelperSourcePath).catch(() => null);
  if (!sourceStat) return null;

  const binaryStat = await fs.stat(speechHelperBinaryPath).catch(() => null);
  if (binaryStat && binaryStat.mtimeMs >= sourceStat.mtimeMs) {
    return speechHelperBinaryPath;
  }

  await fs.mkdir(path.dirname(speechHelperBinaryPath), { recursive: true });
  await execFileAsync('/usr/bin/xcrun', [
    'swiftc',
    '-O',
    '-framework',
    'Speech',
    '-framework',
    'AVFoundation',
    speechHelperSourcePath,
    '-o',
    speechHelperBinaryPath,
  ]);
  await fs.chmod(speechHelperBinaryPath, 0o755);
  return speechHelperBinaryPath;
}

async function ensureKeyStateHelperBinary() {
  if (process.platform !== 'darwin') return null;

  if (app.isPackaged) {
    return keyStateHelperBinaryPath;
  }

  const sourceStat = await fs.stat(keyStateHelperSourcePath).catch(() => null);
  if (!sourceStat) return null;

  const binaryStat = await fs.stat(keyStateHelperBinaryPath).catch(() => null);
  if (binaryStat && binaryStat.mtimeMs >= sourceStat.mtimeMs) {
    return keyStateHelperBinaryPath;
  }

  await fs.mkdir(path.dirname(keyStateHelperBinaryPath), { recursive: true });
  await execFileAsync('/usr/bin/xcrun', [
    'swiftc',
    '-O',
    '-framework',
    'ApplicationServices',
    keyStateHelperSourcePath,
    '-o',
    keyStateHelperBinaryPath,
  ]);
  await fs.chmod(keyStateHelperBinaryPath, 0o755);
  return keyStateHelperBinaryPath;
}

function handleShortcutTap() {
  void appendLog(appLogFile, '[info] shortcut tap detected');
  beginPendingShortcutGesture(askWindow?.isVisible() ? 'hide' : 'show');
}

async function registerFallbackShortcut(message) {
  if (shortcutFallbackRegistered) return;

  const registered = globalShortcut.register('Alt+A', () => {
    handleShortcutTap();
  });

  if (!registered) {
    await appendLog(appLogFile, '[warn] failed to register fallback shortcut Alt+A');
    updateShortcutStatus({
      usingNativeHelper: false,
      fallbackEnabled: false,
      message: message || 'Option+A 快捷键注册失败。',
    });
    return;
  }

  shortcutFallbackRegistered = true;
  await appendLog(appLogFile, '[info] registered Electron globalShortcut Alt+A');
  updateShortcutStatus({
    usingNativeHelper: false,
    fallbackEnabled: false,
    permissionGranted: true,
    mainProcessPermissionGranted: true,
    message:
      message ||
      '短按 Option+A 打开或关闭窗口；按住不放约 320ms 可切换到语音输入。',
  });
}

async function stopShortcutHelper() {
  if (!shortcutHelperProcess) return;
  shortcutHelperProcess.removeAllListeners();
  shortcutHelperProcess.stdout?.removeAllListeners();
  shortcutHelperProcess.stderr?.removeAllListeners();
  shortcutHelperProcess.kill('SIGTERM');
  shortcutHelperProcess = null;
  shortcutHelperBuffer = '';
}

function sendVoiceEvent(payload) {
  sendToWindow(askWindow, 'quick-ask:voice-event', payload);
}

function handleSpeechHelperPayload(payload) {
  if (!payload || typeof payload !== 'object') return;

  if (payload.type === 'error') {
    void appendLog(
      appLogFile,
      `[voice-helper:error] ${payload.code || 'unknown'} ${payload.message || 'unknown error'}`,
    );
  } else if (payload.type === 'ready') {
    void appendLog(
      appLogFile,
      `[voice-helper:ready] microphone=${payload.microphoneStatus || 'unknown'} speech=${payload.speechStatus || 'unknown'}`,
    );
  }

  sendVoiceEvent(payload);
}

function sendSpeechHelperCommand(command) {
  if (!speechHelperProcess || speechHelperProcess.killed || !speechHelperProcess.stdin?.writable) {
    throw new Error('Speech helper is not running');
  }
  speechHelperProcess.stdin.write(`${JSON.stringify(command)}\n`);
}

async function ensureSpeechHelperProcess() {
  if (process.platform !== 'darwin') {
    throw new Error('Native voice input is only supported on macOS');
  }

  if (speechHelperProcess && !speechHelperProcess.killed) {
    return speechHelperProcess;
  }

  const helperPath = await ensureSpeechHelperBinary();
  if (!helperPath) {
    throw new Error('Speech helper binary is missing');
  }

  speechHelperProcess = spawn(helperPath, [], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  speechHelperBuffer = '';

  speechHelperProcess.stdout?.on('data', (chunk) => {
    speechHelperBuffer += String(chunk);
    let newlineIndex = speechHelperBuffer.indexOf('\n');
    while (newlineIndex >= 0) {
      const line = speechHelperBuffer.slice(0, newlineIndex).trim();
      speechHelperBuffer = speechHelperBuffer.slice(newlineIndex + 1);
      if (line) {
        try {
          handleSpeechHelperPayload(JSON.parse(line));
        } catch (error) {
          void appendLog(
            appLogFile,
            `[warn] failed to parse speech helper payload: ${line} (${error instanceof Error ? error.message : String(error)})`,
          );
        }
      }
      newlineIndex = speechHelperBuffer.indexOf('\n');
    }
  });

  speechHelperProcess.stderr?.on('data', (chunk) => {
    void appendLog(appLogFile, `[speech-helper] ${String(chunk).trim()}`);
  });

  speechHelperProcess.on('exit', (code, signal) => {
    void appendLog(
      appLogFile,
      `[speech-helper:exit] code=${code ?? 'null'} signal=${signal ?? 'null'}`,
    );
    speechHelperProcess = null;
    speechHelperBuffer = '';
  });

  return speechHelperProcess;
}

async function startSpeechSession(locale) {
  await ensureSpeechHelperProcess();
  sendSpeechHelperCommand({
    command: 'start',
    locale: typeof locale === 'string' && locale.trim() ? locale.trim() : undefined,
  });
}

async function stopSpeechSession() {
  if (!speechHelperProcess || speechHelperProcess.killed) return;
  sendSpeechHelperCommand({ command: 'stop' });
}

async function cancelSpeechSession() {
  if (!speechHelperProcess || speechHelperProcess.killed) return;
  sendSpeechHelperCommand({ command: 'cancel' });
}

async function shutdownSpeechHelper() {
  if (!speechHelperProcess) return;
  const processToStop = speechHelperProcess;
  speechHelperProcess = null;
  speechHelperBuffer = '';

  if (processToStop.stdin?.writable) {
    try {
      processToStop.stdin.write(`${JSON.stringify({ command: 'shutdown' })}\n`);
    } catch {
      // Ignore and force kill below.
    }
  }

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      processToStop.kill('SIGTERM');
      resolve();
    }, 300);
    processToStop.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function handleShortcutHelperPayload(payload) {
  void appendLog(
    appLogFile,
    `[info] shortcut helper payload ignored in current mode: ${JSON.stringify(payload)}`,
  );
}

async function startShortcutHelper() {
  globalShortcut.unregisterAll();
  shortcutFallbackRegistered = false;
  await stopShortcutHelper();
  await registerFallbackShortcut(
    process.platform === 'darwin'
      ? '短按 Option+A 打开或关闭窗口；按住不放约 320ms 可切换到语音输入。'
      : '当前仅支持短按 Option+A 打开或关闭窗口。',
  );
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
      label: 'Open Quick Ask',
      click: () => showAskWindow(),
    },
    {
      label: 'Open Personal AI Settings',
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
      label: 'Uninstall Personal AI...',
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
  tray.setToolTip('Personal AI');
  const trayMenu = createTrayMenu();
  tray.on('click', () => {
    toggleAskWindow();
  });
  tray.on('right-click', () => {
    tray.popUpContextMenu(trayMenu);
  });
}

async function scheduleUninstallCleanup() {
  await ensureDirs();
  const uninstallScript = path.join(os.tmpdir(), `doubao-bridge-uninstall-${Date.now()}.sh`);
  const uninstallToken = `uninstall-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const appBundlePath = getAppBundlePath();
  const escapedSupportDir = appSupportDir.replaceAll("'", "'\"'\"'");
  const escapedLogsDir = logsDir.replaceAll("'", "'\"'\"'");
  const escapedAppLogFile = appLogFile.replaceAll("'", "'\"'\"'");
  const escapedBridgeLogFile = bridgeLogFile.replaceAll("'", "'\"'\"'");
  const escapedUninstallMarkerFile = uninstallMarkerFile.replaceAll("'", "'\"'\"'");
  const escapedLegacyLaunchAgent = legacyLaunchAgentFile.replaceAll("'", "'\"'\"'");
  const escapedAppBundlePath = appBundlePath.replaceAll("'", "'\"'\"'");
  await fs.writeFile(uninstallMarkerFile, uninstallToken, 'utf8');
  const shellScript = `#!/bin/zsh
set -euo pipefail

APP_PID="${process.pid}"
UNINSTALL_TOKEN='${uninstallToken.replaceAll("'", "'\"'\"'")}'
APP_PATH='${escapedAppBundlePath}'
SUPPORT_DIR='${escapedSupportDir}'
LOGS_DIR='${escapedLogsDir}'
APP_LOG_FILE='${escapedAppLogFile}'
BRIDGE_LOG_FILE='${escapedBridgeLogFile}'
UNINSTALL_MARKER='${escapedUninstallMarkerFile}'
LEGACY_LAUNCH_AGENT='${escapedLegacyLaunchAgent}'

for _ in {1..120}; do
  if ! kill -0 "$APP_PID" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if [ "$(cat "$UNINSTALL_MARKER" 2>/dev/null || true)" != "$UNINSTALL_TOKEN" ]; then
  rm -f '${uninstallScript.replaceAll("'", "'\"'\"'")}' >/dev/null 2>&1 || true
  exit 0
fi

launchctl bootout "gui/$(id -u)" "$LEGACY_LAUNCH_AGENT" >/dev/null 2>&1 || true
rm -f "$LEGACY_LAUNCH_AGENT" >/dev/null 2>&1 || true
rm -rf "$SUPPORT_DIR" >/dev/null 2>&1 || true
rm -f "$APP_LOG_FILE" "$BRIDGE_LOG_FILE" >/dev/null 2>&1 || true
rmdir "$LOGS_DIR" >/dev/null 2>&1 || true

/usr/bin/osascript -e 'on run argv' -e 'tell application "Finder" to delete POSIX file (item 1 of argv)' -e 'end run' "$APP_PATH" >/dev/null 2>&1 || true
if [ -e "$APP_PATH" ]; then
  open -R "$APP_PATH" >/dev/null 2>&1 || true
fi

rm -f "$UNINSTALL_MARKER" >/dev/null 2>&1 || true
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
    title: '卸载 Personal AI',
    message: '这会停止后台同步，并删除本地配置、日志和后台服务。',
    detail:
      '清理完成后会尝试把 Personal AI.app 移到废纸篓；如果失败，会在 Finder 中定位它供你手动删除。若在卸载完成前重新打开 app，这次卸载会自动取消。',
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

async function openSystemSettingsPane(fragment) {
  if (process.platform !== 'darwin') {
    return { ok: false, reason: 'unsupported_platform' };
  }

  const url = `x-apple.systempreferences:com.apple.preference.security?${fragment}`;
  try {
    await shell.openExternal(url);
    return { ok: true };
  } catch {
    const result = await execFileAsync('/usr/bin/open', [url]).catch(() => null);
    return { ok: Boolean(result) };
  }
}

function createMenu() {
  const appMenu = {
    label: 'Personal AI',
    submenu: [
      {
        label: 'Open Quick Ask',
        accelerator: 'Alt+A',
        click: () => showAskWindow(),
      },
      {
        label: 'Open Personal AI Settings',
        accelerator: 'CmdOrCtrl+,',
        click: () => showMainWindow(),
      },
      {
        label: 'Hide Window',
        accelerator: 'CmdOrCtrl+W',
        click: () => {
          if (askWindow?.isFocused()) {
            hideAskWindow();
            return;
          }
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
            label: 'Uninstall Personal AI...',
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
              label: 'Open Quick Ask',
              click: () => showAskWindow(),
            },
            {
              label: 'Open Personal AI Settings',
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
    title: 'Personal AI',
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.once('did-finish-load', () => {
    broadcastShortcutStatus();
  });
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
    shortcutStatus,
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

ipcMain.handle('bridge-app:open-external', async (_event, url) => {
  if (typeof url === 'string' && url.trim()) {
    await shell.openExternal(url);
  }
  return { ok: true };
});

ipcMain.handle('bridge-app:open-accessibility-settings', async () => {
  return openSystemSettingsPane('Privacy_Accessibility');
});

ipcMain.handle('bridge-app:open-input-monitoring-settings', async () => {
  return openSystemSettingsPane('Privacy_ListenEvent');
});

ipcMain.handle('bridge-app:open-microphone-settings', async () => {
  return openSystemSettingsPane('Privacy_Microphone');
});

ipcMain.handle('bridge-app:refresh-shortcut-helper', async () => {
  await stopShortcutHelper();
  await startShortcutHelper();
  return { ok: true, shortcutStatus };
});

ipcMain.handle('bridge-app:get-voice-preferences', async () => {
  return getVoicePreferences();
});

ipcMain.handle('bridge-app:set-voice-preferences', async (_event, payload) => {
  return setVoiceLocalePreference(payload?.voiceLocale);
});

ipcMain.handle('quick-ask:hide', async () => {
  hideAskWindow();
  return { ok: true };
});

ipcMain.handle('quick-ask:open-settings', async () => {
  hideAskWindow();
  showMainWindow();
  return { ok: true };
});

ipcMain.handle('quick-ask:open-full-bridge', async () => {
  hideAskWindow();
  showMainWindow();
  return { ok: true };
});

ipcMain.handle('quick-ask:new-session', async () => {
  if (askWindow && !askWindow.isDestroyed()) {
    applyAskWindowBounds(ASK_WINDOW_COMPACT_HEIGHT);
    resetAskSession();
    focusAskComposer();
  }
  return { ok: true };
});

ipcMain.handle('quick-ask:get-preferences', async () => {
  return getVoicePreferences();
});

ipcMain.handle('quick-ask:voice-start', async (_event, payload) => {
  await startSpeechSession(payload?.locale);
  return { ok: true };
});

ipcMain.handle('quick-ask:voice-stop', async () => {
  await stopSpeechSession();
  return { ok: true };
});

ipcMain.handle('quick-ask:voice-cancel', async () => {
  await cancelSpeechSession();
  return { ok: true };
});

ipcMain.handle('quick-ask:resolve-shortcut-gesture', async () => {
  resolvePendingShortcutGesture();
  return { ok: true };
});

ipcMain.handle('quick-ask:log', async (_event, payload) => {
  const level =
    typeof payload?.level === 'string' && payload.level.trim() ? payload.level.trim() : 'info';
  const message =
    typeof payload?.message === 'string' && payload.message.trim()
      ? payload.message.trim()
      : 'unknown quick ask event';
  await appendLog(appLogFile, `[quick-ask:${level}] ${message}`);
  return { ok: true };
});

ipcMain.handle('quick-ask:set-layout', async (_event, payload) => {
  if (!askWindow || askWindow.isDestroyed()) return { ok: false };

  const mode =
    typeof payload?.mode === 'string' && payload.mode
      ? payload.mode
      : 'compact';
  const requestedHeight = Number(payload?.height);
  const maxHeight =
    screen.getDisplayMatching(askWindow.getBounds()).workArea.height - ASK_WINDOW_VERTICAL_MARGIN;
  const compactLikeMode = mode === 'compact' || mode === 'idle-compact';
  const voiceMode = mode === 'voice-listening' || mode === 'voice-ready';
  const nextHeight =
    compactLikeMode
      ? Math.max(
          ASK_WINDOW_COMPACT_HEIGHT,
          Math.min(
            Number.isFinite(requestedHeight) ? requestedHeight : ASK_WINDOW_COMPACT_HEIGHT,
            maxHeight,
          ),
        )
      : voiceMode
        ? Math.max(
            ASK_WINDOW_VOICE_HEIGHT,
            Math.min(Number.isFinite(requestedHeight) ? requestedHeight : ASK_WINDOW_VOICE_HEIGHT, maxHeight),
          )
        : Math.max(
          ASK_WINDOW_MIN_EXPANDED_HEIGHT,
          Math.min(
            Number.isFinite(requestedHeight) ? requestedHeight : ASK_WINDOW_DEFAULT_EXPANDED_HEIGHT,
            maxHeight,
          ),
        );

  applyAskWindowBounds(nextHeight);
  return { ok: true, height: nextHeight };
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
  hideAskWindow();
  mainWindow?.hide();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  void stopShortcutHelper();
  void shutdownSpeechHelper();
});

app.on('window-all-closed', () => {
  // Keep background service alive on macOS.
});

app.on('activate', () => {
  showMainWindow();
});

app.whenReady().then(async () => {
  await ensureDirs();
  await loadQuickAskWindowState();
  await cancelPendingUninstall();
  applyMacUiMode();
  syncLoginItem(true);
  createMenu();
  createTray();
  await startShortcutHelper();
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
  await appendLog(appLogFile, `Personal AI app started (background=${backgroundMode ? 'yes' : 'no'})`);
});
