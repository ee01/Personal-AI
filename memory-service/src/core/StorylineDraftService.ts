import type Database from 'better-sqlite3';

import { getLLMClient, type LLMClient } from '../llm/LLMClient.js';
import {
  TodayPilotMeetingPrepRepository,
  type TodayPilotMeetingPrepRecord,
} from '../repositories/TodayPilotMeetingPrepRepository.js';
import { contentHash } from '../utils/hashing.js';
import {
  defaultStorylineButtonLabel,
  normalizeStorylineArtifactTarget,
} from '../utils/storyline.js';
import type {
  ComposerAssistEvidence,
  ContextAssistCueCard,
  StorylineDraftFallbackReason,
  StorylineDraftRequest,
  StorylineDraftResponse,
  StorylineDraftSegment,
  StorylineOpportunity,
  StorylineSourceKind,
  StorylineSuggestedArtifact,
} from '../types/index.js';

interface StorylineDraftLlmResponse {
  title?: string;
  audience?: string;
  targetArtifact?: StorylineSuggestedArtifact;
  segments?: Array<Partial<StorylineDraftSegment>>;
  gaps?: string[];
  riskNotes?: string[];
  artifactText?: string;
  usage?: Record<string, unknown>;
}

interface StorylineDraftSource {
  sourceKind: StorylineSourceKind;
  sourceId: string;
  sourceHash: string;
  title: string;
  summaryMd: string;
  contextPackMd: string;
  evidenceRefs: ComposerAssistEvidence[];
  cueCards: ContextAssistCueCard[];
  storylineOpportunity?: StorylineOpportunity;
}

function compactText(value: unknown, maxLength: number): string {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function firstNonEmpty(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function normalizeStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => compactText(item, 220))
    .filter(Boolean)
    .slice(0, maxItems);
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') return safeRecord(value);
  try {
    return safeRecord(JSON.parse(value));
  } catch {
    return {};
  }
}

function safeStringArray(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function appendOnce(items: string[], value: string): string[] {
  return items.includes(value) ? items : [...items, value];
}

function countDistinctSegmentEvidenceIds(
  segments: StorylineDraftSegment[],
): number {
  return new Set(segments.flatMap((segment) => segment.evidenceIds)).size;
}

const FALLBACK_GROUNDING_RISK =
  '原始模型输出缺少足够证据引用，已用会前准备证据重新生成可复制草稿。';
const LLM_FAILURE_FALLBACK_RISK =
  '模型生成失败，已用会前准备证据生成 fallback 草稿；请按 Evidence key 复核后再外发。';

export class StorylineDraftService {
  private readonly repo: TodayPilotMeetingPrepRepository;
  private readonly llmClient: Pick<LLMClient, 'generateJSON'>;

  constructor(
    private readonly db: Database.Database,
    private readonly userId: string,
    llmClient: Pick<LLMClient, 'generateJSON'> = getLLMClient(),
  ) {
    this.repo = new TodayPilotMeetingPrepRepository(db);
    this.llmClient = llmClient;
  }

  async createDraft(
    request: StorylineDraftRequest,
  ): Promise<StorylineDraftResponse> {
    const source = request.sourceKind === 'today_meeting_prep'
      ? this.loadMeetingPrepSource(request.prepId)
      : request.sourceKind === 'source_memory_seed'
        ? this.loadSourceMemorySeed(request.capsuleId, request.seedId)
        : null;
    if (!source) {
      throw new Error('unsupported_storyline_source');
    }
    if (source.evidenceRefs.length === 0) {
      throw new Error('storyline_source_has_no_usable_evidence');
    }

    const targetArtifact =
      normalizeStorylineArtifactTarget(request.targetArtifact) ||
      source.storylineOpportunity?.suggestedArtifact ||
      'speaker_notes';
    const audience = firstNonEmpty(
      request.audienceHint,
      source.storylineOpportunity?.audienceHint,
      source.sourceKind === 'today_meeting_prep' ? '会议参会人' : '目标读者',
    );

    let generated: StorylineDraftLlmResponse = {};
    let fallbackReason: StorylineDraftFallbackReason | undefined;
    let fallbackRiskNote: string | undefined;
    try {
      generated = await this.llmClient.generateJSON<StorylineDraftLlmResponse>(
        this.buildPrompt(source, targetArtifact, audience),
        {
          temperature: 0.25,
          maxTokens: 1800,
          systemPrompt:
            'You turn personal memory evidence into a concise storyline draft. Use only provided evidence ids and facts. Return JSON only.',
        },
      );
    } catch {
      fallbackReason = 'llm_generation_failed';
      fallbackRiskNote = source.sourceKind === 'today_meeting_prep'
        ? LLM_FAILURE_FALLBACK_RISK
        : '模型生成失败，已用资料记忆证据生成 fallback 草稿；请按 Evidence key 复核后再使用。';
    }

    return this.normalizeDraftResponse(
      source,
      generated,
      targetArtifact,
      audience,
      { fallbackReason, fallbackRiskNote },
    );
  }

  private loadMeetingPrepSource(prepId: string): StorylineDraftSource {
    const prep = this.repo.findById(prepId);
    if (!prep || prep.userId !== this.userId) {
      throw new Error('storyline source prep not found');
    }
    return this.toDraftSource(prep);
  }

  private toDraftSource(prep: TodayPilotMeetingPrepRecord): StorylineDraftSource {
    return {
      sourceKind: 'today_meeting_prep',
      sourceId: prep.id,
      sourceHash: prep.sourceHash,
      title: prep.eventTitle,
      summaryMd: prep.summaryMd,
      contextPackMd: prep.contextPackMd,
      evidenceRefs: prep.evidenceRefs,
      cueCards: prep.cueCards,
      storylineOpportunity: prep.storylineOpportunity,
    };
  }

  private loadSourceMemorySeed(
    capsuleId: string,
    seedId: string,
  ): StorylineDraftSource {
    const capsule = this.db
      .prepare(
        `SELECT id, source_title, source_url, summary, metadata_json
         FROM source_memory_capsules
         WHERE id = ? AND status = 'saved'`,
      )
      .get(capsuleId) as
      | {
          id: string;
          source_title: string;
          source_url: string | null;
          summary: string | null;
          metadata_json: string;
        }
      | undefined;
    if (!capsule) throw new Error('storyline source memory capsule not found');

    const metadata = safeObject(capsule.metadata_json);
    const distillation = safeRecord(metadata.distillation);
    const deep = safeRecord(distillation.deep);
    if (
      deep.status !== 'ready' ||
      typeof deep.inputHash !== 'string' ||
      deep.inputHash !== distillation.inputHash
    ) {
      throw new Error('storyline source memory seed not found');
    }

    const artifacts = this.db
      .prepare(
        `SELECT id, input_hash, title, body, payload_json, evidence_span_ids_json
         FROM source_memory_distilled_artifacts
         WHERE capsule_id = ? AND artifact_type = 'storyline_seed'`,
      )
      .all(capsuleId) as Array<{
      id: string;
      input_hash: string;
      title: string;
      body: string;
      payload_json: string;
      evidence_span_ids_json: string;
    }>;
    const artifact = artifacts.find((item) => {
      const payload = safeObject(item.payload_json);
      return item.id === seedId || payload.seedKey === seedId;
    });
    if (!artifact || artifact.input_hash !== deep.inputHash) {
      throw new Error('storyline source memory seed not found');
    }
    const payload = safeObject(artifact.payload_json);
    const evidenceIds = safeStringArray(artifact.evidence_span_ids_json);
    const spans = this.db
      .prepare(
        `SELECT id, span_kind, locator, text, confidence
         FROM source_memory_evidence_spans
         WHERE capsule_id = ? AND input_hash = ?
         ORDER BY span_index ASC`,
      )
      .all(capsuleId, artifact.input_hash) as Array<{
      id: string;
      span_kind: string;
      locator: string | null;
      text: string;
      confidence: number;
    }>;
    const allowed = new Set(evidenceIds);
    const evidenceRefs: ComposerAssistEvidence[] = spans
      .filter((span) => allowed.has(span.id))
      .slice(0, 8)
      .map((span) => ({
        id: span.id,
        type: 'source_memory',
        title: artifact.title,
        snippet: compactText(span.text, 700),
        sourceLabel: 'source_memory',
        sourceUrl: capsule.source_url || undefined,
        sourceTitle: capsule.source_title,
        exploreLink: `#/source-memory/${encodeURIComponent(capsule.id)}`,
        whyMatched: 'Storyline seed cites this source-memory evidence span',
        evidenceRole: 'artifact',
        metadata: {
          sourceMemoryCapsuleId: capsule.id,
          spanKind: span.span_kind,
          locator: span.locator,
          confidence: span.confidence,
        },
      }));
    if (evidenceRefs.length === 0) {
      throw new Error('storyline_source_has_no_usable_evidence');
    }

    const claim = compactText(payload.claim || artifact.body, 900);
    const risks = Array.isArray(payload.risks)
      ? normalizeStringArray(payload.risks, 6)
      : [];
    return {
      sourceKind: 'source_memory_seed',
      sourceId: `${capsule.id}:${seedId}`,
      sourceHash: artifact.input_hash,
      title: compactText(payload.title || artifact.title, 160),
      summaryMd: claim || capsule.summary || artifact.body,
      contextPackMd: [
        `Source: ${capsule.source_title}`,
        claim ? `Claim: ${claim}` : '',
        ...risks.map((risk) => `Risk: ${risk}`),
      ]
        .filter(Boolean)
        .join('\n'),
      evidenceRefs,
      cueCards: [
        {
          id: artifact.id,
          kind: 'brief',
          title: compactText(payload.title || artifact.title, 120),
          body: claim || artifact.body,
          evidenceIds: evidenceRefs.map((item) => item.id),
        },
      ],
      storylineOpportunity: {
        available: true,
        confidence:
          typeof payload.confidence === 'number' ? payload.confidence : 0.7,
        audienceHint: compactText(payload.audience, 160) || undefined,
        oneLineReason: 'This draft starts from an evidence-grounded Source Memory storyline seed.',
        suggestedArtifact: 'speaker_notes',
      },
    };
  }

  private buildPrompt(
    source: StorylineDraftSource,
    targetArtifact: StorylineSuggestedArtifact,
    audience: string,
  ): string {
    const evidenceText = source.evidenceRefs
      .slice(0, 8)
      .map((item, index) => {
        const label = item.sourceTitle || item.title || item.sourceLabel || item.id;
        return [
          `[E${index + 1}] id=${item.id}`,
          `title=${compactText(label, 120)}`,
          `source=${compactText(item.sourceLabel || item.type, 80)}`,
          `snippet=${compactText(item.snippet, 700)}`,
        ].join('\n');
      })
      .join('\n\n');
    return [
      'Generate a Memory Storyline draft in JSON.',
      '',
      `Source kind: ${source.sourceKind}`,
      `Source: ${source.title}`,
      `Audience: ${audience}`,
      `Target artifact: ${targetArtifact}`,
      source.storylineOpportunity?.oneLineReason
        ? `Opportunity reason: ${source.storylineOpportunity.oneLineReason}`
        : '',
      '',
      'Source summary:',
      compactText(source.summaryMd, 1200),
      '',
      'Context pack:',
      compactText(source.contextPackMd, 1600),
      '',
      'Evidence ids allowed:',
      evidenceText || 'No external evidence ids are available.',
      '',
      'Rules:',
      '- Produce 3 to 6 segments.',
      '- Every segment must cite one or more allowed evidence ids, using either E1 aliases or the exact id values.',
      '- The target artifact is fixed by the user request; do not switch output formats.',
      '- Do not invent source ids, people, decisions, dates, or product names.',
      '- Keep the artifact manually copyable; do not include instructions to auto-send or write back.',
      '',
      'JSON schema:',
      JSON.stringify({
        title: 'storyline title',
        audience,
        targetArtifact,
        segments: [
          {
            title: 'segment title',
            intent: 'what this segment helps the user say',
            narrative: 'speaker-ready paragraph grounded in evidence',
            evidenceIds: ['E1'],
          },
        ],
        gaps: ['missing fact the user should verify'],
        riskNotes: ['privacy or confidence caveat'],
        artifactText: 'copyable speaker notes or slides outline',
      }),
    ]
      .filter(Boolean)
      .join('\n');
  }

  private normalizeDraftResponse(
    source: StorylineDraftSource,
    response: StorylineDraftLlmResponse,
    requestedTarget: StorylineSuggestedArtifact,
    requestedAudience: string,
    options: {
      fallbackReason?: StorylineDraftFallbackReason;
      fallbackRiskNote?: string;
    } = {},
  ): StorylineDraftResponse {
    const targetArtifact = requestedTarget;
    const audience = firstNonEmpty(response.audience, requestedAudience);
    const evidenceByAlias = new Map<string, string>();
    const allowedEvidenceIds = new Set<string>();
    source.evidenceRefs.slice(0, 8).forEach((item, index) => {
      allowedEvidenceIds.add(item.id);
      evidenceByAlias.set(`E${index + 1}`, item.id);
      evidenceByAlias.set(`e${index + 1}`, item.id);
    });

    const segments = Array.isArray(response.segments)
      ? response.segments
          .map((segment, index) =>
            this.normalizeSegment(
              segment,
              index,
              allowedEvidenceIds,
              evidenceByAlias,
            ),
          )
          .filter((segment): segment is StorylineDraftSegment =>
            Boolean(segment),
          )
          .slice(0, 6)
      : [];
    const minimumDistinctEvidence = Math.min(3, allowedEvidenceIds.size);
    const forcedFallback = Boolean(options.fallbackReason);
    const usedFallbackSegments =
      forcedFallback ||
      segments.length < 3 ||
      countDistinctSegmentEvidenceIds(segments) < minimumDistinctEvidence;
    const normalizedSegments = usedFallbackSegments
      ? this.fallbackSegments(source)
      : segments;
    const gaps = normalizeStringArray(response.gaps, 6);
    const riskNotes = usedFallbackSegments
      ? appendOnce(
          normalizeStringArray(response.riskNotes, 6),
          options.fallbackRiskNote ||
            (source.sourceKind === 'today_meeting_prep'
              ? FALLBACK_GROUNDING_RISK
              : '原始模型输出缺少足够证据引用，已用资料记忆证据重新生成可复制草稿。'),
        )
      : normalizeStringArray(response.riskNotes, 6);
    const title = usedFallbackSegments
      ? this.defaultTitle(source, targetArtifact)
      : firstNonEmpty(response.title, this.defaultTitle(source, targetArtifact));
    const artifactText = this.renderArtifactText(
      title,
      audience,
      targetArtifact,
      normalizedSegments,
      source.evidenceRefs,
      gaps,
      riskNotes,
    );
    const returnedEvidence = source.evidenceRefs.slice(0, 8);
    const returnedEvidenceIds = new Set(returnedEvidence.map((item) => item.id));
    const citedEvidenceIds = Array.from(
      new Set(normalizedSegments.flatMap((segment) => segment.evidenceIds)),
    );

    return {
      id: `storyline-draft-${contentHash(
        JSON.stringify({
          sourceId: source.sourceId,
          sourceHash: source.sourceHash,
          targetArtifact,
          audience,
          segmentTitles: normalizedSegments.map((segment) => segment.title),
        }),
      ).slice(0, 20)}`,
      sourceKind: source.sourceKind,
      sourceId: source.sourceId,
      title,
      audience,
      targetArtifact,
      segments: normalizedSegments,
      evidence: returnedEvidence,
      gaps,
      riskNotes,
      generationReceipt: {
        generationMode: usedFallbackSegments
          ? 'fallback_cue_cards'
          : 'llm_grounded',
        sourceKind: source.sourceKind,
        sourceId: source.sourceId,
        targetArtifact,
        audience,
        sourceEvidenceRefCount: source.evidenceRefs.length,
        citedEvidenceRefCount: citedEvidenceIds.length,
        returnedEvidenceDetailCount: returnedEvidence.length,
        missingEvidenceDetailCount: citedEvidenceIds.filter(
          (id) => !returnedEvidenceIds.has(id),
        ).length,
        fallbackReason: usedFallbackSegments
          ? options.fallbackReason ||
            'model_output_underused_or_invalid_evidence'
          : undefined,
        boundary: 'draft_only_manual_copy_no_external_write',
      },
      artifactText,
    };
  }

  private normalizeSegment(
    segment: Partial<StorylineDraftSegment>,
    index: number,
    allowedEvidenceIds: Set<string>,
    evidenceByAlias: Map<string, string>,
  ): StorylineDraftSegment | null {
    const title = compactText(segment.title, 90);
    const narrative = compactText(segment.narrative, 700);
    if (!title || !narrative) return null;
    const evidenceIds = Array.isArray(segment.evidenceIds)
      ? segment.evidenceIds
          .map((id) => String(id || '').trim())
          .map((id) => evidenceByAlias.get(id) || id)
          .filter((id) => allowedEvidenceIds.has(id))
          .filter((id, itemIndex, all) => all.indexOf(id) === itemIndex)
          .slice(0, 4)
      : [];
    if (evidenceIds.length === 0) return null;
    return {
      title,
      intent:
        compactText(segment.intent, 160) ||
        `帮助用户讲清第 ${index + 1} 段重点。`,
      narrative,
      evidenceIds,
    };
  }

  private fallbackSegments(
    source: StorylineDraftSource,
  ): StorylineDraftSegment[] {
    const fallbackEvidence = source.evidenceRefs.slice(0, 3);
    const usedEvidenceIds = new Set<string>();
    const baseSegments = source.cueCards
      .slice(0, 3)
      .map((card, index) => ({
        title: compactText(card.title, 90) || `第 ${index + 1} 段`,
        intent: compactText(card.body, 160) || '把会前准备转成可讲述材料。',
        narrative: compactText(card.body, 700) || source.summaryMd,
        evidenceIds: this.resolveFallbackEvidenceIds(
          card.evidenceIds,
          source.evidenceRefs,
          index,
          usedEvidenceIds,
        ),
      }))
      .map((segment) => {
        for (const id of segment.evidenceIds) usedEvidenceIds.add(id);
        return segment;
      });
    while (baseSegments.length < 3) {
      const evidence =
        fallbackEvidence.find((item) => !usedEvidenceIds.has(item.id)) ||
        fallbackEvidence[baseSegments.length] ||
        fallbackEvidence[0];
      if (evidence) usedEvidenceIds.add(evidence.id);
      baseSegments.push({
        title: ['背景', '关键证据', '下一步'][baseSegments.length],
        intent: '补齐故事线的基本结构。',
        narrative: compactText(evidence?.snippet || source.summaryMd, 700),
        evidenceIds: evidence ? [evidence.id] : [],
      });
    }
    return baseSegments
      .map((segment, index) => {
        if (segment.evidenceIds.length) return segment;
        const unusedEvidence = fallbackEvidence.find(
          (item) => !usedEvidenceIds.has(item.id),
        );
        const evidence = unusedEvidence || fallbackEvidence[index];
        if (evidence) usedEvidenceIds.add(evidence.id);
        return {
          ...segment,
          evidenceIds: evidence ? [evidence.id] : [],
        };
      })
      .filter((segment) => segment.evidenceIds.length > 0)
      .slice(0, 6);
  }

  private resolveFallbackEvidenceIds(
    evidenceIds: string[] | undefined,
    evidence: ComposerAssistEvidence[],
    preferredIndex = 0,
    usedEvidenceIds: Set<string> = new Set(),
  ): string[] {
    const allowed = new Set(evidence.map((item) => item.id));
    const aliases = new Map<string, string>(
      evidence.map((item, index) => [`E${index + 1}`, item.id] as const),
    );
    const normalized = (evidenceIds ?? [])
      .map((id) => aliases.get(id) || id)
      .filter((id) => allowed.has(id));
    if (normalized.length > 0) {
      const uniqueNormalized = normalized.filter(
        (id, index, all) => all.indexOf(id) === index,
      );
      const unusedNormalized = uniqueNormalized.filter(
        (id) => !usedEvidenceIds.has(id),
      );
      if (unusedNormalized.length > 0) {
        return [
          ...unusedNormalized,
          ...uniqueNormalized.filter((id) => usedEvidenceIds.has(id)),
        ].slice(0, 4);
      }
      const unusedFallback = evidence.find(
        (item) => !usedEvidenceIds.has(item.id),
      );
      if (unusedFallback) return [unusedFallback.id];
      return uniqueNormalized.slice(0, 4);
    }
    const fallback =
      evidence.find(
        (item, index) => index >= preferredIndex && !usedEvidenceIds.has(item.id),
      ) ||
      evidence.find((item) => !usedEvidenceIds.has(item.id)) ||
      evidence[preferredIndex] ||
      evidence[0];
    return fallback ? [fallback.id] : [];
  }

  private defaultTitle(
    source: StorylineDraftSource,
    targetArtifact: StorylineSuggestedArtifact,
  ): string {
    const suffix = defaultStorylineButtonLabel(targetArtifact, undefined);
    return `${source.title} · ${suffix}`;
  }

  private renderArtifactText(
    title: string,
    audience: string,
    targetArtifact: StorylineSuggestedArtifact,
    segments: StorylineDraftSegment[],
    evidence: ComposerAssistEvidence[],
    gaps: string[],
    riskNotes: string[],
  ): string {
    const headingByArtifact: Record<StorylineSuggestedArtifact, string> = {
      speaker_notes: `# Speaker Notes: ${title}`,
      slides_outline: `# Slides Outline: ${title}`,
      ringcentral_post: `# RingCentral Post: ${title}`,
      docs_brief: `# Docs Brief: ${title}`,
    };
    const segmentPrefixByArtifact: Record<StorylineSuggestedArtifact, string> = {
      speaker_notes: 'Part',
      slides_outline: 'Slide',
      ringcentral_post: 'Point',
      docs_brief: 'Section',
    };
    const evidenceKey = this.renderEvidenceKey(segments, evidence);
    const lines = [
      headingByArtifact[targetArtifact],
      '',
      `Audience: ${audience}`,
      '',
      ...segments.flatMap((segment, index) => [
        `## ${segmentPrefixByArtifact[targetArtifact]} ${index + 1}: ${segment.title}`,
        `Intent: ${segment.intent}`,
        segment.narrative,
        `Evidence refs: ${segment.evidenceIds.join(', ')}`,
        '',
      ]),
      evidenceKey.length ? '## Evidence key' : '',
      ...evidenceKey,
      evidenceKey.length ? '' : '',
      gaps.length ? '## Gaps to verify' : '',
      ...gaps.map((gap) => `- ${gap}`),
      gaps.length ? '' : '',
      riskNotes.length ? '## Risk notes' : '',
      ...riskNotes.map((note) => `- ${note}`),
    ];
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  private renderEvidenceKey(
    segments: StorylineDraftSegment[],
    evidence: ComposerAssistEvidence[],
  ): string[] {
    const evidenceById = new Map(evidence.map((item) => [item.id, item]));
    const orderedIds = segments
      .flatMap((segment) => segment.evidenceIds)
      .filter((id, index, all) => all.indexOf(id) === index);

    return orderedIds.map((id) => {
      const item = evidenceById.get(id);
      if (!item) {
        return `- ${id}: evidence detail not returned`;
      }
      const source = compactText(item.sourceLabel || item.type || 'memory', 60);
      const title = compactText(
        item.sourceTitle || item.title || item.snippet || id,
        140,
      );
      return `- ${id}: ${source} - ${title}`;
    });
  }
}
