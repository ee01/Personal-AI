export type ComposerSurface =
  | 'ringcentral_message'
  | 'ringcentral_thread'
  | 'jira_issue'
  | 'chatgpt'
  | 'doubao'
  | 'claude'
  | 'gemini'
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

export type ComposerTargetKind = 'textarea' | 'input' | 'contenteditable';

export interface VisibleMessageSnapshot {
  id?: string;
  sender?: string;
  text: string;
  timestampLabel?: string;
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
  threadRoot?: VisibleMessageSnapshot;
  audience?: ComposerAudience;
  contextItems?: ComposerContextItem[];
  sourceTypes?: string[];
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
  type: 'message' | 'chunk' | 'entity';
  title?: string;
  snippet: string;
  sourceLabel?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  exploreLink?: string;
  whyMatched?: string;
  timestamp?: number;
  score?: number;
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
  threadRoot?: VisibleMessageSnapshot;
  audience?: ComposerAudience;
  contextItems?: ComposerContextItem[];
  sourceTypes?: string[];
  automationLevel?: 'L1' | 'L2';
  debug?: boolean;
}

export interface ComposerAssistResponse {
  available: boolean;
  suggestionType: 'none' | 'context_pack' | 'reply_context' | 'issue_context';
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
