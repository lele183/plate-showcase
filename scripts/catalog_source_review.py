"""Apply transcriptions and image associations visually checked against the scan.

Complete pages replace OCR rows, including false positives and missed variants.
The manifest records exact printed specifications; normalized glass dimensions
use maximum diameter (D), or top diameter (T), and height (H).
"""
import json, re
from pathlib import Path
from PIL import Image, ImageDraw
from catalog_studio_images import apply_studio_images

ROOT = Path(__file__).resolve().parents[1]

def fraction(text):
    return sum(float(p.split('/')[0])/float(p.split('/')[1]) if '/' in p else float(p) for p in text.split())

MEASUREMENT = r'(\d+(?:\s+\d+/\d+|/\d+|\.\d+)?)\s*"'

def measurements(specification, kind, shape):
    labelled = {label: fraction(value) for label, value in re.findall(r'\b([HTBD])\s*'+MEASUREMENT, specification)}
    if labelled:
        return dict(length=labelled.get('D', labelled.get('T')), width=None, height=labelled.get('H'))
    normalized = re.sub(r'(\d+(?:\s+\d+/\d+|/\d+|\.\d+)?)(\s*[xX]\s*)(?=\d)', r'\1"\2', specification)
    values = [fraction(value) for value in re.findall(MEASUREMENT, normalized)[:3]]
    if not values: return None
    if len(values)==2 and re.search(MEASUREMENT+r'\s*H\b', normalized):
        return dict(length=values[0], width=values[0] if shape=='square' else None, height=values[1])
    if shape == 'square' and len(values) < 3:
        return dict(length=values[0], width=values[0], height=values[1] if len(values)>1 else None)
    if len(values) == 2 and shape in {'round', 'triangular'}:
        return dict(length=values[0], width=None, height=values[1])
    return dict(length=values[0], width=values[1] if len(values)>1 else None, height=values[2] if len(values)>2 else None)

def apply_source_review(collections, items):
    pages = []
    for filename in sorted((ROOT/'scripts').glob('catalog-source-*.json')):
        document = json.loads(filename.read_text(encoding='utf-8'))
        for page in document['pages']:
            pages.append({**page, '_templates':document.get('templates', {})})
    cropped_paths = set()
    for page in pages:
        rows = list(page.get('rows', []))
        for group in page.get('groups', []):
            group = {**page['_templates'].get(group.get('template'), {}), **group}
            attributes = {key: value for key, value in group.items() if key != 'rows'}
            suffix = group.get('suffix', page.get('suffix', ''))
            if 'template' in group:
                attributes['name'] = attributes['name'].format(color=page.get('color', '').title(), suffix=suffix)
            for pair in group['rows']:
                rows.append({**attributes, 'sku':pair[0]+suffix, 'specification':pair[1], **(pair[2] if len(pair)>2 else {})})
        cid, printed = page['collection'], page['page']
        global_rows = {}
        for item in items:
            if item['collectionId']==cid: global_rows.setdefault(item['sku'], []).append(item)
        if page.get('collectionAttributes'):
            next(c for c in collections if c['id']==cid).update(page['collectionAttributes'])
        if page.get('collectionColor'):
            for item in items:
                if item['collectionId']==cid: item['color']=page['collectionColor']
        existing = {i['sku']: i for i in items if i['collectionId']==cid and i['sourcePage']==printed}
        if page.get('complete'):
            items = [i for i in items if not (i['collectionId']==cid and i['sourcePage']==printed)]
        for row in rows:
            sku = row['sku']; name = row['name']; spec = row['specification']
            previous = global_rows.get(sku, []) + global_rows.get(row.get('originalSku', sku), [])
            old = existing.get(sku) or existing.get(row.get('originalSku', sku)) or (previous[0] if previous else None)
            item = dict(old) if old else {}
            kind = row.get('type', page.get('type', 'accessory'))
            if kind == 'bowl' and re.search(r'\bsauce dish\b', name, re.I):
                kind = 'sauce dish'
            shape = row.get('shape', page.get('shape', 'other'))
            capacity = re.search(r'(\d+(?:\.\d+)?)\s*(OZ|QT)\b', spec)
            pack = re.search(r'\d+\s*(?:DZ|PC|SETS?)\b', spec)
            item.update(id=cid+':'+sku, collectionId=cid, sku=sku, name=name, type=kind, shape=shape,
                        color=row.get('color', page.get('color', (old or {}).get('color', ''))),
                        dimensions=measurements(spec, kind, shape), capacityOz=float(capacity[1])*(32 if capacity[2]=='QT' else 1) if capacity else None,
                        casePack=pack[0] if pack else None, specification=sku+' '+spec,
                        originalSpecification=(old or {}).get('originalSpecification', (old or {}).get('specification', sku+' '+spec)),
                        sourcePage=printed, pdfPage=printed+2, reviewNeeded=row.get('reviewNeeded', False), sourceVerified=True)
            if 'dimensions' in row: item['dimensions']=row['dimensions']
            if 'casePack' in row: item['casePack']=row['casePack']
            if 'capacityOz' in row: item['capacityOz']=row['capacityOz']
            if row.get('diameter') and item['dimensions']: item['dimensions']['length']=row['diameter']
            if row.get('sourceNote'): item['sourceNote']=row['sourceNote']
            if row.get('material'): item['material']=row['material']
            references = list(row.get('sourceReferences', (old or {}).get('sourceReferences', [])))
            for prior in previous:
                if prior['sourcePage']!=printed:
                    references.append(dict(sourcePage=prior['sourcePage'], pdfPage=prior['pdfPage'], specification=prior['specification']))
            if references:
                item['sourceReferences'] = list({(r['sourcePage'], r['specification']):r for r in references}.values())
            if row.get('originalSku'): item['originalSku']=row['originalSku']
            if row.get('crop'):
                name = f'verified-{cid}-{printed}-{row.get("imageGroup", sku)}.webp'
                path = ROOT/'public/catalog'/name
                crop_key = (path, tuple(row['crop']), tuple(tuple(mask) for mask in row.get('cropMasks', [])))
                if crop_key not in cropped_paths:
                    source = Image.open(ROOT/f'.cache/catalog-pages/page-{printed+2:03}.jpg')
                    # Remove caption fragments only in manually reviewed white margins.
                    for mask in row.get('cropMasks', []):
                        ImageDraw.Draw(source).rectangle(mask, fill='white')
                    cropped = source.crop(tuple(row['crop'])); cropped.thumbnail((650,650)); cropped.save(path, quality=93)
                    cropped_paths.add(crop_key)
                item['image']='/catalog/'+name
            if not item.get('image'): raise ValueError('Missing reviewed image: '+item['id'])
            items = [i for i in items if i['id'] not in {item['id'], cid+':'+row.get('originalSku', sku)}]
            items.append(item)
        if page.get('complete') and len(rows) != len({row['sku'] for row in rows}):
            raise ValueError('Duplicate source row on page '+str(printed))
    for collection in collections:
        collection['itemCount'] = sum(i['collectionId']==collection['id'] for i in items)
    apply_studio_images(items)
    return items

if __name__=='__main__':
    seed = json.loads((ROOT/'src/data/catalog.json').read_text(encoding='utf-8'))
    seed['items'] = apply_source_review(seed['collections'], seed['items'])
    (ROOT/'src/data/catalog.json').write_text(json.dumps(seed,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    audit = json.loads((ROOT/'src/data/catalog-audit.json').read_text(encoding='utf-8'))
    audit['itemCount'] = len(seed['items']); audit['reviewCount'] = sum(i['reviewNeeded'] for i in seed['items'])
    audit['sourceVerifiedCount'] = sum(bool(i.get('sourceVerified')) for i in seed['items'])
    for page in audit['pages']:
        page['recognizedRows'] = sum(i['collectionId']==page['collectionId'] and i['pdfPage']==page['pdfPage'] for i in seed['items'])
    (ROOT/'src/data/catalog-audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
    print(f"Applied source review: {audit['itemCount']} items; {audit['sourceVerifiedCount']} verified; {audit['reviewCount']} flagged.")
