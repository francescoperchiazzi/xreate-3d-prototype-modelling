# XReate repository inventory

This inventory describes the public repository structure and the responsibility
of each area. It is intended as an orientation document for contributors and
reviewers.

## Top level

| Path | Purpose |
|---|---|
| `index.html` | Browser entry point and module loading surface. |
| `xreate.css` | Shared application, responsive, modal, and touch UI styling. |
| `translations.json` | Locale dictionaries and English fallback strings. |
| `package.json` | Reproducible development and verification commands (no runtime npm dependencies). |
| `package-lock.json` | Locked versions for the zero-runtime-dependency npm tooling used by the smoke and audit scripts. |
| `.gitignore` | Local-only exclusions for cache directories, IDE state, macOS Finder metadata, and generated scratch files. |
| `README.md` | Product overview, setup, product tour, and release checks. |
| `SHARE.md` | Short public introduction, for students and creative communities, describing what XReate is and how to try it. |
| `ARCHITECTURE.md` | Product data model and implementation boundaries. |
| `SYSTEM-ATLAS.md` | Visible control map, interaction flow, and expected outcomes. |
| `LICENSE` and `NOTICE.md` | Software license and third-party material notices. |
| `FOR-FEDERICO.md` | Project dedication and creative context. |

## Application code

### Entry points

| Path | Responsibility |
|---|---|
| `engine/main.js` | Engine-side entry point: wires the Three.js scene, render loop, editor commands, and persistence layer together before the browser shell takes over. |
| `engine/download.js` | Public helpers for browser downloads (GLB, USDZ, texture-atlas PNG, and `.xreate.json` export flows). |
| `shell/main.js` | Shell-side entry point: bootstraps the UI markup, modals, keyboard, menu wiring, and the theme before handing control to the orchestrator. |

### Engine modules

| Directory | Responsibility |
|---|---|
| `engine/core/` | Editor state, project state, selection, transforms, gizmo, raycasting, undo, identifiers, and runtime coordination. |
| `engine/editor/` | Project, scene, and shape runtime commands; theme-derived colours; part-resource ownership; shell resolvers; and I/O config. |
| `engine/shapes/` | Primitive definitions, archetype catalog, geometry factory, Doodle (Polygon / Mirror / Revolve) controllers, humanoid pipeline, and shape commands. |
| `engine/image/` | Image import, affine transforms, compositing, canvas interaction, seamless tiling, retro/PBR maps, masks, perspective, and workflow orchestration. |
| `engine/texture/` | Layer sessions, UV texture workflow, canvas controller, layer editor, surface editor, mask editor, and texture-mode coordination. |
| `engine/viewport/` | 3D viewport controller: camera framing, display modes, viewport selection sync, and zoom/pan bridges. |
| `engine/canvas/` | UV-overlay helpers and extra canvas-drawing support shared by the editor, compositor, and doodle trace surface. |
| `engine/export/` | GLB, USDZ, and ZIP export pipelines; texture atlas builder and packer; export configuration; payload builders. |
| `engine/persistence/` | `.xreate.json` project serialisation, autosave, browser storage, undo-asset snapshot, and storage helpers. |
| `engine/debug/` | Event recorder and debugging support (event log, deterministic playback seeds). |
| `engine/legacy/` | Compatibility bridge while the modular runtime APIs replace the earlier single-file editor boot. |

### Shell modules and markup

| Path | Responsibility |
|---|---|
| `shell/` | Browser shell modules and interface coordination (menu, modals, theme, keyboard, toast, orchestrator, add-shape menu, inspector and scene panels, export, doodle, surface, mask, project, UV, and viewport controls). |
| `shell/ui/` | Declarative markup for the application header (tabs, top bar, modals), the editor body layout, and the dialogs rendered on demand (About, Preferences, Help, Export, Doodle, Texture, Danger zone, etc.). |
| `shell/icons/` | Interface icon runtime helpers (draw-icon module and on-demand SVG construction). |

## Interface and assets

| Directory | Responsibility |
|---|---|
| `assets/` | Attributed demonstration and testing assets used by the UV, texture, Doodle, and product-tour documentation. |
| `assets/ATTRIBUTION.md` | Credits, provenance, and license notes for every non-trivial image shipped under `assets/`. |
| `assets/federico-torre.jpg`, `assets/ico_xreate.{png,svg}` | Project portrait and application icon assets used by the About panel, share cards, favicon, and docs illustrations. |
| `assets/testing/` | Documentation-only imagery for tutorials and UV/compositor references. Some files are AI-generated (marked in attribution and source filenames such as `Codex-Image-*` and `Gemini_Generated_Image_*`); the NASA blue-marble and skybox assets are reused with their original licenses. These are NOT live editor textures: they are only consumed by the written tutorials in `README.md`. |
| `scenes/` | Public `.xreate.json` reference scenes, their co-located GLB and USDZ viewer fixtures, and where applicable the exported scene-local texture-atlas PNG produced during export. The set includes four device-scale authoring demos (pencil-and-paper polygon, mirror-polygon doodle, revolve doodle, volume+texture), a UV-mapping `uv_checker_all_shapes` validation scene, and the `interoperability-showcase` composite scene that combines the four authoring outputs for cross-tool export review. |
| `scenes/README.md` | Orientation note for the device-scale scene set with format and axis-size expectations. |
| `scenes/cinematic-experimental/` | Explicitly large-scale cinematic storytelling studies — Aurora Gate, Nebula Flight Deck 3,000+ volume cockpit, Spatial Study Alcove — plus their generation README. |
| `vendor/` | Pinned browser dependency distributed with the application. Currently `vendor/three.min.js` is the only vendored file (MIT / Three.js Authors). No other third-party runtime scripts are included. |
| `docs/` | Contributor, localization, limitations, future-fixes, smoke-test, development, and inventory documentation. `docs/README.md` is the sub-area orientation page. |
| `docs/README.md` | Local orientation index for the docs area with a short map of each Markdown file. |
| `docs/REPOSITORY-INVENTORY.md` | This file: structure, responsibility, and consistency rules for the public repository (self-reference for external links into the docs area). |
| `docs/DEVELOPMENT.md` | How to run, verify, and extend the application for contributors. |
| `docs/SMOKE-TEST.md` | Manual browser-workflow checklist complementing the Node-level smoke and static suites. |
| `docs/KNOWN-LIMITATIONS.md` | Candid current constraints, compatibility notes, and unsupported-but-understood edges. |
| `docs/FUTURE-FIXES.md` | Confirmed maintenance work, planned compatibility follow-up, and the boundary between a known issue and a future enhancement. |
| `docs/LOCALIZATION.md` | UI language coverage, the AI-assisted translation disclaimer, and how strings are expanded and reviewed. |
| `docs/screenshots/` | README product-tour screenshots, numbered 01–21. The JPEG files (01–18) cover the in-app workflow; the PNG files (19–21) document cross-tool interoperability (19 — Apple Reality Composer Pro, 20 — Godot 4) and the new multi-source `interoperability-showcase` reference scene viewed inside the XReate editor (21). |
| `docs/media/` | Silent English-language 16:9 MP4 walkthroughs recorded from the app viewport: `xreate-live-01-compose-volumes.mp4`, `xreate-live-02-doodle-polygon.mp4`, `xreate-live-03-texture-uv.mp4` (each ≈ 30 s pointer-led demo). |
| `docs/media/interactive-demo-frames/` | Still-frame PNG sequences extracted from the `xreate-live-*` walkthrough clips for accessibility captions, documentation illustrations, and offline review of frame-accurate steps. Frame-series prefixes match the three pointer-led demos listed in `README.md`. |

## Verification and exploratory tools

| Directory | Responsibility |
|---|---|
| `tools/` | Deterministic smoke checks, static audits, local development server (`dev-server.py`), AI-assisted translation expansion scripts, JSDoc index, and scene-generation fixtures (Aurora Gate, cinematic cockpit, refresh-reference-usdz). |
| `stress-tests-for-the-browser/` | Manual browser harnesses for interaction and ownership regressions. Each `*.js` file is a self-contained script that the browser-side static test framework loads when requested; `README.md` inside the directory explains how to run and interpret the harnesses. |
| `stress-tests-for-the-browser/README.md` | Local orientation note for the browser-harness folder. |

Run the public quality gates with:

```sh
npm run test:static
npm run test:smoke
npm run test:doodle:stress
```

The application does not require a build step. `npm run dev` starts a local
server for development, and the address is printed by that command.

## Consistency rules

1. UI strings resolve through a locale dictionary or the English fallback.
2. A selected volume owns its image layers; the active layer controls the
   current image transform and linked mask. Scaling a masked layer transforms
   the image and its mask together around the mask centre.
3. The full-screen UV workspace portals the live editor controls rather than
   maintaining a second editable copy.
4. Reference scenes remain device-scale for AR/XR review; `scenes/cinematic-experimental/`
   is explicitly exempt because it demonstrates large-scale composition.
5. Where present, scene-local GLB/USDZ and texture-atlas PNG files are
   generated test artifacts; their matching `.xreate.json` files remain the
   editable source of record.
6. Documentation describes public paths and commands only; it does not depend
   on an individual development machine.
7. Confirmed maintenance work and future product follow-up are tracked in
   `docs/FUTURE-FIXES.md`; unverified audit hypotheses do not appear there as
   defects.
8. All vendored runtime code lives under `vendor/` and is listed explicitly
   in this inventory together with its license lineage in `NOTICE.md`.
9. `docs/screenshots/` filenames are strictly numbered so that new
   screenshots append to the sequence (22, 23, …) without breaking the
   stable links referenced in `README.md`, `SHARE.md`, and issue reports.
