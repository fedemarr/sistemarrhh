import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(e)) continue;
      out.push(...walk(p));
    } else if (p.endsWith('.js') || p.endsWith('.mjs')) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(root).filter((p) => !p.includes(`${sep}node_modules${sep}`));
let failed = 0;
for (const f of files) {
  try {
    execSync(`node --check "${f}"`, { stdio: 'pipe' });
    console.log(`OK  ${f.replace(root, '')}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${f.replace(root, '')}\n${err.stderr?.toString() || err.message}`);
  }
}
console.log(`\n${files.length - failed}/${files.length} archivos JS OK.`);
process.exit(failed ? 1 : 0);
