import {
  AutosaveManager,
  configureAutosave,
  getAutosaveManager,
} from '../engine/persistence/autosave.js';
import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

configureAutosave({ tr: (key) => `t:${key}`, download() {} });
const manager = new AutosaveManager();
assert(getAutosaveManager() === manager, 'autosave manager was not retained by the ESM runtime');
assert(manager.config.maxSlots === 12 && manager.buffer.maxSlots === 12, 'autosave manager did not initialize its buffer contract');

const source = await readFile(new URL('../engine/persistence/autosave.js', import.meta.url), 'utf8');
assert(source.includes('function projectFilenameBase(name)') && source.includes('`${name}-autosave.xreate.json`'), 'exported autosaves must use the scene name instead of their internal slot ID');

console.log('autosave-runtime: PASS');
