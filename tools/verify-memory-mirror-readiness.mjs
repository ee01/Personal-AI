import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Uses synthetic in-memory data only. No server or GitHub credentials required.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const service = path.join(root, 'memory-service');
const suite = path.join(service, 'evals/markdown-git-mirror');
const report = path.join(root, 'test-results/markdown-git-mirror-readiness.json');
const relativeTest = `src/__tests__/mirror-readiness-${randomUUID()}.test.ts`;
const test = path.join(service, relativeTest);
const fixture = fs.readFileSync(path.join(service, 'src/__tests__/markdownGitMirror.test.ts'), 'utf8');
const marker = '// 1. no raw text / token / secret / restricted';
const index = fixture.indexOf(marker);
if (index < 0) throw new Error('Mirror fixture structure changed; update the audit harness.');
const probes = fs.readFileSync(path.join(suite, 'readiness-probes.ts.txt'), 'utf8');
fs.mkdirSync(path.dirname(report), { recursive: true });
fs.rmSync(report, { force: true });

try {
  // Keep temporary source beside the fixture so its existing imports resolve.
  fs.writeFileSync(test, `${fixture.slice(0, index)}\n${probes}`);
  const result = spawnSync('npm', [
    'test', '--', '--run', relativeTest, '--reporter=json', `--outputFile=${report}`,
  ], { cwd: service, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`Audit interrupted by ${result.signal}`);
  process.exitCode = result.status ?? 1;
  if (fs.existsSync(report)) {
    const summary = JSON.parse(fs.readFileSync(report, 'utf8'));
    console.log(`Readiness: ${summary.numPassedTests} passed, ${summary.numFailedTests} failed.`);
    console.log(`Report: ${path.relative(root, report)}`);
    console.log('A failing assertion means the feature is NOT ready; it is not an expected-pass test.');
  }
} finally {
  fs.rmSync(test, { force: true });
}
