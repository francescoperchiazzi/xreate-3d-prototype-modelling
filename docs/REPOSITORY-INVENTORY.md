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
| `package.json` | Reproducible development and verification commands. |
| `README.md` | Product overview, setup, product tour, and release checks. |
| `ARCHITECTURE.md` | Product data model and implementation boundaries. |
| `SYSTEM-ATLAS.md` | Visible control map, interaction flow, and expected outcomes. |
| `LICENSE` and `NOTICE.md` | Software license and third-party material notices. |
| `FOR-FEDERICO.md` | Project dedication and creative context. |

## Application code

| Directory | Responsibility |
|---|---|
| `engine/core/` | Editor state, project state, selection, transforms, and runtime coordination. |
| `engine/editor/` | Commands, scene runtime, and resource ownership. |
| `engine/shapes/` | Primitive definitions, geometry, Doodle, and shape construction. |
| `engine/image/` | Image import, affine transforms, compositing, canvas interaction, and masks. |
| `engine/texture/` | Layer sessions, UV texture workflow, canvas runtime, and texture mode. |
| `engine/viewport/` | 3D viewport navigation, raycasting, and transform tooling. |
| `engine/export/` | GLB, USDZ, configuration, and texture-atlas export. |
| `engine/persistence/` | Project serialisation, autosave, and browser storage. |
| `engine/debug/` | Event recorder and debugging support. |
| `engine/legacy/` | Compatibility bridge while modular runtime APIs are adopted. |
| `engine/canvas/` | Canvas and viewport drawing support. |

## Interface and assets

| Directory | Responsibility |
|---|---|
| `shell/` | Browser shell modules and interface coordination. |
| `shell/ui/` | Declarative header, editor, and modal markup. |
| `shell/icons/` | Interface icon assets. |
| `assets/` | Attributed demonstration and testing assets. |
| `scenes/` | Public `.xreate.json` reference scenes and selected co-located GLB/USDZ fixtures. |
| `scenes/cinematic-experimental/` | Explicitly large-scale cinematic storytelling studies, including a documented 3,000+ volume cockpit stress test, and their generation notes. |
| `vendor/` | Pinned browser dependencies distributed with the application. |
| `docs/` | Contributor, localization, limitations, future-fixes, smoke-test, and inventory documentation. |
| `docs/screenshots/` | README product-tour screenshots. |
| `docs/media/` | Silent English-language 16:9 MP4 walkthroughs recorded from the app viewport, including three 30-second pointer-led interaction demos and a one-minute overview. |

## Verification and exploratory tools

| Directory | Responsibility |
|---|---|
| `tools/` | Deterministic smoke checks, static audits, local development server, and fixtures. |
| `stress-tests-for-the-browser/` | Manual browser harnesses for interaction and ownership regressions. |

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
5. Where present, scene-local GLB/USDZ files are generated test artifacts; their
   matching `.xreate.json` files remain the editable source of record.
6. Documentation describes public paths and commands only; it does not depend
   on an individual development machine.
7. Confirmed maintenance work and future product follow-up are tracked in
   `docs/FUTURE-FIXES.md`; unverified audit hypotheses do not appear there as
   defects.
