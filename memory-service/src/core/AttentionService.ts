import type Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { ActionRepository } from '../repositories/ActionRepository.js';
import type { NotificationCandidate } from './ProactivityPolicy.js';
import {
  inferAudience,
  plainMessage,
  reminderPlan,
  triageAttention,
  wallTime,
} from './AttentionTriage.js';

export const attentionMode = () =>
  ['shadow', 'lens', 'remind'].includes(
    process.env.ATTENTION_TRIAGE_ENABLED ?? 'shadow',
  )
    ? process.env.ATTENTION_TRIAGE_ENABLED ?? 'shadow'
    : 'off';
const json = (value: string | null) => {
  try {
    return JSON.parse(value ?? '{}');
  } catch {
    return {};
  }
};
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export interface AttentionItem {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  due_at: number;
  addressed_to: string;
  source_message_id: string;
  source_unit_id?: string;
  sender_entity_id: string | null;
  weight: number;
  status: string;
  fire_count: number;
  last_fired_at: number | null;
  cooldown_until: number | null;
  expires_at: number;
  accepted_action_id: string | null;
  reminder_plan_json: string;
  created_at: number;
}
/** All reads use the request's per-user database AND an explicit owner id. */
export class AttentionService {
  constructor(private db: Database.Database, private userId: string) {}
  timezone(): string {
    const item = this.db
      .prepare(
        "SELECT item_value FROM user_profile_items WHERE item_key='timezone' AND status='active' ORDER BY user_confirmed DESC,updated_at DESC LIMIT 1",
      )
      .get() as { item_value: string } | undefined;
    const value = json(item?.item_value ?? null);
    const tz = typeof value === 'string' ? value : item?.item_value;
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz ?? 'Asia/Shanghai' });
      return tz ?? 'Asia/Shanghai';
    } catch {
      return 'Asia/Shanghai';
    }
  }
  capture(
    messageId: string,
    kinds: string[] = [],
    unitId?: string,
    at = Math.floor(Date.now() / 1000),
  ) {
    if (attentionMode() === 'off') return null;
    const r = this.db
      .prepare('SELECT * FROM messages_raw WHERE id=?')
      .get(messageId) as any;
    if (!r || !['owner', 'observed'].includes(r.origin_class)) return null;
    const meta = json(r.metadata_json);
    const names = [this.userId, this.userId.replace(/[._]/g, ' ')];
    const profiles = this.db
      .prepare(
        "SELECT item_key,item_value FROM user_profile_items WHERE status='active' AND (item_key='name' OR user_confirmed=1) AND item_key IN ('name','manager','role','team')",
      )
      .all() as Array<{ item_key: string; item_value: string }>;
    for (const p of profiles.filter((p) => p.item_key === 'name'))
      names.push(
        typeof json(p.item_value) === 'string'
          ? json(p.item_value)
          : p.item_value,
      );
    const entities = json(r.entities_json);
    const sender = (Array.isArray(entities) ? entities : []).find(
      (e: any) => e.name === r.sender,
    );
    const senderId =
      sender?.id ??
      (
        this.db
          .prepare(
            "SELECT id FROM entities WHERE name=? AND lower(type)='person' LIMIT 1",
          )
          .get(r.sender) as any
      )?.id;
    let weight = 0.1;
    const manager = profiles.find((p) => p.item_key === 'manager');
    if (
      manager &&
      [senderId, r.sender].includes(
        json(manager.item_value)?.entityId ?? manager.item_value,
      )
    )
      weight = 1;
    if (senderId && weight < 1) {
      const edge = this.db
        .prepare(
          'SELECT user_confirmed,confidence FROM social_edges WHERE from_entity_id=? AND to_entity_id=? AND valid_to IS NULL ORDER BY user_confirmed DESC,confidence DESC LIMIT 1',
        )
        .get(
          (
            this.db
              .prepare(
                "SELECT id FROM entities WHERE name=? AND lower(type)='person' LIMIT 1",
              )
              .get(this.userId) as { id: string } | undefined
          )?.id ?? `person_attention_${hash(this.userId).slice(0, 24)}`,
          senderId,
        ) as any;
      if (edge?.user_confirmed) weight = 0.8;
      else if (edge?.confidence >= 0.7) weight = 0.5;
    }
    if (weight < 0.6 && r.sender) {
      const count = this.db
        .prepare(
          "SELECT count(*) AS n FROM messages_raw WHERE sender=? AND timestamp>=? AND timestamp<=? AND origin_class IN ('owner','observed')",
        )
        .get(r.sender, at - 30 * 86400, at) as { n: number };
      weight = Math.max(weight, count.n >= 20 ? 0.6 : count.n >= 5 ? 0.4 : 0.1);
    }
    const audience =
      r.origin_class === 'owner' ? 'me' : inferAudience(r.content, meta, names);
    weight = Math.min(
      1,
      weight +
        (audience === 'me' ? 0.2 : audience === 'team_including_me' ? 0.1 : 0),
    );
    const decision = triageAttention({
      text: r.content,
      timestamp: r.timestamp,
      now: at,
      timezone: this.timezone(),
      origin: r.origin_class,
      audience,
      senderWeight: weight,
      importance: r.importance,
      kinds,
      matchedRule:
        meta.attentionMatchedRule === true ||
        (meta.attentionMatchedRule === undefined &&
          Array.isArray(meta.matchedRules) &&
          meta.matchedRules.length > 0),
      ownerAuthored: r.origin_class === 'owner',
    });
    if (!decision) return null;
    // Stable across re-ingestion and mirrored rule hits; source aliases join one card.
    const normalized = plainMessage(decision.title)
      .toLowerCase()
      .replace(
        /(?:kindly reminder|reminder|提醒|请大家|请|务必|及时|\bplease\b)/g,
        '',
      )
      .replace(/[^\p{L}\p{N}]/gu, '');
    let id = hash(
      [this.userId, decision.kind, normalized, decision.due_at].join(':'),
    );
    // Same sender/scope/deadline and a near-identical topic are one obligation.
    const siblings = this.db
      .prepare(
        `SELECT a.id,a.title,m.group_id,m.sender FROM attention_items a JOIN messages_raw m ON m.id=a.source_message_id WHERE a.user_id=? AND a.kind=? AND a.due_at=?`,
      )
      .all(this.userId, decision.kind, decision.due_at) as Array<{
      id: string;
      title: string;
      group_id: string;
      sender: string;
    }>;
    const tokens = (t: string) =>
      new Set(
        plainMessage(t)
          .toLowerCase()
          .match(/[a-z0-9]{2,}|[\u4e00-\u9fff]{2,}/g)
          ?.filter(
            (w) =>
              ![
                'please',
                'reminder',
                'kindly',
                'submit',
                'complete',
                'finish',
                'team',
                'deadline',
              ].includes(w),
          ) ?? [],
      );
    const current = tokens(decision.title);
    const similar = siblings.find((other) => {
      if (other.group_id !== r.group_id || other.sender !== r.sender)
        return false;
      const previous = tokens(other.title);
      const shared = [...current].filter((t) => previous.has(t)).length;
      return (
        shared >= 2 &&
        shared / Math.max(1, Math.min(current.size, previous.size)) >= 0.8
      );
    });
    if (similar) id = similar.id;
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO attention_items(id,user_id,kind,title,normalized_title,due_at,addressed_to,source_unit_id,source_message_id,sender_entity_id,weight,reasons_json,expires_at,reminder_plan_json,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          id,
          this.userId,
          decision.kind,
          decision.title,
          normalized,
          decision.due_at,
          audience,
          unitId ?? null,
          messageId,
          senderId ?? null,
          decision.confidence,
          JSON.stringify(decision.reasons),
          decision.due_at + 7 * 86400,
          JSON.stringify(reminderPlan(decision.due_at, this.timezone())),
          at,
          at,
        );
      this.db
        .prepare(
          'INSERT OR IGNORE INTO attention_sources(item_id,message_id) VALUES (?,?)',
        )
        .run(id, messageId);
      if (senderId)
        this.db
          .prepare(
            'UPDATE attention_items SET sender_entity_id=coalesce(sender_entity_id,?) WHERE id=?',
          )
          .run(senderId, id);
      if (unitId)
        this.db
          .prepare(
            'UPDATE attention_items SET source_unit_id=coalesce(source_unit_id,?) WHERE id=?',
          )
          .run(unitId, id);
    })();
    return this.get(id);
  }
  get(id: string): AttentionItem | undefined {
    return this.db
      .prepare('SELECT * FROM attention_items WHERE id=? AND user_id=?')
      .get(id, this.userId) as AttentionItem | undefined;
  }
  listForPosts(postIds: string[], at = Math.floor(Date.now() / 1000)) {
    if (!['lens', 'remind'].includes(attentionMode()) || !postIds.length)
      return [];
    this.maintain(at);
    const rows = this.db
      .prepare(
        `SELECT a.*,m.metadata_json FROM attention_items a JOIN messages_raw m ON m.id=a.source_message_id WHERE a.user_id=? AND a.status IN ('candidate','proposed') AND a.expires_at>? ORDER BY a.created_at DESC LIMIT 200`,
      )
      .all(this.userId, at) as Array<AttentionItem & { metadata_json: string }>;
    return rows
      .filter((r) =>
        postIds.includes(String(json(r.metadata_json).postId ?? '')),
      )
      .map((r) => {
        this.db
          .prepare(
            "UPDATE attention_items SET status='proposed',updated_at=? WHERE id=? AND status='candidate'",
          )
          .run(at, r.id);
        if (r.source_unit_id)
          this.db
            .prepare(
              "INSERT INTO memory_exposures(request_id,unit_id,surface,rank,shown,policy_version,created_at) VALUES (?,?,'memory_lens',0,1,'attention-v1',?)",
            )
            .run(randomUUID(), r.source_unit_id, at);
        const { metadata_json, ...item } = r;
        return {
          ...item,
          postId: String(json(metadata_json).postId),
          managerChip:
            process.env.ATTENTION_MANAGER_CHIP_ENABLED === 'true' &&
            Boolean(r.sender_entity_id) &&
            !this.db
              .prepare(
                "SELECT 1 FROM user_profile_items WHERE item_key='manager' AND user_confirmed=1 AND status='active'",
              )
              .get(),
        };
      });
  }
  decide(
    id: string,
    verdict:
      | 'accepted'
      | 'remind'
      | 'completed'
      | 'not_relevant'
      | 'dismissed'
      | 'cancelled',
    at = Math.floor(Date.now() / 1000),
  ) {
    return this.db.transaction(() => {
      const item = this.get(id);
      if (!item) throw new Error('attention_not_found');
      if (
        ['completed', 'dismissed', 'cancelled', 'expired', 'done'].includes(
          item.status,
        )
      )
        return item;
      if (item.expires_at <= at) {
        this.maintain(at);
        return this.get(id);
      }
      if (
        (verdict === 'accepted' || verdict === 'remind') &&
        item.accepted_action_id
      )
        return item;
      let status =
        verdict === 'accepted' || verdict === 'remind'
          ? 'armed'
          : verdict === 'not_relevant'
          ? 'dismissed'
          : verdict;
      let actionId = item.accepted_action_id;
      if (status === 'armed') {
        // Ledger entry is held; only Heartbeat delivers, after ProactivityPolicy.
        const action = new ActionRepository(this.db).create({
          actionType: 'notify_user',
          title: item.title,
          taskKind: 'remind',
          lane: 'memory_cron',
          sourceKind: 'attention',
          sourceRefId: id,
          requiresApproval: false,
          executionMode: 'manual',
          queueStatus: 'paused',
          state: 'approved',
          evidenceRefs: [item.source_message_id],
          idempotencyKey: `attention:${this.userId}:${id}`,
          expiresAt: item.expires_at,
          recurrenceSpec: {
            fires: ['-48h', '-24h', 'due_day_morning'],
            cooldownHours: 24,
            maxFires: 3,
          },
          params: {
            attentionItemId: id,
            reminderOnly: verdict === 'remind',
            dueAt: item.due_at,
          },
        });
        actionId = action.id;
      }
      this.db
        .prepare(
          'UPDATE attention_items SET status=?,accepted_action_id=?,updated_at=? WHERE id=? AND user_id=?',
        )
        .run(status, actionId, at, id, this.userId);
      this.db
        .prepare('INSERT INTO attention_feedback VALUES (?,?,?,?)')
        .run(randomUUID(), id, verdict, at);
      this.db
        .prepare(
          `INSERT INTO memory_feedback_events(feedback_type,target_type,target_id,action,detail,created_at,updated_at) VALUES ('attention','attention',?,?,?, ?,?) ON CONFLICT(feedback_type,target_type,target_id) DO UPDATE SET action=excluded.action,detail=excluded.detail,updated_at=excluded.updated_at`,
        )
        .run(
          id,
          verdict,
          JSON.stringify({ sourceMessageId: item.source_message_id }),
          at,
          at,
        );
      if (actionId && status !== 'armed')
        this.closeAction(actionId, status, at);
      return this.get(id);
    })();
  }
  private closeAction(id: string, status: string, at: number) {
    this.db
      .prepare(
        'UPDATE proposed_actions SET queue_status=?,state=?,finished_at=?,recurrence_spec=NULL WHERE id=?',
      )
      .run(
        status === 'completed' || status === 'done' ? 'succeeded' : 'cancelled',
        status === 'completed' || status === 'done' ? 'approved' : 'dismissed',
        at,
        id,
      );
  }
  maintain(at = Math.floor(Date.now() / 1000)) {
    this.db.transaction(() => {
      const rows = this.db
        .prepare(
          "SELECT a.*,p.queue_status FROM attention_items a LEFT JOIN proposed_actions p ON p.id=a.accepted_action_id WHERE a.user_id=? AND a.status IN ('candidate','proposed','armed')",
        )
        .all(this.userId) as Array<AttentionItem & { queue_status: string }>;
      for (const r of rows) {
        const status =
          r.queue_status === 'cancelled'
            ? 'cancelled'
            : r.queue_status === 'succeeded'
            ? 'completed'
            : r.expires_at <= at
            ? 'expired'
            : null;
        if (status) {
          this.db
            .prepare(
              'UPDATE attention_items SET status=?,updated_at=? WHERE id=?',
            )
            .run(status, at, r.id);
          if (r.accepted_action_id)
            this.closeAction(r.accepted_action_id, status, at);
        }
      }
    })();
  }
  dueCandidates(at = Math.floor(Date.now() / 1000)): NotificationCandidate[] {
    if (attentionMode() !== 'remind') return [];
    this.maintain(at);
    return (
      this.db
        .prepare(
          "SELECT * FROM attention_items WHERE user_id=? AND status='armed' AND fire_count<3 AND coalesce(cooldown_until,0)<=? AND due_at>=?",
        )
        .all(this.userId, at, at) as AttentionItem[]
    )
      .filter((r) => {
        const plan = JSON.parse(r.reminder_plan_json) as number[];
        return (
          plan.some((t) => t <= at && t > (r.last_fired_at ?? 0)) &&
          at >= (plan.find((t) => t > (r.last_fired_at ?? 0)) ?? Infinity)
        );
      })
      .map((r) => ({
        type: 'deadline',
        title: `待办提醒：${r.title}`,
        body: `截止 ${new Date(r.due_at * 1000).toLocaleDateString('zh-CN', {
          timeZone: this.timezone(),
        })} · ${r.addressed_to === 'me' ? '给我的请求' : '群发含我'}`,
        importance: r.weight,
        urgency: 0.95,
        confidence: r.weight,
        actionability: 1,
        topicId: `attention:${r.id}`,
        payload: {
          attentionItemId: r.id,
          actionId: r.accepted_action_id,
          sourceMessageId: r.source_message_id,
        },
      }));
  }
  /** Transaction boundary shared with notification insert: dropped candidates spend no budget. */
  recordFire(id: string, at: number): boolean {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(at * 1000);
    const n = (key: string) => Number(p.find((x) => x.type === key)?.value);
    const start = wallTime(n('year'), n('month'), n('day'), 0, this.timezone());
    const today = this.db
      .prepare(
        "SELECT count(*) AS n FROM notification_records WHERE created_at>=? AND json_extract(payload_json,'$.attentionItemId') IS NOT NULL",
      )
      .get(start) as { n: number };
    if (today.n >= 3) return false;
    const changed = this.db
      .prepare(
        "UPDATE attention_items SET fire_count=fire_count+1,last_fired_at=?,cooldown_until=?,status=CASE WHEN fire_count+1>=3 THEN 'done' ELSE 'armed' END,updated_at=? WHERE id=? AND user_id=? AND status='armed' AND fire_count<3 AND coalesce(cooldown_until,0)<=? AND expires_at>?",
      )
      .run(at, at + 86400, at, id, this.userId, at, at).changes;
    const item = this.get(id);
    if (changed && item?.status === 'done' && item.accepted_action_id)
      this.closeAction(item.accepted_action_id, 'done', at);
    return Boolean(changed);
  }
  reconcile(at = Math.floor(Date.now() / 1000)) {
    this.maintain(at);
    let completed = 0;
    const items = this.db
      .prepare(
        "SELECT a.*,m.group_id,m.metadata_json,m.timestamp AS source_timestamp FROM attention_items a JOIN messages_raw m ON m.id=a.source_message_id WHERE a.user_id=? AND a.status IN ('candidate','proposed','armed')",
      )
      .all(this.userId) as any[];
    for (const item of items) {
      const meta = json(item.metadata_json);
      const evidence = this.db
        .prepare(
          'SELECT id,content,metadata_json,sender FROM messages_raw WHERE timestamp>? AND timestamp<=? AND group_id IS ? AND origin_class=? ORDER BY timestamp LIMIT 200',
        )
        .all(
          item.source_timestamp,
          at,
          item.group_id,
          item.kind === 'waiting' ? 'observed' : 'owner',
        ) as any[];
      const match = evidence.find((r) => {
        const m = json(r.metadata_json);
        const linked =
          Boolean(meta.postId) &&
          (m.replyToPostId === meta.postId ||
            m.replyTo === meta.postId ||
            m.parentId === meta.postId ||
            m.attentionItemId === item.id);
        if (!linked) return false;
        const text = plainMessage(r.content);
        return item.kind === 'waiting'
          ? Boolean(text)
          : item.kind === 'request'
          ? Boolean(text)
          : /^(?:done|completed|submitted|已完成|完成了|已提交|交付了)[.!。！\s]*$/i.test(
              text,
            );
      });
      if (match) {
        this.decide(item.id, 'completed', at);
        this.db
          .prepare(
            'UPDATE attention_items SET completed_evidence_id=? WHERE id=?',
          )
          .run(match.id, item.id);
        completed++;
      }
    }
    return { completed, llmCalls: 0 };
  }
  openLoops(at = Math.floor(Date.now() / 1000)) {
    if (attentionMode() === 'off' || attentionMode() === 'shadow') return [];
    return this.db
      .prepare(
        "SELECT id,title,due_at,source_message_id,accepted_action_id FROM attention_items WHERE user_id=? AND status IN ('proposed','armed') AND expires_at>? ORDER BY due_at LIMIT 30",
      )
      .all(this.userId, at);
  }
  confirmIdentity(
    id: string,
    key: 'manager' | 'role',
    value: string,
    at = Math.floor(Date.now() / 1000),
  ) {
    const item = this.get(id);
    if (!item) throw new Error('attention_not_found');
    if (key === 'manager' && !item.sender_entity_id)
      throw new Error('sender_identity_unknown');
    return this.db.transaction(() => {
      const stored =
        key === 'manager'
          ? JSON.stringify({ entityId: item.sender_entity_id })
          : value;
      this.db
        .prepare(
          "UPDATE user_profile_items SET status='superseded',updated_at=? WHERE item_key=? AND status='active'",
        )
        .run(at, key);
      this.db
        .prepare(
          `INSERT INTO user_profile_items(id,item_type,item_key,item_value,evidence_refs,source_kind,confidence,user_confirmed,status,last_seen,created_at,updated_at,fingerprint) VALUES (?,'fact',?,?,?,'explicit',1,1,'active',?,?,?,?)`,
        )
        .run(
          randomUUID(),
          key,
          stored,
          JSON.stringify([{ message_id: item.source_message_id }]),
          at,
          at,
          at,
          hash(key + stored),
        );
      if (key === 'manager') {
        // Social mirror requires a real owner entity, never a fabricated foreign key.
        let owner = this.db
          .prepare(
            "SELECT id FROM entities WHERE name=? AND lower(type)='person' LIMIT 1",
          )
          .get(this.userId) as { id: string } | undefined;
        if (!owner) {
          owner = { id: `person_attention_${hash(this.userId).slice(0, 24)}` };
          this.db
            .prepare(
              "INSERT OR IGNORE INTO entities(id,name,type,status,created_at,updated_at) VALUES (?,?,'person','active',?,?)",
            )
            .run(owner.id, this.userId, at, at);
        }
        if (owner) {
          this.db
            .prepare(
              "UPDATE social_edges SET valid_to=?,updated_at=? WHERE from_entity_id=? AND relation_type='manager' AND valid_to IS NULL",
            )
            .run(at, at, owner.id);
          this.db
            .prepare(
              "INSERT INTO social_edges(id,from_entity_id,to_entity_id,relation_type,strength,confidence,user_confirmed,created_at,updated_at) VALUES (?,?,?,'manager',1,1,1,?,?)",
            )
            .run(randomUUID(), owner.id, item.sender_entity_id, at, at);
        }
      }
      this.db.prepare('UPDATE profile_sync_state SET profile_dirty=1').run();
      return { key, value: stored };
    })();
  }
}
