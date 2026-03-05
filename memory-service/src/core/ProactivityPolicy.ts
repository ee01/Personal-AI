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
  action: 'notify' | 'confirm_only' | 'silent' | 'throttled';
  utility: number;
  reason?: string;
}

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

    // 3. Utility = benefit - cost
    const utility = benefit - totalCost;

    // 4. Throttle checks
    const throttleResult = this.checkThrottle(candidate.topicId, throttle);
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
           WHERE status = 'active' AND item_key = 'work_hours'
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
           WHERE status = 'active' AND item_type = 'interest'
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
    };
  }
}
