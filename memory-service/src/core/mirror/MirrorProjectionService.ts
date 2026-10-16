/**
 * Markdown Git Mirror — Phase 0 projection renderer (plan §4.1/§4.2).
 *
 * The projection is a deterministic, rebuildable, human-readable Markdown view
 * of the distilled memory. It is NOT the source of truth (SQLite is), and it
 * must never contain raw message text, tokens, secrets, config.json, or
 * restricted fields. Every candidate row is passed through the shared
 * EgressPolicyEngine before it is rendered (plan §4.4).
 */

import { createHash } from 'node:crypto';
import type BetterSqlite3 from 'better-sqlite3';

import {
  EgressPolicyEngine,
  type AclCheckResult,
  type EgressPolicy,
  type Sensitivity,
} from '../v3/EgressPolicyEngine.js';

export type MirrorScope = 'all' | 'self_only';

export interface MirrorFile {
  path: string;
  content: string;
  hash: string;
  encoding?: 'utf-8' | 'base64';
}

export interface MirrorExclusion {
  reason: string;
  count: number;
}

export interface MirrorReceipt {
  generatedAt: string;
  scope: MirrorScope;
  filesTotal: number;
  excludedByPolicy: number;
  excludedByScope: number;
  exclusions: MirrorExclusion[];
  counts: {
    preferences: number;
    facts: number;
    decisions: number;
    superseded: number;
    openLoopsClosed: number;
  };
  commitMessage: string;
}

export interface MirrorRenderResult {
  files: MirrorFile[];
  receipt: MirrorReceipt;
}

export interface MirrorRenderOptions {
  scope?: MirrorScope;
  now?: Date;
  /** Auto-committed file paths for the projection version header. */
  projectionVersion?: string;
}

const MIRROR_DESTINATION = {
  destinationHost: 'github.com',
  modelProvider: null,
  purpose: 'backup_mirror',
} as const;

const KNOWN_SENSITIVITIES: readonly string[] = ['public', 'internal', 'private', 'restricted'];
const KNOWN_EGRESS_POLICIES: readonly string[] = [
  'local_only',
  'approved_destinations',
  'user_selected',
];

/** Keys whose values must never leave the boundary, however they were confirmed. */
const SECRET_KEY_PATTERN =
  /(password|passwd|passphrase|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential|jwt|cookie|authorization|bearer)/i;
/** Common credential value shapes (GitHub PATs, OpenAI/Anthropic keys, PAKs, AWS, Google). */
const SECRET_VALUE_PATTERN =
  /\b(ghp_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,}|sk-[A-Za-z0-9]{16,}|sk_ant-[A-Za-z0-9_]{16,}|pak\.[A-Za-z0-9._-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,})/;

export function looksLikeSecret(key: string, value: string): boolean {
  return SECRET_KEY_PATTERN.test(key) || SECRET_VALUE_PATTERN.test(value);
}

const KNOWLEDGE_KINDS: Record<string, string> = {
  fact: 'facts',
  preference: 'preferences',
  decision: 'decisions',
};

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf-8').digest('hex');
}

export function slugifyMirrorName(input: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug.slice(0, 64) || 'unnamed';
}

function yamlList(values: string[]): string {
  if (values.length === 0) return '[]';
  return `[${values.map((value) => JSON.stringify(value)).join(', ')}]`;
}

function isoDay(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function safeAll<T>(
  db: BetterSqlite3.Database,
  sql: string,
  params: unknown[] = [],
): T[] {
  try {
    return db.prepare(sql).all(...params) as T[];
  } catch {
    return [];
  }
}

function tableExists(db: BetterSqlite3.Database, name: string): boolean {
  try {
    const row = db
      .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name=?`)
      .get(name) as { ok?: number } | undefined;
    return Boolean(row?.ok);
  } catch {
    return false;
  }
}

function jsonArray(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

/**
 * Evaluate one row against the shared egress gate. Fail-closed: a row with a
 * missing or unknown sensitivity/egress policy is DENIED, never defaulted
 * through (plan §4.4, EgressPolicyEngine I10).
 */
export function evaluateMirrorEgress(
  userId: string,
  row: { sensitivity?: string | null; egressPolicy?: string | null; status?: string | null },
  tenantId = 'default',
): AclCheckResult {
  const sensitivity = row.sensitivity ?? null;
  const egressPolicy = row.egressPolicy ?? null;
  if (
    !sensitivity ||
    !KNOWN_SENSITIVITIES.includes(sensitivity) ||
    !egressPolicy ||
    !KNOWN_EGRESS_POLICIES.includes(egressPolicy)
  ) {
    return {
      allowed: false,
      reason: 'fail_closed_missing_or_unknown_policy',
      sensitivity: 'restricted',
      effectiveEgress: 'local_only',
    };
  }
  return EgressPolicyEngine.checkRead(
    { tenantId, userId, scope: 'user' },
    {
      tenantId,
      ownerUserId: userId,
      sensitivity: sensitivity as Sensitivity,
      egressPolicy: egressPolicy as EgressPolicy,
      scopeLocator: null,
      status: row.status ?? 'active',
    },
    MIRROR_DESTINATION,
  );
}

interface UnitRow {
  id: string;
  kind: string;
  status: string;
  subject_key: string | null;
  predicate_key: string | null;
  text: string;
  evidence_class: string | null;
  origin_class: string | null;
  observed_at: number | null;
  created_at: number;
  sensitivity: string;
  egress_policy: string;
  confirmation_state: string;
  confidence: number;
  superseded_by: string | null;
  source_count: number;
}

interface EntityRow {
  id: string;
  type: string;
  name: string;
  aliases_json: string | null;
  description: string | null;
  importance: number;
  last_seen: number | null;
}

interface PropertyRow {
  property_key: string;
  property_value: string;
  value_type: string | null;
  source_authority: string | null;
  confidence: number | null;
  valid_from: number | null;
}

interface ProfileRow {
  id: string;
  item_type: string;
  item_key: string;
  item_value: string;
  confidence: number;
  user_confirmed: number;
}

const ENTITY_DIRS: Record<string, string> = {
  person: 'people',
  people: 'people',
  organization: 'orgs',
  organizations: 'orgs',
  org: 'orgs',
  project: 'projects',
  topic: 'topics',
  technology: 'technologies',
};

export class MirrorProjectionService {
  constructor(
    private readonly db: BetterSqlite3.Database,
    private readonly userId: string,
    private readonly tenantId = 'default',
  ) {}

  /**
   * Render the full projection. Pure with respect to SQLite: calling it twice
   * with the same data produces byte-identical files (plan §7 rebuild case).
   */
  render(options: MirrorRenderOptions = {}): MirrorRenderResult {
    const scope: MirrorScope = options.scope === 'self_only' ? 'self_only' : 'all';
    const generatedAt = (options.now ?? new Date()).toISOString();
    const files: MirrorFile[] = [];
    const exclusions = new Map<string, number>();
    const counts = {
      preferences: 0,
      facts: 0,
      decisions: 0,
      superseded: 0,
      openLoopsClosed: 0,
    };
    let excludedByScope = 0;

    const recordExclusion = (reason: string): void => {
      exclusions.set(reason, (exclusions.get(reason) ?? 0) + 1);
    };

    const push = (path: string, content: string): void => {
      const normalized = content.endsWith('\n') ? content : `${content}\n`;
      files.push({ path, content: normalized, hash: sha256(normalized) });
    };

    // -- profile -----------------------------------------------------------
    push('profile/USER_CORE.md', this.renderUserCore(scope, generatedAt, recordExclusion));
    push('profile/one-pager.md', this.renderOnePager(scope, generatedAt));

    // -- entities ----------------------------------------------------------
    for (const entity of this.loadEntities(scope, recordExclusion)) {
      const file = this.renderEntity(entity, scope, recordExclusion);
      if (file) {
        push(`entities/${file.dir}/${file.slug}.md`, file.content);
      }
    }

    // -- knowledge ---------------------------------------------------------
    const includedUnits: UnitRow[] = [];
    for (const unit of this.loadUnits(scope)) {
      const gate = evaluateMirrorEgress(this.userId, {
        sensitivity: unit.sensitivity,
        egressPolicy: unit.egress_policy,
        status: unit.status,
      });
      if (!gate.allowed) {
        recordExclusion(gate.reason ?? 'policy_denied');
        continue;
      }
      if (scope === 'self_only' && unit.origin_class !== 'owner') {
        excludedByScope += 1;
        continue;
      }
      includedUnits.push(unit);
      const bucket = KNOWLEDGE_KINDS[unit.kind];
      if (!bucket) continue;
      if (unit.kind === 'preference') counts.preferences += 1;
      if (unit.kind === 'fact') counts.facts += 1;
      if (unit.kind === 'decision') counts.decisions += 1;
      if (unit.status === 'superseded') counts.superseded += 1;
      push(`knowledge/${bucket}/${slugifyMirrorName(unit.id)}.md`, this.renderUnit(unit));
    }

    // -- workstreams -------------------------------------------------------
    for (const stream of this.loadWorkstreams(scope, recordExclusion)) {
      if (stream.status === 'completed') counts.openLoopsClosed += 1;
      push(`workstreams/${stream.status}/${stream.slug}.md`, stream.content);
    }

    // -- timeline ----------------------------------------------------------
    for (const day of this.loadDailyTimeline(includedUnits)) {
      push(`timeline/daily/${day.day}.md`, day.content);
    }

    // -- consolidation diary ----------------------------------------------
    push('consolidation/DIARY.md', this.renderDiary());

    // -- interop -----------------------------------------------------------
    if (tableExists(this.db, 'memory_units')) {
      for (const file of this.renderInterop(scope, generatedAt, recordExclusion)) {
        push(file.path, file.content);
      }
    }

    // -- MIRROR declaration ------------------------------------------------
    push('MIRROR.md', this.renderMirrorDoc(scope, generatedAt, options.projectionVersion));

    const exclusionsList: MirrorExclusion[] = [...exclusions.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => a.reason.localeCompare(b.reason));
    const excludedByPolicy = exclusionsList.reduce((sum, item) => sum + item.count, 0);

    files.sort((a, b) => a.path.localeCompare(b.path));

    return {
      files,
      receipt: {
        generatedAt,
        scope,
        filesTotal: files.length,
        excludedByPolicy,
        excludedByScope,
        exclusions: exclusionsList,
        counts,
        commitMessage: this.buildCommitMessage(generatedAt, counts),
      },
    };
  }

  private buildCommitMessage(
    generatedAt: string,
    counts: MirrorReceipt['counts'],
  ): string {
    const date = generatedAt.slice(0, 10);
    return [
      `memory mirror ${date}:`,
      `+${counts.preferences} preferences,`,
      `${counts.superseded} superseded,`,
      `${counts.openLoopsClosed} open loops closed`,
    ].join(' ');
  }

  // ---------------------------------------------------------------------
  // profile
  // ---------------------------------------------------------------------

  private renderUserCore(
    scope: MirrorScope,
    _generatedAt: string,
    exclude: (r: string) => void,
  ): string {
    const rows = safeAll<ProfileRow>(
      this.db,
      `SELECT id, item_type, item_key, item_value, confidence, user_confirmed
         FROM user_profile_items
        WHERE status='active' AND user_confirmed=1
        ORDER BY item_type, item_key`,
    );
    const body: string[] = [
      '---',
      'view: user_core',
      'source: sqlite://user_profile_items (user_confirmed=1)',
      '---',
      '',
      '# USER CORE',
      '',
      '> 这是从本地 SQLite 真源投影出的画像视图，不是全量备份。',
      '',
    ];
    let rendered = 0;
    for (const row of rows) {
      const gate = evaluateMirrorEgress(this.userId, {
        sensitivity: 'internal',
        egressPolicy: 'approved_destinations',
        status: 'active',
      });
      if (!gate.allowed) {
        exclude(gate.reason ?? 'policy_denied');
        continue;
      }
      // self_only keeps confirmed profile items (they describe the owner).
      if (scope === 'self_only' && row.item_type === 'fact' && /other|他人/.test(row.item_key)) {
        continue;
      }
      if (looksLikeSecret(row.item_key, row.item_value)) {
        // user_confirmed=1 is NOT egress authorization for credential fields.
        exclude('secret_field_redacted');
        continue;
      }
      rendered += 1;
      body.push(`- **${row.item_key}** (${row.item_type}): ${row.item_value}`);
    }
    if (rendered === 0) body.push('_暂无已确认的画像条目。_');
    body.push('');
    return body.join('\n');
  }

  private renderOnePager(scope: MirrorScope, _generatedAt: string): string {
    void scope;
    const header = [
      '---',
      'view: one_pager',
      'source: reconcile_artifacts(kind=one_pager)',
      '---',
      '',
      '# 一页纸 / One-pager',
      '',
    ];
    if (tableExists(this.db, 'reconcile_artifacts')) {
      const row = safeAll<{ content: string; egress_policy: string; sensitivity: string }>(
        this.db,
        `SELECT content, egress_policy, sensitivity
           FROM reconcile_artifacts
          WHERE owner_user_id=? AND kind='one_pager'
          ORDER BY created_at DESC LIMIT 1`,
        [this.userId],
      )[0];
      if (row) {
        const gate = evaluateMirrorEgress(this.userId, {
          sensitivity: row.sensitivity,
          egressPolicy: row.egress_policy,
          status: 'active',
        });
        if (gate.allowed) {
          if (this.onePagerIsSelfOnly(row.content)) {
            return [...header, row.content].join('\n');
          }
        }
      }
    }
    // Deterministic fallback: derive a minimal one-pager from confirmed
    // profile items so Phase 0 is useful before sleep-time B lands.
    const rows = safeAll<ProfileRow>(
      this.db,
      `SELECT id, item_type, item_key, item_value, confidence, user_confirmed
         FROM user_profile_items
        WHERE status='active' AND user_confirmed=1
        ORDER BY salience_score DESC, item_key
        LIMIT 20`,
    );
    const body = [...header];
    if (rows.length === 0) {
      body.push('_一页纸尚未生成；睡眠期整理产出后会自动填充。_');
    } else {
      for (const row of rows) {
        if (looksLikeSecret(row.item_key, row.item_value)) continue;
        body.push(`- ${row.item_key}: ${row.item_value}`);
      }
    }
    body.push('');
    return body.join('\n');
  }

  private onePagerIsSelfOnly(content: string): boolean {
    return !/他人|third[- ]party/i.test(content);
  }

  // ---------------------------------------------------------------------
  // entities
  // ---------------------------------------------------------------------

  private loadEntities(
    scope: MirrorScope,
    exclude: (r: string) => void,
  ): EntityRow[] {
    if (scope === 'self_only') return [];
    const rows = safeAll<EntityRow>(
      this.db,
      `SELECT id, type, name, aliases_json, description, importance, last_seen
         FROM entities
        WHERE status='active' AND merged_into IS NULL
        ORDER BY importance DESC, name
        LIMIT 500`,
    );
    const hasEdge = tableExists(this.db, 'social_edges');
    const out: EntityRow[] = [];
    for (const row of rows) {
      const dir = ENTITY_DIRS[(row.type || '').toLowerCase()];
      if (!dir) continue;
      const gate = evaluateMirrorEgress(this.userId, {
        sensitivity: 'internal',
        egressPolicy: 'approved_destinations',
        status: 'active',
      });
      if (!gate.allowed) {
        exclude(gate.reason ?? 'policy_denied');
        continue;
      }
      if (dir === 'people') {
        if (!hasEdge) continue;
        const edge = safeAll<{ n: number }>(
          this.db,
          `SELECT COUNT(*) AS n FROM social_edges
            WHERE user_confirmed=1 AND (from_entity_id=? OR to_entity_id=?)`,
          [row.id, row.id],
        )[0];
        if (!edge || edge.n === 0) continue;
      }
      out.push(row);
    }
    return out;
  }

  private renderEntity(
    entity: EntityRow,
    _scope: MirrorScope,
    exclude: (r: string) => void,
  ): { dir: string; slug: string; content: string } | null {
    const dir = ENTITY_DIRS[(entity.type || '').toLowerCase()];
    if (!dir) return null;
    const aliases = jsonArray(entity.aliases_json);
    const props = safeAll<PropertyRow>(
      this.db,
      `SELECT property_key, property_value, value_type, source_authority, confidence, valid_from
         FROM entity_properties
        WHERE entity_id=? AND status='active' AND tx_end IS NULL
        ORDER BY property_key, valid_from DESC`,
      [entity.id],
    );
    const latest = new Map<string, PropertyRow>();
    for (const prop of props) {
      if (!latest.has(prop.property_key)) latest.set(prop.property_key, prop);
    }
    const lines = [
      '---',
      `id: ${entity.id}`,
      `type: ${(entity.type || '').toLowerCase()}`,
      `name: ${JSON.stringify(entity.name)}`,
      `aliases: ${yamlList(aliases)}`,
      `importance: ${Number(entity.importance ?? 0.5).toFixed(2)}`,
      entity.last_seen ? `last_seen: ${isoDay(entity.last_seen)}` : null,
      '---',
      '',
      `# ${entity.name}`,
      '',
    ].filter((line): line is string => line !== null);
    if (entity.description && !looksLikeSecret('description', entity.description)) {
      lines.push(entity.description, '');
    }
    if (latest.size > 0) {
      lines.push('## 属性', '');
      for (const [key, value] of latest) {
        // A confirmed relationship does not authorize exporting credential
        // fields of another person (or of the user) to the mirror.
        if (looksLikeSecret(key, value.property_value)) {
          exclude('secret_field_redacted');
          continue;
        }
        lines.push(`- **${key}**: ${value.property_value}`);
      }
      lines.push('');
    }
    const relations = safeAll<{ relation_type: string; other: string }>(
      this.db,
      `SELECT r.relation_type AS relation_type,
              CASE WHEN r.from_entity_id=? THEN e2.name ELSE e1.name END AS other
         FROM relationships r
         JOIN entities e1 ON e1.id=r.from_entity_id
         JOIN entities e2 ON e2.id=r.to_entity_id
        WHERE r.from_entity_id=? OR r.to_entity_id=?
        ORDER BY r.strength DESC
        LIMIT 20`,
      [entity.id, entity.id, entity.id],
    );
    if (relations.length > 0) {
      lines.push('## 关系', '');
      for (const rel of relations) {
        lines.push(`- ${rel.relation_type}: [[${slugifyMirrorName(rel.other)}]]`);
      }
      lines.push('');
    }
    return { dir, slug: slugifyMirrorName(entity.name), content: lines.join('\n') };
  }

  // ---------------------------------------------------------------------
  // knowledge
  // ---------------------------------------------------------------------

  private loadUnits(scope: MirrorScope): UnitRow[] {
    if (!tableExists(this.db, 'memory_units')) return [];
    const selfFilter = scope === 'self_only' ? `AND s.origin_class='owner'` : '';
    return safeAll<UnitRow>(
      this.db,
      `SELECT u.id, u.kind, u.status, u.subject_key, u.predicate_key, u.text,
              MAX(s.evidence_class) AS evidence_class,
              MAX(s.origin_class) AS origin_class,
              u.observed_at, u.created_at, u.sensitivity, u.egress_policy,
              u.confirmation_state, u.confidence,
              u.superseded_by,
              COUNT(DISTINCT s.episode_id) AS source_count
         FROM memory_units u
         JOIN memory_unit_sources s ON s.unit_id=u.id
        WHERE u.tenant_id=? AND u.owner_user_id=?
          AND u.status IN ('active','superseded')
          AND s.promotion_eligible=1
          ${selfFilter}
        GROUP BY u.id
        ORDER BY u.kind, coalesce(u.observed_at, u.created_at) DESC
        LIMIT 2000`,
      [this.tenantId, this.userId],
    );
  }

  private renderUnit(unit: UnitRow): string {
    const lines = [
      '---',
      `id: ${unit.id}`,
      `kind: ${unit.kind}`,
      `status: ${unit.status}`,
      `evidence_class: ${unit.evidence_class ?? 'self_statement'}`,
      `evidence_sources: ${unit.source_count}`,
      unit.observed_at ? `observed_at: ${isoDay(unit.observed_at)}` : 'observed_at: null',
      unit.subject_key ? `subject: ${JSON.stringify(unit.subject_key)}` : null,
      unit.predicate_key ? `predicate: ${JSON.stringify(unit.predicate_key)}` : null,
      unit.superseded_by ? `supersedes_by: ${unit.superseded_by}` : null,
      `confidence: ${Number(unit.confidence ?? 0.5).toFixed(2)}`,
      '---',
      '',
      unit.text,
      '',
    ].filter((line): line is string => line !== null);
    return lines.join('\n');
  }

  // ---------------------------------------------------------------------
  // workstreams
  // ---------------------------------------------------------------------

  private loadWorkstreams(
    scope: MirrorScope,
    exclude: (r: string) => void,
  ): Array<{ slug: string; status: 'active' | 'completed'; content: string }> {
    const out: Array<{ slug: string; status: 'active' | 'completed'; content: string }> = [];
    if (scope === 'all') {
      const projects = safeAll<{ id: string; name: string; description: string | null }>(
        this.db,
        `SELECT id, name, description FROM watched_projects WHERE is_active=1 ORDER BY priority, name LIMIT 200`,
      );
      for (const project of projects) {
        const gate = evaluateMirrorEgress(this.userId, {
          sensitivity: 'internal',
          egressPolicy: 'approved_destinations',
          status: 'active',
        });
        if (!gate.allowed) {
          exclude(gate.reason ?? 'policy_denied');
          continue;
        }
        out.push({
          slug: slugifyMirrorName(project.name),
          status: 'active',
          content: [
            '---',
            `id: ${project.id}`,
            'kind: watched_project',
            'status: active',
            '---',
            '',
            `# ${project.name}`,
            '',
            project.description || '_无描述_',
            '',
          ].join('\n'),
        });
      }
    }
    if (tableExists(this.db, 'attention_items')) {
      const items = safeAll<{
        id: string;
        kind: string;
        title: string;
        status: string;
        due_at: number;
        source_unit_id: string | null;
      }>(
        this.db,
        `SELECT id, kind, title, status, due_at, source_unit_id
           FROM attention_items
          WHERE user_id=? AND status IN ('candidate','proposed','armed','completed')
          ORDER BY due_at DESC LIMIT 500`,
        [this.userId],
      );
      for (const item of items) {
        const gate = evaluateMirrorEgress(this.userId, {
          sensitivity: 'internal',
          egressPolicy: 'approved_destinations',
          status: 'active',
        });
        if (!gate.allowed) {
          exclude(gate.reason ?? 'policy_denied');
          continue;
        }
        const completed = item.status === 'completed';
        out.push({
          slug: slugifyMirrorName(`${item.kind}-${item.title}-${item.id}`),
          status: completed ? 'completed' : 'active',
          content: [
            '---',
            `id: ${item.id}`,
            `kind: ${item.kind}`,
            `status: ${completed ? 'completed' : 'active'}`,
            `due_at: ${isoDay(item.due_at) ?? 'null'}`,
            item.source_unit_id ? `source_unit: ${item.source_unit_id}` : null,
            '---',
            '',
            `# ${item.title}`,
            '',
          ]
            .filter((line): line is string => line !== null)
            .join('\n'),
        });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------
  // timeline
  // ---------------------------------------------------------------------

  private loadDailyTimeline(
    units: UnitRow[],
  ): Array<{ day: string; content: string }> {
    const grouped = new Map<string, UnitRow[]>();
    for (const unit of units) {
      const day = isoDay(unit.observed_at ?? unit.created_at);
      if (!day) continue;
      const list = grouped.get(day) ?? [];
      list.push(unit);
      grouped.set(day, list);
    }
    const days = [...grouped.keys()].sort().reverse().slice(0, 30);
    return days.map((day) => {
      const rows = grouped.get(day) ?? [];
      const kinds = [...new Set(rows.map((row) => row.kind))].sort().join(',');
      const body = [
        '---',
        `day: ${day}`,
        'view: timeline_daily',
        'note: 仅含派生 unit 链接，不含原文',
        '---',
        '',
        `# ${day}`,
        '',
        `新增 unit：${rows.length}（${kinds}）`,
        '',
      ];
      for (const unit of rows) {
        const bucket = KNOWLEDGE_KINDS[unit.kind];
        if (bucket) body.push(`- [[knowledge/${bucket}/${slugifyMirrorName(unit.id)}]]`);
      }
      body.push('');
      return { day, content: body.join('\n') };
    });
  }

  // ---------------------------------------------------------------------
  // consolidation diary
  // ---------------------------------------------------------------------

  private renderDiary(): string {
    const lines = [
      '---',
      'view: consolidation_diary',
      'source: unit_reconcile_decisions(phase=B)',
      '---',
      '',
      '# 巩固日志 / Consolidation DIARY',
      '',
      '> 每晚睡眠期整理对真值的判决计数（新增 / 合并 / 替换 / 争议）。',
      '',
    ];
    if (!tableExists(this.db, 'unit_reconcile_decisions')) {
      lines.push('_睡眠期整理尚未运行。_', '');
      return lines.join('\n');
    }
    const rows = safeAll<{ day: string; decision: string; n: number }>(
      this.db,
      `SELECT date(coalesce(decided_at, created_at),'unixepoch') AS day,
              decision, COUNT(*) AS n
         FROM unit_reconcile_decisions
        WHERE owner_user_id=? AND phase='B' AND state IN ('applied','shadow')
          AND decision IS NOT NULL
        GROUP BY day, decision
        ORDER BY day DESC LIMIT 60`,
      [this.userId],
    );
    if (rows.length === 0) {
      lines.push('_暂无判决记录。_', '');
      return lines.join('\n');
    }
    const byDay = new Map<string, Record<string, number>>();
    for (const row of rows) {
      const bucket = byDay.get(row.day) ?? {};
      bucket[row.decision] = Number(row.n);
      byDay.set(row.day, bucket);
    }
    for (const [day, decisions] of byDay) {
      lines.push(`## ${day}`);
      for (const decision of ['corroborate', 'refine', 'supersede', 'dispute', 'noop']) {
        if (decisions[decision]) {
          lines.push(`- ${decision}: ${decisions[decision]}`);
        }
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  // ---------------------------------------------------------------------
  // interop/openclaw (mode A: read-only, confirmed + scope=self only)
  // ---------------------------------------------------------------------

  private renderInterop(
    scope: MirrorScope,
    _generatedAt: string,
    exclude: (r: string) => void,
  ): MirrorFile[] {
    // Interop is always self_only by contract regardless of the global scope.
    void scope;
    const units = this.loadUnits('self_only');
    const preferences: Array<{ id: string; text: string }> = [];
    const memories: Array<{ id: string; text: string }> = [];
    for (const unit of units) {
      if (unit.status !== 'active') continue;
      // Interop carries only explicitly user-confirmed self facts (plan §4.8
      // mode A): unconfirmed inferences must not reach another agent.
      if (unit.confirmation_state !== 'user_confirmed') {
        exclude('interop_requires_user_confirmation');
        continue;
      }
      const gate = evaluateMirrorEgress(this.userId, {
        sensitivity: unit.sensitivity,
        egressPolicy: unit.egress_policy,
        status: unit.status,
      });
      if (!gate.allowed) {
        exclude(gate.reason ?? 'policy_denied');
        continue;
      }
      const line = `${unit.text} <!-- pai:unit:${unit.id} -->`;
      if (unit.kind === 'preference') preferences.push({ id: unit.id, text: line });
      else if (unit.kind === 'fact' || unit.kind === 'decision') {
        memories.push({ id: unit.id, text: line });
      }
    }
    const header = (title: string, note: string): string[] => [
      '---',
      'view: openclaw_interop',
      'scope: self_only',
      '---',
      '',
      `# ${title}`,
      '',
      `> ${note}`,
      '',
      '> 只读子集：仅含用户已确认的自我事实；`pai:unit` 标记用于回流时去回声。',
      '',
    ];
    const files: MirrorFile[] = [];
    const build = (path: string, content: string): void => {
      const normalized = content.endsWith('\n') ? content : `${content}\n`;
      files.push({ path, content: normalized, hash: sha256(normalized) });
    };
    build(
      'interop/openclaw/PERSONAL_AI.md',
      [
        ...header('Personal AI → OpenClaw', '由 Personal AI 每晚投影；请勿把 OpenClaw workspace 直接指向本目录。'),
        '本目录为个人 AI 记忆的只读投影，模式 A（只读消费）。',
        '',
      ].join('\n'),
    );
    build(
      'interop/openclaw/USER.md',
      [...header('USER', '用户确认的自我画像与偏好。'), ...preferences.map((p) => `- ${p.text}`), ''].join('\n'),
    );
    build(
      'interop/openclaw/MEMORY.md',
      [...header('MEMORY', '用户确认的事实与决定。'), ...memories.map((m) => `- ${m.text}`), ''].join('\n'),
    );
    return files;
  }

  private renderMirrorDoc(
    scope: MirrorScope,
    _generatedAt: string,
    projectionVersion?: string,
  ): string {
    // No runtime timestamp here: MIRROR.md must be byte-stable across
    // re-renders of the same truth (plan §7 rebuild case). The generation
    // time lives only in the run receipt (mirror_runs), not in any file.
    const scopeLabel = scope === 'self_only' ? '只镜像关于我的内容' : '全部已确认内容';
    return [
      '---',
      'view: mirror_declaration',
      `scope: ${scope}`,
      `projection_version: ${projectionVersion ?? '1'}`,
      '---',
      '',
      '# MIRROR',
      '',
      '本仓库是 **Personal AI 记忆的 Markdown 投影**，不是全量备份。',
      '',
      '## 本次投影包含',
      '',
      '- `profile/`：常驻画像与一页纸（仅 `user_confirmed=1`）',
      '- `entities/`：人物 / 组织 / 项目 / 主题（他人仅含已确认关系）',
      '- `knowledge/`：原子 fact / preference / decision（`promotion_eligible`）',
      '- `workstreams/`：关注项与注意力账本',
      '- `timeline/`：每日派生 unit 链接（**不含原文**）',
      '- `consolidation/DIARY.md`：夜间整理判决计数',
      '- `interop/openclaw/`：只读互通子集（仅已确认自我事实）',
      '',
      '## 未包含什么',
      '',
      '- 原始消息原文、附件、SQLite 数据库、`config.json`、token / 密钥',
      '- `local_only`、`private`、`restricted` 敏感级别的条目',
      '- 未经确认（`user_confirmed=0`）或不可晋升（`promotion_eligible=0`）的内容',
      '',
      '## 过滤策略',
      '',
      `- 范围：${scopeLabel}`,
      '- 目的地：`github.com`，用途：`backup_mirror`，逐条经 `EgressPolicyEngine` 评估',
      '- 未变文件不重传；远端手改不被覆盖，冲突保留在 `conflict-<date>/`',
      '- 永不 force push',
      '',
      '## 恢复',
      '',
      '**这不是全量备份。** 全量恢复请使用加密 zip 备份通道。删除权的传播：本目录删除后，',
      '其他 agent（OpenClaw / Hermes）侧的历史需要在其本地执行遗忘操作。',
      '',
    ].join('\n');
  }
}

/**
 * Convenience wrapper used by the mirror runner and evals.
 */
export function renderMirrorProjection(
  db: BetterSqlite3.Database,
  userId: string,
  options: MirrorRenderOptions & { tenantId?: string } = {},
): MirrorRenderResult {
  return new MirrorProjectionService(db, userId, options.tenantId ?? 'default').render(options);
}
