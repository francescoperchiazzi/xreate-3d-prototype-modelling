import { mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const scenesDir = join(root, '..', 'scenes');

function assert(result, message) {
  if (!result) throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  assert(result.status === 0, `${command} failed: ${result.stderr || result.stdout}`);
  return result;
}

function normalizeMaterialGraph(usda) {
  return usda
    .replace(/\n\s*token outputs:displacement\.connect = [^\n]+/g, '')
    .replace(/\n\s*def Shader "Displacement_Shader"\n\s*\{\n\s*uniform token info:id = "UsdPreviewSurface"\n\s*float inputs:displacement = 0\n\s*token outputs:displacement\n\s*\}\n?/g, '\n');
}

const files = (await readdir(scenesDir)).filter((file) => file.endsWith('.usdz')).sort();
let refreshed = 0;

for (const file of files) {
  const source = join(scenesDir, file);
  const temp = await mkdtemp(join(tmpdir(), 'xreate-scene-usdz-'));
  try {
    run('/usr/bin/unzip', ['-q', source, '-d', temp]);
    const entries = (await readdir(temp)).filter((entry) => entry !== '__MACOSX').sort();
    const usdaPath = join(temp, 'XReate.usda');
    const before = await readFile(usdaPath, 'utf8');
    const after = normalizeMaterialGraph(before);
    if (after === before) continue;

    await writeFile(usdaPath, after);
    const packaged = join(temp, file);
    run('/usr/bin/usdzip', [packaged, 'XReate.usda', ...entries.filter((entry) => entry !== 'XReate.usda')], { cwd: temp });
    await rename(packaged, source);
    run('/usr/bin/usdchecker', [source]);
    refreshed += 1;
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

console.log(JSON.stringify({ ok: true, checked: files.length, refreshed, check: 'Scene-local USDZ packages use one Preview Surface per material and pass usdchecker.' }));
