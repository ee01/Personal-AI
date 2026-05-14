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

function base64StringValue(...values: unknown[]): string | undefined {
  const encoded = stringValue(...values);
  if (!encoded) return undefined;
  try {
    return Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    return undefined;
  }
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

function escapeUnescapedJsonStringQuotes(value: string): string {
  let result = '';
  let backslashCount = 0;
  for (const char of value) {
    if (char === '"' && backslashCount % 2 === 0) {
      result += '\\"';
    } else {
      result += char;
    }
    backslashCount = char === '\\' ? backslashCount + 1 : 0;
  }
  return result;
}

function escapeInvalidJsonStringBackslashes(value: string): string {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== '\\') {
      result += char;
      continue;
    }

    const next = value[index + 1];
    if (!next) {
      result += '\\\\';
      continue;
    }
    if ('"\\/bfnrt'.includes(next)) {
      result += char;
      continue;
    }
    if (
      next === 'u' &&
      /^[0-9a-fA-F]{4}$/.test(value.slice(index + 2, index + 6))
    ) {
      result += char;
      continue;
    }
    result += '\\\\';
  }
  return result;
}

function decodeJsonEncodedString(value: string): string {
  const stringLiteral = escapeInvalidJsonStringBackslashes(
    escapeUnescapedJsonStringQuotes(value),
  )
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return JSON.parse(`"${stringLiteral}"`) as string;
}

function parseJsonCandidate(raw: string): Record<string, unknown> {
  let candidate = cleanJsonCandidate(raw);
  let firstError: unknown;
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch (error) {
      firstError ??= error;
      lastError = error;
    }

    let decoded: string | undefined;
    try {
      decoded = decodeJsonEncodedString(candidate);
    } catch {
      try {
        const decoded = decodeJsonEncodedString(raw.trim());
        if (typeof decoded === 'string' && decoded.trim()) {
          candidate = cleanJsonCandidate(decoded);
          continue;
        }
      } catch (error) {
        lastError = error;
        break;
      }
    }
    if (!decoded?.trim()) break;
    const nextCandidate = cleanJsonCandidate(decoded);
    if (nextCandidate === candidate) break;
    candidate = nextCandidate;
  }
  throw new Error(
    `OpenClaw did not return strict JSON: ${lastError instanceof Error ? lastError.message : firstError instanceof Error ? firstError.message : String(firstError)}`,
  );
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

  const choices = Array.isArray(record.choices) ? record.choices : [];
  for (const choice of choices) {
    const choiceRecord = asRecord(choice);
    const message = asRecord(choiceRecord?.message);
    if (!message) continue;
    const content = message.content;
    if (typeof content === 'string' && content.trim()) {
      parts.push(content.trim());
      continue;
    }
    const contentItems = Array.isArray(content) ? content : [];
    for (const item of contentItems) {
      const itemRecord = asRecord(item);
      if (!itemRecord) continue;
      const text = stringValue(itemRecord.text, itemRecord.content);
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
  const content =
    base64StringValue(file.contentBase64, file.content_base64, file.bodyBase64) ??
    rawStringValue(file.content, file.text, file.body) ??
    '';
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
    base64StringValue(skill.skillMdBase64, skill.skill_md_base64, skill.SKILL_MD_BASE64) ??
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

  private async requestReadJson(prompt: string, label: string): Promise<Record<string, unknown>> {
    const attempts = [
      {
        path: '/v1/chat/completions',
        body: {
          model: 'openclaw',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          stream: false,
        },
      },
      {
        path: '/v1/responses',
        body: {
          model: 'openclaw',
          input: prompt,
        },
      },
    ];
    let lastError: unknown;
    for (const attempt of attempts) {
      let response: Awaited<ReturnType<OpenClawClient['request']>>;
      try {
        response = await this.client.request({
          path: attempt.path,
          method: 'POST',
          body: attempt.body,
        });
      } catch (error) {
        lastError = error;
        continue;
      }
      if (!response.ok) {
        lastError = new Error(`${label} failed with HTTP ${response.status}`);
        continue;
      }
      return parseResponsesJson(response.data, response.text);
    }
    throw lastError instanceof Error ? lastError : new Error(`${label} failed.`);
  }

  private async requestResponsesJson(
    prompt: string,
    label: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.client.request({
      path: '/v1/responses',
      method: 'POST',
      body: {
        model: 'openclaw',
        input: prompt,
      },
    });
    if (!response.ok) {
      throw new Error(`${label} failed with HTTP ${response.status}`);
    }
    return parseResponsesJson(response.data, response.text);
  }

  async listInstalledSkills(): Promise<OpenClawSkillListResult> {
    const parsed = await this.requestReadJson(
      [
        'Read-only Personal AI Skill Foundry sync.',
        'Do not create, update, delete, install, uninstall, write files, or modify anything.',
        'Discover all installed OpenClaw-visible skills.',
        'Do not rely only on available_skills metadata; also inspect skill directory names and SKILL.md headings/descriptions if accessible.',
        'Check common OpenClaw skill roots if accessible: ~/.openclaw/skills, ~/git/openclaw/skills, ~/.agents/skills, ~/.codex/skills.',
        'Include every directory that contains SKILL.md. Do not read scripts, resources, examples, or full file contents during this list step.',
        'Return strict JSON only, no markdown, with this shape:',
        '{"ok":true,"total":number|null,"skills":[{"slug":"string","title":"string","description":"string","version":"string","sha256":"string","mtime":number|null,"filePaths":["SKILL.md"],"path":"string"}],"notes":"string"}',
        'If sha256 or mtime is expensive, omit it here; the package export step will compute content details.',
      ].join('\n'),
      'OpenClaw skill list',
    );
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
    const parsed = await this.requestReadJson(
      [
        'Read-only Personal AI Skill Foundry sync.',
        'Do not create, update, delete, install, uninstall, write files, or modify anything.',
        `Export the complete installed OpenClaw skill package for slug ${JSON.stringify(slug)}.`,
        'Read only the matching installed skill directory.',
        'Return SKILL.md and each included file as UTF-8 base64 so JSON stays valid even when content contains quotes, markdown tables, or newlines.',
        'Include scripts, references, resources, and examples only when they are small and directly belong to this skill; omit large secondary files instead of summarizing them.',
        'Do not include secrets; redact sensitive values if present.',
        'Return strict minified JSON only, no markdown, no code fence, no language wrapper, no records/logs/evidence/source arrays, no ellipsis placeholders.',
        'Top-level keys must be exactly ok and skill.',
        'The output must start with {"ok":true and end with }}.',
        'Use this exact shape:',
        '{"ok":true,"skill":{"slug":"string","title":"string","description":"string","version":"string","sha256":"string","mtime":number|null,"skillMdBase64":"base64 UTF-8 SKILL.md","files":[{"path":"scripts/example.py","contentBase64":"base64 UTF-8 content","sha256":"string","byte_size":number|null}]}}',
      ].join('\n'),
      `OpenClaw skill export for ${slug}`,
    );
    return normalizePackage(parsed);
  }

  async upsertSkillPackage(
    pkg: OpenClawSkillUpsertPackage,
  ): Promise<OpenClawSkillUpsertResult> {
    const parsed = await this.requestResponsesJson(
      [
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
      `OpenClaw skill upsert for ${pkg.slug}`,
    );
    return normalizeUpsertResult(parsed, pkg);
  }
}
