import { afterEach, describe, expect, it } from 'vitest';

import {
  isComposerGenerationEnabled,
  resolveComposerAssistMode,
} from '../core/composerAssistMode.js';

describe('resolveComposerAssistMode', () => {
  const keys = [
    'COMPOSER_ASSIST_MODE',
    'COMPOSER_SENDABLE_GENERATION_ENABLED',
    'COMPOSER_PROMPT_COMPILER_ENABLED',
  ];
  const snapshot: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of keys) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
  });

  function capture(): void {
    for (const key of keys) snapshot[key] = process.env[key];
    for (const key of keys) delete process.env[key];
  }

  it('defaults to full when unset', () => {
    capture();
    expect(resolveComposerAssistMode()).toBe('full');
    expect(isComposerGenerationEnabled()).toBe(true);
  });

  it('honors COMPOSER_ASSIST_MODE over retired flags', () => {
    capture();
    process.env.COMPOSER_ASSIST_MODE = 'off';
    process.env.COMPOSER_SENDABLE_GENERATION_ENABLED = 'true';
    expect(resolveComposerAssistMode()).toBe('off');
    expect(isComposerGenerationEnabled()).toBe(false);
  });

  it('maps retired SENDABLE=false to context_only', () => {
    capture();
    process.env.COMPOSER_SENDABLE_GENERATION_ENABLED = 'false';
    expect(resolveComposerAssistMode()).toBe('context_only');
    expect(isComposerGenerationEnabled()).toBe(false);
  });
});
