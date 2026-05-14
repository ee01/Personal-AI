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

export interface TimelineSyncPayloadHelp {
  project: TimelineProject;
  label: string;
  paramKey: string;
  variableName: string;
  method: 'POST';
  url: string;
  contentType: 'application/json';
  customBody: string;
}

export interface TimelineSyncDryRunHelp {
  project: TimelineProject;
  label: string;
  method: 'POST';
  url: string;
  contentType: 'application/json';
  customBody: string;
  curlCommand: string;
}

export const DEFAULT_TIMELINE_PROJECT: TimelineProject = TIMELINE_PROJECTS[0].value;

export const TIMELINE_PROJECT_OPTIONS: TimelineProjectOption[] = TIMELINE_PROJECTS.map(project => ({
  value: project.value,
  label: project.label,
}));

export function buildJiraUrlEncodedSmartValue(expression: string): string {
  return `{{${expression}.urlEncode.replaceAll("\\+","%20")}}`;
}

export function buildJiraJsonStringSmartValue(expression: string): string {
  return `{{${expression}.asJsonString}}`;
}

function findTimelineProject(project?: string) {
  return TIMELINE_PROJECTS.find(item => item.value === project || item.paramKey === project);
}

function buildTimelineSyncCustomBody(project: typeof TIMELINE_PROJECTS[number]): string {
  return `{\n  "project": "${project.paramKey}",\n  "releaseInfo": ${buildJiraJsonStringSmartValue(project.variableName)}\n}`;
}

function buildTimelineSyncDryRunCustomBody(project: typeof TIMELINE_PROJECTS[number]): string {
  return JSON.stringify({
    project: project.paramKey,
    dryRun: true,
    releaseInfo: {
      currentRelease: 'diagnostic',
      currentPhase: 'diagnostic',
      releaseInfo: {
        FF: '12/31/2026',
      },
    },
  }, null, 2);
}

function appendQueryParameter(url: string, key: string, value: string): string {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return '';
  }

  const separator = trimmedUrl.includes('?') ? '&' : '?';
  return `${trimmedUrl}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function quoteShellSingle(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildDryRunCurlCommand(input: {
  url: string;
  contentType: string;
  customBody: string;
}): string {
  return [
    'curl -sS -X POST',
    `  -H ${quoteShellSingle(`Content-Type: ${input.contentType}`)}`,
    `  --data ${quoteShellSingle(input.customBody)}`,
    `  ${quoteShellSingle(input.url)}`,
  ].join(' \\\n');
}

export function getTimelineSyncPayloadHelp(project?: string): TimelineSyncPayloadHelp | null {
  const matchedProject = findTimelineProject(project);
  if (!matchedProject) {
    return null;
  }

  return {
    project: matchedProject.value,
    label: matchedProject.label,
    paramKey: matchedProject.paramKey,
    variableName: matchedProject.variableName,
    method: 'POST',
    url: '{{WEB_APP_URL}}?action=cacheReleaseInfo',
    contentType: 'application/json',
    customBody: buildTimelineSyncCustomBody(matchedProject),
  };
}

export function getTimelineSyncDryRunHelp(input: {
  project?: string;
  webAppUrl?: string;
}): TimelineSyncDryRunHelp | null {
  const matchedProject = findTimelineProject(input.project);
  const webAppUrl = input.webAppUrl?.trim();
  if (!matchedProject || !webAppUrl) {
    return null;
  }

  const url = appendQueryParameter(webAppUrl, 'action', 'cacheReleaseInfo');
  const customBody = buildTimelineSyncDryRunCustomBody(matchedProject);
  const contentType = 'application/json';

  return {
    project: matchedProject.value,
    label: matchedProject.label,
    method: 'POST',
    url,
    contentType,
    customBody,
    curlCommand: buildDryRunCurlCommand({
      url,
      contentType,
      customBody,
    }),
  };
}

export function getTimelineProjectOption(project?: string): TimelineProjectOption {
  const matchedProject = findTimelineProject(project) || TIMELINE_PROJECTS[0];
  return {
    value: matchedProject.value,
    label: matchedProject.label,
  };
}

export function resolveTimelineProjectForSave(input: {
  isTimelineTrigger: boolean;
  pushMethod?: string;
  hasProjectVariables: boolean;
  timelineProject?: string;
}): TimelineProject | undefined {
  const matchedProject = TIMELINE_PROJECTS.find(item => item.value === input.timelineProject);

  if (input.isTimelineTrigger) {
    return matchedProject?.value;
  }

  if (input.pushMethod === 'AsMe' || !input.hasProjectVariables) {
    return undefined;
  }

  return matchedProject?.value || DEFAULT_TIMELINE_PROJECT;
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
      url: '{{WEB_APP_URL}}?action=cacheReleaseInfo',
      headers: [
        {
          id: `_header_${project.paramKey}_content_type`,
          name: 'Content-Type',
          value: {
            keyOrValue: 'application/json',
            secret: false,
          },
        },
      ],
      sendIssue: false,
      contentType: 'custom',
      customBody: buildTimelineSyncCustomBody(project),
      method: 'POST',
      responseEnabled: true,
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
