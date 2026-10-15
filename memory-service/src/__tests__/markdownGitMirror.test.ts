/**
 * Markdown Git Mirror evals (plan §7).
 *
 * Six case groups:
 *   1. projection contains no raw text / token / secret / restricted fields
 *   2. self_only excludes other people's sensitive facts
 *   3. increment: unchanged files are never re-pushed
 *   4. conflict: a remote hand-edit is preserved, not overwritten
 *   5. rebuild: re-rendering produces a byte-identical projection
 *   6. interop: OpenClaw reads confirmed preferences; echo markers survive;
 *      no escalation (no other people's facts, no observed content)
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import type BetterSqlite3 from 'better-sqlite3';

import { cleanupTestDb, getTestDb } from './setup.js';
import { renderMirrorProjection } from '../core/mirror/MirrorProjectionService.js';
import { GitHubProvider } from '../integrations/backupStorage/GitHubProvider.js';

const RAW_SENTINEL = 'RAW-CONFIDENTIAL-MESSAGE-BODY-DO-NOT-MIRROR';
const TOKEN_SENTINEL = 'ghp_SUPERSECRETTOKEN1234567890';
const RESTRICTED_SENTINEL = 'RESTRICTED-CLIENT-ACCOUNT-PASSWORD';

const db = getTestDb();

function sha1(value: string): string {
  return createHash('sha1').update(value).digest('hex');
}

// ---------------------------------------------------------------------------
// In-memory GitHub Git Data API mock
// ---------------------------------------------------------------------------

class FakeGitHub {
  refs = new Map<string, string>();
  commits = new Map<string, { tree: string; parents: string[]; message: string }>();
  /** treeSha -> flat { path: blobSha } */
  trees = new Map<string, Map<string, string>>();
  blobs = new Map<string, { content: string; encoding: string }>();
  blobUploads = 0;
  forceAttempted = false;
  readonly repo = 'owner/mirror';

  fetchImpl: typeof fetch = async (input, init) => {
    const url =
      typeof input === 'string' ? input : (input as { url: string }).url;
    const method = (init?.method || 'GET').toUpperCase();
    const parsed = new URL(url);
    const path = parsed.pathname.replace('/repos/owner/mirror', '');
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const json = (status: number, data: unknown) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });

    if (method === 'GET' && path === '') return json(200, { full_name: this.repo });

    if (method === 'GET' && path.startsWith('/git/ref/heads/')) {
      const branch = decodeURIComponent(path.split('/').pop()!);
      const sha = this.refs.get(branch);
      return sha
        ? json(200, { object: { sha } })
        : json(404, { message: 'Not Found' });
    }

    if (method === 'GET' && path.startsWith('/git/commits/')) {
      const sha = path.split('/').pop()!;
      const commit = this.commits.get(sha);
      if (!commit) return json(404, { message: 'Not Found' });
      return json(200, {
        sha,
        tree: { sha: commit.tree },
        parents: commit.parents.map((p) => ({ sha: p })),
      });
    }

    if (method === 'GET' && path.startsWith('/git/trees/')) {
      const sha = path.split('/').pop()!;
      const tree = this.trees.get(sha);
      if (!tree) return json(404, { message: 'Not Found' });
      return json(200, {
        tree: [...tree.entries()].map(([p, s]) => ({
          path: p,
          mode: '100644',
          type: 'blob',
          sha: s,
        })),
      });
    }

    if (method === 'POST' && path === '/git/blobs') {
      const content = body.content as string;
      const encoding = body.encoding as string;
      const sha = sha1(`${encoding}:${content}`);
      if (!this.blobs.has(sha)) {
        this.blobs.set(sha, { content, encoding });
        this.blobUploads += 1;
      }
      return json(201, { sha });
    }

    if (method === 'POST' && path === '/git/trees') {
      const base = body.base_tree ? this.trees.get(body.base_tree) : new Map();
      const next = new Map(base ?? []);
      for (const entry of body.tree as Array<{ path: string; sha: string | null }>) {
        if (entry.sha === null) next.delete(entry.path);
        else next.set(entry.path, entry.sha);
      }
      const sha = sha1(`tree:${JSON.stringify([...next.entries()].sort())}`);
      this.trees.set(sha, next);
      return json(201, { sha });
    }

    if (method === 'POST' && path === '/git/commits') {
      const sha = sha1(
        `commit:${body.message}:${body.tree}:${(body.parents || []).join(',')}`,
      );
      this.commits.set(sha, {
        tree: body.tree,
        parents: body.parents || [],
        message: body.message,
      });
      return json(201, {
        sha,
        html_url: `https://github.com/${this.repo}/commit/${sha}`,
        committer: { date: '2026-10-09T15:30:00Z' },
      });
    }

    if (method === 'PATCH' && path.startsWith('/git/refs/heads/')) {
      if (body.force === true) this.forceAttempted = true;
      const branch = decodeURIComponent(path.split('/').pop()!);
      this.refs.set(branch, body.sha);
      return json(200, { object: { sha: body.sha } });
    }

    if (method === 'GET' && path.startsWith('/git/blobs/')) {
      const sha = path.split('/').pop()!;
      const blob = this.blobs.get(sha);
      if (!blob) return json(404, { message: 'Not Found' });
      return json(200, blob);
    }

    return json(404, { message: `unhandled ${method} ${path}` });
  };

  /** Simulate a user hand-editing a file directly on GitHub. */
  setRemoteFile(path: string, content: string): void {
    const tree = this.currentTree();
    const sha = sha1(`utf-8:${content}`);
    this.blobs.set(sha, { content: Buffer.from(content, 'utf-8').toString('base64'), encoding: 'base64' });
    tree.set(path, sha);
    // publish the mutation as a new commit so the ref moves
    const refSha = this.refs.values().next().value as string | undefined;
    const treeSha = sha1(`tree:${JSON.stringify([...tree.entries()].sort())}`);
    this.trees.set(treeSha, tree);
    const commitSha = sha1(`commit:user-edit:${treeSha}:${refSha ?? ''}`);
    this.commits.set(commitSha, {
      tree: treeSha,
      parents: refSha ? [refSha] : [],
      message: 'user edit',
    });
    this.refs.set('main', commitSha);
  }

  remoteContent(path: string): string | null {
    const sha = this.currentTree().get(path);
    if (!sha) return null;
    const blob = this.blobs.get(sha);
    if (!blob) return null;
    return blob.encoding === 'base64'
      ? Buffer.from(blob.content, 'base64').toString('utf-8')
      : blob.content;
  }

  private currentTree(): Map<string, string> {
    const refSha = this.refs.values().next().value as string | undefined;
    if (!refSha) return new Map();
    const commit = this.commits.get(refSha)!;
    return new Map(this.trees.get(commit.tree) ?? []);
  }
}

function newProvider(mock: FakeGitHub): GitHubProvider {
  return new GitHubProvider({
    repo: mock.repo,
    branch: 'main',
    token: TOKEN_SENTINEL,
    apiBaseUrl: 'https://api.github.test',
    fetchImpl: mock.fetchImpl,
  });
}

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const OWNER = 'mirror-owner';
const now = new Date('2026-10-09T15:30:00Z');

function resetDb(): void {
  for (const table of [
    'mirror_runs',
    'mirror_manifest',
    'unit_reconcile_decisions',
    'reconcile_artifacts',
    'attention_items',
    'social_edges',
    'entity_properties',
    'relationships',
    'entities',
    'user_profile_items',
    'memory_unit_sources',
    'memory_units',
    'messages_raw',
  ]) {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch {
      // table may not exist in a partial schema
    }
  }
}

let seq = 0;
function message(
  id: string,
  content: string,
  overrides: { origin?: string; promotion?: number; session?: string } = {},
): void {
  const at = Math.floor(now.getTime() / 1000);
  const origin = overrides.origin ?? 'owner';
  const promotion = overrides.promotion ?? 1;
  db.prepare(
    `INSERT INTO messages_raw
       (id, content, source_type, sender, group_id, timestamp, created_at, metadata_json,
        origin_class, session_kind, promotion_eligible)
     VALUES (?, ?, 'glip', 'Me', 'g', ?, ?, '{}', ?, ?, ?)`,
  ).run(
    id,
    content,
    at,
    at,
    origin,
    overrides.session ?? 'interactive',
    promotion,
  );
}

function unit(input: {
  id: string;
  kind: string;
  text: string;
  status?: string;
  sensitivity?: string;
  egressPolicy?: string;
  episodeId: string;
  evidenceClass?: string;
}): void {
  const at = Math.floor(now.getTime() / 1000);
  db.prepare(
    `INSERT INTO memory_units
       (id, tenant_id, owner_user_id, memory_form, kind, status, text, sensitivity,
        egress_policy, confidence, tx_start, created_at, updated_at)
     VALUES (?, 'default', ?, 'semantic', ?, ?, ?, ?, ?, 0.9, ?, ?, ?)`,
  ).run(
    input.id,
    OWNER,
    input.kind,
    input.status ?? 'active',
    input.text,
    input.sensitivity ?? 'internal',
    input.egressPolicy ?? 'approved_destinations',
    at,
    at,
    at,
  );
  db.prepare(
    `INSERT INTO memory_unit_sources
       (unit_id, episode_id, span_start_byte, span_end_byte, span_text_hash,
        source_role, evidence_key, provenance_family, evidence_class, created_at)
     VALUES (?, ?, 0, 1, 'hash', 'self', ?, 'glip:Me', ?, ?)`,
  ).run(
    input.id,
    input.episodeId,
    `ek-${input.id}-${++seq}`,
    input.evidenceClass ?? 'self_statement',
    Math.floor(now.getTime() / 1000),
  );
}

function seedAuditedFixture(): void {
  message('m-owner-pref', `I prefer ${RAW_SENTINEL}`, { origin: 'owner' });
  message('m-owner-fact', 'My timezone is Asia/Shanghai', { origin: 'owner' });
  message('m-observed-other', `${RESTRICTED_SENTINEL} about colleague`, {
    origin: 'observed',
  });
  message('m-system', 'heartbeat noise', { origin: 'system', promotion: 0 });

  unit({
    id: 'u-pref',
    kind: 'preference',
    text: '偏好：深色模式',
    episodeId: 'm-owner-pref',
    evidenceClass: 'self_statement',
  });
  unit({
    id: 'u-fact',
    kind: 'fact',
    text: '时区：Asia/Shanghai',
    episodeId: 'm-owner-fact',
  });
  unit({
    id: 'u-restricted',
    kind: 'fact',
    text: `客户账号密码：${RESTRICTED_SENTINEL}`,
    episodeId: 'm-observed-other',
    sensitivity: 'restricted',
  });
  unit({
    id: 'u-other',
    kind: 'fact',
    text: '同事目前负责的项目进度',
    episodeId: 'm-observed-other',
    evidenceClass: 'third_party_report',
  });
  unit({
    id: 'u-localonly',
    kind: 'decision',
    text: '仅本地：不要外发',
    episodeId: 'm-owner-fact',
    egressPolicy: 'local_only',
  });
  unit({
    id: 'u-unconfirmed',
    kind: 'preference',
    text: '未确认偏好：想学吉他',
    episodeId: 'm-system',
    status: 'provisional',
  });

  db.prepare(
    `INSERT INTO user_profile_items
       (id, item_type, item_key, item_value, source_kind, confidence, user_confirmed,
        status, salience_score, mention_count, last_seen, created_at, updated_at, fingerprint)
     VALUES ('p-confirmed', 'preference', 'theme', '深色模式', 'explicit', 0.9, 1,
             'active', 1, 1, ?, ?, ?, 'fp1')`,
  ).run(Math.floor(now.getTime() / 1000), Math.floor(now.getTime() / 1000), Math.floor(now.getTime() / 1000));
  db.prepare(
    `INSERT INTO user_profile_items
       (id, item_type, item_key, item_value, source_kind, confidence, user_confirmed,
        status, salience_score, mention_count, last_seen, created_at, updated_at, fingerprint)
     VALUES ('p-unconfirmed', 'fact', 'hobby', '想学吉他', 'inferred', 0.5, 0,
             'active', 0.2, 1, ?, ?, ?, 'fp2')`,
  ).run(Math.floor(now.getTime() / 1000), Math.floor(now.getTime() / 1000), Math.floor(now.getTime() / 1000));

  db.prepare(
    `INSERT INTO entities (id, type, name, aliases_json, importance, status, created_at, updated_at)
     VALUES ('e-self', 'Person', 'Me', '["我"]', 1, 'active', ?, ?)`,
  ).run(Math.floor(now.getTime() / 1000), Math.floor(now.getTime() / 1000));
  db.prepare(
    `INSERT INTO entities (id, type, name, aliases_json, importance, status, created_at, updated_at)
     VALUES ('e-peer', 'Person', 'Sophia', '[]', 0.8, 'active', ?, ?)`,
  ).run(Math.floor(now.getTime() / 1000), Math.floor(now.getTime() / 1000));
  db.prepare(
    `INSERT INTO social_edges (id, from_entity_id, to_entity_id, relation_type, user_confirmed, created_at, updated_at)
     VALUES ('se-1', 'e-self', 'e-peer', 'manager', 1, ?, ?)`,
  ).run(Math.floor(now.getTime() / 1000), Math.floor(now.getTime() / 1000));
  db.prepare(
    `INSERT INTO entity_properties (entity_id, property_key, property_value, source_authority, valid_from, tx_start, status)
     VALUES ('e-peer', 'role', '上级', 'self', ?, ?, 'active')`,
  ).run(Math.floor(now.getTime() / 1000), Math.floor(now.getTime() / 1000));

  db.prepare(
    `INSERT INTO reconcile_artifacts
       (artifact_key, tenant_id, owner_user_id, kind, content, source_unit_ids_json,
        sensitivity, egress_policy, expiry_at, created_at)
     VALUES ('a1', 'default', ?, 'one_pager', '# 一页纸\n- 目标：Q4', '[]', 'internal',
             'approved_destinations', ?, ?)`,
  ).run(OWNER, Math.floor(now.getTime() / 1000) + 3600, Math.floor(now.getTime() / 1000));

  db.prepare(
    `INSERT INTO unit_reconcile_decisions
       (id, tenant_id, owner_user_id, phase, unit_id, candidate_unit_id, evidence_digest,
        evidence_keys_json, decision, state, expected_revisions_json, created_at, decided_at)
     VALUES ('d1', 'default', ?, 'B', 'u-pref', 'u-fact', 'dig', '[]', 'corroborate',
             'applied', '[]', ?, ?)`,
  ).run(
    OWNER,
    Math.floor(now.getTime() / 1000),
    Math.floor(now.getTime() / 1000),
  );
}

beforeEach(() => {
  resetDb();
  seedAuditedFixture();
});

afterAll(() => {
  cleanupTestDb();
});

function allContent(
  files: Array<{ path: string; content: string }>,
): string {
  return files.map((file) => `${file.path}\n${file.content}`).join('\n');
}

// ---------------------------------------------------------------------------
// 1. no raw text / token / secret / restricted
// ---------------------------------------------------------------------------

describe('projection redaction', () => {
  it('never contains raw message text, tokens, secrets, or restricted fields', () => {
    const result = renderMirrorProjection(db, OWNER as unknown as string, { now });
    const blob = allContent(result.files);
    expect(blob).not.toContain(RAW_SENTINEL);
    expect(blob).not.toContain(TOKEN_SENTINEL);
    expect(blob).not.toContain(RESTRICTED_SENTINEL);
    // restricted + local_only units must be filtered, not rendered, and their
    // ids must not leak through the daily timeline either.
    expect(result.files.some((f) => f.content.includes('u-restricted'))).toBe(false);
    expect(result.files.some((f) => f.content.includes('u-localonly'))).toBe(false);
    expect(result.files.some((f) => f.path.endsWith('config.json'))).toBe(false);
  });

  it('renders the declared mirror directory set', () => {
    const result = renderMirrorProjection(db, OWNER, { now });
    const paths = result.files.map((f) => f.path);
    expect(paths).toContain('MIRROR.md');
    expect(paths).toContain('profile/USER_CORE.md');
    expect(paths).toContain('profile/one-pager.md');
    expect(paths).toContain('consolidation/DIARY.md');
    expect(paths).toContain('interop/openclaw/USER.md');
    expect(paths.some((p) => p.startsWith('entities/people/'))).toBe(true);
    expect(paths.some((p) => p.startsWith('knowledge/preferences/'))).toBe(true);
    expect(paths.some((p) => p.startsWith('timeline/daily/'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. self_only excludes other people's sensitive facts
// ---------------------------------------------------------------------------

describe('self_only scope', () => {
  it("excludes other people's sensitive facts and observed content", () => {
    const result = renderMirrorProjection(db, OWNER, { scope: 'self_only', now });
    const blob = allContent(result.files);
    expect(blob).not.toContain(RAW_SENTINEL);
    expect(blob).not.toContain('Sophia');
    expect(result.files.some((f) => f.path.startsWith('entities/people/e-peer'))).toBe(
      false,
    );
    // owner-confirmed self content still present
    expect(blob).toContain('深色模式');
  });

  it("keeps all-scope people entities but still filters restricted ones", () => {
    const result = renderMirrorProjection(db, OWNER, { scope: 'all', now });
    const blob = allContent(result.files);
    expect(blob).toContain('Sophia');
    expect(blob).not.toContain(RESTRICTED_SENTINEL);
  });
});

// ---------------------------------------------------------------------------
// 3. incremental push
// ---------------------------------------------------------------------------

describe('incremental push', () => {
  it('never re-uploads unchanged files across five nights', async () => {
    const mock = new FakeGitHub();
    const provider = newProvider(mock);
    const result = renderMirrorProjection(db, OWNER, { now });
    const files = result.files.map((f) => ({
      path: f.path,
      content: f.content,
      hash: f.hash,
    }));

    const manifest = new Map<
      string,
      { contentHash: string; remoteSha: string | null; lastCommitSha: string | null }
    >();

    const first = await provider.putTree(files, 'night 1', { manifest, now });
    expect(first.status).toBe('success');
    expect(first.changedPaths.length).toBe(files.length);
    const uploadsAfterFirst = mock.blobUploads;

    for (const [path, sha] of first.remoteShas) {
      const file = files.find((f) => f.path === path);
      if (file) {
        manifest.set(path, {
          contentHash: file.hash,
          remoteSha: sha,
          lastCommitSha: first.commitSha,
        });
      }
    }

    for (let night = 2; night <= 5; night += 1) {
      const push = await provider.putTree(files, `night ${night}`, { manifest, now });
      expect(push.status).toBe('skipped');
      expect(push.changedPaths.length).toBe(0);
    }
    expect(mock.blobUploads).toBe(uploadsAfterFirst);
    expect(mock.forceAttempted).toBe(false);
  });

  it('re-uploads only the file whose content changed', async () => {
    const mock = new FakeGitHub();
    const provider = newProvider(mock);
    const result = renderMirrorProjection(db, OWNER, { now });
    const files = result.files.map((f) => ({
      path: f.path,
      content: f.content,
      hash: f.hash,
    }));
    const manifest = new Map<
      string,
      { contentHash: string; remoteSha: string | null; lastCommitSha: string | null }
    >();
    const first = await provider.putTree(files, 'night 1', { manifest, now });
    for (const [path, sha] of first.remoteShas) {
      const file = files.find((f) => f.path === path);
      if (file) {
        manifest.set(path, {
          contentHash: file.hash,
          remoteSha: sha,
          lastCommitSha: first.commitSha,
        });
      }
    }
    const uploadsAfterFirst = mock.blobUploads;
    const mutated = files.map((file) =>
      file.path === 'profile/USER_CORE.md'
        ? { ...file, content: `${file.content}\n- 新增：测试`, hash: sha1('new') }
        : file,
    );
    const push = await provider.putTree(mutated, 'night 2', { manifest, now });
    expect(push.changedPaths).toEqual(['profile/USER_CORE.md']);
    expect(mock.blobUploads).toBe(uploadsAfterFirst + 1);
  });
});

// ---------------------------------------------------------------------------
// 4. conflict preservation
// ---------------------------------------------------------------------------

describe('remote hand-edit conflict', () => {
  it('preserves the remote edit and records a conflict copy', async () => {
    const mock = new FakeGitHub();
    const provider = newProvider(mock);
    const result = renderMirrorProjection(db, OWNER, { now });
    const files = result.files.map((f) => ({
      path: f.path,
      content: f.content,
      hash: f.hash,
    }));
    const manifest = new Map<
      string,
      { contentHash: string; remoteSha: string | null; lastCommitSha: string | null }
    >();
    const first = await provider.putTree(files, 'night 1', { manifest, now });
    for (const [path, sha] of first.remoteShas) {
      const file = files.find((f) => f.path === path);
      if (file) {
        manifest.set(path, {
          contentHash: file.hash,
          remoteSha: sha,
          lastCommitSha: first.commitSha,
        });
      }
    }

    mock.setRemoteFile('profile/USER_CORE.md', '# USER CORE\n\n- 用户手改的内容\n');
    const push = await provider.putTree(files, 'night 2', { manifest, now });
    expect(push.conflictPaths).toContain('profile/USER_CORE.md');
    // remote edit is not overwritten
    expect(mock.remoteContent('profile/USER_CORE.md')).toContain('用户手改的内容');
    // conflict copy exists
    const conflictPath = [...push.remoteShas.keys()].find((path) =>
      path.startsWith('conflict-') && path.includes('profile/USER_CORE.md'),
    );
    expect(conflictPath).toBeTruthy();
    expect(mock.forceAttempted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. rebuild determinism
// ---------------------------------------------------------------------------

describe('rebuild', () => {
  it('re-rendering the same truth produces a byte-identical projection', () => {
    const first = renderMirrorProjection(db, OWNER, { now });
    const second = renderMirrorProjection(db, OWNER, { now });
    const map = (files: Array<{ path: string; hash: string }>) =>
      files.map((f) => `${f.path}:${f.hash}`).sort();
    expect(map(second.files)).toEqual(map(first.files));
  });

  it('manifest hashes are stable so a deleted projection is rebuildable', () => {
    const first = renderMirrorProjection(db, OWNER, { now });
    const rebuild = renderMirrorProjection(db, OWNER, { now });
    for (const file of first.files) {
      const match = rebuild.files.find((f) => f.path === file.path);
      expect(match?.hash).toBe(file.hash);
      expect(match?.content).toBe(file.content);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. OpenClaw interop
// ---------------------------------------------------------------------------

describe('openclaw interop', () => {
  it('renders confirmed preferences with echo markers', () => {
    const result = renderMirrorProjection(db, OWNER, { now });
    const userMd = result.files.find((f) => f.path === 'interop/openclaw/USER.md');
    expect(userMd).toBeTruthy();
    expect(userMd!.content).toContain('偏好：深色模式');
    expect(userMd!.content).toContain('<!-- pai:unit:u-pref -->');
  });

  it('excludes unconfirmed, other-person, and observed content from interop', () => {
    const result = renderMirrorProjection(db, OWNER, { now });
    const blob = allContent(
      result.files.filter((f) => f.path.startsWith('interop/')),
    );
    expect(blob).not.toContain('未确认偏好');
    expect(blob).not.toContain('Sophia');
    expect(blob).not.toContain(RAW_SENTINEL);
    expect(blob).not.toContain(RESTRICTED_SENTINEL);
  });

  it('marks interop as self_only regardless of global scope', () => {
    const result = renderMirrorProjection(db, OWNER, { scope: 'all', now });
    const personal = result.files.find(
      (f) => f.path === 'interop/openclaw/PERSONAL_AI.md',
    );
    expect(personal!.content).toContain('scope: self_only');
  });
});
