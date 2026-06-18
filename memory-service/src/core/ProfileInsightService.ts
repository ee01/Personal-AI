import type Database from 'better-sqlite3';

import type { LLMClient } from '../llm/LLMClient.js';
import { ProfileManager } from './ProfileManager.js';
import { buildRecentFocusBlock } from './RecentFocusService.js';

/**
 * ProfileInsightService (QW-2) — a "dialectic" query over the user model.
 *
 * Inspired by Plastic Labs' Honcho: instead of returning a list of raw profile
 * rows, answer a natural-language question about how the user thinks / what
 * they would prefer, and return a *synthesized insight* plus a confidence and a
 * basis count. It never echoes raw evidence text — only the synthesis.
 *
 * Boundaries:
 * - Reads confirmed profile (renderUserCore) + recent rolling signals only.
 * - Confidence is capped by how much basis exists (sparse profile → low cap),
 *   so a near-empty profile can't produce a confident-sounding fabrication.
 * - Returns available:false (not a guess) when there is no profile signal.
 */

export interface ProfileInsightResult {
  available: boolean;
  insight: string;
  confidence: number;
  /** Count of profile/recency signals behind the insight (not raw text). */
  basisCount: number;
  /** Which facets contributed, e.g. ['confirmed_profile','recent_focus']. */
  aspectsUsed: string[];
  reason?: string;
}

interface LlmInsight {
  insight?: string;
  confidence?: number;
  aspectsUsed?: string[];
}

const INSIGHT_SYSTEM_PROMPT = `You model a single user based on their confirmed profile and recent activity.
Answer how THIS user would likely think, decide, or prefer regarding the question.

Rules:
- Synthesize an insight in the user's terms; do NOT quote or paste raw evidence lines.
- Ground the insight only in the provided profile/context. If the context is thin, say so and lower confidence.
- Never invent concrete facts (names, numbers, dates) that are not in the context.
- Return a JSON object: { "insight": "...", "confidence": 0.0, "aspectsUsed": ["confirmed_profile"|"recent_focus"|"writing_style"|...] }
- Keep "insight" to 1-3 sentences. Keep "confidence" between 0 and 1.`;

export class ProfileInsightService {
  constructor(
    private db: Database.Database,
    private profileManager: ProfileManager,
    private llm: Pick<LLMClient, 'generateJSON'>,
  ) {}

  /** Count confirmed, active profile items that can back an insight. */
  private confirmedItemCount(): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count
           FROM user_profile_items
          WHERE status = 'active' AND user_confirmed = 1`,
      )
      .get() as { count: number } | undefined;
    return row?.count ?? 0;
  }

  async answer(
    question: string,
    options: { aspect?: string; timeoutMs?: number } = {},
  ): Promise<ProfileInsightResult> {
    const trimmedQuestion = (question ?? '').trim();
    if (!trimmedQuestion) {
      return {
        available: false,
        insight: '',
        confidence: 0,
        basisCount: 0,
        aspectsUsed: [],
        reason: 'empty_question',
      };
    }

    const profileCore = this.profileManager.renderUserCore(50);
    const recentFocus = buildRecentFocusBlock(this.db);
    const confirmedCount = this.confirmedItemCount();
    // Recent profile signals overlap with confirmedCount, so only count recent
    // messages + reflections as additional basis (avoid double-counting).
    const recentNonProfile = recentFocus.sourceRefs.filter(
      (ref) => ref.startsWith('message:') || ref.startsWith('reflection:'),
    ).length;
    const basisCount = confirmedCount + recentNonProfile;

    if (basisCount === 0) {
      return {
        available: false,
        insight: '',
        confidence: 0,
        basisCount: 0,
        aspectsUsed: [],
        reason: 'no_profile_signal',
      };
    }

    const contextSections = [
      '## Confirmed user profile',
      profileCore && profileCore.trim().length > 0
        ? profileCore
        : '(no confirmed profile items)',
    ];
    if (recentFocus.itemCount > 0) {
      contextSections.push('', '## Recent activity (rolling, not facts)', recentFocus.bodyMd);
    }

    const aspectLine = options.aspect
      ? `\n\nFocus the insight on this aspect: ${options.aspect}.`
      : '';
    const prompt = `${contextSections.join('\n')}\n\nQuestion: ${trimmedQuestion}${aspectLine}`;

    let llmResult: LlmInsight;
    try {
      llmResult = await this.llm.generateJSON<LlmInsight>(prompt, {
        systemPrompt: INSIGHT_SYSTEM_PROMPT,
        temperature: 0.3,
        maxTokens: 400,
        timeoutMs: options.timeoutMs ?? 9000,
        retryCount: 0,
      });
    } catch {
      return {
        available: false,
        insight: '',
        confidence: 0,
        basisCount,
        aspectsUsed: [],
        reason: 'llm_unavailable',
      };
    }

    const insight = (llmResult.insight ?? '').trim();
    if (!insight) {
      return {
        available: false,
        insight: '',
        confidence: 0,
        basisCount,
        aspectsUsed: [],
        reason: 'no_insight',
      };
    }

    // Cap confidence by available basis: a thin profile can't be highly
    // confident even if the model claims so.
    const rawConfidence = Number.isFinite(llmResult.confidence)
      ? Math.min(1, Math.max(0, llmResult.confidence as number))
      : 0.5;
    const basisCap = basisCount >= 3 ? 1 : basisCount >= 1 ? 0.5 : 0;
    const confidence = Math.min(rawConfidence, basisCap);

    const aspectsUsed = Array.isArray(llmResult.aspectsUsed)
      ? llmResult.aspectsUsed.filter((a): a is string => typeof a === 'string')
      : [];
    if (aspectsUsed.length === 0) {
      aspectsUsed.push('confirmed_profile');
      if (recentFocus.itemCount > 0) aspectsUsed.push('recent_focus');
    }

    return {
      available: true,
      insight,
      confidence,
      basisCount,
      aspectsUsed,
    };
  }
}
