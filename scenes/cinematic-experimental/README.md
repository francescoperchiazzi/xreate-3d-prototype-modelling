# Cinematic large-scale scenes

These scenes are intentionally larger than the device-scale examples in the
parent folder. They are spatial-storytelling studies, not AR/XR size fixtures.

## Authorship and visual scope

All projects in this folder are AI-generated cinematic studies. They use solid
material colours only; no texture image is part of their construction. The
human-authored, device-scale learning scenes live in the parent
[`scenes/`](../README.md) collection.

- [The Aurora Gate — Retro-Futurist Terminal](xreate_cinematic_the-aurora-gate.xreate.json)
  is a texture-free 20 × 20 metre soundstage with more than 500 editable
  volumes.
- [Nebula Flight Deck — Cockpit Stress Test](xreate_cinematic_nebula-flight-deck-stress-test.xreate.json)
  is a texture-free 20 × 20 metre fictional flight simulator with more than
  3,000 individually selectable coloured volumes. **Warning:** it is an
  intentional stress test; loading, selection, transforms, and export can be
  slow on lower-powered devices.
- [Spatial Study Alcove](xreate_cinematic_spatial-study-alcove.xreate.json)
  is a compact, 19-part texture-free study with a workstation, portal,
  floating cards, seat, and interaction anchors.

Regenerate the scene after changing its construction recipe with:

```sh
node tools/create-aurora-gate-scene.mjs
node tools/create-cinematic-cockpit-stress-scene.mjs
```
