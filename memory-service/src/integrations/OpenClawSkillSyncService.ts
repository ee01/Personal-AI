import type { OpenClawClient } from './OpenClawClient.js';

export interface OpenClawSkillListItem {
  slug: string;
  title?: string;
  description?: string;
  version?: string;
  sha256?: string;
  mtime?: number;
  filePaths?: string[];
}

export interface OpenClawSkillPackageFile {
  path: string;
  content: string;
  sha256?: string;
  byteSize?: number;
}

export interface OpenClawSkillPackage {
  slug: string;
  title?: string;
  description?: string;
  version?: string;
  sha256?: string;
  mtime?: number;
  skillMd: string;
  files: OpenClawSkillPackageFile[];
}

export interface OpenClawSkillUpsertPackage {
  slug: string;
  title: string;
  description?: string;
  version: string;
  sha256: string;
  skillMd: string;
  files: OpenClawSkillPackageFile[];
}

export interface OpenClawSkillUpsertResult {
  ok: boolean;
  slug: string;
  action?: 'installed' | 'updated' | 'noop';
  version?: string;
  sha256?: string;
  mtime?: number;
  notes?: string;
}

export interface OpenClawSkillListResult {
  ok: boolean;
  total: number | null;
  skills: OpenClawSkillListItem[];
  notes?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function rawStringValue(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') return value;
  }
  return undefined;
}

function numberValue(...values: unknown[]): number | undefined {
  for (const value of values) {
    const candidate = Number(value);
    if (Number.isFinite(candidate)) return Math.floor(candidate);
  }
  return undefined;
}

function stringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

function cleanJsonCandidate(raw: string): string {
  const trimmed = raw.trim();
  const fullFence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fullFence) return fullFence[1].trim();
  const jsonFence = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonFence) return jsonFence[1].trim();

  const objectStart = trimmed.indexOf('{');
  const objectEnd = trimmed.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1).trim();
  }

  return trimmed;
}

function parseJsonCandidate(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(cleanJsonCandidate(raw)) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `OpenClaw did not return strict JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function extractOutputText(raw: unknown): string {
  const record = asRecord(raw);
  if (!record) return '';
  if (typeof record.output_text === 'string' && record.output_text.trim()) {
    return record.output_text.trim();
  }

  const outputs = Array.isArray(record.output) ? record.output : [];
  const parts: string[] = [];
  for (const output of outputs) {
    const outputRecord = asRecord(output);
    if (!outputRecord) continue;
    const contentItems = Array.isArray(outputRecord.content)
      ? outputRecord.content
      : [];
    for (const content of contentItems) {
      const contentRecord = asRecord(content);
      if (!contentRecord) continue;
      const text = stringValue(contentRecord.text, contentRecord.content);
      if (text) parts.push(text);
    }
  }

  return parts.join('\n').trim();
}

function parseResponsesJson(data: unknown, fallbackText?: string): Record<string, unknown> {
  if (data && typeof data === 'object') {
    const outputText = extractOutputText(data);
    if (outputText) return parseJsonCandidate(outputText);
    const record = asRecord(data);
    if (record && ('ok' in record || 'skills' in record || 'skill' in record)) {
      return record;
    }
  }
  if (fallbackText?.trim()) return parseJsonCandidate(fallbackText);
  throw new Error('OpenClaw returned an empty response.');
}

function normalizeListItem(raw: unknown): OpenClawSkillListItem | null {
  const item = asRecord(raw);
  if (!item) return null;
  const slug = stringValue(item.slug, item.name, item.id);
  if (!slug) return null;
  return {
    slug,
    title: stringValue(item.title, item.displayName, item.name),
    description: stringValue(item.description, item.summary),
    version: stringValue(item.version, item.currentVersion),
    sha256: stringValue(item.sha256, item.hash, item.skillSha256, item.packageSha256),
    mtime: numberValue(item.mtime, item.remoteMtime, item.updatedAt, item.updated_at),
    filePaths: stringArrayValue(item.filePaths ?? item.files ?? item.paths),
  };
}

function normalizePackageFile(raw: unknown): OpenClawSkillPackageFile | null {
  const file = asRecord(raw);
  if (!file) return null;
  const relativePath = stringValue(file.path, file.relativePath, file.name);
  if (!relativePath) return null;
  const content = rawStringValue(file.content, file.text, file.body) ?? '';
  return {
    path: relativePath,
    content,
    sha256: stringValue(file.sha256, file.hash),
    byteSize: numberValue(file.byte_size, file.byteSize, file.size),
  };
}

function normalizePackage(raw: Record<string, unknown>): OpenClawSkillPackage {
  const skill = asRecord(raw.skill) ?? asRecord(raw.package) ?? raw;
  const slug = stringValue(skill.slug, skill.name, skill.id);
  if (!slug) throw new Error('OpenClaw skill package did not include a slug.');

  const rawFiles = Array.isArray(skill.files) ? skill.files : [];
  const files = rawFiles
    .map(normalizePackageFile)
    .filter((file): file is OpenClawSkillPackageFile => Boolean(file));
  const skillMd =
    rawStringValue(skill.skillMd, skill.skill_md, skill.SKILL_MD) ??
    files.find((file) => file.path === 'SKILL.md')?.content ??
    '';
  if (!skillMd.trim()) {
    throw new Error(`OpenClaw skill package '${slug}' did not include SKILL.md content.`);
  }

  return {
    slug,
    title: stringValue(skill.title, skill.displayName, skill.name),
    description: stringValue(skill.description, skill.summary),
    version: stringValue(skill.version, skill.currentVersion),
    sha256: stringValue(skill.sha256, skill.hash, skill.skillSha256, skill.packageSha256),
    mtime: numberValue(skill.mtime, skill.remoteMtime, skill.updatedAt, skill.updated_at),
    skillMd,
    files: files.filter((file) => file.path !== 'SKILL.md'),
  };
}

function normalizeUpsertResult(
  raw: Record<string, unknown>,
  fallback: OpenClawSkillUpsertPackage,
): OpenClawSkillUpsertResult {
  const result = asRecord(raw.skill) ?? asRecord(raw.result) ?? raw;
  const action = stringValue(result.action, result.status);
  return {
    ok: raw.ok !== false,
    slug: stringValue(result.slug, result.name, raw.slug) || fallback.slug,
    action:
      action === 'installed' || action === 'updated' || action === 'noop'
        ? action
        : undefined,
    version: stringValue(result.version, raw.version) || fallback.version,
    sha256:
      stringValue(result.sha256, result.hash, result.skillSha256, raw.sha256) ||
      fallback.sha256,
    mtime: numberValue(result.mtime, result.remoteMtime, result.updatedAt, raw.mtime),
    notes: stringValue(result.notes, raw.notes),
  };
}

export class OpenClawSkillSyncService {
  constructor(private readonly client: OpenClawClient) {}

  async listInstalledSkills(): Promise<OpenClawSkillListResult> {
    const response = await this.client.request({
      path: '/v1/responses',
      method: 'POST',
      body: {
        model: 'openclaw',
        input: [
          'Read-only Personal AI Skill Foundry sync.',
          'Do not create, update, delete, install, uninstall, write files, or modify anything.',
          'List installed OpenClaw skills only.',
          'Return strict JSON only, no markdown, with this shape:',
          '{"ok":true,"total":number|null,"skills":[{"slug":"string","title":"string","description":"string","version":"string","sha256":"string","mtime":number|null,"filePaths":["SKILL.md"]}],"notes":"string"}',
          'Use sha256 for the complete skill package if available; otherwise use SKILL.md sha256.',
        ].join('\n'),
      },
    });

    if (!response.ok) {
      throw new Error(`OpenClaw skill list failed with HTTP ${response.status}`);
    }

    const parsed = parseResponsesJson(response.data, response.text);
    const skillsRaw = Array.isArray(parsed.skills)
      ? parsed.skills
      : Array.isArray(parsed.items)
        ? parsed.items
        : [];
    const skills = skillsRaw
      .map(normalizeListItem)
      .filter((item): item is OpenClawSkillListItem => Boolean(item));
    return {
      ok: parsed.ok !== false,
      total: numberValue(parsed.total, parsed.installed_skill_count) ?? skills.length,
      skills,
      notes: stringValue(parsed.notes),
    };
  }

  async exportSkillPackage(slug: string): Promise<OpenClawSkillPackage> {
    const response = await this.client.request({
      path: '/v1/responses',
      method: 'POST',
      body: {
        model: 'openclaw',
        input: [
          'Read-only Personal AI Skill Foundry sync.',
          'Do not create, update, delete, install, uninstall, write files, or modify anything.',
          `Export the complete installed OpenClaw skill package for slug ${JSON.stringify(slug)}.`,
          'Return full file contents for SKILL.md, scripts, references, resources, and examples.',
          'Do not include secrets; redact sensitive values if present.',
          'Return strict JSON only, no markdown, with this shape:',
          '{"ok":true,"skill":{"slug":"string","title":"string","description":"string","version":"string","sha256":"string","mtime":number|null,"skillMd":"full SKILL.md text","files":[{"path":"scripts/example.py","content":"full content","sha256":"string","byte_size":number|null}]}}',
        ].join('\n'),
      },
    });

    if (!response.ok) {
      throw new Error(`OpenClaw skill export failed for ${slug} with HTTP ${response.status}`);
    }

    return normalizePackage(parseResponsesJson(response.data, response.text));
  }

  async upsertSkillPackage(
    pkg: OpenClawSkillUpsertPackage,
  ): Promise<OpenClawSkillUpsertResult> {
    const response = await this.client.request({
      path: '/v1/responses',
      method: 'POST',
      body: {
        model: 'openclaw',
        input: [
          'Personal AI Skill Foundry write sync.',
          'Create or update the installed OpenClaw skill from the package below.',
          'If a skill with the same slug exists, replace SKILL.md and included resource files with this package.',
          'If the installed package already has the same sha256, do nothing.',
          'Return strict JSON only, no markdown, with this shape:',
          '{"ok":true,"skill":{"slug":"string","action":"installed|updated|noop","version":"string","sha256":"string","mtime":number|null},"notes":"string"}',
          'PACKAGE_JSON:',
          JSON.stringify({
            slug: pkg.slug,
            title: pkg.title,
            description: pkg.description || '',
            version: pkg.version,
            sha256: pkg.sha256,
            skillMd: pkg.skillMd,
            files: pkg.files,
          }),
        ].join('\n'),
      },
    });

    if (!response.ok) {
      throw new Error(`OpenClaw skill upsert failed for ${pkg.slug} with HTTP ${response.status}`);
    }

    return normalizeUpsertResult(parseResponsesJson(response.data, response.text), pkg);
  }
}
