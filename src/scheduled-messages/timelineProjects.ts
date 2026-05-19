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
  method: 'GET' | 'POST';
  url: string;
  contentType: 'empty' | 'application/json';
  customBody: string;
}

export interface TimelineSyncDryRunHelp {
  project: TimelineProject;
  label: string;
  sampleMilestone: string;
  method: 'GET' | 'POST';
  url: string;
  contentType: 'empty' | 'application/json';
  customBody: string;
  curlCommand: string;
}

export const DEFAULT_TIMELINE_PROJECT: TimelineProject = TIMELINE_PROJECTS[0].value;
const DEFAULT_TIMELINE_DRY_RUN_MILESTONE = 'FF';

export const TIMELINE_PROJECT_OPTIONS: TimelineProjectOption[] = TIMELINE_PROJECTS.map(project => ({
  value: project.value,
  label: project.label,
}));

export function buildJiraUrlEncodedSmartValue(expression: string): string {
  return `{{${expression}.urlEncode.replaceAll("\\+","%20")}}`;
}

export function buildJiraTimelineReleaseInfoSmartValue(expression: string): string {
  return `{{${expression}.replaceAll("'","").urlEncode.replaceAll("\\+","%20")}}`;
}

function findTimelineProject(project?: string) {
  return TIMELINE_PROJECTS.find(item => item.value === project || item.paramKey === project);
}

function buildTimelineSyncGetUrl(project: typeof TIMELINE_PROJECTS[number], baseUrl = '{{WEB_APP_URL}}'): string {
  const query = [
    'action=cacheReleaseInfo',
    `project=${encodeURIComponent(project.paramKey)}`,
    `releaseInfo=${buildJiraTimelineReleaseInfoSmartValue(project.variableName)}`,
  ].join('&');

  return appendRawQueryString(baseUrl, query);
}

function normalizeTimelineDryRunMilestone(milestone?: string): string {
  const normalized = milestone?.replace(/\s+/g, ' ').trim();
  return normalized || DEFAULT_TIMELINE_DRY_RUN_MILESTONE;
}

function buildTimelineSyncDryRunCustomBody(
  project: typeof TIMELINE_PROJECTS[number],
  milestone?: string,
): { customBody: string; sampleMilestone: string } {
  const sampleMilestone = normalizeTimelineDryRunMilestone(milestone);
  return {
    sampleMilestone,
    customBody: JSON.stringify({
      project: project.paramKey,
      dryRun: true,
      releaseInfo: {
        currentRelease: 'diagnostic',
        currentPhase: 'diagnostic',
        releaseInfo: {
          [sampleMilestone]: '12/31/2026',
        },
      },
    }, null, 2),
  };
}

function appendRawQueryString(url: string, queryString: string): string {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return '';
  }

  const separator = trimmedUrl.includes('?') ? '&' : '?';
  return `${trimmedUrl}${separator}${queryString}`;
}

function quoteShellSingle(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildDryRunCurlCommand(input: {
  url: string;
}): string {
  return `curl -sS ${quoteShellSingle(input.url)}`;
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
    method: 'GET',
    url: buildTimelineSyncGetUrl(matchedProject),
    contentType: 'empty',
    customBody: '',
  };
}

export function getTimelineSyncDryRunHelp(input: {
  project?: string;
  webAppUrl?: string;
  milestone?: string;
}): TimelineSyncDryRunHelp | null {
  const matchedProject = findTimelineProject(input.project);
  const webAppUrl = input.webAppUrl?.trim();
  if (!matchedProject || !webAppUrl) {
    return null;
  }

  const { customBody, sampleMilestone } = buildTimelineSyncDryRunCustomBody(
    matchedProject,
    input.milestone,
  );
  const dryRunPayload = JSON.parse(customBody) as { releaseInfo?: unknown };
  const query = new URLSearchParams({
    action: 'cacheReleaseInfo',
    project: matchedProject.paramKey,
    dryRun: 'true',
    releaseInfo: dryRunPayload.releaseInfo ? JSON.stringify(dryRunPayload.releaseInfo) : '',
  }).toString();
  const url = appendRawQueryString(webAppUrl, query);
  const contentType = 'empty';

  return {
    project: matchedProject.value,
    label: matchedProject.label,
    sampleMilestone,
    method: 'GET',
    url,
    contentType,
    customBody: '',
    curlCommand: buildDryRunCurlCommand({
      url,
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
      // Do not change this Apps Script callback to POST. Jira Automation stops
      // on the script.google.com -> script.googleusercontent.com 302 redirect
      // for POST, while GET follows the same pattern as the working executor rule.
      url: buildTimelineSyncGetUrl(project),
      headers: [],
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
