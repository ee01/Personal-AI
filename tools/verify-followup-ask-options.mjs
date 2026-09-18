/**
 * Contract check for the 「跟进追问」 Options wiring.
 *
 * Runs as plain Node (no build, no browser). It asserts the source-level
 * contract that:
 *   1. `ENABLE_FOLLOWUP_ASK` exists in env config, defaults to on, and survives
 *      `normalizeEnvConfigShape`.
 *   2. Options renders the 跟进追问 toggle right after the Watch feature block,
 *      and renders the followup result push target through the *same* storage
 *      keys as 「主动询问结果推送」 (`OUTREACH_RESULT_PUSH_TARGET` /
 *      `OUTREACH_RESULT_PUSH_GROUP_ID`) with a distinct DOM id only.
 *   3. The toolbar gates 「跟进追问」 on its own flag, and the content script
 *      reads + writes + watches that flag.
 *
 * It is a source contract, not a runtime proof: it does not open Options, save
 * config, or send a push. Behavioural coverage lives in
 * `src/message-reaction/__tests__/messageReactionLinkedAction.test.ts`.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

const [
  utilsSource,
  optionsSource,
  layoutSource,
  reactionUiSource,
  contentScriptSource,
  translationsSource,
] = await Promise.all([
  read('src/utils.ts'),
  read('src/options.tsx'),
  read('src/message-reaction/messageReactionLayout.ts'),
  read('src/message-reaction/MessageReactionUI.ts'),
  read('src/contentScriptGlip.tsx'),
  read('src/i18n/staticTranslations.ts'),
]);

// 1. env config flag
assert.match(
  utilsSource,
  /ENABLE_FOLLOWUP_ASK: boolean;/,
  'EnvConfigType should declare ENABLE_FOLLOWUP_ASK',
);
assert.match(
  utilsSource,
  /ENABLE_FOLLOWUP_ASK: process\.env\.ENABLE_FOLLOWUP_ASK !== 'false'/,
  'ENABLE_FOLLOWUP_ASK should default to enabled',
);
assert.match(
  utilsSource,
  /ENABLE_FOLLOWUP_ASK: normalizedFollowupAskEnabled/,
  'normalizeEnvConfigShape should preserve ENABLE_FOLLOWUP_ASK',
);

// 2. Options: toggle after 关注后续 feature block
const followThreadToggleIndex = optionsSource.indexOf('id="ENABLE_FOLLOW_THREAD"');
const followupAskToggleIndex = optionsSource.indexOf('id="ENABLE_FOLLOWUP_ASK"');
assert.ok(followThreadToggleIndex > 0, 'Options should render the Watch toggle');
assert.ok(followupAskToggleIndex > 0, 'Options should render the Followup Ask toggle');
assert.ok(
  followupAskToggleIndex > followThreadToggleIndex,
  'Followup Ask toggle should come after the Watch feature block',
);
assert.match(
  optionsSource,
  /id="ENABLE_FOLLOWUP_ASK"\s+name="ENABLE_FOLLOWUP_ASK"\s+checked=\{config\.ENABLE_FOLLOWUP_ASK\}/,
  'Followup Ask toggle should bind to config.ENABLE_FOLLOWUP_ASK',
);

// 2b. Options: shared storage for the result push target
const outreachTargetRenders = optionsSource.match(
  /'OUTREACH_RESULT_PUSH_TARGET'/g,
);
const outreachGroupRenders = optionsSource.match(
  /'OUTREACH_RESULT_PUSH_GROUP_ID'/g,
);
assert.ok(
  (outreachTargetRenders?.length ?? 0) >= 3,
  'OUTREACH_RESULT_PUSH_TARGET should be rendered in both the message-interaction and outreach sections (plus the push-target rule table)',
);
assert.ok(
  (outreachGroupRenders?.length ?? 0) >= 3,
  'OUTREACH_RESULT_PUSH_GROUP_ID should be rendered in both the message-interaction and outreach sections (plus the push-target rule table)',
);
assert.match(
  optionsSource,
  /name=\{targetKey\}/,
  'shared push-target fields must keep the storage key as the form name',
);
assert.match(
  optionsSource,
  /name=\{groupKey\}/,
  'shared push-target group fields must keep the storage key as the form name',
);
assert.match(
  optionsSource,
  /const targetDomId = domIdPrefix\s+\? `\$\{domIdPrefix\}_\$\{targetKey\}`/,
  'shared push-target fields should only differ by DOM id',
);
const messageInteractionSectionIndex = optionsSource.indexOf(
  "t('options.sections.messageInteraction')",
);
const followupAskPushIndex = optionsSource.indexOf("'跟进追问结果推送'");
assert.ok(
  followupAskPushIndex > messageInteractionSectionIndex,
  '跟进追问结果推送 should live inside the message-interaction section',
);

// 3. toolbar gating
assert.match(
  layoutSource,
  /enableFollowupAsk: boolean;/,
  'MessageReactionToolbarConfig should expose enableFollowupAsk',
);
assert.match(
  layoutSource,
  /case 'followupAsk':\s+return config\.enableFollowupAsk && context\.isOwnMessage;/,
  'Followup Ask button must be gated on its own flag, not auto reply',
);

// 4. content script / content script UI read + write + watch
assert.match(
  reactionUiSource,
  /enableFollowupAsk: config\.ENABLE_FOLLOWUP_ASK !== false/,
  'MessageReactionUI should read ENABLE_FOLLOWUP_ASK',
);
assert.match(
  reactionUiSource,
  /envConfig\.ENABLE_FOLLOWUP_ASK = config\.enableFollowupAsk/,
  'MessageReactionUI should write ENABLE_FOLLOWUP_ASK back',
);
assert.match(
  reactionUiSource,
  /data-feature="followupAsk"/,
  'the content-script reaction settings popup should expose a followupAsk checkbox',
);
assert.match(
  contentScriptSource,
  /enableFollowupAsk: config\.ENABLE_FOLLOWUP_ASK !== false/,
  'contentScriptGlip should read ENABLE_FOLLOWUP_ASK',
);
assert.match(
  contentScriptSource,
  /MESSAGE_REACTION_ENV_KEYS = \[[\s\S]*?'ENABLE_FOLLOWUP_ASK',[\s\S]*?\];/,
  'contentScriptGlip should watch ENABLE_FOLLOWUP_ASK for toolbar updates',
);

// 5. i18n coverage for the new Options copy
for (const phrase of [
  '跟进追问结果推送',
  '启用「跟进追问」功能',
  '与下方「主动询问结果推送」共用同一份存储，改任意一处两边同步。跟进追问拿到结果、超时或未得到可用结论时推送终态回执。',
]) {
  assert.ok(
    translationsSource.includes(`'${phrase}'`),
    `staticTranslations should translate: ${phrase}`,
  );
}

console.log('verify-followup-ask-options: ok');
