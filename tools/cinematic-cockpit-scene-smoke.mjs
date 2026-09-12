#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const fixture = JSON.parse(await readFile(new URL('../scenes/cinematic-experimental/xreate_cinematic_nebula-flight-deck-stress-test.xreate.json', import.meta.url), 'utf8'));
const project = fixture.project;
const fail = (message) => { throw new Error(`Cinematic cockpit fixture: ${message}`); };

if (fixture.format !== 'xreate' || fixture.version !== '2.2.0') fail('must use the current XReate project envelope');
if (project?.id !== 'xreate_cinematic_nebula_flight_deck_stress_test') fail('project id changed');
if (project.metadata?.authorship !== 'ai-generated') fail('must declare AI-generated authorship');
if (!project.metadata?.stressTest || !/stress test/i.test(project.metadata.warning || '')) fail('must disclose its stress-test status');
if (!Array.isArray(project.shapes) || project.shapes.length <= 3000) fail('must contain more than 3,000 volumes');
for (const shape of project.shapes) {
  if (!shape.material?.baseColor) fail(`${shape.id} has no base colour`);
  if (shape.layers || shape.imageDataUrl || shape.textureCompositeDataUrl) fail(`${shape.id} must not contain texture data`);
}

console.log(JSON.stringify({ ok: true, project: project.name, shapes: project.shapes.length, check: 'texture-free cinematic stress scene is declared and complete' }));
