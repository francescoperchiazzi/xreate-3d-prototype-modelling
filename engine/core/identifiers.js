// Central ID authority.  Consumers request semantic IDs instead of reaching
// into Storage, so persistence backends can change without leaking through
// editor or shape code.
let uuidFactory = () => `uuid_${Date.now()}_${Math.random().toString(16).slice(2)}`;

export function configureIdentifiers({ uuid } = {}) {
  if (typeof uuid === 'function') uuidFactory = uuid;
}

export function createUuid() {
  return String(uuidFactory());
}

export function createShapeId() {
  return `shape_${createUuid()}`;
}

export const Identifiers = { configure: configureIdentifiers, uuid: createUuid, createShapeId };
