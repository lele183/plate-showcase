"""Prepare all SKU-matched official studio photos from a cached public inventory.

The explicit --fetch flag permits downloading official originals. Work is
checkpointed per photo so an interrupted run can continue without starting over.
"""
import argparse
import collections
import concurrent.futures
import io
import json
import re
import shutil
import time
from pathlib import Path
from urllib.parse import urlencode

from PIL import Image, ImageOps
from catalog_studio_photos import ROOT, CACHE, MANIFEST, VERSION, API, digest, prepare_photo, public_bytes

ALIASES = {
    'bamboo': {'bamboo-style'},
    'recovery': {'accessories'},
    'chinaware-accessories': {'accessories', 'abco', 'recovery'},
    'coupe': {'coupe-pattern'},
    'plastics': {'dessert-dish', 'tumbler', 'pitcher', 'plate-cover'},
    'mainland': {'main-land'},
    'trays': {'serving-trays'},
    'wood-and-bamboo': {'bamboo-wood'},
    'sesame': {'ardis', 'accessories-melamine'},
    'pine-tree': {'accessories-melamine'},
    'compartment': {'compartment-collection', 'mexico', 'nessico', 'milestone'},
    'milestone': {'accessories-melamine'},
    'black-and-red': {'black-red'},
    'rockeye': {'rockeye-2'},
    'yofo': {'yoto'},
    'melamine-accessories': {'accessories-melamine'},
}


def series_matches(item, series):
    allowed = {item['collectionId']} | ALIASES.get(item['collectionId'], set())
    if item['id'] == 'longevity:NS-7003W':
        allowed.add('nessico')  # The scan lists this same white Nessico spoon.
    return bool(allowed.intersection(series)) or (
        item['collectionId'] == 'lyon'
        and any(slug in {'lyon-blue', 'lyon-yellow', 'lyon-coral', 'lyon-turquoise'} for slug in series)
    )


def candidates(seed, products):
    indexed = {product['sku'].upper(): product for product in products}
    if len(indexed) != len(products):
        raise ValueError('The official inventory contains ambiguous duplicate SKUs')
    aliases = json.loads(
        (ROOT / 'resources/studio-photo-aliases.json').read_text(encoding='utf-8')
    )['aliases']
    entries, unavailable = [], []
    for item in seed['items']:
        alias = aliases.get(item['id'])
        product = indexed.get(
            (alias['officialSku'] if alias else item['sku']).upper()
        )
        reason = None
        if not product or not product.get('images'):
            reason = 'No verified SKU with a photograph in the official public inventory.'
        else:
            series = [
                term['slug'] for attribute in product.get('attributes', [])
                if attribute.get('taxonomy') == 'pa_item-series'
                for term in attribute.get('terms', [])
            ]
            if not series_matches(item, series):
                reason = 'Official series requires manual association review: ' + ', '.join(series)
        if reason:
            unavailable.append({'itemId': item['id'], 'sku': item['sku'], 'reason': reason})
            continue
        filename = 'studio-photo-' + re.sub(r'[^a-z0-9-]', '-', item['id'].lower()) + '.webp'
        entries.append({
            'itemId': item['id'], 'sku': item['sku'], 'collectionId': item['collectionId'],
            'catalogImage': item['image'], 'productUrl': product['permalink'],
            'sourceUrl': product['images'][0]['src'], 'output': '/catalog/' + filename,
            'officialSeries': series,
            **({'officialSku': alias['officialSku'], 'associationNote': alias['note']} if alias else {}),
            **({'photoTreatment': 'glass-highlights-v1'} if (
                item.get('type') == 'glass'
                and not re.search(r'mug|handle', item.get('name', ''), re.I)
            ) else {}),
        })
    return entries, unavailable


def prepare_group(entries, fetch, minimum_subject=1000):
    first = entries[0]
    raw = CACHE / (Path(first['output']).stem + '.jpg')
    if not raw.exists():
        for entry in entries[1:]:
            other = CACHE / (Path(entry['output']).stem + '.jpg')
            if other.exists():
                shutil.copyfile(other, raw)
                break
    if not raw.exists():
        if not fetch:
            raise FileNotFoundError('Use --fetch to cache ' + first['sku'])
        for attempt in range(3):
            try:
                original = public_bytes(first['sourceUrl'])
                pending = raw.with_suffix('.pending.jpg')
                pending.write_bytes(original)
                pending.replace(raw)
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(1 + attempt)
    original = raw.read_bytes()
    source_hash = digest(original)
    with Image.open(io.BytesIO(original)) as image:
        oriented = ImageOps.exif_transpose(image)
        source_size = list(oriented.size)
        prepared = prepare_photo(oriented, first.get('photoTreatment'))
    bounds = prepared.getchannel('A').point(lambda value: 255 if value >= 128 else 0).getbbox()
    native_span = max(bounds[2] - bounds[0], bounds[3] - bounds[1]) if bounds else 0
    if native_span < minimum_subject:
        return [], [
            {'itemId': entry['itemId'], 'sku': entry['sku'],
             'reason': 'Official photograph has insufficient native subject detail.',
             'nativeSubjectPixels': native_span, 'sourceUrl': entry['sourceUrl']}
            for entry in entries
        ]
    encoded = io.BytesIO()
    prepared.save(encoded, format='WEBP', quality=92, method=4)
    content = encoded.getvalue()
    completed = []
    for entry in entries:
        destination = ROOT / ('public' + entry['output'])
        pending = destination.with_suffix('.pending.webp')
        pending.write_bytes(content)
        pending.replace(destination)
        alias = CACHE / (destination.stem + '.jpg')
        if not alias.exists():
            shutil.copyfile(raw, alias)
        completed.append({
            **entry, 'version': VERSION, 'checksum': digest(original + VERSION.encode()),
            'sourceSha256': source_hash, 'outputSha256': digest(content),
            'sourceSize': source_size, 'outputSize': list(prepared.size),
            'outputBytes': len(content), 'webpQuality': 92, 'webpMethod': 4,
            'nativeSubjectPixels': native_span,
            'minimumNativeSubjectPixels': minimum_subject,
        })
    return completed, []


def write_manifest(document, entries):
    document['images'] = sorted(entries.values(), key=lambda row: row['itemId'])
    pending = MANIFEST.with_suffix('.pending.json')
    pending.write_text(json.dumps(document, indent=2) + '\n', encoding='utf-8')
    pending.replace(MANIFEST)


def refresh_inventory():
    """Cache public metadata separately from the explicit photo download step."""
    products = []
    page = 1
    while True:
        query = urlencode({
            'per_page': 100, 'page': page, 'orderby': 'id', 'order': 'asc',
            '_fields': 'id,sku,name,permalink,images,attributes',
        })
        batch = json.loads(public_bytes(API + '?' + query))
        products.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    CACHE.mkdir(parents=True, exist_ok=True)
    destination = CACHE / 'official-products.json'
    pending = destination.with_suffix('.pending.json')
    pending.write_text(json.dumps({
        'count': len(products), 'products': products,
    }, indent=2) + '\n', encoding='utf-8')
    pending.replace(destination)
    print(f'Cached {len(products)} official public products.', flush=True)


def run(fetch=False, workers=3, minimum_subject=1000):
    seed_path = ROOT / 'src/data/catalog.json'
    seed = json.loads(seed_path.read_text(encoding='utf-8'))
    inventory_path = CACHE / 'official-products.json'
    if not inventory_path.exists():
        if fetch:
            refresh_inventory()
        else:
            raise FileNotFoundError('Cache the official inventory with --refresh-inventory --fetch')
    inventory = json.loads(inventory_path.read_text(encoding='utf-8'))
    selected, unavailable = candidates(seed, inventory['products'])
    document = json.loads(MANIFEST.read_text(encoding='utf-8'))
    ready = {row['itemId']: row for row in document['images']}
    groups = collections.defaultdict(list)
    for entry in selected:
        old = ready.get(entry['itemId'])
        if (
            old and old['sourceUrl'] == entry['sourceUrl']
            and old.get('photoTreatment') == entry.get('photoTreatment')
            and (ROOT / ('public' + old['output'])).is_file()
        ):
            continue
        groups[entry['sourceUrl']].append(entry)
    print(f'{len(selected)} verified SKU associations; {len(ready)} ready; {len(groups)} new photograph groups.', flush=True)
    failures = []
    started = time.monotonic()
    with concurrent.futures.ProcessPoolExecutor(max_workers=workers) as pool:
        pending = {
            pool.submit(prepare_group, entries, fetch, minimum_subject): entries
            for entries in groups.values()
        }
        for index, future in enumerate(concurrent.futures.as_completed(pending), 1):
            entries = pending[future]
            try:
                completed, skipped = future.result()
                ready.update({row['itemId']: row for row in completed})
                unavailable.extend(skipped)
            except Exception as error:
                failures.extend({
                    'itemId': entry['itemId'], 'sku': entry['sku'],
                    'reason': type(error).__name__ + ': ' + str(error),
                } for entry in entries)
            if index % 10 == 0 or index == len(groups):
                write_manifest(document, ready)
                print(
                    f'{index}/{len(groups)} photos; {len(ready)} ready; '
                    f'{len(unavailable)} unavailable; {len(failures)} errors; '
                    f'{time.monotonic() - started:.0f}s',
                    flush=True,
                )
    write_manifest(document, ready)
    for item in seed['items']:
        if item['id'] in ready:
            item['studioImage'] = ready[item['id']]['output']
    seed_path.write_text(json.dumps(seed, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    unresolved = [row for row in unavailable + failures if row['itemId'] not in ready]
    (ROOT / 'resources/studio-photo-unavailable.json').write_text(json.dumps({
        'officialInventoryCount': inventory['count'],
        'matchedCatalogRecords': len(selected),
        'preparedCatalogRecords': len(ready),
        'unavailable': sorted(unresolved, key=lambda row: row['itemId']),
    }, indent=2) + '\n', encoding='utf-8')
    print(f'Finished: {len(ready)} official photographs; {len(unresolved)} unresolved.', flush=True)
    if failures:
        raise RuntimeError(
            f'{len(failures)} photo operations failed; review resources/studio-photo-unavailable.json'
        )


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true')
    parser.add_argument('--refresh-inventory', action='store_true')
    parser.add_argument('--workers', type=int, choices=range(1, 9), default=3)
    parser.add_argument('--minimum-subject', type=int, choices=[640, 1000], default=1000)
    arguments = parser.parse_args()
    if arguments.refresh_inventory:
        refresh_inventory()
    run(arguments.fetch, arguments.workers, arguments.minimum_subject)
