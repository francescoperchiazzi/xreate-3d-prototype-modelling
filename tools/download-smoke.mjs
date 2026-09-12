const events = [];
globalThis.URL = {
  createObjectURL: (blob) => {
    events.push(['create', blob.type]);
    return 'blob:xreate-test';
  },
  revokeObjectURL: (url) => events.push(['revoke', url]),
};
globalThis.setTimeout = (callback) => {
  callback();
  return 1;
};
const anchor = { href: '', download: '', click: () => events.push(['click']), remove: () => events.push(['remove']) };
globalThis.document = {
  body: { appendChild: () => events.push(['append']), removeChild: () => events.push(['remove-child']) },
  createElement: (tag) => {
    if (tag !== 'a') throw new Error('unexpected element');
    return anchor;
  },
};

const { download } = await import('../engine/download.js');

download(new Uint8Array([1, 2, 3]), 'scene.glb', 'model/gltf-binary');
if (anchor.href !== 'blob:xreate-test' || anchor.download !== 'scene.glb') throw new Error('download link was not configured');
if (!events.some(([kind]) => kind === 'click') || !events.some(([kind]) => kind === 'revoke')) throw new Error('download lifecycle was incomplete');

console.log('download: PASS');
