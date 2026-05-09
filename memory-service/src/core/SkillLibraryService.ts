import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

export type SkillStatus = 'suggestion' | 'active' | 'dismissed';
export type SkillRisk = 'low' | 'medium' | 'high';
export type SkillScope = 'work' | 'personal' | 'ai';
export type SkillBindingState =
  | 'installed'
  | 'outdated'
  | 'not_installed'
  | 'blocked'
  | 'unknown';
export type SkillPlatformCapability =
  | 'internal'
  | 'api'
  | 'fs_via_desktop_app'
  | 'manual_only';

export interface SkillWorkflowStep {
  title: string;
  desc?: string;
  tools?: string[];
}

export interface SkillEvidenceRef {
  title: string;
  desc?: string;
  kind?: string;
  evidenceState?: 'complete' | 'partial' | 'manual' | 'unverified';
  episodeId?: string | null;
}

export interface SkillSourceEpisode {
  id: string;
  title: string;
  date?: string;
}

export interface SkillPackageFile {
  relativePath: string;
  content: string;
  sha256?: string;
  byteSize?: number;
}

export interface SkillVersionRecord {
  id: string;
  skillId: string;
  version: string;
  isActive: boolean;
  skillMd: string;
  packageJson: Record<string, unknown>;
  workflow: SkillWorkflowStep[];
  evidence: SkillEvidenceRef[];
  sourceEpisodes: SkillSourceEpisode[];
  files: SkillPackageFile[];
  sha256: string;
  changelog?: string;
  createdFrom?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SkillBindingRecord {
  id: string;
  skillId: string;
  platform: string;
  state: SkillBindingState;
  installedVersion?: string;
  installedSha256?: string;
  remoteMtime?: number;
  lastSyncedAt?: number;
  lastError?: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface SkillSyncSettingRecord {
  platform: string;
  enabled: boolean;
  capability: SkillPlatformCapability;
  mode: string;
  config: Record<string, unknown>;
  lastProbeAt?: number;
  lastError?: string;
  updatedAt: number;
}

export interface SkillListItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  scope: SkillScope;
  risk: SkillRisk;
  trigger?: string;
  notUse?: string;
  status: SkillStatus;
  owner?: string;
  sources: string[];
  repetition?: string;
  riskBrief?: string;
  suggestedFrom?: string;
  suggestedAt?: number;
  notifiedAt?: number;
  snoozedUntil?: number;
  dismissedAt?: number;
  dismissReason?: string;
  suggestionClusterKey?: string;
  currentVersion?: string;
  currentSha256?: string;
  bindings: SkillBindingRecord[];
  createdAt: number;
  updatedAt: number;
}

export interface SkillDetail extends SkillListItem {
  versions: SkillVersionRecord[];
  activeVersion?: SkillVersionRecord;
  workflow: SkillWorkflowStep[];
  evidence: SkillEvidenceRef[];
  sourceEpisodes: SkillSourceEpisode[];
  share?: SkillShareInfo;
  shareError?: string;
}

export interface SkillShareInfo {
  displayUrl: string;
  urlPath: string;
  token: string;
  etag: string;
}

export interface CreateSkillSuggestionInput {
  slug?: string;
  title: string;
  summary?: string;
  scope?: SkillScope;
  risk?: SkillRisk;
  trigger?: string;
  notUse?: string;
  owner?: string;
  sources?: string[];
  repetition?: string;
  riskBrief?: string;
  suggestedFrom?: string;
  suggestionClusterKey?: string;
  currentVersion?: string;
  skillMd?: string;
  workflow?: SkillWorkflowStep[];
  evidence?: SkillEvidenceRef[];
  sourceEpisodes?: SkillSourceEpisode[];
  files?: SkillPackageFile[];
  changelog?: string;
  createdFrom?: string;
  notify?: boolean;
}

export interface ImportedExternalSkillPackage {
  platform: string;
  slug: string;
  title?: string;
  summary?: string;
  version?: string;
  skillMd: string;
  files?: SkillPackageFile[];
  sha256?: string;
  remoteMtime?: number;
  metadata?: Record<string, unknown>;
}

export interface SkillSyncPackage {
  skillId: string;
  slug: string;
  title: string;
  summary: string;
  version: string;
  updatedAt: number;
  sha256: string;
  skillMd: string;
  packageJson: Record<string, unknown>;
  files: SkillPackageFile[];
}

export interface SkillImportResult {
  status:
    | 'created_suggestion'
    | 'updated_active'
    | 'updated_binding'
    | 'created_external_change'
    | 'skipped';
  skill?: SkillDetail;
  existingSkillId?: string;
}

interface SkillRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  scope: string;
  risk: string;
  trigger_text: string | null;
  not_use_text: string | null;
  status: string;
  owner: string | null;
  source_kinds_json: string;
  repetition: string | null;
  risk_brief: string | null;
  suggested_from: string | null;
  suggested_at: number | null;
  notified_at: number | null;
  snoozed_until: number | null;
  dismissed_at: number | null;
  dismiss_reason: string | null;
  suggestion_cluster_key: string | null;
  created_at: number;
  updated_at: number;
  current_version?: string | null;
  current_sha256?: string | null;
}

interface VersionRow {
  id: string;
  skill_id: string;
  version: string;
  is_active: number;
  skill_md: string;
  package_json: string;
  workflow_json: string;
  evidence_json: string;
  source_episodes_json: string;
  files_json: string;
  sha256: string;
  changelog: string | null;
  created_from: string | null;
  created_at: number;
  updated_at: number;
}

interface BindingRow {
  id: string;
  skill_id: string;
  platform: string;
  state: string;
  installed_version: string | null;
  installed_sha256: string | null;
  remote_mtime: number | null;
  last_synced_at: number | null;
  last_error: string | null;
  metadata_json: string;
  created_at: number;
  updated_at: number;
}

interface SyncSettingRow {
  platform: string;
  enabled: number;
  capability: string;
  mode: string;
  config_json: string;
  last_probe_at: number | null;
  last_error: string | null;
  updated_at: number;
}

interface ShareLinkRow {
  id: string;
  skill_id: string;
  version_id: string;
  token_hash: string;
  revoked_at: number | null;
  created_at: number;
}

const DEFAULT_SYNC_SETTINGS: Array<{
  platform: string;
  enabled: boolean;
  capability: SkillPlatformCapability;
  mode: string;
}> = [
  { platform: 'personal_ai', enabled: true, capability: 'internal', mode: 'internal' },
  { platform: 'openclaw', enabled: true, capability: 'api', mode: 'API direct' },
  {
    platform: 'codex',
    enabled: false,
    capability: 'fs_via_desktop_app',
    mode: 'Desktop App fs watcher',
  },
  {
    platform: 'claude_code',
    enabled: false,
    capability: 'fs_via_desktop_app',
    mode: 'Desktop App fs watcher',
  },
  {
    platform: 'cursor',
    enabled: false,
    capability: 'fs_via_desktop_app',
    mode: 'Desktop App fs watcher',
  },
  {
    platform: 'chatgpt_gpts',
    enabled: false,
    capability: 'manual_only',
    mode: 'Manual install only',
  },
  {
    platform: 'claude_skills_web',
    enabled: false,
    capability: 'manual_only',
    mode: 'Manual install only',
  },
];

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /api[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9_.-]{16,}/i,
  /token\s*[:=]\s*['"]?[A-Za-z0-9_.-]{20,}/i,
  /secret\s*[:=]\s*['"]?[A-Za-z0-9_.-]{16,}/i,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
];

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function jsonStringify(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function hashContent(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hashToken(value: string): string {
  return hashContent(value);
}

function normalizeSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || `skill-${randomUUID().slice(0, 8)}`;
}

export function normalizeSkillSlug(value: string): string {
  return normalizeSlug(value);
}

function normalizeVersion(value?: string): string {
  return (value || 'v0.1').trim().replace(/\s*\(.+\)\s*$/, '') || 'v0.1';
}

export function compareSkillVersionStrings(left?: string, right?: string): number {
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

function validateStatus(value: string): SkillStatus {
  if (value === 'suggestion' || value === 'active' || value === 'dismissed') return value;
  return 'suggestion';
}

function validateScope(value: string): SkillScope {
  if (value === 'personal' || value === 'ai') return value;
  return 'work';
}

function validateRisk(value: string): SkillRisk {
  if (value === 'low' || value === 'high') return value;
  return 'medium';
}

function validateBindingState(value: string): SkillBindingState {
  if (
    value === 'installed' ||
    value === 'outdated' ||
    value === 'not_installed' ||
    value === 'blocked' ||
    value === 'unknown'
  ) {
    return value;
  }
  return 'unknown';
}

function validateCapability(value: string): SkillPlatformCapability {
  if (
    value === 'internal' ||
    value === 'api' ||
    value === 'fs_via_desktop_app' ||
    value === 'manual_only'
  ) {
    return value;
  }
  return 'manual_only';
}

function buildSkillMd(input: CreateSkillSuggestionInput, slug: string): string {
  if (input.skillMd?.trim()) return input.skillMd.trim();
  const lines = [
    '---',
    `name: ${slug}`,
    `description: ${input.summary || input.title}`,
    '---',
    '',
    `# ${input.title}`,
    '',
    input.summary || '',
    '',
    '## When to use',
    input.trigger || 'Use when this workflow matches the current task.',
    '',
    '## When not to use',
    input.notUse || 'Do not use when required inputs are missing.',
    '',
    '## Workflow',
    ...(input.workflow || []).map((step, index) => `${index + 1}. ${step.title}${step.desc ? ` — ${step.desc}` : ''}`),
  ];
  return lines.filter((line) => line !== undefined).join('\n').trim();
}

function firstMarkdownHeading(markdown: string): string | undefined {
  const heading = markdown.match(/^#\s+(.+)$/m);
  return heading?.[1]?.trim();
}

function toVersionRecord(row: VersionRow): SkillVersionRecord {
  return {
    id: row.id,
    skillId: row.skill_id,
    version: row.version,
    isActive: row.is_active === 1,
    skillMd: row.skill_md,
    packageJson: safeJsonParse<Record<string, unknown>>(row.package_json, {}),
    workflow: safeJsonParse<SkillWorkflowStep[]>(row.workflow_json, []),
    evidence: safeJsonParse<SkillEvidenceRef[]>(row.evidence_json, []),
    sourceEpisodes: safeJsonParse<SkillSourceEpisode[]>(row.source_episodes_json, []),
    files: safeJsonParse<SkillPackageFile[]>(row.files_json, []),
    sha256: row.sha256,
    changelog: row.changelog ?? undefined,
    createdFrom: row.created_from ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toBindingRecord(row: BindingRow): SkillBindingRecord {
  return {
    id: row.id,
    skillId: row.skill_id,
    platform: row.platform,
    state: validateBindingState(row.state),
    installedVersion: row.installed_version ?? undefined,
    installedSha256: row.installed_sha256 ?? undefined,
    remoteMtime: row.remote_mtime ?? undefined,
    lastSyncedAt: row.last_synced_at ?? undefined,
    lastError: row.last_error ?? undefined,
    metadata: safeJsonParse<Record<string, unknown>>(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSyncSettingRecord(row: SyncSettingRow): SkillSyncSettingRecord {
  return {
    platform: row.platform,
    enabled: row.enabled === 1,
    capability: validateCapability(row.capability),
    mode: row.mode,
    config: safeJsonParse<Record<string, unknown>>(row.config_json, {}),
    lastProbeAt: row.last_probe_at ?? undefined,
    lastError: row.last_error ?? undefined,
    updatedAt: row.updated_at,
  };
}

function toSkillListItem(row: SkillRow, bindings: SkillBindingRecord[]): SkillListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    scope: validateScope(row.scope),
    risk: validateRisk(row.risk),
    trigger: row.trigger_text ?? undefined,
    notUse: row.not_use_text ?? undefined,
    status: validateStatus(row.status),
    owner: row.owner ?? undefined,
    sources: safeJsonParse<string[]>(row.source_kinds_json, []),
    repetition: row.repetition ?? undefined,
    riskBrief: row.risk_brief ?? undefined,
    suggestedFrom: row.suggested_from ?? undefined,
    suggestedAt: row.suggested_at ?? undefined,
    notifiedAt: row.notified_at ?? undefined,
    snoozedUntil: row.snoozed_until ?? undefined,
    dismissedAt: row.dismissed_at ?? undefined,
    dismissReason: row.dismiss_reason ?? undefined,
    suggestionClusterKey: row.suggestion_cluster_key ?? undefined,
    currentVersion: row.current_version ?? undefined,
    currentSha256: row.current_sha256 ?? undefined,
    bindings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SkillLibraryService {
  constructor(
    private readonly db: Database.Database,
    private readonly userId = 'default',
  ) {}

  ensureDefaultSyncSettings(): void {
    const ts = now();
    const stmt = this.db.prepare(
      `INSERT OR IGNORE INTO skill_platform_sync_settings
        (platform, enabled, capability, mode, config_json, updated_at)
       VALUES (?, ?, ?, ?, '{}', ?)`,
    );
    for (const setting of DEFAULT_SYNC_SETTINGS) {
      stmt.run(
        setting.platform,
        setting.enabled ? 1 : 0,
        setting.capability,
        setting.mode,
        ts,
      );
    }
  }

  listSyncSettings(): SkillSyncSettingRecord[] {
    this.ensureDefaultSyncSettings();
    const rows = this.db
      .prepare(
        `SELECT *
           FROM skill_platform_sync_settings
          ORDER BY CASE platform
            WHEN 'personal_ai' THEN 0
            WHEN 'openclaw' THEN 1
            WHEN 'codex' THEN 2
            WHEN 'claude_code' THEN 3
            WHEN 'cursor' THEN 4
            WHEN 'chatgpt_gpts' THEN 5
            WHEN 'claude_skills_web' THEN 6
            ELSE 99
          END, platform`,
      )
      .all() as SyncSettingRow[];
    return rows.map(toSyncSettingRecord);
  }

  updateSyncSetting(platform: string, enabled: boolean): SkillSyncSettingRecord {
    this.ensureDefaultSyncSettings();
    const current = this.getSyncSetting(platform);
    if (!current) {
      throw new Error(`Unknown platform: ${platform}`);
    }
    if (current.capability === 'internal' || current.capability === 'manual_only') {
      enabled = current.enabled;
    }
    const ts = now();
    this.db
      .prepare(
        `UPDATE skill_platform_sync_settings
            SET enabled = ?, updated_at = ?
          WHERE platform = ?`,
      )
      .run(enabled ? 1 : 0, ts, platform);
    return this.getSyncSetting(platform)!;
  }

  recordSyncProbe(platform: string, input: { ok: boolean; error?: string }): SkillSyncSettingRecord | null {
    this.ensureDefaultSyncSettings();
    const ts = now();
    this.db
      .prepare(
        `UPDATE skill_platform_sync_settings
            SET last_probe_at = ?, last_error = ?, updated_at = ?
          WHERE platform = ?`,
      )
      .run(ts, input.ok ? null : input.error || 'Probe failed', ts, platform);
    return this.getSyncSetting(platform);
  }

  getSyncSetting(platform: string): SkillSyncSettingRecord | null {
    const row = this.db
      .prepare('SELECT * FROM skill_platform_sync_settings WHERE platform = ?')
      .get(platform) as SyncSettingRow | undefined;
    return row ? toSyncSettingRecord(row) : null;
  }

  listSkills(input?: { filter?: 'active' | 'all' | 'dismissed'; q?: string }): {
    items: SkillListItem[];
    total: number;
  } {
    this.ensureDefaultSyncSettings();
    const filter = input?.filter || 'active';
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter === 'active') {
      conditions.push("s.status = 'active'");
    } else if (filter === 'dismissed') {
      conditions.push("s.status = 'dismissed'");
    } else {
      conditions.push("s.status IN ('active', 'dismissed')");
    }

    const q = input?.q?.trim();
    if (q) {
      conditions.push('(LOWER(s.title) LIKE ? OR LOWER(s.summary) LIKE ? OR LOWER(s.slug) LIKE ?)');
      const like = `%${q.toLowerCase()}%`;
      params.push(like, like, like);
    }

    const rows = this.db
      .prepare(
        `SELECT s.*,
                v.version AS current_version,
                v.sha256 AS current_sha256
           FROM personal_skills s
      LEFT JOIN skill_versions v ON v.skill_id = s.id AND v.is_active = 1
          WHERE ${conditions.join(' AND ')}
          ORDER BY CASE s.status WHEN 'active' THEN 0 ELSE 1 END,
                   s.updated_at DESC,
                   s.created_at DESC`,
      )
      .all(...params) as SkillRow[];

    const items = rows.map((row) => toSkillListItem(row, this.listBindings(row.id)));
    return { items, total: items.length };
  }

  listSuggestions(): { items: SkillListItem[]; total: number } {
    this.ensureDefaultSyncSettings();
    const ts = now();
    const rows = this.db
      .prepare(
        `SELECT s.*,
                v.version AS current_version,
                v.sha256 AS current_sha256
           FROM personal_skills s
      LEFT JOIN skill_versions v ON v.skill_id = s.id AND v.is_active = 1
          WHERE s.status = 'suggestion'
            AND (s.snoozed_until IS NULL OR s.snoozed_until <= ?)
          ORDER BY COALESCE(s.snoozed_until, 0) ASC,
                   s.updated_at DESC,
                   s.created_at DESC`,
      )
      .all(ts) as SkillRow[];
    const items = rows.map((row) => toSkillListItem(row, this.listBindings(row.id)));
    return { items, total: items.length };
  }

  getSkill(idOrSlug: string): SkillDetail | null {
    this.ensureDefaultSyncSettings();
    const row = this.db
      .prepare(
        `SELECT s.*,
                v.version AS current_version,
                v.sha256 AS current_sha256
           FROM personal_skills s
      LEFT JOIN skill_versions v ON v.skill_id = s.id AND v.is_active = 1
          WHERE s.id = ? OR s.slug = ?
          LIMIT 1`,
      )
      .get(idOrSlug, idOrSlug) as SkillRow | undefined;
    if (!row) return null;

    const versions = this.listVersions(row.id);
    const activeVersion = versions.find((version) => version.isActive) || versions[0];
    const base = toSkillListItem(row, this.listBindings(row.id));
    let share: SkillShareInfo | undefined;
    let shareError: string | undefined;
    if (activeVersion && base.status === 'active') {
      try {
        share = this.ensureShareLink(base, activeVersion);
      } catch (error) {
        shareError = error instanceof Error ? error.message : String(error);
      }
    }

    return {
      ...base,
      versions,
      activeVersion,
      workflow: activeVersion?.workflow ?? [],
      evidence: activeVersion?.evidence ?? [],
      sourceEpisodes: activeVersion?.sourceEpisodes ?? [],
      share,
      shareError,
    };
  }

  needsPlatformPackageImport(input: {
    platform: string;
    slug: string;
    sha256?: string;
  }): boolean {
    const slug = normalizeSlug(input.slug);
    const row = this.findSkillRowBySlug(slug);
    if (!row) return true;

    const binding = this.getBinding(row.id, input.platform);
    if (!binding) return true;
    if (input.sha256 && binding.installedSha256 !== input.sha256) return true;
    return false;
  }

  getSkillBySlug(slug: string): SkillDetail | null {
    return this.getSkill(normalizeSlug(slug));
  }

  listActiveSyncPackages(): SkillSyncPackage[] {
    return this.listSkills({ filter: 'active' }).items
      .map((item) => this.getSkill(item.id))
      .filter((skill): skill is SkillDetail => Boolean(skill?.activeVersion))
      .map((skill) => this.toSyncPackage(skill));
  }

  toSyncPackage(skill: SkillDetail): SkillSyncPackage {
    const version = skill.activeVersion;
    if (!version) {
      throw new Error(`Skill '${skill.slug}' does not have an active version.`);
    }
    return {
      skillId: skill.id,
      slug: skill.slug,
      title: skill.title,
      summary: skill.summary,
      version: version.version,
      updatedAt: skill.updatedAt,
      sha256: version.sha256,
      skillMd: version.skillMd,
      packageJson: version.packageJson,
      files: version.files,
    };
  }

  isExternalNewerThanSkill(
    skill: Pick<SkillDetail, 'currentVersion' | 'currentSha256' | 'updatedAt'>,
    remote: { version?: string; sha256?: string; mtime?: number },
  ): boolean {
    if (remote.sha256 && remote.sha256 === skill.currentSha256) return false;
    const versionDelta = compareSkillVersionStrings(remote.version, skill.currentVersion);
    if (versionDelta > 0) return true;
    if (versionDelta < 0) return false;
    return Boolean(remote.mtime && remote.mtime > skill.updatedAt);
  }

  recordPlatformSync(input: {
    skillId: string;
    platform: string;
    version?: string;
    sha256?: string;
    remoteMtime?: number;
    state?: SkillBindingState;
    metadata?: Record<string, unknown>;
    error?: string | null;
  }): SkillBindingRecord {
    return this.upsertBinding(input.skillId, {
      platform: input.platform,
      state: input.state || (input.error ? 'blocked' : 'installed'),
      installedVersion: input.version,
      installedSha256: input.sha256,
      remoteMtime: input.remoteMtime,
      lastSyncedAt: now(),
      lastError: input.error ?? null,
      metadata: input.metadata,
    });
  }

  updateActiveSkillFromExternal(input: ImportedExternalSkillPackage): SkillImportResult {
    this.ensureDefaultSyncSettings();
    const platform = input.platform.trim();
    if (!platform) throw new Error('External skill platform is required.');

    const slug = normalizeSlug(input.slug);
    const existing = this.findSkillRowBySlug(slug);
    if (!existing) {
      return this.importExternalSkillPackage(input);
    }

    const detail = this.getSkill(existing.id);
    if (!detail || detail.status !== 'active') {
      return this.importExternalSkillPackage(input);
    }

    const version = normalizeVersion(input.version);
    const skillMd = input.skillMd.trim();
    if (!skillMd) throw new Error(`External skill '${slug}' did not include SKILL.md content.`);
    const files = (input.files || [])
      .filter((file) => file.relativePath !== 'SKILL.md')
      .map((file) => ({
        ...file,
        sha256: file.sha256 || hashContent(file.content || ''),
        byteSize: file.byteSize ?? Buffer.byteLength(file.content || '', 'utf8'),
      }));
    const title = input.title?.trim() || firstMarkdownHeading(skillMd) || detail.title;
    const summary = input.summary?.trim() || detail.summary;
    const pkg = this.buildPackage({
      slug,
      title,
      summary,
      version,
      skillMd,
      workflow: [],
      evidence: [
        {
          title: `${platform} installed skill`,
          desc: 'Newer version pulled from the external agent platform.',
          kind: platform,
          evidenceState: 'partial',
        },
      ],
      sourceEpisodes: [],
      files,
    });
    const packageSha = input.sha256 || hashContent(JSON.stringify(pkg));
    const ts = now();

    if (detail.currentSha256 === packageSha) {
      this.recordPlatformSync({
        skillId: detail.id,
        platform,
        version,
        sha256: packageSha,
        remoteMtime: input.remoteMtime,
        metadata: input.metadata,
      });
      return { status: 'updated_binding', skill: this.getSkill(detail.id) ?? undefined };
    }

    const nextSources = Array.from(new Set([...(detail.sources || []), platform]));
    const update = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE personal_skills
              SET title = ?,
                  summary = ?,
                  source_kinds_json = ?,
                  updated_at = ?
            WHERE id = ?`,
        )
        .run(title, summary, jsonStringify(nextSources), ts, detail.id);

      this.insertVersion({
        skillId: detail.id,
        version,
        isActive: true,
        skillMd,
        packageJson: pkg,
        workflow: [],
        evidence: [
          {
            title: `${platform} installed skill`,
            desc: 'Newer version pulled from the external agent platform.',
            kind: platform,
            evidenceState: 'partial',
          },
        ],
        sourceEpisodes: [],
        files,
        sha256: packageSha,
        changelog: `Pulled newer ${platform} skill version`,
        createdFrom: platform,
        timestamp: ts,
      });

      this.upsertBinding(detail.id, {
        platform: 'personal_ai',
        state: 'installed',
        installedVersion: version,
        installedSha256: packageSha,
        lastSyncedAt: ts,
      });
      this.upsertBinding(detail.id, {
        platform,
        state: 'installed',
        installedVersion: version,
        installedSha256: packageSha,
        remoteMtime: input.remoteMtime,
        lastSyncedAt: ts,
        metadata: input.metadata,
      });
    });

    update();
    return { status: 'updated_active', skill: this.getSkill(detail.id) ?? undefined };
  }

  importExternalSkillPackage(input: ImportedExternalSkillPackage): SkillImportResult {
    this.ensureDefaultSyncSettings();
    const platform = input.platform.trim();
    if (!platform) throw new Error('External skill platform is required.');

    const slug = normalizeSlug(input.slug);
    const version = normalizeVersion(input.version);
    const skillMd = input.skillMd.trim();
    if (!skillMd) throw new Error(`External skill '${slug}' did not include SKILL.md content.`);

    const files = (input.files || [])
      .filter((file) => file.relativePath !== 'SKILL.md')
      .map((file) => ({
        ...file,
        sha256: file.sha256 || hashContent(file.content || ''),
        byteSize: file.byteSize ?? Buffer.byteLength(file.content || '', 'utf8'),
      }));
    const title = input.title?.trim() || firstMarkdownHeading(skillMd) || slug;
    const summary =
      input.summary?.trim() ||
      `Imported from ${platform}. Review before promoting this skill into Personal AI.`;
    const pkg = this.buildPackage({
      slug,
      title,
      summary,
      version,
      skillMd,
      workflow: [],
      evidence: [
        {
          title: `${platform} installed skill`,
          desc: 'Read-only package exported from the external agent platform.',
          kind: platform,
          evidenceState: 'partial',
        },
      ],
      sourceEpisodes: [],
      files,
    });
    const packageSha = input.sha256 || hashContent(JSON.stringify(pkg));
    const remoteMtime = input.remoteMtime;
    const ts = now();
    const existing = this.findSkillRowBySlug(slug);

    if (!existing) {
      const skill = this.createImportedSuggestion({
        slug,
        title,
        summary,
        platform,
        version,
        skillMd,
        files,
        packageJson: pkg,
        packageSha,
        remoteMtime,
        metadata: input.metadata,
        timestamp: ts,
      });
      return { status: 'created_suggestion', skill };
    }

    const existingDetail = this.getSkill(existing.id);
    const bindingState =
      existingDetail?.currentSha256 && existingDetail.currentSha256 !== packageSha
        ? 'outdated'
        : 'installed';
    this.upsertBinding(existing.id, {
      platform,
      state: bindingState,
      installedVersion: version,
      installedSha256: packageSha,
      remoteMtime,
      lastSyncedAt: ts,
      metadata: input.metadata,
    });

    if (!existingDetail || existingDetail.currentSha256 === packageSha) {
      return {
        status: 'updated_binding',
        skill: this.getSkill(existing.id) ?? undefined,
        existingSkillId: existing.id,
      };
    }

    const clusterKey = `${platform}:${slug}:${packageSha}:external_change`;
    const existingChange = this.findSuggestionByClusterKey(clusterKey);
    if (existingChange) {
      return {
        status: 'skipped',
        skill: this.getSkill(existingChange.id) ?? undefined,
        existingSkillId: existing.id,
      };
    }

    const shouldCreateExternalChange =
      existingDetail.status === 'active' &&
      (!remoteMtime || remoteMtime > existingDetail.updatedAt);
    if (!shouldCreateExternalChange) {
      return {
        status: 'updated_binding',
        skill: this.getSkill(existing.id) ?? undefined,
        existingSkillId: existing.id,
      };
    }

    const changeSkill = this.createImportedSuggestion({
      slug: this.generateUniqueSlug(`${slug}-${platform}-change`),
      title: `${title} (${platform} change)`,
      summary: `External ${platform} version differs from the Personal AI source. Review before pulling it into the skill library.`,
      platform,
      version,
      skillMd,
      files,
      packageJson: pkg,
      packageSha,
      remoteMtime,
      metadata: {
        ...(input.metadata || {}),
        externalChangeFor: existing.id,
        originalSlug: slug,
      },
      suggestionClusterKey: clusterKey,
      createdFrom: 'external_change',
      timestamp: ts,
    });

    return {
      status: 'created_external_change',
      skill: changeSkill,
      existingSkillId: existing.id,
    };
  }

  createSuggestion(input: CreateSkillSuggestionInput): SkillDetail {
    this.ensureDefaultSyncSettings();
    const ts = now();
    const id = randomUUID();
    const slug = normalizeSlug(input.slug || input.title);
    const version = normalizeVersion(input.currentVersion);
    const skillMd = buildSkillMd(input, slug);
    const workflow = input.workflow || [];
    const evidence = input.evidence || [];
    const sourceEpisodes = input.sourceEpisodes || [];
    const files = input.files || [];
    const pkg = this.buildPackage({
      slug,
      title: input.title,
      summary: input.summary || '',
      version,
      skillMd,
      workflow,
      evidence,
      sourceEpisodes,
      files,
    });
    const sha = hashContent(JSON.stringify(pkg));

    const create = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO personal_skills
            (id, slug, title, summary, scope, risk, trigger_text, not_use_text, status,
             owner, source_kinds_json, repetition, risk_brief, suggested_from, suggested_at,
             notified_at, suggestion_cluster_key, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'suggestion',
             ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          slug,
          input.title,
          input.summary || '',
          input.scope || 'work',
          input.risk || 'medium',
          input.trigger ?? null,
          input.notUse ?? null,
          input.owner ?? null,
          jsonStringify(input.sources || []),
          input.repetition ?? null,
          input.riskBrief ?? null,
          input.suggestedFrom ?? null,
          ts,
          input.notify ? ts : null,
          input.suggestionClusterKey ?? null,
          ts,
          ts,
        );

      this.insertVersion({
        skillId: id,
        version,
        isActive: true,
        skillMd,
        packageJson: pkg,
        workflow,
        evidence,
        sourceEpisodes,
        files,
        sha256: sha,
        changelog: input.changelog || 'Initial skill suggestion',
        createdFrom: input.createdFrom || 'suggestion',
        timestamp: ts,
      });

      this.upsertBinding(id, {
        platform: 'personal_ai',
        state: 'installed',
        installedVersion: version,
        installedSha256: sha,
        lastSyncedAt: ts,
      });

      if (input.notify) {
        this.insertSuggestionNotification({
          skillId: id,
          title: input.title,
          summary: input.summary || '',
          timestamp: ts,
        });
      }
    });

    create();
    return this.getSkill(id)!;
  }

  useSuggestion(id: string): SkillDetail {
    const skill = this.getSkill(id);
    if (!skill) throw new Error('Skill suggestion not found');
    if (skill.status !== 'suggestion') throw new Error('Only suggestions can be promoted');
    const ts = now();
    this.db
      .prepare(
        `UPDATE personal_skills
            SET status = 'active',
                dismissed_at = NULL,
                dismiss_reason = NULL,
                updated_at = ?
          WHERE id = ?`,
      )
      .run(ts, id);

    const activeVersion = skill.activeVersion;
    if (activeVersion) {
      this.upsertBinding(id, {
        platform: 'personal_ai',
        state: 'installed',
        installedVersion: activeVersion.version,
        installedSha256: activeVersion.sha256,
        lastSyncedAt: ts,
      });
    }

    return this.getSkill(id)!;
  }

  dismissSuggestion(id: string, reason?: string): SkillDetail {
    const skill = this.getSkill(id);
    if (!skill) throw new Error('Skill suggestion not found');
    if (skill.status !== 'suggestion') throw new Error('Only suggestions can be dismissed');
    const ts = now();
    this.db
      .prepare(
        `UPDATE personal_skills
            SET status = 'dismissed',
                dismissed_at = ?,
                dismiss_reason = ?,
                updated_at = ?
          WHERE id = ?`,
      )
      .run(ts, reason || 'dismissed_by_user', ts, id);
    return this.getSkill(id)!;
  }

  snoozeSuggestion(id: string, days = 7): SkillDetail {
    const skill = this.getSkill(id);
    if (!skill) throw new Error('Skill suggestion not found');
    if (skill.status !== 'suggestion') throw new Error('Only suggestions can be snoozed');
    const ts = now();
    const until = ts + Math.max(1, Math.min(days, 30)) * 86400;
    this.db
      .prepare(
        `UPDATE personal_skills
            SET snoozed_until = ?,
                updated_at = ?
          WHERE id = ?`,
      )
      .run(until, ts, id);
    return this.getSkill(id)!;
  }

  listBindings(skillId: string): SkillBindingRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
           FROM skill_platform_bindings
          WHERE skill_id = ?
          ORDER BY CASE platform
            WHEN 'personal_ai' THEN 0
            WHEN 'openclaw' THEN 1
            WHEN 'codex' THEN 2
            WHEN 'claude_code' THEN 3
            WHEN 'cursor' THEN 4
            ELSE 99
          END, platform`,
      )
      .all(skillId) as BindingRow[];
    return rows.map(toBindingRecord);
  }

  listVersions(skillId: string): SkillVersionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
           FROM skill_versions
          WHERE skill_id = ?
          ORDER BY is_active DESC, created_at DESC, version DESC`,
      )
      .all(skillId) as VersionRow[];
    return rows.map(toVersionRecord);
  }

  ensureShareLink(skill: Pick<SkillListItem, 'id' | 'slug'>, version: SkillVersionRecord): SkillShareInfo {
    this.assertNoSecrets(version);
    // Tokens are stored as hashes only, so an existing URL cannot be recovered
    // for UI copy. Generate an additional live token on each detail fetch;
    // existing copied URLs stay valid until explicitly revoked.
    const rawToken = `${Buffer.from(this.userId).toString('base64url')}.${randomBytes(24).toString('base64url')}`;
    const ts = now();
    this.db
      .prepare(
        `INSERT INTO skill_share_links
          (id, skill_id, version_id, token_hash, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(randomUUID(), skill.id, version.id, hashToken(rawToken), ts);

    const slugVersion = `${skill.slug}@${version.version}`;
    const tokenParam = encodeURIComponent(rawToken);
    return {
      displayUrl: `/skills/${slugVersion}`,
      urlPath: `/skills/${encodeURIComponent(slugVersion)}?token=${tokenParam}`,
      token: rawToken,
      etag: `"${version.sha256}"`,
    };
  }

  resolveSharedSkill(token: string, slugVersion: string): SkillDetail | null {
    const tokenHash = hashToken(token);
    const link = this.db
      .prepare(
        `SELECT *
           FROM skill_share_links
          WHERE token_hash = ?
            AND revoked_at IS NULL
          LIMIT 1`,
      )
      .get(tokenHash) as ShareLinkRow | undefined;
    if (!link) return null;

    const detail = this.getSkill(link.skill_id);
    if (!detail?.activeVersion) return null;
    const expected = `${detail.slug}@${detail.activeVersion.version}`;
    if (expected !== slugVersion) return null;
    return detail;
  }

  extractUserIdFromShareToken(token: string): string | null {
    const [encoded] = token.split('.');
    if (!encoded) return null;
    try {
      return Buffer.from(encoded, 'base64url').toString('utf8') || null;
    } catch {
      return null;
    }
  }

  buildSharePackage(detail: SkillDetail): Record<string, unknown> {
    const active = detail.activeVersion;
    return {
      slug: detail.slug,
      title: detail.title,
      summary: detail.summary,
      version: active?.version,
      sha256: active?.sha256,
      skillMd: active?.skillMd || '',
      workflow: active?.workflow || [],
      evidence: active?.evidence || [],
      sourceEpisodes: active?.sourceEpisodes || [],
      files: active?.files || [],
    };
  }

  private findSkillRowBySlug(slug: string): SkillRow | null {
    const row = this.db
      .prepare(
        `SELECT s.*,
                v.version AS current_version,
                v.sha256 AS current_sha256
           FROM personal_skills s
      LEFT JOIN skill_versions v ON v.skill_id = s.id AND v.is_active = 1
          WHERE s.slug = ?
          LIMIT 1`,
      )
      .get(slug) as SkillRow | undefined;
    return row ?? null;
  }

  private findSuggestionByClusterKey(clusterKey: string): SkillRow | null {
    const row = this.db
      .prepare(
        `SELECT s.*,
                v.version AS current_version,
                v.sha256 AS current_sha256
           FROM personal_skills s
      LEFT JOIN skill_versions v ON v.skill_id = s.id AND v.is_active = 1
          WHERE s.status = 'suggestion'
            AND s.suggestion_cluster_key = ?
          LIMIT 1`,
      )
      .get(clusterKey) as SkillRow | undefined;
    return row ?? null;
  }

  private getBinding(skillId: string, platform: string): SkillBindingRecord | null {
    const row = this.db
      .prepare(
        `SELECT *
           FROM skill_platform_bindings
          WHERE skill_id = ?
            AND platform = ?
          LIMIT 1`,
      )
      .get(skillId, platform) as BindingRow | undefined;
    return row ? toBindingRecord(row) : null;
  }

  private generateUniqueSlug(baseSlug: string): string {
    const base = normalizeSlug(baseSlug);
    let candidate = base;
    let suffix = 2;
    while (this.findSkillRowBySlug(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  private createImportedSuggestion(input: {
    slug: string;
    title: string;
    summary: string;
    platform: string;
    version: string;
    skillMd: string;
    files: SkillPackageFile[];
    packageJson: Record<string, unknown>;
    packageSha: string;
    remoteMtime?: number;
    metadata?: Record<string, unknown>;
    suggestionClusterKey?: string;
    createdFrom?: string;
    timestamp: number;
  }): SkillDetail {
    const id = randomUUID();
    const ts = input.timestamp;
    const create = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO personal_skills
            (id, slug, title, summary, scope, risk, trigger_text, not_use_text, status,
             owner, source_kinds_json, repetition, risk_brief, suggested_from, suggested_at,
             notified_at, suggestion_cluster_key, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'ai', 'medium', ?, ?, 'suggestion',
             NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.slug,
          input.title,
          input.summary,
          `Use when this ${input.platform} skill matches the current task.`,
          'Do not use before reviewing imported external instructions.',
          jsonStringify([input.platform]),
          'External platform import',
          'Imported from an existing agent skill package.',
          input.platform,
          ts,
          ts,
          input.suggestionClusterKey ?? `${input.platform}:${input.slug}:import`,
          ts,
          ts,
        );

      this.insertVersion({
        skillId: id,
        version: input.version,
        isActive: true,
        skillMd: input.skillMd,
        packageJson: input.packageJson,
        workflow: [],
        evidence: [
          {
            title: `${input.platform} installed skill`,
            desc: 'Read-only package exported from the external agent platform.',
            kind: input.platform,
            evidenceState: 'partial',
          },
        ],
        sourceEpisodes: [],
        files: input.files,
        sha256: input.packageSha,
        changelog: 'Imported external skill package',
        createdFrom: input.createdFrom || input.platform,
        timestamp: ts,
      });

      this.upsertBinding(id, {
        platform: input.platform,
        state: 'installed',
        installedVersion: input.version,
        installedSha256: input.packageSha,
        remoteMtime: input.remoteMtime,
        lastSyncedAt: ts,
        metadata: input.metadata,
      });
    });

    create();
    return this.getSkill(id)!;
  }

  private insertVersion(input: {
    skillId: string;
    version: string;
    isActive: boolean;
    skillMd: string;
    packageJson: Record<string, unknown>;
    workflow: SkillWorkflowStep[];
    evidence: SkillEvidenceRef[];
    sourceEpisodes: SkillSourceEpisode[];
    files: SkillPackageFile[];
    sha256: string;
    changelog?: string;
    createdFrom?: string;
    timestamp: number;
  }): void {
    if (input.isActive) {
      this.db.prepare('UPDATE skill_versions SET is_active = 0 WHERE skill_id = ?').run(input.skillId);
    }
    this.db
      .prepare(
        `INSERT INTO skill_versions
          (id, skill_id, version, is_active, skill_md, package_json, workflow_json,
           evidence_json, source_episodes_json, files_json, sha256, changelog,
           created_from, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        input.skillId,
        input.version,
        input.isActive ? 1 : 0,
        input.skillMd,
        jsonStringify(input.packageJson),
        jsonStringify(input.workflow),
        jsonStringify(input.evidence),
        jsonStringify(input.sourceEpisodes),
        jsonStringify(input.files),
        input.sha256,
        input.changelog ?? null,
        input.createdFrom ?? null,
        input.timestamp,
        input.timestamp,
      );
  }

  private upsertBinding(
    skillId: string,
    input: {
      platform: string;
      state: SkillBindingState;
      installedVersion?: string;
      installedSha256?: string;
      remoteMtime?: number;
      lastSyncedAt?: number;
      lastError?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): SkillBindingRecord {
    const ts = now();
    this.db
      .prepare(
        `INSERT INTO skill_platform_bindings
          (id, skill_id, platform, state, installed_version, installed_sha256,
           remote_mtime, last_synced_at, last_error, metadata_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(skill_id, platform) DO UPDATE SET
           state = excluded.state,
           installed_version = excluded.installed_version,
           installed_sha256 = excluded.installed_sha256,
           remote_mtime = excluded.remote_mtime,
           last_synced_at = excluded.last_synced_at,
           last_error = excluded.last_error,
           metadata_json = excluded.metadata_json,
           updated_at = excluded.updated_at`,
      )
      .run(
        randomUUID(),
        skillId,
        input.platform,
        input.state,
        input.installedVersion ?? null,
        input.installedSha256 ?? null,
        input.remoteMtime ?? null,
        input.lastSyncedAt ?? null,
        input.lastError ?? null,
        jsonStringify(input.metadata || {}),
        ts,
        ts,
      );
    const row = this.db
      .prepare('SELECT * FROM skill_platform_bindings WHERE skill_id = ? AND platform = ?')
      .get(skillId, input.platform) as BindingRow;
    return toBindingRecord(row);
  }

  private buildPackage(input: {
    slug: string;
    title: string;
    summary: string;
    version: string;
    skillMd: string;
    workflow: SkillWorkflowStep[];
    evidence: SkillEvidenceRef[];
    sourceEpisodes: SkillSourceEpisode[];
    files: SkillPackageFile[];
  }): Record<string, unknown> {
    return {
      format: 'personal_skill_package',
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      version: input.version,
      skillMd: input.skillMd,
      workflow: input.workflow,
      evidence: input.evidence,
      sourceEpisodes: input.sourceEpisodes,
      files: input.files,
    };
  }

  private assertNoSecrets(version: SkillVersionRecord): void {
    const parts = [
      version.skillMd,
      JSON.stringify(version.packageJson),
      ...version.files.map((file) => file.content),
    ];
    for (const part of parts) {
      if (SECRET_PATTERNS.some((pattern) => pattern.test(part))) {
        throw new Error('Skill contains a value that looks like a secret. Remove or redact it before sharing.');
      }
    }
  }

  private insertSuggestionNotification(input: {
    skillId: string;
    title: string;
    summary: string;
    timestamp: number;
  }): void {
    this.db
      .prepare(
        `INSERT INTO notification_records
          (id, channel, type, title, body, payload_json, topic_id, utility_score, created_at)
         VALUES (?, 'notification_center', 'skill_suggestion', ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        `萃取出一条新技能建议：${input.title}`,
        input.summary,
        jsonStringify({
          skillId: input.skillId,
          actions: ['use', 'dismiss', 'snooze'],
        }),
        input.skillId,
        0.8,
        input.timestamp,
      );
  }
}
