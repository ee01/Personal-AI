export type UXTicketKeySource =
  | 'api'
  | 'jira_path'
  | 'jira_query'
  | 'jira_query_selected_issue'
  | 'jira_query_issue_key'
  | 'jira_query_jql'
  | 'data_issue_key'
  | 'aria_label'
  | 'text';

export type UXTicketReference = {
  key: string;
  summary: string;
  source: string;
  keySource?: UXTicketKeySource;
  keyRecoveryCandidateCount?: number;
  keyRecoveryIgnoredCandidateCount?: number;
  keyRecoveryIgnoredSourceCounts?: Partial<Record<UXTicketKeySource, number>>;
};

export type JiraIssueKeyUrlCandidate = {
  key: string;
  keySource: Extract<
    UXTicketKeySource,
    'jira_path' | 'jira_query' | 'jira_query_selected_issue' | 'jira_query_issue_key' | 'jira_query_jql'
  >;
};

export type FigmaDesignItem = {
  type: 'figma';
  url: string;
  source: string;
  title?: string;
  label?: string;
  status?: string;
  updatedAt?: string;
  updatedAtSource?: string;
};

export type DesignTool = 'figma' | 'miro' | 'loom' | 'google_slides' | 'zeplin' | 'generic';

export type DesignLinkCandidate = {
  url: string;
  tool: DesignTool;
  label: string;
  title?: string;
  status?: string;
  updatedAt?: string;
  updatedAtSource?: string;
  source?: string;
};

export type IgnoredDesignLikeLink = {
  url: string;
  tool: Extract<DesignTool, 'figma' | 'zeplin'>;
  label: string;
  source?: string;
};

export type DesignLinkScanResult = {
  links: DesignLinkCandidate[];
  ignored: IgnoredDesignLikeLink[];
};

export type ExternalDesignItem = {
  type: 'design_link';
  url: string;
  source: string;
  tool: DesignTool;
  label: string;
  title?: string;
  status?: string;
  updatedAt?: string;
  updatedAtSource?: string;
};

export type UXDesignItem = {
  type: 'ux_ticket';
  url?: string;
  summary?: string;
  designLabel?: string;
  designStatus?: string;
  uxTicketKey: string;
  uxTicketKeySource?: UXTicketKeySource;
  keyRecoveryCandidateCount?: number;
  keyRecoveryIgnoredCandidateCount?: number;
  keyRecoveryIgnoredSourceCounts?: Partial<Record<UXTicketKeySource, number>>;
  source: string;
  linkProvided: boolean;
  uxEpicKey?: string;
  uxEpicStatus?: string;
  uxEta?: string;
  uxEtaSource?: 'duedate' | 'fixVersion';
  designUpdatedAt?: string;
  designUpdatedAtSource?: string;
};

export type DesignDisplayItem = FigmaDesignItem | ExternalDesignItem | UXDesignItem;

export type DesignUpdateReviewScope = {
  updateSignalCount: number;
  missingUpdatedAtCount: number;
  latestUpdatedAt?: string;
  latestUpdatedAtSource?: string;
  latestUpdatedAtSourceLabel?: string;
  latestUpdatedAtBasisLabel?: string;
  latestUpdatedDateLabel?: string;
  summary: string;
  tooltip: string;
};

export type DesignScanBasisReceipt = {
  handoffEntryCount: number;
  filteredNonHandoffCount: number;
  sourceSummary: string;
  ignoredSummary?: string;
  ignoredSourceSummary?: string;
  ignoredReasonSummary?: string;
  summary: string;
  tooltip: string;
};

export type UXEpicStatusTone = 'todo' | 'in-progress' | 'done' | 'blocked' | 'cancelled';
export type DesignStatusTone = 'ready' | 'updated' | 'missing' | 'not-ready' | 'blocked' | 'review' | 'done' | 'neutral';
export type DesignAttentionLevel = DesignStatusTone;

const genericDesignTitles = new Set([
  'design',
  'the design',
  'design link',
  'figma',
  'figma design',
  'figma file',
  'figma link',
  'designs',
  'prototype',
  'figma prototype',
  'link',
  'here',
  'click here',
  'open link',
  'open in figma',
  'view in figma',
  'see design',
  'view design',
  'view figma',
]);

export function getUXEpicStatusTone(status?: string): UXEpicStatusTone {
  const normalizedStatus = normalizeStatusForMatching(status);

  if (!normalizedStatus) return 'todo';

  const matchesAny = (keywords: string[]) => keywords.some(keyword => normalizedStatus.includes(keyword));

  if (matchesAny(['cancelled', 'canceled', "won't do", 'wont do', 'rejected', 'duplicate'])) {
    return 'cancelled';
  }

  if (matchesAny(['blocked', 'on hold', 'hold', 'pending'])) {
    return 'blocked';
  }

  if (matchesAny(['done', 'closed', 'complete', 'completed', 'resolved', 'released', 'shipped'])) {
    return 'done';
  }

  if (matchesAny(['in progress', 'progress', 'review', 'design review', 'testing', 'qa', 'verify', 'implement'])) {
    return 'in-progress';
  }

  return 'todo';
}

function normalizeStatusForMatching(status?: string | null): string {
  return status
    ?.trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || '';
}

export function formatDesignStatusLabel(status?: string | null): string | undefined {
  const trimmedStatus = status?.trim();
  if (!trimmedStatus) return undefined;

  const expandedStatus = trimmedStatus
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!expandedStatus) return undefined;

  const normalizedStatus = normalizeStatusForMatching(expandedStatus);
  if ([
    'changed',
    'design changed',
    'updated',
    'new changes',
    'outdated',
    'out of sync',
    'stale',
    'updated following a change',
  ].includes(normalizedStatus)) {
    return 'Design updated';
  }

  const isMachineCase = expandedStatus !== trimmedStatus
    || /^[a-z\s]+$/.test(expandedStatus)
    || /^[A-Z\s]+$/.test(expandedStatus);

  if (!isMachineCase) {
    return trimmedStatus;
  }

  const sentenceStatus = expandedStatus.toLowerCase();
  return sentenceStatus.charAt(0).toUpperCase() + sentenceStatus.slice(1);
}

function getDesignTimestampMs(value?: string | null): number | null {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return null;

  const normalizedValue = trimmedValue.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const time = Date.parse(normalizedValue);
  return Number.isNaN(time) ? null : time;
}

function isDateOnlyDesignUpdatedValue(value?: string | null): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value?.trim() || '');
}

export function formatDesignUpdatedDate(value?: string | null): string | undefined {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return undefined;

  const dateMatch = trimmedValue.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (dateMatch) return dateMatch[1];

  const time = getDesignTimestampMs(trimmedValue);
  if (time === null) return undefined;

  return new Date(time).toISOString().slice(0, 10);
}

export function formatDesignUpdatedDateTime(value?: string | null): string | undefined {
  if (isDateOnlyDesignUpdatedValue(value)) return undefined;

  const time = getDesignTimestampMs(value);
  if (time === null) return undefined;

  return `${new Date(time).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

const designUpdatedAtSourceLabels: Record<string, string> = {
  'object.updatedDate': 'Jira object updated date',
  'object.updatedAt': 'Jira object updated time',
  'object.lastUpdated': 'Jira object last-updated time',
  'object.status.updatedDate': 'Jira/Figma status updated date',
  'object.status.updatedAt': 'Jira/Figma status updated time',
  'remoteLink.updatedDate': 'Jira remote-link updated date',
  'remoteLink.updatedAt': 'Jira remote-link updated time',
};

export function getDesignUpdatedAtSourceLabel(source?: string | null): string | undefined {
  const trimmedSource = source?.trim();
  if (!trimmedSource) return undefined;
  return designUpdatedAtSourceLabels[trimmedSource] || trimmedSource;
}

export function getDesignUpdatedAtBasisLabel(source?: string | null, value?: string | null): string | undefined {
  if (!formatDesignUpdatedDate(value)) return undefined;

  const sourceKey = source?.trim();
  if (!sourceKey) return undefined;

  const precisionLabel = isDateOnlyDesignUpdatedValue(value) ? 'date' : 'time';
  if (sourceKey.includes('.status.')) return `Status ${precisionLabel}`;
  if (sourceKey.startsWith('object.')) return `Object ${precisionLabel}`;
  if (sourceKey.startsWith('remoteLink.')) return `Remote link ${precisionLabel}`;
  return `Metadata ${precisionLabel}`;
}

export function formatDesignUpdatedBasisTooltip(source?: string | null, value?: string | null): string | undefined {
  const basisLabel = getDesignUpdatedAtBasisLabel(source, value);
  if (!basisLabel) return undefined;

  const sourceLabel = getDesignUpdatedAtSourceLabel(source) || 'available Jira/Figma metadata';
  return `${basisLabel}. The visible updated date comes from ${sourceLabel}; this does not refresh Figma, edit Jira, or confirm that the design update was reviewed.`;
}

export function formatDesignUpdatedTooltip(value?: string | null, source?: string | null): string | undefined {
  const dateLabel = formatDesignUpdatedDate(value);
  if (!dateLabel) return undefined;

  const sourceLabel = getDesignUpdatedAtSourceLabel(source);
  const sourceSentence = sourceLabel ? ` Source: ${sourceLabel}.` : '';

  if (isDateOnlyDesignUpdatedValue(value)) {
    return `Design update reported on ${dateLabel}. Source did not provide a specific time; re-check the linked design if implementation started before this date.${sourceSentence}`;
  }

  const dateTimeLabel = formatDesignUpdatedDateTime(value);
  return `Design update reported ${dateTimeLabel || dateLabel}. Re-check the linked design if implementation started before this update.${sourceSentence}`;
}

export function chooseLatestDesignUpdatedAt(...values: Array<string | undefined | null>): string | undefined {
  let selectedValue: string | undefined;
  let selectedTime: number | null = null;

  for (const value of values) {
    const trimmedValue = value?.trim();
    if (!trimmedValue) continue;

    const time = getDesignTimestampMs(trimmedValue);
    if (time === null) continue;

    if (!selectedValue || selectedTime === null || time > selectedTime) {
      selectedValue = trimmedValue;
      selectedTime = time;
    }
  }

  return selectedValue;
}

export type DesignUpdatedAtCandidate = {
  value?: string | null;
  source?: string | null;
};

export type DesignUpdatedAtSelection = {
  value?: string;
  source?: string;
};

export function chooseLatestDesignUpdatedAtWithSource(
  ...values: DesignUpdatedAtCandidate[]
): DesignUpdatedAtSelection {
  let selectedValue: string | undefined;
  let selectedSource: string | undefined;
  let selectedTime: number | null = null;

  for (const candidate of values) {
    const trimmedValue = candidate.value?.trim();
    if (!trimmedValue) continue;

    const time = getDesignTimestampMs(trimmedValue);
    if (time === null) continue;

    if (!selectedValue || selectedTime === null || time > selectedTime) {
      selectedValue = trimmedValue;
      selectedSource = candidate.source?.trim() || undefined;
      selectedTime = time;
    }
  }

  return {
    value: selectedValue,
    source: selectedSource,
  };
}

function chooseDesignUpdatedAtWithSource(
  currentValue: string | undefined,
  currentSource: string | undefined,
  nextValue: string | undefined,
  nextSource: string | undefined,
): DesignUpdatedAtSelection {
  const latestValue = chooseLatestDesignUpdatedAtWithSource(
    { value: currentValue, source: currentSource },
    { value: nextValue, source: nextSource },
  );
  if (latestValue.value) return latestValue;

  const trimmedCurrent = currentValue?.trim();
  const trimmedNext = nextValue?.trim();
  if (!trimmedNext) return { value: trimmedCurrent, source: currentSource };
  if (!trimmedCurrent) return { value: trimmedNext, source: nextSource };

  const currentTime = getDesignTimestampMs(trimmedCurrent);
  const nextTime = getDesignTimestampMs(trimmedNext);
  if (currentTime !== null && nextTime !== null && nextTime > currentTime) {
    return { value: trimmedNext, source: nextSource };
  }

  return { value: trimmedCurrent, source: currentSource };
}

export function getDesignStatusTone(status?: string): DesignStatusTone {
  const normalizedStatus = normalizeStatusForMatching(status);

  if (!normalizedStatus) return 'neutral';

  const matchesAny = (keywords: string[]) => keywords.some(keyword => normalizedStatus.includes(keyword));
  const matchesPattern = (patterns: RegExp[]) => patterns.some(pattern => pattern.test(normalizedStatus));

  if (matchesAny(['missing link', 'missing design', 'no design link', 'no design', 'not linked'])) {
    return 'missing';
  }

  if (matchesPattern([
    /\bnot\s+ready\b/,
    /\bdraft\b/,
    /\bwip\b/,
    /\bwork\s+in\s+progress\b/,
    /\bin\s+design\b/,
  ])) {
    return 'not-ready';
  }

  if (matchesAny(['blocked', 'on hold', 'hold', 'waiting', 'permission', 'no access', 'error'])) {
    return 'blocked';
  }

  if (matchesPattern([
    /\bupdated\b/,
    /\boutdated\b/,
    /\bchanged\b/,
    /\bnew changes\b/,
    /\bout of sync\b/,
    /\bstale\b/,
  ])) {
    return 'updated';
  }

  if (matchesPattern([
    /\bready\s+for\s+(dev|development|implementation|handoff)\b/,
    /\bready\s+to\s+(build|implement|start)\b/,
    /^ready$/,
  ])) {
    return 'ready';
  }

  if (matchesAny(['done', 'resolved', 'closed', 'complete', 'completed', 'shipped'])) {
    return 'done';
  }

  if (matchesAny(['review', 'in progress', 'progress', 'wip', 'feedback'])) {
    return 'review';
  }

  return 'neutral';
}

function getDesignStatusPriority(status?: string): number {
  const priorityByTone: Record<DesignStatusTone, number> = {
    ready: 0,
    updated: 1,
    missing: 2,
    'not-ready': 3,
    blocked: 4,
    review: 5,
    done: 6,
    neutral: 7,
  };

  return priorityByTone[getDesignStatusTone(status)];
}

function getSourcePriority(source: string): number {
  if (source.includes('remote_link')) return 0;
  if (source.includes('jira_designs')) return 0;
  if (source.includes('design_field')) return 1;
  if (source.includes('linked_issues') || source.includes('issue_link') || source.includes('child_issue')) return 2;
  if (source.includes('description')) return 3;

  return 4;
}

function getItemSourcePriority(item: DesignDisplayItem): number {
  return getSourcePriority(item.source || '');
}

export function getDesignDisplayPriority(item: DesignDisplayItem): number {
  if (item.type === 'ux_ticket' && !item.linkProvided) return getDesignStatusPriority('Missing link');

  const status = item.type === 'ux_ticket' ? item.designStatus : item.status;
  return getDesignStatusPriority(status);
}

export function getDesignDisplayStatusTone(item: DesignDisplayItem): DesignStatusTone {
  if (item.type === 'ux_ticket' && !item.linkProvided) return 'missing';

  const status = item.type === 'ux_ticket' ? item.designStatus : item.status;
  return getDesignStatusTone(status);
}

export function getDesignDisplayUpdatedTimestamp(item: DesignDisplayItem): number | null {
  const updatedAt = item.type === 'ux_ticket' ? item.designUpdatedAt : item.updatedAt;
  return getDesignTimestampMs(updatedAt);
}

export function isDesignUpdatedDateMissing(item: DesignDisplayItem): boolean {
  if (getDesignDisplayStatusTone(item) !== 'updated') return false;

  const updatedAt = item.type === 'ux_ticket' ? item.designUpdatedAt : item.updatedAt;
  return !formatDesignUpdatedDate(updatedAt);
}

function getDesignUpdatedAtCandidate(item: DesignDisplayItem): DesignUpdatedAtCandidate {
  if (item.type === 'ux_ticket') {
    return {
      value: item.designUpdatedAt,
      source: item.designUpdatedAtSource,
    };
  }

  return {
    value: item.updatedAt,
    source: item.updatedAtSource,
  };
}

export function getDesignUpdateReviewScope(items: DesignDisplayItem[]): DesignUpdateReviewScope | undefined {
  const datedSignals = items
    .map(getDesignUpdatedAtCandidate)
    .filter(candidate => Boolean(formatDesignUpdatedDate(candidate.value)));
  const missingUpdatedAtCount = items.filter(isDesignUpdatedDateMissing).length;
  const updateSignalCount = datedSignals.length + missingUpdatedAtCount;
  if (updateSignalCount <= 0) return undefined;

  const latestSelection = chooseLatestDesignUpdatedAtWithSource(...datedSignals);
  const latestUpdatedDateLabel = formatDesignUpdatedDate(latestSelection.value);
  const latestUpdatedAtSourceLabel = getDesignUpdatedAtSourceLabel(latestSelection.source);
  const latestUpdatedAtBasisLabel = getDesignUpdatedAtBasisLabel(latestSelection.source, latestSelection.value);
  const summaryParts = [
    `${updateSignalCount} design update ${updateSignalCount === 1 ? 'signal' : 'signals'}`,
  ];
  if (latestUpdatedDateLabel) {
    summaryParts.push(`latest ${latestUpdatedDateLabel}`);
  }
  if (latestUpdatedAtBasisLabel) {
    summaryParts.push(`latest source ${latestUpdatedAtBasisLabel}`);
  }
  if (missingUpdatedAtCount > 0) {
    summaryParts.push(`${missingUpdatedAtCount} missing update ${missingUpdatedAtCount === 1 ? 'time' : 'times'}`);
  }

  const latestSentence = latestUpdatedDateLabel
    ? ` Latest reported update: ${latestUpdatedDateLabel}${latestUpdatedAtSourceLabel ? ` from ${latestUpdatedAtSourceLabel}` : ''}.`
    : '';
  const missingSentence = missingUpdatedAtCount > 0
    ? ` ${missingUpdatedAtCount} updated ${missingUpdatedAtCount === 1 ? 'row has' : 'rows have'} no usable update time.`
    : '';

  return {
    updateSignalCount,
    missingUpdatedAtCount,
    latestUpdatedAt: latestSelection.value,
    latestUpdatedAtSource: latestSelection.source,
    latestUpdatedAtSourceLabel,
    latestUpdatedAtBasisLabel,
    latestUpdatedDateLabel,
    summary: summaryParts.join('; '),
    tooltip: `Review scope: ${summaryParts.join('; ')}.${latestSentence}${missingSentence} Personal AI only highlights Jira/Figma metadata that may require design re-check; it does not refresh Figma, edit Jira, or confirm that the design update was reviewed.`,
  };
}

export function getDesignAttentionLevel(item: DesignDisplayItem): DesignAttentionLevel {
  return getDesignDisplayStatusTone(item);
}

export function getDesignStatusActionHint(status?: string | null): string | undefined {
  const label = formatDesignStatusLabel(status);
  if (!label) return undefined;

  switch (getDesignStatusTone(label)) {
    case 'ready':
      return 'Ready for development. Review the linked design before implementing.';
    case 'updated':
      return 'Design changed after handoff. Re-check the linked design before implementing.';
    case 'missing':
      return 'A related UX ticket was found, but no handoff URL is available. Open the UX ticket and add or check the design link before implementing.';
    case 'not-ready':
      return 'Design is not ready for development yet.';
    case 'blocked':
      return 'Design handoff is blocked or needs access/status resolution.';
    case 'review':
      return 'Design is still in review. Confirm before implementation.';
    case 'done':
      return 'Design handoff is marked complete.';
    case 'neutral':
      return undefined;
  }
}

const uxTicketKeySourceLabels: Record<UXTicketKeySource, string> = {
  api: 'Jira API',
  jira_path: 'Jira issue URL',
  jira_query: 'URL query',
  jira_query_selected_issue: 'selectedIssue query',
  jira_query_issue_key: 'issueKey query',
  jira_query_jql: 'JQL query',
  data_issue_key: 'data-issue-key',
  aria_label: 'ARIA label',
  text: 'raw text',
};

export function shouldShowUXTicketKeySourceReceipt(source?: UXTicketKeySource): boolean {
  return Boolean(source && source !== 'api' && source !== 'jira_path');
}

export function getUXTicketKeySourceLabel(source?: UXTicketKeySource): string | undefined {
  if (!shouldShowUXTicketKeySourceReceipt(source)) return undefined;
  return `Key from ${uxTicketKeySourceLabels[source]}`;
}

export function getUXTicketKeySourceHint(source?: UXTicketKeySource): string | undefined {
  if (!shouldShowUXTicketKeySourceReceipt(source)) return undefined;
  return `Jira did not expose a standard /browse/KEY linked issue URL here. Personal AI recovered the UX ticket key from ${uxTicketKeySourceLabels[source]} and only kept it because it matches the configured design project.`;
}

export function getUXTicketKeyRecoveryBoundaryLabel(source?: UXTicketKeySource): string | undefined {
  if (!shouldShowUXTicketKeySourceReceipt(source)) return undefined;
  return 'Read-only recovered';
}

export function getUXTicketKeyRecoveryBoundaryHint(source?: UXTicketKeySource): string | undefined {
  if (!shouldShowUXTicketKeySourceReceipt(source)) return undefined;
  return 'Personal AI only shows this recovered UX ticket candidate. It does not create or edit Jira issue links, design fields, or relationships.';
}

export function getRecoveredUXTicketCandidateCount(items: DesignDisplayItem[]): number {
  return items.filter(item => item.type === 'ux_ticket' && shouldShowUXTicketKeySourceReceipt(item.uxTicketKeySource)).length;
}

const recoveredUXTicketKeySourceOrder: UXTicketKeySource[] = [
  'jira_query_selected_issue',
  'jira_query_issue_key',
  'jira_query_jql',
  'jira_query',
  'data_issue_key',
  'aria_label',
  'text',
];

const ignoredUXTicketKeySourceOrder: UXTicketKeySource[] = [
  'jira_path',
  'jira_query_selected_issue',
  'jira_query_issue_key',
  'jira_query_jql',
  'jira_query',
  'data_issue_key',
  'aria_label',
  'text',
  'api',
];

export function getRecoveredUXTicketSourceCounts(items: DesignDisplayItem[]): Partial<Record<UXTicketKeySource, number>> {
  const counts: Partial<Record<UXTicketKeySource, number>> = {};
  for (const item of items) {
    if (item.type !== 'ux_ticket' || !shouldShowUXTicketKeySourceReceipt(item.uxTicketKeySource)) continue;
    const source = item.uxTicketKeySource;
    counts[source] = (counts[source] || 0) + 1;
  }
  return counts;
}

export function getUXTicketRecoverySourceSummary(items: DesignDisplayItem[]): string | undefined {
  const counts = getRecoveredUXTicketSourceCounts(items);
  const parts = recoveredUXTicketKeySourceOrder
    .map(source => {
      const count = counts[source] || 0;
      if (count <= 0) return '';
      return `${count} ${uxTicketKeySourceLabels[source]}`;
    })
    .filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

export function getUXTicketRecoveryScopeSummary(count: number): string | undefined {
  if (!Number.isFinite(count) || count <= 0) return undefined;
  return `${count} recovered UX ticket ${count === 1 ? 'candidate' : 'candidates'}`;
}

function mergeMaxUXTicketSourceCounts(
  current?: Partial<Record<UXTicketKeySource, number>>,
  next?: Partial<Record<UXTicketKeySource, number>>,
): Partial<Record<UXTicketKeySource, number>> | undefined {
  if (!current && !next) return undefined;
  const merged: Partial<Record<UXTicketKeySource, number>> = { ...(current || {}) };
  Object.entries(next || {}).forEach(([source, count]) => {
    const keySource = source as UXTicketKeySource;
    merged[keySource] = Math.max(merged[keySource] || 0, Number(count) || 0);
  });
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function getRecoveryIgnoredCandidateItems(items: DesignDisplayItem[]): UXDesignItem[] {
  return items.filter((item): item is UXDesignItem => (
    item.type === 'ux_ticket'
    && shouldShowUXTicketKeySourceReceipt(item.uxTicketKeySource)
    && Boolean(item.keyRecoveryIgnoredCandidateCount && item.keyRecoveryIgnoredCandidateCount > 0)
  ));
}

export function getUXTicketRecoveryIgnoredCandidateCount(items: DesignDisplayItem[]): number {
  return getRecoveryIgnoredCandidateItems(items).reduce((total, item) => (
    total + Math.max(0, item.keyRecoveryIgnoredCandidateCount || 0)
  ), 0);
}

export function getUXTicketRecoveryIgnoredSourceCounts(items: DesignDisplayItem[]): Partial<Record<UXTicketKeySource, number>> {
  const counts: Partial<Record<UXTicketKeySource, number>> = {};
  for (const item of getRecoveryIgnoredCandidateItems(items)) {
    Object.entries(item.keyRecoveryIgnoredSourceCounts || {}).forEach(([source, count]) => {
      const keySource = source as UXTicketKeySource;
      counts[keySource] = (counts[keySource] || 0) + Math.max(0, Number(count) || 0);
    });
  }
  return counts;
}

export function getUXTicketRecoveryIgnoredSourceSummary(items: DesignDisplayItem[]): string | undefined {
  const counts = getUXTicketRecoveryIgnoredSourceCounts(items);
  const parts = ignoredUXTicketKeySourceOrder
    .map(source => {
      const count = counts[source] || 0;
      if (count <= 0) return '';
      return `${count} ${uxTicketKeySourceLabels[source]}`;
    })
    .filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

export function getUXTicketRecoveryFilterSummary(count: number): string | undefined {
  if (!Number.isFinite(count) || count <= 0) return undefined;
  return `${count} non-design ${count === 1 ? 'candidate' : 'candidates'} ignored`;
}

export function sortDesignDisplayItems(items: DesignDisplayItem[]): DesignDisplayItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const priorityDiff = getDesignDisplayPriority(a.item) - getDesignDisplayPriority(b.item);
      if (priorityDiff !== 0) return priorityDiff;

      const aUpdatedAt = getDesignDisplayUpdatedTimestamp(a.item);
      const bUpdatedAt = getDesignDisplayUpdatedTimestamp(b.item);
      if (aUpdatedAt !== null && bUpdatedAt !== null && aUpdatedAt !== bUpdatedAt) {
        return bUpdatedAt - aUpdatedAt;
      }
      if (aUpdatedAt !== null && bUpdatedAt === null) return -1;
      if (aUpdatedAt === null && bUpdatedAt !== null) return 1;

      const sourceDiff = getItemSourcePriority(a.item) - getItemSourcePriority(b.item);
      if (sourceDiff !== 0) return sourceDiff;

      return a.index - b.index;
    })
    .map(entry => entry.item);
}

// pattern 格式: "UX*" 表示前缀匹配, "RCV" 表示完全匹配项目部分
export function matchesProjectPattern(ticketKey: string, pattern: string): boolean {
  if (!ticketKey || !pattern) return false;

  const normalizedTicketKey = ticketKey.trim().toUpperCase();
  const normalizedPattern = pattern.trim().toUpperCase();
  if (!normalizedTicketKey || !normalizedPattern) return false;

  const projectPart = normalizedTicketKey.split('-')[0];
  if (!projectPart) return false;

  if (normalizedPattern.endsWith('*')) {
    const prefix = normalizedPattern.slice(0, -1).trim();
    if (!prefix) return false;
    return projectPart.startsWith(prefix);
  }

  return projectPart === normalizedPattern;
}

export function parseJiraIssueKeysFromText(value?: string | null): string[] {
  if (!value) return [];

  const keys: string[] = [];
  const seenKeys = new Set<string>();
  const pattern = /(^|[^A-Z0-9])([A-Z][A-Z0-9]+-\d+)(?=$|[^A-Z0-9-])/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    const key = match[2]?.toUpperCase();
    if (key && !seenKeys.has(key)) {
      seenKeys.add(key);
      keys.push(key);
    }
  }

  return keys;
}

export function parseJiraIssueKeyFromText(value?: string | null): string | null {
  return parseJiraIssueKeysFromText(value)[0] || null;
}

export function parseJiraIssueKeyFromBrowseUrl(rawUrl?: string | null): string | null {
  const trimmedUrl = rawUrl?.trim();
  if (!trimmedUrl) return null;

  try {
    const url = new URL(trimmedUrl, 'https://jira.local');
    const pathMatch = url.pathname.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)(?:\/|$)/i);
    return pathMatch?.[1]?.toUpperCase() || null;
  } catch {
    return null;
  }
}

export function parseJiraIssueKeyFromIssuePath(rawUrl?: string | null): string | null {
  const trimmedUrl = rawUrl?.trim();
  if (!trimmedUrl) return null;

  try {
    const url = new URL(trimmedUrl, 'https://jira.local');
    const pathPatterns = [
      /\/browse\/([A-Z][A-Z0-9]+-\d+)(?:\/|$)/i,
      /\/issues\/([A-Z][A-Z0-9]+-\d+)(?:\/|$)/i,
      /\/issue\/([A-Z][A-Z0-9]+-\d+)(?:\/|$)/i,
    ];

    for (const pattern of pathPatterns) {
      const match = url.pathname.match(pattern);
      if (match?.[1]) return match[1].toUpperCase();
    }
  } catch {
    return null;
  }

  return null;
}

function getJiraIssueQueryKeySource(name: string): Extract<
  UXTicketKeySource,
  'jira_query' | 'jira_query_selected_issue' | 'jira_query_issue_key' | 'jira_query_jql'
> | null {
  switch (name.toLowerCase()) {
    case 'selectedissue':
    case 'selectedissuekey':
      return 'jira_query_selected_issue';
    case 'idorkey':
    case 'issue':
    case 'issuekey':
      return 'jira_query_issue_key';
    case 'jql':
      return 'jira_query_jql';
    default:
      return null;
  }
}

function parseJiraIssueKeyCandidatesFromQueryParams(url: URL): Array<{
  key: string;
  keySource: Extract<
    UXTicketKeySource,
    'jira_query' | 'jira_query_selected_issue' | 'jira_query_issue_key' | 'jira_query_jql'
  >;
}> {
  const candidates: Array<{
    key: string;
    keySource: Extract<
      UXTicketKeySource,
      'jira_query' | 'jira_query_selected_issue' | 'jira_query_issue_key' | 'jira_query_jql'
    >;
  }> = [];

  const seenKeys = new Set<string>();
  url.searchParams.forEach((value, name) => {
    const keySource = getJiraIssueQueryKeySource(name);
    if (!keySource) return;
    for (const key of parseJiraIssueKeysFromText(value)) {
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      candidates.push({ key, keySource });
    }
  });

  return candidates;
}

function parseJiraIssueKeyFromQueryParams(url: URL): string | null {
  return parseJiraIssueKeyCandidatesFromQueryParams(url)[0]?.key || null;
}

export function parseJiraIssueKeyCandidatesFromUrl(rawUrl?: string | null): JiraIssueKeyUrlCandidate[] {
  const trimmedUrl = rawUrl?.trim();
  if (!trimmedUrl) return [];

  try {
    const url = new URL(trimmedUrl, 'https://jira.local');
    const candidates: JiraIssueKeyUrlCandidate[] = [];
    const seenKeys = new Set<string>();
    const addCandidate = (key: string | null, keySource: JiraIssueKeyUrlCandidate['keySource']) => {
      if (!key || seenKeys.has(key)) return;
      seenKeys.add(key);
      candidates.push({ key, keySource });
    };

    addCandidate(parseJiraIssueKeyFromIssuePath(trimmedUrl), 'jira_path');
    for (const queryCandidate of parseJiraIssueKeyCandidatesFromQueryParams(url)) {
      addCandidate(queryCandidate.key, queryCandidate.keySource);
    }

    return candidates;
  } catch {
    return [];
  }
}

export function parseJiraIssueKeyFromIssueUrl(rawUrl?: string | null): string | null {
  const trimmedUrl = rawUrl?.trim();
  if (!trimmedUrl) return null;

  const pathKey = parseJiraIssueKeyFromIssuePath(trimmedUrl);
  if (pathKey) return pathKey;

  try {
    const url = new URL(trimmedUrl, 'https://jira.local');
    return parseJiraIssueKeyFromQueryParams(url);
  } catch {
    return null;
  }
}

export function parseJiraIssueKeyFromUrl(rawUrl?: string | null): string | null {
  const trimmedUrl = rawUrl?.trim();
  if (!trimmedUrl) return null;

  try {
    const url = new URL(trimmedUrl, 'https://jira.local');
    return parseJiraIssueKeyFromIssueUrl(trimmedUrl)
      || parseJiraIssueKeyFromText(trimmedUrl)
      || parseJiraIssueKeyFromText(url.pathname);
  } catch {
    return parseJiraIssueKeyFromText(trimmedUrl);
  }
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttribute(value: unknown): string {
  return escapeHtml(value);
}

export function isMeaningfulDesignTitle(title?: string | null): boolean {
  const normalizedTitle = title
    ?.trim()
    .replace(/\s+/g, ' ');

  if (!normalizedTitle || normalizedTitle.length < 4) return false;
  if (/^https?:\/\//i.test(normalizedTitle)) return false;

  const comparableTitle = normalizedTitle
    .toLowerCase()
    .replace(/[↗→›»：:\-–—_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (genericDesignTitles.has(comparableTitle)) return false;
  if (/^(click|open|view|see|check|inspect)\s+(here|this|the\s+design|design|figma)$/i.test(comparableTitle)) {
    return false;
  }

  return true;
}

function chooseDesignTitle(
  currentTitle: string | undefined,
  nextTitle: string | undefined,
  currentSource: string,
  nextSource: string,
): string | undefined {
  const trimmedCurrent = currentTitle?.trim();
  const trimmedNext = nextTitle?.trim();
  const currentIsMeaningful = isMeaningfulDesignTitle(trimmedCurrent);
  const nextIsMeaningful = isMeaningfulDesignTitle(trimmedNext);

  if (nextIsMeaningful && !currentIsMeaningful) return trimmedNext;
  if (currentIsMeaningful && !nextIsMeaningful) return trimmedCurrent;

  if (nextIsMeaningful && currentIsMeaningful) {
    return getSourcePriority(nextSource) < getSourcePriority(currentSource)
      ? trimmedNext
      : trimmedCurrent;
  }

  return trimmedCurrent || trimmedNext || undefined;
}

export function normalizeDesignUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const trimmedUrl = rawUrl
    .trim()
    .replace(/[)\].,;!?，。；！？]+$/g, '');

  if (!trimmedUrl) return null;

  try {
    const url = new URL(trimmedUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

function getFigmaIdentityPath(url: URL): string | null {
  const [kind, fileKey] = url.pathname.split('/').filter(Boolean);
  if (!kind || !fileKey) return null;

  const normalizedKind = kind.toLowerCase();
  if (!['design', 'file', 'proto', 'board', 'figjam', 'slides'].includes(normalizedKind)) {
    return null;
  }

  return `/${normalizedKind}/${fileKey}`;
}

function normalizeFigmaIdentityParam(value: string): string {
  return value.trim().replace(/-/g, ':');
}

export function getDesignUrlDedupeKey(rawUrl?: string | null): string {
  const normalizedUrl = normalizeDesignUrl(rawUrl);
  if (!normalizedUrl) return String(rawUrl || '').trim();

  try {
    const url = new URL(normalizedUrl);
    const hostname = url.hostname.toLowerCase();
    const identityPath = getFigmaIdentityPath(url);

    if ((hostname === 'figma.com' || hostname.endsWith('.figma.com')) && identityPath) {
      const canonicalHost = hostname === 'figma.com' ? 'www.figma.com' : hostname;
      const identityParams = ['node-id', 'page-id', 'starting-point-node-id']
        .map(param => {
          const value = url.searchParams.get(param);
          return value ? `${param}=${normalizeFigmaIdentityParam(value)}` : '';
        })
        .filter(Boolean)
        .join('&');

      return identityParams
        ? `figma://${canonicalHost}${identityPath}?${identityParams}`
        : `figma://${canonicalHost}${identityPath}`;
    }

    return normalizedUrl;
  } catch {
    return normalizedUrl;
  }
}

function normalizeDesignDomainPattern(rawValue: string): string {
  const value = rawValue.trim().toLowerCase();
  if (!value) return '';

  const withoutProtocol = value.replace(/^https?:\/\//, '');
  const host = withoutProtocol.split('/')[0].split(':')[0].replace(/\.+$/g, '');
  if (!host) return '';

  if (host.startsWith('*.')) {
    const wildcardHost = host.slice(2).replace(/^\.+/g, '');
    return wildcardHost ? `*.${wildcardHost}` : '';
  }

  return host.replace(/^\.+/g, '');
}

export function parseDesignDomainPatterns(rawValue?: string | null): string[] {
  if (!rawValue || typeof rawValue !== 'string') return [];

  const patterns = rawValue
    .split(/[\n,;]+/)
    .map(normalizeDesignDomainPattern)
    .filter(Boolean);

  return Array.from(new Set(patterns));
}

export function matchesDesignDomain(hostname: string, domainPatterns: string[]): boolean {
  const normalizedHost = hostname.trim().toLowerCase().replace(/\.+$/g, '');
  if (!normalizedHost || domainPatterns.length === 0) return false;

  return domainPatterns.some(pattern => {
    const normalizedPattern = normalizeDesignDomainPattern(pattern);
    if (!normalizedPattern) return false;

    const isWildcardPattern = normalizedPattern.startsWith('*.');
    const baseDomain = isWildcardPattern
      ? normalizedPattern.slice(2)
      : normalizedPattern;

    if (!baseDomain) return false;
    return isWildcardPattern
      ? normalizedHost.endsWith(`.${baseDomain}`)
      : normalizedHost === baseDomain;
  });
}

export function classifyDesignUrl(
  rawUrl?: string | null,
  allowGeneric = false,
  extraDomainPatterns: string[] = [],
): DesignLinkCandidate | null {
  const normalizedUrl = normalizeDesignUrl(rawUrl);
  if (!normalizedUrl) return null;

  const url = new URL(normalizedUrl);
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();

  if (hostname === 'figma.com' || hostname.endsWith('.figma.com')) {
    if (isFigmaHandoffUrl(pathname)) {
      return {
        url: normalizedUrl,
        tool: 'figma',
        label: getFigmaDisplayLabel(normalizedUrl)
      };
    }
    return null;
  }

  if (isMiroHandoffUrl(hostname, pathname)) {
    return {
      url: normalizedUrl,
      tool: 'miro',
      label: 'Miro board'
    };
  }

  if (isLoomHandoffUrl(hostname, pathname)) {
    return {
      url: normalizedUrl,
      tool: 'loom',
      label: 'Loom walkthrough'
    };
  }

  if (
    hostname === 'slides.google.com' ||
    (hostname === 'docs.google.com' && pathname.startsWith('/presentation/'))
  ) {
    return {
      url: normalizedUrl,
      tool: 'google_slides',
      label: 'Google Slides'
    };
  }

  if (isZeplinHandoffUrl(hostname, pathname)) {
    return {
      url: normalizedUrl,
      tool: 'zeplin',
      label: getZeplinDisplayLabel(normalizedUrl)
    };
  }

  if (
    hostname === 'zeplin.io' ||
    hostname.endsWith('.zeplin.io') ||
    hostname === 'zpl.io' ||
    hostname.endsWith('.zpl.io')
  ) {
    return null;
  }

  if (matchesDesignDomain(hostname, extraDomainPatterns)) {
    return {
      url: normalizedUrl,
      tool: 'generic',
      label: 'Design link'
    };
  }

  if (allowGeneric) {
    return {
      url: normalizedUrl,
      tool: 'generic',
      label: 'Design link'
    };
  }

  return null;
}

function isFigmaHandoffUrl(pathname: string): boolean {
  return /^\/(?:design|file|proto|board|figjam|slides)\//.test(pathname);
}

function isMiroHandoffUrl(hostname: string, pathname: string): boolean {
  if (hostname !== 'miro.com' && !hostname.endsWith('.miro.com')) return false;
  return /^\/app\/(?:board|live-embed)\//.test(pathname);
}

function isLoomHandoffUrl(hostname: string, pathname: string): boolean {
  if (hostname !== 'loom.com' && !hostname.endsWith('.loom.com')) return false;
  return /^\/(?:share|embed)\//.test(pathname);
}

function isZeplinHandoffUrl(hostname: string, pathname: string): boolean {
  if (hostname === 'zpl.io' || hostname.endsWith('.zpl.io')) return true;
  if (hostname !== 'app.zeplin.io') return false;
  const pathParts = pathname.toLowerCase().split('/').filter(Boolean);
  if (pathParts[0] !== 'project' || !pathParts[1]) return false;
  if (pathParts.length === 2) return true;

  return [
    'screen',
    'screens',
    'section',
    'sections',
    'flow',
    'flows',
    'component',
    'components',
    'styleguide',
    'styleguides',
  ].includes(pathParts[2]);
}

function classifyIgnoredDesignLikeUrl(rawUrl?: string | null): IgnoredDesignLikeLink | null {
  const normalizedUrl = normalizeDesignUrl(rawUrl);
  if (!normalizedUrl) return null;

  const url = new URL(normalizedUrl);
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();

  if (hostname === 'figma.com' || hostname.endsWith('.figma.com')) {
    if (isFigmaHandoffUrl(pathname)) return null;

    let label = 'Figma non-handoff URL';
    if (hostname === 'help.figma.com' || hostname === 'developers.figma.com') {
      label = 'Figma documentation';
    } else if (pathname.startsWith('/community/')) {
      label = 'Figma Community';
    } else if (pathname.startsWith('/blog/') || pathname.startsWith('/about/') || pathname.startsWith('/pricing/')) {
      label = 'Figma marketing page';
    }

    return {
      url: normalizedUrl,
      tool: 'figma',
      label,
    };
  }

  if (
    hostname === 'zeplin.io' ||
    hostname.endsWith('.zeplin.io') ||
    hostname === 'zpl.io' ||
    hostname.endsWith('.zpl.io')
  ) {
    if (isZeplinHandoffUrl(hostname, pathname)) return null;

    let label = 'Zeplin non-handoff URL';
    if (hostname === 'support.zeplin.io' || hostname === 'blog.zeplin.io' || hostname === 'zeplin.io') {
      label = 'Zeplin documentation or marketing page';
    } else if (hostname === 'app.zeplin.io') {
      label = pathname.startsWith('/project/')
        ? 'Zeplin non-resource project page'
        : 'Zeplin app non-project page';
    }

    return {
      url: normalizedUrl,
      tool: 'zeplin',
      label,
    };
  }

  return null;
}

function getZeplinDisplayLabel(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathParts = parsedUrl.pathname.toLowerCase().split('/').filter(Boolean);
    if (hostname === 'zpl.io' || hostname.endsWith('.zpl.io')) return 'Zeplin design';

    const projectIndex = pathParts.indexOf('project');
    if (projectIndex === -1) return 'Zeplin design';

    const resourcePart = pathParts.slice(projectIndex + 2).find(part => Boolean(part));
    if (!resourcePart) return 'Zeplin project';

    if (resourcePart === 'screen' || resourcePart === 'screens') return 'Zeplin screen';
    if (resourcePart === 'section' || resourcePart === 'sections') return 'Zeplin section';
    if (resourcePart === 'flow' || resourcePart === 'flows') return 'Zeplin flow';
    if (resourcePart === 'component' || resourcePart === 'components') return 'Zeplin component';
    if (resourcePart === 'styleguide' || resourcePart === 'styleguides') return 'Zeplin styleguide';
  } catch {
    return 'Zeplin design';
  }

  return 'Zeplin design';
}

export function normalizeFigmaUrl(rawUrl?: string | null): string | null {
  const candidate = classifyDesignUrl(rawUrl);
  return candidate?.tool === 'figma' ? candidate.url : null;
}

export function getFigmaDisplayLabel(url: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.includes('/proto/')) return 'Figma Prototype';
    if (pathname.includes('/board/') || pathname.includes('/figjam/')) return 'FigJam Board';
    if (pathname.includes('/slides/')) return 'Figma Slides';
    if (pathname.includes('/design/') || pathname.includes('/file/')) return 'Figma Design';
  } catch {
    return 'Figma Design';
  }

  return 'Figma Design';
}

export function extractDesignLinks(
  rawValue?: string | null,
  allowGeneric = false,
  extraDomainPatterns: string[] = [],
): DesignLinkCandidate[] {
  return extractDesignLinkScan(rawValue, allowGeneric, extraDomainPatterns).links;
}

export function extractDesignLinkScan(
  rawValue?: string | null,
  allowGeneric = false,
  extraDomainPatterns: string[] = [],
): DesignLinkScanResult {
  if (!rawValue || typeof rawValue !== 'string') {
    return {
      links: [],
      ignored: [],
    };
  }

  const matches = rawValue.match(/https?:\/\/[^\s<>"']+/g) || [];
  const valuesToCheck = matches.length > 0 ? matches : [rawValue];
  const seenUrls = new Set<string>();
  const seenIgnoredUrls = new Set<string>();
  const designLinks: DesignLinkCandidate[] = [];
  const ignored: IgnoredDesignLikeLink[] = [];

  for (const value of valuesToCheck) {
    const candidate = classifyDesignUrl(value, allowGeneric, extraDomainPatterns);
    const dedupeKey = candidate ? getDesignUrlDedupeKey(candidate.url) : '';
    if (candidate && !seenUrls.has(dedupeKey)) {
      seenUrls.add(dedupeKey);
      designLinks.push(candidate);
      continue;
    }

    if (candidate) continue;

    const ignoredLink = classifyIgnoredDesignLikeUrl(value);
    if (!ignoredLink || seenIgnoredUrls.has(ignoredLink.url)) continue;
    seenIgnoredUrls.add(ignoredLink.url);
    ignored.push(ignoredLink);
  }

  return {
    links: designLinks,
    ignored,
  };
}

export function getIgnoredDesignLinkSummary(ignoredLinks: IgnoredDesignLikeLink[]): string | undefined {
  const count = ignoredLinks.length;
  if (count === 0) return undefined;
  return `${count} filtered non-handoff ${count === 1 ? 'ref' : 'refs'}`;
}

export function getIgnoredDesignLinkReasonSummary(ignoredLinks: IgnoredDesignLikeLink[]): string | undefined {
  const reasonCounts = new Map<string, { count: number; order: number }>();

  ignoredLinks.forEach(link => {
    const reason = link.label?.trim();
    if (!reason) return;

    const existing = reasonCounts.get(reason);
    if (existing) {
      existing.count += 1;
      return;
    }

    reasonCounts.set(reason, {
      count: 1,
      order: reasonCounts.size,
    });
  });

  if (reasonCounts.size === 0) return undefined;

  return Array.from(reasonCounts.entries())
    .sort(([, metaA], [, metaB]) => metaA.order - metaB.order)
    .map(([reason, meta]) => `${reason} ${meta.count}`)
    .join(', ');
}

export function getIgnoredDesignLinkTooltip(ignoredLinks: IgnoredDesignLikeLink[]): string | undefined {
  if (ignoredLinks.length === 0) return undefined;

  const labels = Array.from(new Set(ignoredLinks.map(link => link.label))).slice(0, 4);
  const overflow = ignoredLinks.length > labels.length ? ` + ${ignoredLinks.length - labels.length} more` : '';
  const sourceSummary = getIgnoredDesignLinkSourceSummary(ignoredLinks);
  const reasonSummary = getIgnoredDesignLinkReasonSummary(ignoredLinks);
  const sourceSentence = sourceSummary ? ` Sources: ${sourceSummary}.` : '';
  const reasonSentence = reasonSummary ? ` Reasons: ${reasonSummary}.` : '';
  return `Filtered design-looking URLs that were not shown as handoff rows: ${labels.join(', ')}${overflow}.${sourceSentence}${reasonSentence}`;
}

export function getIgnoredDesignFieldLinkCount(ignoredLinks: IgnoredDesignLikeLink[]): number {
  return ignoredLinks.filter(link => splitSources(link.source || '').includes('design_field')).length;
}

export function getIgnoredDesignFieldLinkSummary(ignoredLinks: IgnoredDesignLikeLink[]): string | undefined {
  const count = getIgnoredDesignFieldLinkCount(ignoredLinks);
  if (count <= 0) return undefined;
  return `${count} design-field non-handoff ${count === 1 ? 'ref' : 'refs'}`;
}

export function getIgnoredDesignFieldLinkTooltip(ignoredLinks: IgnoredDesignLikeLink[]): string | undefined {
  const designFieldIgnoredLinks = ignoredLinks.filter(link => splitSources(link.source || '').includes('design_field'));
  const summary = getIgnoredDesignFieldLinkSummary(designFieldIgnoredLinks);
  if (!summary) return undefined;

  const reasonSummary = getIgnoredDesignLinkReasonSummary(designFieldIgnoredLinks);
  const reasonSentence = reasonSummary ? ` Reasons: ${reasonSummary}.` : '';
  return `UX ticket design-field URLs were scanned, but ${summary} were documentation, community, profile, marketing, or settings pages rather than development handoff entries. Personal AI keeps the UX ticket in Missing link state when no valid handoff link remains; it does not edit Jira design fields or create links.${reasonSentence}`;
}

export function getIgnoredDesignLinkSourceSummary(ignoredLinks: IgnoredDesignLikeLink[]): string | undefined {
  const sourceCounts = new Map<string, { count: number; order: number }>();

  ignoredLinks.forEach(link => {
    splitSources(link.source || '').forEach(source => {
      const existing = sourceCounts.get(source);
      if (existing) {
        existing.count += 1;
        return;
      }
      sourceCounts.set(source, {
        count: 1,
        order: sourceCounts.size,
      });
    });
  });

  if (sourceCounts.size === 0) return undefined;

  return Array.from(sourceCounts.entries())
    .sort(([sourceA, metaA], [sourceB, metaB]) => {
      const priorityDiff = getSourcePriority(sourceA) - getSourcePriority(sourceB);
      return priorityDiff !== 0 ? priorityDiff : metaA.order - metaB.order;
    })
    .map(([source, meta]) => `${getDesignSourceLabel(source)} ${meta.count}`)
    .join(', ');
}

function addRemoteLinkTextValue(values: string[], value: unknown): void {
  if (typeof value !== 'string') return;

  const trimmedValue = value.trim();
  if (!trimmedValue) return;
  const queuedValues: string[] = [];
  const seenValues = new Set<string>();

  const addValue = (candidateValue: string): void => {
    const normalizedValue = candidateValue.trim();
    if (!normalizedValue || seenValues.has(normalizedValue)) return;
    seenValues.add(normalizedValue);
    values.push(normalizedValue);
    queuedValues.push(normalizedValue);
  };

  addValue(trimmedValue);

  for (let index = 0; index < queuedValues.length && index < 24; index += 1) {
    const currentValue = queuedValues[index];

    try {
      const decodedValue = decodeURIComponent(currentValue);
      if (decodedValue !== currentValue) addValue(decodedValue);
    } catch {
      // Some Jira globalId values are not URI-encoded strings.
    }

    try {
      const url = new URL(currentValue);
      url.searchParams.forEach(paramValue => addValue(paramValue));
      if (url.hash.includes('=')) {
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
        hashParams.forEach(paramValue => addValue(paramValue));
      }
      continue;
    } catch {
      // Not every remote-link field is a full URL.
    }

    if (!/[=&]/.test(currentValue)) continue;

    try {
      const params = new URLSearchParams(currentValue.replace(/^[?#]/, ''));
      params.forEach(paramValue => addValue(paramValue));
    } catch {
      // URLSearchParams is best-effort only for Jira globalId-style fields.
    }
  }
}

export function extractDesignLinksFromRemoteLinkPayload(
  remoteLink: any,
  extraDomainPatterns: string[] = [],
): DesignLinkScanResult {
  const object = remoteLink?.object || {};
  const objectStatus = object?.status || {};
  const objectStatusIcon = objectStatus?.icon || {};
  const values: string[] = [];

  [
    object.url,
    object.title,
    object.summary,
    objectStatusIcon.link,
    remoteLink?.globalId,
    remoteLink?.relationship,
  ].forEach(value => addRemoteLinkTextValue(values, value));

  const seenDedupeKeys = new Set<string>();
  const seenIgnoredUrls = new Set<string>();
  const designLinks: DesignLinkCandidate[] = [];
  const ignored: IgnoredDesignLikeLink[] = [];

  for (const value of values) {
    const scan = extractDesignLinkScan(value, false, extraDomainPatterns);
    for (const ignoredLink of scan.ignored) {
      if (seenIgnoredUrls.has(ignoredLink.url)) continue;
      seenIgnoredUrls.add(ignoredLink.url);
      ignored.push(ignoredLink);
    }
    for (const candidate of scan.links) {
      const dedupeKey = getDesignUrlDedupeKey(candidate.url);
      if (seenDedupeKeys.has(dedupeKey)) continue;
      seenDedupeKeys.add(dedupeKey);
      designLinks.push(candidate);
    }
  }

  return {
    links: designLinks,
    ignored,
  };
}

export function getDesignDisplayLabel(item: FigmaDesignItem | ExternalDesignItem): string {
  const title = item.title?.trim();
  if (isMeaningfulDesignTitle(title)) return title;
  return item.label || (item.type === 'figma' ? getFigmaDisplayLabel(item.url) : 'Design link');
}

const sourceLabels: Record<string, string> = {
  description: 'Description',
  linked_issues: 'Linked issue',
  epic_subtask: 'Epic subtask',
  epic_issue_link: 'Epic link',
  epic_child_issue: 'Epic child',
  parent_subtask: 'Parent subtask',
  parent_issue_link: 'Parent link',
  parent_child_issue: 'Parent child',
  remote_link: 'Remote link',
  jira_designs: 'Jira Designs',
  design_field: 'Design field',
  subtask: 'Subtask',
  issue_link: 'Issue link',
  child_issue: 'Child issue',
};

function splitSources(source: string): string[] {
  return source
    .split(/\s*,\s*/)
    .map(item => item.trim())
    .filter(Boolean);
}

export function mergeDesignSources(currentSource: string, nextSource: string): string {
  return Array.from(new Set([...splitSources(currentSource), ...splitSources(nextSource)])).join(', ');
}

export function getDesignSourceLabel(source: string): string {
  return splitSources(source)
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const priorityDiff = getSourcePriority(a.item) - getSourcePriority(b.item);
      return priorityDiff !== 0 ? priorityDiff : a.index - b.index;
    })
    .map(({ item }) => sourceLabels[item] || item.replace(/_/g, ' '))
    .join(', ');
}

export function getDesignSourceTooltip(source: string): string {
  const label = getDesignSourceLabel(source);
  return label ? `Source: ${label}` : 'Source unavailable';
}

export function getDesignSourceSummary(items: DesignDisplayItem[]): string {
  const seenSources = new Map<string, number>();

  items.forEach(item => {
    splitSources(item.source || '').forEach(source => {
      if (!seenSources.has(source)) {
        seenSources.set(source, seenSources.size);
      }
    });
  });

  const itemCountLabel = `${items.length} ${items.length === 1 ? 'entry' : 'entries'}`;
  if (seenSources.size === 0) return itemCountLabel;

  const labels = Array.from(seenSources.entries())
    .sort(([sourceA, indexA], [sourceB, indexB]) => {
      const priorityDiff = getSourcePriority(sourceA) - getSourcePriority(sourceB);
      return priorityDiff !== 0 ? priorityDiff : indexA - indexB;
    })
    .map(([source]) => getDesignSourceLabel(source));
  const visibleLabels = labels.slice(0, 4).join(', ');
  const overflowLabel = labels.length > 4 ? ` + ${labels.length - 4} more` : '';

  return `${itemCountLabel} · ${visibleLabels}${overflowLabel}`;
}

export function getDesignScanBasisReceipt(
  items: DesignDisplayItem[],
  ignoredLinks: IgnoredDesignLikeLink[] = [],
): DesignScanBasisReceipt {
  const sourceSummary = items.length > 0 ? getDesignSourceSummary(items) : '0 handoff entries';
  const ignoredSummary = getIgnoredDesignLinkSummary(ignoredLinks);
  const ignoredSourceSummary = getIgnoredDesignLinkSourceSummary(ignoredLinks);
  const ignoredReasonSummary = getIgnoredDesignLinkReasonSummary(ignoredLinks);
  const summaryParts = [sourceSummary, ignoredSummary].filter(Boolean);
  const sourceSentence = items.length > 0
    ? `Handoff rows are based on Jira-visible sources: ${sourceSummary}.`
    : 'No handoff rows are shown in this Jira-visible scan batch.';
  const filteredSentence = ignoredSummary
    ? ` ${ignoredSummary} were intentionally kept out of handoff rows${ignoredReasonSummary ? `: ${ignoredReasonSummary}` : ''}.`
    : '';
  const filteredSourceSentence = ignoredSourceSummary ? ` Filtered sources: ${ignoredSourceSummary}.` : '';

  return {
    handoffEntryCount: items.length,
    filteredNonHandoffCount: ignoredLinks.length,
    sourceSummary,
    ignoredSummary,
    ignoredSourceSummary,
    ignoredReasonSummary,
    summary: `Jira-visible handoff scan: ${summaryParts.join('; ') || sourceSummary}`,
    tooltip: `Scan basis: ${sourceSentence}${filteredSentence}${filteredSourceSentence} Personal AI only uses links visible in this Jira page and read-only Jira APIs; it does not refresh Figma or Zeplin, enumerate private design files, create or edit Jira links, or mark design review complete.`,
  };
}

export function dedupeDesignData(designData: DesignDisplayItem[]): DesignDisplayItem[] {
  const consumedDirectUrls = new Set<string>();
  const seenDirect = new Map<string, FigmaDesignItem | ExternalDesignItem>();
  const seenUX = new Map<string, UXDesignItem>();
  const uniqueDesignData: DesignDisplayItem[] = [];

  for (const item of designData) {
    if (item.type === 'figma' || item.type === 'design_link') {
      const directKey = getDesignUrlDedupeKey(item.url);
      const existing = seenDirect.get(directKey);
      if (existing) {
        existing.title = chooseDesignTitle(existing.title, item.title, existing.source, item.source);
        existing.source = mergeDesignSources(existing.source, item.source);
        existing.label = existing.label || item.label;
        existing.status = existing.status || item.status;
        const updatedSelection = chooseDesignUpdatedAtWithSource(
          existing.updatedAt,
          existing.updatedAtSource,
          item.updatedAt,
          item.updatedAtSource,
        );
        existing.updatedAt = updatedSelection.value;
        existing.updatedAtSource = updatedSelection.source;
        continue;
      }

      seenDirect.set(directKey, item);
      uniqueDesignData.push(item);
      continue;
    }

    const uxKey = `${item.uxTicketKey}:${item.url ? getDesignUrlDedupeKey(item.url) : '__missing__'}`;
    const existing = seenUX.get(uxKey);
    if (existing) {
      const existingSource = existing.source;
      existing.source = mergeDesignSources(existing.source, item.source);
      existing.summary = chooseDesignTitle(existing.summary, item.summary, existingSource, item.source)
        || existing.summary
        || item.summary;
      existing.designLabel = chooseDesignTitle(existing.designLabel, item.designLabel, existingSource, item.source)
        || existing.designLabel
        || item.designLabel;
      existing.uxEpicKey = existing.uxEpicKey || item.uxEpicKey;
      existing.uxEpicStatus = existing.uxEpicStatus || item.uxEpicStatus;
      existing.uxEta = existing.uxEta || item.uxEta;
      existing.uxEtaSource = existing.uxEtaSource || item.uxEtaSource;
      existing.designStatus = existing.designStatus || item.designStatus;
      existing.keyRecoveryCandidateCount = Math.max(
        existing.keyRecoveryCandidateCount || 0,
        item.keyRecoveryCandidateCount || 0,
      ) || undefined;
      existing.keyRecoveryIgnoredCandidateCount = Math.max(
        existing.keyRecoveryIgnoredCandidateCount || 0,
        item.keyRecoveryIgnoredCandidateCount || 0,
      ) || undefined;
      existing.keyRecoveryIgnoredSourceCounts = mergeMaxUXTicketSourceCounts(
        existing.keyRecoveryIgnoredSourceCounts,
        item.keyRecoveryIgnoredSourceCounts,
      );
      const updatedSelection = chooseDesignUpdatedAtWithSource(
        existing.designUpdatedAt,
        existing.designUpdatedAtSource,
        item.designUpdatedAt,
        item.designUpdatedAtSource,
      );
      existing.designUpdatedAt = updatedSelection.value;
      existing.designUpdatedAtSource = updatedSelection.source;
      existing.uxTicketKeySource = existing.uxTicketKeySource || item.uxTicketKeySource;
      continue;
    }

    seenUX.set(uxKey, item);
    uniqueDesignData.push(item);
  }

  for (const item of uniqueDesignData) {
    if (item.type !== 'ux_ticket' || !item.url) continue;
    const matchingDirectItem = seenDirect.get(getDesignUrlDedupeKey(item.url));
    if (!matchingDirectItem) continue;

    const directDisplayTitle = isMeaningfulDesignTitle(matchingDirectItem.title)
      ? matchingDirectItem.title
      : matchingDirectItem.label;
    const existingSource = item.source;
    item.source = mergeDesignSources(item.source, matchingDirectItem.source);
    item.summary = chooseDesignTitle(item.summary, directDisplayTitle, existingSource, matchingDirectItem.source)
      || item.summary
      || directDisplayTitle;
    item.designLabel = chooseDesignTitle(item.designLabel, directDisplayTitle, existingSource, matchingDirectItem.source)
      || item.designLabel
      || matchingDirectItem.label;
    item.designStatus = item.designStatus || matchingDirectItem.status;
    const updatedSelection = chooseDesignUpdatedAtWithSource(
      item.designUpdatedAt,
      item.designUpdatedAtSource,
      matchingDirectItem.updatedAt,
      matchingDirectItem.updatedAtSource,
    );
    item.designUpdatedAt = updatedSelection.value;
    item.designUpdatedAtSource = updatedSelection.source;
    consumedDirectUrls.add(getDesignUrlDedupeKey(matchingDirectItem.url));
  }

  return uniqueDesignData.filter(item => {
    if (item.type !== 'figma' && item.type !== 'design_link') return true;
    return !consumedDirectUrls.has(getDesignUrlDedupeKey(item.url));
  });
}
