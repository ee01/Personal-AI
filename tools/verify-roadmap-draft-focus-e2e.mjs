/**
 * End-to-end check for a manual Roadmap draft reaching memory as a focus project.
 *
 * Drives the real deployed services: reads the team snapshot from
 * roadmap-service, replays the exact page → extension transform, pushes the
 * snapshot to memory-service and reads back what the watch rule would say.
 *
 * Usage: node tools/verify-roadmap-draft-focus-e2e.mjs [teamId]
 */

const ROADMAP = process.env.ROADMAP_BASE_URL || 'http://10.32.56.212:3220';
const MEMORY = process.env.MEMORY_BASE_URL || 'http://10.32.56.212:3210';
const USER_ID = process.env.MEMORY_USER_ID || 'esone.qiu';
const teamId = process.argv[2] || 'Sp1CSuq7w70L';

const failures = [];
function check(label, condition, detail) {
  const mark = condition ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${label}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  if (!condition) failures.push(label);
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${options?.method || 'GET'} ${url} → ${response.status} ${await response.text()}`);
  }
  return response.json();
}

// Mirrors buildStateMessage() in roadmap-service/web/src/composables/useRoadmapContract.ts
function buildStateMessage(snapshot, quarter) {
  return {
    type: 'pai-roadmap-state',
    teamId: snapshot.team.id,
    team: snapshot.team.id,
    teamName: snapshot.team.name,
    quarter,
    editable: true,
    items: snapshot.items
      .filter((item) => item.scheduled)
      .map((item) => ({
        key: item.key,
        type: item.type,
        title: item.title,
        alias: item.alias ?? null,
        quarter: item.quarter || quarter,
        targetStart: item.targetStart ?? null,
        targetEnd: item.targetEnd ?? null,
        start: item.start ?? null,
        days: item.days ?? null,
        isDraft: !item.jiraKey,
        jiraKey: item.jiraKey ?? null,
        subActivity: item.subs.length > 0,
      })),
  };
}

// Mirrors toFocusSyncItem() in src/roadmapFocusContract.ts
function toFocusSyncItem(item) {
  const sentJiraKey = item.jiraKey === undefined ? undefined : item.jiraKey || null;
  const isDraft =
    sentJiraKey === undefined ? /^LOCAL-/i.test(item.key) : sentJiraKey === null;
  return {
    key: item.key,
    type: item.type,
    title: item.title,
    alias: item.alias,
    displayName: item.displayName || item.alias || item.title,
    isDraft,
    jiraKey: isDraft ? null : (sentJiraKey ?? undefined),
    quarter: item.quarter,
    targetStart: item.targetStart,
    targetEnd: item.targetEnd,
    start: item.start,
    days: item.days,
    keywords: item.keywords,
    priorityHints: {
      ...(item.subActivity === undefined ? {} : { subActivity: item.subActivity }),
    },
  };
}

const { snapshot } = await getJson(`${ROADMAP}/api/v1/teams/${teamId}`);
const state = buildStateMessage(snapshot, '2026-Q3');
check('page state message carries both teamId and team', state.teamId === state.team && Boolean(state.teamId), state.teamId);

const drafts = state.items.filter((item) => item.isDraft);
check('at least one scheduled draft on the Gantt', drafts.length > 0, drafts.map((d) => d.key));
check(
  'every draft reports jiraKey null',
  drafts.every((item) => item.jiraKey === null),
);
check(
  'start travels as an ISO date string',
  state.items.every((item) => item.start === null || /^\d{4}-\d{2}-\d{2}$/.test(item.start)),
  state.items.map((item) => item.start),
);

const syncBody = {
  teamId: state.teamId,
  teamName: state.teamName,
  syncedAt: Date.now(),
  items: state.items.map(toFocusSyncItem),
};
await getJson(`${MEMORY}/api/v1/projects/watched/sync`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-User-Id': USER_ID },
  body: JSON.stringify(syncBody),
});

const focus = await getJson(`${MEMORY}/api/v1/projects/focus`, {
  headers: { 'X-User-Id': USER_ID },
});
const projects = focus.projects || focus.items || [];
const draftKeys = new Set(drafts.map((item) => item.key));
const synced = projects.filter((project) => draftKeys.has(project.externalRef?.itemKey));

check('the draft reached memory as a focus project', synced.length === drafts.length, projects.map((p) => p.id));
for (const project of synced) {
  check(`  ${project.externalRef.itemKey}: jiraKey is null`, project.externalRef.jiraKey === null);
  check(`  ${project.externalRef.itemKey}: isDraft is true`, project.externalRef.isDraft === true);
  check(
    `  ${project.externalRef.itemKey}: synthetic key stays out of aliases`,
    !(project.aliases || []).some((alias) => /^LOCAL-/i.test(alias)),
    project.aliases,
  );
  check(
    `  ${project.externalRef.itemKey}: id derives from the immutable item key`,
    project.id === `roadmap-${teamId}-${project.externalRef.itemKey.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    project.id,
  );
}

// Mirrors buildFocusProjectWatchRules() in src/watchRules.ts
function ruleTextFor(project) {
  const displayName = project.displayName || project.aliases?.[0] || project.name || project.id;
  const isDraft = project.externalRef?.isDraft === true;
  const key = isDraft ? '' : project.externalRef?.jiraKey || project.externalRef?.itemKey || project.id;
  const keywords = Array.from(new Set([key, displayName, ...(project.aliases || [])]))
    .filter(Boolean)
    .slice(0, 8)
    .join(' / ');
  return isDraft
    ? `Focus project ${displayName} (team=${project.teamRef}). This project has no Jira issue yet. Match messages about this project by alias/keywords only (${keywords}). Memory-only: store matches, never notify.`
    : `Focus project [${key}] ${displayName} (team=${project.teamRef}). Match messages about this project using exact Jira key first, then alias/keywords (${keywords}). Memory-only: store matches, never notify.`;
}

for (const project of synced) {
  const text = ruleTextFor(project);
  check(`  ${project.externalRef.itemKey}: watch rule has no LOCAL- token`, !text.includes('LOCAL-'), text);
  check(`  ${project.externalRef.itemKey}: watch rule drops the exact-key instruction`, !text.includes('exact Jira key'));
  check(`  ${project.externalRef.itemKey}: watch rule stays memory-only`, text.includes('never notify'));
}

const hints = snapshot.team.jqlHints;
check('jqlHints prefill the create modal', Boolean(hints?.projectKey && hints?.itemType), hints);

console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nAll checks passed');
process.exit(failures.length ? 1 : 0);
