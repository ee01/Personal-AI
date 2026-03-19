export const TIMELINE_PROJECTS = [
  {
    value: 'mThor',
    label: '🚀 mThor',
    paramKey: 'mThor',
    variableName: 'mThorReleaseInfo',
  },
  {
    value: 'Jupiter desktop',
    label: '🖥️ Jupiter Desktop',
    paramKey: 'jupiterDesktop',
    variableName: 'jupiterDesktopReleaseInfo',
  },
  {
    value: 'Jupiter web',
    label: '🌐 Jupiter Web',
    paramKey: 'jupiterWeb',
    variableName: 'jupiterWebReleaseInfo',
  },
  {
    value: 'Nova',
    label: '✨ Nova',
    paramKey: 'nova',
    variableName: 'novaReleaseInfo',
  },
  {
    value: 'RIO',
    label: '🧭 RIO',
    paramKey: 'rio',
    variableName: 'rioReleaseInfo',
  },
  {
    value: 'NC',
    label: '📦 NC',
    paramKey: 'nc',
    variableName: 'ncReleaseInfo',
  },
  {
    value: 'Rooms',
    label: '🏢 Rooms',
    paramKey: 'rooms',
    variableName: 'roomsReleaseInfo',
  },
] as const;

export type TimelineProject = typeof TIMELINE_PROJECTS[number]['value'];

export interface TimelineProjectOption {
  value: TimelineProject;
  label: string;
}

export const DEFAULT_TIMELINE_PROJECT: TimelineProject = TIMELINE_PROJECTS[0].value;

export const TIMELINE_PROJECT_OPTIONS: TimelineProjectOption[] = TIMELINE_PROJECTS.map(project => ({
  value: project.value,
  label: project.label,
}));

export function getTimelineProjectOption(project?: string): TimelineProjectOption {
  const matchedProject = TIMELINE_PROJECTS.find(item => item.value === project) || TIMELINE_PROJECTS[0];
  return {
    value: matchedProject.value,
    label: matchedProject.label,
  };
}

function buildReleaseInfoWebhookAction(project: typeof TIMELINE_PROJECTS[number]) {
  return {
    component: 'ACTION',
    schemaVersion: 2,
    type: 'jira.issue.outgoing.webhook',
    value: {
      url: `https://heimdall-xmn02.int.rclabenv.com/api/bot/get_release_info/?project=${encodeURIComponent(project.value)}`,
      headers: [
        {
          id: `_header_${project.paramKey}`,
          name: '',
          value: {
            keyOrValue: '',
            secret: false,
          },
        },
      ],
      sendIssue: false,
      contentType: 'empty',
      method: 'GET',
      responseEnabled: true,
      usedSecretsKeys: [],
    },
    children: [],
    conditions: [],
    optimisedIds: [],
    newComponent: false,
  };
}

function buildReleaseInfoVariableAction(project: typeof TIMELINE_PROJECTS[number]) {
  return {
    component: 'ACTION',
    schemaVersion: 1,
    type: 'jira.create.variable',
    value: {
      id: `_customsmartvalue_id_${project.paramKey}`,
      name: {
        type: 'FREE',
        value: project.variableName,
      },
      type: 'SMART',
      query: {
        type: 'SMART',
        value: '{{webhookResponse.body}}',
      },
      lazy: false,
    },
    children: [],
    conditions: [],
    optimisedIds: [],
    newComponent: false,
  };
}

function buildCacheReleaseInfoWebhookAction(project: typeof TIMELINE_PROJECTS[number]) {
  return {
    component: 'ACTION',
    schemaVersion: 2,
    type: 'jira.issue.outgoing.webhook',
    value: {
      url: `{{WEB_APP_URL}}?action=cacheReleaseInfo&project=${project.paramKey}&releaseInfo={{${project.variableName}.urlEncode}}`,
      headers: [],
      sendIssue: false,
      contentType: 'empty',
      method: 'GET',
      responseEnabled: false,
      usedSecretsKeys: [],
    },
    children: [],
    conditions: [],
    optimisedIds: [],
    newComponent: false,
  };
}

export function buildTimelineSyncComponents(): any[] {
  return TIMELINE_PROJECTS.flatMap(project => [
    buildReleaseInfoWebhookAction(project),
    buildReleaseInfoVariableAction(project),
    buildCacheReleaseInfoWebhookAction(project),
  ]);
}

export function buildTimelineSyncComponentsFragment(): string {
  return buildTimelineSyncComponents()
    .map(component => JSON.stringify(component))
    .join(',');
}
