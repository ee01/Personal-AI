/**
 * ProactivityPolicy -- utility model that decides whether to notify the user.
 *
 * Computes a benefit/cost utility score for each notification candidate and
 * applies throttling rules to prevent notification fatigue.
 *
 * Utility formula:
 *   benefit = w_imp * importance + w_urg * urgency + w_conf * confidence + w_act * actionability
 *   cost    = c_busy * busy + c_quiet * isQuietHours + c_spam * spamPenalty + c_pref * userPrefCost
 *   utility = benefit - cost
 *
 * Decision thresholds:
 *   utility >= 0.40 -> 'notify'          (push to user)
 *   utility >= 0.25 -> 'confirm_only'    (record but don't push)
 *   utility >= 0.10 -> 'silent'          (log only)
 *   below or throttled -> 'throttled'
 */

import type Database from 'better-sqlite3';
import { getConfig } from '../config.js';
import { now } from '../utils/time.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationCandidate {
  type: string;           // 'truth_conflict' | 'project_update' | 'deadline' | 'reminder'
  title: string;
  body: string;
  importance: number;     // 0-1
  urgency: number;        // 0-1
  confidence: number;     // 0-1
  actionability: number;  // 0-1
  topicId?: string;
  relatedEntityId?: string;
  topic?: string;         // topic label used for preference matching
  payload?: Record<string, any>;
}

export interface NotifyDecision {
  action: 'notify' | 'confirm_only' | 'silent' | 'throttled' | 'scheduled';
  utility: number;
  reason?: string;
}

/**
 * Cost-asymmetry matrix (P1-8). miss = cost of NOT surfacing important info;
 * interrupt = base cost of an unwanted interruption; quietSens = how much quiet
 * hours should suppress this type (deadline/conflict are less suppressible).
 * Starter constants — refined by the monthly calibration reflow + audit.
 */
const COST_MATRIX: Record<string, { miss: number; interrupt: number; quietSens: number }> = {
  truth_conflict: { miss: 0.9, interrupt: 0.3, quietSens: 0.4 },
  deadline: { miss: 0.95, interrupt: 0.2, quietSens: 0.3 },
  notify_user: { miss: 0.7, interrupt: 0.4, quietSens: 1.0 },
  project_update: { miss: 0.4, interrupt: 0.6, quietSens: 1.0 },
  property_change: { miss: 0.35, interrupt: 0.6, quietSens: 1.0 },
  dream_digest: { miss: 0.15, interrupt: 0.8, quietSens: 1.0 },
  weekly_report: { miss: 0.15, interrupt: 0.7, quietSens: 1.0 },
};
const COST_MATRIX_DEFAULT = { miss: 0.5, interrupt: 0.5, quietSens: 1.0 };

export interface PolicyConfig {
  weights: {
    importance: number;
    urgency: number;
    confidence: number;
    actionability: number;
  };
  costs: {
    busy: number;
    quietHours: number;
    spamPenalty: number;
    userPrefCost: number;
  };
  thresholds: {
    notify: number;
    confirm: number;
    silent: number;
  };
  throttle: {
    sameTopicMinIntervalMs: number;
    maxDailyNotifications: number;
  };
  /** P1-8: enable the cost-asymmetry utility v2 model. */
  utilityV2: boolean;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_POLICY: PolicyConfig = {
  weights: {
    importance: 0.35,
    urgency: 0.25,
    confidence: 0.20,
    actionability: 0.20,
  },
  costs: {
    busy: 0.3,
    quietHours: 0.5,
    spamPenalty: 0.2,
    userPrefCost: 0.3,
  },
  thresholds: {
    notify: 0.4,
    confirm: 0.25,
    silent: 0.1,
  },
  throttle: {
    sameTopicMinIntervalMs: 86_400_000,   // 24 hours
    maxDailyNotifications: 10,
  },
  // Default OFF — utility v2 is rolled out via shadow mode first (the book's
  // most user-sensitive surface). Enable with PROACTIVITY_UTILITY_V2=true.
  utilityV2: process.env.PROACTIVITY_UTILITY_V2 === 'true',
};

// ---------------------------------------------------------------------------
// Row shapes for SQLite queries
// ---------------------------------------------------------------------------

interface NotificationRow {
  id: string;
  topic_id: string | null;
  sent_at: number | null;
  created_at: number;
}

interface CountRow {
  cnt: number;
}

interface ProfileItemRow {
  id: string;
  item_type: string;
  item_key: string;
  item_value: string;
  salience_score: number;
}

// ---------------------------------------------------------------------------
// ProactivityPolicy
// ---------------------------------------------------------------------------

export class ProactivityPolicy {
  private db: Database.Database;
  private config: PolicyConfig;

  constructor(db: Database.Database, config?: Partial<PolicyConfig>) {
    this.db = db;
    this.config = this.mergeConfig(config);
  }

  // ---- Public API ---------------------------------------------------------

  /**
   * Evaluate a single notification candidate and return a decision.
   */
  async evaluate(candidate: NotificationCandidate): Promise<NotifyDecision> {
    const { weights, costs, thresholds, throttle } = this.config;

    // 1. Compute benefit
    const benefit =
      weights.importance * candidate.importance +
      weights.urgency * candidate.urgency +
      weights.confidence * candidate.confidence +
      weights.actionability * candidate.actionability;

    // 2. Compute cost components
    const quietCost = this.isQuietHours() ? costs.quietHours : 0;
    const spamCost = this.computeSpamPenalty(candidate.topicId) * costs.spamPenalty;
    const busyCost = 0; // No user activity tracking yet
    const prefCost = this.computePreferenceCost(candidate) * costs.userPrefCost;

    const totalCost = busyCost + quietCost + spamCost + prefCost;

    // 4. Throttle checks (shared by v1 and v2).
    const throttleResult = this.checkThrottle(candidate.topicId, throttle);

    // ---- Utility v2 (P1-8: cost-asymmetry) ----
    if (this.config.utilityV2) {
      const m = COST_MATRIX[candidate.type] ?? COST_MATRIX_DEFAULT;
      const needScore = benefit; // same need model as v1 benefit
      const timingCost = quietCost * m.quietSens + spamCost + prefCost;
      const utility =
        needScore * m.miss - (1 - needScore) * m.interrupt * (1 + timingCost);

      if (throttleResult !== null) {
        return { action: 'throttled', utility, reason: throttleResult };
      }
      // Safety-net (the book's core answer): high miss-cost candidates in quiet
      // hours are never pushed at night and never silently dropped — they are
      // deferred to a next-morning scheduled delivery. What we save is the
      // late-night interruption, not the information itself.
      const highMiss = m.miss >= 0.9 && needScore >= 0.5;
      if (highMiss && this.isQuietHours()) {
        return {
          action: 'scheduled',
          utility,
          reason: 'high_miss_cost_deferred_to_morning',
        };
      }
      if (utility >= thresholds.notify) {
        return { action: 'notify', utility };
      }
      if (utility >= thresholds.confirm) {
        return { action: 'confirm_only', utility, reason: 'Below notify threshold (v2)' };
      }
      return { action: 'silent', utility, reason: 'Below confirm threshold (v2)' };
    }

    // ---- Utility v1 (legacy) ----
    const utility = benefit - totalCost;

    if (throttleResult !== null) {
      return { action: 'throttled', utility, reason: throttleResult };
    }

    // 5. Decision based on thresholds
    if (utility >= thresholds.notify) {
      return { action: 'notify', utility };
    }
    if (utility >= thresholds.confirm) {
      return { action: 'confirm_only', utility, reason: 'Below notify threshold' };
    }
    if (utility >= thresholds.silent) {
      return { action: 'silent', utility, reason: 'Below confirm threshold' };
    }

    return { action: 'silent', utility, reason: 'Utility too low' };
  }

  /**
   * Monthly calibration reflow (P1-8 P2): aggregate the last `windowDays` of
   * delivered notifications per type and nudge the COST_MATRIX — raise interrupt
   * for types the user keeps dismissing, raise miss for types they keep clicking.
   * Every change is written to notification_policy_audit (explainable, reversible).
   * Returns the adjustments made. dryRun previews without writing.
   */
  calibrate(options: { windowDays?: number; dryRun?: boolean } = {}): Array<{
    type: string;
    field: 'interrupt' | 'miss';
    oldValue: number;
    newValue: number;
    reason: string;
  }> {
    const windowDays = options.windowDays ?? 30;
    const cutoff = now() - windowDays * 86400;
    const adjustments: Array<{
      type: string;
      field: 'interrupt' | 'miss';
      oldValue: number;
      newValue: number;
      reason: string;
    }> = [];

    let rows: Array<{ type: string; delivered: number; dismissed: number; clicked: number }> = [];
    try {
      rows = this.db
        .prepare(
          `SELECT type AS type,
                  COUNT(*) AS delivered,
                  SUM(CASE WHEN dismissed_at IS NOT NULL THEN 1 ELSE 0 END) AS dismissed,
                  SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) AS clicked
             FROM notification_records
            WHERE created_at >= ?
            GROUP BY type`,
        )
        .all(cutoff) as typeof rows;
    } catch {
      return adjustments;
    }

    for (const r of rows) {
      if (!r.delivered || r.delivered < 5) continue; // too few to learn from
      const base = COST_MATRIX[r.type];
      if (!base) continue;
      const dismissRate = r.dismissed / r.delivered;
      const clickRate = r.clicked / r.delivered;
      if (dismissRate > 0.6 && base.interrupt < 0.9) {
        const newValue = Math.min(0.9, base.interrupt + 0.1);
        adjustments.push({
          type: r.type,
          field: 'interrupt',
          oldValue: base.interrupt,
          newValue,
          reason: `dismissRate ${dismissRate.toFixed(2)} > 0.6`,
        });
      } else if (clickRate > 0.5 && base.miss < 0.95) {
        const newValue = Math.min(0.95, base.miss + 0.05);
        adjustments.push({
          type: r.type,
          field: 'miss',
          oldValue: base.miss,
          newValue,
          reason: `clickRate ${clickRate.toFixed(2)} > 0.5`,
        });
      }
    }

    if (!options.dryRun && adjustments.length > 0) {
      const nowTs = now();
      const insert = this.db.prepare(
        `INSERT INTO notification_policy_audit
           (notification_type, field, old_value, new_value, reason, window_days, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      const tx = this.db.transaction(() => {
        for (const a of adjustments) {
          insert.run(a.type, a.field, a.oldValue, a.newValue, a.reason, windowDays, nowTs);
          // Apply in-memory so the running process reflects it immediately.
          COST_MATRIX[a.type][a.field] = a.newValue;
        }
      });
      tx();
    }

    return adjustments;
  }

  /**
   * Filter a list of candidates, keeping only those that should be delivered.
   */
  async filterNotifications(candidates: NotificationCandidate[]): Promise<NotificationCandidate[]> {
    const approved: NotificationCandidate[] = [];

    for (const candidate of candidates) {
      try {
        const decision = await this.evaluate(candidate);
        if (decision.action === 'notify') {
          approved.push(candidate);
        }
      } catch (err) {
        console.error(
          `[ProactivityPolicy] Error evaluating candidate "${candidate.title}":`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return approved;
  }

  // ---- Private helpers ----------------------------------------------------

  /**
   * Check whether the current local hour falls within quiet hours.
   *
   * Quiet hours wrap around midnight, e.g. start=22, end=8 means
   * 22:00..23:59 and 00:00..07:59 are quiet.
   */
  private isQuietHours(): boolean {
    const appConfig = getConfig();
    const start = appConfig.quietHoursStart;
    const end = appConfig.quietHoursEnd;
    const currentHour = new Date().getHours();

    if (start <= end) {
      // Simple range, e.g. 1..6
      return currentHour >= start && currentHour < end;
    }

    // Wraps around midnight, e.g. 22..8
    return currentHour >= start || currentHour < end;
  }

  /**
   * Compute a spam penalty (0-1) based on how many notifications with the
   * same topicId were sent in the last 24 hours.
   *
   * Returns 0 when topicId is undefined (no topic = no spam tracking).
   * Penalty scales: 0 recent = 0, 1 recent = 0.5, 2+ recent = 1.0.
   */
  private computeSpamPenalty(topicId: string | undefined): number {
    if (!topicId) {
      return 0;
    }

    const oneDayAgo = now() - 86_400; // 24 hours in seconds

    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS cnt
         FROM notification_records
         WHERE topic_id = ? AND created_at > ?`,
      )
      .get(topicId, oneDayAgo) as CountRow | undefined;

    const count = row?.cnt ?? 0;

    if (count === 0) return 0;
    if (count === 1) return 0.5;
    return 1.0;
  }

  /**
   * Compute a preference alignment cost (0-1) based on user_profile_items.
   *
   * Returns 0 when the candidate is fully aligned with user preferences
   * and up to 1 when it works against them.
   *
   * Two factors are considered:
   *  - Quiet / work-hours preference: if the user has an item_key='work_hours'
   *    and the current time falls outside those hours, a penalty is applied.
   *  - Interest alignment: if the candidate's topic or body matches user
   *    interest items, the cost is reduced (better alignment).
   */
  private computePreferenceCost(candidate: NotificationCandidate): number {
    let cost = 0.5; // Neutral starting point

    try {
      // --- Work-hours preference check ---
      const workHoursRow = this.db
        .prepare(
          `SELECT item_value FROM user_profile_items
           WHERE status = 'active' AND user_confirmed = 1 AND item_key = 'work_hours'
           LIMIT 1`,
        )
        .get() as { item_value: string } | undefined;

      if (workHoursRow) {
        // Expected format: "9-18" (startHour-endHour)
        const match = workHoursRow.item_value.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = parseInt(match[2], 10);
          const currentHour = new Date().getHours();
          const withinWorkHours = start <= end
            ? currentHour >= start && currentHour < end
            : currentHour >= start || currentHour < end;
          if (!withinWorkHours) {
            cost += 0.3; // Higher cost: notification is outside preferred hours
          }
        }
      }

      // --- Interest alignment check ---
      const interestRows = this.db
        .prepare(
          `SELECT item_value FROM user_profile_items
           WHERE status = 'active' AND user_confirmed = 1 AND item_type = 'interest'
           ORDER BY salience_score DESC
           LIMIT 20`,
        )
        .all() as Array<{ item_value: string }>;

      if (interestRows.length > 0) {
        const searchText = `${candidate.topic ?? ''} ${candidate.body} ${candidate.title}`.toLowerCase();
        let matchCount = 0;

        for (const row of interestRows) {
          if (searchText.includes(row.item_value.toLowerCase())) {
            matchCount++;
          }
        }

        // More interest matches = lower cost (better alignment)
        // Each match reduces cost by 0.2, up to 0.5 total reduction
        const interestDiscount = Math.min(matchCount * 0.2, 0.5);
        cost -= interestDiscount;
      }
    } catch {
      // DB query failed — return neutral cost
      return 0.5;
    }

    return Math.max(0, Math.min(1, cost));
  }

  /**
   * Check throttle conditions and return a reason string if throttled,
   * or null if not throttled.
   */
  private checkThrottle(
    topicId: string | undefined,
    throttle: PolicyConfig['throttle'],
  ): string | null {
    // Check daily notification limit
    const todayStart = this.getStartOfDayEpoch();
    const dailyRow = this.db
      .prepare(
        `SELECT COUNT(*) AS cnt
         FROM notification_records
         WHERE created_at >= ?`,
      )
      .get(todayStart) as CountRow | undefined;

    const dailyCount = dailyRow?.cnt ?? 0;
    if (dailyCount >= throttle.maxDailyNotifications) {
      return `Daily notification limit reached (${dailyCount}/${throttle.maxDailyNotifications})`;
    }

    // Check same-topic minimum interval
    if (topicId) {
      const minIntervalSec = throttle.sameTopicMinIntervalMs / 1000;
      const cutoff = now() - minIntervalSec;

      const lastNotif = this.db
        .prepare(
          `SELECT sent_at, created_at
           FROM notification_records
           WHERE topic_id = ? AND created_at > ?
           ORDER BY created_at DESC
           LIMIT 1`,
        )
        .get(topicId, cutoff) as NotificationRow | undefined;

      if (lastNotif) {
        return `Same topic notified too recently (topic: ${topicId})`;
      }
    }

    return null;
  }

  /**
   * Get the Unix timestamp (seconds) for the start of today (midnight local).
   */
  private getStartOfDayEpoch(): number {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  }

  /**
   * Deep-merge a partial config over the defaults.
   */
  private mergeConfig(partial?: Partial<PolicyConfig>): PolicyConfig {
    if (!partial) {
      return { ...DEFAULT_POLICY };
    }

    return {
      weights: { ...DEFAULT_POLICY.weights, ...partial.weights },
      costs: { ...DEFAULT_POLICY.costs, ...partial.costs },
      thresholds: { ...DEFAULT_POLICY.thresholds, ...partial.thresholds },
      throttle: { ...DEFAULT_POLICY.throttle, ...partial.throttle },
      utilityV2: partial.utilityV2 ?? DEFAULT_POLICY.utilityV2,
    };
  }
}
