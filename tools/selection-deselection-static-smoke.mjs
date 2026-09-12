import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../engine/legacy/editor-inline.js', import.meta.url), 'utf8');
for (const name of ['setCanonicalUvMode', 'setCanonicalSelectedIslandId']) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}', start);
  const body = start >= 0 ? source.slice(start, end + 2) : '';
  if (!/if \(!getSelectedPart\(\)\) return null;/.test(body)) {
    throw new Error(`${name} must ignore a deselection without a selected part`);
  }
}
console.log(JSON.stringify({ ok: true, check: 'deselection does not dispatch part-scoped UV commands' }));
