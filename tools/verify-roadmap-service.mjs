/**
 * Post-deploy probe for roadmap-service.
 *
 * Checks internal :3220 and public roadmap.xmnup.com health, then fetches the
 * hashed Vite bundle and asserts user-facing Gantt strings so a mixed-dep
 * popover cannot ship as a blank pill.
 *
 * Usage: node tools/verify-roadmap-service.mjs
 */
const INTERNAL = process.env.ROADMAP_INTERNAL_URL || 'http://10.32.56.212:3220';
const PUBLIC = process.env.ROADMAP_PUBLIC_URL || 'http://roadmap.xmnup.com';

const FRONTEND_NEEDLES = [
  'dep-adopt',
  '改用 Jira',
  '采用',
  '为 ETA',
  'dep-status-cluster',
  '未刷新',
];

const failures = [];

function check(label, condition, detail) {
  const mark = condition ? 'PASS' : 'FAIL';
  const extra = detail === undefined ? '' : ` — ${detail}`;
  console.log(`${mark}  ${label}${extra}`);
  if (!condition) failures.push(label);
}

async function getText(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`GET ${url} → ${response.status} ${await response.text()}`);
  }
  return { url: response.url, text: await response.text() };
}

async function getJson(url) {
  const { text } = await getText(url);
  return JSON.parse(text);
}

async function probeHealth(base) {
  const health = await getJson(`${base.replace(/\/$/, '')}/health`);
  check(
    `${base} /health`,
    health?.ok === true && health?.service === 'roadmap-service',
    JSON.stringify({ ok: health?.ok, service: health?.service, jiraEnabled: health?.jiraEnabled }),
  );
}

function scriptSrcs(html) {
  return [...html.matchAll(/src="([^"]+\.js)"/g)].map((match) => match[1]);
}

async function probeFrontend(base) {
  const page = await getText(base);
  const srcs = scriptSrcs(page.text);
  check(`${base} html has a JS bundle`, srcs.length > 0, srcs.join(', ') || 'none');
  if (!srcs.length) return;

  const assetUrl = new URL(srcs[0], page.url).href;
  const asset = await getText(assetUrl);
  check(`${base} JS bundle fetched`, asset.text.length > 1000, `${assetUrl} (${asset.text.length} bytes)`);
  for (const needle of FRONTEND_NEEDLES) {
    check(`${base} JS contains ${JSON.stringify(needle)}`, asset.text.includes(needle));
  }
}

try {
  await probeHealth(INTERNAL);
  await probeHealth(PUBLIC);
  await probeFrontend(PUBLIC);
} catch (err) {
  check(err instanceof Error ? err.message : String(err), false);
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}

console.log('\nroadmap-service live probe passed');
