export function download(buffer, filename, mimeType) {
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  try { document.body.appendChild(a); } catch (_) {}
  a.click();
  try { a.remove(); } catch (_) { try { document.body.removeChild(a); } catch (_) {} }
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
