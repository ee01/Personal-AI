import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopAppRoot = path.resolve(__dirname, '..');
const localEnvPath = path.join(desktopAppRoot, '.env');

async function run(command, args, options = {}) {
  return execFileAsync(command, args, {
    cwd: desktopAppRoot,
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
}

async function tryRun(command, args, options = {}) {
  try {
    return await run(command, args, options);
  } catch {
    return null;
  }
}

function stripEnvQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

async function loadLocalEnvFile() {
  try {
    const text = await fs.readFile(localEnvPath, 'utf8');
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) continue;
      const key = line.slice(0, separatorIndex).trim();
      const value = stripEnvQuotes(line.slice(separatorIndex + 1).trim());
      if (!key || process.env[key]) continue;
      process.env[key] = value;
    }
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return;
    }
    throw error;
  }
}

function parseIdentities(stdout, pattern) {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => pattern.test(line))
    .map((line) => {
      const match = line.match(/"(.+?)"/);
      return match?.[1] || line;
    });
}

async function main() {
  await loadLocalEnvFile();

  console.log('Personal AI Desktop App macOS signing diagnostics');
  console.log(`Local env: ${localEnvPath}`);
  console.log('');

  const findIdentity = await tryRun('security', [
    'find-identity',
    '-v',
    '-p',
    'basic',
  ]);
  const applicationIdentities = parseIdentities(
    findIdentity?.stdout || '',
    /Developer ID Application:/i,
  );
  const installerIdentities = parseIdentities(
    findIdentity?.stdout || '',
    /Developer ID Installer:/i,
  );

  console.log('Developer ID Application certificates');
  if (applicationIdentities.length === 0) {
    console.log('- none found on this machine');
  } else {
    for (const identity of applicationIdentities) {
      console.log(`- ${identity}`);
    }
  }
  console.log('');

  console.log('Developer ID Installer certificates');
  if (installerIdentities.length === 0) {
    console.log('- none found on this machine');
  } else {
    for (const identity of installerIdentities) {
      console.log(`- ${identity}`);
    }
  }
  console.log('');

  const configuredAppIdentity =
    process.env.APPLE_APPLICATION_SIGNING_IDENTITY ||
    process.env.APPLE_APP_SIGNING_IDENTITY ||
    process.env.CSC_NAME;
  const configuredIdentity = process.env.APPLE_INSTALLER_SIGNING_IDENTITY;
  const configuredProfile =
    process.env.APPLE_NOTARY_KEYCHAIN_PROFILE ||
    process.env.APPLE_NOTARY_PROFILE;

  console.log('Configured env');
  console.log(
    `- APPLE_APPLICATION_SIGNING_IDENTITY: ${configuredAppIdentity || 'not set'}`,
  );
  console.log(
    `- APPLE_INSTALLER_SIGNING_IDENTITY: ${configuredIdentity || 'not set'}`,
  );
  console.log(
    `- APPLE_NOTARY_KEYCHAIN_PROFILE: ${configuredProfile || 'not set'}`,
  );
  console.log('');

  if (configuredProfile) {
    const notaryHistory = await tryRun('xcrun', [
      'notarytool',
      'history',
      '--keychain-profile',
      configuredProfile,
    ]);
    console.log('Notary profile validation');
    if (notaryHistory?.stdout || notaryHistory?.stderr) {
      console.log(`- profile "${configuredProfile}" looks usable`);
    } else {
      console.log(`- could not validate profile "${configuredProfile}"`);
    }
    console.log('');
  }

  console.log('How to get the certificate name');
  console.log(
    '1. Join the Apple Developer Program and create/download both Developer ID Application and Developer ID Installer certificates from Apple Developer.',
  );
  console.log(
    '2. Double-click the .cer file to import it into Keychain Access.',
  );
  console.log('3. Re-run: npm --prefix desktop-app run macos:signing-info');
  console.log(
    '4. Copy one of the printed "Developer ID Application: ..." names into APPLE_APPLICATION_SIGNING_IDENTITY.',
  );
  console.log(
    '5. Copy one of the printed "Developer ID Installer: ..." names into APPLE_INSTALLER_SIGNING_IDENTITY.',
  );
  console.log('');

  console.log('How to create the notary profile');
  console.log('1. Create an app-specific password for your Apple ID.');
  console.log('2. Run this command and replace the placeholders:');
  console.log('');
  console.log('   xcrun notarytool store-credentials "personal-ai-notary" \\');
  console.log('     --apple-id "you@example.com" \\');
  console.log('     --team-id "YOURTEAMID" \\');
  console.log('     --password "app-specific-password"');
  console.log('');
  console.log(
    '3. Put APPLE_NOTARY_KEYCHAIN_PROFILE=personal-ai-notary into desktop-app/.env',
  );
  console.log('4. Run: npm run build:desktop');
  console.log('');

  if (configuredAppIdentity && configuredIdentity && configuredProfile) {
    console.log('Current next step');
    console.log('- Run: npm run build:desktop');
    console.log('- Then run: npm run deploy:desktop');
  }
}

main().catch((error) => {
  console.error('Failed to inspect macOS signing setup:', error);
  process.exit(1);
});
