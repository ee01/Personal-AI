import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAppScriptManifestSource,
  isDomainPolicyAccessError,
} from '../AppScriptUpdater.js';

const DOMAIN_POLICY_ERROR = JSON.stringify({
  error: {
    code: 400,
    message: 'ANYONE access has been disabled by your domain administrator.',
    status: 'INVALID_ARGUMENT',
  },
});

test('never declares executionApi, the field domain policy rejects', () => {
  const manifest = JSON.parse(
    buildAppScriptManifestSource({ timeZone: 'Asia/Shanghai' }),
  );

  assert.equal('executionApi' in manifest, false);
});

test('drops executionApi carried by an older Personal AI manifest', () => {
  const manifest = JSON.parse(
    buildAppScriptManifestSource({
      timeZone: 'Asia/Shanghai',
      existingManifestSource: JSON.stringify({
        timeZone: 'America/Los_Angeles',
        runtimeVersion: 'V8',
        webapp: { access: 'ANYONE_ANONYMOUS', executeAs: 'USER_DEPLOYING' },
        executionApi: { access: 'ANYONE' },
      }),
    }),
  );

  assert.equal('executionApi' in manifest, false);
  assert.equal(manifest.webapp.access, 'ANYONE_ANONYMOUS');
});

test('preserves the deployed Web App access instead of re-declaring it', () => {
  const manifest = JSON.parse(
    buildAppScriptManifestSource({
      timeZone: 'Asia/Shanghai',
      existingManifestSource: JSON.stringify({
        webapp: { access: 'DOMAIN', executeAs: 'USER_DEPLOYING' },
      }),
    }),
  );

  assert.equal(manifest.webapp.access, 'DOMAIN');
});

test('keeps manifest keys the rewrite used to silently drop', () => {
  const manifest = JSON.parse(
    buildAppScriptManifestSource({
      timeZone: 'Asia/Shanghai',
      existingManifestSource: JSON.stringify({
        oauthScopes: ['https://www.googleapis.com/auth/spreadsheets'],
        dependencies: { enabledAdvancedServices: [] },
        webapp: { access: 'ANYONE_ANONYMOUS', executeAs: 'USER_DEPLOYING' },
      }),
    }),
  );

  assert.deepEqual(manifest.oauthScopes, [
    'https://www.googleapis.com/auth/spreadsheets',
  ]);
  assert.deepEqual(manifest.dependencies, { enabledAdvancedServices: [] });
});

test('defaults to anonymous Web App access when no manifest exists', () => {
  const manifest = JSON.parse(
    buildAppScriptManifestSource({ timeZone: 'Asia/Shanghai' }),
  );

  assert.equal(manifest.webapp.access, 'ANYONE_ANONYMOUS');
  assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
  assert.equal(manifest.timeZone, 'Asia/Shanghai');
  assert.equal(manifest.runtimeVersion, 'V8');
});

test('falls back to defaults when the existing manifest is unparseable', () => {
  const manifest = JSON.parse(
    buildAppScriptManifestSource({
      timeZone: 'Asia/Shanghai',
      existingManifestSource: '{ not json',
    }),
  );

  assert.equal(manifest.webapp.access, 'ANYONE_ANONYMOUS');
  assert.equal('executionApi' in manifest, false);
});

test('recognizes the domain-policy rejection', () => {
  assert.equal(isDomainPolicyAccessError(DOMAIN_POLICY_ERROR), true);
  assert.equal(
    isDomainPolicyAccessError('{"error":{"message":"Requested entity was not found."}}'),
    false,
  );
  assert.equal(
    isDomainPolicyAccessError('Cannot create more versions'),
    false,
  );
});
