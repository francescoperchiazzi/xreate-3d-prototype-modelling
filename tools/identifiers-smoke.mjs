const { configureIdentifiers, createUuid, createShapeId } = await import('../engine/core/identifiers.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let sequence = 0;
configureIdentifiers({ uuid: () => `stable-${++sequence}` });
assert(createUuid() === 'stable-1', 'configured UUID authority was not used');
assert(createShapeId() === 'shape_stable-2', 'shape ID did not derive from UUID authority');
console.log('identifiers: PASS');
