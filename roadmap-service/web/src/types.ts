export type ActorSource = 'creator' | 'extension' | 'anonymous';
export type ViewMode = 'gantt' | 'resource';
export type ResWindow = '2w' | 'all';

export interface TeamSummary {
  id: string;
  name: string;
  jql: string;
  checkedQuarters: string[];
  importedQuarters: string[];
  version: number;
}

/** Where an item came from: a Jira import, or created by hand in the Backlog. */
export type ItemSource = 'jira' | 'manual';

/**
 * Hierarchy hints the server derives from the team JQL.
 * `confident` only reflects `itemType`; `projectKey` can be null regardless.
 */
export interface JqlHints {
  projectKey: string | null;
  itemType: string | null;
  subType: string | null;
  linkField: string | null;
  confident: boolean;
}

export interface RoadmapSub {
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
}

export interface RoadmapItem {
  key: string;
  type: string;
  title: string;
  source: ItemSource;
  /** Real Jira key. Null only while no Jira issue exists for this item yet. */
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
  subs: RoadmapSub[];
}

export interface TeamMember {
  id: string;
  name: string;
  avatarColor: string;
}

export interface PresenceEntry {
  clientId: string;
  name: string;
  source: ActorSource;
  lastSeen: number;
}

export interface LockEntry {
  targetType: string;
  targetKey: string;
  actorName: string;
  actorClientId: string;
  expiresAt: number;
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
  items: RoadmapItem[];
  members: TeamMember[];
  presence: PresenceEntry[];
  locks: LockEntry[];
}

export interface ActivityEntry {
  id: string;
  teamId: string;
  at: number;
  actorName: string;
  actorClientId: string;
  actorSource: ActorSource;
  op: string;
  targetType: string;
  targetKey: string | null;
  summary: Record<string, unknown>;
  text: string;
}
