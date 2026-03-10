/**
 * Convert a name to a URL-safe slug.
 *
 * - Lowercases the entire string
 * - Replaces spaces and underscores with hyphens
 * - Strips all characters that are not alphanumeric or hyphens
 * - Collapses consecutive hyphens into one
 * - Trims leading and trailing hyphens
 *
 * @param name  Human-readable name to slugify.
 * @returns     URL-safe slug string.
 */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}
