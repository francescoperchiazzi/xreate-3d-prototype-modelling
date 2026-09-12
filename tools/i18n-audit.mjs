import { readFile, readdir } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function htmlFiles(dir) {
  return (await readdir(dir)).filter((name) => name.endsWith('.html')).map((name) => new URL(name, dir));
}

async function scriptFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const target = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
    if (entry.isDirectory()) out.push(...await scriptFiles(target));
    else if (/\.(?:js|mjs)$/.test(entry.name)) out.push(target);
  }
  return out;
}

const translations = JSON.parse(await readFile(new URL('../translations.json', import.meta.url), 'utf8'));
const fallback = translations.__fallback_en || {};
const files = await htmlFiles(new URL('../shell/ui/', import.meta.url));
const markup = await Promise.all(files.map((file) => readFile(file, 'utf8')));
const keys = new Set();
for (const text of markup) {
  for (const match of text.matchAll(/\bdata-i18n(?:-(?:html|placeholder|aria|title|alt))?="([A-Za-z0-9_]+)"/g)) keys.add(match[1]);
}
const runtimeFiles = [...await scriptFiles(new URL('../shell/', import.meta.url)), ...await scriptFiles(new URL('../engine/', import.meta.url))];
const runtimeKeys = new Set();
for (const text of await Promise.all(runtimeFiles.map((file) => readFile(file, 'utf8')))) {
  for (const match of text.matchAll(/\b(?:tr|t|setStatusKey)\(\s*['"]([A-Za-z0-9_]+)['"]/g)) runtimeKeys.add(match[1]);
}
for (const key of runtimeKeys) keys.add(key);

const unresolved = [...keys].filter((key) => !Object.prototype.hasOwnProperty.call(fallback, key)
  && !Object.values(translations).some((dict) => dict && typeof dict === 'object' && Object.prototype.hasOwnProperty.call(dict, key)));
assert(!unresolved.length, `Markup uses translation keys with no catalog value: ${unresolved.join(', ')}`);

const languages = Object.entries(translations).filter(([lang, dict]) => lang !== '__fallback_en' && dict && typeof dict === 'object');
for (const [lang, dict] of languages) {
  const unavailable = [...keys].filter((key) => !Object.prototype.hasOwnProperty.call(dict, key) && !Object.prototype.hasOwnProperty.call(fallback, key));
  assert(!unavailable.length, `${lang} cannot resolve: ${unavailable.join(', ')}`);
}

const requiredWiring = [
  'top_export', 'top_drawing_mode', 'top_texture_mode', 'top_menu',
  'doodle_source_eyebrow', 'doodle_load_file', 'doodle_load_camera', 'doodle_skip_image', 'doodle_mode_revolve',
  'about_tagline', 'about_scene_purpose', 'about_agentic_coding', 'translations_ai_note', 'about_federico',
  'report_bug_label', 'report_bug_aria', 'report_bug_title',
];
assert(requiredWiring.every((key) => keys.has(key)), 'A visible top-level, Doodle, or About string lost its i18n binding');

const nativeCoverage = Object.fromEntries(languages.map(([lang, dict]) => [
  lang,
  [...keys].filter((key) => Object.prototype.hasOwnProperty.call(dict, key)).length,
]));
console.log(JSON.stringify({
  ok: true,
  markupKeys: keys.size,
  runtimeStaticKeys: runtimeKeys.size,
  languages: languages.length,
  fallbackKeys: Object.keys(fallback).length,
  nativeCoverage,
  check: 'Every static UI translation key resolves through its locale or the English fallback',
}));
