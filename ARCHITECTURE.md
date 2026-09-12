# XReate product architecture

This document describes the product model and the user-visible behaviour of
the application.

## Product boundary

```text
User actions
      |
      v
scene and surface controls
      |
      +-- Project (volumes, layers, metadata)
      +-- 3D viewport (scene, camera, renderer)
      +-- Surface editor (image, mask, UV transform)
      +-- Save and export (.xreate.json, GLB, USDZ, atlas)
      +-- Scene-local export fixtures (optional GLB and USDZ)
```

The application maintains one project, one 3D viewport, and one selected
volume at a time. Saving preserves portable project data; the visible 3D view
and temporary interaction state are recreated when a project opens.

## Ownership

| Area | Includes | Must remain independent |
|---|---|---|
| Project | volumes, layers, metadata | viewport-only objects |
| Scene | meshes, camera, renderer | portable project data |
| Surface editing | image transform, mask, material update | another volume’s layers |
| Selection | selected volume, bounds, transform handles | an unrelated selection state |

## Doodle construction

Doodle turns a traced profile into a volume:

- **Polygon** extrudes a closed outline.
- **Mirror** traces one left-side contour and creates one continuous symmetric
  solid.
- **Revolve** traces a profile and turns it through 360 degrees to create a
  lathed form such as a bottle, cup, or prop column.

Reference images are visual guides only. Moving or scaling an image must never
add, move, or alter a traced polygon point. Doodle is available on tablet and
desktop, where the drawing canvas has enough continuous space for accurate
input.

An imported image remains available when undoing a later change. Exported
closed Doodles retain an outward-facing surface in compatible GLB and USDZ
viewers.

## Responsive and gesture contract

At phone width (below 768px), the viewport and the three workflow panels are
ordinary document-flow blocks: **Composition**, **Volume**, and **3D
Texture**. Each is one accordion; its body owns all of its controls. UV
Mapping is part of the 3D Texture body rather than Volume, so each accordion
contains its own controls.

The phone viewport remains square. Tablet layouts (768–1159px) use a
viewport-first grid with Composition, Volume, and 3D Texture below it and
retain normal page scrolling. Range controls have a 40px touch target on
tablet; phones use a compact 34px target with a 22px thumb.

The UV canvas supports one-finger image drag and a two-finger gesture: distance
scales the image while midpoint translation pans it. The 3D viewport retains
one-finger orbit and uses a two-finger midpoint drag for camera pan. The
retired Device Preview control is not part of the supported UI contract.

## Expected invariants

- Composition and viewport selection always identify the same volume.
- A duplicated volume receives independent layers and UV transforms.
- A texture layer belongs to its selected volume.
- A masked layer scales its image and clipping mask together around the mask
  centre, so the clipping relationship is preserved.
- Project files contain portable scene data rather than temporary viewer state.
- Scene-local GLB/USDZ fixtures are generated test artifacts; their matching
  `.xreate.json` scene remains the editable source of record.
- Reference scenes are device-scale AR/XR fixtures. The explicitly marked
  `scenes/cinematic-experimental/` collection is an opt-in large-scale storytelling study
  and is excluded from the one-metre reference-scene contract.

The control-to-result map is in [SYSTEM-ATLAS.md](SYSTEM-ATLAS.md).

## Localisation

Every visible interface string resolves in the selected language or through an
explicit English fallback. The localisation check ensures that controls never
show a raw translation key or an empty label.
