import type {
  ContextRecallMatch,
  ContextRecallRequest,
  LensPresentation,
  LensPresentationInformationValue,
  LensPresentationNovelty,
  SceneFrame,
} from '../types/index.js';

interface AttachLensPresentationsInput {
  request: ContextRecallRequest;
  sceneFrame: SceneFrame;
  matches: ContextRecallMatch[];
}

export interface LensPresentationCompilerResult {
  matches: ContextRecallMatch[];
  readyCount: number;
  partialCount: number;
  blockedCount: number;
  hiddenByPresentationCount: number;
}

interface VisibleField {
  name: string;
  value: string;
}

const LOW_VALUE_PASSIVE_SURFACES = new Set([
  'web_passive',
  'meeting_passive',
  'popup_passive',
  'follow_thread',
]);

const FACTFUL_STATUS_WORDS =
  /\b(?:blocked|blocker|changed|confirmed|decision|decided|final|locked|not\s+final|not\s+locked|pending|risk|stable|unlocked|warning)\b|决定|结论|风险|阻塞|已确认|未锁定|尚未锁定|未最终|会变|变动|口径|人天|人日|工时|需要复核|待确认/i;
const FACTFUL_VALUE_PATTERN =
  /\b\d+(?:\.\d+)?\s*(?:h|hour|hours|d|day|days|sp|points?)?\b|[=:：]\s*\S+/i;
const FACTFOLLOWUP_TITLE_PATTERN = /事实跟进|fact\s*follow[-\s]?up/i;
const FIELD_ONLY_SOURCE_PATTERN =
  /\b(?:dev\s+estimate\s+new|dev\s+estimate|original\s+estimate|remaining\s+estimate|story\s*points?|estimate)\b|估算|预估|工时|人天|人日/i;
const ISSUE_KEY_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/i;

export class LensPresentationCompiler {
  attachPresentations(
    input: AttachLensPresentationsInput,
  ): LensPresentationCompilerResult {
    let readyCount = 0;
    let partialCount = 0;
    let blockedCount = 0;
    let hiddenByPresentationCount = 0;

    const matches = input.matches.map((match) => {
      const presentation = compileLensPresentation(match, input);
      if (presentation.status === 'ready') readyCount += 1;
      if (presentation.status === 'partial') partialCount += 1;
      if (presentation.status === 'blocked') blockedCount += 1;

      if (match.displayPriority === 'hidden') {
        return {
          ...match,
          lensPresentation: presentation,
        };
      }

      if (shouldHideForPresentation(presentation, input.request)) {
        hiddenByPresentationCount += 1;
        return {
          ...match,
          displayPriority: 'hidden' as const,
          suppressionReason:
            presentation.suppressReason || 'low_value_lens_presentation',
          lensPresentation: presentation,
          metadata: {
            ...(match.metadata ?? {}),
            lensPresentationSuppression: {
              status: presentation.status,
              informationValue: presentation.informationValue,
              novelty: presentation.novelty,
              reason:
                presentation.suppressReason || 'low_value_lens_presentation',
            },
          },
        };
      }

      return {
        ...match,
        displayPriority:
          !isStaleRehearsalMatch(match) &&
          presentation.status === 'ready' &&
          presentation.informationValue !== 'low'
            ? ('p1' as const)
            : match.displayPriority,
        lensPresentation: presentation,
      };
    });

    return {
      matches,
      readyCount,
      partialCount,
      blockedCount,
      hiddenByPresentationCount,
    };
  }
}

function isStaleRehearsalMatch(match: ContextRecallMatch): boolean {
  return (
    match.type === 'rehearsal' &&
    String(match.metadata?.rehearsal?.status || '') === 'stale'
  );
}

function compileLensPresentation(
  match: ContextRecallMatch,
  input: AttachLensPresentationsInput,
): LensPresentation {
  const explicitRecall = isExplicitRecallRequest(input.request);
  const visibleFields = collectVisibleFields(input.request);
  const cuePresentation = buildCuePresentation(match, visibleFields);
  if (cuePresentation) return withId(match, cuePresentation);

  const sourceMemoryPresentation = buildSourceMemoryPresentation(match, visibleFields);
  if (sourceMemoryPresentation) return withId(match, sourceMemoryPresentation);

  const rehearsalPresentation = buildRehearsalPresentation(match);
  if (rehearsalPresentation) return withId(match, rehearsalPresentation);

  const factFollowupPresentation = buildFactFollowupPresentation(
    match,
    visibleFields,
  );
  if (factFollowupPresentation) return withId(match, factFollowupPresentation);

  const extractedInfo = selectExtractedInfo(match);
  const title = selectPresentationTitle(match, extractedInfo);
  const novelty = classifyNovelty(extractedInfo, visibleFields);
  const informationValue = classifyInformationValue(match, extractedInfo, novelty);
  const sourceBoundary =
    match.type === 'chunk' || match.type === 'message'
      ? 'raw_source'
      : 'reviewable_memory';
  const passiveAnchorOnly =
    !explicitRecall &&
    (novelty === 'anchor_only' ||
      looksLikeAnchorOnlyReflection(match, extractedInfo));

  if (!extractedInfo || passiveAnchorOnly || informationValue === 'low') {
    const suppressReason = novelty === 'already_visible'
      ? 'current_page_field_echo'
      : passiveAnchorOnly
      ? 'anchor_only_lens_presentation'
      : 'low_value_lens_presentation';
    return withId(match, {
      status: explicitRecall ? 'partial' : 'blocked',
      informationValue: 'low',
      title: explicitRecall ? title || '同场景线索' : title || '低信息线索',
      extractedInfo: explicitRecall
        ? extractedInfo || '只命中同一主题或来源，未提取到新增信息。'
        : undefined,
      suggestedAction: explicitRecall ? '打开原始记忆复核' : undefined,
      novelty: novelty === 'unknown' ? 'anchor_only' : novelty,
      sourceBoundary,
      suppressReason,
    });
  }

  return withId(match, {
    status: 'ready',
    informationValue,
    title,
    extractedInfo,
    suggestedAction: '打开原始记忆复核',
    novelty,
    sourceBoundary,
  });
}

function buildCuePresentation(
  match: ContextRecallMatch,
  visibleFields: VisibleField[],
): LensPresentation | null {
  const cue = match.cue;
  if (
    cue?.compileStatus !== 'compiled' ||
    cue.actionType !== 'remember' ||
    !cue.surfaceEligibility?.includes('memory_lens')
  ) {
    return null;
  }
  const extractedInfo = normalizeText(cue.cueText);
  if (!extractedInfo) return null;
  return {
    status: 'ready',
    informationValue: 'high',
    title: selectPresentationTitle(match, extractedInfo),
    extractedInfo,
    suggestedAction: '在当前场景中参考这条记忆',
    novelty: classifyNovelty(extractedInfo, visibleFields),
    sourceBoundary: 'derived_summary',
  };
}

function buildSourceMemoryPresentation(
  match: ContextRecallMatch,
  visibleFields: VisibleField[],
): LensPresentation | null {
  if (match.type !== 'source_memory' && match.sourceLabel !== 'source_memory') {
    return null;
  }
  const cue = getMetadataText(match, 'sourceMemoryCue');
  if (!cue) {
    return {
      status: 'blocked',
      informationValue: 'low',
      title: selectPresentationTitle(match, match.title || match.snippet),
      novelty: 'anchor_only',
      sourceBoundary: 'reviewable_memory',
      suppressReason: 'source_memory_without_distilled_cue',
    };
  }
  return {
    status: 'ready',
    informationValue: 'high',
    title: '资料提示',
    extractedInfo: cue,
    suggestedAction: '打开已保存资料复核',
    novelty: classifyNovelty(cue, visibleFields),
    sourceBoundary: 'derived_summary',
  };
}

function buildRehearsalPresentation(
  match: ContextRecallMatch,
): LensPresentation | null {
  if (match.type !== 'rehearsal') return null;
  const content =
    getNestedMetadataText(match, 'rehearsal', 'content') ||
    getNestedMetadataText(match, 'rehearsal', 'summary') ||
    getMetadataText(match, 'summary') ||
    normalizeText(match.uiSummary || match.snippet);
  if (!content) {
    return {
      status: 'blocked',
      informationValue: 'low',
      title: '预演提醒',
      novelty: 'anchor_only',
      sourceBoundary: 'derived_summary',
      suppressReason: 'rehearsal_without_content',
    };
  }
  return {
    status: 'ready',
    informationValue: 'high',
    title: '预演提醒',
    extractedInfo: content,
    suggestedAction: '按预演内容复核下一步',
    novelty: 'new_to_current_surface',
    sourceBoundary: 'derived_summary',
  };
}

function buildFactFollowupPresentation(
  match: ContextRecallMatch,
  visibleFields: VisibleField[],
): LensPresentation | null {
  const factFollowup = getMetadataObject(match, 'factFollowup');
  if (!factFollowup && !looksLikeFactFollowupMatch(match)) return null;

  const entity = normalizeText(
    typeof factFollowup?.entity === 'string' ? factFollowup.entity : '',
  );
  const propertyKey = normalizeText(
    typeof factFollowup?.propertyKey === 'string' ? factFollowup.propertyKey : '',
  );
  const observedValue = normalizeText(
    typeof factFollowup?.observedValue === 'string'
      ? factFollowup.observedValue
      : '',
  );
  const status = normalizeText(
    typeof factFollowup?.status === 'string' ? factFollowup.status : '',
  );
  const summary = getMetadataText(match, 'summary') || normalizeText(match.uiSummary);
  const extractedInfo =
    summary ||
    [
      entity && propertyKey
        ? `${entity} 的 ${propertyKey}${observedValue ? ` 当前记录为 ${observedValue}` : ' 已被记录'}`
        : '',
      status === 'needs_review' ? '后续变化需要继续跟进' : '',
    ]
      .filter(Boolean)
      .join('；');
  const novelty = classifyNovelty(extractedInfo, visibleFields);
  const hasFactValue =
    Boolean(observedValue) ||
    FACTFUL_VALUE_PATTERN.test(extractedInfo) ||
    FACTFUL_STATUS_WORDS.test(extractedInfo);
  if (!hasFactValue) {
    return {
      status: 'blocked',
      informationValue: 'low',
      title: entity && propertyKey ? `${entity} · ${propertyKey}` : '事实跟进',
      novelty: novelty === 'unknown' ? 'anchor_only' : novelty,
      sourceBoundary: 'derived_summary',
      suppressReason: 'fact_followup_without_extractable_value',
    };
  }
  return {
    status: 'ready',
    informationValue: novelty === 'already_visible' ? 'medium' : 'high',
    title: entity && propertyKey ? `${entity} · ${propertyKey}` : '事实跟进',
    extractedInfo,
    suggestedAction: '打开事实跟进复核来源',
    novelty,
    sourceBoundary: 'derived_summary',
  };
}

function shouldHideForPresentation(
  presentation: LensPresentation,
  request: ContextRecallRequest,
): boolean {
  if (isExplicitRecallRequest(request)) return false;
  const passiveSurface = LOW_VALUE_PASSIVE_SURFACES.has(request.surface);
  if (!passiveSurface) return false;
  if (presentation.status !== 'ready') return true;
  if (presentation.informationValue === 'low') return true;
  if (
    presentation.novelty === 'already_visible' ||
    presentation.novelty === 'anchor_only'
  ) {
    return true;
  }
  return false;
}

function selectExtractedInfo(match: ContextRecallMatch): string {
  const candidates = [
    getMetadataText(match, 'summary'),
    getFirstContextMessage(match),
    match.uiSummary,
    match.snippet,
  ];
  const sourceTitle = normalizeText(match.sourceTitle);
  const title = normalizeText(match.title);
  for (const candidate of candidates) {
    const text = cleanDisplayText(candidate);
    if (!text) continue;
    if (sourceTitle && equivalentText(text, sourceTitle)) continue;
    if (title && sourceTitle && equivalentText(title, sourceTitle) && equivalentText(text, title)) {
      continue;
    }
    return clipText(text, 260);
  }
  return '';
}

function selectPresentationTitle(
  match: ContextRecallMatch,
  extractedInfo?: string,
): string {
  const sourceCue = match.type === 'source_memory' ? '资料提示' : '';
  const candidates = [
    sourceCue,
    match.cue?.compileStatus === 'compiled' ? match.cue.whyNow : '',
    extractedInfo,
    getMetadataText(match, 'summary'),
    match.title,
    match.uiSummary,
    match.snippet,
  ];
  for (const candidate of candidates) {
    const text = cleanDisplayText(candidate);
    if (!text) continue;
    return clipText(firstSentence(text), 72);
  }
  return '相关记忆';
}

function classifyInformationValue(
  match: ContextRecallMatch,
  extractedInfo: string,
  novelty: LensPresentationNovelty,
): LensPresentationInformationValue {
  if (!extractedInfo) return 'low';
  if (novelty === 'anchor_only') return 'low';
  if (novelty === 'already_visible' && !FACTFUL_STATUS_WORDS.test(extractedInfo)) {
    return 'low';
  }
  if (match.cue?.compileStatus === 'compiled') return 'high';
  if (match.type === 'source_memory' && getMetadataText(match, 'sourceMemoryCue')) {
    return 'high';
  }
  if (FACTFUL_STATUS_WORDS.test(extractedInfo)) return 'high';
  if (FACTFUL_VALUE_PATTERN.test(extractedInfo)) return 'medium';
  return countSignalChars(extractedInfo) >= 22 ? 'medium' : 'low';
}

function classifyNovelty(
  info: string,
  visibleFields: VisibleField[],
): LensPresentationNovelty {
  const text = normalizeComparableText(info);
  if (!text) return 'unknown';
  for (const field of visibleFields) {
    const fieldName = normalizeComparableText(field.name);
    const fieldValue = normalizeVisibleFieldValue(field.value);
    if (!fieldName) continue;
    const fieldTokens = getFieldNameTokens(fieldName);
    const hasFieldName = fieldTokens.some((token) => text.includes(token));
    if (!hasFieldName) continue;
    if (fieldValue && text.includes(fieldValue)) {
      return hasNoveltyBeyondVisibleField(text, field, fieldTokens)
        ? 'new_to_current_surface'
        : 'already_visible';
    }
    return hasNoveltyBeyondVisibleField(text, field, fieldTokens)
      ? 'new_to_current_surface'
      : 'anchor_only';
  }
  return visibleFields.length ? 'new_to_current_surface' : 'unknown';
}

function hasNoveltyBeyondVisibleField(
  comparableText: string,
  field: VisibleField,
  fieldTokens: string[],
): boolean {
  const value = normalizeVisibleFieldValue(field.value);
  let residual = comparableText;
  for (const token of fieldTokens) {
    residual = residual.replaceAll(token, ' ');
  }
  if (value) residual = residual.replaceAll(value, ' ');
  residual = residual
    .replace(ISSUE_KEY_PATTERN, ' ')
    .replace(/\b(?:current|currently|field|value|jira|issue|ticket|mtr)\b/g, ' ')
    .replace(/当前|字段|数值|工单|这张票|开发/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return FACTFUL_STATUS_WORDS.test(residual) || countSignalChars(residual) >= 10;
}

export function matchHasVisibleFieldNovelty(
  match: ContextRecallMatch,
  field: { name: string; value: string },
): boolean {
  const text = normalizeComparableText(collectMatchText(match));
  const fieldName = normalizeComparableText(field.name);
  const fieldValue = normalizeVisibleFieldValue(field.value);
  if (!fieldName || !fieldValue) return false;
  const fieldTokens = getFieldNameTokens(fieldName);
  const hasFieldName = fieldTokens.some((token) => text.includes(token));
  if (!hasFieldName || !text.includes(fieldValue)) return false;
  return hasNoveltyBeyondVisibleField(text, field, fieldTokens);
}

function collectVisibleFields(request: ContextRecallRequest): VisibleField[] {
  return [
    ...(request.currentContext?.visibleFields ?? []).map((field) => ({
      name: field.name,
      value: field.value,
    })),
    ...(request.interactionScene?.visibleFacts ?? [])
      .filter((fact) => fact.kind === 'jira_field' && fact.name)
      .map((fact) => ({
        name: fact.name || '',
        value: fact.value,
      })),
  ]
    .filter(
      (field) =>
        isEstimateFieldName(field.name) &&
        normalizeVisibleFieldValue(field.value).length > 0,
    )
    .slice(0, 12);
}

function isExplicitRecallRequest(request: ContextRecallRequest): boolean {
  return Boolean(
    request.interactionScene?.selectedText ||
      request.contextType === 'selected_text' ||
      request.surface === 'meeting_prep',
  );
}

function looksLikeFactFollowupMatch(match: ContextRecallMatch): boolean {
  const text = collectMatchText(match);
  return FACTFOLLOWUP_TITLE_PATTERN.test(text);
}

function looksLikeAnchorOnlyReflection(
  match: ContextRecallMatch,
  extractedInfo: string,
): boolean {
  const text = collectMatchText(match);
  const isReflection =
    normalizeText(match.sourceLabel).toLowerCase() === 'reflection_thread' ||
    normalizeText(match.type).toLowerCase() === 'reflection_thread' ||
    FACTFOLLOWUP_TITLE_PATTERN.test(text);
  if (!isReflection) return false;
  if (!FIELD_ONLY_SOURCE_PATTERN.test(text)) return false;
  const valueText = extractedInfo || text;
  return (
    ISSUE_KEY_PATTERN.test(valueText) &&
    !FACTFUL_STATUS_WORDS.test(valueText) &&
    !FACTFUL_VALUE_PATTERN.test(valueText)
  );
}

function collectMatchText(match: ContextRecallMatch): string {
  const metadata = match.metadata ?? {};
  return [
    match.title,
    match.uiSummary,
    match.snippet,
    match.sourceTitle,
    match.sourceLabel,
    ...(match.whyRelevant ?? []),
    typeof metadata.summary === 'string' ? metadata.summary : '',
    typeof metadata.sourceMemoryCue === 'string' ? metadata.sourceMemoryCue : '',
    JSON.stringify(metadata.contextMessages ?? ''),
    JSON.stringify(metadata.factFollowup ?? ''),
  ]
    .filter(Boolean)
    .join(' ');
}

function getMetadataObject(
  match: ContextRecallMatch,
  key: string,
): Record<string, unknown> | null {
  for (const metadata of getMetadataLayers(match)) {
    const value = metadata[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

function getMetadataText(match: ContextRecallMatch, key: string): string {
  for (const metadata of getMetadataLayers(match)) {
    const value = metadata[key];
    if (typeof value === 'string') {
      const text = normalizeText(value);
      if (text) return text;
    }
  }
  return '';
}

function getNestedMetadataText(
  match: ContextRecallMatch,
  parentKey: string,
  childKey: string,
): string {
  const parent = getMetadataObject(match, parentKey);
  const value = parent?.[childKey];
  return typeof value === 'string' ? normalizeText(value) : '';
}

function getMetadataLayers(match: ContextRecallMatch): Record<string, unknown>[] {
  const metadata = match.metadata ?? {};
  const nested = metadata.metadata;
  return nested && typeof nested === 'object' && !Array.isArray(nested)
    ? [metadata, nested as Record<string, unknown>]
    : [metadata];
}

function getFirstContextMessage(match: ContextRecallMatch): string {
  for (const metadata of getMetadataLayers(match)) {
    const messages = metadata.contextMessages;
    if (!Array.isArray(messages)) continue;
    for (const message of messages) {
      if (typeof message === 'string') {
        const text = cleanDisplayText(message);
        if (text) return text;
        continue;
      }
      if (!message || typeof message !== 'object' || Array.isArray(message)) {
        continue;
      }
      const record = message as Record<string, unknown>;
      for (const key of ['content', 'text', 'message']) {
        const value = record[key];
        if (typeof value !== 'string') continue;
        const text = cleanDisplayText(value);
        if (text) return text;
      }
    }
  }
  return '';
}

function withId(
  match: ContextRecallMatch,
  presentation: LensPresentation,
): LensPresentation {
  return {
    ...presentation,
    presentationId:
      presentation.presentationId ||
      `lens:${stableHash(
        [
          match.type,
          match.id,
          presentation.status,
          presentation.title,
          presentation.extractedInfo,
        ]
          .filter(Boolean)
          .join(':'),
      )}`,
  };
}

function isEstimateFieldName(name: string): boolean {
  return FIELD_ONLY_SOURCE_PATTERN.test(name);
}

function getFieldNameTokens(fieldName: string): string[] {
  const tokens = new Set<string>([fieldName]);
  if (fieldName.includes('dev estimate new')) tokens.add('development estimate');
  if (fieldName.includes('dev estimate')) tokens.add('development estimate');
  if (fieldName.includes('original estimate')) tokens.add('original estimate');
  if (fieldName.includes('story points')) tokens.add('story points');
  if (fieldName.includes('estimate')) tokens.add('estimate');
  if (/估算|预估|工时|人天|人日/.test(fieldName)) {
    tokens.add('估算');
    tokens.add('工时');
  }
  return Array.from(tokens).filter((token) => token.length >= 2);
}

function normalizeVisibleFieldValue(value: string): string {
  return normalizeComparableText(value)
    .replace(/\b(hours?|days?|sp)\b/g, '')
    .trim();
}

function cleanDisplayText(value?: string | null): string {
  return normalizeText(value)
    .replace(/^@?[\p{L}\p{N}._\- ]{1,80}\s+wrote\s*[:：]\s*/iu, '')
    .replace(/^[-–—]?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:\[[^\]]+\])?\s*/u, '')
    .replace(/^\d+[.)、]\s*/u, '')
    .replace(/^[-*•]\s*/u, '')
    .trim();
}

function firstSentence(text: string): string {
  return (
    text
      .split(/(?<=[。！？!?])\s+|[;；]\s*/)
      .map((part) => part.trim())
      .find(Boolean) || text
  );
}

function normalizeText(value?: string | null): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizeComparableText(value?: string | null): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function equivalentText(left: string, right: string): boolean {
  return normalizeComparableText(left) === normalizeComparableText(right);
}

function clipText(value: string, maxLength: number): string {
  const text = normalizeText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function countSignalChars(value: string): number {
  return (value.match(/[A-Za-z0-9\u3400-\u9fff]/g) || []).length;
}

function stableHash(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
