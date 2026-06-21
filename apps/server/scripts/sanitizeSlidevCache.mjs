#!/usr/bin/env node
/**
 * One-off maintenance script: strips accidental outer ```slidev / ```markdown
 * fence wrappers from previously cached Slidev markdown files.
 *
 * Run from repo root:
 *   node apps/server/scripts/sanitizeSlidevCache.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '../.data/slidev');

if (!fs.existsSync(dir)) {
  console.log(`[slidev-sanitize] directory not found: ${dir}`);
  process.exit(0);
}

let changed = 0;
let kept = 0;
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.md')) continue;
  const fp = path.join(dir, f);
  const orig = fs.readFileSync(fp, 'utf8');
  const stripped = orig
    .trim()
    .replace(/^```(?:slidev|markdown|md)?\s*\n/, '')
    .replace(/\n```\s*$/, '')
    .trim();

  if (stripped !== orig) {
    fs.writeFileSync(fp, stripped);
    console.log(`[slidev-sanitize] cleaned ${f}`);
    changed++;
  } else {
    console.log(`[slidev-sanitize] ok      ${f}`);
    kept++;
  }
}
console.log(`[slidev-sanitize] done. cleaned=${changed} unchanged=${kept}`);
