// ============ Core Domain Types ============

export type EntityType = 'Person' | 'Project' | 'Task' | 'Organization' | 'Document' | 'Technology' | 'Topic';
export type SourceType = 'glip' | 'jira' | 'web' | 'manual' | 'system';
export type RecallSourceType =
  | SourceType
  | 'daily_log'
  | 'project_summary'
  | 'reflection'
  | 'dream'
  | 'entity_profile'
  | 'markdown'
  | 'user_core';
export type ConsolidationLevel = 'temporary' | 'working' | 'consolidated' | 'core';
export type ActionState = 'pending' | 'approved' | 'executed' | 'dismissed' | 'expired';
export type ConfirmState = 'pending' | 'answered' | 'snoozed' | 'expired';
export type AuthorityLevel = 'official' | 'team_lead' | 'peer' | 'self' | 'inferred';
export type PropertyAction = 'set' | 'update' | 'retract' | 'confirm';
export type EntityStatus = 'active' | 'archived' | 'merged';
export type ProfileItemType = 'fact' | 'preference' | 'habit' | 'interest' | 'constraint';
export type ProfileSourceKind = 'explicit' | 'inferred' | 'system';
export type ProfileItemStatus = 'active' | 'superseded' | 'retracted' | 'archived';
export type SocialRelationType = 'colleague' | 'manager' | 'report' | 'friend' | 'client' | 'vendor';
export type OpinionDimension = 'trust' | 'like' | 'collaboration' | 'competence' | 'risk';
export type OpinionStatus = 'pending_confirm' | 'active' | 'retracted';
export type AgentProfileKind = 'identity' | 'soul' | 'policy';

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  aliases?: string[];
  description?: string;
  importance: number;
  accessCount: number;
  lastAccessed?: number;
  firstSeen?: number;
  lastSeen?: number;
  mentionCount: number;
  tags?: string[];
  markdownPath?: string;
  status: EntityStatus;
  mergedInto?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface EntityProperty {
  id: number;
  entityId: string;
  propertyKey: string;
  propertyValue: string;
  valueType: string;
  sourceMessageId?: string;
  sourceAuthor?: string;
  sourceAuthority?: AuthorityLevel;
  sourceContext?: string;
  validFrom?: number;
  validTo?: number;
  txStart: number;
  txEnd?: number;
  confidence: number;
  supersededBy?: number;
  supersedeReason?: string;
  isFinal: boolean;
  status: string;
  actionType?: PropertyAction;
}

export interface Relationship {
  id: number;
  fromEntityId: string;
  toEntityId: string;
  relationType: string;
  strength: number;
  coOccurrenceCount: number;
  evidenceMessageIds?: string[];
  context?: string;
  validFrom?: number;
  validTo?: number;
  createdAt: number;
  updatedAt?: number;
}

export interface MessageRaw {
  id: string;
  content: string;
  summary?: string;
  sourceType: SourceType;
  sourceUrl?: string;
  sourceTitle?: string;
  sender?: string;
  groupId?: string;
  groupName?: string;
  timestamp: number;
  entities?: Array<{ type: EntityType; name: string; id?: string }>;
  matchedProjects?: string[];
  importance: number;
  sentiment: string;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt?: number;
}

export interface Chunk {
  chunkId: number;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  content: string;
  contentHash: string;
  sourceType?: string;
  relatedProject?: string;
  relatedEntityId?: string;
  tokenCount?: number;
  createdAt: number;
  updatedAt?: number;
}

export interface MemoryMetadata {
  id: number;
  targetType: string;
  targetId: string;
  salienceScore: number;
  importance: number;
  frequency: number;
  recencyBoost: number;
  surpriseScore: number;
  redundancy: number;
  accessCount: number;
  lastAccessed?: number;
  decayRate: number;
  halfLifeDays: number;
  consolidationLevel: ConsolidationLevel;
  nextReviewAt?: number;
  createdAt: number;
  updatedAt?: number;
}

export interface WatchedProject {
  id: string;
  entityId?: string;
  name: string;
  description?: string;
  aliases?: string[];
  autoCaptureRules?: Array<{ field: string; pattern: string; action: string }>;
  trackedProperties?: string[];
  isActive: boolean;
  priority: number;
  createdAt: number;
  updatedAt?: number;
}

export interface ReflectionArtifact {
  id: string;
  scope: string;
  scopeRef?: string;
  summary: string;
  lessons?: string[];
  openQuestions?: string[];
  discoveries?: string[];
  suggestedActionIds?: string[];
  sourceMessageIds?: string[];
  markdownPath?: string;
  createdAt: number;
}

export interface ProposedAction {
  id: string;
  type: string;
  title: string;
  description?: string;
  params?: Record<string, any>;
  riskLevel: string;
  confidence: number;
  evidenceRefs?: string[];
  requiresApproval: boolean;
  state: ActionState;
  approvedAt?: number;
  executedAt?: number;
  source?: string;
  expiresAt?: number;
  createdAt: number;
}

export interface ConfirmRequest {
  id: string;
  question: string;
  context?: string;
  options?: Array<{ label: string; value: string }>;
  evidenceRefs?: string[];
  category?: string;
  relatedEntityId?: string;
  relatedPropertyId?: number;
  priority: string;
  state: ConfirmState;
  userAnswer?: string;
  answeredAt?: number;
  snoozeUntil?: number;
  snoozeCount: number;
  expiresAt?: number;
  createdAt: number;
}

export interface NotificationRecord {
  id: string;
  channel: string;
  type?: string;
  title: string;
  body?: string;
  payload?: Record<string, any>;
  topicId?: string;
  relatedEntityId?: string;
  utilityScore?: number;
  sentAt?: number;
  clickedAt?: number;
  dismissedAt?: number;
  actionTaken?: string;
  createdAt: number;
}

export interface NotificationCenterEnvelope {
  sourceRef: string;
  sourceType: 'notification' | 'proposed_action';
  sourceId: string;
  lane: 'todo' | 'notice';
  priority: 'high' | 'normal';
  title: string;
  body?: string;
  dueAt?: number;
  createdAt: number;
  sentAt?: number;
  type?: string;
  payload?: Record<string, unknown>;
}

// ============ Dual Persona Types ============

export interface ProfileItem {
  id: string;
  itemType: ProfileItemType;
  itemKey: string;
  itemValue: string;
  evidenceRefs?: Array<{ messageId: string; snippet?: string; ts: number }>;
  sourceKind: ProfileSourceKind;
  confidence: number;
  userConfirmed: boolean;
  status: ProfileItemStatus;
  salienceScore: number;
  mentionCount: number;
  lastSeen: number;
  validFrom?: number;
  validTo?: number;
  createdAt: number;
  updatedAt: number;
  fingerprint: string;
}

export interface ProfileSyncState {
  profileDirty: boolean;
  lastSnapshotAt: number;
  lastFullRebuildAt: number;
}

export interface SocialEdge {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationType: SocialRelationType;
  strength: number;
  evidenceRefs?: Array<{ messageId: string; snippet?: string; ts: number }>;
  confidence: number;
  userConfirmed: boolean;
  validFrom?: number;
  validTo?: number;
  createdAt: number;
  updatedAt: number;
}

export interface OpinionItem {
  id: string;
  targetEntityId: string;
  dimension: OpinionDimension;
  valence: number;
  intensity: number;
  rationale?: string;
  evidenceRefs?: Array<{ messageId: string; snippet?: string; ts: number }>;
  confidence: number;
  userConfirmed: boolean;
  status: OpinionStatus;
  validFrom?: number;
  validTo?: number;
  createdAt: number;
  updatedAt: number;
}

export interface AgentProfileVersion {
  id: string;
  kind: AgentProfileKind;
  contentMd: string;
  author: string;
  rationale?: string;
  isActive: boolean;
  createdAt: number;
}

// Profile candidate extracted by LLM during ingestion
export interface ProfileCandidate {
  itemType: ProfileItemType;
  itemKey: string;
  itemValue: string;
  confidence?: number;
  sourceKind?: ProfileSourceKind;
}

// ============ API Types ============

export interface IngestPayload {
  content: string;
  sourceType: SourceType;
  sender?: string;
  groupId?: string;
  groupName?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
  /** When true, skip LLM extraction / salience scoring. Used for migration. */
  skipExtraction?: boolean;
}

export interface IngestResult {
  id: string;
  status: 'created' | 'duplicate' | 'error';
  entitiesExtracted?: number;
  matchedProjects?: string[];
}

export interface RecallQuery {
  query: string;
  topK?: number;           // default 10
  channels?: ('vector' | 'fts' | 'graph' | 'time')[];  // default all
  timeRange?: { start?: number; end?: number };
  entityTypes?: EntityType[];
  projectFilter?: string;
  minSalience?: number;
  includeMetadata?: boolean;
  senderFilter?: string[];
  groupFilter?: string[];
  minImportance?: number;
  sourceTypes?: RecallSourceType[];
}

export interface RecallResult {
  items: RecallItem[];
  totalFound: number;
  queryTimeMs: number;
  channels: string[];
}

export interface RecallItem {
  id: string;
  type: 'message' | 'chunk' | 'entity';
  content: string;
  score: number;
  source?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
  entity?: Entity;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  uptime: number;
  database: {
    connected: boolean;
    messageCount: number;
    entityCount: number;
    chunkCount: number;
  };
  embedding: {
    loaded: boolean;
    model: string;
  };
}

// ============ Multi-User / Fastify Extensions ============

import 'fastify';
import type { UserContext, UserContextManager } from '../core/UserContextManager.js';

declare module 'fastify' {
  interface FastifyInstance {
    userContextManager: UserContextManager;
  }

  interface FastifyRequest {
    userId: string;
    userContext: UserContext;
  }
}
