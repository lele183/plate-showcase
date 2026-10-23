# Tabletop source resolution audit - October 23, 2026

The audit covers all 3,133 baseline product records across 83 collections.
The final catalog resolves to 3,077 distinct current tabletop image paths.
It measures the
native nontransparent dinnerware silhouette, excluding padding with alpha
below 32. This detects enlargement risk; it does not measure focus, texture
quality, or perceived sharpness.

The reference desktop footprint is approximately 640 pixels. A 1400-pixel
PNG export gives dinnerware a maximum 1064-pixel span (1400 x 0.76).

## Before the full official-photo replacement

The first release upgraded 118 photographs in four collections. Its remaining
3,015 low-resolution records shared 1,607 scan cutouts.

| Native subject long edge | Product records | Distinct assets | Implication |
| --- | ---: | ---: | --- |
| Under 320 px | 1,129 | 802 | Substantial enlargement on desktop and in exports |
| 320-639 px | 1,886 | 805 | Below the desktop reference footprint |
| 640-1063 px | 0 | 0 | Desktop detail available, export still enlarges |
| At least 1064 px | 118 | 118 | Enough native pixels for the current export footprint |
| Total | 3,133 | 1,725 | Multiple SKUs can share one photographed form |

The initial 118 detailed assets were the official SKU-matched photographs added for
Legna (29), Mars (30), Iris Blue (29), and Porto (30). Six cup records across
those four collections still use scan cutouts. The remaining 79 collections
also retain scan cutouts. The official source manifest records the exact
product association, native dimensions, preparation method, and output hash.

## Examples before replacement

| Product | Subject long edge | Enlargement to export footprint |
| --- | ---: | ---: |
| Glory GL-309 | 301 px | 3.535 x |
| Lyon LY-307YL | 315 px | 3.378 x |
| Nessico NS-701Y | 328 px | 3.244 x |
| Birmingham BM-107GR | 331 px | 3.215 x |
| Milestone MS-106IV | 376 px | 2.830 x |
| Honda HO-2406 | 383 px | 2.778 x |

The largest affected groups before this replacement were
Milestone (168), Nessico (158), Birmingham (112), Lyon (110), and ABCO (98).
These counts are product records, including size and color variants, rather
than distinct photographs.

## After the full official-photo replacement

The public official inventory contained 2,978 products. Exact SKU and series
matching identified 3,006 catalog records; five individually reviewed SKU
aliases brought the association count to 3,011. Repeated catalog associations
explain why these counts exceed the number of official products.

3,000 records across 80 collections now use official photographs, including
the previous 118. This replaces 2,882 additional studio image associations.
All 3,133 original catalog image paths, product specifications, source notes,
and collection associations remain unchanged. Images are not upscaled or
generated with AI.

| Native subject long edge | Product records | Distinct assets | Implication |
| --- | ---: | ---: | --- |
| Under 320 px | 51 | 45 | Retained scans; substantial enlargement |
| 320-639 px | 82 | 32 | Retained scans; below desktop reference |
| 640-1063 px | 94 | 94 | Official photographs improve desktop detail; export still enlarges |
| At least 1064 px | 2,906 | 2,906 | Enough native pixels for the current export footprint |
| Total | 3,133 | 3,077 | Each official photograph has an exact catalog association |

The local transparent WebP files have at most 1400 pixels on the long edge.
Processing respects EXIF orientation, converts ICC profiles to sRGB, retains
existing source transparency, and repairs translucent edge colors. For 110
clear or tinted glass photographs, the mask preserves white photographic
highlights within the observed cup/base outline and keeps narrow stems;
it does not simulate physically correct background refraction. The original
RGB photography supplies all product detail.

`resources/studio-photo-sources.json` records all source URLs, dimensions,
output hashes, and any special treatment. `resources/studio-photo-aliases.json`
documents the five reviewed numbering differences. The aliases do not change
the catalog SKU or its printed measurements.

## Sources still unavailable

133 records still use their real scan cutouts:

- 122 have no verified photograph in the public official inventory, including
  records whose official product exists without an image.
- 11 have official photographs with native subjects below 640 pixels.

| Collection | Retained scan records |
| --- | ---: |
| Longevity | 32 |
| Peony | 32 |
| Urban Line | 19 |
| Prideland | 13 |
| Nessico | 10 |
| Rome | 9 |
| Black and Red | 5 |
| Catering | 4 |
| Compartment | 2 |
| Orchis | 2 |
| Fuji, Miami, Stemware, Woodland, Yofo | 1 each |

Additional searches covered the official public media library, SKU spelling
variants, unscaled media originals, and the Rome, Longevity, Mayor, Orchis,
Peony, and Prideland collection PDFs. Those PDFs contain 1654 x 2244 raster
pages, rather than separate high-resolution product photographs. Similar
shapes with another color or size were not substituted. AI reconstruction
was not used to invent missing glaze patterns or product geometry.

Every unresolved SKU and its reason is retained in
`resources/studio-photo-unavailable.json`; this is not a claim that all scans
have been replaced.

## Reproduce

```sh
python scripts/audit_studio_resolution.py
python scripts/catalog_studio_bulk.py --refresh-inventory --fetch --minimum-subject 640 --workers 4
python -m unittest discover -s scripts -p "test_catalog_studio*.py"
```

Install `scripts/requirements-catalog.txt` first if Pillow is unavailable.
The audit command reads local assets only and writes:

- `.cache/studio-resolution-audit/report.json`: methodology, per-collection
  counts, dimensions, subject bounds, and per-asset tiers.
- `.cache/studio-resolution-audit/items.csv`: all 3,133 exact SKU mappings,
  sorted by native subject resolution, with enlargement ratios.

The bulk preparation command explicitly permits manufacturer downloads.
Without `--fetch` or `--refresh-inventory`, it uses the local inventory and
original-photo cache only. It checkpoints completed files so interrupted
preparation can resume. Normal application builds use checked-in images and
never fetch manufacturer photos.

Validation passed: 158 unit tests, 14 Python regression tests, TypeScript,
ESLint, catalog integrity, and a production build. All 62 targeted desktop
and phone cases passed; the eight affected glass/photo cases were repeated
after the final highlight-mask repair. Asset tests decode every official
photo and verify its hash, native detail, transparent margins, SKU mapping,
and original scan reference.
