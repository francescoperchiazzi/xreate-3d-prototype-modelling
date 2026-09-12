# Manual smoke test

Run this after `npm run test:static` and `npm run test:smoke`, on a desktop
browser and at least one tablet and phone-sized viewport.

The automated Doodle matrix is part of `npm run test:smoke`; it can also be
run on its own with `npm run test:doodle:stress`. For a live browser session,
run the companion console harness in
[`stress-tests-for-the-browser/doodle-stress.js`](../stress-tests-for-the-browser/doodle-stress.js).

1. Boot the app and verify that the console has no unexpected error.
2. Add a Sphere, a Cone, and a Cube using **Add Volume**.
3. Select each from the canvas and then from **Composition**. The selected
   object, bbox, and single gizmo must agree.
4. Move one object and duplicate it. The gizmo follows the selected duplicate;
   no spare gizmo remains at the origin.
5. In **Texture**, apply a checker, duplicate A → B → C, change C’s image
   transform, then confirm A and B are unchanged. Import a texture, make an
   unrelated transform change, then use Undo and Redo: the imported texture
   must remain on the selected object.
6. Change UV projection on a sphere and a cone; the projection shown in the UI
   must match the geometry selected.
7. Open **Mask**, use Square or Circle, adjust scale, apply, and confirm the
   complete source image fits the initial editor view.
8. On desktop or tablet, create three Doodles: a closed **Polygon**, a left-half **Mirror** (trace
   the outer contour from one centre-line endpoint to the other; both halves
   must appear as one continuous mesh), and a left-side **Revolve** profile (it
   must form a complete 360° lathe). If a reference image is used, move it and
   then draw: image movement must not add or alter a polygon point. Assign
   Cylindrical UV mapping to the Revolve Doodle and verify that its two circular
   cap islands appear in the preview. Direct selection and independent artwork
   placement on those cap islands are a documented current limitation.
9. Duplicate each Doodle and save/load the project; selection, layer, UV
   mapping, transforms, and the Doodle mode must survive.
10. Export GLB and USDZ. Open both files in independent compatible viewers and
    compare orientation, scale, transforms, and texture direction. A Doodle
    must remain opaque when viewed from outside; its exterior must not be
    inside-out or transparent, and a closed Doodle must not reveal its inner
    wall through the exterior texture.
    The co-located GLB/USDZ fixtures in [`scenes/`](../scenes/) provide the same
    check for the projects that include them.
11. Load [`scenes/xreate_uv_checker_all_shapes.xreate.json`](../scenes/xreate_uv_checker_all_shapes.xreate.json).
    It must create exactly 23 visible shapes, apply the checker to every one,
    restore Sphere / Box / Cylindrical / Planar projection labels correctly,
    and keep the grid readable without overlapping shapes. Select one shape
    from each projection family to inspect its checker placement.
12. At tablet/phone width, verify that Add Volume and Menu are reachable, the
   phone viewport is square, and Composition, Volume, and 3D Texture are
   independent in-flow accordions. Their controls must never overlap. On a
   phone, Doodle must be visibly marked as available on tablet and desktop and
   must not open its tracing dialog.
13. On iPad and iPhone, drag a Volume slider with a finger. In UV Texture,
    move two fingers together to pan the image and change their distance to
    zoom it; in the 3D viewport, make a two-finger drag to pan the camera.
14. Confirm the floating bug-report control remains visible, opens a prefilled
    email, and does not block the viewport or mobile accordions.

## Included test images

- `assets/testing/skybox-example.png`: useful for checking cube-face or atlas
  orientation. Its labels make an unwanted mirror or rotation immediately
  visible.
- `assets/testing/blue-marble-2002-1280.png`: a 2:1 equirectangular Earth map,
  useful for checking cylindrical and spherical projection seams and poles.

See [`assets/ATTRIBUTION.md`](../assets/ATTRIBUTION.md) before redistributing
the test files.
