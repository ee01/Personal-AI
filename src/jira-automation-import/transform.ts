export const JIRA_AUTOMATION_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const JIRA_AUTOMATION_IMPORT_MAX_RULE_NAME_LENGTH = 255;
const JIRA_AUTOMATION_IMPORT_RULE_NAME_PREFIX = '(Imported by Personal AI) ';

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
  projectTypeKey?: string;
  ownerId?: string;
  allowOtherRuleTrigger?: boolean;
  now?: number;
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
  sourceProjectReferenceCount: number;
  scheduledTrigger: boolean;
}

export interface JiraAutomationRuleReviewSignals {
  jqlReferences: string[];
  hardcodedUrls: string[];
  emailReferences: string[];
  sourceProjectReferences: string[];
}

export type JiraAutomationImportReviewSeverity = 'high' | 'medium' | 'low';

export interface JiraAutomationImportReviewChecklistItem {
  id: string;
  label: string;
  detail: string;
  severity: JiraAutomationImportReviewSeverity;
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

function addReviewSignal(values: Set<string>, value: string): void {
  const normalized = normalizeReviewSignal(value);
  if (normalized) {
    values.add(normalized);
  }
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
  return /\b(project|issuetype|status|assignee|reporter|labels?|fixversion|component)\s*(=|!=|~|!~|in\b|not\s+in\b|is\b)/i.test(text);
}

function collectReviewSignals(
  value: unknown,
  key: string,
  sourceProjectTokens: string[],
  jqlReferences: Set<string>,
  hardcodedUrls: Set<string>,
  emailReferences: Set<string>,
  sourceProjectReferences: Set<string>,
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectReviewSignals(
      item,
      key,
      sourceProjectTokens,
      jqlReferences,
      hardcodedUrls,
      emailReferences,
      sourceProjectReferences,
    ));
    return;
  }

  if (typeof value === 'string') {
    if (isLikelyJqlReference(key, value)) {
      addReviewSignal(jqlReferences, value);
    }

    const urls = value.match(/https?:\/\/[^\s"'<>]+/gi) || [];
    urls.forEach((url) => addReviewSignal(hardcodedUrls, url));

    const emails = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    emails.forEach((email) => addReviewSignal(emailReferences, email));

    if (sourceProjectTokens.length > 0 && textContainsSourceProjectToken(value, sourceProjectTokens)) {
      addReviewSignal(sourceProjectReferences, value);
    }
    return;
  }

  if (!isRecord(value)) {
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
      sourceProjectReferences,
    );
  });
}

function addSecretReferences(value: unknown, references: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => addSecretReferences(item, references));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (Array.isArray(value.usedSecretsKeys)) {
    value.usedSecretsKeys.forEach((secret, index) => {
      if (typeof secret === 'string' && secret.trim()) {
        references.add(secret.trim());
      } else if (isRecord(secret)) {
        const label = secret.key || secret.id || secret.name || secret.secretKey;
        references.add(String(label || `secret-${index + 1}`));
      }
    });
  }

  if (value.secret === true) {
    const label = value.key || value.id || value.name || value.headerName || value.keyOrValue;
    references.add(String(label || `secret-${references.size + 1}`));
  }

  Object.entries(value).forEach(([key, nestedValue]) => {
    if (key === 'usedSecretsKeys' || key === 'secret') {
      return;
    }
    addSecretReferences(nestedValue, references);
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

export function buildJiraAutomationImportedRuleName(sourceName: string): string {
  const normalizedName = sourceName.trim();
  const importedName = `${JIRA_AUTOMATION_IMPORT_RULE_NAME_PREFIX}${normalizedName}`;

  if (importedName.length <= JIRA_AUTOMATION_IMPORT_MAX_RULE_NAME_LENGTH) {
    return importedName;
  }

  const maxSourceNameLength = Math.max(
    0,
    JIRA_AUTOMATION_IMPORT_MAX_RULE_NAME_LENGTH
      - JIRA_AUTOMATION_IMPORT_RULE_NAME_PREFIX.length
      - 3,
  );
  return `${JIRA_AUTOMATION_IMPORT_RULE_NAME_PREFIX}${normalizedName.slice(0, maxSourceNameLength)}...`;
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
    sourceProjectReferenceCount: 0,
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
  summary.sourceProjectReferenceCount = reviewSignals.sourceProjectReferences.length;
  return summary;
}

export function collectJiraAutomationImportReviewSignals(
  exportedRule: ExportedRule,
): JiraAutomationRuleReviewSignals {
  const sourceProjectTokens = getSourceProjectTokens(exportedRule);
  const jqlReferences = new Set<string>();
  const hardcodedUrls = new Set<string>();
  const emailReferences = new Set<string>();
  const sourceProjectReferences = new Set<string>();

  collectReviewSignals(
    exportedRule.trigger,
    'trigger',
    sourceProjectTokens,
    jqlReferences,
    hardcodedUrls,
    emailReferences,
    sourceProjectReferences,
  );
  collectReviewSignals(
    exportedRule.components,
    'components',
    sourceProjectTokens,
    jqlReferences,
    hardcodedUrls,
    emailReferences,
    sourceProjectReferences,
  );
  collectReviewSignals(
    exportedRule.description,
    'description',
    sourceProjectTokens,
    jqlReferences,
    hardcodedUrls,
    emailReferences,
    sourceProjectReferences,
  );
  collectReviewSignals(
    exportedRule.labels,
    'labels',
    sourceProjectTokens,
    jqlReferences,
    hardcodedUrls,
    emailReferences,
    sourceProjectReferences,
  );
  collectReviewSignals(
    exportedRule.tags,
    'tags',
    sourceProjectTokens,
    jqlReferences,
    hardcodedUrls,
    emailReferences,
    sourceProjectReferences,
  );

  return {
    jqlReferences: Array.from(jqlReferences),
    hardcodedUrls: Array.from(hardcodedUrls),
    emailReferences: Array.from(emailReferences),
    sourceProjectReferences: Array.from(sourceProjectReferences),
  };
}

function remapAutomationNodeIds(
  node: unknown,
  nextId: () => string,
  id: string,
): any {
  if (!isRecord(node)) {
    return node;
  }

  const clone: Record<string, any> = {
    ...node,
    id,
  };

  ['children', 'conditions'].forEach((key) => {
    if (Array.isArray(node[key])) {
      clone[key] = node[key].map((child) => remapAutomationNodeIds(child, nextId, nextId()));
    }
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

  const now = context.now ?? Date.now();
  const projectTypeKey =
    context.projectTypeKey ||
    exportedRule.projects?.[0]?.projectTypeKey ||
    'software';
  let componentIdIndex = 0;
  const nextComponentId = () => `__NEW__COMPONENT__${now + componentIdIndex++}`;
  const actorAccountId = context.ownerId || exportedRule.actorAccountId || exportedRule.authorAccountId || '';

  const convertedComponents = exportedRule.components.map((component) => (
    remapAutomationNodeIds(component, nextComponentId, nextComponentId())
  ));

  const convertedTrigger = remapAutomationNodeIds(
    exportedRule.trigger,
    nextComponentId,
    '__NEW__TRIGGER',
  );

  const projects = [{
    projectId: context.projectId,
    projectTypeKey,
  }];

  return {
    name: buildJiraAutomationImportedRuleName(exportedRule.name),
    isNewRule: true,
    state: 'DISABLED',
    canOtherRuleTrigger: context.allowOtherRuleTrigger ?? exportedRule.canOtherRuleTrigger ?? false,
    notifyOnError: exportedRule.notifyOnError || 'FIRSTERROR',
    authorAccountId: actorAccountId,
    actorAccountId,
    created: now,
    updated: now,
    components: convertedComponents,
    trigger: convertedTrigger,
    labels: exportedRule.labels || [],
    description: exportedRule.description,
    projects,
  };
}

export function buildJiraAutomationImportWarnings(
  exportedRule: ExportedRule,
): string[] {
  const summary = summarizeJiraAutomationImportRule(exportedRule);
  const warnings = [
    'Imported rules are created disabled. Review and enable them in Jira after import.',
    'Project scope is remapped to the current Jira project.',
    'Use exports from the same Jira Automation version when possible; incompatible JSON may fail to create or run correctly.',
    'Rule actor and author are replaced with the current Jira user when Personal AI can resolve it. Verify permissions before enabling.',
  ];

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
    warnings.push('Includes secret references. Verify target Jira secrets and connections before enabling.');
  }

  if (summary.sourceProjectReferenceCount > 0) {
    warnings.push('Possible source project references were found inside the rule body. Project scope remapping does not rewrite JQL, URLs, or custom fields.');
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

  if (exportedRule.canOtherRuleTrigger) {
    warnings.push('This rule can be triggered by other rules. Keep the chained-trigger safeguard enabled unless you intentionally need that behavior.');
  }

  return warnings;
}

export function buildJiraAutomationImportReviewChecklist(
  exportedRule: ExportedRule,
): JiraAutomationImportReviewChecklistItem[] {
  const summary = summarizeJiraAutomationImportRule(exportedRule);
  const items: JiraAutomationImportReviewChecklistItem[] = [
    {
      id: 'target-project',
      label: 'Target project scope',
      detail: 'The imported copy will be scoped to the current Jira project. Embedded project keys, ids, filters, and custom text are not rewritten.',
      severity: summary.sourceProjectReferenceCount > 0 || summary.jqlReferenceCount > 0 ? 'high' : 'medium',
    },
  ];

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
    summary.emailReferenceCount > 0
  ) {
    const parts = [
      summary.webRequestCount > 0 ? `${summary.webRequestCount} web request(s)` : '',
      summary.externalIntegrationCount > 0 ? `${summary.externalIntegrationCount} external action(s)` : '',
      summary.hardcodedUrlCount > 0 ? `${summary.hardcodedUrlCount} URL(s)` : '',
      summary.secretReferenceCount > 0 ? `${summary.secretReferenceCount} secret reference(s)` : '',
      summary.emailReferenceCount > 0 ? `${summary.emailReferenceCount} account/email reference(s)` : '',
    ].filter(Boolean);

    items.push({
      id: 'external-effects',
      label: 'External effects and credentials',
      detail: `${parts.join(', ')} need endpoint, credential, and recipient review.`,
      severity: summary.webRequestCount > 0 || summary.externalIntegrationCount > 0 || summary.secretReferenceCount > 0
        ? 'high'
        : 'medium',
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
