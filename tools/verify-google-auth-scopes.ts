import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type AuthResponse = {
  token?: string;
  grantedScopes?: string[];
  error?: string;
};

const authResponses: AuthResponse[] = [];
const authRequests: Array<{ interactive?: boolean; scopes?: string[] }> = [];
const removedTokens: string[] = [];
const storage = new Map<string, unknown>();

const chromeMock = {
  runtime: {
    lastError: undefined as { message: string } | undefined,
  },
  identity: {
    getAuthToken(
      details: { interactive?: boolean; scopes?: string[] },
      callback: (token?: string, grantedScopes?: string[]) => void,
    ) {
      authRequests.push({
        interactive: details.interactive,
        scopes: details.scopes ? [...details.scopes] : undefined,
      });
      const response = authResponses.shift() || {};
      chromeMock.runtime.lastError = response.error
        ? { message: response.error }
        : undefined;
      callback(response.token, response.grantedScopes);
      chromeMock.runtime.lastError = undefined;
    },
    removeCachedAuthToken(
      details: { token: string },
      callback: () => void,
    ) {
      removedTokens.push(details.token);
      callback();
    },
  },
  storage: {
    local: {
      async get(key: string) {
        return { [key]: storage.get(key) };
      },
      async set(values: Record<string, unknown>) {
        Object.entries(values).forEach(([key, value]) => storage.set(key, value));
      },
      async remove(key: string) {
        storage.delete(key);
      },
    },
  },
};

(globalThis as typeof globalThis & { chrome: typeof chromeMock }).chrome = chromeMock;

const {
  GOOGLE_AUTH_SCOPES,
  GOOGLE_AUTH_SCOPE_SETS,
  formatGoogleAuthFailure,
  getGoogleAuthTokenResult,
  getGoogleAuthTokenSilentlyResult,
} = await import('../src/utils/googleAuth');

function resetHarness(...responses: AuthResponse[]) {
  authResponses.splice(0, authResponses.length, ...responses);
  authRequests.splice(0, authRequests.length);
  removedTokens.splice(0, removedTokens.length);
}

assert.equal(GOOGLE_AUTH_SCOPE_SETS.FULL.length, 9);
assert.deepEqual(
  GOOGLE_AUTH_SCOPE_SETS.SHEETS,
  [GOOGLE_AUTH_SCOPES.SPREADSHEETS],
);
assert.deepEqual(
  GOOGLE_AUTH_SCOPE_SETS.SLIDES,
  [GOOGLE_AUTH_SCOPES.PRESENTATIONS],
);

resetHarness({
  token: 'sheets-token',
  grantedScopes: [GOOGLE_AUTH_SCOPES.SPREADSHEETS],
});
const sheetsResult = await getGoogleAuthTokenResult({
  caller: 'verify.sheets',
  scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
});
assert.equal(sheetsResult.token, 'sheets-token');
assert.deepEqual(sheetsResult.missingScopes, []);
assert.deepEqual(authRequests, [{
  interactive: false,
  scopes: [GOOGLE_AUTH_SCOPES.SPREADSHEETS],
}]);

resetHarness(
  {
    token: 'partial-cached-token',
    grantedScopes: [GOOGLE_AUTH_SCOPES.PRESENTATIONS],
  },
  {
    token: 'partial-interactive-token',
    grantedScopes: [GOOGLE_AUTH_SCOPES.PRESENTATIONS],
  },
);
const partialResult = await getGoogleAuthTokenResult({
  caller: 'verify.partial',
  scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
});
assert.equal(partialResult.token, null);
assert.equal(partialResult.failureReason, 'missing_scopes');
assert.deepEqual(partialResult.missingScopes, [GOOGLE_AUTH_SCOPES.SPREADSHEETS]);
assert.deepEqual(removedTokens, ['partial-cached-token']);
assert.equal(authRequests[1]?.interactive, true);
assert.match(formatGoogleAuthFailure(partialResult), /Google Sheets/);

resetHarness(
  { error: 'OAuth2 not granted or revoked.' },
  {
    token: 'full-token',
    grantedScopes: [...GOOGLE_AUTH_SCOPE_SETS.FULL],
  },
);
const fullResult = await getGoogleAuthTokenResult({
  caller: 'verify.full',
  scopes: GOOGLE_AUTH_SCOPE_SETS.FULL,
});
assert.equal(fullResult.token, 'full-token');
assert.deepEqual(authRequests[1]?.scopes, [...GOOGLE_AUTH_SCOPE_SETS.FULL]);
assert.equal(authRequests[1]?.interactive, true);

resetHarness({ error: 'The user is not signed in.' });
const silentFailure = await getGoogleAuthTokenSilentlyResult({
  caller: 'verify.silent',
  scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
});
assert.equal(silentFailure.token, null);
assert.equal(silentFailure.failureReason, 'auth_error');
assert.equal(formatGoogleAuthFailure(silentFailure), 'The user is not signed in.');

const manifest = JSON.parse(readFileSync('src/manifest.json', 'utf8'));
assert.deepEqual(
  manifest.oauth2.scopes,
  [...GOOGLE_AUTH_SCOPE_SETS.FULL],
  'Manifest and One Click full scope contract must stay aligned',
);

const oneClickSource = readFileSync(
  'src/scheduled-messages/components/OneClickSetup.tsx',
  'utf8',
);
assert.match(
  oneClickSource,
  /caller: 'OneClickSetup\.getAuthToken',[\s\S]{0,160}scopes: GOOGLE_AUTH_SCOPE_SETS\.FULL/,
  'One Click Setup must keep the complete scope request',
);

const managerSource = readFileSync(
  'src/scheduled-messages/ScheduledMessagesManager.tsx',
  'utf8',
);
assert.match(
  managerSource,
  /caller: 'ScheduledMessagesManager\.init',[\s\S]{0,120}scopes: GOOGLE_AUTH_SCOPE_SETS\.SHEETS/,
  'Scheduled Messages initialization must request only Sheets',
);
assert.match(
  managerSource,
  /本次不会请求 Google Slides 权限/,
  'Scheduled Messages recovery UI must state its no-Slides boundary',
);

const backgroundSource = readFileSync('src/background.ts', 'utf8');
assert.match(
  backgroundSource,
  /caller: 'background\.analyzeSlides',[\s\S]{0,100}scopes: GOOGLE_AUTH_SCOPE_SETS\.SLIDES/,
  'Background Slides analysis must request only Slides',
);

const serviceSource = readFileSync(
  'src/scheduled-messages/ScheduledMessageService.ts',
  'utf8',
);
assert.match(
  serviceSource,
  /caller: 'ScheduledMessageService\.refreshToken',[\s\S]{0,140}scopes: GOOGLE_AUTH_SCOPE_SETS\.SHEETS/,
  'Scheduled Messages refresh must retain its Sheets scope',
);
assert.match(
  serviceSource,
  /ACCESS_TOKEN_SCOPE_INSUFFICIENT[\s\S]{0,260}Google Sheets 授权不完整/,
  'Sheets API scope failures must be distinguished from ordinary access errors',
);

console.log('✅ Google auth scope verifier passed');
