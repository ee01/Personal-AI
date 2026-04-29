import type {
  MeetingPilotMemoryRef,
  MeetingPilotSessionSnapshot,
  MeetingPilotSpeechGuidanceClassificationScope,
  MeetingPilotSpeechSuggestion,
  MeetingPilotSpeechSuggestionEvidenceRef,
  MeetingPilotSpeechSuggestionIntent,
  MeetingPilotSpeechSuggestionSource,
} from './protocol';

export type MeetingPilotLlmRunner = (params: {
  systemPrompt: string;
  userPrompt: string;
}) => Promise<string>;

export type SpeechGuidanceProfileItemType =
  | 'fact'
  | 'preference'
  | 'habit'
  | 'interest'
  | 'constraint';

export interface MeetingPilotSpeechGuidanceClassification {
  scope: MeetingPilotSpeechGuidanceClassificationScope;
  itemType: SpeechGuidanceProfileItemType;
  itemKey: string;
  itemValue: string;
  sessionNote: string;
  confidence: number;
  reason: string;
}

export interface BuildMeetingPilotSpeechSuggestionArgs {
  session: MeetingPilotSessionSnapshot;
  profileCore?: string;
  now?: number;
}

const PROFILE_ITEM_TYPES = new Set<SpeechGuidanceProfileItemType>([
  'fact',
  'preference',
  'habit',
  'interest',
  'constraint',
]);

const SUGGESTION_INTENTS = new Set<MeetingPilotSpeechSuggestionIntent>([
  'answer_question',
  'add_context',
  'clarify',
  'status_update',
  'follow_up',
  'none',
]);

const SUGGESTION_SOURCES = new Set<MeetingPilotSpeechSuggestionSource>([
  'transcript',
  'memory',
  'transcript_memory',
  'profile',
  'session_context',
  'fallback',
]);

function cleanOneLine(value: string | undefined): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeStructuredJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }
  return raw.trim();
}

function clampConfidence(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

function truncateText(value: string, maxLength: number): string {
  const trimmed = cleanOneLine(value);
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

function textFromMemory(ref: MeetingPilotMemoryRef | undefined): string {
  if (!ref) return '';
  return cleanOneLine(ref.snippet || ref.fullSnippet || ref.title);
}

export function detectMeetingSpeechLanguage(texts: string[]): string {
  const joined = texts.map(cleanOneLine).filter(Boolean).join(' ');
  if (!joined) return 'zh';
  const cjkCount = (joined.match(/[\u3400-\u9fff]/g) || []).length;
  const latinWordCount = (joined.match(/[A-Za-z]{2,}/g) || []).length;
  if (cjkCount === 0 && latinWordCount > 0) return 'en';
  if (latinWordCount === 0 && cjkCount > 0) return 'zh';
  return cjkCount >= latinWordCount * 2 ? 'zh' : 'en';
}

function getRecentTranscriptLines(
  session: MeetingPilotSessionSnapshot,
  limit = 10,
): string[] {
  if (session.transcriptTurns.length) {
    return session.transcriptTurns
      .slice(-limit)
      .map((turn) =>
        cleanOneLine(`${turn.speakerNameSnapshot || 'Speaker'}: ${turn.text}`),
      )
      .filter(Boolean);
  }
  return session.transcript
    .slice(-limit)
    .map((chunk) => cleanOneLine(`${chunk.speaker || 'Speaker'}: ${chunk.text}`))
    .filter(Boolean);
}

function getRecentTexts(session: MeetingPilotSessionSnapshot): string[] {
  return [
    ...getRecentTranscriptLines(session, 8),
    session.currentTopic,
    session.summary,
  ].filter(Boolean);
}

function getSessionNotes(session: MeetingPilotSessionSnapshot): string[] {
  return (session.speechGuidanceContext?.sessionNotes || [])
    .map((note) => cleanOneLine(note.text))
    .filter(Boolean);
}

function detectSessionLanguage(session: MeetingPilotSessionSnapshot): string {
  const transcriptLines = getRecentTranscriptLines(session, 8);
  if (transcriptLines.length) {
    return detectMeetingSpeechLanguage(transcriptLines);
  }
  return detectMeetingSpeechLanguage([
    session.currentTopic,
    session.summary,
    ...getSessionNotes(session),
  ]);
}

function looksLikeQuestion(text: string): boolean {
  return /(\?|？|吗|么|如何|怎么|进展|status|progress|what|how|when|why|risk|blocker)/i.test(
    text,
  );
}

function inferProfileItemType(text: string): SpeechGuidanceProfileItemType {
  if (/(偏好|喜欢|希望|语气|风格|语言|中文|英文|prefer|style|tone|language)/i.test(text)) {
    return 'preference';
  }
  if (/(不能|不要|限制|合规|权限|constraint|must not|avoid)/i.test(text)) {
    return 'constraint';
  }
  if (/(经常|通常|习惯|always|usually|habit)/i.test(text)) {
    return 'habit';
  }
  if (/(关注|感兴趣|interest|interested)/i.test(text)) {
    return 'interest';
  }
  return 'fact';
}

function inferProfileItemKey(text: string): string {
  if (/(职位|角色|title|role|tech lead|manager|pm|engineer|负责人)/i.test(text)) {
    return 'role';
  }
  if (/(负责|owner|responsible|职责|ownership)/i.test(text)) {
    return 'responsibility';
  }
  if (/(擅长|领域|expert|domain|mobile|backend|frontend|平台|架构)/i.test(text)) {
    return 'domain_expertise';
  }
  if (/(语气|风格|简洁|详细|中文|英文|language|tone|style)/i.test(text)) {
    return 'response_style';
  }
  return 'meeting_response_context';
}

function heuristicClassifySpeechGuidanceInput(
  text: string,
): MeetingPilotSpeechGuidanceClassification {
  const normalized = cleanOneLine(text);
  if (!normalized) {
    return {
      scope: 'ignore',
      itemType: 'fact',
      itemKey: 'empty',
      itemValue: '',
      sessionNote: '',
      confidence: 1,
      reason: 'empty_input',
    };
  }

  const temporary =
    /(本次|这次|当前|这场|今天|现在|临时|本场|这场会|当前会议|这次会议|主持人|host|facilitator|需要在会议|提醒|插话|风险|risk|blocker)/i.test(
      normalized,
    );
  const stable =
    /(我是|我负责|我的角色|我的职位|长期|平时|以后|通常|偏好|喜欢|希望你|i am|i'm|my role|my title|responsible for|prefer|usually|always|tech lead|owner)/i.test(
      normalized,
    );

  if (stable && !temporary) {
    return {
      scope: 'long_term_profile',
      itemType: inferProfileItemType(normalized),
      itemKey: inferProfileItemKey(normalized),
      itemValue: normalized,
      sessionNote: '',
      confidence: 0.72,
      reason: 'heuristic_stable_profile',
    };
  }

  return {
    scope: 'session_only',
    itemType: inferProfileItemType(normalized),
    itemKey: inferProfileItemKey(normalized),
    itemValue: stable ? normalized : '',
    sessionNote: normalized,
    confidence: 0.64,
    reason: temporary ? 'heuristic_session_context' : 'heuristic_uncertain_session_default',
  };
}

function normalizeClassification(
  parsed: Partial<MeetingPilotSpeechGuidanceClassification>,
  fallback: MeetingPilotSpeechGuidanceClassification,
): MeetingPilotSpeechGuidanceClassification {
  const scope = parsed.scope;
  const confidence = clampConfidence(parsed.confidence, fallback.confidence);
  const itemType = PROFILE_ITEM_TYPES.has(parsed.itemType as SpeechGuidanceProfileItemType)
    ? (parsed.itemType as SpeechGuidanceProfileItemType)
    : fallback.itemType;
  const itemValue = cleanOneLine(parsed.itemValue) || fallback.itemValue;
  const sessionNote = cleanOneLine(parsed.sessionNote) || fallback.sessionNote;

  if (scope === 'ignore' && confidence >= 0.8) {
    return {
      scope,
      itemType,
      itemKey: cleanOneLine(parsed.itemKey) || fallback.itemKey,
      itemValue,
      sessionNote,
      confidence,
      reason: cleanOneLine(parsed.reason) || 'llm_ignore',
    };
  }

  if (scope === 'long_term_profile' && confidence >= 0.72 && itemValue) {
    return {
      scope,
      itemType,
      itemKey: cleanOneLine(parsed.itemKey) || fallback.itemKey,
      itemValue,
      sessionNote: '',
      confidence,
      reason: cleanOneLine(parsed.reason) || 'llm_long_term_profile',
    };
  }

  return {
    scope: 'session_only',
    itemType,
    itemKey: cleanOneLine(parsed.itemKey) || fallback.itemKey,
    itemValue,
    sessionNote: sessionNote || itemValue || fallback.sessionNote,
    confidence: Math.min(confidence || fallback.confidence, 0.71),
    reason:
      cleanOneLine(parsed.reason) ||
      (scope === 'long_term_profile'
        ? 'low_confidence_profile_downgraded_to_session'
        : fallback.reason),
  };
}

export async function classifyMeetingPilotSpeechGuidanceInput(
  args: {
    text: string;
    meetingTitle?: string;
    currentTopic?: string;
  },
  runLlm?: MeetingPilotLlmRunner,
): Promise<MeetingPilotSpeechGuidanceClassification> {
  const fallback = heuristicClassifySpeechGuidanceInput(args.text);
  if (!runLlm || fallback.scope === 'ignore') {
    return fallback;
  }

  const systemPrompt =
    'Classify user-provided Meeting Pilot speech context. Return valid JSON only.';
  const userPrompt = `Decide whether this text is stable user profile information or temporary context for the current meeting.

Return strict JSON:
{
  "scope": "long_term_profile" | "session_only" | "ignore",
  "itemType": "fact" | "preference" | "habit" | "interest" | "constraint",
  "itemKey": string,
  "itemValue": string,
  "sessionNote": string,
  "confidence": number,
  "reason": string
}

Rules:
- long_term_profile: stable identity, title, responsibility, durable expertise, durable response preference.
- session_only: current meeting role, temporary objective, one-off risk/update/talking point.
- If uncertain, choose session_only. Never store uncertain text as long-term memory.
- For long_term_profile, put the normalized stable memory in itemValue and leave sessionNote empty.
- For session_only, put the normalized current-meeting note in sessionNote.

Meeting title: ${args.meetingTitle || 'Unknown'}
Current topic: ${args.currentTopic || 'Unknown'}
User text: ${args.text}`;

  try {
    const raw = await runLlm({ systemPrompt, userPrompt });
    const parsed = JSON.parse(normalizeStructuredJson(raw)) as Partial<
      MeetingPilotSpeechGuidanceClassification
    >;
    return normalizeClassification(parsed, fallback);
  } catch {
    return fallback;
  }
}

function buildEvidenceRefs(
  session: MeetingPilotSessionSnapshot,
  profileCore?: string,
): MeetingPilotSpeechSuggestionEvidenceRef[] {
  const refs: MeetingPilotSpeechSuggestionEvidenceRef[] = [];
  const latestTurn = session.transcriptTurns[session.transcriptTurns.length - 1];
  const latestChunk = session.transcript[session.transcript.length - 1];
  if (latestTurn) {
    refs.push({
      kind: 'turn',
      id: latestTurn.id,
      title: latestTurn.speakerNameSnapshot,
      snippet: truncateText(latestTurn.text, 96),
    });
  } else if (latestChunk) {
    refs.push({
      kind: 'transcript',
      id: latestChunk.id,
      title: latestChunk.speaker,
      snippet: truncateText(latestChunk.text, 96),
    });
  }

  const memory = session.memoryRefs[0];
  if (memory) {
    refs.push({
      kind: 'memory',
      id: memory.id,
      title: memory.title,
      snippet: truncateText(textFromMemory(memory), 96),
    });
  }

  const note = session.speechGuidanceContext?.sessionNotes?.slice(-1)[0];
  if (note) {
    refs.push({
      kind: 'session_context',
      id: note.id,
      title: '本场上下文',
      snippet: truncateText(note.text, 96),
    });
  }

  if (profileCore?.trim()) {
    refs.push({
      kind: 'profile',
      title: '用户身份记忆',
      snippet: truncateText(profileCore, 96),
    });
  }

  return refs.slice(0, 4);
}

function fallbackSuggestion(
  session: MeetingPilotSessionSnapshot,
  profileCore: string | undefined,
  now: number,
): MeetingPilotSpeechSuggestion {
  const recentTexts = getRecentTexts(session);
  const language = detectSessionLanguage(session);
  const latestLine = recentTexts[recentTexts.length - 1] || '';
  const latestTranscriptLine = getRecentTranscriptLines(session, 1)[0] || '';
  const latestNote = getSessionNotes(session).slice(-1)[0] || '';
  const memory = session.memoryRefs[0];
  const memoryText = textFromMemory(memory);
  const hasTranscript = Boolean(latestTranscriptLine);
  const hasProfile = Boolean(profileCore?.trim());

  let text: string;
  let intent: MeetingPilotSpeechSuggestionIntent = 'follow_up';
  let source: MeetingPilotSpeechSuggestionSource = 'fallback';
  let confidence = 0.45;

  if (latestNote) {
    intent = /风险|risk|blocker|问题|issue/i.test(latestNote)
      ? 'add_context'
      : 'follow_up';
    source = 'session_context';
    confidence = 0.68;
    text =
      language === 'en'
        ? `I can add one point: ${truncateText(latestNote, 140)}.`
        : `我可以补充一下：${truncateText(latestNote, 120)}。`;
  } else if (memoryText) {
    intent = 'add_context';
    source = hasTranscript ? 'transcript_memory' : 'memory';
    confidence = 0.62;
    text =
      language === 'en'
        ? `I can add some context: ${truncateText(memoryText, 150)}.`
        : `我可以补充一个背景：${truncateText(memoryText, 120)}。`;
  } else if (looksLikeQuestion(latestTranscriptLine || latestLine)) {
    intent = 'answer_question';
    source = 'transcript';
    confidence = 0.55;
    text =
      language === 'en'
        ? `I can answer from my side and share the latest context I have.`
        : `我可以先回应一下我这边掌握的最新情况。`;
  } else if (hasTranscript || hasProfile) {
    intent = 'follow_up';
    source = hasTranscript ? 'transcript' : 'profile';
    confidence = 0.5;
    text =
      language === 'en'
        ? `I can add my view briefly and help align the next step.`
        : `我可以简短补充一下我的看法，帮大家对齐下一步。`;
  } else {
    intent = 'none';
    source = 'fallback';
    confidence = 0.3;
    text = language === 'en' ? 'Nothing to add yet.' : '先听一下，暂时不用插话。';
  }

  return {
    text: truncateText(text, language === 'en' ? 220 : 160),
    language,
    intent,
    source,
    confidence,
    evidenceRefs: buildEvidenceRefs(session, profileCore),
    updatedAt: now,
    expiresAt: now + 45_000,
  };
}

function normalizeSuggestionIntent(
  value: unknown,
  fallback: MeetingPilotSpeechSuggestionIntent,
): MeetingPilotSpeechSuggestionIntent {
  return SUGGESTION_INTENTS.has(value as MeetingPilotSpeechSuggestionIntent)
    ? (value as MeetingPilotSpeechSuggestionIntent)
    : fallback;
}

function normalizeSuggestionSource(
  value: unknown,
  fallback: MeetingPilotSpeechSuggestionSource,
): MeetingPilotSpeechSuggestionSource {
  return SUGGESTION_SOURCES.has(value as MeetingPilotSpeechSuggestionSource)
    ? (value as MeetingPilotSpeechSuggestionSource)
    : fallback;
}

export function buildSpeechSuggestionSignature(
  session: MeetingPilotSessionSnapshot,
  profileCore?: string,
): string {
  const transcript = session.transcript
    .slice(-8)
    .map((chunk) => `${chunk.id}:${chunk.text}`)
    .join('|');
  const notes = getSessionNotes(session).join('|');
  const memories = session.memoryRefs
    .slice(0, 3)
    .map((ref) => `${ref.id}:${ref.score}:${ref.snippet}`)
    .join('|');
  return [
    session.currentTopic,
    session.summary,
    transcript,
    notes,
    memories,
    cleanOneLine(profileCore).slice(0, 500),
  ].join('\n');
}

export async function buildMeetingPilotSpeechSuggestion(
  args: BuildMeetingPilotSpeechSuggestionArgs,
  runLlm?: MeetingPilotLlmRunner,
): Promise<MeetingPilotSpeechSuggestion> {
  const now = args.now || Date.now();
  const fallback = fallbackSuggestion(args.session, args.profileCore, now);
  if (!runLlm) {
    return fallback;
  }

  const recentTranscript = getRecentTranscriptLines(args.session, 10).join('\n');
  const sessionNotes = getSessionNotes(args.session).join('\n');
  const memoryLines = args.session.memoryRefs
    .slice(0, 3)
    .map(
      (ref, index) =>
        `${index + 1}. ${ref.title || ref.sourceLabel}: ${textFromMemory(ref)}`,
    )
    .join('\n');
  const pendingActions = args.session.actionItems
    .filter((item) => item.status === 'pending')
    .slice(0, 4)
    .map((item) => `${item.owner}: ${item.title}${item.deadline ? ` (${item.deadline})` : ''}`)
    .join('\n');

  const systemPrompt =
    'You generate one concise private speaking suggestion for a live meeting. Return valid JSON only.';
  const userPrompt = `Return strict JSON:
{
  "text": string,
  "language": string,
  "intent": "answer_question" | "add_context" | "clarify" | "status_update" | "follow_up" | "none",
  "source": "transcript" | "memory" | "transcript_memory" | "profile" | "session_context" | "fallback",
  "confidence": number
}

Rules:
- Output exactly one short sentence the user could say aloud now.
- Match the language used in the most recent transcript turns.
- Prefer transcript context. Use memory/profile/session context only when it helps the user speak appropriately.
- If the user is not explicitly mentioned but memory/profile/session context is relevant, suggest optional phrasing like "I can add..." / "我可以补充一下...".
- Do not explain your reasoning. Do not include bullets.
- Keep Chinese under 80 characters and English under 35 words when possible.

Meeting title: ${args.session.title}
Current topic: ${args.session.currentTopic}
Summary: ${args.session.summary}
Recent transcript:
${recentTranscript || '(none)'}

User profile memory:
${args.profileCore || '(none)'}

This-meeting user context:
${sessionNotes || '(none)'}

Relevant memories:
${memoryLines || '(none)'}

Pending actions:
${pendingActions || '(none)'}`;

  try {
    const raw = await runLlm({ systemPrompt, userPrompt });
    const parsed = JSON.parse(normalizeStructuredJson(raw)) as {
      text?: string;
      language?: string;
      intent?: MeetingPilotSpeechSuggestionIntent;
      source?: MeetingPilotSpeechSuggestionSource;
      confidence?: number;
    };
    const text = truncateText(
      parsed.text || '',
      fallback.language === 'en' ? 220 : 160,
    );
    if (!text) {
      return fallback;
    }
    const confidence = clampConfidence(parsed.confidence, fallback.confidence);
    return {
      text,
      language: cleanOneLine(parsed.language) || fallback.language,
      intent: normalizeSuggestionIntent(parsed.intent, fallback.intent),
      source: normalizeSuggestionSource(parsed.source, fallback.source),
      confidence,
      evidenceRefs: buildEvidenceRefs(args.session, args.profileCore),
      updatedAt: now,
      expiresAt: now + 45_000,
    };
  } catch {
    return fallback;
  }
}
