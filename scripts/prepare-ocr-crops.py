from pathlib import Path
from PIL import Image

target = Path('.cache/catalog-crops')
target.mkdir(parents=True, exist_ok=True)
for p in Path('.cache/catalog-pages').glob('*.jpg'):
    number = int(p.stem.split('-')[1])
    if number < 6 or number > 195:
        continue
    image = Image.open(p)
    for x in (0, 754):
        for y in (0, 994):
            crop = image.crop((x, y, min(x + 900, image.width), min(y + 1250, image.height)))
            crop.resize((crop.width * 2, crop.height * 2)).save(target / f'{p.stem}-x{x}-y{y}.jpg', quality=95)
print('Prepared enlarged OCR panels')
