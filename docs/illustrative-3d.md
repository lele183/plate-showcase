# Illustrative 3D studio

The studio loads local Blender-built GLB meshes on demand. Coupe, rimmed,
tray, and hollow bowl profiles have rounded lips, undersides, and foot rings.
Each profile has round, rounded square, triangular, and organic variants.
Oval and rectangular pieces use the appropriate outline scaled by their
catalog length and width. The catalog height sets the profile depth when
available; otherwise the viewer identifies the height as estimated.

These are illustrative profiles, not manufacturer CAD or reconstructed scans.
Suitable top-view photographs supply surface detail. Angled photographs,
bowls, cups, and compartment pieces use a sampled glaze color instead of
stretching the whole photograph over their interior. The Photo button shows
the original product photograph alongside the model, and opens the full image.
Decoration on the glaze preview is not reconstructed.

Hollow cups and mugs have round or square bodies, with handles on mug and
coffee-cup profiles. Catalog heights preserve their upright proportions.
Divided pieces use raised walls, curved or radial partitions, cup recesses,
and mirrored lunch-tray layouts, with the walls fused into the well.
Bowl centers are built from level profile rings rather than subdivided poles.
These layouts approximate the catalog
photographs. Specialist forms without an appropriate model, such as egg
holders, taco plates, lidded servers, pitchers, and irregular divided bowls,
retain their original photograph instead of receiving a generic plate.

All 112 catalog glass records have hollow models: shots, tumblers, stemless
wine, wine and goblet stems, brandy, coupe, martini, margarita, flute,
hurricane, pilsner, and beer mugs. Separate assets use each record's
top and base diameters where specified. Runtime height follows catalog
measurements; missing measurements remain estimates. Glass and translucent
plastic use transmission, refraction, and the appropriate color rather than
photographs projected onto opaque ceramic. Surface decoration and fluting
are not reconstructed. Camera framing accounts for tall stems.

## Rebuild the assets

No external Blender add-on or paid model endpoint is required. Run Blender
in background mode from the project directory:

```powershell
& 'E:\SteamLibrary\steamapps\common\Blender\blender.exe' `
  --background --factory-startup --python-exit-code 1 `
  --python scripts/build-dinnerware.py
```

The script writes 148 GLB files and `provenance.json` into
`public/models/dinnerware/`. Blender is an authoring dependency only;
the deployed application serves these static files.

## Viewer behavior

- Illustrative 3D starts with No food. Explicit food choices, crop, portion,
  rotation, placement, and tabletop settings carry between views without
  rebuilding the renderer. The Tabletop view keeps its own starter default
  until a food choice is made; shared links preserve the chosen food.
- Perspective, top, and side presets accompany orbit, zoom, reset, full screen,
  optional rotation, two lighting setups, and catalog dimension guides.
- Focus the canvas to orbit with arrow keys, zoom with `+` / `-`, or reset
  with `0`. The same actions are available as labeled buttons.
- Download 3D image exports the current camera, tabletop, lighting, and food,
  with an illustrative-geometry caption. Tabletop export remains available
  in Tabletop mode.
- Rendering stops at rest, outside the viewport, or in a hidden tab. Damping
  follows the reduced-motion preference. Rotation starts only on request.
- WebGL, model, and product-photo failures release GPU resources and show
  the source photograph. A failed food image keeps the product view available.

`tests/unit/dinnerware-model.test.ts` validates measurements and GLB exports.
`tests/browser/illustrative-3d.spec.ts` checks interactions, export, setting
continuity, bowls, and failures on desktop and phone. Existing lifecycle
tests exercise repeated item switching and partial initialization failures.
Geometry checks raycast bowl centers around a full circle to catch tilted
wells, and distinguish the cavities of shots, wine glasses, martinis and flutes.

## Image-to-3D alternative

The suggested Blender MCP add-on can assist interactive authoring but is not
needed for the scripted exports. Microsoft's TRELLIS.2 can produce textured
GLB assets from photographs, but its documented installation requires Linux
and an NVIDIA GPU with at least 24 GB of memory. A Colab runtime would need
that hardware and its CUDA dependencies before running the pipeline.
The assets supplied here were built locally in Blender; no TRELLIS inference
or Colab run was performed.
