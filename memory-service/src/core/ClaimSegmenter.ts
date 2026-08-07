import type {
  ClaimAttributionSignal,
  ClaimCommitmentState,
  ClaimPolarity,
  ClaimSpeechMode,
  ClaimTimeBasis,
  ClaimVerificationState,
  MemoryClaimOwner,
  MemoryClaimSourceSpan,
  SourceType,
} from '../types/index.js';
import { contentHash } from '../utils/hashing.js';

export interface ClaimSegmentationInput {
  content: string;
  sourceMessageId?: string;
  sourceType?: SourceType | string;
  sender?: string;
  metadata?: Record<string, unknown> | null;
}

export interface SegmentedMemoryClaim {
  index: number;
  sourceMessageId?: string;
  sourceSpan: MemoryClaimSourceSpan;
  sourceText: string;
  normalizedClaim: string;
  owner: MemoryClaimOwner;
  speechMode: ClaimSpeechMode;
  polarity: ClaimPolarity;
  timeBasis: ClaimTimeBasis;
  verification: ClaimVerificationState;
  commitment: ClaimCommitmentState;
  confidence: number;
  signals: ClaimAttributionSignal[];
}

interface TextSpan {
  start: number;
  end: number;
}

type UpstreamRole = 'self' | 'ai' | 'system' | 'external' | 'unknown';

interface UpstreamContext {
  role: UpstreamRole;
  roleConflict: boolean;
  hasRoleSignal: boolean;
  speakerLabel?: string;
  hasReplyTarget: boolean;
  connectorReceipt: boolean;
  contradicted: boolean;
  corroborated: boolean;
}

const SIGNAL_ORDER: ClaimAttributionSignal[] = [
  'message_role',
  'speaker_label',
  'reply_target',
  'quote_boundary',
  'mention',
  'linguistic_marker',
  'connector_receipt',
  'llm_resolution',
  'user_correction',
];

const AI_NAME =
  /(?:\b(?:another\s+|other\s+)?AI\b|\bChatGPT\b|\bGPT(?:-\d+)?\b|\bClaude\b|\bGemini\b|\bCopilot\b|\bDoubao\b|\bKimi\b|\bDeepSeek\b|豆包|另(?:一|外)个\s*AI|其他\s*AI|人工智能)/iu;
const AI_ATTRIBUTION =
  /(?:(?:\b(?:another\s+|other\s+)?AI\b|\bChatGPT\b|\bGPT(?:-\d+)?\b|\bClaude\b|\bGemini\b|\bCopilot\b|\bDoubao\b|\bKimi\b|\bDeepSeek\b|豆包|另(?:一|外)个\s*AI|其他\s*AI|人工智能).{0,24}(?:建议|推荐|认为|觉得|表示|说|提到|总结|suggest(?:ed|s)?|recommend(?:ed|s)?|said|says|thinks?|summari[sz](?:ed|es)?|proposed?)|(?:according\s+to|根据|据).{0,8}(?:AI|ChatGPT|Claude|Gemini|Copilot|Doubao|豆包))/iu;
const SUGGESTION =
  /(?:建议|推荐|不妨|可以考虑|最好|值得考虑|suggest(?:ed|s|ion)?|recommend(?:ed|s|ation)?|advis(?:e|ed|es)|should\s+consider|propos(?:e|ed|es|al))/iu;
const CORRECTION =
  /(?:^|[，,。.!！？?；;\s])(?:更正|纠正|修正|改为|准确地说|严格来说|其实|不是.+而是|correction|to\s+correct|actually|rather\s+than|not\s+.+\s+but\s+)/iu;
const SIMULATION =
  /(?:模拟|仿真|演练|角色扮演|沙盘|scenario|simulat(?:e|ed|ion)|role[- ]?play|pretend|imagine\s+(?:that|if))/iu;
const COUNTERFACTUAL =
  /(?:要不是|本来(?:会|可以|应该)|如果当时|早知道|if\s+.+\s+had\b|would\s+have\b|could\s+have\b|counterfactual)/iu;
const HYPOTHESIS =
  /(?:假设|假如|倘若|如果|若是|万一|前提是|先假定|suppos(?:e|ing)|assum(?:e|ing)|hypothetical(?:ly)?|what\s+if|\bif\b)/iu;
const SELF_LANGUAGE =
  /(?:^|[，,。.!！？?；;：:\s"'“”‘’])(?:我|我们|本人|I|we|my|our)(?:\b|的|来|会|将|想|要|决定|计划|打算|准备|接受|确认|负责|偏好|喜欢|认为|觉得|不|是)/iu;
const ACCEPTED_COMMITMENT =
  /(?:我(?:来|会|将)(?:负责|处理|完成|跟进|推进|补|做|接|承担)|我(?:接受|确认接受|答应|承诺|认领)|(?:好的|可以|没问题)[，,\s]*(?:我来|我会)|\bI\s+(?:accept|commit|promise)\b|\bI(?:'ll|\s+will)\s+(?:take|own|handle|finish|complete|follow\s+up|deliver|do)\b|\bcount\s+me\s+in\b)/iu;
const ASSIGNED_COMMITMENT =
  /(?:由\s*[@\p{L}\p{N}_.-]{1,40}\s*负责|请\s*[@\p{L}\p{N}_.-]{1,40}\s*(?:负责|处理|完成|跟进|推进)|[@\p{L}][@\p{L}\p{N}_.-]{0,30}\s*(?:负责|来处理|来完成)|\bassigned\s+to\s+@?[\p{L}\p{N}_.-]+|\b@?[\p{L}][\p{L}\p{N}_.-]*\s+(?:owns?|is\s+responsible\s+for)\b|\bplease\s+@?[\p{L}][\p{L}\p{N}_.-]*\s+(?:handle|finish|complete|own|follow\s+up))/iu;
const PROPOSED_COMMITMENT =
  /(?:要不要|是否可以|可以由|建议由|提议由|不如由|\bshould\s+(?:we|I|@?[\p{L}])\b|\bcould\s+(?:we|I|@?[\p{L}])\b|\bpropos(?:e|ed)\s+(?:that\s+)?)/iu;
const INTENT =
  /(?:我(?:打算|计划|准备|想要|希望)|我们(?:打算|计划|准备)|\bI\s+(?:plan|intend|aim|hope)\s+to\b|\bwe\s+(?:plan|intend|aim|hope)\s+to\b|\b(?:I|we)(?:'m|'re|\s+am|\s+are)\s+going\s+to\b)/iu;
const UNCERTAIN =
  /(?:可能|也许|或许|大概|不确定|看起来|似乎|猜测|may(?:be)?|might|perhaps|possibly|probably|seems?|guess)/iu;
const NEGATED =
  /(?:^|[，,。.!！？?；;：:\s])(?:不|不会|不要|并非|没有|未|从不|not|never|no\s+longer|do\s+not|does\s+not|did\s+not|don't|doesn't|didn't|won't|cannot|can't)(?:\b|[\p{L}])/iu;
const ROLE_BEARING_AI_SOURCES = new Set([
  'ai_chat',
  'chatgpt',
  'doubao',
  'doubao_chat',
  'codex_cli',
  'claude_code_cli',
  'cursor_agent_cli',
  'mcp_client',
]);

function isWhitespace(character: string | undefined): boolean {
  return character != null && /\s/u.test(character);
}

function trimSpan(content: string, span: TextSpan): TextSpan | null {
  let { start, end } = span;
  while (start < end && isWhitespace(content[start])) start += 1;
  while (end > start && isWhitespace(content[end - 1])) end -= 1;
  return start < end ? { start, end } : null;
}

function isEnglishPeriodBoundary(content: string, index: number): boolean {
  const previous = content[index - 1];
  const next = content[index + 1];
  if (/\d/u.test(previous ?? '') && /\d/u.test(next ?? '')) return false;
  if (next && !/[\s"'”’\)\]}]/u.test(next)) return false;
  const prefix = content.slice(Math.max(0, index - 8), index + 1);
  if (/(?:\bMr|\bMrs|\bMs|\bDr|\bProf|\bSr|\bJr|\bvs|\betc|\be\.g|\bi\.e)\.$/iu.test(prefix)) {
    return false;
  }
  return true;
}

function splitBaseSpans(content: string): TextSpan[] {
  const spans: TextSpan[] = [];
  let start = 0;
  const quoteStack: string[] = [];
  const closingFor: Record<string, string> = {
    '“': '”',
    '‘': '’',
    '「': '」',
    '『': '』',
    '《': '》',
  };

  const push = (end: number): void => {
    const trimmed = trimSpan(content, { start, end });
    if (trimmed) spans.push(trimmed);
    start = end;
  };

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const expectedClose = quoteStack[quoteStack.length - 1];
    if (expectedClose && character === expectedClose) {
      quoteStack.pop();
      continue;
    }
    if (closingFor[character]) {
      quoteStack.push(closingFor[character]);
      continue;
    }
    if (character === '"') {
      if (expectedClose === '"') quoteStack.pop();
      else quoteStack.push('"');
      continue;
    }
    if (
      character === "'" &&
      !/[\p{L}\p{N}]/u.test(content[index - 1] ?? '') &&
      !/[\p{L}\p{N}]/u.test(content[index + 1] ?? '')
    ) {
      if (expectedClose === "'") quoteStack.pop();
      else quoteStack.push("'");
      continue;
    }

    if (character === '\n' || character === '\r') {
      push(index);
      start = index + 1;
      continue;
    }
    if (quoteStack.length > 0) continue;

    const hardBoundary = /[。！？!?；;]/u.test(character);
    const periodBoundary =
      character === '.' && isEnglishPeriodBoundary(content, index);
    if (!hardBoundary && !periodBoundary) continue;

    let end = index + 1;
    while (end < content.length && /[。！？!?；;.]/u.test(content[end])) end += 1;
    push(end);
    start = end;
    index = end - 1;
  }

  const tail = trimSpan(content, { start, end: content.length });
  if (tail) spans.push(tail);
  return spans;
}

function beginsStrongClause(text: string): boolean {
  return (
    AI_ATTRIBUTION.test(text) ||
    /^(?:我的决定|我决定|我的偏好|我更?喜欢|我来|我接受|我计划|我打算|先?假设|如果|更正|其实|my\s+decision|I\s+(?:decided|prefer|will|accept|plan)|suppose|assuming|if\b|actually\b)/iu.test(
      text,
    ) ||
    /^(?:@?[A-Z][\p{L}\p{N}_.-]*(?:\s+[A-Z][\p{L}\p{N}_.-]*){0,2}|[\p{Script=Han}]{2,8})\s*(?:说|表示|认为|觉得|建议|提到|said\b|says\b|thinks?\b|suggested\b|mentioned\b)/u.test(
      text,
    )
  );
}

function splitStrongCommaClauses(content: string, span: TextSpan): TextSpan[] {
  const results: TextSpan[] = [];
  let start = span.start;
  for (let index = span.start; index < span.end; index += 1) {
    if (content[index] !== ',' && content[index] !== '，') continue;
    const right = content.slice(index + 1, span.end).trimStart();
    const left = content.slice(start, index).trimEnd();
    if (!beginsStrongClause(right)) continue;
    if (/^(?:好的|好|可以|没问题|收到|okay|ok|sure)$/iu.test(left)) {
      continue;
    }
    if (/(?:说|表示|认为|觉得|建议|提到|said|says|thinks?|suggested|mentioned)\s*$/iu.test(left)) {
      continue;
    }
    const first = trimSpan(content, { start, end: index + 1 });
    if (first) results.push(first);
    start = index + 1;
  }
  const tail = trimSpan(content, { start, end: span.end });
  if (tail) results.push(tail);
  return results;
}

function sourceSpans(content: string): TextSpan[] {
  return splitBaseSpans(content).flatMap((span) =>
    splitStrongCommaClauses(content, span),
  );
}

function normalizeClaim(text: string): string {
  return text
    .replace(/^\s*(?:[-*+]\s+|\d+[.)、]\s*|>\s*)/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function collectMetadataRecords(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown>[] {
  if (!metadata) return [];
  const records: Record<string, unknown>[] = [];
  const queue: Array<{ value: Record<string, unknown>; depth: number }> = [
    { value: metadata, depth: 0 },
  ];
  const nestedKeys = ['author', 'sender', 'from', 'participant', 'speaker', 'receipt'];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    records.push(current.value);
    if (current.depth >= 2) continue;
    for (const key of nestedKeys) {
      const nested = asRecord(current.value[key]);
      if (nested) queue.push({ value: nested, depth: current.depth + 1 });
    }
  }
  return records;
}

function textValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function metadataContext(input: ClaimSegmentationInput): UpstreamContext {
  const records = collectMetadataRecords(input.metadata);
  const roleKeys = [
    'role',
    'authorRole',
    'senderRole',
    'fromRole',
    'messageRole',
    'messageAuthorRole',
  ];
  const roleValues = records.flatMap((record) =>
    roleKeys.map((key) => textValue(record[key])?.toLowerCase()).filter(Boolean),
  ) as string[];
  const trueBoolean = (keys: string[]): boolean =>
    records.some((record) => keys.some((key) => record[key] === true));

  const self =
    trueBoolean([
      'isSelf',
      'authorIsSelf',
      'senderIsSelf',
      'fromSelf',
      'isOwner',
      'ownerAuthored',
    ]) || roleValues.some((role) => ['owner', 'self', 'user'].includes(role));
  const ai = roleValues.some((role) =>
    ['assistant', 'ai', 'agent', 'bot', 'model'].includes(role),
  );
  const system = roleValues.some((role) =>
    ['system', 'tool', 'connector'].includes(role),
  );
  const external = roleValues.some((role) =>
    ['external', 'other', 'participant', 'speaker'].includes(role),
  );
  const roleKinds = [self, ai, system, external].filter(Boolean).length;

  let role: UpstreamRole = 'unknown';
  if (roleKinds === 1) {
    if (self) role = 'self';
    else if (ai) role = 'ai';
    else if (system) role = 'system';
    else role = 'external';
  }

  const speakerKeys = ['speakerLabel', 'speakerName', 'participantName', 'authorName'];
  let speakerLabel: string | undefined;
  for (const record of records) {
    for (const key of speakerKeys) {
      speakerLabel = textValue(record[key]);
      if (speakerLabel) break;
    }
    if (speakerLabel) break;
  }

  const receiptValue = input.metadata?.connectorReceipt;
  const receiptRecord = asRecord(receiptValue);
  const connectorReceipt =
    receiptValue === true ||
    input.metadata?.connectorReceiptVerified === true ||
    (receiptRecord?.verified === true &&
      ['complete', 'completed', 'done', 'succeeded', 'success'].includes(
        String(receiptRecord.status ?? receiptRecord.outcome ?? '').toLowerCase(),
      ));

  const verificationValues = records
    .flatMap((record) => [record.verificationState, record.verification])
    .map((value) => textValue(value)?.toLowerCase())
    .filter(Boolean);

  return {
    role,
    roleConflict: roleKinds > 1,
    hasRoleSignal:
      roleValues.length > 0 ||
      records.some((record) =>
        [
          'isSelf',
          'authorIsSelf',
          'senderIsSelf',
          'fromSelf',
          'isOwner',
          'ownerAuthored',
        ].some((key) => key in record),
      ),
    speakerLabel,
    hasReplyTarget: records.some((record) =>
      ['replyTo', 'replyTarget', 'inReplyTo', 'quotedMessageId'].some(
        (key) => record[key] != null,
      ),
    ),
    connectorReceipt,
    contradicted: verificationValues.includes('contradicted'),
    corroborated:
      verificationValues.includes('corroborated') &&
      trueBoolean(['independentEvidence', 'corroborated']),
  };
}

function isGenericIdentity(value: string): boolean {
  return /^(?:unknown|anonymous|user|owner|self|assistant|system|bot|agent|me|我)$/iu.test(
    value.trim(),
  );
}

function extractNamedReporter(text: string): string | undefined {
  const according = text.match(
    /(?:according\s+to|据|根据)\s*@?([\p{L}][\p{L}\p{N}_.-]{1,30}(?:\s+[A-Z][\p{L}\p{N}_.-]{1,30}){0,2})(?:\s+(?:说|表示|认为|觉得|said|says|thinks?))?/iu,
  )?.[1];
  const direct = text.match(
    /(?:^|[；;。.!！？?，,]\s*)@?([A-Z][\p{L}\p{N}_.-]{1,30}(?:\s+[A-Z][\p{L}\p{N}_.-]{1,30}){0,2}|[\p{Script=Han}]{2,8})\s*(?:说|表示|认为|觉得|建议|提到|要求|回复|确认|said|says|thinks?|suggested|recommended|mentioned|reported|confirmed)/u,
  )?.[1];
  const candidate = (according ?? direct)?.trim();
  if (!candidate || isGenericIdentity(candidate) || AI_NAME.test(candidate)) {
    return undefined;
  }
  return candidate;
}

function quoteBoundary(text: string): boolean {
  const trimmed = text.trim();
  return (
    /[“”‘’「」『』]/u.test(trimmed) ||
    /^(?:>|["']).*(?:["'])[。.!?！？]?$/.test(trimmed)
  );
}

function standaloneQuote(text: string): boolean {
  const trimmed = text.trim();
  return (
    /^>\s*/u.test(trimmed) ||
    /^(?:“[^”]+”|‘[^’]+’|「[^」]+」|『[^』]+』|"[^"]+"|'[^']+')[。.!?！？]?$/.test(
      trimmed,
    )
  );
}

function isQuestion(text: string): boolean {
  return (
    /[?？]\s*$/u.test(text) ||
    /^(?:请问|是否|能否|可否|为什么|为何|怎么|如何|谁|什么|哪|几时|何时|要不要|what|why|who|when|where|how|can|could|would|should|is|are|do|does|did)\b/iu.test(
      text.trim(),
    )
  );
}

function commitmentState(
  text: string,
  owner: MemoryClaimOwner,
  question: boolean,
): ClaimCommitmentState {
  if (!question && owner.kind === 'self' && ACCEPTED_COMMITMENT.test(text)) {
    return 'accepted';
  }
  if (ASSIGNED_COMMITMENT.test(text)) return 'assigned';
  if (PROPOSED_COMMITMENT.test(text) || INTENT.test(text)) return 'proposed';
  return 'none';
}

function ownerFor(
  text: string,
  input: ClaimSegmentationInput,
  upstream: UpstreamContext,
  quoted: boolean,
): { owner: MemoryClaimOwner; linguistic: boolean } {
  if (upstream.connectorReceipt) {
    return {
      owner: {
        kind:
          input.sourceType === 'system'
            ? 'system_observation'
            : 'organization_or_source',
        displayName: input.sender || input.sourceType,
      },
      linguistic: false,
    };
  }

  if (AI_ATTRIBUTION.test(text)) {
    return {
      owner: { kind: 'ai_agent', displayName: text.match(AI_NAME)?.[0] ?? 'AI' },
      linguistic: true,
    };
  }

  const namedReporter = extractNamedReporter(text);
  if (namedReporter) {
    return {
      owner: { kind: 'named_person', displayName: namedReporter },
      linguistic: true,
    };
  }

  if (quoted) {
    return { owner: { kind: 'unknown' }, linguistic: true };
  }

  if (upstream.roleConflict) {
    return { owner: { kind: 'unknown' }, linguistic: false };
  }
  if (upstream.role === 'ai') {
    return {
      owner: { kind: 'ai_agent', displayName: input.sender || 'AI' },
      linguistic: false,
    };
  }
  if (upstream.role === 'system') {
    return {
      owner: { kind: 'system_observation', displayName: input.sender },
      linguistic: false,
    };
  }
  if (upstream.role === 'external') {
    const displayName = upstream.speakerLabel || input.sender;
    return {
      owner: displayName
        ? { kind: 'named_person', displayName }
        : { kind: 'unknown' },
      linguistic: false,
    };
  }
  if (upstream.role === 'self') {
    return { owner: { kind: 'self' }, linguistic: false };
  }

  if (upstream.speakerLabel && !isGenericIdentity(upstream.speakerLabel)) {
    return {
      owner: { kind: 'named_person', displayName: upstream.speakerLabel },
      linguistic: false,
    };
  }
  if (input.sender) {
    if (AI_NAME.test(input.sender)) {
      return {
        owner: { kind: 'ai_agent', displayName: input.sender },
        linguistic: false,
      };
    }
    if (!isGenericIdentity(input.sender)) {
      return {
        owner: { kind: 'named_person', displayName: input.sender },
        linguistic: false,
      };
    }
  }

  if (
    SELF_LANGUAGE.test(text) &&
    !ROLE_BEARING_AI_SOURCES.has(input.sourceType ?? '')
  ) {
    return { owner: { kind: 'self' }, linguistic: true };
  }
  if (input.sourceType === 'system') {
    return { owner: { kind: 'system_observation' }, linguistic: false };
  }
  if (['jira', 'web', 'calendar'].includes(input.sourceType ?? '')) {
    return {
      owner: {
        kind: 'organization_or_source',
        displayName: input.sourceType,
      },
      linguistic: false,
    };
  }
  return { owner: { kind: 'unknown' }, linguistic: false };
}

function classifySpan(
  text: string,
  input: ClaimSegmentationInput,
  upstream: UpstreamContext,
): Omit<
  SegmentedMemoryClaim,
  | 'index'
  | 'sourceMessageId'
  | 'sourceSpan'
  | 'sourceText'
  | 'normalizedClaim'
> {
  const quoted = standaloneQuote(text);
  const hasQuote = quoteBoundary(text);
  const ownerResolution = ownerFor(text, input, upstream, quoted);
  const owner = ownerResolution.owner;
  const question = isQuestion(text);
  const correction = CORRECTION.test(text);
  const simulation = SIMULATION.test(text);
  const hypothesis = HYPOTHESIS.test(text);
  const counterfactual = COUNTERFACTUAL.test(text);
  const namedReport = extractNamedReporter(text) != null;
  const aiAttribution = AI_ATTRIBUTION.test(text);
  const suggestion = SUGGESTION.test(text) || aiAttribution;
  const commitment = commitmentState(text, owner, question);
  const intent = INTENT.test(text);

  let speechMode: ClaimSpeechMode = 'direct_assertion';
  if (correction) speechMode = 'correction';
  else if (question) speechMode = 'question';
  else if (simulation) speechMode = 'simulation';
  else if (hypothesis || counterfactual) speechMode = 'hypothesis';
  else if (quoted) speechMode = 'quote';
  else if (namedReport) speechMode = 'reported_speech';
  else if (suggestion) speechMode = 'suggestion';
  else if (commitment === 'accepted' || commitment === 'assigned') {
    speechMode = 'commitment';
  } else if (intent) speechMode = 'intent_or_plan';
  else if (commitment !== 'none') speechMode = 'commitment';

  let polarity: ClaimPolarity = 'affirmed';
  if (
    question ||
    hypothesis ||
    simulation ||
    UNCERTAIN.test(text) ||
    commitment === 'proposed'
  ) {
    polarity = 'uncertain';
  } else if (!correction && NEGATED.test(text)) {
    polarity = 'negated';
  }

  let timeBasis: ClaimTimeBasis = 'current';
  if (counterfactual) timeBasis = 'counterfactual';
  else if (hypothesis || simulation) timeBasis = 'hypothetical';
  else if (intent || commitment !== 'none') timeBasis = 'future_intent';
  else if (question) timeBasis = 'unknown';
  else if (namedReport || quoted || owner.kind === 'organization_or_source') {
    timeBasis = 'as_of_source_time';
  }

  let verification: ClaimVerificationState = 'unverified';
  if (upstream.connectorReceipt) verification = 'verified_completion';
  else if (upstream.contradicted) verification = 'contradicted';
  else if (upstream.corroborated) verification = 'corroborated';
  else if (
    owner.kind === 'named_person' ||
    owner.kind === 'organization_or_source' ||
    owner.kind === 'ai_agent' ||
    speechMode === 'quote' ||
    speechMode === 'reported_speech'
  ) {
    verification = 'source_only';
  }

  const signalSet = new Set<ClaimAttributionSignal>();
  if (upstream.hasRoleSignal) signalSet.add('message_role');
  if (upstream.speakerLabel || input.sender) signalSet.add('speaker_label');
  if (upstream.hasReplyTarget) signalSet.add('reply_target');
  if (hasQuote) signalSet.add('quote_boundary');
  if (/@[\p{L}\p{N}_.-]+/u.test(text)) signalSet.add('mention');
  if (
    ownerResolution.linguistic ||
    correction ||
    question ||
    simulation ||
    hypothesis ||
    suggestion ||
    commitment !== 'none' ||
    intent
  ) {
    signalSet.add('linguistic_marker');
  }
  if (upstream.connectorReceipt) signalSet.add('connector_receipt');

  let confidence = 0.35;
  if (owner.kind !== 'unknown') confidence = 0.68;
  if (upstream.hasRoleSignal && !upstream.roleConflict) confidence += 0.18;
  if (ownerResolution.linguistic) confidence += 0.12;
  if (upstream.speakerLabel || input.sender) confidence += 0.08;
  if (upstream.connectorReceipt) confidence = 1;
  if (upstream.roleConflict || owner.kind === 'unknown') {
    confidence = Math.min(confidence, 0.49);
  }

  return {
    owner,
    speechMode,
    polarity,
    timeBasis,
    verification,
    commitment,
    confidence: Math.round(Math.min(1, confidence) * 100) / 100,
    signals: SIGNAL_ORDER.filter((signal) => signalSet.has(signal)),
  };
}

/** Deterministically split stored content and classify each exact source span. */
export function segmentMemoryClaims(
  input: ClaimSegmentationInput,
): SegmentedMemoryClaim[] {
  if (!input.content) return [];
  const upstream = metadataContext(input);
  return sourceSpans(input.content).map((span, index) => {
    const sourceText = input.content.slice(span.start, span.end);
    const normalizedClaim = normalizeClaim(sourceText);
    return {
      index,
      sourceMessageId: input.sourceMessageId,
      sourceSpan: {
        start: span.start,
        end: span.end,
        textHash: contentHash(sourceText),
      },
      sourceText,
      normalizedClaim,
      ...classifySpan(normalizedClaim, input, upstream),
    };
  });
}

export class ClaimSegmenter {
  segment(input: ClaimSegmentationInput): SegmentedMemoryClaim[] {
    return segmentMemoryClaims(input);
  }

  static segment(input: ClaimSegmentationInput): SegmentedMemoryClaim[] {
    return segmentMemoryClaims(input);
  }
}
