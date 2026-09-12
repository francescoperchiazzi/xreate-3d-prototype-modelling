// Runtime-only undo asset lookup. Serialized undo payloads retain references,
// while their data remains owned by the canonical project runtime object.
export function resolveUndoAsset(project, ref) {
  if (!ref || !project?._undoAssets) return null;
  try {
    const value = project._undoAssets.get(ref);
    return (typeof value === 'string' && value) ? value : null;
  } catch (_) {
    return null;
  }
}

export async function resolveUndoAssetAsync(project, ref) {
  if (!ref || !project) return null;
  const direct = resolveUndoAsset(project, ref);
  if (direct) return direct;
  const pending = project._undoAssetsPending?.get(ref) || null;
  if (!pending) return null;
  try {
    return await pending;
  } catch (_) {
    return null;
  }
}

export const UndoAssets = { resolveUndoAsset, resolveUndoAssetAsync };
