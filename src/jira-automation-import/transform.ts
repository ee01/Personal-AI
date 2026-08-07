export const JIRA_AUTOMATION_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const JIRA_AUTOMATION_IMPORT_MAX_RULE_NAME_LENGTH = 255;
export const JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER = 'PERSONAL_AI_REENTER_SECRET';
const JIRA_AUTOMATION_IMPORT_RULE_NAME_PREFIX = '(Imported by Personal AI) ';
const JIRA_AUTOMATION_IMPORT_REVIEW_NOTE_HEADING = 'Personal AI import review';

export interface ExportedRule {
  id?: number;
  clientKey?: string;
  name: string;
  state: string;
  description?: string;
  canOtherRuleTrigger?: boolean;
  notifyOnError?: string;
  authorAccountId?: string;
  actorAccountId?: string;
  created?: number;
  updated?: number;
  trigger: any;
  components: any[];
  projects?: Array<{
    projectId: string;
    projectKey?: string;
    key?: string;
    name?: string;
    projectTypeKey?: string;
  }>;
  labels?: any[];
  tags?: any[];
}

export interface ExportedData {
  rules: ExportedRule[];
  cloud?: boolean;
}

export interface ImportRule {
  name: string;
  isNewRule: boolean;
  state: string;
  canOtherRuleTrigger: boolean;
  notifyOnError: string;
  authorAccountId: string;
  actorAccountId: string;
  created: number;
  updated: number;
  components: any[];
  trigger: any;
  labels: any[];
  description?: string;
  projects: Array<{
    projectId: string;
    projectTypeKey: string;
  }>;
}

export interface ImportRuleContext {
  projectId: string;
  projectKey?: string;
  projectTypeKey?: string;
  ownerId?: string;
  allowOtherRuleTrigger?: boolean;
  disableAfterImport?: boolean;
  /**
   * When true (default), scrub secret/sensitive payloads before create.
   * When false, preserve source sensitive values in the imported rule payload.
   */
  replaceSensitiveValues?: boolean;
  existingRuleNames?: string[];
  nameCheck?: JiraAutomationImportNameCheck;
  createStageAcknowledgement?: JiraAutomationImportCreateStageAcknowledgement;
  sourceCloud?: boolean;
  now?: number;
}

export function shouldReplaceJiraAutomationImportSensitiveValues(
  context: Pick<ImportRuleContext, 'replaceSensitiveValues'> | boolean | undefined,
): boolean {
  if (typeof context === 'boolean') {
    return context;
  }

  return context?.replaceSensitiveValues !== false;
}

export interface JiraAutomationRuleSummary {
  componentCount: number;
  actionCount: number;
  conditionCount: number;
  branchCount: number;
  webRequestCount: number;
  externalIntegrationCount: number;
  secretReferenceCount: number;
  jqlReferenceCount: number;
  hardcodedUrlCount: number;
  emailReferenceCount: number;
  accountReferenceCount: number;
  customFieldReferenceCount: number;
  savedFilterReferenceCount: number;
  connectionReferenceCount: number;
  sensitiveReferenceCount: number;
  sourceProjectReferenceCount: number;
  smartValueReferenceCount: number;
  customComponentCount: number;
  scheduledTrigger: boolean;
}

export interface JiraAutomationRuleReviewSignals {
  jqlReferences: string[];
  hardcodedUrls: string[];
  secretReferences: string[];
  emailReferences: string[];
  accountReferences: string[];
  customFieldReferences: string[];
  savedFilterReferences: string[];
  connectionReferences: string[];
  sensitiveReferences: string[];
  sourceProjectReferences: string[];
  smartValueReferences: string[];
  customComponentReferences: string[];
}

export type JiraAutomationImportReviewSeverity = 'high' | 'medium' | 'low';

export interface JiraAutomationImportReviewChecklistItem {
  id: string;
  label: string;
  detail: string;
  severity: JiraAutomationImportReviewSeverity;
}

export interface JiraAutomationImportReviewFinding {
  id: string;
  label: string;
  count: number;
  samples: string[];
  severity: JiraAutomationImportReviewSeverity;
}

export interface JiraAutomationImportEnablementStep {
  id: string;
  label: string;
  detail: string;
  severity: JiraAutomationImportReviewSeverity;
}

export interface JiraAutomationImportSecretReentrySlot {
  path: string;
  label: string;
  reason: string;
}

export type JiraAutomationImportSecretReentryQueueGroupId =
  | 'hidden-jira-secrets'
  | 'url-credentials'
  | 'inline-secret-text'
  | 'named-credential-fields'
  | 'other-redacted-fields';

export interface JiraAutomationImportSecretReentryQueueGroup {
  id: JiraAutomationImportSecretReentryQueueGroupId;
  label: string;
  action: string;
  slots: JiraAutomationImportSecretReentrySlot[];
}

export type JiraAutomationImportNameCheckStatus = 'confirmed' | 'unconfirmed';

export interface JiraAutomationImportNameCheck {
  status: JiraAutomationImportNameCheckStatus;
  checkedRuleCount?: number;
  failureReason?: string;
}

export interface JiraAutomationImportCreateStageAcknowledgement {
  required?: boolean;
  completed?: boolean;
}

export interface JiraAutomationImportReviewPacketContext extends ImportRuleContext {
  importedRuleName?: string;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeReviewSignal(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 180) {
    return normalized;
  }
  return `${normalized.slice(0, 177)}...`;
}

function safeDecodeUrlSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isLikelyWebhookUrlHost(hostname: string): boolean {
  return /(hook|webhook|slack|discord|teams|outlook|office|zapier|make|ifttt)/i.test(hostname);
}

function isLikelySensitiveUrlPathSegment(rawSegment: string, hostname: string): boolean {
  const segment = safeDecodeUrlSegment(rawSegment).trim();
  if (!segment || segment === 'REDACTED') {
    return false;
  }

  if (isMaskedSensitiveValue(segment)) {
    return true;
  }

  const compact = segment.replace(/[^A-Za-z0-9_-]/g, '');
  const hasLetter = /[A-Za-z]/.test(compact);
  const hasDigit = /\d/.test(compact);
  const hasUpper = /[A-Z]/.test(compact);
  const hasLower = /[a-z]/.test(compact);
  const isUuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(segment);
  const isLongHex = /^[a-f0-9]{32,}$/i.test(segment);
  const isLongToken = /^[A-Za-z0-9_-]{20,}$/.test(segment) && hasLetter && (hasDigit || (hasUpper && hasLower));
  const isWebhookPathToken = isLikelyWebhookUrlHost(hostname) &&
    /^[A-Za-z0-9_-]{8,}$/.test(segment) &&
    hasLetter &&
    hasDigit;

  return isUuid || isLongHex || isLongToken || isWebhookPathToken;
}

function isLikelySecretTokenValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'REDACTED' || isMaskedSensitiveValue(trimmed)) {
    return isMaskedSensitiveValue(trimmed);
  }

  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) {
    return true;
  }

  if (/^(gh[pousr]_|github_pat_|sk-|xox[abprs]-|AKIA|ASIA|AIza)[A-Za-z0-9._-]{8,}/.test(trimmed)) {
    return true;
  }

  const compact = trimmed.replace(/[^A-Za-z0-9_-]/g, '');
  const hasLetter = /[A-Za-z]/.test(compact);
  const hasDigit = /\d/.test(compact);
  const hasMixedCase = /[A-Z]/.test(compact) && /[a-z]/.test(compact);
  return compact.length >= 32 && hasLetter && (hasDigit || hasMixedCase);
}

function redactSensitiveUrlPathname(pathname: string, hostname: string): { pathname: string; redacted: boolean } {
  let redacted = false;
  const nextPathname = pathname
    .split('/')
    .map((segment) => {
      if (!segment || !isLikelySensitiveUrlPathSegment(segment, hostname)) {
        return segment;
      }

      redacted = true;
      return 'REDACTED';
    })
    .join('/');

  return { pathname: nextPathname, redacted };
}

function redactSensitiveUrl(rawUrl: string): string {
  try {
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.username) {
      parsedUrl.username = 'REDACTED';
    }
    if (parsedUrl.password) {
      parsedUrl.password = 'REDACTED';
    }

    parsedUrl.searchParams.forEach((value, key) => {
      if (
        isLikelySensitiveUrlQueryKey(key) ||
        isMaskedSensitiveValue(value) ||
        isLikelySecretTokenValue(value)
      ) {
        parsedUrl.searchParams.set(key, 'REDACTED');
      }
    });

    if (parsedUrl.hash && /(authorization|bearer|password|secret|token|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token)/i.test(parsedUrl.hash)) {
      parsedUrl.hash = '#REDACTED';
    }

    const redactedPath = redactSensitiveUrlPathname(parsedUrl.pathname, parsedUrl.hostname);
    if (redactedPath.redacted) {
      parsedUrl.pathname = redactedPath.pathname;
    }

    return parsedUrl.toString();
  } catch {
    return rawUrl.replace(
      /([?&][^=&#]*(?:authorization|bearer|password|secret|token|jwt|assertion|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|id[-_ ]?token|session[-_ ]?token|oauth[-_ ]?token|client[-_ ]?assertion|code|function[-_ ]?key|subscription[-_ ]?key|ocp[-_ ]?apim[-_ ]?subscription[-_ ]?key|sas[-_ ]?token|shared[-_ ]?access[-_ ]?key)[^=&#]*=)[^&#]*/gi,
      '$1REDACTED',
    );
  }
}

function addSensitiveUrlReferences(rawUrl: string, values: Set<string>): void {
  try {
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.username || parsedUrl.password) {
      addSensitiveReference(values, 'URL credentials', false);
    }

    parsedUrl.searchParams.forEach((value, key) => {
      if (
        isLikelySensitiveUrlQueryKey(key) ||
        isMaskedSensitiveValue(value) ||
        isLikelySecretTokenValue(value)
      ) {
        addSensitiveReference(values, `URL query ${key}`, isMaskedSensitiveValue(value));
      }
    });

    if (redactSensitiveUrlPathname(parsedUrl.pathname, parsedUrl.hostname).redacted) {
      addSensitiveReference(values, 'URL path segment', false);
    }

    if (parsedUrl.hash && /(authorization|bearer|password|secret|token|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token)/i.test(parsedUrl.hash)) {
      addSensitiveReference(values, 'URL fragment', false);
    }
  } catch {
    const matches = rawUrl.match(/[?&]([^=&#]*(?:authorization|bearer|password|secret|token|jwt|assertion|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|id[-_ ]?token|session[-_ ]?token|oauth[-_ ]?token|client[-_ ]?assertion|code|function[-_ ]?key|subscription[-_ ]?key|ocp[-_ ]?apim[-_ ]?subscription[-_ ]?key|sas[-_ ]?token|shared[-_ ]?access[-_ ]?key)[^=&#]*)=/gi) || [];
    matches.forEach((match) => {
      const key = match.replace(/^[?&]/, '').replace(/=$/, '');
      addSensitiveReference(values, `URL query ${key}`, false);
    });
  }
}

function redactSensitiveUrlsInText(text: string): string {
  return text.replace(/https?:\/\/[^\s"'<>]+/gi, (url) => redactSensitiveUrl(url));
}

function redactHighEntropyTokenLikeText(text: string, replacement = 'REDACTED'): string {
  return text.replace(/\b[A-Za-z0-9_-]{10,}\b/g, (token, offset, fullText) => {
    const nextChar = fullText[offset + token.length] || '';
    const previousChar = offset > 0 ? fullText[offset - 1] : '';
    if ((nextChar === '=' || nextChar === ':') && (!previousChar || /[?&#\s"'([{,]/.test(previousChar))) {
      return token;
    }

    if (/[-_\d]/.test(token) && /(secret|token|password|api[-_]?key)/i.test(token)) {
      return replacement;
    }

    const hasLetter = /[A-Za-z]/.test(token);
    const hasDigit = /\d/.test(token);
    const hasMixedCase = /[A-Z]/.test(token) && /[a-z]/.test(token);
    if (token.length >= 24 && hasLetter && (hasDigit || hasMixedCase)) {
      return replacement;
    }

    return token;
  });
}

function redactInlineSecretText(text: string, replacement = 'REDACTED'): string {
  return redactHighEntropyTokenLikeText(
    redactSensitiveUrlsInText(text)
      .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{6,}/gi, (_match, scheme) => `${scheme} ${replacement}`)
      .replace(
        /((?:"|')?(?:authorizationHeader|apiToken|api[-_ ]?key|x[-_ ]?api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|id[-_ ]?token|session[-_ ]?token|oauth[-_ ]?token|client[-_ ]?secret|client[-_ ]?assertion|private[-_ ]?key|keyOrValue|rawValue|secretValue|password|passwd|secret|token|jwt|assertion)(?:"|')?\s*[:=]\s*(?:"|')?)([^"',\s}\]<&#]+)/gi,
        (match, prefix, secretValue) => (secretValue === 'REDACTED' ? match : `${prefix}${replacement}`),
      ),
    replacement,
  );
}

export function redactJiraAutomationImportErrorText(value: unknown): string {
  const rawText = value instanceof Error
    ? value.message
    : typeof value === 'string'
      ? value
      : String(value ?? '');

  const redacted = redactInlineSecretText(rawText)
    .replace(/(?<![:/@])\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, 'REDACTED_EMAIL');

  return redacted.length <= 2000 ? redacted : `${redacted.slice(0, 1997)}...`;
}

export function sanitizeJiraAutomationImportDisplayText(value: string): string {
  return redactInlineSecretText(value);
}

function sanitizeJiraAutomationImportName(value: string, replaceSensitiveValues = true): string {
  const prepared = replaceSensitiveValues
    ? sanitizeJiraAutomationImportDisplayText(value)
    : value;
  return prepared.replace(/\s+/g, ' ').trim() || 'Imported Jira Automation rule';
}

function normalizeRuleNameForComparison(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function buildImportedRuleNameWithSuffix(
  sourceName: string,
  suffix: string,
  replaceSensitiveValues = true,
): string {
  const normalizedName = sanitizeJiraAutomationImportName(sourceName, replaceSensitiveValues);
  const maxSourceNameLength = Math.max(
    0,
    JIRA_AUTOMATION_IMPORT_MAX_RULE_NAME_LENGTH
      - JIRA_AUTOMATION_IMPORT_RULE_NAME_PREFIX.length
      - suffix.length,
  );
  const truncatedSourceName = normalizedName.length <= maxSourceNameLength
    ? normalizedName
    : `${normalizedName.slice(0, Math.max(0, maxSourceNameLength - 3))}...`;

  return `${JIRA_AUTOMATION_IMPORT_RULE_NAME_PREFIX}${truncatedSourceName}${suffix}`;
}

function normalizeNameCheck(context: ImportRuleContext): JiraAutomationImportNameCheck | undefined {
  if (context.nameCheck) {
    return context.nameCheck;
  }

  if (Array.isArray(context.existingRuleNames)) {
    return {
      status: 'confirmed',
      checkedRuleCount: context.existingRuleNames.length,
    };
  }

  return undefined;
}

export function buildJiraAutomationImportNameCheckReceipt(
  exportedRule: ExportedRule,
  context: ImportRuleContext,
  importedRuleName = buildJiraAutomationUniqueImportedRuleName(
    exportedRule.name,
    context.existingRuleNames,
    shouldReplaceJiraAutomationImportSensitiveValues(context),
  ),
): string {
  const nameCheck = normalizeNameCheck(context);
  const defaultImportedRuleName = buildJiraAutomationImportedRuleName(
    exportedRule.name,
    shouldReplaceJiraAutomationImportSensitiveValues(context),
  );
  const importedNameWasNumbered = importedRuleName !== defaultImportedRuleName;

  if (nameCheck?.status === 'confirmed') {
    const checkedRuleCount = nameCheck.checkedRuleCount ?? context.existingRuleNames?.length ?? 0;
    return importedNameWasNumbered
      ? `Name collision check: confirmed against ${checkedRuleCount} target rule(s); the default imported name already existed, so Personal AI selected "${importedRuleName}".`
      : `Name collision check: confirmed against ${checkedRuleCount} target rule(s); no existing imported copy name matched at preview time.`;
  }

  if (nameCheck?.status === 'unconfirmed') {
    const failureReason = nameCheck.failureReason
      ? ` Reason: ${redactJiraAutomationImportErrorText(nameCheck.failureReason)}.`
      : '';
    return `Name collision check: not confirmed.${failureReason} Personal AI could not read the target rule list, so "${importedRuleName}" is a best-effort disabled-copy name; check Jira for an existing or newly created disabled copy before retrying or enabling.`;
  }

  return `Name collision check: not recorded for this handoff; confirm "${importedRuleName}" in Jira before enabling.`;
}

function formatChecklistSeveritySummary(items: JiraAutomationImportReviewChecklistItem[]): string {
  const parts: string[] = [];
  (['high', 'medium', 'low'] as const).forEach((severity) => {
    const labels = items
      .filter((item) => item.severity === severity)
      .map((item) => item.label);
    if (labels.length > 0) {
      parts.push(`${severity}: ${labels.join(', ')}`);
    }
  });

  return parts.join('; ') || 'standard Jira Automation compatibility and permission checks';
}

function formatHighRiskGateSummary(items: JiraAutomationImportReviewChecklistItem[]): string {
  const highRiskItems = items.filter((item) => item.severity === 'high');
  if (highRiskItems.length === 0) {
    return 'not required for disabled-copy creation; no high-risk checks were detected';
  }

  const visibleLabels = highRiskItems.slice(0, 4).map((item) => item.label);
  const hiddenCount = Math.max(0, highRiskItems.length - visibleLabels.length);
  const labelsText = [
    visibleLabels.join(', '),
    hiddenCount > 0 ? `${hiddenCount} more` : '',
  ].filter(Boolean).join(', ');

  return `no checkbox required before disabled-copy creation; Jira-side review remains open before enablement: ${highRiskItems.length} high-risk item(s): ${labelsText}`;
}

function formatCreateStageAcknowledgementSummary(
  items: JiraAutomationImportReviewChecklistItem[],
  context: ImportRuleContext,
): string {
  const highRiskItems = items.filter((item) => item.severity === 'high');
  if (highRiskItems.length === 0) {
    return 'not required; no high-risk create-stage gate was needed before disabled-copy creation';
  }

  if (context.createStageAcknowledgement?.completed === true) {
    return 'checked in Personal AI preview only to create this disabled copy; Jira-side Activation plan review remains open before enablement';
  }

  if (context.createStageAcknowledgement?.required === true) {
    return 'required for this disabled-copy creation but not recorded as completed in this handoff; Jira-side Activation plan review remains open before enablement';
  }

  return 'not required before disabled-copy creation; Personal AI preview showed high-risk review items, and disabled-copy creation is not enablement approval';
}

function formatDetectedReferenceSummary(summary: JiraAutomationRuleSummary): string {
  const parts = [
    summary.customComponentCount > 0 ? `${summary.customComponentCount} custom/app component` : '',
    summary.jqlReferenceCount > 0 ? `${summary.jqlReferenceCount} JQL/filter` : '',
    summary.customFieldReferenceCount > 0 ? `${summary.customFieldReferenceCount} custom field` : '',
    summary.savedFilterReferenceCount > 0 ? `${summary.savedFilterReferenceCount} saved filter` : '',
    summary.hardcodedUrlCount > 0 ? `${summary.hardcodedUrlCount} URL` : '',
    summary.secretReferenceCount > 0 ? `${summary.secretReferenceCount} secret` : '',
    summary.connectionReferenceCount > 0 ? `${summary.connectionReferenceCount} connection/credential` : '',
    summary.sensitiveReferenceCount > 0 ? `${summary.sensitiveReferenceCount} sensitive or hidden value` : '',
    summary.accountReferenceCount + summary.emailReferenceCount > 0
      ? `${summary.accountReferenceCount + summary.emailReferenceCount} account/recipient`
      : '',
    summary.sourceProjectReferenceCount > 0 ? `${summary.sourceProjectReferenceCount} source project reference` : '',
    summary.smartValueReferenceCount > 0 ? `${summary.smartValueReferenceCount} smart value` : '',
  ].filter(Boolean);

  return parts.join(', ') || 'no environment-bound references or custom components detected';
}

export function formatJiraAutomationImportSourceFormat(sourceCloud?: boolean): string {
  if (sourceCloud === true) {
    return 'Jira Cloud export (cloud=true)';
  }

  if (sourceCloud === false) {
    return 'Jira Server/Data Center export (cloud=false)';
  }

  return 'Unknown Jira Automation export format';
}

function getSourceFormatCompatibilityParts(summary: JiraAutomationRuleSummary): string[] {
  return [
    summary.webRequestCount > 0 ? `${summary.webRequestCount} web request(s)` : '',
    summary.externalIntegrationCount > 0 ? `${summary.externalIntegrationCount} external action(s)` : '',
    summary.customComponentCount > 0 ? `${summary.customComponentCount} custom/app component type(s)` : '',
    summary.secretReferenceCount > 0 ? `${summary.secretReferenceCount} secret reference(s)` : '',
    summary.connectionReferenceCount > 0 ? `${summary.connectionReferenceCount} connection/credential reference(s)` : '',
    summary.sensitiveReferenceCount > 0 ? `${summary.sensitiveReferenceCount} sensitive or hidden value reference(s)` : '',
  ].filter(Boolean);
}

function getSourceFormatCompatibilitySeverity(
  summary: JiraAutomationRuleSummary,
): JiraAutomationImportReviewSeverity {
  return getSourceFormatCompatibilityParts(summary).length > 0 ? 'high' : 'medium';
}

function buildSourceFormatCompatibilityDetail(
  summary: JiraAutomationRuleSummary,
): string {
  const parts = getSourceFormatCompatibilityParts(summary);
  const sensitivePieces = parts.length > 0
    ? `${parts.join(', ')} may use edition-specific JSON. `
    : '';

  return `${sensitivePieces}The source file is marked cloud=false; confirm source/target Jira Automation edition and version before enabling, and rebuild incompatible Send web request headers, app components, or credentials in the target rule if Jira drops or rejects them.`;
}

function createReviewFinding(
  id: string,
  label: string,
  count: number,
  samples: string[],
  severity: JiraAutomationImportReviewSeverity,
): JiraAutomationImportReviewFinding | null {
  if (count <= 0) {
    return null;
  }

  return {
    id,
    label,
    count,
    samples: samples.slice(0, 3),
    severity,
  };
}

function formatReviewFindingSamplesForNote(finding: JiraAutomationImportReviewFinding): string {
  const visibleSamples = finding.samples.slice(0, 2);
  const sampleText = visibleSamples.join(' | ');
  const moreCount = Math.max(0, finding.count - visibleSamples.length);
  const moreText = moreCount > 0 ? `, ${moreCount} more` : '';
  return sampleText
    ? `${finding.label} (${finding.count}): ${sampleText}${moreText}`
    : `${finding.label} (${finding.count})`;
}

function formatReviewFindingsForNote(findings: JiraAutomationImportReviewFinding[]): string {
  if (findings.length === 0) {
    return 'none';
  }

  const value = findings
    .slice(0, 8)
    .map(formatReviewFindingSamplesForNote)
    .join('; ');

  if (value.length <= 900) {
    return value;
  }

  return `${value.slice(0, 897)}...`;
}

function formatReviewPacketFinding(finding: JiraAutomationImportReviewFinding): string {
  const samples = finding.samples.length > 0
    ? finding.samples.join(' | ')
    : 'Review the rule component that owns this binding.';
  const hiddenSampleCount = Math.max(0, finding.count - finding.samples.length);
  const suffix = hiddenSampleCount > 0 ? `, ${hiddenSampleCount} more` : '';
  return `- [${finding.severity.toUpperCase()}] ${finding.label} (${finding.count}): ${samples}${suffix}`;
}

function formatReviewPacketChecklistItem(item: JiraAutomationImportReviewChecklistItem): string {
  return `- [${item.severity.toUpperCase()}] ${item.label}: ${item.detail}`;
}

function formatReviewPacketEnablementStep(step: JiraAutomationImportEnablementStep): string {
  return `- [${step.severity.toUpperCase()}] ${step.label}: ${step.detail}`;
}

function formatEnablementPlanSummary(steps: JiraAutomationImportEnablementStep[]): string {
  if (steps.length === 0) {
    return 'keep imported copy disabled until Jira review is complete';
  }

  const maxStepCount = steps.length >= 6 ? 6 : 5;
  const maxDetailLength = steps.length >= 6 ? 95 : steps.length >= 5 ? 120 : 170;
  const value = steps
    .slice(0, maxStepCount)
    .map((step) => {
      const detail = step.detail.length <= maxDetailLength
        ? step.detail
        : `${step.detail.slice(0, Math.max(0, maxDetailLength - 3))}...`;
      return `${step.label}: ${detail}`;
    })
    .join('; ');

  if (value.length <= 900) {
    return value;
  }

  return `${value.slice(0, 897)}...`;
}

function getHiddenSecretReferences(exportedRule: ExportedRule): string[] {
  return collectJiraAutomationImportReviewSignals(exportedRule)
    .secretReferences
    .filter((reference) => /\bhidden secret value\b/i.test(reference));
}

function formatHiddenSecretReferenceSummary(hiddenSecretReferences: string[]): string {
  const visibleReferences = hiddenSecretReferences.slice(0, 3).join(' | ');
  const hiddenCount = Math.max(0, hiddenSecretReferences.length - 3);
  return [
    visibleReferences,
    hiddenCount > 0 ? `${hiddenCount} more` : '',
  ].filter(Boolean).join(', ');
}

function formatSecretReentrySlot(slot: JiraAutomationImportSecretReentrySlot): string {
  return `${slot.path}${slot.label ? ` (${slot.label})` : ''}: ${slot.reason}`;
}

const SECRET_REENTRY_QUEUE_GROUPS: Array<{
  id: JiraAutomationImportSecretReentryQueueGroupId;
  label: string;
  action: string;
}> = [
  {
    id: 'hidden-jira-secrets',
    label: 'Hidden Jira secrets',
    action: 'Re-enter or recreate the masked Jira secret fields in the imported rule.',
  },
  {
    id: 'url-credentials',
    label: 'URL and signed-query credentials',
    action: 'Regenerate signed URLs, webhook tokens, function keys, or API gateway query credentials for the target environment.',
  },
  {
    id: 'inline-secret-text',
    label: 'Inline secret-like text',
    action: 'Check whether the text still needs a credential; restore only the target-safe value or leave the placeholder.',
  },
  {
    id: 'named-credential-fields',
    label: 'Named credential fields',
    action: 'Re-enter target API keys, JWT/client assertions, Authorization headers, or password/token fields.',
  },
  {
    id: 'other-redacted-fields',
    label: 'Other redacted fields',
    action: 'Review these placeholders in Jira before enabling.',
  },
];

function classifySecretReentrySlot(
  slot: JiraAutomationImportSecretReentrySlot,
): JiraAutomationImportSecretReentryQueueGroupId {
  if (/Hidden Jira secret container/i.test(slot.reason)) {
    return 'hidden-jira-secrets';
  }

  if (/URL credential|sensitive query|fragment|token-like path/i.test(slot.reason)) {
    return 'url-credentials';
  }

  if (/Inline secret-like text/i.test(slot.reason)) {
    return 'inline-secret-text';
  }

  if (/Credential field/i.test(slot.reason)) {
    return 'named-credential-fields';
  }

  return 'other-redacted-fields';
}

export function buildJiraAutomationImportSecretReentryQueueGroups(
  slots: JiraAutomationImportSecretReentrySlot[],
): JiraAutomationImportSecretReentryQueueGroup[] {
  const groupedSlots = new Map<JiraAutomationImportSecretReentryQueueGroupId, JiraAutomationImportSecretReentrySlot[]>();

  slots.forEach((slot) => {
    const groupId = classifySecretReentrySlot(slot);
    const groupSlots = groupedSlots.get(groupId) || [];
    groupSlots.push(slot);
    groupedSlots.set(groupId, groupSlots);
  });

  return SECRET_REENTRY_QUEUE_GROUPS
    .map((group) => ({
      ...group,
      slots: groupedSlots.get(group.id) || [],
    }))
    .filter((group) => group.slots.length > 0);
}

export function formatJiraAutomationImportSecretReentryQueue(
  slots: JiraAutomationImportSecretReentrySlot[],
  maxSlotsPerGroup = 3,
): string {
  if (slots.length === 0) {
    return 'Credential re-entry queue: no redacted credential slots were detected for this disabled copy.';
  }

  const groups = buildJiraAutomationImportSecretReentryQueueGroups(slots);
  const groupText = groups.map((group) => {
    const visibleSlots = group.slots.slice(0, maxSlotsPerGroup).map((slot) => (
      `${slot.path}${slot.label ? ` (${slot.label})` : ''}`
    ));
    const hiddenCount = Math.max(0, group.slots.length - visibleSlots.length);
    const suffix = hiddenCount > 0 ? `, ${hiddenCount} more` : '';
    return `${group.label} (${group.slots.length}): ${visibleSlots.join(' | ')}${suffix}. ${group.action}`;
  });

  return [
    `Credential re-entry queue: ${groups.length} group(s) from ${slots.length} redacted slot(s).`,
    ...groupText,
    'Create can continue, but before enabling in Jira rebuild, re-enter, or intentionally leave blank only the required target fields; placeholders are not working credentials.',
  ].join(' ');
}

export function formatJiraAutomationImportSecretReentrySummary(
  slots: JiraAutomationImportSecretReentrySlot[],
  maxSlots = 4,
): string {
  if (slots.length === 0) {
    return 'No secret-bearing fields were replaced or redacted in the disabled copy.';
  }

  const visibleSlots = slots.slice(0, maxSlots).map((slot) => (
    `${slot.path}${slot.label ? ` (${slot.label})` : ''}`
  ));
  const hiddenCount = Math.max(0, slots.length - visibleSlots.length);
  return `${slots.length} slot(s): ${visibleSlots.join(' | ')}${hiddenCount > 0 ? `, ${hiddenCount} more` : ''}`;
}

export function buildJiraAutomationImportCredentialRestoreGateSummary(
  slots: JiraAutomationImportSecretReentrySlot[],
  replaceSensitiveValues = true,
): string {
  if (!shouldReplaceJiraAutomationImportSensitiveValues(replaceSensitiveValues)) {
    return [
      'Credential restore gate: skipped by user choice; sensitive values will be preserved in the create payload.',
      'Confirm the preserved secrets are intended for the target project before enabling.',
    ].join(' ');
  }

  if (slots.length === 0) {
    return 'Credential restore gate: no redacted credential slot was detected in this import, but external connections still need ordinary Jira review before enabling.';
  }

  return [
    `Credential restore gate: open before enablement; ${formatJiraAutomationImportSecretReentrySummary(slots, 3)}.`,
    'The disabled copy only contains PERSONAL_AI_REENTER_SECRET or REDACTED placeholders, so re-enter or intentionally leave these fields blank in Jira before enabling.',
  ].join(' ');
}

export function buildJiraAutomationImportEnablementPlan(
  exportedRule: ExportedRule,
  sourceCloud?: boolean,
  replaceSensitiveValues = true,
): JiraAutomationImportEnablementStep[] {
  const summary = summarizeJiraAutomationImportRule(exportedRule);
  const hiddenSecretReferences = getHiddenSecretReferences(exportedRule);
  const secretReentrySlots = shouldReplaceJiraAutomationImportSensitiveValues(replaceSensitiveValues)
    ? collectJiraAutomationImportSecretReentrySlots(exportedRule)
    : [];
  const steps: JiraAutomationImportEnablementStep[] = [
    {
      id: 'keep-disabled',
      label: 'Keep the imported copy disabled',
      detail: 'Create the rule as a disabled copy and finish the review below before turning it on in Jira.',
      severity: 'low',
    },
  ];

  if (sourceCloud === false) {
    steps.push({
      id: 'confirm-source-format',
      label: 'Confirm source-format compatibility',
      detail: buildSourceFormatCompatibilityDetail(summary),
      severity: getSourceFormatCompatibilitySeverity(summary),
    });
  }

  if (
    summary.sourceProjectReferenceCount > 0 ||
    summary.jqlReferenceCount > 0 ||
    summary.customFieldReferenceCount > 0 ||
    summary.savedFilterReferenceCount > 0
  ) {
    const parts = [
      summary.sourceProjectReferenceCount > 0 ? `${summary.sourceProjectReferenceCount} source project reference(s)` : '',
      summary.jqlReferenceCount > 0 ? `${summary.jqlReferenceCount} JQL/filter reference(s)` : '',
      summary.customFieldReferenceCount > 0 ? `${summary.customFieldReferenceCount} custom field reference(s)` : '',
      summary.savedFilterReferenceCount > 0 ? `${summary.savedFilterReferenceCount} saved filter reference(s)` : '',
    ].filter(Boolean);
    steps.push({
      id: 'map-target-search',
      label: 'Map target-project search dependencies',
      detail: `${parts.join(', ')} need target-project validation because project scope remapping does not rewrite embedded query or field values.`,
      severity: 'high',
    });
  }

  if (
    summary.webRequestCount > 0 ||
    summary.externalIntegrationCount > 0 ||
    summary.hardcodedUrlCount > 0 ||
    summary.secretReferenceCount > 0 ||
    summary.connectionReferenceCount > 0 ||
    summary.sensitiveReferenceCount > 0 ||
    summary.emailReferenceCount > 0 ||
    summary.accountReferenceCount > 0
  ) {
    const parts = [
      summary.webRequestCount > 0 ? `${summary.webRequestCount} web request(s)` : '',
      summary.externalIntegrationCount > 0 ? `${summary.externalIntegrationCount} external action(s)` : '',
      summary.hardcodedUrlCount > 0 ? `${summary.hardcodedUrlCount} URL(s)` : '',
      summary.secretReferenceCount > 0 ? `${summary.secretReferenceCount} secret reference(s)` : '',
      summary.connectionReferenceCount > 0 ? `${summary.connectionReferenceCount} connection/credential reference(s)` : '',
      summary.sensitiveReferenceCount > 0 ? `${summary.sensitiveReferenceCount} sensitive value reference(s)` : '',
      summary.emailReferenceCount + summary.accountReferenceCount > 0
        ? `${summary.emailReferenceCount + summary.accountReferenceCount} account/recipient reference(s)`
        : '',
    ].filter(Boolean);
    const preserveSensitiveDetail = !shouldReplaceJiraAutomationImportSensitiveValues(replaceSensitiveValues)
      ? 'Sensitive values will be preserved in the create payload by user choice; confirm they are intended for the target project. '
      : '';
    const hiddenSecretDetail = secretReentrySlots.length > 0
      ? `Secret re-entry map: ${formatJiraAutomationImportSecretReentrySummary(secretReentrySlots)}. `
      : hiddenSecretReferences.length > 0 && shouldReplaceJiraAutomationImportSensitiveValues(replaceSensitiveValues)
        ? `Hidden secret fields to re-enter: ${formatHiddenSecretReferenceSummary(hiddenSecretReferences)}. `
      : '';
    const credentialQueueDetail = secretReentrySlots.length > 0
      ? `${formatJiraAutomationImportSecretReentryQueue(secretReentrySlots, 2)} `
      : '';
    steps.push({
      id: 'reconnect-external-effects',
      label: 'Reconnect external effects and credentials',
      detail: `${preserveSensitiveDetail}${hiddenSecretDetail}${credentialQueueDetail}${parts.join(', ')} should be reconnected or re-entered in the target Jira project before enabling.`,
      severity: 'high',
    });
  }

  if (summary.customComponentCount > 0) {
    steps.push({
      id: 'confirm-app-components',
      label: 'Confirm app-provided components are available',
      detail: `${summary.customComponentCount} custom/app component type(s) must exist in the target Jira project before the imported copy can be trusted.`,
      severity: 'high',
    });
  }

  if (summary.scheduledTrigger || summary.smartValueReferenceCount > 0 || exportedRule.canOtherRuleTrigger) {
    const parts = [
      summary.scheduledTrigger ? 'scheduled trigger cadence/timezone' : '',
      summary.smartValueReferenceCount > 0 ? `${summary.smartValueReferenceCount} smart value reference(s)` : '',
      exportedRule.canOtherRuleTrigger ? 'rule chaining safeguard' : '',
    ].filter(Boolean);
    steps.push({
      id: 'test-dynamic-behavior',
      label: 'Test dynamic trigger behavior',
      detail: `${parts.join(', ')} should be checked with a controlled issue or audit run before enabling.`,
      severity: 'medium',
    });
  }

  steps.push({
    id: 'confirm-actor-and-audit',
    label: 'Confirm actor permissions and audit result',
    detail: 'Verify the current Jira actor can perform every action, then check the first audit log before leaving the rule enabled.',
    severity: summary.webRequestCount > 0 || summary.externalIntegrationCount > 0 || summary.scheduledTrigger
      ? 'medium'
      : 'low',
  });

  return steps;
}

export function buildJiraAutomationImportReviewPacket(
  exportedRule: ExportedRule,
  context: JiraAutomationImportReviewPacketContext,
): string {
  const replaceSensitiveValues = shouldReplaceJiraAutomationImportSensitiveValues(context);
  const checklist = buildJiraAutomationImportReviewChecklist(exportedRule, context.sourceCloud);
  const findings = buildJiraAutomationImportReviewFindings(exportedRule);
  const detectedSecretReentrySlots = collectJiraAutomationImportSecretReentrySlots(exportedRule);
  const secretReentrySlots = replaceSensitiveValues ? detectedSecretReentrySlots : [];
  const enablementPlan = buildJiraAutomationImportEnablementPlan(
    exportedRule,
    context.sourceCloud,
    replaceSensitiveValues,
  );
  const warnings = buildJiraAutomationImportWarnings(
    exportedRule,
    context.sourceCloud,
    replaceSensitiveValues,
  );
  const importedRuleName = context.importedRuleName ||
    buildJiraAutomationUniqueImportedRuleName(
      exportedRule.name,
      context.existingRuleNames,
      replaceSensitiveValues,
    );
  const targetProject = context.projectKey
    ? `${context.projectKey} (${context.projectId})`
    : context.projectId;
  const sourceAllowsChainedTrigger = Boolean(exportedRule.canOtherRuleTrigger);
  const ruleChaining = sourceAllowsChainedTrigger
    ? (context.allowOtherRuleTrigger === true ? 'preserved from source by user choice' : 'blocked in imported copy')
    : 'disabled in source';
  const sensitiveValuesChoice = replaceSensitiveValues
    ? 'replace sensitive values with PERSONAL_AI_REENTER_SECRET / REDACTED placeholders'
    : 'preserve sensitive values in the create payload by user choice';
  const sourceRuleLabel = replaceSensitiveValues
    ? sanitizeJiraAutomationImportDisplayText(exportedRule.name)
    : exportedRule.name.replace(/\s+/g, ' ').trim();

  return [
    '# Jira Automation import review',
    '',
    `- Source rule: ${sourceRuleLabel}`,
    `- Imported name: ${importedRuleName}`,
    `- ${buildJiraAutomationImportNameCheckReceipt(exportedRule, context, importedRuleName)}`,
    `- Target project: ${targetProject}`,
    `- Source format: ${formatJiraAutomationImportSourceFormat(context.sourceCloud)}`,
    '- Imported state: DISABLED',
    `- Rule chaining: ${ruleChaining}`,
    `- Sensitive values: ${sensitiveValuesChoice}`,
    `- High-risk gate: ${formatHighRiskGateSummary(checklist)}`,
    `- ${buildJiraAutomationImportCredentialRestoreGateSummary(secretReentrySlots, replaceSensitiveValues)}`,
    `- ${replaceSensitiveValues
      ? formatJiraAutomationImportSecretReentryQueue(secretReentrySlots)
      : `Credential re-entry queue: skipped; ${detectedSecretReentrySlots.length} sensitive slot(s) detected but preserved by user choice.`}`,
    `- Checklist summary: ${formatChecklistSeveritySummary(checklist)}`,
    '',
    '## Review before enabling',
    ...(checklist.length > 0
      ? checklist.map(formatReviewPacketChecklistItem)
      : ['- No blocking checks detected.']),
    '',
    '## Detected environment bindings',
    ...(findings.length > 0
      ? findings.map(formatReviewPacketFinding)
      : ['- None detected.']),
    '',
    '## Secret re-entry map',
    ...(replaceSensitiveValues
      ? (secretReentrySlots.length > 0
        ? secretReentrySlots.map((slot) => `- ${formatSecretReentrySlot(slot)}`)
        : ['- No secret-bearing fields were replaced or redacted in the disabled copy.'])
      : [
        `- Sensitive values will be preserved in the create payload by user choice (${detectedSecretReentrySlots.length} sensitive slot(s) detected).`,
      ]),
    '',
    '## Activation plan',
    ...enablementPlan.map(formatReviewPacketEnablementStep),
    '',
    '## Import warnings',
    ...warnings.map((warning) => `- ${warning}`),
  ].join('\n');
}

function stripExistingImportReviewNote(description: string): string {
  const marker = `\n\n${JIRA_AUTOMATION_IMPORT_REVIEW_NOTE_HEADING}`;
  const markerIndex = description.indexOf(marker);
  if (markerIndex >= 0) {
    return description.slice(0, markerIndex).trim();
  }

  if (description.trimStart().startsWith(JIRA_AUTOMATION_IMPORT_REVIEW_NOTE_HEADING)) {
    return '';
  }

  return description.trim();
}

export function buildJiraAutomationImportReviewNote(
  exportedRule: ExportedRule,
  context: ImportRuleContext,
): string {
  const replaceSensitiveValues = shouldReplaceJiraAutomationImportSensitiveValues(context);
  const summary = summarizeJiraAutomationImportRule(exportedRule);
  const checklist = buildJiraAutomationImportReviewChecklist(exportedRule, context.sourceCloud);
  const enablementPlan = buildJiraAutomationImportEnablementPlan(
    exportedRule,
    context.sourceCloud,
    replaceSensitiveValues,
  );
  const secretReentrySlots = replaceSensitiveValues
    ? collectJiraAutomationImportSecretReentrySlots(exportedRule)
    : [];
  const targetProject = context.projectKey
    ? `${context.projectKey} (${context.projectId})`
    : context.projectId;
  const sourceAllowsChainedTrigger = Boolean(exportedRule.canOtherRuleTrigger);
  const ruleChaining = sourceAllowsChainedTrigger
    ? (context.allowOtherRuleTrigger === true ? 'preserved from source by user choice' : 'blocked in imported copy')
    : 'disabled in source';
  const sensitiveValuesChoice = replaceSensitiveValues
    ? 'replace sensitive values with PERSONAL_AI_REENTER_SECRET / REDACTED placeholders'
    : 'preserve sensitive values in the create payload by user choice';

  return [
    JIRA_AUTOMATION_IMPORT_REVIEW_NOTE_HEADING,
    `- Imported as a disabled copy into ${targetProject}.`,
    `- ${buildJiraAutomationImportNameCheckReceipt(exportedRule, context)}`,
    `- Source format: ${formatJiraAutomationImportSourceFormat(context.sourceCloud)}.`,
    `- Sensitive values: ${sensitiveValuesChoice}.`,
    `- Enablement checklist: ${formatChecklistSeveritySummary(checklist)}.`,
    `- High-risk gate: ${formatHighRiskGateSummary(checklist)}.`,
    `- Create-stage acknowledgement: ${formatCreateStageAcknowledgementSummary(checklist, context)}.`,
    `- ${buildJiraAutomationImportCredentialRestoreGateSummary(secretReentrySlots, replaceSensitiveValues)}`,
    `- ${replaceSensitiveValues
      ? formatJiraAutomationImportSecretReentryQueue(secretReentrySlots)
      : 'Credential re-entry queue: skipped because sensitive values were preserved by user choice'}.`,
    `- Detected bindings: ${formatDetectedReferenceSummary(summary)}.`,
    `- Top detected bindings: ${formatReviewFindingsForNote(buildJiraAutomationImportReviewFindings(exportedRule))}.`,
    `- Secret re-entry map: ${replaceSensitiveValues
      ? formatJiraAutomationImportSecretReentrySummary(secretReentrySlots)
      : 'skipped; sensitive values preserved by user choice'}.`,
    `- Activation plan: ${formatEnablementPlanSummary(enablementPlan)}.`,
    `- Rule chaining: ${ruleChaining}.`,
  ].join('\n');
}

function buildJiraAutomationImportDescription(
  exportedRule: ExportedRule,
  context: ImportRuleContext,
): string {
  const replaceSensitiveValues = shouldReplaceJiraAutomationImportSensitiveValues(context);
  const sourceDescription = typeof exportedRule.description === 'string'
    ? (
      replaceSensitiveValues
        ? sanitizeJiraAutomationImportDisplayText(stripExistingImportReviewNote(exportedRule.description))
        : stripExistingImportReviewNote(exportedRule.description)
    ).trim()
    : '';
  const reviewNote = buildJiraAutomationImportReviewNote(exportedRule, context);
  const baseDescription = sourceDescription || (() => {
    const summary = summarizeJiraAutomationImportRule(exportedRule);
    const triggerType = typeof exportedRule.trigger?.type === 'string' && exportedRule.trigger.type.trim()
      ? exportedRule.trigger.type.trim()
      : 'unknown trigger';
    const normalizedTrigger = triggerType.replace(/^jira\./, '').replace(/\./g, ' ');
    const conditionLabel = summary.conditionCount === 1 ? 'condition' : 'conditions';
    const actionLabel = summary.actionCount === 1 ? 'action' : 'actions';
    const triggerLabel = summary.scheduledTrigger
      ? 'a scheduled trigger'
      : `trigger type "${normalizedTrigger}"`;

    return `Rule purpose: ${exportedRule.name}. It runs with ${triggerLabel}, ${summary.conditionCount} ${conditionLabel}, and ${summary.actionCount} ${actionLabel}.`;
  })();

  return [baseDescription, reviewNote].filter(Boolean).join('\n\n');
}

function addReviewSignal(values: Set<string>, value: string): void {
  const normalized = normalizeReviewSignal(value);
  if (normalized) {
    values.add(normalized);
  }
}

function addKeyedReviewSignal(values: Set<string>, key: string, value: string | number): void {
  const normalizedKey = key.replace(/\s+/g, ' ').trim();
  const normalizedValue = sanitizeJiraAutomationImportDisplayText(String(value)).replace(/\s+/g, ' ').trim();
  if (!normalizedValue) {
    return;
  }
  addReviewSignal(values, normalizedKey ? `${normalizedKey}: ${normalizedValue}` : normalizedValue);
}

function getSourceProjectTokens(exportedRule: ExportedRule): string[] {
  const tokens = new Set<string>();
  (exportedRule.projects || []).forEach((project) => {
    [project.projectId, project.projectKey, project.key, project.name].forEach((token) => {
      if (typeof token === 'string' && token.trim()) {
        tokens.add(token.trim());
      }
    });
  });
  return Array.from(tokens);
}

function textContainsSourceProjectToken(text: string, sourceProjectTokens: string[]): boolean {
  return sourceProjectTokens.some((token) => {
    const escaped = escapeRegExp(token);
    if (/^\d+$/.test(token)) {
      return new RegExp(`(?:projectId|project|pid)[^\\d]{0,24}${escaped}|${escaped}[^\\d]{0,24}(?:projectId|project|pid)`, 'i').test(text);
    }
    return new RegExp(`(^|[^A-Z0-9_])${escaped}([^A-Z0-9_]|$)`, 'i').test(text);
  });
}

function isLikelyJqlReference(key: string, text: string): boolean {
  const lowerKey = key.toLowerCase();
  if (lowerKey.includes('jql') || lowerKey.includes('filter')) {
    return true;
  }
  if (/^https?:\/\//i.test(text.trim())) {
    return false;
  }
  return /\b(project|issuetype|status|assignee|reporter|labels?|fixversion|component)\s*(=|!=|~|!~|in\b|not\s+in\b|is\b)/i.test(text);
}

function collectCustomFieldReferencesFromText(text: string, values: Set<string>): void {
  const matches = text.match(/\bcustomfield_\d+\b/gi) || [];
  matches.forEach((match) => addReviewSignal(values, match));
}

function collectSavedFilterReferencesFromText(key: string, text: string, values: Set<string>): void {
  const lowerKey = key.toLowerCase();
  const filterMatches = text.match(/\bfilter\s*(?:=|!=|in\b|not\s+in\b)\s*\(?\s*\d+/gi) || [];
  filterMatches.forEach((match) => addReviewSignal(values, match));

  if (lowerKey.includes('filter') && /\b\d{2,}\b/.test(text)) {
    addKeyedReviewSignal(values, key, text);
  }
}

function collectSmartValueReferencesFromText(text: string, values: Set<string>): void {
  const matches = text.match(/{{[^{}]{1,240}}}/g) || [];
  matches.forEach((match) => addReviewSignal(values, match));
}

function isLikelyConnectionKey(key: string): boolean {
  return /(connection|credential|connector|integration|webhook)/i.test(key);
}

function isLikelyNativeJiraAutomationType(type: string): boolean {
  const normalized = type.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return normalized.startsWith('jira.') ||
    normalized.startsWith('jsd.') ||
    normalized.startsWith('sd.') ||
    normalized.startsWith('servicedesk.') ||
    normalized.startsWith('opsgenie.') ||
    normalized.startsWith('atlassian.') ||
    normalized.startsWith('com.atlassian.');
}

function addCustomComponentReference(value: unknown, references: Set<string>): void {
  if (!isRecord(value)) {
    return;
  }

  const type = typeof value.type === 'string' ? value.type.trim() : '';
  if (!type || isLikelyNativeJiraAutomationType(type)) {
    return;
  }

  const component = typeof value.component === 'string'
    ? value.component.trim().toUpperCase()
    : 'COMPONENT';
  addReviewSignal(references, `${component}: ${type}`);
}

function collectCustomComponentReferences(value: unknown, references: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectCustomComponentReferences(item, references));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  addCustomComponentReference(value, references);

  ['children', 'conditions'].forEach((key) => {
    const nestedNodes = value[key];
    if (Array.isArray(nestedNodes)) {
      nestedNodes.forEach((nestedNode) => collectCustomComponentReferences(nestedNode, references));
    }
  });
}

function keyTokens(key: string): string[] {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function hasAdjacentTokens(tokens: string[], first: string, second: string): boolean {
  return tokens.some((token, index) => token === first && tokens[index + 1] === second);
}

function isLikelySensitiveKey(key: string): boolean {
  const compactKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (
    compactKey === 'sig' ||
    compactKey === 'signature' ||
    compactKey === 'awsaccesskeyid' ||
    compactKey === 'xamzcredential' ||
    compactKey === 'xamzsecuritytoken' ||
    compactKey === 'xamzsignature' ||
    compactKey === 'googleaccessid' ||
    compactKey === 'xgoogcredential' ||
    compactKey === 'xgoogsignature' ||
    compactKey === 'sharedaccesssignature'
  ) {
    return true;
  }

  const tokens = keyTokens(key);
  if (tokens.some((token) => (
    token === 'authorization' ||
    token === 'bearer' ||
    token === 'password' ||
    token === 'passwd' ||
    token === 'secret' ||
    token === 'secrets' ||
    token === 'token' ||
    token === 'jwt'
  ))) {
    return true;
  }

  return hasAdjacentTokens(tokens, 'api', 'key') ||
    hasAdjacentTokens(tokens, 'access', 'token') ||
    hasAdjacentTokens(tokens, 'refresh', 'token') ||
    hasAdjacentTokens(tokens, 'id', 'token') ||
    hasAdjacentTokens(tokens, 'session', 'token') ||
    hasAdjacentTokens(tokens, 'oauth', 'token') ||
    hasAdjacentTokens(tokens, 'client', 'secret') ||
    hasAdjacentTokens(tokens, 'client', 'assertion') ||
    hasAdjacentTokens(tokens, 'private', 'key');
}

function isLikelySensitiveUrlQueryKey(key: string): boolean {
  const compactKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (
    compactKey === 'code' ||
    compactKey === 'functionkey' ||
    compactKey === 'jwt' ||
    compactKey === 'idtoken' ||
    compactKey === 'clientassertion' ||
    compactKey === 'assertion' ||
    compactKey === 'oauthtoken' ||
    compactKey === 'subscriptionkey' ||
    compactKey === 'ocpapimsubscriptionkey' ||
    compactKey === 'sastoken' ||
    compactKey === 'sharedaccesskey'
  ) {
    return true;
  }

  return isLikelySensitiveKey(key);
}

function isGenericSensitiveLabelKey(key: string): boolean {
  return /^(name|key|headername|header)$/i.test(key.replace(/[^a-z0-9]/gi, ''));
}

function isKnownSecretContainerKey(key: string): boolean {
  return /^(usedsecretskeys|secret)$/i.test(key.replace(/[^a-z0-9]/gi, ''));
}

function isMaskedSensitiveValue(text: string): boolean {
  const trimmed = text.trim();
  return /^\*{3,}$/.test(trimmed) || /^x{5,}$/i.test(trimmed);
}

function addSensitiveReference(values: Set<string>, key: string, masked: boolean): void {
  const label = key.replace(/\s+/g, ' ').trim() || 'sensitive field';
  addReviewSignal(values, `${label}: ${masked ? 'hidden/masked value' : 'sensitive value present'}`);
}

function isGenericSecretContextKey(key: string): boolean {
  return /^(value|keyorvalue|secret|secrets|usedsecretskeys|headers?|items?)$/i.test(key.replace(/[^a-z0-9]/gi, ''));
}

function isUnsafeSecretDisplayLabel(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || isMaskedSensitiveValue(trimmed)) {
    return true;
  }

  if (/https?:\/\//i.test(trimmed) || /\{\{[^{}]+}}/.test(trimmed)) {
    return true;
  }

  if (/^(bearer|basic)\s+[a-z0-9._~+/-]+=*$/i.test(trimmed)) {
    return true;
  }

  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) {
    return true;
  }

  if (/^(gh[pousr]_|github_pat_|sk-|xox[abprs]-|AKIA|ASIA|AIza)[A-Za-z0-9._-]{8,}/.test(trimmed)) {
    return true;
  }

  const compact = trimmed.replace(/[^A-Za-z0-9_-]/g, '');
  const hasLetter = /[A-Za-z]/.test(compact);
  const hasDigit = /\d/.test(compact);
  const hasMixedCase = /[A-Z]/.test(compact) && /[a-z]/.test(compact);
  return compact.length >= 24 && hasLetter && (hasDigit || hasMixedCase);
}

function sanitizeSecretDisplayLabel(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }

  const label = normalizeReviewSignal(String(value));
  if (!label || isUnsafeSecretDisplayLabel(label)) {
    return '';
  }

  return label;
}

function buildHiddenSecretReferenceLabel(contextLabel?: string): string {
  const safeContextLabel = sanitizeSecretDisplayLabel(contextLabel);
  return safeContextLabel
    ? `${safeContextLabel}: hidden secret value`
    : 'hidden secret value';
}

function chooseSecretReferenceLabel(value: Record<string, any>, contextLabel?: string): string {
  const namedSecretCandidates = [
    value.key,
    value.secretKey,
    value.id,
  ];
  const safeNamedSecretLabel = namedSecretCandidates
    .map(sanitizeSecretDisplayLabel)
    .find(Boolean);

  if (safeNamedSecretLabel) {
    return safeNamedSecretLabel;
  }

  const fieldContextLabel = [
    value.headerName,
    value.name,
    contextLabel,
  ].map(sanitizeSecretDisplayLabel).find(Boolean);

  return buildHiddenSecretReferenceLabel(fieldContextLabel);
}

function getRecordSecretContext(value: Record<string, any>, fallbackKey?: string, parentContext?: string): string | undefined {
  const candidates = [
    value.headerName,
    value.name,
    value.key,
    fallbackKey && !isGenericSecretContextKey(fallbackKey) ? fallbackKey : undefined,
    parentContext,
  ];
  return candidates
    .map(sanitizeSecretDisplayLabel)
    .find(Boolean);
}

function isLikelyAccountKey(key: string): boolean {
  return /(accountid|account[-_ ]?id|userkey|user[-_ ]?key|username|user[-_ ]?name|actor|assignee|reporter|approver|recipient)/i.test(key);
}

function collectReviewSignals(
  value: unknown,
  key: string,
  sourceProjectTokens: string[],
  jqlReferences: Set<string>,
  hardcodedUrls: Set<string>,
  emailReferences: Set<string>,
  accountReferences: Set<string>,
  customFieldReferences: Set<string>,
  savedFilterReferences: Set<string>,
  connectionReferences: Set<string>,
  sensitiveReferences: Set<string>,
  sourceProjectReferences: Set<string>,
  smartValueReferences: Set<string>,
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectReviewSignals(
      item,
      key,
      sourceProjectTokens,
      jqlReferences,
      hardcodedUrls,
      emailReferences,
      accountReferences,
      customFieldReferences,
      savedFilterReferences,
      connectionReferences,
      sensitiveReferences,
      sourceProjectReferences,
      smartValueReferences,
    ));
    return;
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    const safeValue = sanitizeJiraAutomationImportDisplayText(value);
    const valueWithoutUrls = value.replace(/https?:\/\/[^\s"'<>]+/gi, ' ');
    if (isLikelyJqlReference(key, value)) {
      addReviewSignal(jqlReferences, safeValue);
    }

    collectCustomFieldReferencesFromText(value, customFieldReferences);
    collectSavedFilterReferencesFromText(key, value, savedFilterReferences);
    collectSmartValueReferencesFromText(value, smartValueReferences);

    const urls = value.match(/https?:\/\/[^\s"'<>]+/gi) || [];
    urls.forEach((url) => {
      addReviewSignal(hardcodedUrls, redactSensitiveUrl(url));
      addSensitiveUrlReferences(url, sensitiveReferences);
    });

    const emails = valueWithoutUrls.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    emails.forEach((email) => addReviewSignal(emailReferences, email));

    if (trimmedValue && isLikelyAccountKey(key) && emails.length === 0) {
      addKeyedReviewSignal(accountReferences, key, trimmedValue);
    }

    if (trimmedValue && isLikelyConnectionKey(key) && urls.length === 0) {
      addKeyedReviewSignal(connectionReferences, key, trimmedValue);
    }

    const maskedSensitiveValue = isMaskedSensitiveValue(trimmedValue);
    if (trimmedValue && !isKnownSecretContainerKey(key) && (maskedSensitiveValue || isLikelySensitiveKey(key))) {
      addSensitiveReference(sensitiveReferences, key, maskedSensitiveValue);
    } else if (trimmedValue && isGenericSensitiveLabelKey(key) && isLikelySensitiveKey(trimmedValue)) {
      addSensitiveReference(sensitiveReferences, trimmedValue, false);
    }

    if (sourceProjectTokens.length > 0 && textContainsSourceProjectToken(value, sourceProjectTokens)) {
      addReviewSignal(sourceProjectReferences, safeValue);
    }
    return;
  }

  if (typeof value === 'number') {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('customfield')) {
      addKeyedReviewSignal(customFieldReferences, key, value);
    }
    if (lowerKey.includes('filter')) {
      addKeyedReviewSignal(savedFilterReferences, key, value);
    }
    if (isLikelyConnectionKey(key)) {
      addKeyedReviewSignal(connectionReferences, key, value);
    }
    if (!isKnownSecretContainerKey(key) && isLikelySensitiveKey(key)) {
      addSensitiveReference(sensitiveReferences, key, false);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (value.secret === true) {
    return;
  }

  Object.entries(value).forEach(([nestedKey, nestedValue]) => {
    collectReviewSignals(
      nestedValue,
      nestedKey,
      sourceProjectTokens,
      jqlReferences,
      hardcodedUrls,
      emailReferences,
      accountReferences,
      customFieldReferences,
      savedFilterReferences,
      connectionReferences,
      sensitiveReferences,
      sourceProjectReferences,
      smartValueReferences,
    );
  });
}

function addSecretReferences(value: unknown, references: Set<string>, contextLabel?: string): void {
  if (Array.isArray(value)) {
    value.forEach((item) => addSecretReferences(item, references, contextLabel));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const recordContextLabel = getRecordSecretContext(value, undefined, contextLabel);

  if (Array.isArray(value.usedSecretsKeys)) {
    value.usedSecretsKeys.forEach((secret, index) => {
      if (typeof secret === 'string' && secret.trim()) {
        references.add(sanitizeSecretDisplayLabel(secret) || `secret-${index + 1}`);
      } else if (isRecord(secret)) {
        const label = secret.key || secret.id || secret.name || secret.secretKey;
        references.add(sanitizeSecretDisplayLabel(label) || `secret-${index + 1}`);
      }
    });
  }

  if (value.secret === true) {
    references.add(chooseSecretReferenceLabel(value, recordContextLabel));
  }

  Object.entries(value).forEach(([key, nestedValue]) => {
    if (key === 'usedSecretsKeys' || key === 'secret') {
      return;
    }
    const childContextLabel = getRecordSecretContext(value, key, contextLabel);
    addSecretReferences(nestedValue, references, childContextLabel);
  });
}

function inspectAutomationNode(
  node: unknown,
  summary: JiraAutomationRuleSummary,
  secretReferences: Set<string>,
  countAsComponent: boolean,
): void {
  if (!isRecord(node)) {
    return;
  }

  const componentKind = typeof node.component === 'string' ? node.component.toUpperCase() : '';
  const type = typeof node.type === 'string' ? node.type.toLowerCase() : '';

  if (countAsComponent) {
    summary.componentCount += 1;

    if (componentKind === 'ACTION') {
      summary.actionCount += 1;
    } else if (componentKind === 'CONDITION' || componentKind === 'CONDITION_BLOCK') {
      summary.conditionCount += 1;
    } else if (componentKind === 'BRANCH') {
      summary.branchCount += 1;
    }
  }

  if (componentKind === 'ACTION' && type.includes('webhook')) {
    summary.webRequestCount += 1;
  }

  if (
    componentKind === 'ACTION' &&
    [
      'webhook',
      'slack',
      'teams',
      'msteams',
      'microsoft',
      'aws',
      'azure',
      'ansible',
      'opsgenie',
      'email',
      'sms',
    ].some((keyword) => type.includes(keyword))
  ) {
    summary.externalIntegrationCount += 1;
  }

  if (type.includes('scheduled') || isRecord(node.value?.schedule)) {
    summary.scheduledTrigger = true;
  }

  addSecretReferences(node, secretReferences);

  ['children', 'conditions'].forEach((key) => {
    const nestedNodes = node[key];
    if (Array.isArray(nestedNodes)) {
      nestedNodes.forEach((nestedNode) => {
        inspectAutomationNode(nestedNode, summary, secretReferences, true);
      });
    }
  });
}

export function parseJiraAutomationExport(value: unknown): ExportedData {
  if (!isRecord(value) || !Array.isArray(value.rules)) {
    throw new Error('Invalid JSON format: missing rules array');
  }

  if (value.rules.length === 0) {
    throw new Error('No automation rules found in the imported file');
  }

  value.rules.forEach((rule, index) => {
    if (!isRecord(rule)) {
      throw new Error(`Rule #${index + 1} is not a valid object`);
    }
    if (typeof rule.name !== 'string' || !rule.name.trim()) {
      throw new Error(`Rule #${index + 1} is missing a name`);
    }
    if (!isRecord(rule.trigger)) {
      throw new Error(`Rule "${rule.name}" is missing trigger data`);
    }
    if (!Array.isArray(rule.components)) {
      throw new Error(`Rule "${rule.name}" is missing components array`);
    }
  });

  return {
    rules: value.rules as ExportedRule[],
    cloud: typeof value.cloud === 'boolean' ? value.cloud : undefined,
  };
}

export function isJiraAutomationImportFileSizeAllowed(size: number): boolean {
  return size <= JIRA_AUTOMATION_IMPORT_MAX_FILE_BYTES;
}

export function buildJiraAutomationImportedRuleName(
  sourceName: string,
  replaceSensitiveValues = true,
): string {
  return buildImportedRuleNameWithSuffix(sourceName, '', replaceSensitiveValues);
}

export function buildJiraAutomationUniqueImportedRuleName(
  sourceName: string,
  existingRuleNames: string[] = [],
  replaceSensitiveValues = true,
): string {
  const existingNames = new Set(
    existingRuleNames
      .filter((name): name is string => typeof name === 'string')
      .map(normalizeRuleNameForComparison),
  );
  const baseName = buildJiraAutomationImportedRuleName(sourceName, replaceSensitiveValues);

  if (!existingNames.has(normalizeRuleNameForComparison(baseName))) {
    return baseName;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = buildImportedRuleNameWithSuffix(sourceName, ` (${index})`, replaceSensitiveValues);
    if (!existingNames.has(normalizeRuleNameForComparison(candidate))) {
      return candidate;
    }
  }

  const fallbackSuffix = ` (${Date.now()})`;
  return buildImportedRuleNameWithSuffix(sourceName, fallbackSuffix, replaceSensitiveValues);
}

export function summarizeJiraAutomationImportRule(
  exportedRule: ExportedRule,
): JiraAutomationRuleSummary {
  const summary: JiraAutomationRuleSummary = {
    componentCount: 0,
    actionCount: 0,
    conditionCount: 0,
    branchCount: 0,
    webRequestCount: 0,
    externalIntegrationCount: 0,
    secretReferenceCount: 0,
    jqlReferenceCount: 0,
    hardcodedUrlCount: 0,
    emailReferenceCount: 0,
    accountReferenceCount: 0,
    customFieldReferenceCount: 0,
    savedFilterReferenceCount: 0,
    connectionReferenceCount: 0,
    sensitiveReferenceCount: 0,
    sourceProjectReferenceCount: 0,
    smartValueReferenceCount: 0,
    customComponentCount: 0,
    scheduledTrigger: false,
  };
  const secretReferences = new Set<string>();
  const reviewSignals = collectJiraAutomationImportReviewSignals(exportedRule);

  inspectAutomationNode(exportedRule.trigger, summary, secretReferences, false);
  exportedRule.components.forEach((component) => {
    inspectAutomationNode(component, summary, secretReferences, true);
  });

  summary.secretReferenceCount = secretReferences.size;
  summary.jqlReferenceCount = reviewSignals.jqlReferences.length;
  summary.hardcodedUrlCount = reviewSignals.hardcodedUrls.length;
  summary.emailReferenceCount = reviewSignals.emailReferences.length;
  summary.accountReferenceCount = reviewSignals.accountReferences.length;
  summary.customFieldReferenceCount = reviewSignals.customFieldReferences.length;
  summary.savedFilterReferenceCount = reviewSignals.savedFilterReferences.length;
  summary.connectionReferenceCount = reviewSignals.connectionReferences.length;
  summary.sensitiveReferenceCount = reviewSignals.sensitiveReferences.length;
  summary.sourceProjectReferenceCount = reviewSignals.sourceProjectReferences.length;
  summary.smartValueReferenceCount = reviewSignals.smartValueReferences.length;
  summary.customComponentCount = reviewSignals.customComponentReferences.length;
  return summary;
}

export function collectJiraAutomationImportReviewSignals(
  exportedRule: ExportedRule,
): JiraAutomationRuleReviewSignals {
  const sourceProjectTokens = getSourceProjectTokens(exportedRule);
  const jqlReferences = new Set<string>();
  const hardcodedUrls = new Set<string>();
  const secretReferences = new Set<string>();
  const emailReferences = new Set<string>();
  const accountReferences = new Set<string>();
  const customFieldReferences = new Set<string>();
  const savedFilterReferences = new Set<string>();
  const connectionReferences = new Set<string>();
  const sensitiveReferences = new Set<string>();
  const sourceProjectReferences = new Set<string>();
  const smartValueReferences = new Set<string>();
  const customComponentReferences = new Set<string>();

  collectReviewSignals(
    exportedRule.trigger,
    'trigger',
    sourceProjectTokens,
    jqlReferences,
    hardcodedUrls,
    emailReferences,
    accountReferences,
    customFieldReferences,
    savedFilterReferences,
    connectionReferences,
    sensitiveReferences,
    sourceProjectReferences,
    smartValueReferences,
  );
  collectReviewSignals(
    exportedRule.components,
    'components',
    sourceProjectTokens,
    jqlReferences,
    hardcodedUrls,
    emailReferences,
    accountReferences,
    customFieldReferences,
    savedFilterReferences,
    connectionReferences,
    sensitiveReferences,
    sourceProjectReferences,
    smartValueReferences,
  );
  collectReviewSignals(
    exportedRule.description,
    'description',
    sourceProjectTokens,
    jqlReferences,
    hardcodedUrls,
    emailReferences,
    accountReferences,
    customFieldReferences,
    savedFilterReferences,
    connectionReferences,
    sensitiveReferences,
    sourceProjectReferences,
    smartValueReferences,
  );
  collectReviewSignals(
    exportedRule.labels,
    'labels',
    sourceProjectTokens,
    jqlReferences,
    hardcodedUrls,
    emailReferences,
    accountReferences,
    customFieldReferences,
    savedFilterReferences,
    connectionReferences,
    sensitiveReferences,
    sourceProjectReferences,
    smartValueReferences,
  );
  collectReviewSignals(
    exportedRule.tags,
    'tags',
    sourceProjectTokens,
    jqlReferences,
    hardcodedUrls,
    emailReferences,
    accountReferences,
    customFieldReferences,
    savedFilterReferences,
    connectionReferences,
    sensitiveReferences,
    sourceProjectReferences,
    smartValueReferences,
  );
  addSecretReferences(exportedRule.trigger, secretReferences);
  addSecretReferences(exportedRule.components, secretReferences);
  collectCustomComponentReferences(exportedRule.trigger, customComponentReferences);
  collectCustomComponentReferences(exportedRule.components, customComponentReferences);

  return {
    jqlReferences: Array.from(jqlReferences),
    hardcodedUrls: Array.from(hardcodedUrls),
    secretReferences: Array.from(secretReferences).map(normalizeReviewSignal),
    emailReferences: Array.from(emailReferences),
    accountReferences: Array.from(accountReferences),
    customFieldReferences: Array.from(customFieldReferences),
    savedFilterReferences: Array.from(savedFilterReferences),
    connectionReferences: Array.from(connectionReferences),
    sensitiveReferences: Array.from(sensitiveReferences),
    sourceProjectReferences: Array.from(sourceProjectReferences),
    smartValueReferences: Array.from(smartValueReferences),
    customComponentReferences: Array.from(customComponentReferences),
  };
}

export function buildJiraAutomationImportReviewFindings(
  exportedRule: ExportedRule,
): JiraAutomationImportReviewFinding[] {
  const summary = summarizeJiraAutomationImportRule(exportedRule);
  const signals = collectJiraAutomationImportReviewSignals(exportedRule);
  const accountSamples = [
    ...signals.emailReferences,
    ...signals.accountReferences,
  ];
  const accountCount = summary.emailReferenceCount + summary.accountReferenceCount;

  return [
    createReviewFinding('jql-filters', 'JQL / filters', summary.jqlReferenceCount, signals.jqlReferences, 'high'),
    createReviewFinding('source-project-references', 'Source project refs', summary.sourceProjectReferenceCount, signals.sourceProjectReferences, 'high'),
    createReviewFinding('custom-fields', 'Custom fields', summary.customFieldReferenceCount, signals.customFieldReferences, 'high'),
    createReviewFinding('saved-filters', 'Saved filters', summary.savedFilterReferenceCount, signals.savedFilterReferences, 'high'),
    createReviewFinding('custom-components', 'Custom / app components', summary.customComponentCount, signals.customComponentReferences, 'high'),
    createReviewFinding('secrets', 'Secrets', summary.secretReferenceCount, signals.secretReferences, 'high'),
    createReviewFinding('connections', 'Connections', summary.connectionReferenceCount, signals.connectionReferences, 'high'),
    createReviewFinding('sensitive-values', 'Sensitive / hidden values', summary.sensitiveReferenceCount, signals.sensitiveReferences, 'high'),
    createReviewFinding('smart-values', 'Smart values', summary.smartValueReferenceCount, signals.smartValueReferences, 'medium'),
    createReviewFinding('hard-coded-urls', 'Hard-coded URLs', summary.hardcodedUrlCount, signals.hardcodedUrls, 'medium'),
    createReviewFinding('accounts', 'Accounts / recipients', accountCount, accountSamples, 'medium'),
  ].filter((finding): finding is JiraAutomationImportReviewFinding => Boolean(finding));
}

function normalizeSecretPayloadKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function shouldScrubHiddenSecretPrimitive(key: string): boolean {
  const normalizedKey = normalizeSecretPayloadKey(key);
  return normalizedKey === 'keyorvalue' ||
    normalizedKey === 'value' ||
    normalizedKey === 'rawvalue' ||
    normalizedKey === 'secretvalue' ||
    isLikelySensitiveKey(key);
}

function isLikelySensitiveImportKey(key: string): boolean {
  const normalizedKey = normalizeSecretPayloadKey(key);
  if (
    normalizedKey === 'rawvalue' ||
    normalizedKey === 'secretvalue' ||
    normalizedKey === 'authorizationheader'
  ) {
    return true;
  }

  const tokens = keyTokens(key);
  if (tokens.some((token) => (
    token === 'authorization' ||
    token === 'bearer' ||
    token === 'password' ||
    token === 'passwd' ||
    token === 'token' ||
    token === 'jwt'
  ))) {
    return true;
  }

  const hasSecretReferenceKey = hasAdjacentTokens(tokens, 'secret', 'key') ||
    hasAdjacentTokens(tokens, 'secrets', 'keys') ||
    hasAdjacentTokens(tokens, 'used', 'secrets');
  if (tokens.includes('secret') && !hasSecretReferenceKey) {
    return true;
  }

  return hasAdjacentTokens(tokens, 'api', 'key') ||
    hasAdjacentTokens(tokens, 'access', 'token') ||
    hasAdjacentTokens(tokens, 'refresh', 'token') ||
    hasAdjacentTokens(tokens, 'id', 'token') ||
    hasAdjacentTokens(tokens, 'session', 'token') ||
    hasAdjacentTokens(tokens, 'oauth', 'token') ||
    hasAdjacentTokens(tokens, 'client', 'secret') ||
    hasAdjacentTokens(tokens, 'client', 'assertion') ||
    hasAdjacentTokens(tokens, 'private', 'key');
}

function hasSensitiveValueContext(value: Record<string, any>): boolean {
  return [
    value.headerName,
    value.name,
    value.key,
    value.fieldName,
  ].some((candidate) => (
    typeof candidate === 'string' &&
    (isLikelySensitiveKey(candidate) || isLikelySensitiveImportKey(candidate))
  ));
}

function shouldScrubSensitivePrimitiveForImport(
  key: string,
  value: string | number,
  parentRecord: Record<string, any>,
): boolean {
  const normalizedKey = normalizeSecretPayloadKey(key);
  if (typeof value === 'string' && isMaskedSensitiveValue(value)) {
    return true;
  }

  if (isLikelySensitiveImportKey(key)) {
    return true;
  }

  return (
    (normalizedKey === 'value' || normalizedKey === 'keyorvalue') &&
    hasSensitiveValueContext(parentRecord)
  );
}

function sanitizeHiddenSecretPrimitiveForImport(key: string, value: string | number): string | number {
  if (shouldScrubHiddenSecretPrimitive(key)) {
    return JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER;
  }

  return sanitizeSecretDisplayLabel(value) || JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER;
}

function sanitizeSensitivePrimitiveForImport(
  key: string,
  value: string | number,
  parentRecord: Record<string, any>,
): string | number {
  if (shouldScrubSensitivePrimitiveForImport(key, value, parentRecord)) {
    return JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER;
  }

  if (typeof value === 'string') {
    return redactInlineSecretText(value, JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER);
  }

  return value;
}

function buildSecretReentryPath(parentPath: string, key: string): string {
  if (!parentPath) {
    return key;
  }

  return key.startsWith('[')
    ? `${parentPath}${key}`
    : `${parentPath}.${key}`;
}

function addSecretReentrySlot(
  slots: Map<string, JiraAutomationImportSecretReentrySlot>,
  path: string,
  label: string,
  reason: string,
): void {
  const normalizedPath = path.replace(/\.\[/g, '[');
  const safeLabel = normalizeReviewSignal(sanitizeJiraAutomationImportDisplayText(label));
  const slot: JiraAutomationImportSecretReentrySlot = {
    path: normalizedPath,
    label: safeLabel,
    reason,
  };
  const key = `${slot.path}\n${slot.label}\n${slot.reason}`;
  if (!slots.has(key)) {
    slots.set(key, slot);
  }
}

function getSecretReentryPrimitiveLabel(
  key: string,
  parentRecord: Record<string, any>,
): string {
  const candidates = [
    parentRecord.headerName,
    parentRecord.name,
    parentRecord.key,
    key,
  ];
  return candidates.map(sanitizeSecretDisplayLabel).find(Boolean) || key;
}

function getInlineRedactionReason(key: string, value: string): string {
  if (/https?:\/\//i.test(value) && redactSensitiveUrlsInText(value) !== value) {
    return 'URL credential, sensitive query, fragment, or token-like path was redacted; verify the endpoint and rebuild credentials in Jira if needed.';
  }

  if (redactInlineSecretText(value, JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER) !== value) {
    return 'Inline secret-like text was replaced with PERSONAL_AI_REENTER_SECRET; verify whether this field should be rebuilt or left redacted.';
  }

  if (isLikelySensitiveImportKey(key) || isLikelySensitiveKey(key)) {
    return 'Credential field was replaced with PERSONAL_AI_REENTER_SECRET; re-enter the target value in Jira before enabling.';
  }

  return '';
}

function collectSecretReentrySlotsFromValue(
  value: unknown,
  key: string,
  path: string,
  slots: Map<string, JiraAutomationImportSecretReentrySlot>,
  parentRecord: Record<string, any> = {},
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectSecretReentrySlotsFromValue(
        item,
        key,
        buildSecretReentryPath(path, `[${index}]`),
        slots,
        parentRecord,
      );
    });
    return;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const rawValue = String(value);
    if (shouldScrubSensitivePrimitiveForImport(key, value, parentRecord)) {
      addSecretReentrySlot(
        slots,
        path,
        getSecretReentryPrimitiveLabel(key, parentRecord),
        'Credential field was replaced with PERSONAL_AI_REENTER_SECRET; re-enter the target value in Jira before enabling.',
      );
      return;
    }

    const reason = typeof value === 'string'
      ? getInlineRedactionReason(key, rawValue)
      : '';
    if (reason) {
      addSecretReentrySlot(slots, path, getSecretReentryPrimitiveLabel(key, parentRecord), reason);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (value.secret === true) {
    const parentContextLabel = getRecordSecretContext(parentRecord, undefined, undefined);
    const recordContextLabel = getRecordSecretContext(value, key, parentContextLabel);
    addSecretReentrySlot(
      slots,
      path,
      chooseSecretReferenceLabel(value, recordContextLabel),
      'Hidden Jira secret container was replaced with PERSONAL_AI_REENTER_SECRET; re-enter this field in Jira before enabling.',
    );
    return;
  }

  Object.entries(value).forEach(([nestedKey, nestedValue]) => {
    collectSecretReentrySlotsFromValue(
      nestedValue,
      nestedKey,
      buildSecretReentryPath(path, nestedKey),
      slots,
      value,
    );
  });
}

export function collectJiraAutomationImportSecretReentrySlots(
  exportedRule: ExportedRule,
): JiraAutomationImportSecretReentrySlot[] {
  const slots = new Map<string, JiraAutomationImportSecretReentrySlot>();

  collectSecretReentrySlotsFromValue(exportedRule.name, 'name', 'name', slots);
  if (typeof exportedRule.description === 'string') {
    collectSecretReentrySlotsFromValue(exportedRule.description, 'description', 'description', slots);
  }
  collectSecretReentrySlotsFromValue(exportedRule.trigger, 'trigger', 'trigger', slots);
  collectSecretReentrySlotsFromValue(exportedRule.components, 'components', 'components', slots);
  collectSecretReentrySlotsFromValue(exportedRule.labels || [], 'labels', 'labels', slots);

  return Array.from(slots.values());
}

function sanitizeAutomationImportNestedValue(value: unknown, insideHiddenSecret = false): any {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAutomationImportNestedValue(item, insideHiddenSecret));
  }

  if (!isRecord(value)) {
    if (insideHiddenSecret && (typeof value === 'string' || typeof value === 'number')) {
      return JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER;
    }

    return value;
  }

  const hiddenSecretContainer = insideHiddenSecret || value.secret === true;
  const clone: Record<string, any> = {};

  Object.entries(value).forEach(([key, nestedValue]) => {
    if (key === 'secret' && value.secret === true) {
      clone[key] = true;
      return;
    }

    if (hiddenSecretContainer && (typeof nestedValue === 'string' || typeof nestedValue === 'number')) {
      clone[key] = sanitizeHiddenSecretPrimitiveForImport(key, nestedValue);
      return;
    }

    if (!hiddenSecretContainer && (typeof nestedValue === 'string' || typeof nestedValue === 'number')) {
      clone[key] = sanitizeSensitivePrimitiveForImport(key, nestedValue, value);
      return;
    }

    clone[key] = sanitizeAutomationImportNestedValue(nestedValue, hiddenSecretContainer);
  });

  return clone;
}

function cloneAutomationImportNestedValue(value: unknown): any {
  if (Array.isArray(value)) {
    return value.map((item) => cloneAutomationImportNestedValue(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  const clone: Record<string, any> = {};
  Object.entries(value).forEach(([key, nestedValue]) => {
    clone[key] = cloneAutomationImportNestedValue(nestedValue);
  });
  return clone;
}

function prepareAutomationImportNestedValue(
  value: unknown,
  replaceSensitiveValues: boolean,
): any {
  return replaceSensitiveValues
    ? sanitizeAutomationImportNestedValue(value)
    : cloneAutomationImportNestedValue(value);
}

function sanitizeAutomationImportLabels(
  labels: any[],
  replaceSensitiveValues = true,
): any[] {
  return labels.map((label) => {
    if (typeof label === 'string') {
      return replaceSensitiveValues
        ? redactInlineSecretText(label, JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER)
        : label;
    }

    return prepareAutomationImportNestedValue(label, replaceSensitiveValues);
  });
}

function remapAutomationNodeIds(
  node: unknown,
  nextId: () => string,
  id: string,
  replaceSensitiveValues = true,
): any {
  if (!isRecord(node)) {
    return node;
  }

  const clone: Record<string, any> = { id };

  Object.entries(node).forEach(([key, nestedValue]) => {
    if (key === 'id') {
      return;
    }

    if ((key === 'children' || key === 'conditions') && Array.isArray(nestedValue)) {
      clone[key] = nestedValue.map((child) => remapAutomationNodeIds(
        child,
        nextId,
        nextId(),
        replaceSensitiveValues,
      ));
      return;
    }

    clone[key] = prepareAutomationImportNestedValue(nestedValue, replaceSensitiveValues);
  });

  return clone;
}

export function buildJiraAutomationImportRule(
  exportedRule: ExportedRule,
  context: ImportRuleContext,
): ImportRule {
  if (!context.projectId || !context.projectId.trim()) {
    throw new Error('Target Jira projectId is required');
  }

  const replaceSensitiveValues = shouldReplaceJiraAutomationImportSensitiveValues(context);
  const now = context.now ?? Date.now();
  const projectTypeKey =
    context.projectTypeKey ||
    exportedRule.projects?.[0]?.projectTypeKey ||
    'software';
  let componentIdIndex = 0;
  const nextComponentId = () => `__NEW__COMPONENT__${now + componentIdIndex++}`;
  const actorAccountId = context.ownerId || exportedRule.actorAccountId || exportedRule.authorAccountId || '';

  const convertedComponents = exportedRule.components.map((component) => (
    remapAutomationNodeIds(component, nextComponentId, nextComponentId(), replaceSensitiveValues)
  ));

  const convertedTrigger = remapAutomationNodeIds(
    exportedRule.trigger,
    nextComponentId,
    '__NEW__TRIGGER',
    replaceSensitiveValues,
  );

  const projects = [{
    projectId: context.projectId,
    projectTypeKey,
  }];

  return {
    name: buildJiraAutomationUniqueImportedRuleName(
      exportedRule.name,
      context.existingRuleNames,
      replaceSensitiveValues,
    ),
    isNewRule: true,
    state: context.disableAfterImport === false ? 'ENABLED' : 'DISABLED',
    canOtherRuleTrigger: Boolean(exportedRule.canOtherRuleTrigger) && context.allowOtherRuleTrigger === true,
    notifyOnError: exportedRule.notifyOnError || 'FIRSTERROR',
    authorAccountId: actorAccountId,
    actorAccountId,
    created: now,
    updated: now,
    components: convertedComponents,
    trigger: convertedTrigger,
    labels: sanitizeAutomationImportLabels(exportedRule.labels || [], replaceSensitiveValues),
    description: buildJiraAutomationImportDescription(exportedRule, context),
    projects,
  };
}

export function buildJiraAutomationImportWarnings(
  exportedRule: ExportedRule,
  sourceCloud?: boolean,
  replaceSensitiveValues = true,
): string[] {
  const summary = summarizeJiraAutomationImportRule(exportedRule);
  const hiddenSecretReferences = getHiddenSecretReferences(exportedRule);
  const secretReentrySlots = shouldReplaceJiraAutomationImportSensitiveValues(replaceSensitiveValues)
    ? collectJiraAutomationImportSecretReentrySlots(exportedRule)
    : [];
  const warnings = [
    'Imported rules are created disabled. Review and enable them in Jira after import.',
    'Project scope is remapped to the current Jira project.',
    'Use exports from the same Jira Automation version when possible; incompatible JSON may fail to create or run correctly.',
    'Rule actor and author are replaced with the current Jira user when Personal AI can resolve it. Verify permissions before enabling.',
  ];

  if (!shouldReplaceJiraAutomationImportSensitiveValues(replaceSensitiveValues)) {
    warnings.push('Sensitive values will be preserved in the create payload by user choice. Confirm the preserved secrets, tokens, and signed URLs are intended for the target project before enabling.');
  }

  if (sourceCloud === false) {
    warnings.push(`Source export is marked cloud=false. Confirm the target Jira Automation edition/version before enabling; Send web request headers, app-provided components, credentials, or webhooks may need manual rebuild in the target rule.`);
  }

  if (typeof exportedRule.state === 'string' && exportedRule.state.toUpperCase() === 'ENABLED') {
    warnings.push('The source rule was enabled, but the imported copy will stay disabled.');
  }

  if (!exportedRule.projects || exportedRule.projects.length === 0) {
    warnings.push('The source file has no project scope, so Personal AI will add the current project.');
  }

  if (exportedRule.projects && exportedRule.projects.length > 1) {
    warnings.push('Multiple source project scopes will be collapsed to the current project.');
  }

  if (summary.scheduledTrigger) {
    warnings.push('Scheduled trigger detected. Confirm the JQL, cadence, and timezone before enabling.');
  }

  if (summary.webRequestCount > 0) {
    warnings.push(`Includes ${summary.webRequestCount} web request action(s). Review URLs, headers, and response handling before enabling.`);
  }

  if (summary.externalIntegrationCount > summary.webRequestCount) {
    warnings.push(`Includes ${summary.externalIntegrationCount} external integration action(s). Confirm connected accounts, rate limits, and incident side effects before enabling.`);
  }

  if (summary.secretReferenceCount > 0) {
    warnings.push(
      shouldReplaceJiraAutomationImportSensitiveValues(replaceSensitiveValues)
        ? 'Includes secret references. Verify target Jira secrets and connections before enabling.'
        : 'Includes secret references that will be preserved in the create payload. Confirm they are target-safe before enabling.',
    );
  }

  if (hiddenSecretReferences.length > 0 && shouldReplaceJiraAutomationImportSensitiveValues(replaceSensitiveValues)) {
    warnings.push(`Includes ${hiddenSecretReferences.length} hidden secret field(s): ${formatHiddenSecretReferenceSummary(hiddenSecretReferences)}. Jira export/import will not restore hidden values, so re-enter them in the target rule before enabling.`);
  }

  if (secretReentrySlots.length > 0) {
    warnings.push(`Secret re-entry map: ${formatJiraAutomationImportSecretReentrySummary(secretReentrySlots)}. Placeholder or REDACTED values are not working credentials; rebuild only the required target fields in Jira before enabling.`);
    warnings.push(formatJiraAutomationImportSecretReentryQueue(secretReentrySlots));
  }

  if (summary.sourceProjectReferenceCount > 0) {
    warnings.push('Possible source project references were found inside the rule body. Project scope remapping does not rewrite JQL, URLs, or custom fields.');
  }

  if (summary.customComponentCount > 0) {
    warnings.push(`Includes ${summary.customComponentCount} custom or app-provided component type(s). Confirm the target Jira site has the same app/module before enabling.`);
  }

  if (summary.jqlReferenceCount > 0) {
    warnings.push(`Includes ${summary.jqlReferenceCount} JQL or filter reference(s). Confirm project keys, filters, and timezone-sensitive clauses before enabling.`);
  }

  if (summary.hardcodedUrlCount > 0) {
    warnings.push(`Includes ${summary.hardcodedUrlCount} hard-coded URL reference(s). Verify target endpoints and environment-specific parameters.`);
  }

  if (summary.emailReferenceCount > 0) {
    warnings.push(`Includes ${summary.emailReferenceCount} email or account reference(s). Confirm target recipients and service accounts.`);
  }

  if (
    summary.accountReferenceCount > 0 ||
    summary.customFieldReferenceCount > 0 ||
    summary.savedFilterReferenceCount > 0 ||
    summary.connectionReferenceCount > 0 ||
    summary.sensitiveReferenceCount > 0 ||
    summary.smartValueReferenceCount > 0 ||
    summary.customComponentCount > 0
  ) {
    const parts = [
      summary.customComponentCount > 0 ? `${summary.customComponentCount} custom/app component type(s)` : '',
      summary.accountReferenceCount > 0 ? `${summary.accountReferenceCount} account id/reference(s)` : '',
      summary.customFieldReferenceCount > 0 ? `${summary.customFieldReferenceCount} custom field reference(s)` : '',
      summary.savedFilterReferenceCount > 0 ? `${summary.savedFilterReferenceCount} saved filter id/reference(s)` : '',
      summary.connectionReferenceCount > 0 ? `${summary.connectionReferenceCount} connection or credential reference(s)` : '',
      summary.sensitiveReferenceCount > 0 ? `${summary.sensitiveReferenceCount} sensitive or hidden value reference(s)` : '',
      summary.smartValueReferenceCount > 0 ? `${summary.smartValueReferenceCount} smart value reference(s)` : '',
    ].filter(Boolean);
    warnings.push(`Environment-bound references detected: ${parts.join(', ')}. Confirm they exist in the target project before enabling.`);
  }

  if (summary.sensitiveReferenceCount > 0) {
    warnings.push(
      shouldReplaceJiraAutomationImportSensitiveValues(replaceSensitiveValues)
        ? `Includes ${summary.sensitiveReferenceCount} sensitive or hidden value reference(s). Re-enter masked web request headers, tokens, passwords, or API keys in Jira before enabling.`
        : `Includes ${summary.sensitiveReferenceCount} sensitive or hidden value reference(s) that will be preserved in the create payload. Confirm they are target-safe before enabling.`,
    );
  }

  if (exportedRule.canOtherRuleTrigger) {
    warnings.push('This rule can be triggered by other rules. Keep the chained-trigger safeguard enabled unless you intentionally need that behavior.');
  }

  if (summary.smartValueReferenceCount > 0) {
    warnings.push(`Includes ${summary.smartValueReferenceCount} smart value reference(s). Verify dynamic values against the target project, actor, and trigger payload before enabling.`);
  }

  return warnings;
}

export function buildJiraAutomationImportReviewChecklist(
  exportedRule: ExportedRule,
  sourceCloud?: boolean,
): JiraAutomationImportReviewChecklistItem[] {
  const summary = summarizeJiraAutomationImportRule(exportedRule);
  const hiddenSecretReferences = getHiddenSecretReferences(exportedRule);
  const secretReentrySlots = collectJiraAutomationImportSecretReentrySlots(exportedRule);
  const items: JiraAutomationImportReviewChecklistItem[] = [
    {
      id: 'target-project',
      label: 'Target project scope',
      detail: 'The imported copy will be scoped to the current Jira project. Embedded project keys, ids, filters, and custom text are not rewritten.',
      severity: summary.sourceProjectReferenceCount > 0 || summary.jqlReferenceCount > 0 ? 'high' : 'medium',
    },
  ];

  if (sourceCloud === false) {
    items.push({
      id: 'source-format',
      label: 'Source format compatibility',
      detail: buildSourceFormatCompatibilityDetail(summary),
      severity: getSourceFormatCompatibilitySeverity(summary),
    });
  }

  if (summary.jqlReferenceCount > 0) {
    items.push({
      id: 'jql-filters',
      label: 'JQL and filters',
      detail: `${summary.jqlReferenceCount} JQL/filter reference(s) need target-project validation before enabling.`,
      severity: 'high',
    });
  }

  if (summary.sourceProjectReferenceCount > 0) {
    items.push({
      id: 'source-project-references',
      label: 'Source project references',
      detail: `${summary.sourceProjectReferenceCount} source-project reference(s) were found inside trigger, action, label, or description fields.`,
      severity: 'high',
    });
  }

  if (
    summary.webRequestCount > 0 ||
    summary.externalIntegrationCount > 0 ||
    summary.hardcodedUrlCount > 0 ||
    summary.secretReferenceCount > 0 ||
    summary.emailReferenceCount > 0 ||
    summary.accountReferenceCount > 0 ||
    summary.connectionReferenceCount > 0 ||
    summary.sensitiveReferenceCount > 0
  ) {
    const parts = [
      summary.webRequestCount > 0 ? `${summary.webRequestCount} web request(s)` : '',
      summary.externalIntegrationCount > 0 ? `${summary.externalIntegrationCount} external action(s)` : '',
      summary.hardcodedUrlCount > 0 ? `${summary.hardcodedUrlCount} URL(s)` : '',
      summary.secretReferenceCount > 0 ? `${summary.secretReferenceCount} secret reference(s)` : '',
      summary.emailReferenceCount > 0 ? `${summary.emailReferenceCount} account/email reference(s)` : '',
      summary.accountReferenceCount > 0 ? `${summary.accountReferenceCount} account id/reference(s)` : '',
      summary.connectionReferenceCount > 0 ? `${summary.connectionReferenceCount} connection/credential reference(s)` : '',
      summary.sensitiveReferenceCount > 0 ? `${summary.sensitiveReferenceCount} sensitive/hidden value reference(s)` : '',
    ].filter(Boolean);
    const hiddenSecretDetail = secretReentrySlots.length > 0
      ? ` Secret re-entry map: ${formatJiraAutomationImportSecretReentrySummary(secretReentrySlots)}.`
      : hiddenSecretReferences.length > 0
        ? ` Hidden secret fields to re-enter: ${formatHiddenSecretReferenceSummary(hiddenSecretReferences)}.`
      : '';
    const credentialQueueDetail = secretReentrySlots.length > 0
      ? ` ${formatJiraAutomationImportSecretReentryQueue(secretReentrySlots, 2)}`
      : '';

    items.push({
      id: 'external-effects',
      label: 'External effects and credentials',
      detail: `${parts.join(', ')} need endpoint, credential, and recipient review.${hiddenSecretDetail}${credentialQueueDetail}`,
      severity: summary.webRequestCount > 0 || summary.externalIntegrationCount > 0 || summary.secretReferenceCount > 0 || summary.connectionReferenceCount > 0 || summary.sensitiveReferenceCount > 0
        ? 'high'
        : 'medium',
    });
  }

  if (summary.customComponentCount > 0) {
    items.push({
      id: 'custom-components',
      label: 'Custom / app components',
      detail: `${summary.customComponentCount} custom/app component type(s) should be checked against target Jira app/module availability before enabling.`,
      severity: 'high',
    });
  }

  if (summary.customFieldReferenceCount > 0 || summary.savedFilterReferenceCount > 0) {
    const parts = [
      summary.customFieldReferenceCount > 0 ? `${summary.customFieldReferenceCount} custom field reference(s)` : '',
      summary.savedFilterReferenceCount > 0 ? `${summary.savedFilterReferenceCount} saved filter id/reference(s)` : '',
    ].filter(Boolean);

    items.push({
      id: 'environment-bindings',
      label: 'Target environment bindings',
      detail: `${parts.join(', ')} should be mapped or verified in the target Jira project before enabling.`,
      severity: 'high',
    });
  }

  if (summary.smartValueReferenceCount > 0) {
    items.push({
      id: 'smart-values',
      label: 'Smart value behavior',
      detail: `${summary.smartValueReferenceCount} smart value reference(s) should be checked against the target project, rule actor, and trigger payload.`,
      severity: 'medium',
    });
  }

  if (summary.scheduledTrigger) {
    items.push({
      id: 'schedule',
      label: 'Schedule and timezone',
      detail: 'A scheduled trigger was detected. Confirm cadence, timezone, JQL window, and duplicate-run risk before enabling.',
      severity: 'medium',
    });
  }

  if (exportedRule.canOtherRuleTrigger) {
    items.push({
      id: 'rule-chaining',
      label: 'Rule chaining',
      detail: 'The source rule can be triggered by other automation rules. Personal AI blocks that by default for the imported copy.',
      severity: 'medium',
    });
  }

  items.push({
    id: 'version-compatibility',
    label: 'Jira Automation version',
    detail: 'Use exports from the same Jira Automation version when possible. Jira may reject incompatible JSON.',
    severity: 'low',
  });

  return items;
}
