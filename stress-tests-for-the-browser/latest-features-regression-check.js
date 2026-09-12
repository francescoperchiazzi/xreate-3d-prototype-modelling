/*
 * XReate — current UI/runtime contract check
 *
 * Run in DevTools. This is read-only: unlike its retired predecessor it never
 * clears the project, changes selection, or dispatches editor actions.
 */
(async () => {
  const XR = window.XR || {};
  const report = { ok: true, checks: [] };
  const record = (name, ok, details = {}) => {
    report.checks.push({ name, ok, details });
    report.ok &&= Boolean(ok);
    (ok ? console.log : console.error)(`${ok ? 'PASS' : 'FAIL'} — ${name}`, details);
  };
  const compact = (value) => (value || '').replace(/\s+/g, ' ').trim();

  try {
    const references = Array.from(document.querySelectorAll('script[src], link[href], img[src]'))
      .map((node) => node.getAttribute('src') || node.getAttribute('href') || '');
    const legacyRefs = references.filter((url) => /[?&]v=(mig-|ui\d+)/i.test(url));
    record('No retired cache-busting URLs', legacyRefs.length === 0, { legacyRefs });

    const buttons = Array.from(document.querySelectorAll('#xreate-app button, .xr-shell button, .xr-modal button'));
    const rounded = buttons.filter((button) => !['0px', '0px 0px 0px 0px'].includes(getComputedStyle(button).borderRadius));
    record('Editor buttons use square corners', buttons.length > 0 && rounded.length === 0, {
      checked: buttons.length,
      rounded: rounded.slice(0, 5).map((button) => compact(button.textContent))
    });

    const uv = XR.UVMapping || XR.__modules?.UVMapping || {};
    const canonicalize = uv.canonicalizeUvMode;
    const pairs = canonicalize && [
      ['sphere', 'sphere'], ['spherical', 'sphere'],
      ['cylinder', 'cylindrical'], ['cylindrical', 'cylindrical'],
      ['plane', 'planar'], ['planar', 'planar'], ['box', 'box']
    ];
    const mapOk = Boolean(pairs) && pairs.every(([input, expected]) => canonicalize(input) === expected);
    record('UV modes canonicalize to the current vocabulary', mapOk, {
      available: typeof canonicalize === 'function',
      samples: canonicalize ? Object.fromEntries(pairs.map(([input]) => [input, canonicalize(input)])) : null
    });

    const toast = document.querySelector('#toast, .xr-toast-host, [role="status"]');
    record('Runtime exposes visible toast feedback', typeof XR.showToast === 'function' && Boolean(toast), {
      showToast: typeof XR.showToast,
      toastHost: Boolean(toast)
    });

    const uvTitle = Array.from(document.querySelectorAll('.xr-surface-section-title, h2, h3, h4'))
      .find((node) => /UV Mapping Projection/i.test(compact(node.textContent)));
    record('UV Mapping Projection is present', Boolean(uvTitle), {
      title: compact(uvTitle?.textContent)
    });

    const resets = ['btn-tr-reset-pos', 'btn-tr-reset-rot', 'btn-tr-reset-scale']
      .map((id) => document.getElementById(id));
    record('Transform reset controls are available', resets.every(Boolean), {
      found: resets.map(Boolean)
    });

    // The modal is mounted in the page at startup but hidden until a layer
    // opens it. These camel-case ids are the public controls in modals.html.
    const maskSelect = document.getElementById('maskModeSelect');
    const maskEdit = document.getElementById('maskModeEdit');
    record('Mask modal has explicit Select and Edit modes', Boolean(maskSelect && maskEdit), {
      selectDisabled: maskSelect?.disabled ?? null
    });

    const doodleModes = ['doodleModePolygon', 'doodleModeMirror', 'doodleModeRevolve']
      .map((id) => document.getElementById(id));
    record('Doodle exposes Polygon, Mirror, and Revolve modes', doodleModes.every(Boolean), {
      labels: doodleModes.map((button) => compact(button?.textContent))
    });
  } catch (error) {
    record('Checker completed without exception', false, { message: error?.message || String(error) });
  }

  window.XR = window.XR || {};
  window.XR.__lastLatestFeaturesRegression = report;
  console.table(report.checks.map(({ name, ok }) => ({ gate: name, pass: ok })));
  console.log(`[LATEST-FEATURES-REGRESSION] ${report.checks.filter((check) => check.ok).length}/${report.checks.length} passed. overall=${report.ok ? 'PASS' : 'FAIL'}`);
  return report;
})().catch((error) => {
  console.error('[LATEST-FEATURES-REGRESSION] Unhandled failure', error);
  throw error;
});
