"""Prepare tabletop cutouts while retaining the original source photographs.

Only border-connected near-white scan margins are removed. Enclosed light
glazes remain intact; existing transparent product assets are reused.
"""
import hashlib, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
VERSION = 'border-white-245-v1'

def cutout(image):
    image = image.convert('RGBA')
    if image.getextrema()[3][0] < 255:
        return image
    pixels = np.asarray(image).copy()
    rgb = pixels[:, :, :3].astype('int16')
    white = (rgb.min(axis=2) >= 245) & (rgb.max(axis=2) - rgb.min(axis=2) <= 7)
    mask = ImageOps.expand(Image.fromarray((white * 255).astype('uint8')), 1, fill=255)
    ImageDraw.floodfill(mask, (0, 0), 128)
    outside = np.asarray(mask)[1:-1, 1:-1] == 128
    pixels[:, :, 3][outside] = 0
    # Soften only the immediate margin; never key out enclosed white dinnerware.
    edge = np.asarray(Image.fromarray((outside * 255).astype('uint8')).filter(ImageFilter.MaxFilter(3))) > 0
    opacity = np.clip((255 - rgb.min(axis=2)) / 20, 0, 1)
    pixels[:, :, 3][edge] = (pixels[:, :, 3][edge] * opacity[edge]).astype('uint8')
    # Remove detached scan specks/caption remnants when one connected object
    # clearly dominates. Keep multi-part photography if this is uncertain.
    foreground = pixels[:, :, 3] > 0
    if foreground.any():
        ys, xs = np.nonzero(foreground)
        index = np.argmin((xs - image.width / 2) ** 2 + (ys - image.height / 2) ** 2)
        component = Image.fromarray((foreground * 255).astype('uint8'))
        ImageDraw.floodfill(component, (int(xs[index]), int(ys[index])), 128)
        connected = np.asarray(component) == 128
        if connected.sum() >= foreground.sum() * .85:
            pixels[:, :, 3][~connected] = 0
    return Image.fromarray(pixels)

def apply_studio_images(items):
    cache_path = ROOT / '.cache/studio-image-index.json'
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    images = {}
    for item in items:
        source = item['image']
        if source in images:
            item['studioImage'] = images[source]
            continue
        path = ROOT / ('public' + source)
        with Image.open(path) as original:
            if original.mode == 'RGBA' and original.getextrema()[3][0] < 255:
                target = source
            else:
                target = '/catalog/studio-' + path.name
                destination = ROOT / ('public' + target)
                checksum = hashlib.sha256(path.read_bytes() + VERSION.encode()).hexdigest()
                if cache.get(source) != checksum or not destination.exists():
                    cutout(original).save(destination, quality=93)
                    cache[source] = checksum
        images[source] = target
        item['studioImage'] = target
    cache_path.parent.mkdir(exist_ok=True)
    cache_path.write_text(json.dumps(cache))
