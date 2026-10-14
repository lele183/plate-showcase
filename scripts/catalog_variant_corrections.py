"""Canonical variants and color assignments checked against the source color pages."""
import json, re
from pathlib import Path

def apply_variant_corrections(collections, items):
    palettes={
        'birmingham':['green','teal','black','clay','gray'],
        'milestone':['blue','green','ivory','red','white','yellow'],
    }
    for collection in collections:
        if collection['id'] in palettes:collection['colors']=palettes[collection['id']]
    result={}
    for item in items:
        cid=item['collectionId'];page=item['sourcePage']
        if cid=='birmingham':
            item['color']='black, green' if page in (98,99) else 'black, teal' if page in (100,101) else 'black, gray' if page in (102,103) else 'black, clay'
        elif cid=='milestone':
            item['color']={140:'blue',141:'blue',142:'green',143:'green',144:'ivory',145:'ivory',146:'red',147:'red',148:'white',149:'white',150:'yellow',151:'yellow'}[page]
            if item['sku'].endswith('1V'):
                item['originalSku']=item.get('originalSku',item['sku'])
                item['sku']=item['sku'][:-2]+'IV'
                item['id']=cid+':'+item['sku']
        elif cid=='nessico':
            suffix=re.search(r'([WTGYR])$',item['sku'])
            if suffix:item['color']={'W':'white','T':'tan','G':'green','Y':'yellow','R':'red'}[suffix[1]]
        elif cid=='lyon' and item['sku'].endswith('BLJ'):
            item['originalSku']=item.get('originalSku',item['sku'])
            item['sku']=item['sku'][:-3]+'BU';item['id']=cid+':'+item['sku'];item['color']='blue'
        # Prefer the richer transcription if two OCR spellings resolve to one SKU.
        def score(entry):
            return (1000 if entry.get('sourceVerified') else 0)+sum(v is not None for v in (entry.get('dimensions') or {}).values())*10+(10 if entry.get('casePack') else 0)+(10 if entry.get('capacityOz') else 0)+(5 if not entry.get('reviewNeeded') else 0)
        existing=result.get(item['id'])
        if not existing or score(item)>score(existing):result[item['id']]=item
    final=list(result.values())
    for collection in collections:collection['itemCount']=sum(i['collectionId']==collection['id'] for i in final)
    return final

if __name__=='__main__':
    root=Path(__file__).resolve().parents[1]
    seed=json.loads((root/'src/data/catalog.json').read_text(encoding='utf-8'))
    seed['items']=apply_variant_corrections(seed['collections'],seed['items'])
    (root/'src/data/catalog.json').write_text(json.dumps(seed,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    audit=json.loads((root/'src/data/catalog-audit.json').read_text(encoding='utf-8'))
    audit['itemCount']=len(seed['items']);audit['reviewCount']=sum(i['reviewNeeded'] for i in seed['items'])
    for page in audit['pages']:page['recognizedRows']=sum(i['collectionId']==page['collectionId'] and i['pdfPage']==page['pdfPage'] for i in seed['items'])
    (root/'src/data/catalog-audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
    print(f"Canonicalized {len(seed['items'])} rows; {audit['reviewCount']} remain flagged for review.")
