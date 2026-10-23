"""Prepare SKU-matched official photographs for the tabletop, without AI.

Run with --fetch to refresh selected collections from Yanco's public product
API. Original downloads stay in the ignored cache; published WebP cutouts and
their provenance are checked in. Without --fetch, processing is offline.
"""
import argparse
import hashlib
import io
import json
import re
import time
from pathlib import Path
import numpy as np
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from PIL import Image, ImageCms, ImageDraw, ImageOps
from catalog_studio_images import cutout, refine_edges

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'resources/studio-photo-sources.json'
CACHE = ROOT / '.cache/studio-originals'
VERSION = 'official-photo-cutout-v1'
API = 'https://yancochina.com/wp-json/wc/store/v1/products'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def public_bytes(url):
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in {
        'yancochina.com', 'www.yancochina.com'
    }:
        raise ValueError('Expected an official Yanco HTTPS source')
    request = Request(url, headers={'User-Agent': 'Yanco-Showroom-Photo-Preparation/1.0'})
    with urlopen(request, timeout=45) as response:
        data = response.read(20 * 1024 * 1024 + 1)
    if len(data) > 20 * 1024 * 1024:
        raise ValueError('Official image exceeds the preparation size limit')
    return data


def glass_cutout(image):
    """Keep glass highlights connected to the white photographic backdrop.

    Use observed outer edges for the convex cup and base, while keeping the
    normal cutout around a narrow stem. Source RGB remains unchanged.
    """
    from scipy import ndimage
    from scipy.spatial import ConvexHull

    foreground = np.asarray(image.convert('RGB')).min(axis=2) < 235
    labels, count = ndimage.label(foreground)
    if not count:
        raise ValueError('Glass photograph has no visible boundary')
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    foreground = sizes[labels] >= max(8, sizes.max() * .00005)
    rows = foreground.any(axis=1)
    ys = np.flatnonzero(rows)
    xs = np.flatnonzero(foreground.any(axis=0))
    left = foreground.argmax(axis=1)
    right = image.width - 1 - foreground[:, ::-1].argmax(axis=1)
    widths = right - left + 1
    center = (xs[0] + xs[-1]) / 2
    narrow = (
        rows & (widths < widths.max() * .18)
        & (np.abs((left + right) / 2 - center) < widths.max() * .14)
    )
    narrow = ndimage.binary_closing(narrow, structure=np.ones(9))
    labels, count = ndimage.label(narrow)
    sizes = np.bincount(labels)
    sizes[0] = 0
    stem = np.flatnonzero(labels == sizes.argmax()) if count else []
    ranges = [(ys[0], ys[-1] + 1)]
    mask = Image.new('L', image.size)
    if len(stem) > len(ys) * .08:
        mask = cutout(image).getchannel('A')
        ranges = [(ys[0], stem[0] + 4), (stem[-1] - 3, ys[-1] + 1)]
    draw = ImageDraw.Draw(mask)
    for start, end in ranges:
        y, x = np.nonzero(foreground[start:end])
        points = np.column_stack((x, y + start))
        if len(points) >= 3:
            hull = ConvexHull(points)
            draw.polygon([tuple(point) for point in points[hull.vertices]], fill=255)
    result = image.convert('RGBA')
    result.putalpha(mask)
    return refine_edges(result)


def prepare_photo(image, treatment=None):
    image = ImageOps.exif_transpose(image)
    alpha = image.convert('RGBA').getchannel('A') if (
        'A' in image.getbands() or 'transparency' in image.info
    ) else None
    transparent = alpha is not None and alpha.getextrema()[0] < 255
    if image.info.get('icc_profile'):
        profile = ImageCms.ImageCmsProfile(io.BytesIO(image.info['icc_profile']))
        image = ImageCms.profileToProfile(
            image.convert('RGB'), profile, ImageCms.createProfile('sRGB'), outputMode='RGB'
        )
    if transparent:
        image = image.convert('RGBA')
        image.putalpha(alpha)
    else:
        image = image.convert('RGB')
    image.thumbnail((2200, 2200), Image.Resampling.LANCZOS)
    prepared = glass_cutout(image) if (
        treatment == 'glass-highlights-v1' and not transparent
    ) else cutout(image)
    bounds = prepared.getchannel('A').getbbox()
    if not bounds:
        raise ValueError('Official photo contains no usable dinnerware silhouette')
    # Retain a little transparent padding, without wasting most source pixels.
    padding = 10
    prepared = prepared.crop((
        max(0, bounds[0] - padding), max(0, bounds[1] - padding),
        min(prepared.width, bounds[2] + padding),
        min(prepared.height, bounds[3] + padding),
    ))
    prepared.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
    return prepared


def discover(items, collections):
    selected = [
        item for item in items
        if item['collectionId'] in collections
        and item['type'] in {'plate', 'platter', 'tray', 'bowl', 'sauce dish'}
    ]
    products = {}
    for offset in range(0, len(selected), 25):
        batch = selected[offset:offset + 25]
        query = urlencode({'sku': ','.join(item['sku'] for item in batch), 'per_page': 100})
        for product in json.loads(public_bytes(API + '?' + query)):
            products[product['sku']] = product
    entries = []
    for item in selected:
        product = products.get(item['sku'])
        if not product or not product.get('images'):
            print('No official photo:', item['id'], flush=True)
            continue
        series = next((
            attribute for attribute in product.get('attributes', [])
            if attribute.get('taxonomy') == 'pa_item-series'
        ), {})
        if item['collectionId'] not in {term['slug'] for term in series.get('terms', [])}:
            raise ValueError('Official collection does not match ' + item['id'])
        filename = 'studio-photo-' + re.sub(r'[^a-z0-9-]', '-', item['id'].lower()) + '.webp'
        entries.append({
            'itemId': item['id'],
            'sku': item['sku'],
            'collectionId': item['collectionId'],
            'catalogImage': item['image'],
            'productUrl': product['permalink'],
            'sourceUrl': product['images'][0]['src'],
            'output': '/catalog/' + filename,
        })
    return entries


def refresh(fetch=False, collections=None):
    seed_path = ROOT / 'src/data/catalog.json'
    seed = json.loads(seed_path.read_text(encoding='utf-8'))
    document = json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {
        'version': VERSION,
        'method': 'Official SKU-matched product photography; background removal and downsampling only. No AI or upscaling.',
        'images': [],
    }
    entries = document['images']
    catalog_images = {item['id']: item['image'] for item in seed['items']}
    for entry in entries:
        entry['catalogImage'] = catalog_images[entry['itemId']]
    if fetch:
        fresh = discover(seed['items'], set(collections))
        refreshed = {entry['itemId'] for entry in fresh}
        previous = {entry['itemId']: entry for entry in entries}
        entries = [entry for entry in entries if entry['itemId'] not in refreshed]
        for entry in fresh:
            old = previous.get(entry['itemId'], {})
            entries.append({**old, **entry} if old.get('sourceUrl') == entry['sourceUrl'] else entry)
    CACHE.mkdir(parents=True, exist_ok=True)
    prepared_sources = {
        row['sourceSha256']: row for row in entries
        if row.get('version') == VERSION and row.get('sourceSha256')
    }
    priority = {name: index for index, name in enumerate(collections or [])}
    ordered = sorted(entries, key=lambda row: (priority.get(row['collectionId'], 99), row['itemId']))
    for index, entry in enumerate(ordered, 1):
        destination = ROOT / ('public' + entry['output'])
        source = CACHE / (destination.stem + '.jpg')
        if not source.exists():
            if not fetch:
                if destination.exists() and entry.get('version') == VERSION:
                    continue
                raise FileNotFoundError('Use --fetch to cache ' + entry['itemId'])
            source.write_bytes(public_bytes(entry['sourceUrl']))
        original = source.read_bytes()
        checksum = digest(original + VERSION.encode())
        if destination.exists() and entry.get('checksum') == checksum:
            continue
        source_hash = digest(original)
        matching = prepared_sources.get(source_hash)
        reused = ROOT / ('public' + matching['output']) if matching else None
        if reused and reused.exists():
            encoded_bytes = reused.read_bytes()
            size, source_size = matching['outputSize'], matching['sourceSize']
        else:
            with Image.open(io.BytesIO(original)) as image:
                source_size = list(image.size)
                prepared = prepare_photo(image, entry.get('photoTreatment'))
            # Never disguise a small source as a high-resolution replacement.
            bounds = prepared.getchannel('A').getbbox()
            if max(bounds[2] - bounds[0], bounds[3] - bounds[1]) < 1000:
                print('Retaining scan; official image is too small:', entry['itemId'], flush=True)
                entry['skip'] = True
                continue
            encoded = io.BytesIO()
            prepared.save(encoded, format='WEBP', quality=92, method=6)
            encoded_bytes, size = encoded.getvalue(), list(prepared.size)
        destination.parent.mkdir(parents=True, exist_ok=True)
        pending = destination.with_suffix('.pending.webp')
        pending.write_bytes(encoded_bytes)
        pending.replace(destination)
        entry.update(
            version=VERSION, checksum=checksum, sourceSha256=source_hash,
            outputSha256=digest(encoded_bytes), sourceSize=source_size, outputSize=size,
            outputBytes=len(encoded_bytes),
        )
        prepared_sources[source_hash] = entry
        print(f'{index}/{len(entries)} {entry["itemId"]}: {size[0]}x{size[1]}, {len(encoded_bytes) // 1024} KB', flush=True)
        # Keep a recoverable manifest if a later remote download fails.
        document['images'] = [row for row in entries if row.get('version') == VERSION and not row.get('skip')]
        MANIFEST.write_text(json.dumps(document, indent=2) + '\n', encoding='utf-8')
    document['images'] = sorted(
        [row for row in entries if row.get('version') == VERSION and not row.get('skip')],
        key=lambda row: row['itemId'],
    )
    MANIFEST.write_text(json.dumps(document, indent=2) + '\n', encoding='utf-8')
    lookup = {row['itemId']: row['output'] for row in document['images']}
    for item in seed['items']:
        if item['id'] in lookup:
            item['studioImage'] = lookup[item['id']]
    seed_path.write_text(json.dumps(seed, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{len(lookup)} official studio photographs ready; catalog originals retained.', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true')
    parser.add_argument('--collections', nargs='+', default=['legna', 'mars', 'iris-blue', 'porto'])
    arguments = parser.parse_args()
    started = time.monotonic()
    refresh(arguments.fetch, arguments.collections)
    print(f'Completed in {time.monotonic() - started:.1f}s.', flush=True)
