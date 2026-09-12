# Future fixes and maintenance queue

XReate is published as an experimental learning tool. This page makes its
future work visible without presenting unverified hypotheses as defects or
promising a delivery date. Items are grouped by evidence rather than urgency.

## Confirmed engineering fix

| Item | Scope | Acceptance check |
| --- | --- | --- |
| Mirror Doodle wireframe cleanup | Deleting a Mirror Doodle while its clean-edge wireframe overlay exists does not currently dispose the overlay geometry and material. | Delete and replace Mirror Doodles after enabling wireframe; the overlay is removed, its GPU resources are disposed, and no overlay reference remains on the part. |

## Architecture maintenance

| Item | Why it matters | Intended direction |
| --- | --- | --- |
| Reduce legacy compatibility coupling | The editor still uses the `window.XR` compatibility facade while modular APIs are adopted. It works for the current single-editor runtime, but makes ownership harder to trace. | Continue passing explicit runtime dependencies to extracted modules; remove facade reads only when an equivalent tested module boundary exists. |
| Improve diagnostic error reporting | Some guarded UI and compatibility paths intentionally catch errors to keep the editor available. This can make a rare failure harder to investigate. | Keep recovery guards, but attach useful context to actionable failures and cover the affected path with a focused smoke test. |
| Expand runtime regression coverage | Deterministic checks cover the project model well, while GPU rendering and browser gestures still need device-level evidence. | Re-run the manual smoke test on current desktop, tablet, phone, and independent GLB/USDZ viewers before material release changes. |

## Product and compatibility follow-up

| Item | Current boundary | Future goal |
| --- | --- | --- |
| Revolve cap-island editing | Cylindrical UV preview exposes top and bottom cap islands, but they cannot yet receive independently positioned artwork. | Allow explicit cap-island selection and independent texture placement. |
| USDZ viewer variance | XReate exports portable USD Preview Surface materials, but viewer behavior can differ between platforms and beta builds. | Keep validating fresh exports in Quick Look and the intended production viewer; document any viewer-specific workaround. |
| Phone-sized Doodle creation | The Doodle canvas is intentionally limited to tablet and desktop because precise tracing needs continuous space. | Reconsider only with a touch-first tracing interaction that remains precise and accessible. |

## How to report a new issue

Please include one reproducible gesture, expected and actual results, browser
and device dimensions, and a screenshot or short recording when helpful. A
reproduced issue is prioritised above a speculative improvement.

For current release constraints, see [Known limitations](KNOWN-LIMITATIONS.md).
