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
const releaseDir = path.resolve(
  process.env.DESKTOP_APP_RELEASE_DIR ||
    process.env.DOUBAO_BRIDGE_RELEASE_DIR ||
    path.join(desktopAppRoot, 'release'),
);

function getPkgPath(version) {
  return path.join(releaseDir, `Personal-AI-Desktop-${version}-Installer.pkg`);
}

function fatal(message) {
  throw new Error(message);
}

async function run(command, args, options = {}) {
  return execFileAsync(command, args, {
    cwd: desktopAppRoot,
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...process.env,
      PATH: `${path.dirname(process.execPath)}:${process.env.PATH || ''}`,
    },
    ...options,
  });
}

async function readJson(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  return JSON.parse(text);
}

async function tryRun(command, args, options = {}) {
  try {
    return await run(command, args, options);
  } catch (error) {
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

async function getRepository() {
  if (process.env.GITHUB_REPOSITORY) {
    return process.env.GITHUB_REPOSITORY;
  }

  const { stdout } = await run('git', ['remote', 'get-url', 'origin']);
  const remote = stdout.trim();
  const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
  if (!match?.[1]) {
    fatal('Unable to determine GitHub repository. Set GITHUB_REPOSITORY.');
  }
  return match[1];
}

async function hasGhCli() {
  const result = await tryRun('gh', ['--version']);
  return Boolean(result?.stdout);
}

async function getGhAuthToken() {
  const result = await tryRun('gh', ['auth', 'token']);
  const token = result?.stdout?.trim();
  return token || undefined;
}

async function apiRequest(repository, method, resourcePath, body, token) {
  const response = await fetch(
    `https://api.github.com/repos/${repository}${resourcePath}`,
    {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `GitHub API ${method} ${resourcePath} failed: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`,
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function uploadAsset(repository, releaseId, uploadUrl, assetPath, token) {
  const assetName = path.basename(assetPath);
  const assetBytes = await fs.readFile(assetPath);
  const endpoint = uploadUrl.replace(/\{\?name,label\}$/, '');
  const url = `${endpoint}?name=${encodeURIComponent(assetName)}`;

  await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/octet-stream',
    },
    body: assetBytes,
  }).then(async (response) => {
    if (response.ok) return;
    const text = await response.text().catch(() => '');
    throw new Error(
      `Uploading ${assetName} failed: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`,
    );
  });
}

async function deleteAssetIfPresent(repository, release, assetName, token) {
  const existing = release.assets?.find((asset) => asset.name === assetName);
  if (!existing) return;
  await apiRequest(
    repository,
    'DELETE',
    `/releases/assets/${existing.id}`,
    null,
    token,
  );
}

async function deleteAssetsExcept(repository, release, keepAssetNames, token) {
  const keep = new Set(keepAssetNames);
  for (const asset of release.assets || []) {
    if (keep.has(asset.name)) continue;
    await apiRequest(
      repository,
      'DELETE',
      `/releases/assets/${asset.id}`,
      null,
      token,
    );
  }
}

async function listGhReleaseAssets(repository, tagName) {
  const result = await tryRun('gh', [
    'release',
    'view',
    tagName,
    '--repo',
    repository,
    '--json',
    'assets',
  ]);
  if (!result?.stdout) return [];
  try {
    const payload = JSON.parse(result.stdout);
    return Array.isArray(payload.assets)
      ? payload.assets.map((asset) => asset?.name).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

async function deleteGhAssetsExcept(repository, tagName, keepAssetNames) {
  const keep = new Set(keepAssetNames);
  const assetNames = await listGhReleaseAssets(repository, tagName);
  for (const assetName of assetNames) {
    if (keep.has(assetName)) continue;
    await run('gh', [
      'release',
      'delete-asset',
      tagName,
      assetName,
      '--repo',
      repository,
      '--yes',
    ]);
  }
}

async function publishWithGhCli(
  repository,
  tagName,
  releaseTitle,
  releaseNotes,
  assetPaths,
) {
  const assets = Array.isArray(assetPaths) ? assetPaths : [assetPaths];
  const assetNames = assets.map((assetPath) => path.basename(assetPath));
  const existingRelease = await tryRun('gh', [
    'release',
    'view',
    tagName,
    '--repo',
    repository,
  ]);
  if (!existingRelease) {
    await run('gh', [
      'release',
      'create',
      tagName,
      '--repo',
      repository,
      '--title',
      releaseTitle,
      '--notes',
      releaseNotes,
    ]);
    console.log(`Created release ${tagName} via gh CLI`);
  } else {
    console.log(`Using existing release ${tagName} via gh CLI`);
  }

  await deleteGhAssetsExcept(repository, tagName, assetNames);
  for (const assetPath of assets) {
    await run('gh', [
      'release',
      'upload',
      tagName,
      assetPath,
      '--repo',
      repository,
      '--clobber',
    ]);
  }
}

async function publishReleaseWithApi(
  repository,
  token,
  tagName,
  releaseTitle,
  releaseNotes,
  assetPaths,
) {
  const assets = Array.isArray(assetPaths) ? assetPaths : [assetPaths];
  const assetNames = assets.map((assetPath) => path.basename(assetPath));
  let release;
  try {
    release = await apiRequest(
      repository,
      'GET',
      `/releases/tags/${encodeURIComponent(tagName)}`,
      null,
      token,
    );
  } catch (error) {
    if (!(error instanceof Error) || !/404/.test(error.message)) {
      throw error;
    }
  }

  if (!release) {
    release = await apiRequest(
      repository,
      'POST',
      '/releases',
      {
        tag_name: tagName,
        name: releaseTitle,
        body: releaseNotes,
        draft: false,
        prerelease: false,
        generate_release_notes: false,
      },
      token,
    );
    console.log(`Created release ${tagName}`);
  } else {
    console.log(`Using existing release ${tagName}`);
  }

  await deleteAssetsExcept(repository, release, assetNames, token);
  for (const assetPath of assets) {
    await deleteAssetIfPresent(
      repository,
      release,
      path.basename(assetPath),
      token,
    );
    await uploadAsset(repository, release.id, release.upload_url, assetPath, token);
  }
}

async function main() {
  await loadLocalEnvFile();

  const repository = await getRepository();
  const packageJson = await readJson(path.join(desktopAppRoot, 'package.json'));
  const workerPackageJson = await readJson(
    path.resolve(desktopAppRoot, '..', 'worker', 'package.json'),
  );
  const pkgPath = getPkgPath(packageJson.version);
  const desktopTagName =
    process.env.GITHUB_RELEASE_TAG || `desktop-v${packageJson.version}`;
  const desktopReleaseTitle =
    process.env.GITHUB_RELEASE_TITLE ||
    `Personal AI Desktop ${packageJson.version}`;
  const desktopReleaseNotes =
    process.env.GITHUB_RELEASE_NOTES ||
    `Automated macOS bundle for Personal AI Desktop ${packageJson.version}. Embeds the Personal AI worker.`;
  const workerVersion = String(workerPackageJson.version || '0.0.0');
  const workerTagName = process.env.WORKER_RELEASE_TAG || `worker-v${workerVersion}`;
  const workerReleaseTitle =
    process.env.WORKER_RELEASE_TITLE || `Personal AI Worker ${workerVersion}`;
  const workerReleaseNotes =
    process.env.WORKER_RELEASE_NOTES ||
    `Headless worker tarball and install.sh for protocol-compatible hosts. Desktop ${packageJson.version} already embeds this worker.`;

  console.log('Building macOS bundle, installer package, and worker tarball...');
  await run('npm', ['run', 'package:macos']);
  await fs.access(pkgPath);
  console.log(`Created installer: ${pkgPath}`);

  const { packWorkerRelease } = await import('./pack-worker.mjs');
  let workerTgz = path.join(
    releaseDir,
    'worker',
    `worker-${workerVersion}.tgz`,
  );
  let workerInstall = path.join(releaseDir, 'worker', 'install.sh');
  try {
    await fs.access(workerTgz);
    await fs.access(workerInstall);
  } catch {
    const packed = await packWorkerRelease();
    workerTgz = packed.tgzPath;
    workerInstall = packed.installPath;
  }
  console.log(`Created worker archive: ${workerTgz}`);

  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const ghInstalled = await hasGhCli();
  const ghToken = envToken ? undefined : await getGhAuthToken();
  const token = envToken || ghToken;

  if (!token && !ghInstalled) {
    fatal(
      `Missing GITHUB_TOKEN (or GH_TOKEN), and gh CLI is not available. Add a token to ${localEnvPath}, export it in your shell, or install/authenticate gh.`,
    );
  }

  const publishDesktopAndWorker = async (useGhCli) => {
    if (useGhCli) {
      await publishWithGhCli(
        repository,
        desktopTagName,
        desktopReleaseTitle,
        desktopReleaseNotes,
        [pkgPath],
      );
      await publishWithGhCli(
        repository,
        workerTagName,
        workerReleaseTitle,
        workerReleaseNotes,
        [workerTgz, workerInstall],
      );
      return;
    }
    await publishReleaseWithApi(
      repository,
      token,
      desktopTagName,
      desktopReleaseTitle,
      desktopReleaseNotes,
      [pkgPath],
    );
    await publishReleaseWithApi(
      repository,
      token,
      workerTagName,
      workerReleaseTitle,
      workerReleaseNotes,
      [workerTgz, workerInstall],
    );
  };

  if (!token && ghInstalled) {
    console.log('No GITHUB_TOKEN found. Falling back to gh release commands.');
    await publishDesktopAndWorker(true);
  } else {
    if (!envToken && ghToken) {
      console.log('Loaded GitHub token from gh auth token.');
    }
    await publishDesktopAndWorker(false);
  }

  const desktopUrl = `https://github.com/${repository}/releases/tag/${desktopTagName}`;
  const workerUrl = `https://github.com/${repository}/releases/tag/${workerTagName}`;

  console.log('');
  console.log(`Desktop release: ${desktopUrl}`);
  console.log(`Uploaded asset: ${path.basename(pkgPath)}`);
  console.log(`Worker release: ${workerUrl}`);
  console.log(`Uploaded assets: ${path.basename(workerTgz)}, ${path.basename(workerInstall)}`);
}

main().catch((error) => {
  console.error('Failed to deploy Personal AI:', error);
  process.exit(1);
});
