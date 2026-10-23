# Tabletop source resolution audit - October 23, 2026

The audit covers all 3,133 baseline product records across 83 collections,
resolving to 1,725 distinct current tabletop image paths. It measures the
native nontransparent dinnerware silhouette, excluding padding with alpha
below 32. This detects enlargement risk; it does not measure focus, texture
quality, or perceived sharpness.

The reference desktop footprint is approximately 640 pixels. A 1400-pixel
PNG export gives dinnerware a maximum 1064-pixel span (1400 x 0.76).

| Native subject long edge | Product records | Distinct assets | Implication |
| --- | ---: | ---: | --- |
| Under 320 px | 1,129 | 802 | Substantial enlargement on desktop and in exports |
| 320-639 px | 1,886 | 805 | Below the desktop reference footprint |
| 640-1063 px | 0 | 0 | Desktop detail available, export still enlarges |
| At least 1064 px | 118 | 118 | Enough native pixels for the current export footprint |
| Total | 3,133 | 1,725 | Multiple SKUs can share one photographed form |

The 118 detailed assets are the official SKU-matched photographs added for
Legna (29), Mars (30), Iris Blue (29), and Porto (30). Six cup records across
those four collections still use scan cutouts. The remaining 79 collections
also retain scan cutouts. The official source manifest records the exact
product association, native dimensions, preparation method, and output hash.

## Remaining examples

| Product | Subject long edge | Enlargement to export footprint |
| --- | ---: | ---: |
| Glory GL-309 | 301 px | 3.535 x |
| Lyon LY-307YL | 315 px | 3.378 x |
| Nessico NS-701Y | 328 px | 3.244 x |
| Birmingham BM-107GR | 331 px | 3.215 x |
| Milestone MS-106IV | 376 px | 2.830 x |
| Honda HO-2406 | 383 px | 2.778 x |

The largest remaining groups by number of affected catalog records are
Milestone (168), Nessico (158), Birmingham (112), Lyon (110), and ABCO (98).
These counts are product records, including size and color variants, rather
than distinct photographs.

## Reproduce

```sh
python scripts/audit_studio_resolution.py
```

Install `scripts/requirements-catalog.txt` first if Pillow is unavailable.
The command reads local assets only and writes:

- `.cache/studio-resolution-audit/report.json`: methodology, per-collection
  counts, dimensions, subject bounds, and per-asset tiers.
- `.cache/studio-resolution-audit/items.csv`: all 3,133 exact SKU mappings,
  sorted by native subject resolution, with enlargement ratios.

The current release improves the 118 prepared photographs. It does not
reconstruct detail in the remaining scans. Further replacements should use
verified original product photographs, preserve exact SKU and collection
associations, and retain the original catalog imagery and specifications.
