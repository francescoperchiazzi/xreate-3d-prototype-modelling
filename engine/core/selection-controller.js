import { setSelectedPart } from './selection.js';
import { error as debugError, event as debugEvent } from '../debug/event-log.js';

// Transitional command adapter. It keeps the legacy shell responsible only for
// reading/writing its temporary references; selection policy remains in the
// core Selection module. This makes the bridge removable without copying the
// selection algorithm into a second renderer.
export function select(ctx) {
  const partId = ctx?.partId || null;
  const options = ctx?.options || null;
  const readRefs = ctx?.readRefs || null;
  const writeRefs = ctx?.writeRefs || null;
  const buildSelectionContext = ctx?.buildSelectionContext || null;
  if (typeof readRefs !== 'function' || typeof writeRefs !== 'function' || typeof buildSelectionContext !== 'function') {
    console.error('[selection-controller] incomplete selection bridge');
    debugEvent('selection.rejected', { reason: 'incomplete-bridge', partId });
    return false;
  }

  const refs = readRefs();
  debugEvent('selection.start', { partId, source: options?.source || null, hasCurrentMesh: !!refs?.currentMesh });
  try {
    setSelectedPart(buildSelectionContext({ partId, options, refs }));
    writeRefs(refs);
    try { ctx?.afterSelectionSync?.(); } catch (err) { console.error('[selection-controller] post-selection sync failed', { partId, err }); }
    debugEvent('selection.success', { partId, selectedPartId: refs?.currentMesh?.userData?.partId || null });
    return true;
  } catch (err) {
    console.error('[selection-controller] selection command failed', { partId, err });
    debugError('selection.failure', err, { partId });
    return false;
  }
}
