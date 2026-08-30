/**
 * Single operational switch for Compose Assist.
 *
 * Assist exists to produce insertable suggestion text. The old pair
 * COMPOSER_SENDABLE_GENERATION_ENABLED / COMPOSER_PROMPT_COMPILER_ENABLED was a
 * grayscale leftover: two booleans with inconsistent defaults that could
 * silently disable the product while tests stayed green.
 *
 *   off           — the assist endpoint returns nothing; no recall, no LLM
 *   context_only  — recall still runs (debug / Lens-adjacent evidence) but no
 *                   insertable text is generated. Emergency impersonation kill.
 *   full          — generate sendable drafts and run the Web AI compiler
 *
 * Unset means `full`. Retired flags still map for one release so a host that
 * had SENDABLE=false does not suddenly start writing as the user.
 */

export type ComposerAssistMode = 'off' | 'context_only' | 'full';

function parseOptionalBooleanEnv(name: string): boolean | null {
  const raw = process.env[name];
  if (raw === undefined) return null;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

export function resolveComposerAssistMode(): ComposerAssistMode {
  const raw = process.env.COMPOSER_ASSIST_MODE?.trim().toLowerCase();
  if (raw === 'off' || raw === 'context_only' || raw === 'full') return raw;

  const sendable = parseOptionalBooleanEnv(
    'COMPOSER_SENDABLE_GENERATION_ENABLED',
  );
  if (sendable === false) {
    console.warn(
      '[composer] COMPOSER_SENDABLE_GENERATION_ENABLED is retired; treating false as COMPOSER_ASSIST_MODE=context_only. Set COMPOSER_ASSIST_MODE explicitly.',
    );
    return 'context_only';
  }

  const compiler = parseOptionalBooleanEnv('COMPOSER_PROMPT_COMPILER_ENABLED');
  if (compiler === false) {
    console.warn(
      '[composer] COMPOSER_PROMPT_COMPILER_ENABLED is retired and ignored. Use COMPOSER_ASSIST_MODE=context_only to disable insertable generation.',
    );
  }

  return 'full';
}

export function isComposerGenerationEnabled(): boolean {
  return resolveComposerAssistMode() === 'full';
}
