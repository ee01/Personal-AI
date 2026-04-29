import test from 'node:test';
import assert from 'node:assert/strict';
import { getModelPath, getModelDir } from '../modelManager.js';
import { homedir } from 'node:os';
import { join } from 'node:path';

test('getModelDir returns correct macOS path', () => {
  const dir = getModelDir();
  assert.ok(dir.includes('Library'), 'should be in Library');
  assert.ok(
    dir.includes('Application Support'),
    'should be in Application Support',
  );
  assert.ok(dir.includes('Personal AI'), 'should be in Personal AI');
  assert.ok(dir.includes('whisper-models'), 'should be in whisper-models');
});

test('getModelPath returns path ending in ggml-small.bin', () => {
  const path = getModelPath();
  assert.ok(
    path.endsWith('ggml-small.bin'),
    `expected .bin extension, got: ${path}`,
  );
});

test('getModelPath is inside getModelDir', () => {
  const dir = getModelDir();
  const path = getModelPath();
  assert.ok(
    path.startsWith(dir),
    `model path ${path} should start with dir ${dir}`,
  );
});

test('getModelDir is under homedir', () => {
  const dir = getModelDir();
  assert.ok(dir.startsWith(homedir()), 'should be under home directory');
});
