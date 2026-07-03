export type ComposerSurface =
  | 'ringcentral_message'
  | 'ringcentral_thread'
  | 'jira_issue'
  | 'chatgpt'
  | 'doubao'
  | 'claude'
  | 'gemini'
  | 'codex_cli'
  | 'claude_code_cli'
  | 'cursor_agent_cli'
  | 'generic_agent';

export type ComposerContextType =
  | 'message_thread'
  | 'jira_issue'
  | 'web_agent_prompt';

export type ComposerScenario =
  | 'instant_message_reply'
  | 'thread_reply'
  | 'jira_comment'
  | 'web_agent_prompt'
  | 'compose_to_ai'
  | 'agent_compose'
  | 'document_note';

export type ComposerContextItemType =
  | 'message'
  | 'thread_root'
  | 'thread_reply'
  | 'jira_summary'
  | 'jira_description'
  | 'jira_comment'
  | 'attachment'
  | 'image';

export type ComposerTargetKind =
  | 'textarea'
  | 'input'
  | 'contenteditable'
  | 'richiframe';

export interface VisibleMessageSnapshot {
  id?: string;
  sender?: string;
  text: string;
  timestampLabel?: string;
}

export interface VisibleFieldSnapshot {
  name: string;
  value: string;
  rawText?: string;
}

export type InteractionSceneUserMode =
  | 'read'
  | 'inspect_field'
  | 'focus_composer'
  | 'compose'
  | 'reply'
  | 'comment'
  | 'select_text'
  | 'submit_candidate'
  | 'unknown';

export type InteractionSceneType =
  | 'jira_issue_reading'
  | 'jira_field_inspection'
  | 'jira_comment_composing'
  | 'ringcentral_thread_reading'
  | 'ringcentral_estimate_discussion'
  | 'ringcentral_reply_composing'
  | 'web_reading'
  | 'web_ai_prompt_composing'
  | 'selection_memory_search'
  | 'meeting_live'
  | 'unknown';

export type InteractionSceneSurface =
  | 'memory_lens'
  | 'compose_assist'
  | 'meeting_pilot'
  | 'today_pilot'
  | 'ask';

export interface ActiveElementSnapshot {
  kind:
    | 'none'
    | 'button'
    | 'input'
    | 'textarea'
    | 'contenteditable'
    | 'editor'
    | 'link'
    | 'other';
  role?: string;
  mode?: InteractionSceneUserMode;
  label?: string;
  placeholder?: string;
  nearbyText?: string;
  containerRole?: string;
  containerLabel?: string;
  selectorFingerprint?: string;
  hasFocus: boolean;
}

export interface VisibleFactSnapshot {
  kind:
    | 'jira_field'
    | 'message'
    | 'page_heading'
    | 'status_badge'
    | 'table_cell'
    | 'other';
  name?: string;
  value: string;
  rawText?: string;
  source: 'current_page';
  issueKey?: string;
  confidence: number;
}

export interface InteractionSceneAdmissionSnapshot {
  state: 'blocked' | 'passive_ready' | 'composer_ready' | 'unknown';
  reasons?: string[];
  confidence?: number;
}

export interface InteractionSceneSnapshot {
  sceneType: InteractionSceneType;
  surface: InteractionSceneSurface;
  userMode: InteractionSceneUserMode;
  url?: string;
  title?: string;
  issueKey?: string;
  conversationId?: string;
  groupId?: string;
  meetingId?: string;
  participants?: string[];
  activeElement?: ActiveElementSnapshot;
  visibleFacts?: VisibleFactSnapshot[];
  draftText?: string;
  selectedText?: string;
  nearbyMessages?: VisibleMessageSnapshot[];
  sourceAnchorHints?: string[];
  admission?: InteractionSceneAdmissionSnapshot;
}

export interface ComposerAudience {
  conversationTitle?: string;
  conversationId?: string;
  groupId?: string;
  issueKey?: string;
  issueSummary?: string;
  people?: string[];
  provider?: string;
  relationshipHint?: string;
}

export interface ComposerContextItem {
  type: ComposerContextItemType;
  id?: string;
  sender?: string;
  title?: string;
  text?: string;
  timestampLabel?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface ContextCue {
  id: string;
  cueKey?: string;
  cueText: string;
  actionType: 'remember' | 'ask' | 'draft_hint' | 'warning' | 'open_source';
  surfaceEligibility: Array<
    'memory_lens' | 'compose_assist' | 'ask' | 'meeting_pilot'
  >;
  sourceRefs?: Array<{
    type: string;
    id: string;
    title?: string;
    url?: string;
    timestamp?: number;
  }>;
  evidenceMatchIds?: string[];
  whyNow?: string;
  confidence?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  compileStatus: 'compiled' | 'suppressed' | 'needs_more_evidence';
  suppressReason?: string;
  outcomePolicy?: {
    action: 'boost' | 'suppress' | 'send_to_skill_foundry';
    patchId: string;
    strength: number;
    reasonCodes: string[];
    positiveCount: number;
    negativeCount: number;
    signalCount: number;
    expiresAt?: number;
  };
}

export interface ComposerTarget {
  element: HTMLElement;
  kind: ComposerTargetKind;
  placeholder?: string;
  mode?: 'main' | 'thread' | 'comment' | 'prompt';
}

export interface SiteContextSnapshot {
  adapterId: string;
  surface: ComposerSurface;
  contextType: ComposerContextType;
  scenario?: ComposerScenario;
  contextKey: string;
  title: string;
  url: string;
  primaryText: string;
  secondaryTexts?: string[];
  keywords?: string[];
  provider?: ComposerSurface;
  identifiers?: {
    conversationId?: string;
    groupId?: string;
    threadRootPostId?: string;
    issueKey?: string;
    provider?: string;
  };
  visibleMessages?: VisibleMessageSnapshot[];
  visibleFields?: VisibleFieldSnapshot[];
  threadRoot?: VisibleMessageSnapshot;
  audience?: ComposerAudience;
  contextItems?: ComposerContextItem[];
  sourceTypes?: string[];
  interactionScene?: InteractionSceneSnapshot;
}

export interface SiteContextAdapter {
  id: string;
  match(location: Location, doc: Document): boolean;
  buildSnapshot(
    doc: Document,
    location: Location,
    target?: ComposerTarget,
  ): SiteContextSnapshot | null;
  findComposer(
    doc: Document,
    fromElement?: Element | null,
  ): ComposerTarget | null;
}

export interface ComposerAssistEvidence {
  id: string;
  type: 'message' | 'chunk' | 'entity' | 'rehearsal' | 'source_memory';
  title?: string;
  snippet: string;
  sourceLabel?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  exploreLink?: string;
  links?: Array<{ label: string; url: string }>;
  whyMatched?: string;
  whyRelevant?: string[];
  matchedAnchors?: {
    people?: string[];
    topics?: string[];
    projects?: string[];
    source?: string[];
  };
  reasonType?: string;
  evidenceRole?: string;
  displayPriority?: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
  score?: number;
  cue?: ContextCue;
}

export interface ComposerAssistRequest {
  surface: ComposerSurface;
  contextType: ComposerContextType;
  scenario?: ComposerScenario;
  title?: string;
  url?: string;
  draftText?: string;
  primaryText?: string;
  secondaryTexts?: string[];
  keywords?: string[];
  identifiers?: SiteContextSnapshot['identifiers'];
  visibleMessages?: VisibleMessageSnapshot[];
  visibleFields?: VisibleFieldSnapshot[];
  threadRoot?: VisibleMessageSnapshot;
  audience?: ComposerAudience;
  contextItems?: ComposerContextItem[];
  sourceTypes?: string[];
  interactionScene?: InteractionSceneSnapshot;
  automationLevel?: 'L1' | 'L2';
  debug?: boolean;
}

export interface ComposerAssistResponse {
  available: boolean;
  suggestionType:
    | 'none'
    | 'context_pack'
    | 'prompt_patch'
    | 'reply_context'
    | 'issue_context';
  title?: string;
  summary?: string;
  insertText?: string;
  evidence: ComposerAssistEvidence[];
  riskLevel: 'low' | 'medium' | 'high';
  previewRequired: boolean;
  confidence: number;
  queryTimeMs: number;
  debug?: Record<string, unknown>;
}
