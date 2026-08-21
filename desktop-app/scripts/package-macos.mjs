import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { packager } from '@electron/packager';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopAppRoot = path.resolve(__dirname, '..');
const releaseDir = path.resolve(
  process.env.DESKTOP_APP_RELEASE_DIR ||
    process.env.DOUBAO_BRIDGE_RELEASE_DIR ||
    path.join(desktopAppRoot, 'release'),
);
const builderOutputDir = path.join(releaseDir, 'electron-builder');
const packagerSourceDir = path.join(releaseDir, 'packager-source');
const pkgStageRoot = path.join(releaseDir, 'pkg-root');
const pkgScriptsRoot = path.join(releaseDir, 'pkg-scripts');
const pkgComponentPlistPath = path.join(releaseDir, 'pkg-component.plist');
const macIconsetDir = path.join(releaseDir, 'DesktopApp.iconset');
const macIcnsPath = path.join(releaseDir, 'DesktopApp.icns');
const productName = 'Personal AI';
const appBundleName = `${productName}.app`;
const appBundleReleaseCopy = path.join(releaseDir, appBundleName);
const assetsDir = path.join(desktopAppRoot, 'assets');
const appIconSourcePng = path.join(assetsDir, 'app-icon.png');
const localPlaywrightBrowsersDir = path.join(
  desktopAppRoot,
  'node_modules',
  'playwright-core',
  '.local-browsers',
);
const vendoredPlaywrightBrowsersDir = path.join(
  releaseDir,
  'playwright-browsers',
);

function installerName(version) {
  return `Personal-AI-Desktop-${version}-Installer.pkg`;
}

async function run(command, args, options = {}) {
  return execFileAsync(command, args, {
    cwd: desktopAppRoot,
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      PATH: `${path.dirname(process.execPath)}:${process.env.PATH || ''}`,
      COPYFILE_DISABLE: '1',
    },
    ...options,
  });
}

function getApplicationSigningIdentity() {
  return (
    process.env.APPLE_APPLICATION_SIGNING_IDENTITY ||
    process.env.APPLE_APP_SIGNING_IDENTITY ||
    process.env.CSC_NAME ||
    undefined
  );
}

async function readPackageJson() {
  return JSON.parse(
    await fs.readFile(path.join(desktopAppRoot, 'package.json'), 'utf8'),
  );
}

async function resetDir(dir) {
  await fs.rm(dir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
  await fs.mkdir(dir, { recursive: true });
}

async function copy(src, dest) {
  const sourceStat = await fs.lstat(src);
  if (sourceStat.isDirectory()) {
    await run('/usr/bin/ditto', [src, dest]);
    return;
  }
  if (sourceStat.isSymbolicLink()) {
    const linkTarget = await fs.readlink(src);
    await fs.symlink(linkTarget, dest);
    return;
  }
  await fs.copyFile(src, dest);
}

async function writeExecutable(filePath, contents) {
  await fs.writeFile(filePath, contents, 'utf8');
  await fs.chmod(filePath, 0o755);
}

async function ensurePackagingTools() {
  try {
    await run('/usr/bin/xcrun', ['--find', 'pkgbuild']);
    await run('/usr/bin/xcrun', ['--find', 'iconutil']);
    await fs.access('/usr/bin/sips');
  } catch {
    throw new Error(
      'pkgbuild, iconutil and sips are required to create the macOS installer package.',
    );
  }
}

function resolvePlaywrightCacheDir() {
  const envPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (envPath && envPath !== '0') {
    return path.resolve(envPath);
  }
  return path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
}

// The Playwright cache is shared across every project on the build machine, so
// it usually holds several Chromium revisions. Only the revisions pinned by this
// app's playwright-core may be vendored, otherwise the installer grows by
// ~650MB per stale revision.
async function resolveRequiredPlaywrightBrowserDirNames() {
  const browsersJsonPath = path.join(
    desktopAppRoot,
    'node_modules',
    'playwright-core',
    'browsers.json',
  );
  const { browsers } = JSON.parse(await fs.readFile(browsersJsonPath, 'utf8'));
  const vendoredBrowserNames = new Set(['chromium', 'ffmpeg']);
  const dirNames = new Set();

  for (const browser of browsers) {
    if (!vendoredBrowserNames.has(browser.name)) {
      continue;
    }
    const revisions = [
      browser.revision,
      ...Object.values(browser.revisionOverrides || {}),
    ];
    for (const revision of revisions) {
      dirNames.add(`${browser.name.replaceAll('-', '_')}-${revision}`);
    }
  }

  if (dirNames.size === 0) {
    throw new Error(
      `Could not determine required Playwright browser revisions from ${browsersJsonPath}.`,
    );
  }
  return dirNames;
}

async function ensureLocalPlaywrightBrowsers() {
  const playwrightCliPath = path.join(
    desktopAppRoot,
    'node_modules',
    'playwright',
    'cli.js',
  );
  const playwrightCacheDir = resolvePlaywrightCacheDir();
  await fs.access(playwrightCliPath);
  await fs.rm(localPlaywrightBrowsersDir, { recursive: true, force: true });
  await fs.rm(vendoredPlaywrightBrowsersDir, { recursive: true, force: true });

  console.log(
    'Ensuring Playwright Chromium is installed on the build machine...',
  );
  await run(process.execPath, [playwrightCliPath, 'install', 'chromium'], {
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: playwrightCacheDir,
    },
  });

  await fs.mkdir(vendoredPlaywrightBrowsersDir, { recursive: true });
  const requiredDirNames = await resolveRequiredPlaywrightBrowserDirNames();
  const browserEntries = await fs.readdir(playwrightCacheDir, {
    withFileTypes: true,
  });
  let vendoredChromium = false;

  for (const entry of browserEntries) {
    if (!requiredDirNames.has(entry.name)) {
      continue;
    }
    await copy(
      path.join(playwrightCacheDir, entry.name),
      path.join(vendoredPlaywrightBrowsersDir, entry.name),
    );
    if (entry.name.startsWith('chromium-')) {
      vendoredChromium = true;
    }
  }

  if (!vendoredChromium) {
    throw new Error(
      `No pinned Playwright Chromium build found in ${playwrightCacheDir}. Expected one of: ${[...requiredDirNames].join(', ')}.`,
    );
  }
  console.log(
    `Vendoring Playwright browsers: ${[...requiredDirNames].join(', ')}`,
  );
}

async function preparePackagerSource() {
  await resetDir(packagerSourceDir);
  await copy(
    path.join(desktopAppRoot, 'app'),
    path.join(packagerSourceDir, 'app'),
  );
  await copy(
    path.join(desktopAppRoot, 'assets'),
    path.join(packagerSourceDir, 'assets'),
  );
  await copy(
    path.join(desktopAppRoot, 'dist'),
    path.join(packagerSourceDir, 'dist'),
  );
  await copy(
    path.join(desktopAppRoot, 'node_modules'),
    path.join(packagerSourceDir, 'node_modules'),
  );
  await fs.copyFile(
    path.join(desktopAppRoot, 'package.json'),
    path.join(packagerSourceDir, 'package.json'),
  );
  await fs.copyFile(
    path.join(desktopAppRoot, 'package-lock.json'),
    path.join(packagerSourceDir, 'package-lock.json'),
  );
}

async function buildMacAppIcon() {
  await fs.access(appIconSourcePng);
  await resetDir(macIconsetDir);

  const baseSizes = [16, 32, 128, 256, 512];
  for (const size of baseSizes) {
    const normalPath = path.join(macIconsetDir, `icon_${size}x${size}.png`);
    const retinaPath = path.join(macIconsetDir, `icon_${size}x${size}@2x.png`);
    await run('/usr/bin/sips', [
      '-z',
      String(size),
      String(size),
      appIconSourcePng,
      '--out',
      normalPath,
    ]);
    await run('/usr/bin/sips', [
      '-z',
      String(size * 2),
      String(size * 2),
      appIconSourcePng,
      '--out',
      retinaPath,
    ]);
  }

  await fs.rm(macIcnsPath, { force: true });
  await run('/usr/bin/iconutil', [
    '-c',
    'icns',
    macIconsetDir,
    '-o',
    macIcnsPath,
  ]);
  return macIcnsPath;
}

async function buildElectronApp(version) {
  await ensureLocalPlaywrightBrowsers();
  await preparePackagerSource();
  const targetArch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const applicationSigningIdentity = getApplicationSigningIdentity();
  const appPaths = await packager({
    dir: packagerSourceDir,
    out: builderOutputDir,
    overwrite: true,
    platform: 'darwin',
    arch: targetArch,
    name: productName,
    executableName: productName,
    appBundleId: 'com.personalai.desktop',
    appCategoryType: 'public.app-category.productivity',
    appVersion: version,
    asar: false,
    prune: true,
    junk: true,
    ignore: [/^\/?node_modules\/playwright-core\/\.local-browsers($|\/)/],
    ...(applicationSigningIdentity
      ? {
          osxSign: {
            identity: applicationSigningIdentity,
          },
        }
      : {}),
  });
  const appPath = appPaths[0];
  if (!appPath) {
    throw new Error(
      'Electron packager did not return a macOS app bundle path.',
    );
  }
  if (appPath.endsWith('.app')) {
    return appPath;
  }

  const nestedAppPath = path.join(appPath, appBundleName);
  await fs.access(nestedAppPath);
  return nestedAppPath;
}

async function injectVendoredPlaywrightBrowsers(appBundlePath) {
  const resourcesDir = path.join(appBundlePath, 'Contents', 'Resources');
  const bundledBrowsersDir = path.join(resourcesDir, 'playwright-browsers');
  await fs.access(vendoredPlaywrightBrowsersDir);
  await fs.rm(bundledBrowsersDir, { recursive: true, force: true });
  await copy(vendoredPlaywrightBrowsersDir, bundledBrowsersDir);
}

async function injectAppIcon(appBundlePath, iconPath) {
  const resourcesDir = path.join(appBundlePath, 'Contents', 'Resources');
  await fs.copyFile(iconPath, path.join(resourcesDir, 'electron.icns'));
}

async function injectMacUsageDescriptions(appBundlePath) {
  const plistPath = path.join(appBundlePath, 'Contents', 'Info.plist');
  let plist = await fs.readFile(plistPath, 'utf8');
  const entries = [
    [
      'NSMicrophoneUsageDescription',
      'Personal AI needs microphone access for voice input in Quick Ask.',
    ],
    [
      'NSSpeechRecognitionUsageDescription',
      'Personal AI needs speech recognition access to transcribe voice input in Quick Ask.',
    ],
  ];

  for (const [key, value] of entries) {
    if (plist.includes(`<key>${key}</key>`)) {
      continue;
    }
    plist = plist.replace(
      '</dict>',
      `\t<key>${key}</key>\n\t<string>${value}</string>\n</dict>`,
    );
  }

  await fs.writeFile(plistPath, plist, 'utf8');
}

function makePkgPostinstallScript() {
  return `#!/bin/zsh
set -euo pipefail

APP_PATH="/Applications/${appBundleName}"

pkill -f '/Contents/MacOS/${productName}' >/dev/null 2>&1 || true
sleep 1

if [ -d "$APP_PATH" ]; then
  xattr -dr com.apple.quarantine "$APP_PATH" >/dev/null 2>&1 || true
  open -gj "$APP_PATH" --args --background >/dev/null 2>&1 || true
fi

exit 0
`;
}

async function writeNonRelocatableComponentPlist(rootPath) {
  await fs.rm(pkgComponentPlistPath, { force: true });
  await run('/usr/bin/pkgbuild', [
    '--analyze',
    '--root',
    rootPath,
    pkgComponentPlistPath,
  ]);
  const plist = await fs.readFile(pkgComponentPlistPath, 'utf8');
  const updated = plist.replaceAll(
    /<key>BundleIsRelocatable<\/key>\s*<true\/>/g,
    '<key>BundleIsRelocatable</key>\n\t\t<false/>',
  );
  await fs.writeFile(pkgComponentPlistPath, updated, 'utf8');
}

async function buildInstallerPkg(version) {
  const pkgOutputPath = path.join(releaseDir, installerName(version));
  await fs.rm(pkgOutputPath, { force: true });
  await writeNonRelocatableComponentPlist(pkgStageRoot);

  const args = [
    '--root',
    pkgStageRoot,
    '--component-plist',
    pkgComponentPlistPath,
    '--identifier',
    'com.personalai.desktop',
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

  const notaryProfile =
    process.env.APPLE_NOTARY_KEYCHAIN_PROFILE ||
    process.env.APPLE_NOTARY_PROFILE;
  if (signingIdentity && notaryProfile) {
    await run('/usr/bin/xcrun', [
      'notarytool',
      'submit',
      pkgOutputPath,
      '--keychain-profile',
      notaryProfile,
      '--wait',
    ]);
    await run('/usr/bin/xcrun', ['stapler', 'staple', pkgOutputPath]);
  }

  return pkgOutputPath;
}

async function main() {
  const packageJson = await readPackageJson();
  const version = packageJson.version || '0.0.0';
  const distDir = path.join(desktopAppRoot, 'dist');
  await fs.access(distDir);
  await ensurePackagingTools();
  await resetDir(releaseDir);
  await resetDir(pkgStageRoot);
  await resetDir(pkgScriptsRoot);

  const appIconPath = await buildMacAppIcon();
  const appBundleSource = await buildElectronApp(version);
  await injectAppIcon(appBundleSource, appIconPath);
  await injectMacUsageDescriptions(appBundleSource);
  await injectVendoredPlaywrightBrowsers(appBundleSource);
  await fs.rm(appBundleReleaseCopy, { recursive: true, force: true });
  await copy(appBundleSource, appBundleReleaseCopy);
  await fs.access(appBundleReleaseCopy);

  await fs.mkdir(path.join(pkgStageRoot, 'Applications'), { recursive: true });
  await copy(
    appBundleSource,
    path.join(pkgStageRoot, 'Applications', appBundleName),
  );
  await writeExecutable(
    path.join(pkgScriptsRoot, 'postinstall'),
    makePkgPostinstallScript(),
  );

  const pkgOutputPath = await buildInstallerPkg(version);
  await fs.access(pkgOutputPath);

  const { packWorkerRelease } = await import('./pack-worker.mjs');
  const worker = await packWorkerRelease();

  console.log(`Created app bundle at: ${appBundleReleaseCopy}`);
  console.log(`Created macOS installer package at: ${pkgOutputPath}`);
  console.log(`Created worker tarball at: ${worker.tgzPath}`);
  if (
    process.env.APPLE_APPLICATION_SIGNING_IDENTITY ||
    process.env.APPLE_APP_SIGNING_IDENTITY ||
    process.env.CSC_NAME
  ) {
    console.log('Application bundle signing was enabled for the Electron app.');
  } else {
    console.log(
      'Application bundle signing was skipped. Configure APPLE_APPLICATION_SIGNING_IDENTITY for a fully signed release.',
    );
  }
  if (process.env.APPLE_INSTALLER_SIGNING_IDENTITY) {
    if (
      process.env.APPLE_NOTARY_KEYCHAIN_PROFILE ||
      process.env.APPLE_NOTARY_PROFILE
    ) {
      console.log('Installer package was signed and notarized.');
    } else {
      console.log(
        'Installer package was signed but not notarized (missing APPLE_NOTARY_KEYCHAIN_PROFILE/APPLE_NOTARY_PROFILE).',
      );
    }
  } else {
    console.log(
      'Installer package was built unsigned. Configure APPLE_INSTALLER_SIGNING_IDENTITY for a Gatekeeper-friendly release.',
    );
  }
}

main().catch((error) => {
  console.error('Failed to package Personal AI desktop app installer:', error);
  process.exit(1);
});
