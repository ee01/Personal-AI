/**
 * v3 strict extraction contract (memory-foundation plan §6.4).
 *
 * The LLM must return 0..N candidates under this exact shape;
 * additionalProperties=false semantics are enforced by key whitelisting.
 * A strict-parse failure is a retryable contract violation — never a
 * "first-sentence fact" fallback (plan §6.4).
 */

export interface ExtractionCandidate {
  memoryForm: 'semantic' | 'episodic' | 'procedural';
  kind:
    | 'note' | 'fact' | 'preference' | 'decision' | 'action_item'
    | 'event' | 'risk' | 'open_question' | 'opinion' | 'procedure'
    | 'insight' | 'brief';
  subjectKey: string;
  predicateKey: string;
  text: string;
  /** Byte half-open span [start, end) into the episode's persisted body. */
  spanStart: number;
  spanEnd: number;
  language?: string;
  /** Full timestamp (epoch seconds) or null — never a bare date. */
  observedAt?: number | null;
}

export interface ExtractionBatch {
  contractVersion: string;
  /** 0 candidates is a SUCCESS state and must carry a reason. */
  candidates: ExtractionCandidate[];
  skipReason?: string;
}

export const EXTRACTION_CONTRACT_VERSION = 'extraction-contract-v1';

const MEMORY_FORMS = new Set(['semantic', 'episodic', 'procedural']);
const KINDS = new Set([
  'note', 'fact', 'preference', 'decision', 'action_item', 'event',
  'risk', 'open_question', 'opinion', 'procedure', 'insight', 'brief',
]);

export type ContractViolation =
  | { ok: false; reason: string; retryable: boolean }
  | { ok: true };

export function parseExtractionBatch(
  raw: unknown,
  episodeByteLength: number,
): { ok: true; batch: ExtractionBatch } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'extraction output must be a JSON object' };
  }
  const obj = raw as Record<string, unknown>;
  const candidatesRaw = obj.candidates;
  if (!Array.isArray(candidatesRaw)) {
    return { ok: false, reason: 'extraction output must carry a candidates array (0..N)' };
  }
  const candidates: ExtractionCandidate[] = [];
  for (const [idx, cRaw] of candidatesRaw.entries()) {
    if (!cRaw || typeof cRaw !== 'object' || Array.isArray(cRaw)) {
      return { ok: false, reason: `candidate ${idx} is not an object` };
    }
    const c = cRaw as Record<string, unknown>;
    for (const key of Object.keys(c)) {
      // additionalProperties=false: reject fields outside the whitelist.
      if (!['memoryForm', 'kind', 'subjectKey', 'predicateKey', 'text',
            'spanStart', 'spanEnd', 'language', 'observedAt'].includes(key)) {
        return { ok: false, reason: `candidate ${idx} has unknown field "${key}"` };
      }
    }
    if (typeof c.memoryForm !== 'string' || !MEMORY_FORMS.has(c.memoryForm)) {
      return { ok: false, reason: `candidate ${idx} memoryForm invalid` };
    }
    if (typeof c.kind !== 'string' || !KINDS.has(c.kind)) {
      return { ok: false, reason: `candidate ${idx} kind invalid` };
    }
    if (typeof c.subjectKey !== 'string' || !c.subjectKey.trim()) {
      return { ok: false, reason: `candidate ${idx} subjectKey missing` };
    }
    if (typeof c.predicateKey !== 'string' || !c.predicateKey.trim()) {
      return { ok: false, reason: `candidate ${idx} predicateKey missing` };
    }
    if (typeof c.text !== 'string' || !c.text.trim()) {
      return { ok: false, reason: `candidate ${idx} text missing` };
    }
    if (typeof c.spanStart !== 'number' || typeof c.spanEnd !== 'number') {
      return { ok: false, reason: `candidate ${idx} span must be byte numbers` };
    }
    if (
      !Number.isInteger(c.spanStart) || !Number.isInteger(c.spanEnd) ||
      c.spanStart < 0 || c.spanEnd <= c.spanStart ||
      c.spanEnd > episodeByteLength
    ) {
      return { ok: false, reason: `candidate ${idx} span out of episode range` };
    }
    if (c.observedAt !== undefined && c.observedAt !== null &&
        (typeof c.observedAt !== 'number' || !Number.isInteger(c.observedAt))) {
      return { ok: false, reason: `candidate ${idx} observedAt must be epoch seconds or null` };
    }
    if (c.language !== undefined && c.language !== null && typeof c.language !== 'string') {
      return { ok: false, reason: `candidate ${idx} language must be a string` };
    }
    candidates.push({
      memoryForm: c.memoryForm as ExtractionCandidate['memoryForm'],
      kind: c.kind as ExtractionCandidate['kind'],
      subjectKey: c.subjectKey.trim(),
      predicateKey: c.predicateKey.trim(),
      text: c.text.trim(),
      spanStart: c.spanStart,
      spanEnd: c.spanEnd,
      language: (c.language as string | undefined) ?? undefined,
      observedAt: (c.observedAt as number | null | undefined) ?? null,
    });
  }
  return {
    ok: true,
    batch: {
      contractVersion: EXTRACTION_CONTRACT_VERSION,
      candidates,
      skipReason:
        candidates.length === 0 && typeof obj.skipReason === 'string'
          ? obj.skipReason
          : undefined,
    },
  };
}

export function extractionPrompt(episode: {
  content: string;
  sender: string | null;
  groupName: string | null;
  sourceType: string;
  timestamp: number;
}): string {
  const contentBounded = episode.content.slice(0, 6000);
  return `Extract atomic memory candidates from the following message. Return STRICT JSON only:
{"candidates": [{
  "memoryForm": "semantic|episodic|procedural",
  "kind": "note|fact|preference|decision|action_item|event|risk|open_question|opinion|procedure|insight|brief",
  "subjectKey": "stable-lowercase-subject",
  "predicateKey": "stable-lowercase-predicate",
  "text": "one atomic statement in the message's language",
  "spanStart": <byte offset into the message body where the evidence starts>,
  "spanEnd": <byte offset where it ends>,
  "language": "en|zh|mixed",
  "observedAt": <epoch seconds from the message time, or null>
}]}
Rules:
- Return 0 candidates when the message carries no durable memory; then set "skipReason".
- Each text must be ONE atomic statement traceable to the span.
- Spans are UTF-8 BYTE offsets into the message body below.
- Never invent fields.

Message body (timestamps in epoch seconds: ${episode.timestamp}):
${contentBounded}
Sender: ${episode.sender ?? 'unknown'}; Group: ${episode.groupName ?? 'unknown'}; Source: ${episode.sourceType}`;
}
