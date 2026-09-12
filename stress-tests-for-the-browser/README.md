# Browser stress scripts

These are manual browser-console scripts, not part of `npm run test:smoke`.
The supported feature checks restore the project automatically; high-impact
diagnostics still declare their side effects in their own headers.

## Recommended order

1. `texture-ownership-regression.js` — targeted A → B → C texture isolation
   regression. It restores the project automatically when complete.
2. `doodle-stress.js` — full interactive Polygon / Mirror / Revolve contract:
   validates the three geometry builders across seeded outlines, mode controls,
   scale reference behavior, save/load routing, and the photo-source flow.
   It leaves the project untouched unless the optional creation section is
   deliberately enabled at the top of the script.
3. `texture-bombing-stress.js` — 110 entities × 10 image layers, with three
   polygon-mask families. It uses `assets/testing/skybox-example.png` as the
   visible composite on every temporary entity, then verifies image, mask, and transform ownership plus
   a save round trip before restoring the project. Set `keepScene: true` only
   when visual inspection is required; then use its **Restore project** notice
   or run `XR.__restoreTextureBombingStress()` in the console when finished.
4. `latest-features-regression-check.js` — broad read-only UI contract check.
5. `file-insert-save-load-stress.js` and `project-cycle-stress.js` — project
   persistence under repeated mutation.
6. `undo-determinism-stress.js`, `ui-panels-stress.js`, and
   `user-simulation-stress.js` — command/UI churn.
7. `autosave-stress.js`, `overclock-render-stress.js`, and `tnt-stress.js` —
   high-impact diagnostics; use only when investigating a reproducible issue.

## How to run

Start the app with `npm run dev`, open the printed URL, open DevTools Console,
and paste the complete script. Read each script’s first comment before running
it. A passing syntax check does not certify browser behavior; the resulting
console report is the test evidence.
