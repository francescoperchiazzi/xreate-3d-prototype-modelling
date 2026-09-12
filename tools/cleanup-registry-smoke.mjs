const { create } = await import('../engine/core/cleanup-registry.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const calls = [];
const registry = create();
const removeFirst = registry.add(() => calls.push('first'));
registry.add(() => calls.push('second'));
removeFirst();
assert(registry.size === 1, 'removing a registered cleanup did not update the registry');
assert(registry.dispose(), 'the first dispose should run');
assert(calls.join(',') === 'second', 'cleanup registry did not run the remaining cleanup exactly once');
assert(!registry.dispose() && registry.size === 0, 'cleanup registry must be idempotent after dispose');
assert(typeof registry.add(() => calls.push('late')) === 'function' && calls.length === 1, 'cleanup registry accepted work after disposal');
console.log('cleanup-registry: PASS');
