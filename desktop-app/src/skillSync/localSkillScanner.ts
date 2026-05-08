import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export interface LocalSkillDirectory {
  platform: 'codex' | 'claude_code' | 'cursor' | string;
  root: string;
}

export interface LocalSkillRecord {
  platform: string;
  root: string;
  directory: string;
  slug: string;
  title: string;
  description?: string;
  version?: string;
  skillMdPath: string;
  skillMd: string;
  files: LocalSkillPackageFile[];
  sha256: string;
  mtime: number;
}

export interface LocalSkillPackageFile {
  path: string;
  content: string;
  sha256: string;
  byteSize: number;
}

export interface LocalSkillInstallPackage {
  slug: string;
  title?: string;
  description?: string;
  version?: string;
  sha256?: string;
  skillMd: string;
  files?: Array<{
    path?: string;
    relativePath?: string;
    content: string;
    sha256?: string;
    byteSize?: number;
  }>;
}

export interface SkillSourceVersion {
  version: string;
  updatedAt: number;
  sha256: string;
}

export interface SkillRemoteVersion {
  version?: string;
  mtime?: number;
  sha256?: string;
}

export type SkillSyncDecision =
  | { action: 'install'; reason: 'missing' | 'remote_outdated' | 'remote_dirty_old' }
  | { action: 'noop'; reason: 'hash_match' }
  | { action: 'external_change'; reason: 'same_version_remote_newer' }
  | { action: 'conflict'; reason: 'remote_newer_version' | 'remote_outdated_but_newer_mtime' };

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function packageSha(skillMd: string, files: LocalSkillPackageFile[]): string {
  return sha256(JSON.stringify({
    skillMd,
    files: files.map((file) => ({
      path: file.path,
      content: file.content,
      sha256: file.sha256,
      byteSize: file.byteSize,
    })),
  }));
}

function parseFrontmatter(markdown: string): Record<string, string> {
  if (!markdown.startsWith('---')) return {};
  const end = markdown.indexOf('\n---', 3);
  if (end < 0) return {};
  const block = markdown.slice(3, end).trim();
  const fields: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    const index = line.indexOf(':');
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (key && value) fields[key] = value;
  }
  return fields;
}

function statMtimeSeconds(filePath: string): number {
  return Math.floor(fs.statSync(filePath).mtimeMs / 1000);
}

function readPackageFiles(skillDir: string): LocalSkillPackageFile[] {
  const files: LocalSkillPackageFile[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'SKILL.md') continue;
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const relativePath = path.relative(skillDir, absolutePath);
      const content = fs.readFileSync(absolutePath, 'utf8');
      files.push({
        path: relativePath,
        content,
        sha256: sha256(content),
        byteSize: Buffer.byteLength(content, 'utf8'),
      });
    }
  };
  visit(skillDir);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function safeSkillDirectoryName(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'skill';
}

export function scanLocalSkillDirectories(
  directories: LocalSkillDirectory[],
): LocalSkillRecord[] {
  const records: LocalSkillRecord[] = [];

  for (const directory of directories) {
    if (!fs.existsSync(directory.root)) continue;
    const entries = fs.readdirSync(directory.root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMdPath = path.join(directory.root, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) continue;
      const skillMd = fs.readFileSync(skillMdPath, 'utf8');
      const frontmatter = parseFrontmatter(skillMd);
      const files = readPackageFiles(path.join(directory.root, entry.name));
      records.push({
        platform: directory.platform,
        root: directory.root,
        directory: path.join(directory.root, entry.name),
        slug: frontmatter.name || entry.name,
        title: frontmatter.name || entry.name,
        description: frontmatter.description,
        version: frontmatter.version,
        skillMdPath,
        skillMd,
        files,
        sha256: packageSha(skillMd, files),
        mtime: statMtimeSeconds(skillMdPath),
      });
    }
  }

  return records.sort((left, right) =>
    left.platform.localeCompare(right.platform) || left.slug.localeCompare(right.slug),
  );
}

export function writeLocalSkillPackage(
  root: string,
  pkg: LocalSkillInstallPackage,
): LocalSkillRecord {
  const directoryName = safeSkillDirectoryName(pkg.slug);
  const skillDir = path.join(root, directoryName);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), pkg.skillMd, 'utf8');

  for (const file of pkg.files || []) {
    const relativePath = file.relativePath || file.path || '';
    if (!relativePath || relativePath === 'SKILL.md' || path.isAbsolute(relativePath)) {
      continue;
    }
    const destination = path.normalize(path.join(skillDir, relativePath));
    if (!destination.startsWith(skillDir + path.sep)) continue;
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, file.content || '', 'utf8');
  }

  return scanLocalSkillDirectories([{ platform: 'local', root }])
    .find((record) => record.slug === pkg.slug || record.directory === skillDir)!;
}

function compareVersions(left?: string, right?: string): number {
  const normalize = (value?: string) =>
    String(value || '')
      .replace(/^v/i, '')
      .split('.')
      .map((part) => Number(part.replace(/\D+.*/, '')) || 0);
  const a = normalize(left);
  const b = normalize(right);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const delta = (a[i] || 0) - (b[i] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export function decideSkillSync(
  source: SkillSourceVersion,
  remote?: SkillRemoteVersion | null,
): SkillSyncDecision {
  if (!remote || !remote.sha256) {
    return { action: 'install', reason: 'missing' };
  }

  if (remote.sha256 === source.sha256) {
    return { action: 'noop', reason: 'hash_match' };
  }

  const remoteMtime = remote.mtime || 0;
  const versionDelta = compareVersions(remote.version, source.version);

  if (versionDelta === 0) {
    if (remoteMtime > source.updatedAt) {
      return { action: 'external_change', reason: 'same_version_remote_newer' };
    }
    return { action: 'install', reason: 'remote_dirty_old' };
  }

  if (versionDelta < 0) {
    if (remoteMtime > source.updatedAt) {
      return { action: 'conflict', reason: 'remote_outdated_but_newer_mtime' };
    }
    return { action: 'install', reason: 'remote_outdated' };
  }

  return { action: 'conflict', reason: 'remote_newer_version' };
}
