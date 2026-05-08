export type UXTicketReference = {
  key: string;
  summary: string;
  source: string;
};

export type FigmaDesignItem = {
  type: 'figma';
  url: string;
  source: string;
  title?: string;
  label?: string;
  status?: string;
};

export type DesignTool = 'figma' | 'miro' | 'loom' | 'google_slides' | 'generic';

export type DesignLinkCandidate = {
  url: string;
  tool: DesignTool;
  label: string;
  title?: string;
  status?: string;
  source?: string;
};

export type ExternalDesignItem = {
  type: 'design_link';
  url: string;
  source: string;
  tool: DesignTool;
  label: string;
  title?: string;
  status?: string;
};

export type UXDesignItem = {
  type: 'ux_ticket';
  url?: string;
  summary?: string;
  designLabel?: string;
  designStatus?: string;
  uxTicketKey: string;
  source: string;
  linkProvided: boolean;
  uxEpicKey?: string;
  uxEpicStatus?: string;
  uxEta?: string;
  uxEtaSource?: 'duedate' | 'fixVersion';
};

export type DesignDisplayItem = FigmaDesignItem | ExternalDesignItem | UXDesignItem;

export type UXEpicStatusTone = 'todo' | 'in-progress' | 'done' | 'blocked' | 'cancelled';
export type DesignStatusTone = 'ready' | 'updated' | 'missing' | 'not-ready' | 'blocked' | 'review' | 'done' | 'neutral';

const genericDesignTitles = new Set([
  'design',
  'the design',
  'design link',
  'figma',
  'figma design',
  'figma file',
  'figma link',
  'prototype',
  'figma prototype',
  'link',
  'here',
  'click here',
  'open link',
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

  const isMachineCase = expandedStatus !== trimmedStatus
    || /^[a-z\s]+$/.test(expandedStatus)
    || /^[A-Z\s]+$/.test(expandedStatus);

  if (!isMachineCase) {
    return trimmedStatus;
  }

  const sentenceStatus = expandedStatus.toLowerCase();
  return sentenceStatus.charAt(0).toUpperCase() + sentenceStatus.slice(1);
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
    /\bready\s+for\s+(dev|development|implementation|handoff)\b/,
    /\bready\s+to\s+(build|implement|start)\b/,
    /^ready$/,
  ])) {
    return 'ready';
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

export function sortDesignDisplayItems(items: DesignDisplayItem[]): DesignDisplayItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const priorityDiff = getDesignDisplayPriority(a.item) - getDesignDisplayPriority(b.item);
      if (priorityDiff !== 0) return priorityDiff;

      const sourceDiff = getItemSourcePriority(a.item) - getItemSourcePriority(b.item);
      if (sourceDiff !== 0) return sourceDiff;

      return a.index - b.index;
    })
    .map(entry => entry.item);
}

// pattern 格式: "UX*" 表示前缀匹配, "RCV" 表示完全匹配项目部分
export function matchesProjectPattern(ticketKey: string, pattern: string): boolean {
  if (!ticketKey || !pattern) return false;

  const projectPart = ticketKey.split('-')[0];
  if (!projectPart) return false;

  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return projectPart.startsWith(prefix);
  }

  return projectPart === pattern;
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

    const baseDomain = normalizedPattern.startsWith('*.')
      ? normalizedPattern.slice(2)
      : normalizedPattern;

    return normalizedHost === baseDomain || normalizedHost.endsWith(`.${baseDomain}`);
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
    return {
      url: normalizedUrl,
      tool: 'figma',
      label: getFigmaDisplayLabel(normalizedUrl)
    };
  }

  if (hostname === 'miro.com' || hostname.endsWith('.miro.com')) {
    return {
      url: normalizedUrl,
      tool: 'miro',
      label: 'Miro board'
    };
  }

  if (hostname === 'loom.com' || hostname.endsWith('.loom.com')) {
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

export function normalizeFigmaUrl(rawUrl?: string | null): string | null {
  const candidate = classifyDesignUrl(rawUrl);
  return candidate?.tool === 'figma' ? candidate.url : null;
}

export function getFigmaDisplayLabel(url: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.includes('/proto/')) return 'Figma Prototype';
    if (pathname.includes('/board/') || pathname.includes('/figjam/')) return 'FigJam Board';
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
  if (!rawValue || typeof rawValue !== 'string') return [];

  const matches = rawValue.match(/https?:\/\/[^\s<>"']+/g) || [];
  const valuesToCheck = matches.length > 0 ? matches : [rawValue];
  const seenUrls = new Set<string>();
  const designLinks: DesignLinkCandidate[] = [];

  for (const value of valuesToCheck) {
    const candidate = classifyDesignUrl(value, allowGeneric, extraDomainPatterns);
    if (!candidate || seenUrls.has(candidate.url)) continue;
    seenUrls.add(candidate.url);
    designLinks.push(candidate);
  }

  return designLinks;
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
    .map(item => sourceLabels[item] || item.replace(/_/g, ' '))
    .join(', ');
}

export function dedupeDesignData(designData: DesignDisplayItem[]): DesignDisplayItem[] {
  const consumedDirectUrls = new Set<string>();
  const seenDirect = new Map<string, FigmaDesignItem | ExternalDesignItem>();
  const seenUX = new Map<string, UXDesignItem>();
  const uniqueDesignData: DesignDisplayItem[] = [];

  for (const item of designData) {
    if (item.type === 'figma' || item.type === 'design_link') {
      const existing = seenDirect.get(item.url);
      if (existing) {
        existing.title = chooseDesignTitle(existing.title, item.title, existing.source, item.source);
        existing.source = mergeDesignSources(existing.source, item.source);
        existing.label = existing.label || item.label;
        existing.status = existing.status || item.status;
        continue;
      }

      seenDirect.set(item.url, item);
      uniqueDesignData.push(item);
      continue;
    }

    const uxKey = `${item.uxTicketKey}:${item.url || '__missing__'}`;
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
      continue;
    }

    seenUX.set(uxKey, item);
    uniqueDesignData.push(item);
  }

  for (const item of uniqueDesignData) {
    if (item.type !== 'ux_ticket' || !item.url) continue;
    const matchingDirectItem = seenDirect.get(item.url);
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
    consumedDirectUrls.add(matchingDirectItem.url);
  }

  return uniqueDesignData.filter(item => {
    if (item.type !== 'figma' && item.type !== 'design_link') return true;
    return !consumedDirectUrls.has(item.url);
  });
}
