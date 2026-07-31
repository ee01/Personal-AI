import type Database from 'better-sqlite3';

import type {
  ComposerAssistRequest,
  ComposerAudienceSource,
  ComposerAudienceType,
} from '../types/index.js';

interface SocialEdgeRow {
  relation_type: string;
  confidence: number;
  name: string;
  aliases_json: string | null;
}

export interface ComposerAudienceResolution {
  type: ComposerAudienceType;
  source: ComposerAudienceSource;
  confidence: number;
  matchedPeople: number;
  unresolvedPeople: number;
}

export class ComposerAudienceResolver {
  constructor(private readonly db: Database.Database) {}

  resolve(
    request: ComposerAssistRequest,
    timestamp = Math.floor(Date.now() / 1000),
  ): ComposerAudienceResolution {
    if (request.contextType === 'web_agent_prompt') {
      return {
        type: 'external',
        source: 'scene_default',
        confidence: 1,
        matchedPeople: 0,
        unresolvedPeople: 0,
      };
    }

    const people = uniqueNormalizedPeople(request.audience?.people ?? []);
    const edges = this.loadConfirmedEdges(timestamp);
    const resolved = people.map((person) => resolvePerson(person, edges));
    const matched = resolved.filter(
      (item): item is Exclude<typeof item, null> => item !== null,
    );
    const unresolvedPeople = Math.max(people.length - matched.length, 0);

    if (matched.length > 0) {
      const types = new Set(matched.map((item) => item.type));
      const type: ComposerAudienceType =
        types.size === 1 && unresolvedPeople === 0 ? matched[0].type : 'mixed';
      return {
        type,
        source: 'confirmed_social_edge',
        confidence: roundConfidence(
          Math.min(...matched.map((item) => item.confidence)),
        ),
        matchedPeople: matched.length,
        unresolvedPeople,
      };
    }

    const hintedType = mapRelationshipType(
      request.audience?.relationshipHint || '',
    );
    if (hintedType) {
      return {
        type: hintedType,
        source: 'relationship_hint',
        confidence: 0.6,
        matchedPeople: 0,
        unresolvedPeople: people.length,
      };
    }

    return {
      type: 'unknown',
      source: 'unresolved',
      confidence: 0,
      matchedPeople: 0,
      unresolvedPeople: people.length,
    };
  }

  private loadConfirmedEdges(timestamp: number): SocialEdgeRow[] {
    return this.db
      .prepare(
        `SELECT se.relation_type, se.confidence, e.name, e.aliases_json
           FROM social_edges se
           JOIN entities e ON e.id = se.to_entity_id
          WHERE se.user_confirmed = 1
            AND (se.valid_to IS NULL OR se.valid_to >= ?)
            AND e.type = 'Person'
            AND e.status = 'active'
          ORDER BY se.confidence DESC, se.updated_at DESC
          LIMIT 500`,
      )
      .all(timestamp) as SocialEdgeRow[];
  }
}

function resolvePerson(
  normalizedPerson: string,
  edges: SocialEdgeRow[],
): { type: ComposerAudienceType; confidence: number } | null {
  for (const edge of edges) {
    const identities = [edge.name, ...safeStringArray(edge.aliases_json)]
      .map(normalizeIdentity)
      .filter(Boolean);
    if (!identities.includes(normalizedPerson)) continue;
    const type = mapRelationshipType(edge.relation_type);
    if (!type) return null;
    return {
      type,
      confidence: edge.confidence,
    };
  }
  return null;
}

function mapRelationshipType(value: string): ComposerAudienceType | null {
  const normalized = value.toLowerCase().replace(/[\s-]+/g, '_');
  if (
    /(?:^|_)(?:reports?_to|reporting_to)(?:_|$)/.test(normalized) ||
    /manager|boss|supervisor|team_lead|领导|老板|上级/.test(normalized)
  ) {
    return 'manager';
  }
  if (
    /(?:^|_)(?:direct_report|report|subordinate|manager_of|manages)(?:_|$)/.test(
      normalized,
    ) ||
    /下属|汇报对象/.test(normalized)
  ) {
    return 'direct_report';
  }
  if (/peer|colleague|coworker|co_worker|teammate|同事|同级/.test(normalized)) {
    return 'peer';
  }
  if (
    /external|client|customer|vendor|partner|friend|family|客户|外部|供应商|伙伴|朋友|家人/.test(
      normalized,
    )
  ) {
    return 'external';
  }
  return null;
}

function uniqueNormalizedPeople(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeIdentity).filter(Boolean)));
}

function normalizeIdentity(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[<>()\[\]{}'"`]/g, ' ')
    .replace(/[^a-z0-9@._\-\u3400-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function roundConfidence(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}
