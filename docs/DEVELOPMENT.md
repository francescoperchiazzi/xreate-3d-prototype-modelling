# Run and verify XReate

## Requirements

- Node.js 20 or later
- npm 10 or later
- Python 3
- A current browser; a tablet is recommended for touch verification

## Start the development server

From the project folder, run:

```sh
npm run dev
```

Open the address printed in the terminal. `npm start` provides the same
command. A static server is required because the application loads interface
sections and modules at runtime. XReate has no third-party npm dependencies or
build step.

## Fast checks

```sh
npm run test:static
npm run test:comments
npm run test:smoke
npm run test:i18n
npm run test:reference-scenes
npm run export:refresh-reference-usdz
```

The first command checks syntax and architectural guardrails. The second runs
dependency-free behavior and fixture checks. They do not replace a visual
browser test of WebGL, image compositing, or an external GLB/USDZ viewer.
The localization check verifies that every static markup binding resolves in
the selected locale or through the explicit English fallback.
The comment-language audit scans JavaScript, CSS, and Python implementation
comments for non-English Italian markers, keeping developer-facing annotations
in English.
The reference-scene check rebuilds every committed demo with the production
geometry builders and verifies its complete composition stays at or below one
metre on its largest axis, suitable for device-scale AR/XR review.
The export refresh command repackages the checked-in scene-local USDZ fixtures
after a material-exporter change and validates them with the USD checker.

## Reporting an issue

An actionable report contains one reproducible gesture, the expected and actual
result, browser and device dimensions, and a screenshot or short recording
when useful. Use the visible bug-report button in the application or the
project issue tracker.

## Optional browser stress checks

[`stress-tests-for-the-browser/`](../stress-tests-for-the-browser/) contains
optional browser checks. They are not part of the automated smoke suite and
may alter a project or autosave data; read its README and use a disposable
session. The Doodle check covers Polygon, Mirror, Revolve, photo references,
touch cancellation, and the zoom-aware scale ruler.
