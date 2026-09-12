# Known limitations

XReate is an experimental teaching tool. The following are known engineering
constraints, not hidden promises of future work.

| Area | Current state | What to verify before a public release |
|---|---|---|
| USDZ | Exports use one USD Preview Surface per material for portable RealityKit PBR import; viewer behavior can still vary by platform or beta release. | Re-export after exporter changes, then open the fresh file in Quick Look and the intended independent viewer, including Reality Composer Pro when it is the target. |
| Responsive UX | Phones use in-flow Composition, Volume, and 3D Texture accordions; tablets use a scrollable viewport-first grid. | Test portrait and landscape, including that closed bodies do not overlap and two-finger canvas gestures work. |
| Doodle on phones | The tracing canvas is deliberately unavailable on phone-sized layouts; Add Volume explains that Doodle needs a larger canvas. | Use a tablet or desktop for Polygon, Mirror, and Revolve Doodle workflows. |
| Revolve cap UV editing | Cylindrical UV previews show the two circular cap islands for a Revolve Doodle, but direct cap-island selection and independent cap texture placement are not yet available. | Verify the side projection; plan cap-island editing before relying on separate top/bottom artwork. |
| Browser tests | Automated checks cover deterministic logic and fixtures. | Perform the manual WebGL, modal, texture, touch, and export smoke test. |

The public goal is a stable minimum viable learning workflow, not feature
parity with commercial modelling software.

Confirmed engineering maintenance work and longer-term product follow-up are
listed separately in [Future fixes](FUTURE-FIXES.md). This keeps release
constraints distinct from work that has not yet been scheduled.
