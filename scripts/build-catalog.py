"""Build a reproducible catalog seed from page OCR and source photograph crops.

All source rows are retained for reconciliation. Enlarged panel OCR takes
precedence over whole-page OCR; uncertain specifications are flagged for review.
"""
import csv, json, re, shutil, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from product_regions import regions
from catalog_variant_corrections import apply_variant_corrections
from catalog_source_review import apply_source_review
from catalog_style_profiles import apply_style_profiles
REGIONS={}
CROPPED=set()
sys.stdout.reconfigure(encoding='utf-8')

# Printed page ranges, reconciled with the table of contents on PDF page 3.
MANIFEST = '''
Legna|LE|4|5|signature|ivory,brown,gold
Iris Blue|IB|6|7|signature|blue,white
Mars|MR|8|9|signature|blue,white
Porto|PR|10|11|signature|blue,brown
Glory|GL|12|13|signature|white,gold
Diamond Black|DB|14|15|signature|black,bronze
Rockeye|RO|16|19|signature|white,brown
Golden Coast|GO|20|21|signature|ivory,brown
Noble Black|NB|22|23|signature|black
Blue Star|BL|24|25|signature|blue
Lyon|LY|26|30|signature|coral,turquoise,blue,purple,yellow,white
Champs|CH|31|31|signature|green
Peacock|PK|32|33|signature|blue,green
Universe|UN|34|35|signature|blue,black
Ocean|OC|36|37|signature|blue,white
Shanghai|SH|38|38|signature|white
Sea Wave|SW|39|39|signature|bone white
Cowboy|CB|40|41|signature|brown,white
Denmark|DM|42|42|signature|white
Green Gem|GG|43|43|signature|green
Agate|AG|44|45|signature|gray
Versailles|VS|46|47|fine|bone white
Piscataway|PS|48|51|fine|bone white
Cambria|CA|52|53|fine|bone white
Paris|PA|54|55|fine|bone white
Siena|SI|56|56|fine|bone white
Urban Line|UR|57|57|fine|bone white
Lion King|LK|58|58|fine|bone white
Mayor|MA|59|59|classic|super white
ABCO|AC|60|63|classic|super white
Mainland|ML|64|66|classic|american white
Miami|MM|67|69|classic|bone white
Fuji|FU|70|71|classic|american white
Recovery|RE|72|74|classic|american white
Normandy|NR|75|75|classic|american white
Green Band|GB|76|77|classic|american white,green
Brown Speckled|BR|78|78|classic|american white,brown
Prideland|PL|79|79|classic|bone white
Chinaware Accessories|NC|80|83|accessories|white
Stone Art|ST|86|87|signature|gray,brown
Misty|MI|88|89|signature|gray
Sentry|SN|90|91|signature|blue,white
Optimum|OP|92|93|signature|white
Nature Art|NA|94|97|signature|brown,blue,white
Birmingham|BM|98|105|signature|green,blue,black,white
Black Pearl|BP|106|108|signature|black
Milando|MD|109|109|signature|white
Osaka|OK|110|111|signature|black,brown
Venice|VE|112|112|signature|white
Discover|DI|113|113|signature|white
Woodland|WL|114|115|signature|brown
Wooden Tray|WD|116|117|signature|brown
Yofo|YO|118|119|signature|gray,brown
Moderne|MO|120|121|signature|black
Bamboo|BA|122|123|signature|green
Rome|RM|124|127|classic|white,black
Coupe|CO|128|128|classic|white
Mexico|ME|129|129|classic|red
Olive|OL|130|130|classic|green
Nessico|NS|131|139|classic|white,tan,green,yellow,red
Milestone|MS|140|151|classic|white,black,blue,yellow,green,red
Melamine Accessories|NC|152|152|accessories|white
Compartment|CP|153|155|accessories|white,black
Ardis|AD|156|156|classic|white
Sesame|SS|157|157|classic|ivory
Pine Tree|PT|158|158|classic|white,green
Houston|HS|159|159|classic|white,red
Black and Red|CR|160|161|classic|black,red
Catering|CAT|162|163|accessories|white,black
Deli|DC|164|165|accessories|white,black
GN Pan|GN|166|167|accessories|white,black
Honda|HO|168|169|classic|green,white
Orchis|OR|170|170|classic|white,blue
Japanese|JP|171|173|classic|white,blue
Longevity|LG|174|175|classic|white,red
Peony|PO|176|177|classic|white,blue
Aqua Spirits|AS|179|181|classic|clear
Aqua Mist|AM|182|183|classic|clear
Stemware|SM|186|187|classic|clear
Hawaii|HA|188|188|classic|clear
Plastics|PT|189|189|accessories|clear,blue,amber,red
Trays|FT|190|191|accessories|brown,black
Wood and Bamboo|BB|193|193|accessories|brown
'''

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/catalog'
OUTPUT.mkdir(parents=True, exist_ok=True)
(ROOT / 'src/data').mkdir(parents=True, exist_ok=True)

def slug(s): return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def load_lines(page):
    lines=[]
    original=ROOT / f'.cache/catalog-ocr/page-{page:03}.json'
    if original.exists():
        d=json.loads(original.read_text(encoding='utf-8'))
        for ln in d['lines']:
            if ln['words']:
                words=ln['words'];lines.append(dict(text=ln['text'], words=words, quality=1))
    independent=ROOT/f'.cache/catalog-tesseract/page-{page:03}.json'
    if independent.exists():
        d=json.loads(independent.read_text(encoding='utf-8'));factor=1654/d['width']
        for ln in d['lines']:
            words=[dict(text=w['text'],x=w['bbox']['x0']*factor,y=w['bbox']['y0']*factor,w=(w['bbox']['x1']-w['bbox']['x0'])*factor,h=(w['bbox']['y1']-w['bbox']['y0'])*factor) for w in ln['words']]
            if words and ln['confidence']>40:lines.append(dict(text=ln['text'].strip(),words=words,quality=1.5))
    for file in (ROOT / '.cache/catalog-ocr-crops').glob(f'page-{page:03}-*.json'):
        x,y=map(int,re.search(r'-x(\d+)-y(\d+)',file.stem).groups())
        d=json.loads(file.read_text(encoding='utf-8'))
        for ln in d['lines']:
            words=[dict(text=w['text'],x=w['x']/2+x,y=w['y']/2+y,w=w['w']/2,h=w['h']/2) for w in ln['words']]
            if words: lines.append(dict(text=ln['text'],words=words,quality=2))
    split=[]
    for ln in lines:
        group=[]
        for word in sorted(ln['words'],key=lambda w:w['x']):
            if group and word['x']-(group[-1]['x']+group[-1]['w'])>65:
                split.append(dict(text=' '.join(w['text'] for w in group),words=group,quality=ln['quality']));group=[]
            group.append(word)
        if group:split.append(dict(text=' '.join(w['text'] for w in group),words=group,quality=ln['quality']))
    lines=split
    for ln in lines:
        ln['x']=min(w['x'] for w in ln['words']); ln['y']=min(w['y'] for w in ln['words'])
    return lines

def number(text):
    s=text.strip().replace('¼',' 1/4').replace('½',' 1/2').replace('¾',' 3/4')
    s=re.sub(r'(?<=\d)(?=\d/\d)', ' ',s)
    parts=s.split();n=0
    try:
        for p in parts:
            if '/' in p:
                a,b=p.split('/');n+=float(a)/float(b)
            else: n+=float(p)
        return round(n,4)
    except (ValueError,ZeroDivisionError): return None

def dimensions(text):
    matches=re.findall(r'(\d+(?:\s+\d+/\d+|/\d+|\.\d+)?)\s*["”]',text)
    values=[number(x) for x in matches[:3]]
    return dict(length=values[0],width=values[1] if len(values)>1 else None,height=values[2] if len(values)>2 else None) if values else None

def item_type(name):
    n=name.lower()
    for term,t in [('saucer','saucer'),('cup','cup'),('mug','cup'),('sauce','sauce dish'),('bowl','bowl'),('glass','glass'),('goblet','glass'),('tumbler','glass'),('wine','glass'),('tray','tray'),('platter','platter'),('plate','plate'),('pan','pan'),('spoon','spoon'),('pitcher','pitcher')]:
        if term in n: return t
    return 'accessory'

def shape(name):
    n=name.lower()
    for word in ['rectangular','square','triangular','triangle','oval','irregular','round']:
        if word in n: return 'triangular' if word=='triangle' else word
    return 'round' if item_type(name) in ['plate','bowl','cup','saucer','glass'] else 'other'

collections=[];items=[];audit=[]
for row in MANIFEST.strip().splitlines():
    name,prefix,start,end,tier,colors=row.split('|');start=int(start);end=int(end)
    category='chinaware' if start<86 else 'melamine' if start<179 else 'glassware' if start<186 else 'plasticware' if start<193 else 'wood'
    material='chinaware' if category=='chinaware' else 'glass' if category=='glassware' else 'plastic' if category=='plasticware' else category
    cid=slug(name); source_colors=colors.split(',');page_lines={p:load_lines(p+2) for p in range(start,end+1)}
    hero=f'/catalog/{cid}-hero.webp'
    source=Image.open(ROOT/f'.cache/catalog-pages/page-{start+2:03}.jpg')
    hero_crop=source.crop((450,40,1650,1460)) if cid=='legna' else source.crop((0,0,1570, min(1280,source.height)))
    hero_crop.thumbnail((1100,950));hero_crop.save(OUTPUT/f'{cid}-hero.webp',quality=85)
    collection=dict(id=cid,name=name,prefix=prefix,category=category,material=material,section=tier,colors=source_colors,
        description='',image=hero,heroImage=hero,budget=3 if tier=='fine' else 2 if tier=='signature' else 1,
        sourcePages=list(range(start,end+1)),pdfPages=list(range(start+2,end+3)),tags=[],itemCount=0)
    combined=' '.join(ln['text'] for ln in page_lines[start] if ln['y']<1650)
    if category=='chinaware':
        if re.search(r'porcelain',combined,re.I):collection['material']='porcelain'
        elif re.search(r'stoneware',combined,re.I):collection['material']='stoneware'
    descriptions={'legna':'Sunburst-style reactive glaze with an artisanal finish.','mars':'Modern porcelain with a midnight blue rim pattern.','green-band':'American White chinaware with a traditional green band.','abco':'Rolled-edge porcelain in Super White.','rockeye':'Warm rim detailing and a broad range of serving shapes.','moderne':'Matte black melamine with distinctive triangular shapes.','nessico':'Heavy-weight melamine with versatile shapes and color choices.','birmingham':'Two-tone melamine with a distinctive textured surface.'}
    collection['description']=descriptions.get(cid,f"{name} {collection['material']} from Yanco’s {('Fine Dining' if tier=='fine' else 'Signature Selections' if tier=='signature' else 'Classics' if tier=='classic' else 'Accessories')} collection.")
    # Style profiles are applied after source corrections reconcile actual colors.
    found={}
    for printed,lines in page_lines.items():
        page=printed+2
        sku_pattern=re.compile(r'\b([A-Z]{1,4})\s*[-–]\s*([0-9OIl]{1,5}[A-Z0-9]*(?:[-/][A-Z0-9]+)*)',re.I)
        for ln in lines:
            for match in sku_pattern.finditer(ln['text']):
                pref,code=match.groups();pref=pref.upper();code=code.upper()
                if pref not in {prefix,'NC','RC','BB','WS','SM','FT','PC','SG','PR','P','HS','DC','NS','MS','CO','RM','GN','SY','JM','NR'} and tier!='accessories':continue
                # OCR commonly confuses 0/1 with O/I in the numerical SKU portion.
                m=re.match(r'([0-9OIL]+)(.*)',code)
                if not m:continue
                digits=m[1].replace('O','0').replace('I','1').replace('L','1');code=digits+m[2]
                sku=pref+'-'+code
                if len(digits)<1 or len(digits)>5:continue
                def word_sku(w):
                    m=sku_pattern.search(w['text'])
                    if not m:return ''
                    c=m[2].upper();numeric=re.match(r'([0-9OIL]+)(.*)',c)
                    return m[1].upper()+'-'+(numeric[1].replace('O','0').replace('I','1').replace('L','1')+numeric[2] if numeric else c)
                word=next((w for w in ln['words'] if word_sku(w)==sku),ln['words'][0])
                x=word['x'];y=word['y']
                if re.search(r'\bFOR\b',ln['text'],re.I) and not dimensions(sku_pattern.sub('',ln['text'])):continue # compatibility references are not product rows
                headings=[l for l in lines if 12<y-l['y']<170 and abs(l['x']-x)<110 and (not sku_pattern.search(l['text']) or re.search(r'\bFOR\b',l['text'],re.I)) and re.search(r'PLATE|BOWL|CUP|MUG|DISH|SAUCER|TRAY|GLASS|PLATTER|GOBLET|PAN|SPOON|PITCHER|TUMBLER|SHAKER|CREAMER|SUGAR|STAND|COVER|WINE|BEER|WHISKY|BRANDY|RAMEKIN|COMPARTMENT|BUTTER|HOLDER|SALT|PEPPER|CASSEROLE|CROCK|POT|BASKET|EGG|GRAVY|CRUET',l['text'],re.I)]
                heading=max(headings,key=lambda l:l['y']) if headings else None
                # A shared heading may span two SKU columns in the same table.
                if heading is None:
                    headings=[l for l in lines if 12<y-l['y']<220 and -40<x-l['x']<550 and (not sku_pattern.search(l['text']) or re.search(r'\bFOR\b',l['text'],re.I)) and re.search(r'PLATE|BOWL|CUP|MUG|DISH|SAUCER|TRAY|GLASS|PLATTER|GOBLET|PAN|SPOON|PITCHER|TUMBLER|SHAKER|CREAMER|SUGAR|STAND|COVER|WINE|BEER|WHISKY|BRANDY|RAMEKIN|COMPARTMENT|BUTTER|HOLDER|SALT|PEPPER|CASSEROLE|CROCK|POT|BASKET|EGG|GRAVY|CRUET',l['text'],re.I)]
                    heading=max(headings,key=lambda l:(l['y'],-abs(l['x']-x))) if headings else None
                # Follow a SKU's own column up to the heading when there are many variants.
                if heading is None:
                    headings=[l for l in lines if 0<y-l['y']<800 and abs(l['x']-x)<200 and (not sku_pattern.search(l['text']) or re.search(r'\bFOR\b',l['text'],re.I)) and re.search(r'PLATE|BOWL|CUP|MUG|DISH|SAUCER|TRAY|GLASS|PLATTER|PAN|SPOON|PITCHER',l['text'],re.I)]
                    heading=max(headings,key=lambda l:l['y']) if headings else None
                title=heading['text'] if heading else ('Saucer' if code.startswith('002') else 'Cup' if code.startswith('001') else 'Glass' if category=='glassware' or cid in ['stemware','hawaii'] else 'Catalog item')
                if title=='Catalog item':
                    inline=re.search(r'PLATE|BOWL|CUP|MUG|DISH|SAUCER|TRAY|GLASS|PLATTER|GOBLET|PITCHER|TUMBLER|SHAKER|CREAMER|SUGAR|STAND|COVER',ln['text'],re.I)
                    if inline:title=inline[0].title()
                hy=heading['y'] if heading else max(350,y-40)
                hx=heading['x'] if heading else x
                # Rejoin words from both OCR resolutions; table columns are often separate lines.
                next_cols=[l['x'] for l in lines if abs(l['y']-hy)<12 and l['x']>hx+150 and re.search(r'PLATE|BOWL|CUP|MUG|DISH|SAUCER|TRAY|PLATTER',l['text'],re.I)]
                right=min(next_cols)-15 if next_cols else min(max(hx+440,x+440),1560)
                neighboring_skus=[l['x'] for l in lines if abs(l['y']-y)<7 and l['x']>x+180 and sku_pattern.search(l['text'])]
                if neighboring_skus:right=min(right,min(neighboring_skus)-12)
                fragments=[l for l in lines if abs(l['y']-y)<8 and l['x']>=x-12 and l['x']<right]
                fragments=sorted(fragments,key=lambda l:l['x'])
                unique=[]
                for f in fragments:
                    if not any(abs(f['x']-o['x'])<12 and f['text']==o['text'] for o in unique):unique.append(f)
                row_words=[]
                for f in sorted(unique,key=lambda f:f['quality'],reverse=True):
                    for w in f['words']:
                        if x-12<=w['x']<right and abs(w['y']-y)<8 and not any(abs(w['x']-o['x'])<14 or (w['x']<o['x']+o['w']-6 and w['x']+w['w']>o['x']+6) for o in row_words):row_words.append(w)
                specification=' '.join(w['text'] for w in sorted(row_words,key=lambda w:w['x'])) or ln['text']
                row_skus=list(sku_pattern.finditer(specification))
                if len(row_skus)>1: specification=specification[:row_skus[1].start()]
                specification=re.sub(r'(\d+)0Z\b',r'\1 OZ',specification,flags=re.I)
                specification=specification.replace('IDZ','1 DZ').replace('IO"','10"')
                for bad,good in [('112','1/2'),('114','1/4'),('118','1/8'),('314','3/4'),('718','7/8'),('518','5/8')]:
                    specification=re.sub(r'(?<![A-Z0-9-])'+bad+r'(?=["”])',good,specification)
                measured=sku_pattern.sub('',specification)
                measured=re.sub(r'\b'+pref+r'[- ]?[0-9OIL]+[A-Z]*','',measured,flags=re.I)
                dims=dimensions(measured)
                if dims and any(v is not None and (v>60 or v<=0) for v in dims.values()):dims=None
                if dims and dims['height'] is None and dims['width'] is not None and shape(title)=='round':dims['height']=dims['width'];dims['width']=None
                cap=re.search(r'(\d+(?:\.\d+)?)\s*(OZ|QT|ML)\b',specification,re.I)
                pack=re.search(r'(\d+)\s*(DZ|PC|SET|G)',specification,re.I)
                col=next((c for c in ['american white','super white','bone white','black','yellow','coral','purple','green','blue','red','brown','tan','turquoise','amber','clear','white'] if re.search(r'\b'+c+r'\b',title,re.I)),', '.join(source_colors))
                key=f'{cid}:{sku}'
                quality=ln['quality']*100+(80 if dims else 0)+(55 if pack else 0)+(45 if cap else 0)+(5 if heading else 0)+min(len(specification),100)/100
                if key in found and found[key][0]>=quality:continue
                image_id=f'{cid}-{page}-{round(hx/20)*20}-{round(hy/20)*20}'
                imgpath=OUTPUT/f'{image_id}.webp'
                if image_id not in CROPPED:
                    source_path=ROOT/f'.cache/catalog-pages/page-{page:03}.jpg'
                    im=Image.open(source_path)
                    if page not in REGIONS:
                        headings=[l for l in lines if re.search(r'PLATE|BOWL|CUP|MUG|DISH|SAUCER|TRAY|PLATTER|GLASS|PITCHER|COMPARTMENT',l['text'],re.I) and not sku_pattern.search(l['text'])]
                        REGIONS[page]=[b for b in regions(source_path) if not any(b[0]-8<=l['x']<=b[2]+8 and b[1]-8<=l['y']<=b[3]+8 for l in headings)]
                    boxes=REGIONS[page]
                    def distance(b):
                        dx=max(b[0]-hx,hx-b[2],0);dy=max(b[1]-hy,hy-b[3],0)
                        return dx*dx+dy*dy+(12000 if b[0]>hx+80 else 0)
                    box=min(boxes,key=distance) if boxes else None
                    if box and distance(box)<500*500:crop=im.crop((max(0,box[0]-12),max(0,box[1]-12),min(im.width,box[2]+12),min(im.height,box[3]+12)))
                    else:crop=im.crop((max(55,hx-45),max(0,hy-340),min(right,1560),hy-14))
                    crop.thumbnail((500,500));crop.save(imgpath,quality=90);CROPPED.add(image_id)
                entry=dict(id=key,collectionId=cid,sku=sku,name=title.title(),type=item_type(title),shape=shape(title),color=col,
                    dimensions=dims,capacityOz=round(float(cap[1])*(32 if cap[2].upper()=='QT' else 1/29.5735296 if cap[2].upper()=='ML' else 1),3) if cap else None,casePack=pack[0] if pack else None,
                    specification=specification,image=f'/catalog/{image_id}.webp',sourcePage=printed,pdfPage=page,reviewNeeded=not bool(title!='Catalog item' and (dims or cap or pack)))
                entry['_x']=x;entry['_y']=y
                found[key]=(quality,entry)
        audit.append(dict(pdfPage=page,printedPage=printed,collectionId=cid,recognizedRows=len([f for f in found.values() if f[1]['pdfPage']==page])))
    group_items=[]
    for quality,entry in sorted(found.values(),key=lambda x:x[0]+len(x[1]['sku']),reverse=True):
        if any(i['pdfPage']==entry['pdfPage'] and abs(i['_x']-entry['_x'])<18 and abs(i['_y']-entry['_y'])<10 for i in group_items):continue
        group_items.append(entry)
    for entry in group_items:entry.pop('_x',None);entry.pop('_y',None)
    items.extend(group_items);collection['itemCount']=len(group_items)
    representative=next((x for x in group_items if x['type']=='plate' and x['shape']=='round'),group_items[0] if group_items else None)
    if representative:collection['image']=representative['image']
    collections.append(collection)

references=Path(r'C:\Users\godsh\Code\plater_ai')
shutil.copyfile(references/'public/yanco-logo.png',ROOT/'public/yanco-logo.png')
for name,cid in [('MR-710','mars'),('BM-110','birmingham'),('NS-110T','nessico'),('RO-2210','rockeye')]:
    im=Image.open(references/f'src/templates/{name}.png');im.thumbnail((1200,1200));im.save(OUTPUT/f'{name}.webp',quality=95)
    for item in items:
        if item['sku']==name:
            item['image']=f'/catalog/{name}.webp'
    next(c for c in collections if c['id']==cid)['image']=f'/catalog/{name}.webp'
source_pdf=Path(r'D:\xwechat_files\wxid_5v3qo0vmap5q22_d7f2\msg\file\2026-10\2026-Yanco-Catalog.pdf')
if not (OUTPUT/'yanco-2026.pdf').exists():shutil.copyfile(source_pdf,OUTPUT/'yanco-2026.pdf')
items=[i for i in items if i['id']!='champs:CH-0Q'] # False OCR of the CH-001 compatibility heading.
# Visual source corrections are versioned separately from raw OCR so they survive re-imports.
by_id={i['id']:i for i in items}
with (ROOT/'scripts/catalog-corrections.tsv').open(encoding='utf-8',newline='') as correction_file:
    for row in csv.DictReader(correction_file,delimiter='\t'):
        key=row['collection']+':'+row['sku']
        if key not in by_id:raise ValueError('Missing visually verified SKU: '+key)
        entry=by_id[key]
        if entry['sourcePage']!=int(row['page']):raise ValueError('Incorrect correction source page: '+key)
        entry['originalSpecification']=entry['specification']
        specification=row['sku']+' '+row['specification']
        title=row['name'];dims=dimensions(row['specification']);item_shape=shape(title)
        if dims and item_shape=='round' and dims['height'] is None and dims['width'] is not None:
            dims['height']=dims['width'];dims['width']=None
        if dims and title=='Sauce Dish' and dims['height'] is None:
            dims['height']=dims['width'];dims['width']=None;item_shape='round'
        cap=re.search(r'(\d+(?:\.\d+)?)\s*OZ\b',row['specification'],re.I)
        pack=re.search(r'\d+\s*(?:DZ|PC|SET)\b',row['specification'],re.I)
        entry.update(name=title,type=item_type(title),shape=item_shape,dimensions=dims,capacityOz=float(cap[1]) if cap else None,casePack=pack[0] if pack else None,specification=specification,reviewNeeded=False,sourceVerified=True)
        if row['collection']=='sea-wave' and title=='Grapefruit Bowl':
            path=OUTPUT/'sea-wave-grapefruit-verified.webp'
            if not path.exists():
                crop=Image.open(ROOT/'.cache/catalog-pages/page-041.jpg').crop((145,1665,570,1935));crop.thumbnail((500,500));crop.save(path,quality=95)
            entry['image']='/catalog/'+path.name
items=apply_variant_corrections(collections,items)
items=apply_source_review(collections,items)
apply_style_profiles(collections)
for c in collections:c['itemCount']=sum(i['collectionId']==c['id'] for i in items)
for a in audit:a['recognizedRows']=sum(i['collectionId']==a['collectionId'] and i['pdfPage']==a['pdfPage'] for i in items)
seed=dict(version='2026',catalogId='yanco-2026',collections=collections,items=items)
(ROOT/'src/data/catalog.json').write_text(json.dumps(seed,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(ROOT/'src/data/catalog-audit.json').write_text(json.dumps(dict(collectionCount=len(collections),itemCount=len(items),pages=audit,reviewCount=sum(i['reviewNeeded'] for i in items),sourceVerifiedCount=sum(bool(i.get('sourceVerified')) for i in items)),indent=2),encoding='utf-8')
print('Collections',len(collections),'Items',len(items),'Needs specification review',sum(i['reviewNeeded'] for i in items))
print('Empty collections:',[c['name'] for c in collections if not c['itemCount']])
