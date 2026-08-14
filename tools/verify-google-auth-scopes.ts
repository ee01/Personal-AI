import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type AuthResponse = {
  token?: string;
  grantedScopes?: string[];
  error?: string;
};

const authResponses: AuthResponse[] = [];
const accountAuthResponses = new Map<string, AuthResponse[]>();
const availableAccounts: Array<{ id: string }> = [];
const authRequests: Array<{ interactive?: boolean; scopes?: string[]; accountId?: string }> = [];
const removedTokens: string[] = [];
const storage = new Map<string, unknown>();

const chromeMock = {
  runtime: {
    lastError: undefined as { message: string } | undefined,
  },
  identity: {
    getAuthToken(
      details: { interactive?: boolean; scopes?: string[]; account?: { id: string } },
      callback: (token?: string, grantedScopes?: string[]) => void,
    ) {
      const request: { interactive?: boolean; scopes?: string[]; accountId?: string } = {
        interactive: details.interactive,
        scopes: details.scopes ? [...details.scopes] : undefined,
      };
      if (details.account?.id) request.accountId = details.account.id;
      authRequests.push(request);
      const accountQueue = details.account?.id
        ? accountAuthResponses.get(details.account.id)
        : undefined;
      const response = accountQueue?.shift() || authResponses.shift() || {};
      chromeMock.runtime.lastError = response.error
        ? { message: response.error }
        : undefined;
      callback(response.token, response.grantedScopes);
      chromeMock.runtime.lastError = undefined;
    },
    getAccounts(callback: (accounts: Array<{ id: string }>) => void) {
      callback([...availableAccounts]);
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
      async get(key: string | string[]) {
        const keys = Array.isArray(key) ? key : [key];
        return Object.fromEntries(keys.map((storageKey) => [storageKey, storage.get(storageKey)]));
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
  accountAuthResponses.clear();
  availableAccounts.splice(0, availableAccounts.length);
}

function configureAccounts(
  accountIds: string[],
  responses: Record<string, AuthResponse[]>,
) {
  availableAccounts.splice(
    0,
    availableAccounts.length,
    ...accountIds.map((id) => ({ id })),
  );
  accountAuthResponses.clear();
  Object.entries(responses).forEach(([accountId, accountResponses]) => {
    accountAuthResponses.set(accountId, [...accountResponses]);
  });
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

resetHarness();
configureAccounts(['personal-account', 'work-account'], {
  'personal-account': [{ error: 'OAuth2 not granted or revoked.' }],
  'work-account': [{
    token: 'work-sheets-token',
    grantedScopes: [GOOGLE_AUTH_SCOPES.SPREADSHEETS],
  }],
});
const multiAccountResult = await getGoogleAuthTokenSilentlyResult({
  caller: 'verify.multiAccount',
  scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
});
assert.equal(multiAccountResult.token, 'work-sheets-token');
assert.equal(multiAccountResult.accountId, 'work-account');
assert.equal(multiAccountResult.availableAccountCount, 2);
assert.deepEqual(
  authRequests.map((request) => request.accountId),
  ['personal-account', 'work-account'],
  'Silent auth should probe beyond the default/personal account',
);
const sheetsAccountStorageKey = `googleAuthPreferredAccountId:${GOOGLE_AUTH_SCOPES.SPREADSHEETS}`;
assert.equal(storage.get(sheetsAccountStorageKey), 'work-account');

authRequests.splice(0, authRequests.length);
configureAccounts(['personal-account', 'work-account'], {
  'work-account': [{
    token: 'work-sheets-token-2',
    grantedScopes: [GOOGLE_AUTH_SCOPES.SPREADSHEETS],
  }],
  'personal-account': [{ error: 'should not be called' }],
});
const pinnedAccountResult = await getGoogleAuthTokenSilentlyResult({
  caller: 'verify.multiAccount.pinned',
  scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
});
assert.equal(pinnedAccountResult.token, 'work-sheets-token-2');
assert.deepEqual(
  authRequests.map((request) => request.accountId),
  ['work-account'],
  'The persisted Sheets account should be tried before other Chrome accounts',
);

authRequests.splice(0, authRequests.length);
configureAccounts(['personal-account', 'work-account'], {
  'personal-account': [{
    token: 'personal-slides-token',
    grantedScopes: [GOOGLE_AUTH_SCOPES.PRESENTATIONS],
  }],
  'work-account': [{ error: 'should not be called for Slides' }],
});
const separateSlidesAccountResult = await getGoogleAuthTokenSilentlyResult({
  caller: 'verify.multiAccount.slides',
  scopes: GOOGLE_AUTH_SCOPE_SETS.SLIDES,
});
assert.equal(separateSlidesAccountResult.accountId, 'personal-account');
assert.equal(
  storage.get(sheetsAccountStorageKey),
  'work-account',
  'A Slides account choice must not overwrite the Scheduled Messages Sheets binding',
);

storage.delete(sheetsAccountStorageKey);
resetHarness({
  token: 'interactive-work-token',
  grantedScopes: [GOOGLE_AUTH_SCOPES.SPREADSHEETS],
});
configureAccounts(['personal-account', 'work-account'], {
  'personal-account': [
    { error: 'OAuth2 not granted or revoked.' },
    { error: 'OAuth2 not granted or revoked.' },
  ],
  'work-account': [
    { error: 'OAuth2 not granted or revoked.' },
    {
      token: 'interactive-work-token',
      grantedScopes: [GOOGLE_AUTH_SCOPES.SPREADSHEETS],
    },
  ],
});
const selectedAccountResult = await getGoogleAuthTokenResult({
  caller: 'verify.multiAccount.select',
  scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
  promptForAccount: true,
});
assert.equal(selectedAccountResult.token, 'interactive-work-token');
assert.equal(selectedAccountResult.accountId, 'work-account');
assert.equal(
  authRequests.find((request) => request.interactive)?.accountId,
  undefined,
  'Explicit reauthorization should leave account unset so Chrome can show its account chooser',
);
assert.equal(storage.get(sheetsAccountStorageKey), 'work-account');

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
  /caller: 'OneClickSetup\.getAuthToken',[\s\S]{0,220}scopes: GOOGLE_AUTH_SCOPE_SETS\.FULL,[\s\S]{0,80}promptForAccount: true/,
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
assert.match(
  managerSource,
  /caller: 'ScheduledMessagesManager\.handleReauth',[\s\S]{0,160}promptForAccount: true/,
  'Explicit Scheduled Messages recovery must allow choosing another Google account',
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
