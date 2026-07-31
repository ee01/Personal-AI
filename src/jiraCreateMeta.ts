/**
 * Jira `createmeta` lookup used by Roadmap's two-phase issue creation.
 *
 * Issue type names and field availability differ per Jira project (the sub-task
 * type is called "Sub-task", "子任务" or "Subtask" depending on the instance),
 * so the extension asks Jira what actually exists instead of hardcoding names
 * or trusting the hierarchy hints parsed from the team JQL.
 */

import { getJiraBaseUrl, jiraFetchViaBackground } from './jira';

/** RingCentral Jira custom fields used by Roadmap's create calls. */
export const JIRA_FIELD_TARGET_START = 'customfield_18350';
export const JIRA_FIELD_TARGET_END = 'customfield_18351';
export const JIRA_FIELD_QUARTER = 'customfield_21998';
/** Epic Name — Jira Server rejects an Epic create without it. */
export const JIRA_FIELD_EPIC_NAME = 'customfield_11451';
/** Parent Link: hangs an Epic under an Initiative. */
export const JIRA_FIELD_PARENT_LINK = 'customfield_15751';
/** Epic Link: hangs a Task under an Epic. */
export const JIRA_FIELD_EPIC_LINK = 'customfield_11450';

export interface JiraAllowedValue {
  id?: string;
  value?: string;
  name?: string;
}

export interface JiraFieldMeta {
  fieldId: string;
  name: string;
  required: boolean;
  hasDefaultValue: boolean;
  schemaType?: string;
  schemaItems?: string;
  allowedValues?: JiraAllowedValue[];
}

export interface JiraIssueTypeMeta {
  id: string;
  name: string;
  subtask: boolean;
  fields: Record<string, JiraFieldMeta>;
}

export interface JiraProjectCreateMeta {
  projectKey: string;
  issueTypes: JiraIssueTypeMeta[];
  /** Jira answered, but this project exposes no creatable type to the caller. */
  empty: boolean;
}

/** Per page session, keyed by upper-cased project key. */
const projectMetaCache = new Map<string, Promise<JiraProjectCreateMeta | null>>();

export function clearJiraCreateMetaCache(): void {
  projectMetaCache.clear();
}

function mapFields(raw: unknown): Record<string, JiraFieldMeta> {
  const out: Record<string, JiraFieldMeta> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [fieldId, value] of Object.entries(raw as Record<string, any>)) {
    out[fieldId] = {
      fieldId,
      name: String(value?.name || fieldId),
      required: Boolean(value?.required),
      hasDefaultValue: Boolean(value?.hasDefaultValue),
      schemaType: value?.schema?.type ? String(value.schema.type) : undefined,
      schemaItems: value?.schema?.items ? String(value.schema.items) : undefined,
      allowedValues: Array.isArray(value?.allowedValues)
        ? (value.allowedValues as JiraAllowedValue[])
        : undefined,
    };
  }
  return out;
}

async function fetchProjectCreateMeta(
  projectKey: string,
  requestKey: string,
): Promise<JiraProjectCreateMeta> {
  const baseUrl = await getJiraBaseUrl();
  const url =
    `${baseUrl}/rest/api/2/issue/createmeta` +
    `?projectKeys=${encodeURIComponent(requestKey)}` +
    `&expand=projects.issuetypes.fields`;
  const response = await jiraFetchViaBackground(url, {
    method: 'GET',
    requestLabel: 'roadmap createmeta',
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`createmeta ${response.status}: ${text.slice(0, 200)}`);
  }
  const data = await response.json();
  const projects = Array.isArray(data?.projects) ? data.projects : [];
  const project =
    projects.find(
      (item: any) => String(item?.key || '').toUpperCase() === projectKey,
    ) || projects[0];
  const issueTypes: JiraIssueTypeMeta[] = (
    Array.isArray(project?.issuetypes) ? project.issuetypes : []
  ).map((type: any) => ({
    id: String(type?.id || ''),
    name: String(type?.name || ''),
    subtask: Boolean(type?.subtask),
    fields: mapFields(type?.fields),
  }));
  return {
    projectKey,
    issueTypes,
    empty: issueTypes.length === 0,
  };
}

/**
 * Returns null when Jira could not be asked (offline, no permission, …) so the
 * caller can fall back to whatever the page told it instead of blocking.
 */
export async function getJiraProjectCreateMeta(
  projectKey: string,
): Promise<JiraProjectCreateMeta | null> {
  const requestKey = String(projectKey || '').trim();
  const key = requestKey.toUpperCase();
  if (!key) return null;
  const cached = projectMetaCache.get(key);
  if (cached) return cached;
  const pending = fetchProjectCreateMeta(key, requestKey).catch((error) => {
    // A transient failure must not blind the rest of the session.
    projectMetaCache.delete(key);
    console.warn('[pai-roadmap] createmeta lookup failed', key, error);
    return null;
  });
  projectMetaCache.set(key, pending);
  return pending;
}

function normalizeName(value: string): string {
  return String(value || '')
    .replace(/[\s_-]+/g, '')
    .toLowerCase();
}

export function findIssueType(
  meta: JiraProjectCreateMeta | null,
  name: string,
): JiraIssueTypeMeta | null {
  if (!meta) return null;
  const wanted = normalizeName(name);
  if (!wanted) return null;
  return (
    meta.issueTypes.find((type) => normalizeName(type.name) === wanted) || null
  );
}

/** The real sub-task type of this project; its name varies per Jira instance. */
export function findSubtaskIssueType(
  meta: JiraProjectCreateMeta | null,
): JiraIssueTypeMeta | null {
  if (!meta) return null;
  return meta.issueTypes.find((type) => type.subtask) || null;
}

export function looksLikeSubtaskName(name: string): boolean {
  const normalized = normalizeName(name);
  return normalized.includes('subtask') || name.includes('子任务');
}

export function listIssueTypeNames(meta: JiraProjectCreateMeta | null): string[] {
  return (meta?.issueTypes || []).map((type) => type.name).filter(Boolean);
}

export function findFieldIdByName(
  type: JiraIssueTypeMeta | null,
  fieldName: string,
): string | null {
  if (!type) return null;
  const wanted = normalizeName(fieldName);
  const hit = Object.values(type.fields).find(
    (field) => normalizeName(field.name) === wanted,
  );
  return hit ? hit.fieldId : null;
}

export function supportsField(
  type: JiraIssueTypeMeta | null,
  fieldId: string,
): boolean {
  return Boolean(type?.fields?.[fieldId]);
}

/**
 * Required fields this create call leaves empty — Jira's own rejection message
 * is usually enough, but listing them makes the per-row error actionable.
 */
export function listMissingRequiredFields(
  type: JiraIssueTypeMeta | null,
  filledFieldIds: Iterable<string>,
): string[] {
  if (!type) return [];
  const filled = new Set(filledFieldIds);
  return Object.values(type.fields)
    .filter(
      (field) =>
        field.required && !field.hasDefaultValue && !filled.has(field.fieldId),
    )
    .map((field) => `${field.name}(${field.fieldId})`);
}

/** How a child issue hangs off its parent: a real sub-task, or a link field. */
export type ChildLink = { mode: 'parent' } | { mode: 'field'; fieldId: string };

export interface JiraCreateFieldsInput {
  projectKey: string;
  typeName: string;
  typeMeta: JiraIssueTypeMeta | null;
  summary: string;
  targetStart?: string | null;
  targetEnd?: string | null;
  quarter?: string | null;
  link?: ChildLink & { parentKey: string };
}

/**
 * The `fields` object posted to `/rest/api/2/issue`.
 *
 * Split out of the create call so the payload can be asserted without talking
 * to Jira: an unsupported field id makes Jira reject the *whole* create, so
 * which optional fields are included is the load-bearing part of this code.
 */
export function buildJiraCreateFields(
  input: JiraCreateFieldsInput,
): Record<string, unknown> {
  const { typeMeta } = input;
  const summary = String(input.summary || '').trim() || 'Untitled';
  const fields: Record<string, unknown> = {
    project: { key: input.projectKey },
    issuetype: { name: input.typeName },
    summary,
  };

  if (input.link) {
    if (input.link.mode === 'parent') {
      fields.parent = { key: input.link.parentKey };
    } else {
      fields[input.link.fieldId] = input.link.parentKey;
    }
  }

  // Without createmeta we cannot tell which optional fields are on the create
  // screen, so only Epic Name (which Jira demands) is sent on a blind create.
  const epicNameField = typeMeta
    ? findFieldIdByName(typeMeta, 'Epic Name')
    : /^epic$/i.test(input.typeName)
      ? JIRA_FIELD_EPIC_NAME
      : null;
  if (epicNameField) {
    fields[epicNameField] = summary.slice(0, 255);
  }

  if (typeMeta) {
    if (input.targetStart && supportsField(typeMeta, JIRA_FIELD_TARGET_START)) {
      fields[JIRA_FIELD_TARGET_START] = input.targetStart;
    }
    if (input.targetEnd && supportsField(typeMeta, JIRA_FIELD_TARGET_END)) {
      fields[JIRA_FIELD_TARGET_END] = input.targetEnd;
    }
    if (input.quarter) {
      const quarterValue = buildFieldValue(
        typeMeta.fields[JIRA_FIELD_QUARTER],
        input.quarter,
      );
      if (quarterValue !== undefined) {
        fields[JIRA_FIELD_QUARTER] = quarterValue;
      }
    }
  }

  return fields;
}

function tokenSignature(value: string): string {
  return String(value || '')
    .toUpperCase()
    .split(/[^0-9A-Z]+/)
    .filter(Boolean)
    .sort()
    .join('|');
}

/**
 * Shapes a value for an option-like field, matching it against `allowedValues`.
 * Returns undefined when the field cannot accept the value, so the caller can
 * skip it rather than have Jira reject the whole create.
 */
export function buildFieldValue(
  field: JiraFieldMeta | undefined,
  raw: string,
): unknown {
  const text = String(raw || '').trim();
  if (!field || !text) return undefined;
  const isOption =
    field.schemaType === 'option' ||
    field.schemaType === 'array' ||
    Array.isArray(field.allowedValues);
  if (!isOption) return text;

  const allowed = field.allowedValues || [];
  if (!allowed.length) return text;
  const wanted = tokenSignature(text);
  const hit =
    allowed.find(
      (option) =>
        String(option.value ?? option.name ?? '').trim().toLowerCase() ===
        text.toLowerCase(),
    ) ||
    allowed.find(
      (option) => tokenSignature(String(option.value ?? option.name ?? '')) === wanted,
    );
  if (!hit) return undefined;

  const single = hit.id ? { id: hit.id } : { value: hit.value ?? hit.name };
  return field.schemaType === 'array' ? [single] : single;
}
