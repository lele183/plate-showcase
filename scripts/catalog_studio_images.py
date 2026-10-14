"""Prepare tabletop cutouts while retaining the original source photographs.

Only border-connected near-white scan margins are removed. Enclosed light
glazes remain intact. Studio copies receive a shape-aware one-pixel alpha
inset and edge color repair; source photographs are never overwritten.
"""
import hashlib, json, io, time
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
VERSION = 'border-white-245-inset-v4'

def blur_colors(values, sigma=1.2):
    """Small separable float blur avoids quantizing faint edge colors."""
    radius = int(np.ceil(sigma * 3))
    offsets = np.arange(-radius, radius + 1)
    kernel = np.exp(-(offsets ** 2) / (2 * sigma ** 2))
    kernel /= kernel.sum()
    for axis in [0, 1]:
        padding = [(0, 0)] * values.ndim
        padding[axis] = (radius, radius)
        padded = np.pad(values, padding)
        result = np.zeros_like(values)
        for index, weight in enumerate(kernel):
            slices = [slice(None)] * values.ndim
            slices[axis] = slice(index, index + values.shape[axis])
            result += padded[tuple(slices)] * weight
        values = result
    return values

def refine_edges(image):
    """Remove scan matte without a circular mask or changing opaque colors.

    WebP stores straight alpha. Repair only translucent RGB using nearby
    interior colors, rather than baking a black matte into the whole image.
    This also prevents white transparent pixels leaking through resampling.
    """
    image = image.convert('RGBA')
    pixels = np.asarray(image).copy()
    alpha = image.getchannel('A').filter(ImageFilter.MinFilter(3))
    alpha = alpha.filter(ImageFilter.GaussianBlur(.45))
    core = image.getchannel('A').filter(ImageFilter.MinFilter(5))
    weights = np.asarray(core, dtype='float32')[:, :, None] / 255
    rgba = np.concatenate((pixels[:, :, :3] * weights, weights), axis=2)
    nearby = blur_colors(rgba)
    # Thin handles or pointed corners may have no two-pixel interior. Use
    # their existing alpha-weighted colors rather than a white or black matte.
    missing = nearby[:, :, 3] < 1e-6
    if missing.any():
        weights = pixels[:, :, 3:4].astype('float32') / 255
        fallback = blur_colors(np.concatenate((pixels[:, :, :3] * weights, weights), axis=2))
        nearby[missing] = fallback[missing]
    colors = nearby[:, :, :3] / np.maximum(nearby[:, :, 3:4], 1e-6)
    repair = np.asarray(alpha) < 255
    pixels[:, :, :3][repair] = np.clip(np.rint(colors[repair]), 0, 255).astype('uint8')
    pixels[:, :, 3] = np.asarray(alpha)
    pixels[:, :, :3][pixels[:, :, 3] == 0] = 0
    return Image.fromarray(pixels)

def cutout(image):
    image = image.convert('RGBA')
    if image.getextrema()[3][0] < 255:
        return refine_edges(image)
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
        # fromarray can share a read-only buffer; floodfill needs a writable copy.
        component = Image.fromarray((foreground * 255).astype('uint8')).copy()
        ImageDraw.floodfill(component, (int(xs[index]), int(ys[index])), 128)
        connected = np.asarray(component) == 128
        if connected.sum() >= foreground.sum() * .85:
            pixels[:, :, 3][~connected] = 0
    return refine_edges(Image.fromarray(pixels))

def apply_studio_images(items):
    cache_path = ROOT / '.cache/studio-image-index.json'
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    images = {}
    generated = 0
    for item in items:
        source = item['image']
        if source in images:
            item['studioImage'] = images[source]
            continue
        path = ROOT / ('public' + source)
        with Image.open(path) as original:
            target = '/catalog/studio-' + path.name
            destination = ROOT / ('public' + target)
            checksum = hashlib.sha256(path.read_bytes() + VERSION.encode()).hexdigest()
            if cache.get(source) != checksum or not destination.exists():
                encoded = io.BytesIO()
                cutout(original).save(encoded, format='WEBP', quality=93)
                # Publish a complete file; never leave a truncated asset if
                # encoding or a catalog refresh is interrupted.
                pending = destination.with_suffix('.pending.webp')
                pending.write_bytes(encoded.getvalue())
                for attempt in range(5):
                    try:
                        pending.replace(destination)
                        break
                    except OSError:
                        if attempt == 4:
                            raise
                        time.sleep(.2 * (attempt + 1))
                cache[source] = checksum
                generated += 1
                if generated % 200 == 0:
                    print(f'Studio edges refreshed: {generated}', flush=True)
                    cache_path.write_text(json.dumps(cache))
        images[source] = target
        item['studioImage'] = target
    cache_path.write_text(json.dumps(cache))
    print(f'{len(images)} studio assets checked; {generated} refreshed.', flush=True)

if __name__ == '__main__':
    seed_path = ROOT / 'src/data/catalog.json'
    seed = json.loads(seed_path.read_text(encoding='utf-8'))
    apply_studio_images(seed['items'])
    seed_path.write_text(json.dumps(seed, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
