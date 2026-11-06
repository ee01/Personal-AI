/** Data-only fields requested for a separately published Schedule result. */
export interface PublishTemplateField {
  name: string;
  note: string;
  required: boolean;
}

export function normalizePublishTemplate(value: unknown): PublishTemplateField[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 32) throw new Error('publishTemplate must contain at most 32 fields');
  const names = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid publishTemplate field');
    const field = item as Record<string, unknown>;
    const name = typeof field.name === 'string' ? field.name.trim() : '';
    const note = typeof field.note === 'string' ? field.note.trim() : '';
    if (!name || name.length > 120 || note.length > 2000 || names.has(name) ||
        ['__proto__', 'constructor', 'prototype'].includes(name) ||
        (field.required !== undefined && typeof field.required !== 'boolean')) throw new Error('Invalid or duplicate publishTemplate field');
    names.add(name);
    return { name, note, required: field.required === true };
  });
}
