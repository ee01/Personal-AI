import { ref, computed } from 'vue';
import type { ActivityEntry, TeamSnapshot, TeamSummary } from '../types';
import type { ActorSource } from '../types';

const CLIENT_ID_KEY = 'roadmap-client-id';
const ACTOR_NAME_KEY = 'roadmap-actor-name';
const AI_PROMPT_KEY = 'personalroadmap.aiPrompt';
const AI_PROMPT_DRAFT_PREFIX = 'personalroadmap.aiPrompt:';

function editTokenKey(teamId: string) {
  return `roadmap-edit-token:${teamId}`;
}

function aiPromptDraftKey(teamId: string) {
  return `${AI_PROMPT_DRAFT_PREFIX}${teamId}`;
}

function randomId() {
  return `c_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function getClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function getActorName(): string {
  return localStorage.getItem(ACTOR_NAME_KEY)?.trim() || '';
}

export function setActorName(name: string) {
  localStorage.setItem(ACTOR_NAME_KEY, name.trim());
}

export function getShareToken(teamId: string): string {
  return localStorage.getItem(editTokenKey(teamId)) || '';
}

export function setShareToken(teamId: string, token: string) {
  if (token) localStorage.setItem(editTokenKey(teamId), token);
  else localStorage.removeItem(editTokenKey(teamId));
}

/** Per-team draft; `null` means this browser has never edited the prompt for the team. */
export function getAiPromptDraft(teamId: string): string | null {
  if (!teamId) return null;
  const key = aiPromptDraftKey(teamId);
  if (localStorage.getItem(key) !== null) return localStorage.getItem(key);
  // Legacy global key — migrate once so closing the modal still restores text.
  const legacy = localStorage.getItem(AI_PROMPT_KEY);
  if (legacy !== null) {
    localStorage.setItem(key, legacy);
    return legacy;
  }
  return null;
}

export function setAiPromptDraft(teamId: string, prompt: string) {
  if (!teamId) return;
  localStorage.setItem(aiPromptDraftKey(teamId), prompt);
}

/** @deprecated Prefer getAiPromptDraft(teamId). Kept for older call sites. */
export function getAiPrompt(): string {
  return localStorage.getItem(AI_PROMPT_KEY) || '';
}

/** @deprecated Prefer setAiPromptDraft(teamId, prompt). */
export function setAiPrompt(prompt: string) {
  localStorage.setItem(AI_PROMPT_KEY, prompt);
}

export function useRoadmapApi() {
  const clientId = ref(getClientId());
  const actorName = ref(getActorName());
  const actorSource = ref<ActorSource>('anonymous');
  const extensionConnected = ref(Boolean(window.__PAI_ROADMAP_BRIDGE__));
  const sseRef = ref<EventSource | null>(null);

  const actorPayload = computed(() => ({
    actorName: actorName.value || 'Guest',
    clientId: clientId.value,
    actorSource: actorSource.value,
  }));

  async function apiFetch<T>(
    path: string,
    init: RequestInit & { teamId?: string; withToken?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Client-Id': clientId.value,
      'X-Actor-Name': actorName.value || 'Guest',
      'X-Actor-Source': actorSource.value,
      ...(init.headers as Record<string, string> | undefined),
    };
    if (init.teamId && init.withToken !== false) {
      const token = getShareToken(init.teamId);
      if (token) headers['X-Share-Token'] = token;
    }
    const res = await fetch(path, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw Object.assign(new Error(err.error || 'request_failed'), {
        status: res.status,
        body: err,
      });
    }
    return res.json() as Promise<T>;
  }

  async function listTeams() {
    const data = await apiFetch<{ items: TeamSummary[] }>('/api/v1/teams');
    return data.items;
  }

  async function createTeam(input: {
    name: string;
    jql: string;
    checkedQuarters?: string[];
  }) {
    const body = {
      ...input,
      ...actorPayload.value,
      actorSource: 'creator' as ActorSource,
    };
    const data = await apiFetch<{
      snapshot: TeamSnapshot;
      editToken: string;
    }>('/api/v1/teams', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setShareToken(data.snapshot.team.id, data.editToken);
    actorSource.value = 'creator';
    return data;
  }

  async function fetchTeam(teamId: string) {
    const data = await apiFetch<{ snapshot: TeamSnapshot }>(
      `/api/v1/teams/${teamId}`,
      { teamId, method: 'GET' },
    );
    return data.snapshot;
  }

  async function shareTeam(teamId: string) {
    const data = await apiFetch<{ token: string }>(
      `/api/v1/teams/${teamId}/share`,
      {
        teamId,
        method: 'POST',
        body: JSON.stringify({
          ...actorPayload.value,
          shareToken: getShareToken(teamId) || undefined,
        }),
      },
    );
    setShareToken(teamId, data.token);
    return data.token;
  }

  async function sendIntent(
    teamId: string,
    intent: Record<string, unknown>,
  ) {
    const data = await apiFetch<{ ok: true; snapshot: TeamSnapshot }>(
      `/api/v1/teams/${teamId}/intents`,
      {
        teamId,
        method: 'POST',
        body: JSON.stringify({
          ...intent,
          ...actorPayload.value,
          shareToken: getShareToken(teamId),
        }),
      },
    );
    return data.snapshot;
  }

  async function importTasks(
    teamId: string,
    tasks?: Array<{
      key: string;
      summary: string;
      epicKey: string;
      targetStart?: string | null;
      targetEnd?: string | null;
      assignee?: string | null;
    }>,
  ) {
    return apiFetch<{
      added: number;
      skipped: number;
      byEpic: Record<string, { added: number; skipped: number }>;
      snapshot: TeamSnapshot;
    }>(`/api/v1/teams/${teamId}/import-tasks`, {
      teamId,
      method: 'POST',
      body: JSON.stringify({
        ...actorPayload.value,
        shareToken: getShareToken(teamId),
        ...(tasks ? { tasks } : {}),
      }),
    });
  }

  async function syncTarget(
    teamId: string,
    input:
      | { itemKey: string; mode?: 'queue' }
      | {
          itemKey: string;
          mode: 'confirm';
          start: string;
          end: string;
          jiraKey?: string;
        },
  ) {
    return apiFetch<{
      ok: true;
      queued?: boolean;
      skipped?: string;
      via?: string;
      snapshot?: TeamSnapshot;
    }>(`/api/v1/teams/${teamId}/sync-target`, {
      teamId,
      method: 'POST',
      body: JSON.stringify({
        ...actorPayload.value,
        shareToken: getShareToken(teamId),
        ...input,
      }),
    });
  }

  async function fetchActivity(teamId: string, limit = 100) {
    const data = await apiFetch<{ items: ActivityEntry[] }>(
      `/api/v1/teams/${teamId}/activity?limit=${limit}`,
      { teamId, method: 'GET', withToken: false },
    );
    return data.items;
  }

  function subscribeEvents(
    teamId: string,
    handlers: {
      onSnapshot?: (snapshot: TeamSnapshot) => void;
      onActivity?: (entry: ActivityEntry) => void;
      onPresence?: (data: unknown) => void;
    },
  ) {
    unsubscribeEvents();
    const url = `/api/v1/teams/${teamId}/events?clientId=${encodeURIComponent(clientId.value)}`;
    const es = new EventSource(url);
    sseRef.value = es;
    es.addEventListener('snapshot', (ev) => {
      try {
        handlers.onSnapshot?.(JSON.parse((ev as MessageEvent).data));
      } catch {
        /* ignore */
      }
    });
    es.addEventListener('activity', (ev) => {
      try {
        handlers.onActivity?.(JSON.parse((ev as MessageEvent).data));
      } catch {
        /* ignore */
      }
    });
    es.addEventListener('presence', (ev) => {
      try {
        handlers.onPresence?.(JSON.parse((ev as MessageEvent).data));
      } catch {
        /* ignore */
      }
    });
    return es;
  }

  function unsubscribeEvents() {
    sseRef.value?.close();
    sseRef.value = null;
  }

  function markExtensionConnected() {
    extensionConnected.value = true;
    actorSource.value = 'extension';
  }

  function hasExtension() {
    return extensionConnected.value || Boolean(window.__PAI_ROADMAP_BRIDGE__);
  }

  return {
    clientId,
    actorName,
    actorSource,
    extensionConnected,
    actorPayload,
    listTeams,
    createTeam,
    fetchTeam,
    shareTeam,
    sendIntent,
    importTasks,
    syncTarget,
    fetchActivity,
    subscribeEvents,
    unsubscribeEvents,
    markExtensionConnected,
    hasExtension,
    getShareToken,
    setShareToken,
    setActorName: (name: string) => {
      setActorName(name);
      actorName.value = name;
    },
  };
}

export type RoadmapApi = ReturnType<typeof useRoadmapApi>;
