/**
 * Guards the sampling-parameter compatibility policy.
 *
 * A wrong answer here is invisible until a request 400s in production with
 * "Unsupported value: 'temperature' does not support 0.3 with this model",
 * so the model-name matrix is pinned rather than eyeballed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSamplingPayload,
  buildTokenLimitPayload,
  isOpenAIReasoningModel,
  normalizeModelId,
  resolveTemperature,
  SCENARIO_TEMPERATURE,
  supportsCustomSampling,
} from '../modelSampling.js';

const SAMPLING_LOCKED = [
  'o1',
  'o1-mini',
  'o1-preview',
  'o3',
  'o3-mini',
  'o3-mini-2025-01-31',
  'o3-pro',
  'o4-mini',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5.1',
  'gpt-5-mini-2025-08-07',
  'claude-opus-4-7',
  'claude-opus-4-7-20260416',
  'claude-opus-4-8',
  'claude-sonnet-5',
  'openai/o3-mini',
  'us.anthropic.claude-opus-4-7',
  'vertex_ai/claude-opus-4-7@default',
];

const SAMPLING_OK = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-5-chat-latest',
  'gpt-5.1-chat',
  'claude-3-7-sonnet',
  'claude-sonnet-4-5',
  'deepseek-ai/deepseek-r1',
  'qwen3.6:latest',
  'llama3',
  'mixtral-8x7b-32768',
];

test('locked model families reject custom sampling', () => {
  for (const model of SAMPLING_LOCKED) {
    assert.equal(
      supportsCustomSampling(model),
      false,
      `${model} should be treated as sampling-locked`,
    );
    assert.deepEqual(buildSamplingPayload(model, { temperature: 0.3 }), {});
    assert.equal(resolveTemperature(model, { temperature: 0.3 }), undefined);
  }
});

test('ordinary models keep temperature and top_p', () => {
  for (const model of SAMPLING_OK) {
    assert.equal(
      supportsCustomSampling(model),
      true,
      `${model} should keep sampling params`,
    );
  }

  assert.deepEqual(
    buildSamplingPayload('gpt-4o-mini', { temperature: 0.3, topP: 0.9 }),
    { temperature: 0.3, top_p: 0.9 },
  );
});

test('scenario presets drive temperature when none is given', () => {
  assert.equal(
    resolveTemperature('gpt-4o-mini', { scenario: 'extraction' }),
    SCENARIO_TEMPERATURE.extraction,
  );
  assert.equal(
    resolveTemperature('gpt-4o-mini', { scenario: 'creative' }),
    SCENARIO_TEMPERATURE.creative,
  );
  // 未标注场景时保持历史默认 0.3
  assert.equal(resolveTemperature('gpt-4o-mini'), 0.3);
  // 显式 temperature 覆盖场景
  assert.equal(
    resolveTemperature('gpt-4o-mini', { scenario: 'creative', temperature: 0 }),
    0,
  );
});

test('OpenAI reasoning models switch to max_completion_tokens', () => {
  assert.deepEqual(buildTokenLimitPayload('o3-mini', 2000), {
    max_completion_tokens: 2000,
  });
  assert.deepEqual(buildTokenLimitPayload('gpt-5-mini', 2000), {
    max_completion_tokens: 2000,
  });
  assert.deepEqual(buildTokenLimitPayload('gpt-4o-mini', 2000), {
    max_tokens: 2000,
  });
  // Anthropic 仍然使用 max_tokens，只是不接受采样参数
  assert.equal(isOpenAIReasoningModel('claude-opus-4-7'), false);
  assert.deepEqual(buildTokenLimitPayload('claude-opus-4-7', 2000), {
    max_tokens: 2000,
  });
  assert.deepEqual(buildTokenLimitPayload('gpt-4o-mini', undefined), {});
});

test('gateway prefixes are normalized before matching', () => {
  assert.equal(normalizeModelId('openai/o3-mini'), 'o3-mini');
  assert.equal(
    normalizeModelId('us.anthropic.claude-opus-4-7'),
    'claude-opus-4-7',
  );
  assert.equal(
    normalizeModelId('vertex_ai/claude-opus-4-7@default'),
    'claude-opus-4-7',
  );
  assert.equal(normalizeModelId('  GPT-4o-Mini '), 'gpt-4o-mini');
});

test('unknown or empty model names keep sampling enabled', () => {
  assert.equal(supportsCustomSampling(''), true);
  assert.equal(supportsCustomSampling('some-private-model'), true);
});
