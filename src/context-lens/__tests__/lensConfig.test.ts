import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONTEXT_LENS_ENABLED_CONFIG_KEY,
  isContextLensEnabledFromConfig,
  isPassiveContextLensSurface,
  shouldRequestPassiveContextRecall,
} from '../lensConfig.ts';
import { normalizeEnvConfigShape } from '../../utils.ts';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('isContextLensEnabledFromConfig: defaults ON unless explicitly false', () => {
  assert.equal(isContextLensEnabledFromConfig(undefined), true);
  assert.equal(isContextLensEnabledFromConfig(null), true);
  assert.equal(isContextLensEnabledFromConfig({}), true);
  assert.equal(
    isContextLensEnabledFromConfig({ [CONTEXT_LENS_ENABLED_CONFIG_KEY]: true }),
    true,
  );
  assert.equal(
    isContextLensEnabledFromConfig({ [CONTEXT_LENS_ENABLED_CONFIG_KEY]: false }),
    false,
  );
});

test('isPassiveContextLensSurface: only webpage/meeting/popup/follow_thread', () => {
  assert.equal(isPassiveContextLensSurface('web_passive'), true);
  assert.equal(isPassiveContextLensSurface('meeting_passive'), true);
  assert.equal(isPassiveContextLensSurface('popup_passive'), true);
  assert.equal(isPassiveContextLensSurface('follow_thread'), true);
  assert.equal(isPassiveContextLensSurface('composer_guard'), false);
  assert.equal(isPassiveContextLensSurface('meeting_assist'), false);
  assert.equal(isPassiveContextLensSurface(undefined), false);
});

test('shouldRequestPassiveContextRecall: Lens off stops passive surfaces only', () => {
  const off = { CONTEXT_LENS_ENABLED: false };
  const on = { CONTEXT_LENS_ENABLED: true };

  assert.equal(
    shouldRequestPassiveContextRecall({ surface: 'web_passive' }, off),
    false,
  );
  assert.equal(
    shouldRequestPassiveContextRecall({ surface: 'meeting_passive' }, off),
    false,
  );
  assert.equal(
    shouldRequestPassiveContextRecall({ surface: 'popup_passive' }, off),
    false,
  );
  assert.equal(
    shouldRequestPassiveContextRecall({ surface: 'follow_thread' }, off),
    false,
  );
  assert.equal(
    shouldRequestPassiveContextRecall(
      { surface: 'web_passive', contextType: 'selected_text' },
      off,
    ),
    true,
  );
  assert.equal(
    shouldRequestPassiveContextRecall({ surface: 'composer_guard' }, off),
    true,
  );
  assert.equal(
    shouldRequestPassiveContextRecall({ surface: 'web_passive' }, on),
    true,
  );
  assert.equal(
    shouldRequestPassiveContextRecall({ surface: 'web_passive' }, {}),
    true,
  );
});

test('normalizeEnvConfigShape: Assist and Lens default ON independently', () => {
  const empty = normalizeEnvConfigShape({});
  assert.equal(empty.CONTEXT_ASSIST_ENABLED, true);
  assert.equal(empty.COMPOSE_ASSIST_ENABLED, true);
  assert.equal(empty.CONTEXT_LENS_ENABLED, true);

  const lensOff = normalizeEnvConfigShape({ CONTEXT_LENS_ENABLED: false });
  assert.equal(lensOff.CONTEXT_LENS_ENABLED, false);
  assert.equal(lensOff.CONTEXT_ASSIST_ENABLED, true);
  assert.equal(lensOff.COMPOSE_ASSIST_ENABLED, true);

  const assistOff = normalizeEnvConfigShape({ CONTEXT_ASSIST_ENABLED: false });
  assert.equal(assistOff.CONTEXT_ASSIST_ENABLED, false);
  assert.equal(assistOff.COMPOSE_ASSIST_ENABLED, false);
  assert.equal(assistOff.CONTEXT_LENS_ENABLED, true);
});

test('Options renders Lens toggle near Memory Lens copy with !== false default', () => {
  const optionsSource = readFileSync(join(srcRoot, 'options.tsx'), 'utf8');
  assert.match(optionsSource, /id="CONTEXT_LENS_ENABLED"/);
  assert.match(
    optionsSource,
    /checked=\{config\.CONTEXT_LENS_ENABLED !== false\}/,
  );
  assert.match(optionsSource, /id="CONTEXT_ASSIST_ENABLED"/);
  assert.match(
    optionsSource,
    /checked=\{config\.CONTEXT_ASSIST_ENABLED !== false\}/,
  );
  const lensIndex = optionsSource.indexOf('id="CONTEXT_LENS_ENABLED"');
  const memoryLensHeading = optionsSource.indexOf(
    "t('options.sections.memoryLens')",
  );
  const siteMute = optionsSource.indexOf('<ContextSiteMuteSettings');
  assert.ok(memoryLensHeading !== -1);
  assert.ok(lensIndex > memoryLensHeading);
  assert.ok(siteMute === -1 || lensIndex < siteMute);
});
