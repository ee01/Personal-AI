const JIRA_TICKET_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/g;

function flattenSuggestionValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    const result: string[] = [];
    for (const item of value) {
      result.push(...flattenSuggestionValue(item));
    }
    return result;
  }

  if (typeof value !== 'string') {
    return [];
  }

  const trimmed = value.trim();
  return trimmed ? [trimmed] : [];
}

export function joinSuggestionText(...values: unknown[]): string {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const value of values) {
    for (const part of flattenSuggestionValue(value)) {
      const normalized = normalizeComparableText(part);
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      parts.push(part);
    }
  }

  return parts.join('\n');
}

export function normalizeComparableText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function splitSuggestionLines(value: unknown): string[] {
  return flattenSuggestionValue(value)
    .flatMap(part => part.split(/\r?\n/))
    .map(part => part.trim())
    .filter(Boolean);
}

export function getNewSuggestionText(
  existingText: unknown,
  suggestedText: unknown,
): string {
  const existing = normalizeComparableText(existingText);
  const suggested = normalizeComparableText(suggestedText);

  if (!suggested) {
    return '';
  }

  if (existing.includes(suggested)) {
    return '';
  }

  const existingLines = new Set(
    splitSuggestionLines(existingText).map(line => normalizeComparableText(line)),
  );
  const seenSuggestionLines = new Set<string>();
  const newLines: string[] = [];

  for (const line of splitSuggestionLines(suggestedText)) {
    const normalizedLine = normalizeComparableText(line);
    if (!normalizedLine || seenSuggestionLines.has(normalizedLine)) {
      continue;
    }

    seenSuggestionLines.add(normalizedLine);

    if (existingLines.has(normalizedLine)) {
      continue;
    }

    if (normalizedLine.length >= 8 && existing.includes(normalizedLine)) {
      continue;
    }

    newLines.push(line);
  }

  return newLines.join('\n');
}

export function containsSuggestionText(
  existingText: unknown,
  suggestedText: unknown,
): boolean {
  return getNewSuggestionText(existingText, suggestedText) === '';
}

export function extractJiraTicketKeys(...values: unknown[]): string[] {
  const keys = new Set<string>();

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const matches = value.match(JIRA_TICKET_PATTERN) || [];
    for (const match of matches) {
      keys.add(match);
    }
  }

  return Array.from(keys);
}

export function findFirstJiraTicketKey(value: unknown): string | undefined {
  return extractJiraTicketKeys(value)[0];
}

export function hasJiraTicketKey(value: unknown): boolean {
  return findFirstJiraTicketKey(value) !== undefined;
}
