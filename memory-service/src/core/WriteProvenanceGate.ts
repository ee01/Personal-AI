/** Deterministic write authority. Never accepts a model's origin/promotion claim. */
import { AsyncLocalStorage } from 'node:async_hooks';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { now } from '../utils/time.js';

export const ORIGIN_CLASSES = ['owner', 'observed', 'agent', 'untrusted', 'system'] as const;
export const SESSION_KINDS = ['interactive', 'heartbeat', 'cron', 'subagent', 'reflection', 'dream', 'import'] as const;
export type OriginClass = typeof ORIGIN_CLASSES[number];
export type SessionKind = typeof SESSION_KINDS[number];
const background = new Set<string>(['heartbeat', 'cron', 'subagent', 'reflection', 'dream']);
export function gateEnabled(name = 'WRITE_ORIGIN_GATE_ENABLED'): boolean {
  return !['0', 'false', 'off'].includes((process.env[name] ?? 'true').toLowerCase());
}

const context = new AsyncLocalStorage<{ sessionKind: SessionKind }>();
export class SystemWriteContext {
  static run<T>(sessionKind: SessionKind, fn: () => T): T {
    return context.run({ sessionKind }, fn);
  }
  static current(): SessionKind | undefined { return context.getStore()?.sessionKind; }
}
export interface ProvenanceInput {
  sourceType: string;
  sender?: string | null;
  session_kind?: SessionKind;
  metadata?: Record<string, unknown> | null;
  content?: string;
}
export interface WriteProvenance {
  originClass: OriginClass;
  sessionKind: SessionKind;
  promotionEligible: boolean;
  derivedFrom: string[];
  originFamily: string;
}
export function hasExplicitOwnerSignal(meta: Record<string, unknown>): boolean {
  if (['isSelf','authorIsSelf','senderIsSelf','fromSelf','isOwner','ownerAuthored'].some(k => meta[k] === true)) return true;
  if (['authorRole','senderRole','fromRole','role','messageAuthorRole'].some(k => ['owner','self','user'].includes(String(meta[k] ?? '').toLowerCase()))) return true;
  return ['author','sender','from','participant'].some(k => typeof meta[k] === 'object' && meta[k] !== null && hasExplicitOwnerSignal(meta[k] as Record<string, unknown>));
}
export function classifyWrite(input: ProvenanceInput, ownerUserId?: string, inheritSession = true): WriteProvenance {
  const meta = input.metadata ?? {};
  const requested = (inheritSession ? SystemWriteContext.current() : undefined) ?? input.session_kind ?? meta.session_kind;
  const sessionKind: SessionKind = SESSION_KINDS.includes(requested as SessionKind)
    ? requested as SessionKind : requested != null || input.sourceType === 'system' ? 'cron' : 'interactive';
  const source = input.sourceType.toLowerCase();
  const sender = (input.sender ?? '').toLowerCase();
  const derivedFrom = recalledIds(input.content ?? '');
  let originClass: OriginClass;
  if (derivedFrom.length) originClass = 'agent';
  else if (meta.turn_tainted === true || meta.network_origin === true || meta.role === 'assistant' && meta.tool_origin === 'network') originClass = 'untrusted';
  else if (background.has(sessionKind) || source === 'system' || /^(system|scaffold)$/.test(sender)) originClass = 'system';
  else if (meta.importBatchId != null || sender === 'memory-import') originClass = 'untrusted';
  else if (/web|external|openclaw|email|doubao|chatgpt|codex|claude|cursor|mcp_client|ai_chat/.test(source)) originClass = 'untrusted';
  else if (/^(assistant|agent|ai)$/.test(sender) || meta.role === 'assistant' || meta.generatedByAgent === true) originClass = 'agent';
  else if (source === 'manual' || ['glip', 'jira'].includes(source) && (hasExplicitOwnerSignal(meta) || !!ownerUserId && input.sender === ownerUserId)) originClass = 'owner';
  else if (['glip', 'jira', 'meeting', 'calendar'].includes(source)) originClass = 'observed';
  else originClass = 'untrusted';
  // A family is an author/channel lineage, not an ingestion event. Derived
  // output keeps its ancestors; repeating one author cannot corroborate itself.
  const originFamily = derivedFrom.length ? `derived:${derivedFrom.sort().join(',')}`
    : `${source}:${input.sender || 'unknown'}`;
  return { originClass, sessionKind, derivedFrom, originFamily,
    promotionEligible: !background.has(sessionKind) && (originClass === 'owner' || originClass === 'observed') };
}

export function recalledIds(text: string): string[] {
  if (!gateEnabled('RECALL_LOOP_GUARD_ENABLED')) return [];
  return [...new Set([...text.matchAll(/<recalled\b[^>]*\bid\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(m => m[1]))];
}
const attr = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function markRecalled(id: string, text: string, exposure = 'prompt'): string {
  if (!gateEnabled('RECALL_LOOP_GUARD_ENABLED')) return text;
  return `<recalled id="${attr(id)}" exposure="${attr(exposure)}">${text}</recalled>`;
}
export function stripRecalled(text: string): string { return text.replace(/<\/?recalled\b[^>]*>/gi, ''); }

/** Both unit and legacy references are logged; unknown client ids never break ingest. */
export function recordRecallExposures(db: Database.Database, ids: string[], surface: string, turnId?: string): number {
  const requestId = randomUUID();
  const insert = db.prepare(`INSERT INTO memory_exposures
    (request_id,unit_id,memory_id,surface,turn_id,rank,shown,created_at) VALUES (?,?,?,?,?,?,1,?)`);
  return db.transaction(() => {
    let count = 0;
    for (const [rank, id] of [...new Set(ids)].entries()) {
      const unit = id.startsWith('unit:') ? id.slice(5) : id;
      const found = db.prepare('SELECT id FROM memory_units WHERE id=?').get(unit) as {id:string}|undefined;
      insert.run(requestId, found?.id ?? null, id, surface, turnId ?? null, rank, now());
      count++;
    }
    return count;
  })();
}
export function episodePromotionEligible(db: Database.Database, id: string): boolean {
  if (!gateEnabled()) return true;
  const row = db.prepare('SELECT promotion_eligible FROM messages_raw WHERE id=?').get(id) as {promotion_eligible:number}|undefined;
  return row?.promotion_eligible === 1;
}
export function unitPromotionEligible(db: Database.Database, id: string): boolean {
  if (!gateEnabled()) return true;
  return !!db.prepare(`SELECT 1 FROM memory_unit_sources WHERE unit_id=? AND promotion_eligible=1 LIMIT 1`).get(id);
}

/** Durable per-user session taint. No process-global state; new user input resets. */
export function applyTurnTaint(db: Database.Database, input: ProvenanceInput): ProvenanceInput {
  if (!gateEnabled('TURN_TAINT_ENABLED')) return input;
  const meta = input.metadata ?? {};
  const sessionId = typeof meta.session_id === 'string' ? meta.session_id : undefined;
  const declaredNetwork = meta.network_origin === true || meta.tool_origin === 'network'
    || ['web_fetch', 'openclaw', 'external_ai'].includes(String(meta.tool_name ?? ''));
  if (!sessionId) return declaredNetwork ? {...input, metadata:{...meta, turn_tainted:true}} : input;
  const role = meta.role;
  if (role === 'user') {
    db.prepare(`DELETE FROM memory_turn_taint WHERE session_id=?`).run(sessionId);
    return input;
  }
  if (declaredNetwork) {
    db.prepare(`INSERT INTO memory_turn_taint(session_id,turn_id,tainted,updated_at) VALUES (?,?,1,?)
      ON CONFLICT(session_id) DO UPDATE SET turn_id=excluded.turn_id,tainted=1,updated_at=excluded.updated_at`)
      .run(sessionId, typeof meta.turn_id === 'string' ? meta.turn_id : null, now());
  }
  const row = db.prepare('SELECT tainted FROM memory_turn_taint WHERE session_id=?').get(sessionId) as {tainted:number}|undefined;
  return row?.tainted && (role === 'assistant' || role === 'tool' || declaredNetwork)
    ? {...input, metadata:{...meta, turn_tainted:true}} : input;
}

/** Idempotent user-aware backfill; metadata and source fields only, never text judgment. */
export function backfillWriteProvenance(db: Database.Database, ownerUserId?: string): { rows: number; changed: number } {
  const rows = db.prepare(`SELECT id,source_type,sender,content,metadata_json,origin_class,session_kind,promotion_eligible,derived_from_json,origin_family FROM messages_raw`).all() as Array<{
    id:string; source_type:string; sender:string|null; content:string; metadata_json:string|null;
    origin_class:string|null; session_kind:string; promotion_eligible:number; derived_from_json:string; origin_family:string|null;
  }>;
  const update = db.prepare(`UPDATE messages_raw SET origin_class=?,session_kind=?,promotion_eligible=?,derived_from_json=?,origin_family=? WHERE id=?`);
  return db.transaction(() => {
    let changed = 0;
    for (const row of rows) {
      let metadata: Record<string,unknown> = {};
      try { const parsed = JSON.parse(row.metadata_json ?? '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) metadata=parsed; } catch { /* malformed legacy JSON is not authority */ }
      const p = classifyWrite({sourceType:row.source_type,sender:row.sender,content:row.content,metadata},ownerUserId,false);
      const args = [p.originClass,p.sessionKind,p.promotionEligible?1:0,JSON.stringify(p.derivedFrom),p.originFamily];
      if (JSON.stringify(args) !== JSON.stringify([row.origin_class,row.session_kind,row.promotion_eligible,row.derived_from_json,row.origin_family])) {
        update.run(...args,row.id); changed++;
      }
    }
    db.exec(`UPDATE memory_unit_sources SET
      origin_class=(SELECT origin_class FROM messages_raw WHERE id=episode_id),
      session_kind=(SELECT session_kind FROM messages_raw WHERE id=episode_id),
      promotion_eligible=(SELECT promotion_eligible FROM messages_raw WHERE id=episode_id),
      derived_from_json=(SELECT derived_from_json FROM messages_raw WHERE id=episode_id);
      UPDATE memory_claims SET profile_candidate=0,current_truth_candidate=0,action_candidate=0
      WHERE source_message_id IN (SELECT id FROM messages_raw WHERE promotion_eligible=0);`);
    return {rows: rows.length, changed};
  })();
}

/** Legacy chunks inherit their raw source gate; generated file projections
 * never become independent evidence merely because they have a chunk id. */
export function evidencePromotionEligible(db: Database.Database, kind: string, id: string): boolean {
  if (!gateEnabled()) return true;
  if (kind === 'message') return episodePromotionEligible(db, id.replace(/^message:/, ''));
  if (kind === 'chunk') {
    const row = db.prepare('SELECT related_entity_id,file_path FROM chunks WHERE chunk_id=?').get(id.replace(/^chunk:/,'')) as {related_entity_id:string|null;file_path:string}|undefined;
    if (!row || /^(daily|projects|reflections|dreams|reports)\//.test(row.file_path)) return false;
    return !!row.related_entity_id && episodePromotionEligible(db,row.related_entity_id);
  }
  return true;
}
