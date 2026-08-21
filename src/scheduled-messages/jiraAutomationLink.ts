import type { PushMethod, ScheduledMessage } from './types';

export interface ResolveAutomationLinkForSaveInput {
  pushMethod?: PushMethod | string;
  formLink?: string;
  existingLink?: string;
}

export function resolveAutomationLinkForSave(
  input: ResolveAutomationLinkForSaveInput,
): string | undefined {
  const formLink = input.formLink?.trim() || undefined;
  const existingLink = input.existingLink?.trim() || undefined;
  if (input.pushMethod === 'Outreach') {
    return existingLink;
  }
  return formLink || existingLink;
}

export function preserveExistingAutomationLink<T extends { Automation_Link?: string }>(
  previous: T,
  updates: Partial<T>,
): Partial<T> {
  if (Object.prototype.hasOwnProperty.call(updates, 'Automation_Link') === false) {
    return updates;
  }
  if (updates.Automation_Link !== undefined) {
    return updates;
  }
  if (!previous.Automation_Link) {
    return updates;
  }

  const rest = { ...updates };
  delete rest.Automation_Link;
  return rest;
}

export function mergeScheduledMessageUpdate(
  previous: ScheduledMessage,
  updates: Partial<ScheduledMessage>,
): ScheduledMessage {
  return {
    ...previous,
    ...preserveExistingAutomationLink(previous, updates),
  };
}

export function resolveJiraRuleNameSyncLink(options: {
  savedLink?: string;
  editingLink?: string;
  formLink?: string;
}): string | undefined {
  return options.savedLink?.trim()
    || options.formLink?.trim()
    || options.editingLink?.trim()
    || undefined;
}
