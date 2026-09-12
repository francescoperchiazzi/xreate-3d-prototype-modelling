const PARTS = [
  ['box', 'Head', 0, 1.7, 0, { width: 0.4, height: 0.4, depth: 0.4, segments: 4 }],
  ['box', 'Torso', 0, 1.15, 0, { width: 0.5, height: 0.6, depth: 0.3, segments: 4 }],
  ['box', 'Pelvis', 0, 0.7, 0, { width: 0.4, height: 0.25, depth: 0.3, segments: 4 }],
  ['cylinder', 'UpperArm.L', -0.5, 1.35, 0, { radiusTop: 0.12, radiusBottom: 0.12, height: 0.4, segments: 16, heightSegments: 4, openEnded: false }],
  ['cylinder', 'Forearm.L', -0.75, 1.1, 0, { radiusTop: 0.1, radiusBottom: 0.1, height: 0.35, segments: 16, heightSegments: 4, openEnded: false }],
  ['box', 'Hand.L', -0.95, 0.92, 0, { width: 0.15, height: 0.12, depth: 0.08, segments: 4 }],
  ['cylinder', 'UpperArm.R', 0.5, 1.35, 0, { radiusTop: 0.12, radiusBottom: 0.12, height: 0.4, segments: 16, heightSegments: 4, openEnded: false }],
  ['cylinder', 'Forearm.R', 0.75, 1.1, 0, { radiusTop: 0.1, radiusBottom: 0.1, height: 0.35, segments: 16, heightSegments: 4, openEnded: false }],
  ['box', 'Hand.R', 0.95, 0.92, 0, { width: 0.15, height: 0.12, depth: 0.08, segments: 4 }],
  ['cylinder', 'UpperLeg.L', -0.13, 0.375, 0, { radiusTop: 0.14, radiusBottom: 0.14, height: 0.5, segments: 16, heightSegments: 4, openEnded: false }],
  ['cylinder', 'LowerLeg.L', -0.13, 0, 0, { radiusTop: 0.12, radiusBottom: 0.12, height: 0.45, segments: 16, heightSegments: 4, openEnded: false }],
  ['box', 'Foot.L', -0.13, -0.275, 0.1, { width: 0.18, height: 0.1, depth: 0.3, segments: 4 }],
  ['cylinder', 'UpperLeg.R', 0.13, 0.375, 0, { radiusTop: 0.14, radiusBottom: 0.14, height: 0.5, segments: 16, heightSegments: 4, openEnded: false }],
  ['cylinder', 'LowerLeg.R', 0.13, 0, 0, { radiusTop: 0.12, radiusBottom: 0.12, height: 0.45, segments: 16, heightSegments: 4, openEnded: false }],
  ['box', 'Foot.R', 0.13, -0.275, 0.1, { width: 0.18, height: 0.1, depth: 0.3, segments: 4 }],
];

// Atomic multi-part composition. The factory receives final world-space spawn
// coordinates, avoiding the old bridge-only transform mutation after mesh
// construction (which could leave every runtime mesh at the origin).
export function spawnHumanoidKit(ctx) {
  const shapes = ctx?.getShapeList?.() || [];
  const THREE = ctx?.THREE || null;
  if (!THREE?.Vector3 || typeof ctx?.createPartFromArchetype !== 'function') return { created: 0, selectedId: null };
  let created = [];
  (ctx?.mutateProject || ((fn) => fn()))(() => {
    const base = ctx?.opts?.position || ctx?.getDefaultSpawnPosition?.(shapes.length) || new THREE.Vector3(0, 0, 0);
    for (const [archetypeId, name, x, y, z, params] of PARTS) {
      const arch = ctx?.getArchetypeById?.(archetypeId) || null;
      if (!arch) continue;
      const part = ctx.createPartFromArchetype(arch, {
        name,
        params,
        fitToUnit: false,
        position: new THREE.Vector3(base.x + x, base.y + y, base.z + z),
      });
      if (!part) continue;
      shapes.push(part);
      created.push(part);
    }
    if (created[0]) ctx?.setSelectedPart?.(created[0].id, { silent: true });
    ctx?.renderTreeUI?.();
    ctx?.setStatusKey?.('status_shape_added', 'ok');
  });
  return { created: created.length, selectedId: created[0]?.id || null };
}
