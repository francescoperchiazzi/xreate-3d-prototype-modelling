class FakeElement {
  constructor() {
    this.listeners = new Map();
    this.focused = false;
    this.offsetParent = {};
    this.children = [];
  }
  querySelectorAll() { return this.children; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type) { this.listeners.delete(type); }
  contains(node) { return node === this || this.children.includes(node); }
  getAttribute() { return null; }
  focus() { this.focused = true; globalThis.document.activeElement = this; }
}
globalThis.Element = FakeElement;
globalThis.document = { activeElement: null };

const { activate, deactivate } = await import('../engine/core/focus-trap.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const prior = new FakeElement();
document.activeElement = prior;
const dialog = new FakeElement();
const first = new FakeElement();
const last = new FakeElement();
dialog.children = [first, last];
activate(dialog);
assert(document.activeElement === first, 'focus trap did not focus its first control');
document.activeElement = last;
let prevented = false;
dialog.listeners.get('keydown')({ key: 'Tab', shiftKey: false, preventDefault: () => { prevented = true; } });
assert(prevented && document.activeElement === first, 'focus trap did not wrap focus forward');
deactivate(dialog);
assert(document.activeElement === prior && !dialog.listeners.has('keydown'), 'focus trap did not restore focus and listener ownership');
console.log('focus-trap: PASS');
