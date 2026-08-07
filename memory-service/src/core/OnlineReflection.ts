/**
 * OnlineReflection — post-interaction reflection that runs asynchronously
 * after each /ask response.
 *
 * Analyses the query, recalled items, and LLM response to:
 *   - Reinforce memories that were actually used in the response
 *   - Detect explicit, user-authored preference candidates
 *   - Suggest improvements for future recall
 *
 * All operations are wrapped in try/catch so that reflection failures
 * never block or delay the user-facing response.
 */

import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { RecallItem } from '../types/index.js';

import { ForgettingEngine } from './ForgettingEngine.js';
import { getLLMClient } from '../llm/LLMClient.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import { contentHash } from '../utils/hashing.js';
import { now } from '../utils/time.js';
import { ReflectionThreadService } from './ReflectionThreadService.js';
import { getUserRuntimeConfig } from '../runtimeConfig.js';
import { segmentMemoryClaims } from './ClaimSegmenter.js';
import { compileMemoryClaimPolicy } from './ClaimPolicyCompiler.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReflectionInput {
  query: string;
  recalledItems: RecallItem[];
  llmResponse: string;
  usedItemIds: string[]; // which recalled items were actually used
}

export interface ReflectionOutput {
  newFacts: Array<{
    entity: string;
    key: string;
    value: string;
    confidence: number;
  }>;
  userPreferences: string[];
  improvements: string[];
  shouldStore: boolean;
}

interface ReflectionLLMResponse {
  newFacts: Array<{
    entity: string;
    key: string;
    value: string;
    confidence: number;
  }>;
  userPreferences: string[];
  improvements: string[];
  shouldStore: boolean;
}

// ---------------------------------------------------------------------------
// OnlineReflection
// ---------------------------------------------------------------------------

export class OnlineReflection {
  private db: Database.Database;
  private userDataManager?: UserDataManager;

  constructor(db: Database.Database, userDataManager?: UserDataManager) {
    this.db = db;
    this.userDataManager = userDataManager;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Run post-interaction reflection.
   *
   * This method is designed to be called fire-and-forget after the /ask
   * response has been sent to the user.  It never throws — all errors are
   * caught and logged.
   */
  async reflect(input: ReflectionInput): Promise<void> {
    try {
      await this.doReflect(input);
    } catch (err) {
      console.error('[OnlineReflection] Reflection failed (non-blocking):', err);
    }
  }

  // =========================================================================
  // Internal
  // =========================================================================

  private async doReflect(input: ReflectionInput): Promise<void> {
    if (!getUserRuntimeConfig(this.userDataManager).reflectionEnabled) {
      return;
    }

    const { query, recalledItems, llmResponse, usedItemIds } = input;
    const queryClaims = segmentMemoryClaims({
      content: query,
      sourceType: 'manual',
      metadata: { role: 'user', ownerAuthored: true },
    }).map((claim) => ({
      claim,
      policy: compileMemoryClaimPolicy(claim),
    }));
    const eligibleProfileClaims = queryClaims.filter(
      ({ policy }) => policy.profileCandidate,
    );
    const profileEvidence = eligibleProfileClaims
      .map(({ claim }) => claim.sourceText.trim())
      .filter(Boolean);
    const profileEvidenceText = profileEvidence.join(' ');

    // Step 1: Reinforce used memories
    const forgettingEngine = new ForgettingEngine(this.db);
    for (const itemId of usedItemIds) {
      try {
        const targetType = /^\d+$/.test(itemId) ? 'chunk' : 'message';
        forgettingEngine.reinforceMemory(targetType, itemId);
      } catch (err) {
        console.warn(`[OnlineReflection] Failed to reinforce memory ${itemId}:`, err);
      }
    }

    // Step 2: Call LLM for reflection
    const responsePreview = llmResponse.length > 500
      ? llmResponse.slice(0, 500) + '...'
      : llmResponse;

    const prompt = `The user asked a question. The only user-authored profile claims eligible for reflection are: "${profileEvidenceText || '[none]'}"
System recalled ${recalledItems.length} memories, used ${usedItemIds.length} of them.
System answered: "${responsePreview}"

Quick reflection:
1. Was the answer accurate and complete? Anything important missed?
2. Do not infer entity facts from recalled memories or the system answer.
3. Only record a preference when it is stated verbatim in the eligible profile claims. If the eligible set is empty, userPreferences and newFacts must be empty.
Return JSON: { "newFacts": [{"entity":"..","key":"..","value":"..","confidence":0.7}], "userPreferences": [], "improvements": [], "shouldStore": true/false }`;

    const llm = getLLMClient();
    let reflectionData: ReflectionLLMResponse;

    try {
      reflectionData = await llm.generateJSON<ReflectionLLMResponse>(prompt, {
        maxTokens: 800,
        temperature: 0.3,
      });
    } catch (err) {
      console.warn('[OnlineReflection] LLM reflection call failed:', err);
      return;
    }

    // Step 3: Ask is not a lineage-bearing fact source.
    // Ask reflection has no persisted source message/claim revision. Entity
    // truth therefore stays read-only here; it must enter through a source that
    // can carry claim lineage and correction semantics.
    const newFacts: ReflectionLLMResponse['newFacts'] = [];

    // Step 4: Persist only preferences grounded in eligible query claims.
    const userPreferences = filterGroundedPreferences(
      reflectionData.userPreferences,
      profileEvidence,
    );
    if (userPreferences.length > 0) {
      try {
        this.writePreferencesToDb(userPreferences);
      } catch (err) {
        console.warn('[OnlineReflection] Failed to write preferences to DB:', err);
      }

    }

    // Log improvements for debugging / future use
    const improvements = reflectionData.improvements ?? [];
    if (improvements.length > 0) {
      console.log(
        `[OnlineReflection] Suggested improvements: ${improvements.join('; ')}`,
      );
    }

    const reflectionService = new ReflectionThreadService(this.db, this.userDataManager);
    reflectionService.recordOnlineReflectionSignal(input, {
      newFacts,
      userPreferences,
      improvements,
      shouldStore: reflectionData.shouldStore ?? false,
    });
  }

  // =========================================================================
  // Profile DB write helpers
  // =========================================================================

  /**
   * Write user preferences to user_profile_items as structured DB rows.
   * For each preference string, derive a key and upsert by fingerprint.
   */
  private writePreferencesToDb(preferences: string[], contextMessageId?: string): void {
    const currentTime = now();

    for (const pref of preferences) {
      const itemKey = this.derivePreferenceKey(pref);
      const normalised = pref.toLowerCase().trim();
      const fingerprint = contentHash('preference:' + normalised);

      const existing = this.db
        .prepare(
          `SELECT id, mention_count, evidence_refs, salience_score, status
           FROM user_profile_items
           WHERE fingerprint = ?
           LIMIT 1`,
        )
        .get(fingerprint) as
        | {
            id: string;
            mention_count: number;
            evidence_refs: string | null;
            salience_score: number;
            status: string;
          }
        | undefined;

      if (existing) {
        // Reflection may reinforce only another unconfirmed candidate. It
        // must not silently mutate a preference the user already confirmed,
        // retracted or archived.
        if (existing.status !== 'pending_confirm') continue;
        const newMentionCount = existing.mention_count + 1;
        const evidenceRefs: Array<{ messageId?: string; ts: number }> = existing.evidence_refs
          ? JSON.parse(existing.evidence_refs)
          : [];
        if (contextMessageId) {
          evidenceRefs.push({ messageId: contextMessageId, ts: currentTime });
        }

        const confidence = 0.7;
        const frequencyNorm = Math.min(newMentionCount / 10, 1.0);
        const recency = 1.0;
        const confirmationBonus = 0.1;
        const salience =
          0.4 * confidence +
          0.3 * frequencyNorm +
          0.2 * recency +
          0.1 * confirmationBonus;

        this.db
          .prepare(
            `UPDATE user_profile_items
             SET mention_count = ?,
                 last_seen = ?,
                 salience_score = ?,
                 evidence_refs = ?,
                 updated_at = ?
             WHERE id = ?
               AND status = 'pending_confirm'`,
          )
          .run(
            newMentionCount,
            currentTime,
            salience,
            JSON.stringify(evidenceRefs),
            currentTime,
            existing.id,
          );
      } else {
        // Insert new preference
        const id = uuidv4();
        const confidence = 0.7;
        const frequencyNorm = 1 / 10;
        const recency = 1.0;
        const confirmationBonus = 0;
        const salience =
          0.4 * confidence +
          0.3 * frequencyNorm +
          0.2 * recency +
          0.1 * confirmationBonus;

        const evidenceRefs = contextMessageId
          ? JSON.stringify([{ messageId: contextMessageId, ts: currentTime }])
          : JSON.stringify([]);

        this.db
          .prepare(
            `INSERT INTO user_profile_items
              (id, item_type, item_key, item_value, fingerprint,
               source_kind, confidence, salience_score,
               mention_count, last_seen, evidence_refs,
               user_confirmed, status, created_at, updated_at)
             VALUES (?, 'preference', ?, ?, ?, 'inferred', ?, ?, 1, ?, ?, 0, 'pending_confirm', ?, ?)`,
          )
          .run(
            id,
            itemKey,
            pref,
            fingerprint,
            confidence,
            salience,
            currentTime,
            evidenceRefs,
            currentTime,
            currentTime,
          );
      }

      // Mark profile as dirty
      try {
        this.db
          .prepare(`UPDATE profile_sync_state SET profile_dirty = 1`)
          .run();
      } catch {
        // Table may not exist yet — safe to ignore
      }
    }
  }

  /**
   * Derive a semantic key from a preference text string.
   */
  private derivePreferenceKey(pref: string): string {
    const lower = pref.toLowerCase();

    if (/简洁|concise|brief/.test(lower)) return 'response_style';
    if (/时间|time|hour/.test(lower)) return 'work_hours';
    if (/语言|language|中文|english/.test(lower)) return 'language_preference';

    return 'general_preference';
  }
}

function normalizeGroundingText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/^\s*(?:[-*+]\s+|\d+[.)、]\s*)/u, '')
    .replace(/\s+/gu, ' ')
    .replace(/[。.!！？?；;，,]+$/u, '')
    .trim()
    .toLocaleLowerCase();
}

function filterGroundedPreferences(
  rawPreferences: unknown,
  eligibleEvidence: string[],
): string[] {
  if (!Array.isArray(rawPreferences) || eligibleEvidence.length === 0) {
    return [];
  }

  const normalizedEvidence = eligibleEvidence
    .map(normalizeGroundingText)
    .filter(Boolean);
  const seen = new Set<string>();
  const grounded: string[] = [];
  for (const rawPreference of rawPreferences) {
    if (typeof rawPreference !== 'string') continue;
    const preference = rawPreference.trim();
    const normalized = normalizeGroundingText(preference);
    if (!normalized || seen.has(normalized)) continue;
    const supported = normalizedEvidence.some(
      (evidence) => evidence === normalized || evidence.includes(normalized),
    );
    if (!supported) continue;
    seen.add(normalized);
    grounded.push(preference);
  }
  return grounded;
}
