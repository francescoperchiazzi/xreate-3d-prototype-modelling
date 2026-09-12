import {
  canvasToPngDataUrl,
  imageBitmapToPngDataUrlForSave,
} from '../engine/image/io.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createCanvas(dataUrl) {
  return {
    width: 0,
    height: 0,
    toDataUrlCalls: 0,
    getContext: () => ({ clearRect() {}, drawImage() {} }),
    toDataURL() {
      this.toDataUrlCalls += 1;
      return dataUrl;
    },
  };
}

const saveCanvas = createCanvas('data:image/png;base64,save');
const saved = imageBitmapToPngDataUrlForSave(
  { width: 12, height: 6 },
  { document: { createElement: () => saveCanvas } },
);
assert(saved === 'data:image/png;base64,save', 'save serialization did not use the supplied canvas');
assert(saveCanvas.width === 12 && saveCanvas.height === 6, 'save serialization changed a small bitmap size');

const composite = createCanvas('data:image/png;base64,composite');
const first = canvasToPngDataUrl(composite, { compositeCanvas: composite, baseLayerRevision: 3 });
const second = canvasToPngDataUrl(composite, { compositeCanvas: composite, baseLayerRevision: 3 });
assert(first === second, 'composite serialization cache changed the URL');
assert(composite.toDataUrlCalls === 1, 'composite serialization cache was not reused');

console.log('image-io: PASS');
