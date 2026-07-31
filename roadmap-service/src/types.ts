export type ActorSource = 'creator' | 'extension' | 'anonymous';

export type IntentOp =
  | 'create_team'
  | 'update_jql'
  | 'import'
  | 'schedule'
  | 'unschedule'
  | 'move'
  | 'resize'
  | 'set_alias'
  | 'expand'
  | 'collapse'
  | 'add_item'
  | 'delete_item'
  | 'resolve_item'
  | 'add_sub'
  | 'update_sub'
  | 'delete_sub'
  | 'resolve_draft'
  | 'cleanup'
  | 'add_member'
  | 'update_member'
  | 'remove_member'
  | 'lock'
  | 'unlock'
  | 'set_quarters';

export interface TeamRow {
  id: string;
  name: string;
  jql: string;
  checked_quarters_json: string;
  imported_quarters_json: string;
  version: number;
  created_by: string;
  created_at: number;
  updated_at: number;
}

/** Where an item came from: a Jira import, or created by hand in the Backlog. */
export type ItemSource = 'jira' | 'manual';

/**
 * Hierarchy hints derived from the team JQL (see `core/JqlIntrospect.ts`).
 * `confident: false` means we fell back to a guess and the UI must ask the user.
 */
export interface JqlHints {
  projectKey: string | null;
  itemType: string | null;
  subType: string | null;
  /** 'customfield_15751' (Parent Link) | 'customfield_11450' (Epic Link) | 'parent' */
  linkField: string | null;
  confident: boolean;
}

export interface ItemRow {
  id: string;
  team_id: string;
  key: string;
  type: string;
  title: string;
  alias: string | null;
  quarter: string | null;
  estimate: number | null;
  target_start: string | null;
  target_end: string | null;
  scheduled: number;
  start_date: string | null;
  days: number | null;
  lane: number;
  expanded: number;
  source: ItemSource;
  jira_key: string | null;
  project_key: string | null;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface SubRow {
  id: string;
  team_id: string;
  item_key: string;
  jira_key: string | null;
  title: string;
  alias: string | null;
  owner: string | null;
  start_date: string | null;
  days: number | null;
  is_draft: number;
  created_by: string;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface MemberRow {
  id: string;
  team_id: string;
  name: string;
  avatar_color: string;
  created_at: number;
}

export interface ActivityRow {
  id: string;
  team_id: string;
  at: number;
  actor_name: string;
  actor_client_id: string;
  actor_source: ActorSource;
  op: string;
  target_type: string;
  target_key: string | null;
  summary_json: string;
  share_token_id: string | null;
  ip: string | null;
}

export interface ActorContext {
  name: string;
  clientId: string;
  source: ActorSource;
  shareTokenId?: string | null;
  ip?: string | null;
}

export interface TeamSnapshot {
  team: {
    id: string;
    name: string;
    jql: string;
    checkedQuarters: string[];
    importedQuarters: string[];
    version: number;
    createdBy: string;
    jqlHints: JqlHints;
  };
  items: Array<{
    key: string;
    type: string;
    title: string;
    source: ItemSource;
    /** Real Jira key. Null only for manual items that have no Jira issue yet. */
    jiraKey: string | null;
    projectKey: string | null;
    alias?: string | null;
    quarter?: string | null;
    estimate?: number | null;
    targetStart?: string | null;
    targetEnd?: string | null;
    scheduled: boolean;
    start?: string | null;
    days?: number | null;
    lane: number;
    expanded: boolean;
    version: number;
    subs: Array<{
      id: string;
      key?: string | null;
      title: string;
      alias?: string | null;
      owner?: string | null;
      start?: string | null;
      days?: number | null;
      temp: boolean;
      createdBy: string;
      version: number;
    }>;
  }>;
  members: Array<{ id: string; name: string; avatarColor: string }>;
  presence: Array<{
    clientId: string;
    name: string;
    source: ActorSource;
    lastSeen: number;
  }>;
  locks: Array<{
    targetType: string;
    targetKey: string;
    actorName: string;
    actorClientId: string;
    expiresAt: number;
  }>;
}
