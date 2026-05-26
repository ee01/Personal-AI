import type Database from 'better-sqlite3';

import { contentHash } from '../utils/hashing.js';
import { buildExploreLink } from '../utils/exploreLink.js';
import { now } from '../utils/time.js';

type RadarState = 'core' | 'active' | 'rising' | 'dormant' | 'watch';
type ReviewStatus = 'pending' | 'confirmed' | 'rejected' | 'snoozed';
type ReviewAction = 'confirm' | 'reject' | 'snooze';
type DataQuality = 'indexed' | 'generated' | 'confirmed' | 'stale';
type ProjectionSource = 'lazy' | 'background' | 'user_confirmed';
type AttendeeMatchKind = 'name' | 'alias' | 'email' | 'email_local_part' | 'none';
type AttendeeCoverageState = 'ready' | 'thin' | 'missing';

interface EntityRow {
  id: string;
  name: string;
  aliases_json: string | null;
  description: string | null;
  importance: number | null;
  first_seen: number | null;
  last_seen: number | null;
  mention_count: number | null;
  tags_json: string | null;
}

interface MessageRow {
  id: string;
  content: string;
  summary: string | null;
  source_type: string;
  source_url: string | null;
  source_title: string | null;
  sender: string | null;
  group_id: string | null;
  group_name: string | null;
  timestamp: number;
  importance: number | null;
}

interface PropertyRow {
  id: number;
  property_key: string;
  property_value: string;
  value_type: string;
  source_context: string | null;
  confidence: number;
  is_final: number;
  tx_start: number;
}

interface RelationshipRow {
  relation_type: string;
  strength: number;
  co_occurrence_count: number;
  context: string | null;
  entity_id: string;
  entity_name: string;
  entity_type: string;
  updated_at: number | null;
  created_at: number;
}

interface ReviewItemRow {
  id: string;
  entity_id: string;
  item_type: string;
  proposed_key: string;
  title: string;
  proposed_value: string;
  reason: string | null;
  confidence: number;
  priority: string;
  evidence_refs_json: string;
  status: ReviewStatus;
  user_note: string | null;
  snooze_until: number | null;
  confirmed_at: number | null;
  rejected_at: number | null;
  created_at: number;
  updated_at: number;
  entity_name?: string;
}

interface RadarProjectionRow {
  entity_id: string;
  radar_state: RadarState;
  data_quality: DataQuality;
  projection_source: ProjectionSource;
  score: number;
  interaction_count: number;
  active_days: number;
  last_interaction_at: number | null;
  evidence_refs_json: string;
  summary: string | null;
  dirty_since: number | null;
  last_consolidated_at: number | null;
  generated_at: number;
  updated_at: number;
}

interface ContextCardRow {
  entity_id: string;
  data_quality: DataQuality;
  context_json: string;
  context_md: string;
  evidence_refs_json: string;
  source_hash: string;
  generated_at: number;
  expires_at: number | null;
  updated_at: number;
}

interface CalendarEventRow {
  id: string;
  external_id: string;
  title: string;
  description_preview: string | null;
  start_at: number;
  end_at: number | null;
  organizer_json: string | null;
  attendees_json: string | null;
}

interface MeetingAttendeeIdentity {
  name: string;
  email?: string;
}

export interface RelationshipEvidenceRef {
  sourceKind: 'message' | 'entity_property' | 'relationship';
  sourceId: string;
  title?: string;
  snippet: string;
  timestamp?: number;
  sourceUrl?: string;
  exploreLink?: string;
}

export interface RelationshipPersonSummary {
  id: string;
  name: string;
  aliases: string[];
  description?: string;
  tags: string[];
  score: number;
  radarState: RadarState;
  interactionCount: number;
  activeDays: number;
  firstSeen?: number;
  lastSeen?: number;
  lastInteractionAt?: number;
  mentionCount: number;
  confidence: number;
  dataQuality: DataQuality;
  projectionSource: ProjectionSource;
  generatedAt: number;
  dirtySince?: number;
  lastConsolidatedAt?: number;
  reason: string;
  signals: {
    recent: number;
    frequency: number;
    breadth: number;
    confirmedFacts: number;
  };
  contextBullets: string[];
  evidenceCount: number;
  reviewPendingCount: number;
}

export interface RelationshipPeopleThreshold {
  minimumInteractionCount: number;
  minimumActiveDays: number;
  minimumScore: number;
  minimumKeepCount: number;
  strategy: 'hybrid_threshold_top_n';
}

export interface RelationshipPeopleResponse {
  items: RelationshipPersonSummary[];
  totalCandidates: number;
  threshold: RelationshipPeopleThreshold;
  generatedAt: number;
  coverageNote: string;
}

export interface RelationshipReviewItem {
  id: string;
  personId: string;
  personName: string;
  itemType: string;
  proposedKey: string;
  title: string;
  proposedValue: string;
  reason?: string;
  confidence: number;
  priority: string;
  evidenceRefs: RelationshipEvidenceRef[];
  status: ReviewStatus;
  userNote?: string;
  snoozeUntil?: number;
  confirmedAt?: number;
  rejectedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface RelationshipContextCard {
  person: RelationshipPersonSummary;
  surface: string;
  tokenBudget: number;
  dataQuality: DataQuality;
  projectionSource: ProjectionSource;
  contextMd: string;
  bullets: string[];
  knownFacts: Array<{
    key: string;
    value: string;
    confidence: number;
    confirmed: boolean;
  }>;
  relationshipHints: Array<{
    relationType: string;
    targetId: string;
    targetName: string;
    targetType: string;
    strength: number;
    context?: string;
  }>;
  openLoops: Array<{
    id: string;
    title: string;
    snippet: string;
    timestamp: number;
    evidenceRef: RelationshipEvidenceRef;
  }>;
  doNotAssume: string[];
  evidenceRefs: RelationshipEvidenceRef[];
  retrievalHints: {
    entityIds: string[];
    names: string[];
    boostTerms: string[];
    sourceTypes: string[];
  };
  privacySummary: {
    sensitiveIncluded: boolean;
    redactedAliases: number;
    redactedFacts: number;
    redactedRelationshipHints: number;
    redactedEvidenceRefs: number;
    redactedOpenLoops: number;
    redactedRetrievalHints: number;
    redactionNote?: string;
  };
  generatedAt: number;
}

export interface RelationshipConsolidationResult {
  generatedAt: number;
  scanned: number;
  consolidated: number;
  skipped: number;
  personIds: string[];
}

export interface RelationshipMeetingBrief {
  generatedAt: number;
  title: string;
  startAt?: number;
  coverage: {
    totalAttendees: number;
    processedAttendees: number;
    matchedAttendees: number;
    unmatchedAttendees: number;
    omittedAttendees: number;
    attendeesWithEvidence: number;
    attendeesWithOpenLoops: number;
    evidenceRefs: number;
    coverageNote: string;
  };
  attendees: Array<{
    displayName: string;
    email?: string;
    personId?: string;
    personName?: string;
    radarState?: RadarState;
    dataQuality?: DataQuality;
    matchedBy: AttendeeMatchKind;
    matchConfidence: number;
    matchReason: string;
    coverageState: AttendeeCoverageState;
    summary: string;
    openLoops: RelationshipContextCard['openLoops'];
    suggestedQuestions: string[];
    evidenceRefs: RelationshipEvidenceRef[];
  }>;
  matrix: Array<{
    person: string;
    recentContext: string;
    openLoop: string;
    suggestedAsk: string;
    evidenceCount: number;
    matchStatus: string;
    coverageState: AttendeeCoverageState;
  }>;
  omittedAttendees: Array<{
    displayName: string;
    email?: string;
    reason: string;
  }>;
}

export interface RelationshipAssistantDraft {
  generatedAt: number;
  personId?: string;
  personName: string;
  scenario: string;
  draftText: string;
  contextPackage: RelationshipContextPackage;
  warnings: string[];
}

export interface RelationshipGraph {
  generatedAt: number;
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    dataQuality?: DataQuality;
    radarState?: RadarState;
    score?: number;
  }>;
  edges: Array<{
    id: string;
    from: string;
    to: string;
    label: string;
    weight: number;
  }>;
  dynamics: Array<{
    kind: 'rising' | 'dormant' | 'review_needed' | 'high_context';
    title: string;
    body: string;
    personId?: string;
  }>;
}

export interface RelationshipContextPackage {
  generatedAt: number;
  packageType: 'relationship_context';
  cards: RelationshipContextCard[];
  retrievalBoosts: Array<{
    entityId: string;
    name: string;
    score: number;
    terms: string[];
  }>;
}

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 80;
const DEFAULT_THRESHOLD: RelationshipPeopleThreshold = {
  minimumInteractionCount: 6,
  minimumActiveDays: 3,
  minimumScore: 0.45,
  minimumKeepCount: 8,
  strategy: 'hybrid_threshold_top_n',
};
const MEETING_BRIEF_ATTENDEE_LIMIT = 16;

export class RelationshipRadarService {
  constructor(private readonly db: Database.Database) {}

  listPeople(options: {
    limit?: number;
    radarState?: RadarState | 'all';
    search?: string;
    includeBelowThreshold?: boolean;
  } = {}): RelationshipPeopleResponse {
    this.releaseDueSnoozedReviewItems();
    const limit = normalizeLimit(options.limit);
    const generatedAt = now();
    const rows = this.loadPersonRows(options.search);
    const candidates = rows.map((row) =>
      this.applyStoredProjection(this.buildPersonSummary(row, generatedAt)),
    );
    const ranked = candidates.sort(comparePeople);

    const selected = options.includeBelowThreshold
      ? ranked
      : selectHighFrequencyPeople(ranked, DEFAULT_THRESHOLD, limit);

    const stateFiltered =
      options.radarState && options.radarState !== 'all'
        ? selected.filter((item) => item.radarState === options.radarState)
        : selected;

    const items = stateFiltered.slice(0, limit);
    for (const item of items) {
      if (item.projectionSource === 'lazy') {
        this.upsertRadarProjection(item, generatedAt, {
          dataQuality: item.dataQuality,
          projectionSource: 'lazy',
        });
      }
    }

    return {
      items,
      totalCandidates: candidates.length,
      threshold: DEFAULT_THRESHOLD,
      generatedAt,
      coverageNote:
        '关系雷达采用“阈值 + 保底 Top N”策略：优先覆盖达到交互次数、活跃天数和分数阈值的人物；如果数量不足，再保留最相关的前几位，避免一开始没有数据。',
    };
  }

  getPerson(personId: string): RelationshipPersonSummary | null {
    const row = this.getPersonRow(personId);
    return row ? this.applyStoredProjection(this.buildPersonSummary(row, now())) : null;
  }

  buildContextCard(input: {
    personId?: string;
    personName?: string;
    surface?: string;
    tokenBudget?: number;
    includeSensitive?: boolean;
    preferStored?: boolean;
  }): RelationshipContextCard | null {
    const entity = input.personId
      ? this.getPersonRow(input.personId)
      : input.personName
        ? this.findPersonByName(input.personName)
        : null;
    if (!entity) return null;

    const includeSensitive = input.includeSensitive === true;
    if (input.preferStored !== false) {
      const stored = this.loadStoredContextCard(
        entity.id,
        input.surface,
        input.tokenBudget,
        includeSensitive,
      );
      if (stored) return stored;
    }

    return this.buildLazyContextCard(entity, input);
  }

  consolidatePeople(input: {
    limit?: number;
    personIds?: string[];
    force?: boolean;
  } = {}): RelationshipConsolidationResult {
    const generatedAt = now();
    const limit = normalizeLimit(input.limit ?? 40);
    const people = input.personIds?.length
      ? input.personIds
          .map((id) => this.getPerson(id))
          .filter((person): person is RelationshipPersonSummary => person !== null)
      : this.listPeople({ limit, includeBelowThreshold: false }).items;

    let consolidated = 0;
    let skipped = 0;
    const personIds: string[] = [];

    for (const person of people.slice(0, limit)) {
      const entity = this.getPersonRow(person.id);
      if (!entity) {
        skipped += 1;
        continue;
      }

      if (!input.force && !this.shouldConsolidate(person.id, generatedAt)) {
        skipped += 1;
        continue;
      }

      const card = this.buildLazyContextCard(entity, {
        surface: 'relationship_background_consolidation',
        tokenBudget: 1400,
      });
      const dataQuality: DataQuality = this.hasRelationshipContextProperty(person.id)
        ? 'confirmed'
        : 'generated';
      const projectedPerson = {
        ...card.person,
        dataQuality,
        projectionSource:
          dataQuality === 'confirmed'
            ? ('user_confirmed' as const)
            : ('background' as const),
        generatedAt,
        lastConsolidatedAt: generatedAt,
      };
      const projectedCard: RelationshipContextCard = {
        ...card,
        person: projectedPerson,
        dataQuality,
        projectionSource: projectedPerson.projectionSource,
        generatedAt,
      };

      this.upsertRadarProjection(projectedPerson, generatedAt, {
        dataQuality,
        projectionSource: projectedPerson.projectionSource,
        summary: renderShortPersonSummary(projectedCard),
        dirtySince: null,
        lastConsolidatedAt: generatedAt,
        evidenceRefs: projectedCard.evidenceRefs,
      });
      this.upsertContextCard(projectedCard, generatedAt);
      this.upsertRelationshipEvents(projectedCard, generatedAt);
      personIds.push(person.id);
      consolidated += 1;
    }

    this.ensureReviewCandidates();

    return {
      generatedAt,
      scanned: people.length,
      consolidated,
      skipped,
      personIds,
    };
  }

  private buildLazyContextCard(inputEntity: EntityRow, input: {
    surface?: string;
    tokenBudget?: number;
    includeSensitive?: boolean;
  }): RelationshipContextCard {
    const tokenBudget = Math.min(Math.max(input.tokenBudget ?? 900, 300), 2400);
    const rawPerson = this.applyStoredProjection(
      this.buildPersonSummary(inputEntity, now()),
    );
    const includeSensitive = input.includeSensitive === true;
    const person = includeSensitive ? rawPerson : redactSensitivePersonAliases(rawPerson);
    const properties = this.loadProperties(inputEntity.id);
    const relationships = this.loadRelationships(inputEntity.id);
    const messages = this.loadMessagesForPerson(inputEntity, 12);
    const openLoops = this.listOpenLoops(inputEntity.id, 5, { includeSensitive: true });
    const visibleProperties = includeSensitive
      ? properties
      : properties.filter((property) => !isSensitiveProperty(property));
    const visibleRelationships = includeSensitive
      ? relationships
      : relationships.filter((relationship) => !isSensitiveRelationship(relationship));
    const visibleMessages = includeSensitive
      ? messages
      : messages.filter((message) => !isSensitiveMessage(message));
    const visibleOpenLoops = includeSensitive
      ? openLoops
      : openLoops.filter((loop) => !isSensitiveOpenLoop(loop));
    const evidenceRefs = uniqueEvidenceRefs([
      ...visibleMessages.slice(0, 6).map(toMessageEvidenceRef),
      ...visibleProperties.slice(0, 4).map((property) => ({
        sourceKind: 'entity_property' as const,
        sourceId: String(property.id),
        title: property.property_key,
        snippet: property.property_value,
        timestamp: property.tx_start,
      })),
    ]);

    const knownFacts = visibleProperties.slice(0, 8).map((property) => ({
      key: property.property_key,
      value: property.property_value,
      confidence: roundScore(property.confidence),
      confirmed: Boolean(property.is_final),
    }));

    const relationshipHints = visibleRelationships.slice(0, 8).map((relationship) => ({
      relationType: relationship.relation_type,
      targetId: relationship.entity_id,
      targetName: relationship.entity_name,
      targetType: relationship.entity_type,
      strength: roundScore(relationship.strength),
      context: relationship.context ?? undefined,
    }));

    const bullets = buildContextBullets(person, knownFacts, relationshipHints);
    const doNotAssume = buildDoNotAssume(person, knownFacts);
    const retrievalHints = {
      entityIds: [inputEntity.id, ...relationshipHints.map((item) => item.targetId)].slice(0, 12),
      names: [inputEntity.name, ...person.aliases].slice(0, 8),
      boostTerms: buildBoostTerms(inputEntity, visibleProperties, visibleRelationships),
      sourceTypes: getSourceTypes(visibleMessages),
    };
    const safeRetrievalHints = includeSensitive
      ? retrievalHints
      : redactSensitiveRetrievalHints(retrievalHints);
    const privacySummary = buildContextPrivacySummary({
      includeSensitive,
      rawPerson,
      person,
      properties,
      visibleProperties,
      relationships,
      visibleRelationships,
      messages,
      visibleMessages,
      openLoops,
      visibleOpenLoops,
      retrievalHints,
      visibleRetrievalHints: safeRetrievalHints,
    });

    return {
      person,
      surface: input.surface ?? 'memory_exploring',
      tokenBudget,
      dataQuality: person.dataQuality,
      projectionSource: person.projectionSource,
      contextMd: renderContextMarkdown(
        person,
        bullets,
        knownFacts,
        visibleOpenLoops,
        tokenBudget,
        privacySummary,
        doNotAssume,
      ),
      bullets,
      knownFacts,
      relationshipHints,
      openLoops: visibleOpenLoops,
      doNotAssume,
      evidenceRefs,
      retrievalHints: safeRetrievalHints,
      privacySummary,
      generatedAt: now(),
    };
  }

  buildContextPackage(input: {
    personIds?: string[];
    personName?: string;
    surface?: string;
    tokenBudget?: number;
  }): RelationshipContextPackage {
    const ids = input.personIds?.filter(Boolean).slice(0, 5) ?? [];
    const cards: RelationshipContextCard[] = [];

    for (const personId of ids) {
      const card = this.buildContextCard({
        personId,
        surface: input.surface,
        tokenBudget: input.tokenBudget,
      });
      if (card) cards.push(card);
    }

    if (cards.length === 0 && input.personName) {
      const card = this.buildContextCard({
        personName: input.personName,
        surface: input.surface,
        tokenBudget: input.tokenBudget,
      });
      if (card) cards.push(card);
    }

    return {
      generatedAt: now(),
      packageType: 'relationship_context',
      cards,
      retrievalBoosts: cards.map((card) => ({
        entityId: card.person.id,
        name: card.person.name,
        score: card.person.score,
        terms: card.retrievalHints.boostTerms,
      })),
    };
  }

  buildMeetingBrief(input: {
    eventId?: string;
    title?: string;
    startAt?: number;
    attendees?: Array<{ name?: string; email?: string } | string>;
  }): RelationshipMeetingBrief {
    const event = input.eventId ? this.loadCalendarEvent(input.eventId) : null;
    const attendees = normalizeAttendees(
      input.attendees ?? safeJsonParse<unknown[]>(event?.attendees_json ?? null, []),
    );
    const title = input.title || event?.title || 'Meeting';
    const startAt = input.startAt ?? event?.start_at ?? undefined;
    const processedAttendees = attendees.slice(0, MEETING_BRIEF_ATTENDEE_LIMIT);
    const omittedAttendees = attendees
      .slice(MEETING_BRIEF_ATTENDEE_LIMIT)
      .map(formatOmittedMeetingAttendee);

    const attendeeCards = processedAttendees.map((attendee) => {
      const match = this.findPersonForAttendee(attendee);
      const person = match.person;
      const card = person
        ? this.buildContextCard({
            personId: person.id,
            surface: 'meeting_people_brief',
            tokenBudget: 700,
          })
        : null;
      const openLoops = card?.openLoops.slice(0, 3) ?? [];
      const suggestedQuestions = buildSuggestedQuestions(
        attendee.name || attendee.email,
        card,
      );
      const coverageState: AttendeeCoverageState = card
        ? (card.evidenceRefs.length > 0 || openLoops.length > 0 ? 'ready' : 'thin')
        : 'missing';
      return {
        displayName: attendee.name || attendee.email || 'Unknown attendee',
        email: attendee.email,
        personId: card?.person.id,
        personName: card?.person.name,
        radarState: card?.person.radarState,
        dataQuality: card?.dataQuality,
        matchedBy: match.matchedBy,
        matchConfidence: match.confidence,
        matchReason: match.reason,
        coverageState,
        summary: card
          ? card.bullets.slice(0, 2).join('；')
          : '暂无已沉淀的人物上下文，会议中可先确认角色和关注点。',
        openLoops,
        suggestedQuestions,
        evidenceRefs: card?.evidenceRefs.slice(0, 4) ?? [],
      };
    });

    const coverage = buildMeetingBriefCoverage(attendeeCards, {
      totalAttendees: attendees.length,
      omittedAttendees: omittedAttendees.length,
    });

    return {
      generatedAt: now(),
      title,
      startAt,
      coverage,
      attendees: attendeeCards,
      matrix: attendeeCards.map((item) => ({
        person: item.personName || item.displayName,
        recentContext: item.summary,
        openLoop: item.openLoops[0]?.snippet || '无明确 open loop',
        suggestedAsk: item.suggestedQuestions[0] || '先确认本次会议中 TA 关注什么。',
        evidenceCount: item.evidenceRefs.length,
        matchStatus:
          item.matchedBy === 'none'
            ? '未匹配'
            : `${item.matchReason} · ${Math.round(item.matchConfidence * 100)}%`,
        coverageState: item.coverageState,
      })),
      omittedAttendees,
    };
  }

  buildAssistantDraft(input: {
    personId?: string;
    personName?: string;
    scenario?: string;
    userGoal?: string;
  }): RelationshipAssistantDraft | null {
    const card = this.buildContextCard({
      personId: input.personId,
      personName: input.personName,
      surface: 'relationship_assistant',
      tokenBudget: 900,
    });
    if (!card) return null;

    const scenario = input.scenario || 'follow_up_message';
    const openLoop = card.openLoops[0]?.snippet;
    const goal = input.userGoal?.trim();
    const draftLines = [
      goal ? `我想跟进一下：${goal}` : '我这边想跟进一下我们之前提到的事项。',
      openLoop ? `我看到上次还留下一个点：${openLoop}` : '',
      '你方便确认一下当前状态和下一步 owner 吗？',
    ].filter(Boolean);

    return {
      generatedAt: now(),
      personId: card.person.id,
      personName: card.person.name,
      scenario,
      draftText: draftLines.join('\n'),
      contextPackage: this.buildContextPackage({
        personIds: [card.person.id],
        surface: 'relationship_assistant',
        tokenBudget: 900,
      }),
      warnings: card.doNotAssume,
    };
  }

  buildGraph(input: { limit?: number } = {}): RelationshipGraph {
    const people = this.listPeople({
      limit: normalizeLimit(input.limit ?? 24),
      includeBelowThreshold: false,
    }).items;
    const nodes = new Map<string, RelationshipGraph['nodes'][number]>();
    const edges: RelationshipGraph['edges'] = [];

    for (const person of people) {
      nodes.set(person.id, {
        id: person.id,
        label: person.name,
        type: 'Person',
        dataQuality: person.dataQuality,
        radarState: person.radarState,
        score: person.score,
      });
      for (const relation of this.loadRelationships(person.id).slice(0, 8)) {
        nodes.set(relation.entity_id, {
          id: relation.entity_id,
          label: relation.entity_name,
          type: relation.entity_type,
        });
        edges.push({
          id: `${person.id}:${relation.entity_id}:${relation.relation_type}`,
          from: person.id,
          to: relation.entity_id,
          label: relation.relation_type,
          weight: roundScore(relation.strength),
        });
      }
    }

    const dynamics = people.flatMap((person) => {
      const items: RelationshipGraph['dynamics'] = [];
      if (person.radarState === 'rising') {
        items.push({
          kind: 'rising',
          title: `${person.name} 最近升温`,
          body: person.reason,
          personId: person.id,
        });
      }
      if (person.radarState === 'dormant') {
        items.push({
          kind: 'dormant',
          title: `${person.name} 近期沉默`,
          body: person.reason,
          personId: person.id,
        });
      }
      if (person.reviewPendingCount > 0) {
        items.push({
          kind: 'review_needed',
          title: `${person.name} 有待确认关系事实`,
          body: `${person.reviewPendingCount} 条待确认项会影响后续检索质量。`,
          personId: person.id,
        });
      }
      return items;
    });

    return {
      generatedAt: now(),
      nodes: Array.from(nodes.values()),
      edges: edges.slice(0, 120),
      dynamics: dynamics.slice(0, 24),
    };
  }

  listTimeline(personId: string, limit = 30): {
    personId: string;
    items: Array<{
      id: string;
      kind: 'message' | 'property' | 'relationship';
      title: string;
      body: string;
      timestamp: number;
      evidenceRef?: RelationshipEvidenceRef;
    }>;
    total: number;
  } | null {
    const entity = this.getPersonRow(personId);
    if (!entity) return null;

    const messages = this.loadMessagesForPerson(entity, limit).map((message) => ({
      id: message.id,
      kind: 'message' as const,
      title: message.source_title || message.group_name || message.source_type,
      body: message.summary || cleanText(message.content).slice(0, 240),
      timestamp: message.timestamp,
      evidenceRef: toMessageEvidenceRef(message),
    }));
    const properties = this.loadProperties(personId).map((property) => ({
      id: `property:${property.id}`,
      kind: 'property' as const,
      title: property.property_key,
      body: property.property_value,
      timestamp: property.tx_start,
      evidenceRef: {
        sourceKind: 'entity_property' as const,
        sourceId: String(property.id),
        title: property.property_key,
        snippet: property.property_value,
        timestamp: property.tx_start,
      },
    }));
    const relationships = this.loadRelationships(personId).map((relationship) => ({
      id: `relationship:${relationship.entity_id}:${relationship.relation_type}`,
      kind: 'relationship' as const,
      title: relationship.relation_type,
      body: relationship.context || `${entity.name} ↔ ${relationship.entity_name}`,
      timestamp: relationship.updated_at ?? relationship.created_at,
      evidenceRef: {
        sourceKind: 'relationship' as const,
        sourceId: `${personId}:${relationship.entity_id}:${relationship.relation_type}`,
        title: relationship.relation_type,
        snippet: relationship.context || `${entity.name} ↔ ${relationship.entity_name}`,
        timestamp: relationship.updated_at ?? relationship.created_at,
      },
    }));

    const items = [...messages, ...properties, ...relationships]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, normalizeLimit(limit));

    return { personId, items, total: items.length };
  }

  listOpenLoops(
    personId: string,
    limit = 10,
    options: { includeSensitive?: boolean } = {},
  ): RelationshipContextCard['openLoops'] {
    const entity = this.getPersonRow(personId);
    if (!entity) return [];

    const messages = this
      .loadMessagesForPerson(entity, 80)
      .filter((message) => OPEN_LOOP_PATTERN.test(message.content))
      .filter((message) => options.includeSensitive === true || !isSensitiveMessage(message))
      .slice(0, normalizeLimit(limit));

    return messages.map((message) => {
      const snippetSource =
        message.summary && OPEN_LOOP_PATTERN.test(message.summary)
          ? message.summary
          : message.content;
      return {
        id: `open-loop:${message.id}`,
        title: message.source_title || message.group_name || '可能需要跟进',
        snippet: cleanText(snippetSource).slice(0, 260),
        timestamp: message.timestamp,
        evidenceRef: toMessageEvidenceRef(message),
      };
    });
  }

  listReviewItems(options: {
    status?: ReviewStatus | 'all';
    limit?: number;
    personId?: string;
  } = {}): {
    items: RelationshipReviewItem[];
    total: number;
    generatedAt: number;
  } {
    this.releaseDueSnoozedReviewItems();
    this.ensureReviewCandidates();
    const status = options.status ?? 'pending';
    const limit = normalizeLimit(options.limit);
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (status !== 'all') {
      conditions.push('r.status = ?');
      params.push(status);
    }
    if (options.personId) {
      conditions.push('r.entity_id = ?');
      params.push(options.personId);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(
        `SELECT r.*, e.name AS entity_name
         FROM relationship_review_items r
         JOIN entities e ON e.id = r.entity_id
         ${whereClause}
         ORDER BY
           CASE r.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END ASC,
           r.created_at DESC
         LIMIT ?`,
      )
      .all(...params, limit) as ReviewItemRow[];

    const total = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM relationship_review_items r
           ${whereClause}`,
        )
        .get(...params) as { count: number }
    ).count;

    return {
      items: rows.map(formatReviewItem),
      total,
      generatedAt: now(),
    };
  }

  applyReviewAction(
    id: string,
    action: ReviewAction,
    input: { editedValue?: string; userNote?: string; snoozeUntil?: number } = {},
  ): RelationshipReviewItem | null {
    const row = this.getReviewItemRow(id);
    if (!row) return null;

    const timestamp = now();
    if (action === 'confirm') {
      const value = cleanText(input.editedValue || row.proposed_value);
      this.db
        .prepare(
          `UPDATE relationship_review_items
           SET status = 'confirmed',
               proposed_value = ?,
               user_note = ?,
               confirmed_at = ?,
               snooze_until = NULL,
               updated_at = ?
           WHERE id = ?`,
        )
        .run(value, input.userNote ?? row.user_note, timestamp, timestamp, id);
      this.persistConfirmedProperty(row, value, input.userNote, timestamp);
    } else if (action === 'reject') {
      this.db
        .prepare(
          `UPDATE relationship_review_items
           SET status = 'rejected',
               user_note = ?,
               rejected_at = ?,
               updated_at = ?
           WHERE id = ?`,
        )
        .run(input.userNote ?? row.user_note, timestamp, timestamp, id);
    } else {
      const snoozeUntil = input.snoozeUntil && input.snoozeUntil > timestamp
        ? input.snoozeUntil
        : timestamp + 7 * 86400;
      this.db
        .prepare(
          `UPDATE relationship_review_items
           SET status = 'snoozed',
               user_note = ?,
               snooze_until = ?,
               updated_at = ?
           WHERE id = ?`,
        )
        .run(input.userNote ?? row.user_note, snoozeUntil, timestamp, id);
    }

    const updated = this.getReviewItemRow(id);
    return updated ? formatReviewItem(updated) : null;
  }

  private applyStoredProjection(
    person: RelationshipPersonSummary,
  ): RelationshipPersonSummary {
    const row = this.db
      .prepare(
        `SELECT *
         FROM relationship_radar_people
         WHERE entity_id = ?
         LIMIT 1`,
      )
      .get(person.id) as RadarProjectionRow | undefined;
    if (!row) return person;

    const latestInteractionAt = person.lastInteractionAt ?? row.last_interaction_at ?? undefined;
    const isStale =
      row.last_consolidated_at != null &&
      latestInteractionAt != null &&
      latestInteractionAt > row.last_consolidated_at;
    const dataQuality: DataQuality = isStale
      ? 'stale'
      : this.hasRelationshipContextProperty(person.id)
        ? 'confirmed'
        : row.data_quality;

    return {
      ...person,
      radarState: row.radar_state || person.radarState,
      score: roundScore(row.score ?? person.score),
      interactionCount: Math.max(person.interactionCount, row.interaction_count ?? 0),
      activeDays: Math.max(person.activeDays, row.active_days ?? 0),
      lastInteractionAt: latestInteractionAt,
      dataQuality,
      projectionSource: row.projection_source || person.projectionSource,
      generatedAt: row.generated_at || person.generatedAt,
      dirtySince: row.dirty_since ?? (isStale ? latestInteractionAt : undefined),
      lastConsolidatedAt: row.last_consolidated_at ?? undefined,
      reason: row.summary || person.reason,
    };
  }

  private loadStoredContextCard(
    personId: string,
    surface?: string,
    tokenBudget?: number,
    includeSensitive = false,
  ): RelationshipContextCard | null {
    const row = this.db
      .prepare(
        `SELECT *
         FROM relationship_context_cards
         WHERE entity_id = ?
         LIMIT 1`,
      )
      .get(personId) as ContextCardRow | undefined;
    if (!row) return null;
    if (row.expires_at && row.expires_at < now()) return null;

    try {
      const card = JSON.parse(row.context_json) as RelationshipContextCard;
      const hydrated: RelationshipContextCard = {
        ...card,
        surface: surface ?? card.surface,
        tokenBudget: tokenBudget ?? card.tokenBudget,
        dataQuality: row.data_quality,
        projectionSource:
          row.data_quality === 'confirmed'
            ? ('user_confirmed' as const)
            : ('background' as const),
        contextMd: row.context_md,
        evidenceRefs: safeJsonParse<RelationshipEvidenceRef[]>(
          row.evidence_refs_json,
          card.evidenceRefs,
        ),
        generatedAt: row.generated_at,
      };
      if (
        includeSensitive &&
        hydrated.privacySummary?.sensitiveIncluded === false &&
        countRedactedContextItems(hydrated.privacySummary) > 0
      ) {
        return null;
      }
      return applyContextPrivacy(hydrated, includeSensitive);
    } catch {
      return null;
    }
  }

  private shouldConsolidate(personId: string, timestamp: number): boolean {
    const row = this.db
      .prepare(
        `SELECT last_consolidated_at, dirty_since
         FROM relationship_radar_people
         WHERE entity_id = ?
         LIMIT 1`,
      )
      .get(personId) as
      | { last_consolidated_at: number | null; dirty_since: number | null }
      | undefined;
    if (!row?.last_consolidated_at) return true;
    if (row.dirty_since && row.dirty_since > row.last_consolidated_at) return true;
    return timestamp - row.last_consolidated_at > 24 * 3600;
  }

  private upsertContextCard(
    card: RelationshipContextCard,
    timestamp: number,
  ): void {
    const sourceHash = contentHash(
      JSON.stringify({
        person: card.person.id,
        bullets: card.bullets,
        facts: card.knownFacts,
        openLoops: card.openLoops.map((item) => item.evidenceRef.sourceId),
        evidence: card.evidenceRefs.map((item) => item.sourceId),
      }),
    );
    this.db
      .prepare(
        `INSERT INTO relationship_context_cards (
           entity_id, data_quality, context_json, context_md,
           evidence_refs_json, source_hash, generated_at, expires_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(entity_id) DO UPDATE SET
           data_quality = excluded.data_quality,
           context_json = excluded.context_json,
           context_md = excluded.context_md,
           evidence_refs_json = excluded.evidence_refs_json,
           source_hash = excluded.source_hash,
           generated_at = excluded.generated_at,
           expires_at = excluded.expires_at,
           updated_at = excluded.updated_at`,
      )
      .run(
        card.person.id,
        card.dataQuality,
        JSON.stringify(card),
        card.contextMd,
        JSON.stringify(card.evidenceRefs),
        sourceHash,
        timestamp,
        timestamp + 30 * 86400,
        timestamp,
      );
  }

  private upsertRelationshipEvents(
    card: RelationshipContextCard,
    timestamp: number,
  ): void {
    const insert = this.db.prepare(
      `INSERT INTO relationship_event_index (
         id, entity_id, event_type, title, body, source_kind, source_id,
         source_ts, evidence_refs_json, confidence, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
       ON CONFLICT(entity_id, event_type, source_kind, source_id) DO UPDATE SET
         title = excluded.title,
         body = excluded.body,
         evidence_refs_json = excluded.evidence_refs_json,
         confidence = excluded.confidence,
         status = excluded.status,
         updated_at = excluded.updated_at`,
    );

    for (const openLoop of card.openLoops.slice(0, 8)) {
      const ref = openLoop.evidenceRef;
      insert.run(
        contentHash(`${card.person.id}:open_loop:${ref.sourceKind}:${ref.sourceId}`),
        card.person.id,
        'open_loop',
        openLoop.title,
        openLoop.snippet,
        ref.sourceKind,
        ref.sourceId,
        openLoop.timestamp,
        JSON.stringify([ref]),
        0.72,
        timestamp,
        timestamp,
      );
    }

    for (const fact of card.knownFacts.slice(0, 8)) {
      insert.run(
        contentHash(`${card.person.id}:known_fact:${fact.key}:${fact.value}`),
        card.person.id,
        fact.confirmed ? 'confirmed_fact' : 'candidate_fact',
        fact.key,
        fact.value,
        'entity_property',
        `${fact.key}:${fact.value}`,
        timestamp,
        JSON.stringify(card.evidenceRefs.slice(0, 3)),
        fact.confidence,
        timestamp,
        timestamp,
      );
    }
  }

  private loadCalendarEvent(eventId: string): CalendarEventRow | null {
    const row = this.db
      .prepare(
        `SELECT id, external_id, title, description_preview, start_at, end_at,
                organizer_json, attendees_json
         FROM calendar_events
         WHERE id = ? OR external_id = ?
         ORDER BY start_at DESC
         LIMIT 1`,
      )
      .get(eventId, eventId) as CalendarEventRow | undefined;
    return row ?? null;
  }

  private loadPersonRows(search?: string): EntityRow[] {
    if (search?.trim()) {
      const pattern = likePattern(search.trim());
      return this.db
        .prepare(
          `SELECT id, name, aliases_json, description, importance, first_seen,
                  last_seen, mention_count, tags_json
           FROM entities
           WHERE type = 'Person'
             AND status = 'active'
             AND (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')
           ORDER BY importance DESC, last_seen DESC
           LIMIT 200`,
        )
        .all(pattern, pattern) as EntityRow[];
    }

    return this.db
      .prepare(
        `SELECT id, name, aliases_json, description, importance, first_seen,
                last_seen, mention_count, tags_json
         FROM entities
         WHERE type = 'Person' AND status = 'active'
         ORDER BY importance DESC, last_seen DESC
         LIMIT 200`,
      )
      .all() as EntityRow[];
  }

  private getPersonRow(personId: string): EntityRow | null {
    const row = this.db
      .prepare(
        `SELECT id, name, aliases_json, description, importance, first_seen,
                last_seen, mention_count, tags_json
         FROM entities
         WHERE id = ? AND type = 'Person' AND status = 'active'
         LIMIT 1`,
      )
      .get(personId) as EntityRow | undefined;
    return row ?? null;
  }

  private findPersonByName(name: string): EntityRow | null {
    return this.findPersonForAttendee({ name }).person;
  }

  private findPersonForAttendee(attendee: MeetingAttendeeIdentity): {
    person: EntityRow | null;
    matchedBy: AttendeeMatchKind;
    confidence: number;
    reason: string;
  } {
    const candidates = this.db
      .prepare(
        `SELECT id, name, aliases_json, description, importance, first_seen,
                last_seen, mention_count, tags_json
         FROM entities
         WHERE type = 'Person' AND status = 'active'
         ORDER BY importance DESC, last_seen DESC
         LIMIT 500`,
      )
      .all() as EntityRow[];
    const identity = normalizeAttendeeIdentity(attendee);
    let best:
      | {
          person: EntityRow;
          matchedBy: AttendeeMatchKind;
          confidence: number;
          reason: string;
        }
      | null = null;

    for (const candidate of candidates) {
      const match = scoreAttendeePersonMatch(identity, candidate);
      if (!match) continue;
      if (!best || match.confidence > best.confidence) {
        best = {
          person: candidate,
          ...match,
        };
      }
    }

    if (best) return best;
    return {
      person: null,
      matchedBy: 'none',
      confidence: 0,
      reason: identity.email
        ? `没有找到与 ${identity.email} 或显示名匹配的 Person 记录`
        : '没有找到与该显示名匹配的 Person 记录',
    };
  }

  private buildPersonSummary(row: EntityRow, generatedAt: number): RelationshipPersonSummary {
    const aliases = safeJsonParse<string[]>(row.aliases_json, []).filter(Boolean);
    const tags = safeJsonParse<string[]>(row.tags_json, []).filter(Boolean);
    const messages = this.loadMessagesForPerson(row, 120);
    const properties = this.loadProperties(row.id);
    const relationships = this.loadRelationships(row.id);
    const messageStats = getMessageStats(messages);
    const interactionCount = Math.max(messages.length, row.mention_count ?? 0);
    const activeDays =
      messageStats.activeDays ||
      getFallbackActiveDays(row.first_seen ?? undefined, row.last_seen ?? undefined);
    const lastInteractionAt = messageStats.lastAt ?? row.last_seen ?? undefined;
    const score = calculateScore({
      interactionCount,
      activeDays,
      sourceCount: messageStats.sourceTypes.length,
      lastInteractionAt,
      importance: row.importance ?? 0.5,
      confirmedFacts: properties.filter((property) => property.is_final).length,
      generatedAt,
    });
    const radarState = chooseRadarState({
      score,
      interactionCount,
      activeDays,
      recent7Count: messageStats.recent7Count,
      recent30Count: messageStats.recent30Count,
      lastInteractionAt,
      generatedAt,
    });
    const contextBullets = [
      `${interactionCount} 次可见交互，覆盖 ${activeDays} 个活跃日`,
      lastInteractionAt
        ? `最近一次相关记忆在 ${formatDay(lastInteractionAt)}`
        : '还没有明确的最近互动时间',
      relationships.length > 0
        ? `关联 ${relationships.slice(0, 3).map((item) => item.entity_name).join('、')}`
        : '尚未形成稳定的项目/主题关系',
    ];

    return {
      id: row.id,
      name: row.name,
      aliases,
      description: row.description ?? undefined,
      tags,
      score,
      radarState,
      interactionCount,
      activeDays,
      firstSeen: row.first_seen ?? undefined,
      lastSeen: row.last_seen ?? undefined,
      lastInteractionAt,
      mentionCount: row.mention_count ?? 0,
      confidence: roundScore(Math.min(0.95, 0.35 + score * 0.55)),
      dataQuality: this.hasRelationshipContextProperty(row.id)
        ? 'confirmed'
        : 'indexed',
      projectionSource: this.hasRelationshipContextProperty(row.id)
        ? 'user_confirmed'
        : 'lazy',
      generatedAt,
      reason: buildReason(radarState, interactionCount, activeDays, lastInteractionAt),
      signals: {
        recent: roundScore(getRecentSignal(lastInteractionAt, generatedAt)),
        frequency: roundScore(Math.min(interactionCount / 40, 1)),
        breadth: roundScore(Math.min(messageStats.sourceTypes.length / 4, 1)),
        confirmedFacts: properties.filter((property) => property.is_final).length,
      },
      contextBullets,
      evidenceCount: messages.length,
      reviewPendingCount: this.countPendingReviewItems(row.id),
    };
  }

  private loadMessagesForPerson(row: EntityRow, limit: number): MessageRow[] {
    const names = uniqueStrings([row.name, ...safeJsonParse<string[]>(row.aliases_json, [])])
      .filter((name) => name.length >= 2)
      .slice(0, 8);
    if (names.length === 0) return [];

    const clauses: string[] = ['entities_json LIKE ? ESCAPE \'\\\''];
    const params: Array<string | number> = [likePattern(row.id)];
    for (const name of names) {
      clauses.push('sender = ?');
      params.push(name);
      clauses.push('content LIKE ? ESCAPE \'\\\'');
      params.push(likePattern(name));
      clauses.push('entities_json LIKE ? ESCAPE \'\\\'');
      params.push(likePattern(name));
    }
    params.push(normalizeLimit(limit));

    return this.db
      .prepare(
        `SELECT id, content, summary, source_type, source_url, source_title,
                sender, group_id, group_name, timestamp, importance
         FROM messages_raw
         WHERE ${clauses.join(' OR ')}
         ORDER BY timestamp DESC
         LIMIT ?`,
      )
      .all(...params) as MessageRow[];
  }

  private loadProperties(personId: string): PropertyRow[] {
    return this.db
      .prepare(
        `SELECT id, property_key, property_value, value_type, source_context,
                confidence, is_final, tx_start
         FROM entity_properties
         WHERE entity_id = ?
           AND status = 'active'
           AND tx_end IS NULL
         ORDER BY is_final DESC, confidence DESC, tx_start DESC
         LIMIT 40`,
      )
      .all(personId) as PropertyRow[];
  }

  private loadRelationships(personId: string): RelationshipRow[] {
    return this.db
      .prepare(
        `SELECT r.relation_type,
                r.strength,
                r.co_occurrence_count,
                r.context,
                CASE WHEN r.from_entity_id = ? THEN r.to_entity_id ELSE r.from_entity_id END AS entity_id,
                e.name AS entity_name,
                e.type AS entity_type,
                r.updated_at,
                r.created_at
         FROM relationships r
         JOIN entities e
           ON e.id = CASE WHEN r.from_entity_id = ? THEN r.to_entity_id ELSE r.from_entity_id END
         WHERE r.from_entity_id = ? OR r.to_entity_id = ?
         ORDER BY r.strength DESC, r.co_occurrence_count DESC
         LIMIT 30`,
      )
      .all(personId, personId, personId, personId) as RelationshipRow[];
  }

  private upsertRadarProjection(
    item: RelationshipPersonSummary,
    timestamp: number,
    options: {
      dataQuality?: DataQuality;
      projectionSource?: ProjectionSource;
      summary?: string | null;
      dirtySince?: number | null;
      lastConsolidatedAt?: number | null;
      evidenceRefs?: RelationshipEvidenceRef[];
    } = {},
  ): void {
    const dataQuality = options.dataQuality ?? item.dataQuality;
    const projectionSource = options.projectionSource ?? item.projectionSource;
    this.db
      .prepare(
        `INSERT INTO relationship_radar_people (
           entity_id, radar_state, data_quality, projection_source, score,
           interaction_count, active_days, last_interaction_at,
           evidence_refs_json, summary, dirty_since, last_consolidated_at,
           generated_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(entity_id) DO UPDATE SET
           radar_state = excluded.radar_state,
           data_quality = excluded.data_quality,
           projection_source = excluded.projection_source,
           score = excluded.score,
           interaction_count = excluded.interaction_count,
           active_days = excluded.active_days,
           last_interaction_at = excluded.last_interaction_at,
           evidence_refs_json = excluded.evidence_refs_json,
           summary = excluded.summary,
           dirty_since = excluded.dirty_since,
           last_consolidated_at = excluded.last_consolidated_at,
           generated_at = excluded.generated_at,
           updated_at = excluded.updated_at`,
      )
      .run(
        item.id,
        item.radarState,
        dataQuality,
        projectionSource,
        item.score,
        item.interactionCount,
        item.activeDays,
        item.lastInteractionAt ?? null,
        JSON.stringify(options.evidenceRefs ?? []),
        options.summary ?? null,
        options.dirtySince ?? (dataQuality === 'indexed' ? item.lastInteractionAt ?? null : null),
        options.lastConsolidatedAt ?? null,
        timestamp,
        timestamp,
      );
  }

  private ensureReviewCandidates(): void {
    const people = this.listPeople({ limit: 40 }).items;
    const timestamp = now();

    for (const person of people) {
      if (person.score < DEFAULT_THRESHOLD.minimumScore) continue;
      if (this.hasRelationshipContextProperty(person.id)) continue;

      const id = `relationship:${person.id}:relationship_context`;
      const evidenceRefs = this.getPersonRow(person.id)
        ? this.loadMessagesForPerson(this.getPersonRow(person.id)!, 3).map(toMessageEvidenceRef)
        : [];

      this.db
        .prepare(
          `INSERT OR IGNORE INTO relationship_review_items (
             id, entity_id, item_type, proposed_key, title, proposed_value,
             reason, confidence, priority, evidence_refs_json, status,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        )
        .run(
          id,
          person.id,
          'person_context',
          'relationship_context',
          `确认与 ${person.name} 的协作上下文`,
          `${person.name} 是高频关系对象：${person.interactionCount} 次可见交互，${person.activeDays} 个活跃日，关系状态为 ${person.radarState}。`,
          `达到关系雷达阈值，建议确认这个上下文是否应该进入人物画像并反哺检索。`,
          person.confidence,
          person.score >= 0.75 ? 'high' : 'normal',
          JSON.stringify(evidenceRefs),
          timestamp,
          timestamp,
        );
    }
  }

  private hasRelationshipContextProperty(personId: string): boolean {
    const row = this.db
      .prepare(
        `SELECT id
         FROM entity_properties
         WHERE entity_id = ?
           AND property_key = 'relationship_context'
           AND status = 'active'
           AND tx_end IS NULL
         LIMIT 1`,
      )
      .get(personId);
    return Boolean(row);
  }

  private releaseDueSnoozedReviewItems(timestamp = now()): void {
    this.db
      .prepare(
        `UPDATE relationship_review_items
         SET status = 'pending',
             snooze_until = NULL,
             updated_at = ?
         WHERE status = 'snoozed'
           AND snooze_until IS NOT NULL
           AND snooze_until <= ?`,
      )
      .run(timestamp, timestamp);
  }

  private countPendingReviewItems(personId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM relationship_review_items
         WHERE entity_id = ? AND status = 'pending'`,
      )
      .get(personId) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  private getReviewItemRow(id: string): ReviewItemRow | null {
    const row = this.db
      .prepare(
        `SELECT r.*, e.name AS entity_name
         FROM relationship_review_items r
         JOIN entities e ON e.id = r.entity_id
         WHERE r.id = ?
         LIMIT 1`,
      )
      .get(id) as ReviewItemRow | undefined;
    return row ?? null;
  }

  private persistConfirmedProperty(
    row: ReviewItemRow,
    value: string,
    userNote: string | undefined,
    timestamp: number,
  ): void {
    this.db
      .prepare(
        `INSERT INTO entity_properties (
           entity_id, property_key, property_value, value_type,
           source_author, source_authority, source_context, tx_start,
           confidence, is_final, status, action_type
         ) VALUES (?, ?, ?, 'string', 'user', 'self', ?, ?, ?, 1, 'active', 'confirm')`,
      )
      .run(
        row.entity_id,
        row.proposed_key,
        value,
        userNote || `Confirmed from relationship radar item ${row.id}`,
        timestamp,
        row.confidence,
      );
  }
}

const OPEN_LOOP_PATTERN =
  /(follow\s*up|todo|blocked|blocker|pending|need|needs|owner|deadline|ETA|待办|跟进|阻塞|需要|负责人|截止|下次|确认|是否|\?)/i;

function normalizeLimit(value: number | undefined): number {
  const parsed = Number(value ?? DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.floor(parsed), 1), MAX_LIMIT);
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const SENSITIVE_KEY_PATTERN =
  /(email|e-mail|mail|phone|mobile|address|birthday|birth_date|ssn|passport|salary|compensation|medical|health|secret|password|token|credential|private|personal|手机号|电话|邮箱|邮件|地址|生日|薪资|工资|医疗|健康|隐私|私人|密钥|密码|令牌)/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const US_PHONE_PATTERN = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/;
const SECRET_VALUE_PATTERN =
  /\b(sk-[A-Za-z0-9_-]{12,}|xox[baprs]-[A-Za-z0-9-]+|gh[pousr]_[A-Za-z0-9_]{12,}|api[_\s-]?key|password|secret|token|jwt|bearer\s+[A-Za-z0-9._-]{16,})\b/i;
const SENSITIVE_SOURCE_PATTERN = /(private|personal|profile|user_core|manual|secret)/i;

function isSensitiveText(value: string | null | undefined): boolean {
  const text = value || '';
  return EMAIL_PATTERN.test(text) || US_PHONE_PATTERN.test(text) || SECRET_VALUE_PATTERN.test(text);
}

function isSensitiveKey(value: string | null | undefined): boolean {
  return SENSITIVE_KEY_PATTERN.test(value || '');
}

function isSensitiveTerm(value: string | null | undefined): boolean {
  return isSensitiveKey(value) || isSensitiveText(value);
}

function isSensitiveProperty(property: PropertyRow): boolean {
  return (
    isSensitiveKey(property.property_key) ||
    isSensitiveText(property.property_value) ||
    isSensitiveKey(property.source_context) ||
    isSensitiveText(property.source_context)
  );
}

function isSensitiveMessage(message: MessageRow): boolean {
  return (
    SENSITIVE_SOURCE_PATTERN.test(message.source_type) ||
    isSensitiveText(message.source_url) ||
    isSensitiveText(message.summary) ||
    isSensitiveText(message.content)
  );
}

function isSensitiveRelationship(relationship: RelationshipRow): boolean {
  return (
    isSensitiveKey(relationship.relation_type) ||
    isSensitiveKey(relationship.context) ||
    isSensitiveText(relationship.context)
  );
}

function isSensitiveEvidenceRef(ref: RelationshipEvidenceRef): boolean {
  return (
    isSensitiveKey(ref.title) ||
    isSensitiveText(ref.snippet) ||
    isSensitiveText(ref.sourceUrl)
  );
}

function isSensitiveOpenLoop(loop: RelationshipContextCard['openLoops'][number]): boolean {
  return (
    isSensitiveKey(loop.title) ||
    isSensitiveText(loop.snippet) ||
    isSensitiveEvidenceRef(loop.evidenceRef)
  );
}

function isSensitiveFact(fact: RelationshipContextCard['knownFacts'][number]): boolean {
  return isSensitiveKey(fact.key) || isSensitiveText(fact.value);
}

function isSensitiveHint(
  hint: RelationshipContextCard['relationshipHints'][number],
): boolean {
  return (
    isSensitiveKey(hint.relationType) ||
    isSensitiveKey(hint.context) ||
    isSensitiveText(hint.context)
  );
}

function redactSensitivePersonAliases(
  person: RelationshipPersonSummary,
): RelationshipPersonSummary {
  return {
    ...person,
    aliases: person.aliases.filter((alias) => !isSensitiveTerm(alias)),
  };
}

function redactSensitiveRetrievalHints(
  hints: RelationshipContextCard['retrievalHints'],
): RelationshipContextCard['retrievalHints'] {
  return {
    entityIds: hints.entityIds,
    names: hints.names.filter((name) => !isSensitiveTerm(name)),
    boostTerms: hints.boostTerms.filter((term) => !isSensitiveTerm(term)),
    sourceTypes: hints.sourceTypes.filter((sourceType) => !SENSITIVE_SOURCE_PATTERN.test(sourceType)),
  };
}

function countRedactedContextItems(
  summary: RelationshipContextCard['privacySummary'] | undefined,
): number {
  if (!summary) return 0;
  return (
    summary.redactedAliases +
    summary.redactedFacts +
    summary.redactedRelationshipHints +
    summary.redactedEvidenceRefs +
    summary.redactedOpenLoops +
    summary.redactedRetrievalHints
  );
}

function withRedactionNote(
  summary: Omit<RelationshipContextCard['privacySummary'], 'redactionNote'>,
): RelationshipContextCard['privacySummary'] {
  const hidden = countRedactedContextItems(summary);
  if (summary.sensitiveIncluded || hidden === 0) return summary;
  return {
    ...summary,
    redactionNote: `${hidden} 条可能敏感的人物上下文默认未纳入；只有显式 includeSensitive 才会返回。`,
  };
}

function buildContextPrivacySummary(input: {
  includeSensitive: boolean;
  rawPerson: RelationshipPersonSummary;
  person: RelationshipPersonSummary;
  properties: PropertyRow[];
  visibleProperties: PropertyRow[];
  relationships: RelationshipRow[];
  visibleRelationships: RelationshipRow[];
  messages: MessageRow[];
  visibleMessages: MessageRow[];
  openLoops: RelationshipContextCard['openLoops'];
  visibleOpenLoops: RelationshipContextCard['openLoops'];
  retrievalHints: RelationshipContextCard['retrievalHints'];
  visibleRetrievalHints: RelationshipContextCard['retrievalHints'];
}): RelationshipContextCard['privacySummary'] {
  return withRedactionNote({
    sensitiveIncluded: input.includeSensitive,
    redactedAliases: Math.max(input.rawPerson.aliases.length - input.person.aliases.length, 0),
    redactedFacts: Math.max(input.properties.length - input.visibleProperties.length, 0),
    redactedRelationshipHints: Math.max(
      input.relationships.length - input.visibleRelationships.length,
      0,
    ),
    redactedEvidenceRefs: Math.max(
      input.messages.length +
        Math.min(input.properties.length, 4) -
        input.visibleMessages.length -
        Math.min(input.visibleProperties.length, 4),
      0,
    ),
    redactedOpenLoops: Math.max(input.openLoops.length - input.visibleOpenLoops.length, 0),
    redactedRetrievalHints: Math.max(
      input.retrievalHints.names.length +
        input.retrievalHints.boostTerms.length +
        input.retrievalHints.sourceTypes.length -
        input.visibleRetrievalHints.names.length -
        input.visibleRetrievalHints.boostTerms.length -
        input.visibleRetrievalHints.sourceTypes.length,
      0,
    ),
  });
}

function applyContextPrivacy(
  card: RelationshipContextCard,
  includeSensitive: boolean,
): RelationshipContextCard {
  if (includeSensitive) {
    return {
      ...card,
      privacySummary: {
        ...(card.privacySummary ?? emptyContextPrivacySummary(true)),
        sensitiveIncluded: true,
        redactionNote: undefined,
      },
    };
  }

  const person = redactSensitivePersonAliases(card.person);
  const knownFacts = card.knownFacts.filter((fact) => !isSensitiveFact(fact));
  const relationshipHints = card.relationshipHints.filter((hint) => !isSensitiveHint(hint));
  const evidenceRefs = card.evidenceRefs.filter((ref) => !isSensitiveEvidenceRef(ref));
  const openLoops = card.openLoops.filter((loop) => !isSensitiveOpenLoop(loop));
  const retrievalHints = redactSensitiveRetrievalHints(card.retrievalHints);
  const previousSummary = card.privacySummary?.sensitiveIncluded === false
    ? card.privacySummary
    : emptyContextPrivacySummary(false);
  const privacySummary = withRedactionNote({
    sensitiveIncluded: false,
    redactedAliases:
      previousSummary.redactedAliases + Math.max(card.person.aliases.length - person.aliases.length, 0),
    redactedFacts:
      previousSummary.redactedFacts + Math.max(card.knownFacts.length - knownFacts.length, 0),
    redactedRelationshipHints:
      previousSummary.redactedRelationshipHints +
      Math.max(card.relationshipHints.length - relationshipHints.length, 0),
    redactedEvidenceRefs:
      previousSummary.redactedEvidenceRefs +
      Math.max(card.evidenceRefs.length - evidenceRefs.length, 0),
    redactedOpenLoops:
      previousSummary.redactedOpenLoops + Math.max(card.openLoops.length - openLoops.length, 0),
    redactedRetrievalHints:
      previousSummary.redactedRetrievalHints +
      Math.max(
        card.retrievalHints.names.length +
          card.retrievalHints.boostTerms.length +
          card.retrievalHints.sourceTypes.length -
          retrievalHints.names.length -
          retrievalHints.boostTerms.length -
          retrievalHints.sourceTypes.length,
        0,
      ),
  });

  return {
    ...card,
    person,
    knownFacts,
    relationshipHints,
    evidenceRefs,
    openLoops,
    retrievalHints,
    privacySummary,
    contextMd: renderContextMarkdown(
      person,
      card.bullets,
      knownFacts,
      openLoops,
      card.tokenBudget,
      privacySummary,
      card.doNotAssume,
    ),
  };
}

function emptyContextPrivacySummary(
  sensitiveIncluded: boolean,
): RelationshipContextCard['privacySummary'] {
  return {
    sensitiveIncluded,
    redactedAliases: 0,
    redactedFacts: 0,
    redactedRelationshipHints: 0,
    redactedEvidenceRefs: 0,
    redactedOpenLoops: 0,
    redactedRetrievalHints: 0,
  };
}

function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function uniqueEvidenceRefs(values: RelationshipEvidenceRef[]): RelationshipEvidenceRef[] {
  const seen = new Set<string>();
  const refs: RelationshipEvidenceRef[] = [];
  for (const value of values) {
    const key = `${value.sourceKind}:${value.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push(value);
  }
  return refs;
}

function comparePeople(a: RelationshipPersonSummary, b: RelationshipPersonSummary): number {
  if (b.score !== a.score) return b.score - a.score;
  return (b.lastInteractionAt ?? 0) - (a.lastInteractionAt ?? 0);
}

function selectHighFrequencyPeople(
  ranked: RelationshipPersonSummary[],
  threshold: RelationshipPeopleThreshold,
  limit: number,
): RelationshipPersonSummary[] {
  const selected = ranked.filter(
    (item) =>
      item.interactionCount >= threshold.minimumInteractionCount &&
      item.activeDays >= threshold.minimumActiveDays &&
      item.score >= threshold.minimumScore,
  );

  if (selected.length >= Math.min(threshold.minimumKeepCount, limit)) {
    return selected;
  }

  const merged = new Map<string, RelationshipPersonSummary>();
  for (const item of selected) merged.set(item.id, item);
  for (const item of ranked.slice(0, Math.min(threshold.minimumKeepCount, limit))) {
    merged.set(item.id, item);
  }
  return Array.from(merged.values()).sort(comparePeople);
}

function getFallbackActiveDays(firstSeen?: number, lastSeen?: number): number {
  if (!firstSeen || !lastSeen) return 0;
  return Math.max(1, Math.ceil((lastSeen - firstSeen) / 86400));
}

function getMessageStats(messages: MessageRow[]): {
  activeDays: number;
  recent7Count: number;
  recent30Count: number;
  lastAt?: number;
  sourceTypes: string[];
} {
  const timestamp = now();
  const daySet = new Set<string>();
  const sourceTypes = new Set<string>();
  let recent7Count = 0;
  let recent30Count = 0;
  let lastAt: number | undefined;

  for (const message of messages) {
    daySet.add(formatDay(message.timestamp));
    sourceTypes.add(message.source_type);
    if (message.timestamp >= timestamp - 7 * 86400) recent7Count += 1;
    if (message.timestamp >= timestamp - 30 * 86400) recent30Count += 1;
    if (!lastAt || message.timestamp > lastAt) lastAt = message.timestamp;
  }

  return {
    activeDays: daySet.size,
    recent7Count,
    recent30Count,
    lastAt,
    sourceTypes: Array.from(sourceTypes),
  };
}

function calculateScore(input: {
  interactionCount: number;
  activeDays: number;
  sourceCount: number;
  lastInteractionAt?: number;
  importance: number;
  confirmedFacts: number;
  generatedAt: number;
}): number {
  const frequency = Math.min(input.interactionCount / 40, 1);
  const activeDays = Math.min(input.activeDays / 12, 1);
  const breadth = Math.min(input.sourceCount / 4, 1);
  const recency = getRecentSignal(input.lastInteractionAt, input.generatedAt);
  const confirmed = Math.min(input.confirmedFacts / 5, 1);
  return roundScore(
    0.3 * frequency +
      0.22 * activeDays +
      0.22 * recency +
      0.14 * Math.min(Math.max(input.importance, 0), 1) +
      0.08 * breadth +
      0.04 * confirmed,
  );
}

function getRecentSignal(lastInteractionAt: number | undefined, generatedAt: number): number {
  if (!lastInteractionAt) return 0;
  const days = Math.max(0, (generatedAt - lastInteractionAt) / 86400);
  return Math.max(0, Math.min(1, 1 - days / 120));
}

function chooseRadarState(input: {
  score: number;
  interactionCount: number;
  activeDays: number;
  recent7Count: number;
  recent30Count: number;
  lastInteractionAt?: number;
  generatedAt: number;
}): RadarState {
  const daysSinceLast = input.lastInteractionAt
    ? (input.generatedAt - input.lastInteractionAt) / 86400
    : Number.POSITIVE_INFINITY;
  if (input.score >= 0.75 && input.interactionCount >= 12 && input.activeDays >= 4) {
    return 'core';
  }
  if (input.recent7Count >= 3 && input.interactionCount < 8) {
    return 'rising';
  }
  if (daysSinceLast > 90 && input.interactionCount >= 4) {
    return 'dormant';
  }
  if (input.score >= 0.5 || input.recent30Count >= 2) {
    return 'active';
  }
  return 'watch';
}

function buildReason(
  state: RadarState,
  interactionCount: number,
  activeDays: number,
  lastInteractionAt: number | undefined,
): string {
  const last = lastInteractionAt ? `最近一次 ${formatDay(lastInteractionAt)}` : '暂无最近互动';
  if (state === 'core') {
    return `长期高频关系，${interactionCount} 次交互，${activeDays} 个活跃日，${last}`;
  }
  if (state === 'active') {
    return `近期仍活跃，${interactionCount} 次交互，${last}`;
  }
  if (state === 'rising') {
    return `最近快速升温，短期互动密集，${last}`;
  }
  if (state === 'dormant') {
    return `历史相关但近期沉默，${interactionCount} 次历史交互`;
  }
  return `候选关系，数据还不足以进入稳定关系雷达`;
}

function buildContextBullets(
  person: RelationshipPersonSummary,
  knownFacts: RelationshipContextCard['knownFacts'],
  relationships: RelationshipContextCard['relationshipHints'],
): string[] {
  const bullets = [...person.contextBullets];
  const confirmedFacts = knownFacts.filter((fact) => fact.confirmed);
  if (confirmedFacts.length > 0) {
    bullets.push(
      `已确认信息：${confirmedFacts
        .slice(0, 3)
        .map((fact) => `${fact.key}=${fact.value}`)
        .join('；')}`,
    );
  }
  if (relationships.length > 0) {
    bullets.push(
      `检索时可同时 boost：${relationships
        .slice(0, 3)
        .map((item) => item.targetName)
        .join('、')}`,
    );
  }
  return bullets.slice(0, 8);
}

function buildDoNotAssume(
  person: RelationshipPersonSummary,
  facts: RelationshipContextCard['knownFacts'],
): string[] {
  const notes = [];
  if (facts.every((fact) => !fact.confirmed)) {
    notes.push('还没有用户确认过的人物偏好或协作上下文，不要把推断当成事实。');
  }
  if (person.radarState === 'watch') {
    notes.push('关系强度仍是候选状态，不要在回复里过度个性化。');
  }
  if (person.radarState === 'dormant') {
    notes.push('近期互动较少，检索时应优先看最新证据。');
  }
  return notes;
}

function buildBoostTerms(
  entity: EntityRow,
  properties: PropertyRow[],
  relationships: RelationshipRow[],
): string[] {
  return uniqueStrings([
    entity.name,
    ...safeJsonParse<string[]>(entity.aliases_json, []),
    ...properties.slice(0, 6).map((property) => property.property_value),
    ...relationships.slice(0, 6).map((relationship) => relationship.entity_name),
  ]).slice(0, 12);
}

function renderContextMarkdown(
  person: RelationshipPersonSummary,
  bullets: string[],
  facts: RelationshipContextCard['knownFacts'],
  openLoops: RelationshipContextCard['openLoops'],
  tokenBudget: number,
  privacySummary?: RelationshipContextCard['privacySummary'],
  doNotAssume: string[] = [],
): string {
  const lines = [
    `# ${person.name} 关系上下文`,
    '',
    `状态：${person.radarState}，分数：${Math.round(person.score * 100)}，置信度：${Math.round(person.confidence * 100)}%`,
    '',
    '## 使用提示',
    ...bullets.map((bullet) => `- ${bullet}`),
  ];

  if (facts.length > 0) {
    lines.push('', '## 已知事实');
    for (const fact of facts.slice(0, 5)) {
      lines.push(`- ${fact.key}: ${fact.value}${fact.confirmed ? '（已确认）' : '（待确认）'}`);
    }
  }

  if (openLoops.length > 0) {
    lines.push('', '## 可能需要跟进');
    for (const item of openLoops.slice(0, 3)) {
      lines.push(`- ${item.snippet}`);
    }
  }

  if (privacySummary?.redactionNote) {
    lines.push('', '## 隐私边界', `- ${privacySummary.redactionNote}`);
  } else if (privacySummary?.sensitiveIncluded) {
    lines.push('', '## 隐私边界', '- 已按显式请求包含敏感上下文，外发前需要人工复核。');
  }

  if (doNotAssume.length > 0) {
    lines.push('', '## 不要假设', ...doNotAssume.map((note) => `- ${note}`));
  }

  return lines.join('\n').slice(0, tokenBudget * 4);
}

function formatDay(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function roundScore(value: number): number {
  return Math.round(Math.min(Math.max(value, 0), 1) * 1000) / 1000;
}

function getSourceTypes(messages: MessageRow[]): string[] {
  return Array.from(new Set(messages.map((message) => message.source_type))).slice(0, 8);
}

function toMessageEvidenceRef(message: MessageRow): RelationshipEvidenceRef {
  return {
    sourceKind: 'message',
    sourceId: message.id,
    title: message.source_title || message.group_name || message.source_type,
    snippet: cleanText(message.summary || message.content).slice(0, 220),
    timestamp: message.timestamp,
    sourceUrl: message.source_url ?? undefined,
    exploreLink: buildExploreLink({ type: 'message', id: message.id }),
  };
}

function formatReviewItem(row: ReviewItemRow): RelationshipReviewItem {
  return {
    id: row.id,
    personId: row.entity_id,
    personName: row.entity_name ?? row.entity_id,
    itemType: row.item_type,
    proposedKey: row.proposed_key,
    title: row.title,
    proposedValue: row.proposed_value,
    reason: row.reason ?? undefined,
    confidence: roundScore(row.confidence),
    priority: row.priority,
    evidenceRefs: safeJsonParse<RelationshipEvidenceRef[]>(row.evidence_refs_json, []),
    status: row.status,
    userNote: row.user_note ?? undefined,
    snoozeUntil: row.snooze_until ?? undefined,
    confirmedAt: row.confirmed_at ?? undefined,
    rejectedAt: row.rejected_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function renderShortPersonSummary(card: RelationshipContextCard): string {
  const qualityLabels: Record<DataQuality, string> = {
    indexed: '索引候选',
    generated: '后台整理',
    confirmed: '用户确认',
    stale: '需刷新',
  };
  const parts = [
    `${card.person.name}：${card.person.interactionCount} 次交互，${card.person.activeDays} 个活跃日`,
    card.person.lastInteractionAt ? `最近 ${formatDay(card.person.lastInteractionAt)}` : '',
    card.openLoops.length > 0 ? `${card.openLoops.length} 个可能 follow-up` : '',
    card.relationshipHints.length > 0
      ? `关联 ${card.relationshipHints.slice(0, 2).map((item) => item.targetName).join('、')}`
      : '',
    `质量：${qualityLabels[card.dataQuality]}`,
  ].filter(Boolean);
  return parts.join('；');
}

function normalizeAttendees(
  raw: unknown,
): MeetingAttendeeIdentity[] {
  const items = Array.isArray(raw) ? raw : [];
  const attendees = items
    .map((item) => {
      if (typeof item === 'string') {
        return parseDisplayNameAndEmail(item);
      }
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const emailAddress =
          record.emailAddress && typeof record.emailAddress === 'object'
            ? (record.emailAddress as Record<string, unknown>)
            : {};
        const rawName =
          record.name ??
          record.displayName ??
          record.summary ??
          emailAddress.name ??
          record.email ??
          record.mail ??
          record.address ??
          '';
        const rawEmail =
          record.email ??
          record.mail ??
          record.address ??
          emailAddress.address ??
          emailAddress.email ??
          '';
        const parsedName = parseDisplayNameAndEmail(String(rawName || ''));
        const parsedEmail = parseDisplayNameAndEmail(String(rawEmail || ''));
        return {
          name: cleanText(parsedName.name || parsedEmail.name),
          email: parsedName.email || parsedEmail.email,
        };
      }
      return { name: '' };
    })
    .filter((item) => item.name || item.email);

  const seen = new Set<string>();
  return attendees.filter((item) => {
    const key = item.email
      ? `email:${item.email.toLowerCase()}`
      : `name:${normalizeIdentityToken(item.name)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseDisplayNameAndEmail(value: string): MeetingAttendeeIdentity {
  const text = cleanText(value);
  if (!text) return { name: '' };
  const angle = text.match(/^(.*?)\s*<([^>]+)>$/);
  if (angle) {
    return {
      name: cleanText(angle[1] || ''),
      email: normalizeEmailToken(angle[2] || '') ?? undefined,
    };
  }

  const email = normalizeEmailToken(text);
  if (!email) return { name: text };
  const name = cleanText(text.replace(email, '').replace(/[<>()]/g, ''));
  return {
    name: name || '',
    email,
  };
}

function normalizeAttendeeIdentity(attendee: MeetingAttendeeIdentity): {
  name: string;
  email?: string;
  nameToken: string;
  emailLocalPart?: string;
} {
  const parsedName = parseDisplayNameAndEmail(attendee.name || '');
  const email = attendee.email
    ? normalizeEmailToken(attendee.email)
    : parsedName.email;
  return {
    name: cleanText(parsedName.name || attendee.name || ''),
    email: email ?? undefined,
    nameToken: normalizeIdentityToken(parsedName.name || attendee.name || ''),
    emailLocalPart: email ? normalizeIdentityToken(email.split('@')[0] || '') : undefined,
  };
}

function scoreAttendeePersonMatch(
  identity: ReturnType<typeof normalizeAttendeeIdentity>,
  person: EntityRow,
): {
  matchedBy: AttendeeMatchKind;
  confidence: number;
  reason: string;
} | null {
  const aliases = safeJsonParse<string[]>(person.aliases_json, []);
  const labels = uniqueStrings([person.name, ...aliases]);
  const labelTokens = labels.map(normalizeIdentityToken).filter(Boolean);
  const labelEmails = labels
    .map((label) => normalizeEmailToken(label))
    .filter((value): value is string => Boolean(value));

  if (identity.email && labelEmails.includes(identity.email)) {
    return {
      matchedBy: 'email',
      confidence: 0.98,
      reason: '按邮箱或邮箱别名匹配',
    };
  }

  if (identity.nameToken && normalizeIdentityToken(person.name) === identity.nameToken) {
    return {
      matchedBy: 'name',
      confidence: 0.96,
      reason: '按参会人显示名匹配',
    };
  }

  if (identity.nameToken && labelTokens.includes(identity.nameToken)) {
    return {
      matchedBy: 'alias',
      confidence: 0.9,
      reason: '按人物别名匹配',
    };
  }

  if (
    identity.emailLocalPart &&
    identity.emailLocalPart.length >= 4 &&
    labelTokens.includes(identity.emailLocalPart)
  ) {
    return {
      matchedBy: 'email_local_part',
      confidence: 0.72,
      reason: '按邮箱前缀匹配，建议会中确认身份',
    };
  }

  return null;
}

function normalizeIdentityToken(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/^mailto:/, '')
    .replace(/[^\p{L}\p{N}@._+-]+/gu, ' ')
    .trim();
}

function normalizeEmailToken(value: string): string | null {
  const match = String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
}

function buildMeetingBriefCoverage(
  attendees: RelationshipMeetingBrief['attendees'],
  options: { totalAttendees?: number; omittedAttendees?: number } = {},
): RelationshipMeetingBrief['coverage'] {
  const processedAttendees = attendees.length;
  const totalAttendees = options.totalAttendees ?? processedAttendees;
  const omittedAttendees = options.omittedAttendees ?? Math.max(0, totalAttendees - processedAttendees);
  const matchedAttendees = attendees.filter((item) => item.personId).length;
  const attendeesWithEvidence = attendees.filter((item) => item.evidenceRefs.length > 0).length;
  const attendeesWithOpenLoops = attendees.filter((item) => item.openLoops.length > 0).length;
  const evidenceRefs = attendees.reduce((total, item) => total + item.evidenceRefs.length, 0);
  const unmatchedAttendees = processedAttendees - matchedAttendees;
  const coverageNote =
    totalAttendees === 0
      ? '未提供参会人，会议简报只能给出通用准备问题。'
      : omittedAttendees > 0
        ? `已分析前 ${processedAttendees}/${totalAttendees} 位参会人，匹配 ${matchedAttendees} 位；另有 ${omittedAttendees} 位未展开，需要手动补充或分批生成。`
      : unmatchedAttendees === 0
        ? `已匹配全部 ${totalAttendees} 位参会人，其中 ${attendeesWithEvidence} 位有可引用证据。`
        : `已匹配 ${matchedAttendees}/${totalAttendees} 位参会人；${unmatchedAttendees} 位需要会中确认角色或补充人物别名。`;

  return {
    totalAttendees,
    processedAttendees,
    matchedAttendees,
    unmatchedAttendees,
    omittedAttendees,
    attendeesWithEvidence,
    attendeesWithOpenLoops,
    evidenceRefs,
    coverageNote,
  };
}

function formatOmittedMeetingAttendee(
  attendee: MeetingAttendeeIdentity,
): RelationshipMeetingBrief['omittedAttendees'][number] {
  return {
    displayName: attendee.name || attendee.email || 'Unknown attendee',
    email: attendee.email,
    reason: `超过前 ${MEETING_BRIEF_ATTENDEE_LIMIT} 位分析上限，暂未展开人物上下文。`,
  };
}

function buildSuggestedQuestions(
  displayName: string | undefined,
  card: RelationshipContextCard | null,
): string[] {
  const name = displayName || card?.person.name || '对方';
  if (!card) {
    return [
      `先确认 ${name} 这次会议最关心的问题是什么。`,
      '询问本次事项是否有明确 owner、deadline 或阻塞。',
    ];
  }

  const questions: string[] = [];
  const firstOpenLoop = card.openLoops[0];
  if (firstOpenLoop) {
    questions.push(`上次提到的“${firstOpenLoop.snippet.slice(0, 44)}”现在进展怎样？`);
  }

  const firstHint = card.relationshipHints[0];
  if (firstHint) {
    questions.push(`这次和 ${firstHint.targetName} 相关的部分，${name} 期望怎么推进？`);
  }

  if (card.knownFacts.some((fact) => !fact.confirmed)) {
    questions.push(`我这边有一些对 ${name} 的上下文还没确认，会议后是否可以补齐？`);
  }

  questions.push('这次同步结束后，下一步 owner 和时间点分别是什么？');
  return uniqueStrings(questions).slice(0, 3);
}
