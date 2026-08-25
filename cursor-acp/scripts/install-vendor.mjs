import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '..', 'dist');
const target = path.resolve(process.argv[2] || path.join(here, '..', '..', 'worker', 'dist', 'vendor', 'cursor-acp'));

if (!fs.existsSync(source)) {
  console.error(`cursor-acp dist missing at ${source}; run npm run build in cursor-acp first`);
  process.exit(1);
}
fs.mkdirSync(target, { recursive: true });
fs.cpSync(source, target, { recursive: true });
console.log(`Vendored cursor-acp -> ${target}`);
