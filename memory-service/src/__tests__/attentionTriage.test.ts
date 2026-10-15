import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { getTestDb } from './setup.js';
import { AttentionService } from '../core/AttentionService.js';
import {
  inferAudience,
  parseAttentionDates,
  reminderPlan,
  triageAttention,
  wallTime,
} from '../core/AttentionTriage.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
const tz = 'Asia/Shanghai';
const at = wallTime(2026, 10, 9, 10, tz);
const due = wallTime(2026, 10, 13, 23, tz) + 3599;
const input = (text: string, extra = {}) => ({
  text,
  timestamp: at,
  now: at,
  timezone: tz,
  origin: 'observed',
  audience: 'me' as const,
  senderWeight: 0.8,
  importance: 0.75,
  ...extra,
});
const db = getTestDb();
const service = new AttentionService(db, 'attention-owner');
function message(
  id: string,
  text = '@Team 请大家提交 Q4 Goal Setting。Deadline 10/13/2026',
  extra: Record<string, unknown> = {},
) {
  const data = {
    origin: 'observed',
    timestamp: at,
    postId: id,
    replyToPostId: undefined,
    ...extra,
  };
  db.prepare(
    `INSERT INTO messages_raw(id,content,source_type,sender,group_id,timestamp,created_at,importance,metadata_json,origin_class) VALUES (?,?,'glip','Manager','team',?,?,0.8,?,?)`,
  ).run(
    id,
    text,
    data.timestamp,
    data.timestamp,
    JSON.stringify({
      postId: data.postId,
      matchedRules: ['rule'],
      replyToPostId: data.replyToPostId,
    }),
    data.origin,
  );
  return service.capture(id, [], undefined, at)!;
}
beforeEach(() => {
  process.env.ATTENTION_TRIAGE_ENABLED = 'remind';
  db.prepare('DELETE FROM attention_feedback').run();
  db.prepare('DELETE FROM attention_sources').run();
  db.prepare('DELETE FROM attention_items').run();
  db.prepare('DELETE FROM proposed_action_attempts').run();
  db.prepare('DELETE FROM proposed_actions').run();
  db.prepare('DELETE FROM messages_raw').run();
  db.prepare(
    "DELETE FROM memory_feedback_events WHERE feedback_type='attention'",
  ).run();
});
describe('deadline recall', () => {
  const variants = [
    '10/13/2026',
    '2026-10-13',
    '2026/10/13',
    '2026年10月13日',
    '10月13日',
    'October 13, 2026',
    'Oct 13',
    '10/13',
    '周二',
    '本周五',
    'Tuesday',
    'next Tuesday',
    '明天',
    'tomorrow',
    '后天',
    '今天',
    'today',
    'Friday',
    '周五前',
    '下周二',
  ];
  it.each(variants)('parses request deadline %s', (date) => {
    const result = triageAttention(
      input(`Please submit the quarterly goal. Deadline ${date}`),
    );
    expect(result).not.toBeNull();
    const dates = parseAttentionDates(date, at, tz);
    expect(dates.length).toBeGreaterThan(0);
    expect(result!.due_at).toBe(dates[0]);
  });
  it('normalizes the exact Sophia deadline and reminder mornings', () => {
    const result = triageAttention(
      input('请大家提交 Q4 Goal Setting。Deadline 10/13/2026'),
    );
    expect(result!.due_at).toBe(due);
    expect(reminderPlan(due, tz)).toEqual(
      [11, 12, 13].map((day) => wallTime(2026, 10, day, 9, tz)),
    );
  });
  it('handles a timezone with DST in the reminder schedule', () => {
    const d = wallTime(2026, 11, 2, 23, 'America/New_York');
    const plan = reminderPlan(d, 'America/New_York');
    expect(
      plan.map((t) =>
        new Date(t * 1000).toLocaleString('en-US', {
          timeZone: 'America/New_York',
        }),
      ),
    ).toEqual([
      '10/31/2026, 9:00:00 AM',
      '11/1/2026, 9:00:00 AM',
      '11/2/2026, 9:00:00 AM',
    ]);
  });
});
describe('negative filter', () => {
  const negatives = [
    ['Please submit by 2025-10-13', {}],
    ['Please submit by 10/01/2026', {}],
    ['Please submit by 2026-02-30', { audience: 'others' }],
    ['News: Please submit by 10/13/2026', {}],
    ['AI 晨报 请大家完成10/13分享', {}],
    ['Other wrote: Please submit by 10/13/2026', {}],
    ['<root>Please submit by 10/13/2026</root>', {}],
    ['Someone posted in group > Please submit by 10/13/2026', {}],
    ['Please join the meeting 10/13/2026', {}],
    ['请使用链接加入会议 10/13/2026', {}],
    ['Please submit 10/13/2026', { origin: 'agent' }],
    ['Please submit 10/13/2026', { origin: 'system' }],
    ['Please submit 10/13/2026', { origin: 'untrusted' }],
    ['Please submit 10/13/2026', { audience: 'others' }],
    ['Please submit 10/13/2026', { audience: 'unknown' }],
    ['Please submit 10/13/2026', { ownerAuthored: true }],
  ] as const;
  it.each(negatives)('suppresses %s', (text, extra) =>
    expect(triageAttention(input(text, extra))).toBeNull(),
  );
});
describe('audience', () => {
  it.each([
    ['@Owner Please submit', 'me', {}],
    ['@Team Please submit', 'team_including_me', {}],
    ['请大家提交', 'team_including_me', {}],
    ['Team, please submit', 'team_including_me', {}],
    ['Everyone please reply', 'team_including_me', {}],
    ['Hi all please complete', 'team_including_me', {}],
    ['@Other please reply', 'others', {}],
    ['Please reply', 'unknown', {}],
    ['Please reply', 'me', { isDirectMessage: true }],
    ['Please reply', 'me', { replyToOwner: true }],
    ['大家请完成', 'team_including_me', {}],
    ['@Other请完成', 'others', {}],
  ] as const)('%s -> %s', (text, expected, meta) =>
    expect(inferAudience(text, meta, ['Owner'])).toBe(expected),
  );
});
describe('dedup', () => {
  it.each(Array.from({ length: 8 }, (_, i) => i))(
    'one card/ledger across duplicate source %s',
    (i) => {
      const item = message(`a${i}`);
      const other = message(
        `b${i}`,
        '@Team Please submit Q4 Goal Setting。Deadline 10/13/2026',
      );
      expect(other.id).toBe(item.id);
      expect(
        db.prepare('SELECT count(*) AS n FROM attention_items').get(),
      ).toEqual({ n: 1 });
      expect(service.listForPosts([`a${i}`, `b${i}`], at)).toHaveLength(1);
      service.decide(item.id, 'accepted', at);
      service.decide(other.id, 'remind', at);
      expect(
        db.prepare('SELECT count(*) AS n FROM proposed_actions').get(),
      ).toEqual({ n: 1 });
    },
  );
  it('persists not relevant across later mirrored sources', () => {
    const item = message('a');
    service.decide(item.id, 'not_relevant', at);
    expect(message('b').status).toBe('dismissed');
    expect(service.listForPosts(['a', 'b'], at)).toHaveLength(0);
  });
});
describe('lifecycle', () => {
  it('never creates a task before explicit acceptance', () => {
    message('a');
    expect(
      db.prepare('SELECT count(*) AS n FROM proposed_actions').get(),
    ).toEqual({ n: 0 });
  });
  it('accepts only a scoped item', () => {
    const item = message('a');
    expect(new AttentionService(db, 'other').get(item.id)).toBeUndefined();
    expect(() =>
      new AttentionService(db, 'other').decide(item.id, 'accepted', at),
    ).toThrow();
  });
  it('reminder-only is an explicit persisted choice', () => {
    const a = service.decide(message('a').id, 'remind', at)!;
    expect(
      JSON.parse(
        (
          db
            .prepare('SELECT params_json FROM proposed_actions WHERE id=?')
            .get(a.accepted_action_id) as any
        ).params_json,
      ).reminderOnly,
    ).toBe(true);
  });
  it('fires exactly three times with a 24h cooldown', () => {
    const item = message('a');
    service.decide(item.id, 'accepted', at);
    const plan = reminderPlan(due, tz);
    expect(service.dueCandidates(plan[0] - 1)).toHaveLength(0);
    for (const t of plan) {
      expect(service.dueCandidates(t)).toHaveLength(1);
      expect(service.recordFire(item.id, t)).toBe(true);
      expect(service.recordFire(item.id, t + 1)).toBe(false);
      expect(service.dueCandidates(t + 86399)).toHaveLength(0);
    }
    expect(service.get(item.id)?.status).toBe('done');
    expect(service.dueCandidates(plan[2] + 86400)).toHaveLength(0);
  });
  it('filtering a candidate spends no fire budget', () => {
    const item = message('a');
    service.decide(item.id, 'accepted', at);
    service.dueCandidates(reminderPlan(due, tz)[0]);
    expect(service.get(item.id)?.fire_count).toBe(0);
  });
  it('missed reminders do not burst when the service returns late', () => {
    const item = message('a');
    service.decide(item.id, 'accepted', at);
    const late = reminderPlan(due, tz)[2] + 3600;
    expect(service.dueCandidates(late)).toHaveLength(1);
    service.recordFire(item.id, late);
    expect(service.dueCandidates(late + 1)).toHaveLength(0);
  });
  it('expiry is seven days after due', () => {
    const item = message('a');
    service.maintain(due + 7 * 86400);
    expect(service.get(item.id)?.status).toBe('expired');
  });
  it('cancellation is durable across ingest and decisions', () => {
    const item = message('a');
    service.decide(item.id, 'accepted', at);
    service.decide(item.id, 'cancelled', at + 1);
    expect(message('b').status).toBe('cancelled');
    expect(service.decide(item.id, 'accepted', at + 2)?.status).toBe(
      'cancelled',
    );
  });
  it('Task Center cancellation immediately closes the attention ledger', () => {
    const item = service.decide(message('a').id, 'accepted', at)!;
    new ActionRepository(db).cancel(item.accepted_action_id!);
    expect(service.get(item.id)?.status).toBe('cancelled');
  });
  it('requires owner completion evidence in the exact thread', () => {
    const item = message('a');
    service.decide(item.id, 'accepted', at);
    message('wrong', 'done', {
      origin: 'observed',
      timestamp: at + 10,
      replyToPostId: 'a',
    });
    message('unrelated', 'done', {
      origin: 'owner',
      timestamp: at + 11,
      replyToPostId: 'wrong',
    });
    expect(service.reconcile(at + 12).completed).toBe(0);
    message('evidence', 'done', {
      origin: 'owner',
      timestamp: at + 15,
      replyToPostId: 'a',
    });
    expect(service.reconcile(at + 16).completed).toBe(1);
    expect(service.get(item.id)?.status).toBe('completed');
  });
  it('does not interpret conversation as cancellation or negated completion', () => {
    const item = message('a');
    service.decide(item.id, 'accepted', at);
    message('reply', 'not done, cancel this', {
      origin: 'owner',
      timestamp: at + 1,
      replyToPostId: 'a',
    });
    expect(service.reconcile(at + 2).completed).toBe(0);
    expect(service.get(item.id)?.status).toBe('armed');
  });
  it('shadow hides cards and reminders; rollback preserves accepted actions', () => {
    const item = message('a');
    service.decide(item.id, 'accepted', at);
    process.env.ATTENTION_TRIAGE_ENABLED = 'shadow';
    expect(service.listForPosts(['a'], at)).toEqual([]);
    expect(service.dueCandidates(due)).toEqual([]);
    expect(service.get(item.id)?.accepted_action_id).toBeTruthy();
  });
});
describe('side effects', () => {
  it.each(['owner', 'observed', 'agent', 'system', 'untrusted'])(
    'source %s never emits outbound or read-state mutations',
    (origin) => {
      message('source', '@Team 请大家完成提交。Deadline 10/13/2026', {
        origin,
      });
      expect(
        db.prepare('SELECT count(*) AS n FROM proposed_actions').get(),
      ).toEqual({ n: 0 });
      expect(
        db.prepare('SELECT count(*) AS n FROM attention_items').get(),
      ).toEqual({
        n: ['owner', 'agent', 'system', 'untrusted'].includes(origin) ? 0 : 1,
      });
    },
  );
  it('passive capture never writes durable identity', () => {
    message('source');
    expect(
      db
        .prepare(
          "SELECT count(*) AS n FROM user_profile_items WHERE item_key IN ('manager','role') AND user_confirmed=1",
        )
        .get(),
    ).toEqual({ n: 0 });
  });
});
describe('real seed review', () => {
  const seeds = JSON.parse(
    fs.readFileSync(
      new URL('../../evals/attention-triage/seeds.json', import.meta.url),
      'utf8',
    ),
  ) as Array<{
    id: string;
    text: string;
    timestamp: number;
    origin: string;
    expected: boolean;
  }>;
  it('meets recall and false-positive gates on 60 reviewed semantic seeds', () => {
    expect(seeds).toHaveLength(60);
    let positives = 0,
      negatives = 0,
      tp = 0,
      fp = 0;
    for (const seed of seeds) {
      const audience =
        seed.origin === 'owner'
          ? 'me'
          : inferAudience(seed.text, {}, ['Owner']);
      const found = !!triageAttention(
        input(seed.text, {
          timestamp: seed.timestamp,
          now: seed.timestamp + 1,
          origin: seed.origin,
          audience,
          ownerAuthored: seed.origin === 'owner',
        }),
      );
      if (seed.expected) {
        positives++;
        if (found) tp++;
      } else {
        negatives++;
        if (found) fp++;
      }
    }
    expect(tp / positives).toBeGreaterThanOrEqual(0.85);
    expect(fp / negatives).toBeLessThanOrEqual(0.15);
  });
});

describe('date edge cases', () => {
  it.each(['本周二', '上周五', 'last Friday', '2026-02-30'])(
    'rejects past or invalid explicit deadline %s',
    (date) =>
      expect(
        triageAttention(input(`Please submit. Deadline ${date}`)),
      ).toBeNull(),
  );
  it('day after tomorrow is two days away', () =>
    expect(parseAttentionDates('day after tomorrow', at, tz)).toEqual([
      wallTime(2026, 10, 11, 23, tz) + 3599,
    ]));
  it('uses the deadline span instead of an incidental historical date', () =>
    expect(
      triageAttention(
        input('The 2025-01-01 template. Please submit. Deadline 10/13/2026'),
      )?.due_at,
    ).toBe(due));
});

describe('identity confirmation', () => {
  it('only an explicit click writes manager and its social mirror atomically', () => {
    db.prepare(
      "INSERT OR IGNORE INTO entities(id,name,type,created_at) VALUES ('attention-manager','Manager','person',?)",
    ).run(at);
    const item = message('a');
    expect(item.sender_entity_id).toBe('attention-manager');
    service.confirmIdentity(
      item.id,
      'manager',
      'ignored_untrusted_client_value',
      at,
    );
    const profile = db
      .prepare(
        "SELECT item_value,user_confirmed FROM user_profile_items WHERE item_key='manager' AND status='active'",
      )
      .get() as any;
    expect(JSON.parse(profile.item_value).entityId).toBe('attention-manager');
    expect(profile.user_confirmed).toBe(1);
    expect(
      db
        .prepare(
          "SELECT user_confirmed FROM social_edges WHERE to_entity_id='attention-manager' AND relation_type='manager' AND valid_to IS NULL",
        )
        .get(),
    ).toEqual({ user_confirmed: 1 });
    service.confirmIdentity(item.id, 'role', '敏捷教练', at + 1);
    expect(
      db
        .prepare(
          "SELECT item_value FROM user_profile_items WHERE item_key='role' AND status='active'",
        )
        .get(),
    ).toEqual({ item_value: '敏捷教练' });
    db.prepare(
      "DELETE FROM social_edges WHERE to_entity_id='attention-manager'",
    ).run();
    db.prepare(
      "DELETE FROM user_profile_items WHERE item_key IN ('manager','role')",
    ).run();
  });
});

describe('notification persistence', () => {
  it('rolls back budget when the surrounding notification transaction fails', () => {
    const item = message('a');
    service.decide(item.id, 'accepted', at);
    expect(() =>
      db.transaction(() => {
        service.recordFire(item.id, reminderPlan(due, tz)[0]);
        throw new Error('insert_failed');
      })(),
    ).toThrow('insert_failed');
    expect(service.get(item.id)?.fire_count).toBe(0);
  });
  it('never exceeds three attention notifications in a local day', () => {
    const item = message('a');
    service.decide(item.id, 'accepted', at);
    const t = reminderPlan(due, tz)[0];
    for (let i = 0; i < 3; i++)
      db.prepare(
        "INSERT INTO notification_records(id,channel,type,title,body,payload_json,created_at) VALUES (?,'chrome_notification','deadline','test','test',?,?)",
      ).run(
        `attention-budget-${i}`,
        JSON.stringify({ attentionItemId: `other-${i}` }),
        t,
      );
    expect(service.recordFire(item.id, t)).toBe(false);
    db.prepare(
      "DELETE FROM notification_records WHERE id LIKE 'attention-budget-%'",
    ).run();
  });
});

describe('kind contracts', () => {
  it('open questions without a request use seven calendar days', () => {
    const result = triageAttention(
      input('Which release approach should we choose?', {
        kinds: ['open_question'],
      }),
    );
    expect(result?.kind).toBe('open_question');
    expect(result?.due_at).toBe(wallTime(2026, 10, 16, 23, tz) + 3599);
  });
  it('a direct request takes priority over an extracted open_question tag', () =>
    expect(
      triageAttention(
        input('Please share the proposal', { kinds: ['open_question'] }),
      )?.kind,
    ).toBe('request'));
  it('owner commitments use three workdays and owner waits use two', () => {
    const commitment = triageAttention(
      input('I will deliver the proposal', { ownerAuthored: true }),
    );
    const waiting = triageAttention(
      input('Could you share the proposal?', { ownerAuthored: true }),
    );
    expect(commitment?.kind).toBe('commitment');
    expect(commitment?.due_at).toBe(wallTime(2026, 10, 14, 23, tz) + 3599);
    expect(waiting?.kind).toBe('waiting');
    expect(waiting?.due_at).toBe(wallTime(2026, 10, 13, 23, tz) + 3599);
  });
});
