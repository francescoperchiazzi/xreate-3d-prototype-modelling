#!/usr/bin/env node
// Keep implementation comments readable for every repository contributor.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const sourceExtensions = new Set(['.js', '.mjs', '.cjs', '.css', '.py']);
const ignoredDirectories = new Set(['.git', 'node_modules']);
const italianMarkers = new Set([
  'accanto', 'aggiungi', 'aggiunto', 'allinea', 'allineamento', 'bottoni',
  'colonna', 'colonne', 'compatibilita', 'contenuto', 'contenuti', 'controlli',
  'creazione', 'della', 'delle', 'degli', 'destra', 'dimensione',
  'disabilitati', 'durante', 'entrambi', 'freccia', 'garantisce', 'garantiti',
  'gestito', 'griglia', 'immagine', 'immagini', 'inclusi', 'intatti',
  'lasciati', 'leggero', 'mantieni', 'margini', 'nessun', 'nuovo', 'ordine',
  'pannello', 'perche', 'prima', 'quindi', 'rimosso', 'rimuovi', 'righe',
  'robusto', 'selettore', 'sezioni', 'simmetria', 'sopra', 'spaziature',
  'spostato', 'stessa', 'stile', 'taglio', 'titolo', 'tutte', 'tutti',
  'uniforme', 'verticale', 'visibile', 'vuoto',
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Comment language audit: ${message}`);
}

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...await listSourceFiles(fullPath));
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractComments(source, extension) {
  const comments = [];
  let index = 0;
  let line = 1;
  let quote = null;
  let escaped = false;

  const isPython = extension === '.py';
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (quote) {
      if (char === '\n') line += 1;
      if (!escaped && char === quote) quote = null;
      escaped = !escaped && char === '\\';
      if (char !== '\\') escaped = false;
      index += 1;
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      escaped = false;
      index += 1;
      continue;
    }
    if (!isPython && char === '/' && next === '*') {
      const startLine = line;
      index += 2;
      const start = index;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] === '\n') line += 1;
        index += 1;
      }
      comments.push({ line: startLine, text: source.slice(start, index) });
      index += 2;
      continue;
    }
    const isLineComment = (isPython && char === '#') || (!isPython && char === '/' && next === '/');
    if (isLineComment) {
      const startLine = line;
      index += isPython ? 1 : 2;
      const start = index;
      while (index < source.length && source[index] !== '\n') index += 1;
      comments.push({ line: startLine, text: source.slice(start, index) });
      continue;
    }
    if (char === '\n') line += 1;
    index += 1;
  }
  return comments;
}

const files = await listSourceFiles(root);
const findings = [];
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const extension = path.extname(file);
  for (const comment of extractComments(source, extension)) {
    const normalized = comment.text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const marker = [...new Set(normalized.match(/\p{L}+/gu) || [])].find((word) => italianMarkers.has(word));
    if (marker) findings.push({ file: path.relative(root, file), line: comment.line, marker, text: comment.text.trim() });
  }
}

assert(findings.length === 0, `non-English comment candidates found:\n${findings.map((item) => `${item.file}:${item.line} [${item.marker}] ${item.text}`).join('\n')}`);
console.log(JSON.stringify({ ok: true, filesChecked: files.length, check: 'source comments contain no Italian-language markers' }, null, 2));
