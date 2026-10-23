"""Audit every baseline tabletop photograph locally, including transparent padding.

Writes a per-SKU CSV and a JSON report under the ignored .cache directory.
Pixel counts identify enlargement risk, not a subjective sharpness score.
"""
import argparse
import csv
import json
from collections import Counter
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DESKTOP_SPAN = 640
EXPORT_SPAN = 1064  # 1400-pixel tabletop canvas, 0.76 maximum dinnerware span.


def inspect_photo(path):
    with Image.open(path) as image:
        alpha = image.convert('RGBA').getchannel('A')
        bounds = alpha.point(lambda value: 255 if value >= 32 else 0).getbbox()
        if not bounds:
            raise ValueError('Empty dinnerware silhouette: ' + str(path))
        width, height = bounds[2] - bounds[0], bounds[3] - bounds[1]
        longest = max(width, height)
        tier = (
            'very-low' if longest < 320 else
            'low' if longest < DESKTOP_SPAN else
            'export-upscale' if longest < EXPORT_SPAN else
            'export-ready'
        )
        return {
            'width': image.width,
            'height': image.height,
            'subjectWidth': width,
            'subjectHeight': height,
            'subjectLongestPixels': longest,
            'tier': tier,
            'exportUpscale': round(EXPORT_SPAN / longest, 3),
        }


def audit(output):
    seed = json.loads((ROOT / 'src/data/catalog.json').read_text(encoding='utf-8'))
    paths = sorted({item.get('studioImage') or item['image'] for item in seed['items']})
    assets = {}
    public = (ROOT / 'public').resolve()
    for path in paths:
        if not path.startswith('/catalog/'):
            raise ValueError('Expected a local catalog asset: ' + path)
        source = (public / path.lstrip('/')).resolve()
        if not source.is_relative_to(public):
            raise ValueError('Catalog asset is outside public/: ' + path)
        assets[path] = inspect_photo(source)

    rows = [
        {
            'itemId': item['id'],
            'collectionId': item['collectionId'],
            'sku': item['sku'],
            'type': item['type'],
            'image': item.get('studioImage') or item['image'],
            **assets[item.get('studioImage') or item['image']],
        }
        for item in seed['items']
    ]
    collections = []
    for collection in seed['collections']:
        members = [row for row in rows if row['collectionId'] == collection['id']]
        collections.append({
            'id': collection['id'],
            'name': collection['name'],
            'items': len(members),
            'tiers': dict(Counter(row['tier'] for row in members)),
        })
    report = {
        'method': 'Native nontransparent subject bounds, alpha >= 32; no network requests.',
        'desktopTargetPixels': DESKTOP_SPAN,
        'exportDinnerwarePixels': EXPORT_SPAN,
        'definitions': {
            'very-low': 'Subject long edge under 320 pixels.',
            'low': 'Subject long edge from 320 to 639 pixels.',
            'export-upscale': 'At least 640 pixels, but below the 1064-pixel export footprint.',
            'export-ready': 'At least 1064 pixels on the subject long edge.',
        },
        'itemCount': len(rows),
        'assetCount': len(assets),
        'itemTiers': dict(Counter(row['tier'] for row in rows)),
        'assetTiers': dict(Counter(row['tier'] for row in assets.values())),
        'collections': collections,
        'assets': assets,
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    with (output / 'items.csv').open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(sorted(rows, key=lambda row: (
            row['subjectLongestPixels'], row['collectionId'], row['sku']
        )))
    print(json.dumps({
        key: report[key]
        for key in ['itemCount', 'assetCount', 'itemTiers', 'assetTiers']
    }, indent=2))
    print('Reports:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=ROOT / '.cache/studio-resolution-audit')
    audit(parser.parse_args().output_dir)
