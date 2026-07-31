/**
 * Dynamically register contentScriptRoadmap.js for ROADMAP_BASE_URL when the
 * origin is not already covered by the static content_scripts matches in
 * manifest.json. Options → ROADMAP_BASE_URL alone never changes MV3 matches;
 * without this, opening a custom host shows the name gate because the bridge
 * never injects.
 */

export const ROADMAP_DYNAMIC_SCRIPT_ID = 'pai-roadmap-dynamic';

/** Keep in sync with content_scripts matches for contentScriptRoadmap.js */
export const STATIC_ROADMAP_MATCHES = [
  'http://localhost:3220/*',
  'http://127.0.0.1:3220/*',
  'http://10.32.56.212:3220/*',
  'http://roadmap.xmnup.com/*',
  'https://roadmap.xmnup.com/*',
  'http://localhost:5173/*',
  'http://127.0.0.1:5173/*',
] as const;

export function roadmapMatchPatternFromBaseUrl(baseUrl: string): string | null {
  const raw = String(baseUrl || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return `${url.protocol}//${url.host}/*`;
  } catch {
    return null;
  }
}

export function isCoveredByStaticRoadmapMatch(pattern: string): boolean {
  return (STATIC_ROADMAP_MATCHES as readonly string[]).includes(pattern);
}

export async function syncRoadmapContentScript(
  baseUrl: string | undefined | null,
): Promise<{ registered: boolean; match: string | null }> {
  if (
    typeof chrome === 'undefined' ||
    !chrome.scripting?.registerContentScripts ||
    !chrome.scripting?.unregisterContentScripts
  ) {
    return { registered: false, match: null };
  }

  try {
    await chrome.scripting.unregisterContentScripts({
      ids: [ROADMAP_DYNAMIC_SCRIPT_ID],
    });
  } catch {
    // Not registered yet — fine.
  }

  const match = roadmapMatchPatternFromBaseUrl(String(baseUrl || ''));
  if (!match || isCoveredByStaticRoadmapMatch(match)) {
    return { registered: false, match };
  }

  await chrome.scripting.registerContentScripts([
    {
      id: ROADMAP_DYNAMIC_SCRIPT_ID,
      js: ['contentScriptRoadmap.js'],
      matches: [match],
      runAt: 'document_idle',
      persistAcrossSessions: true,
    },
  ]);
  return { registered: true, match };
}
