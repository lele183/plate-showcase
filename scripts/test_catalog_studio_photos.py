"""Preserve authentic source transparency, including after ICC conversion."""
import unittest

from PIL import Image, ImageCms, ImageDraw
from catalog_studio_photos import prepare_photo


class OfficialTransparencyTest(unittest.TestCase):
    def test_glass_highlights_connected_to_white_background_are_retained(self):
        image = Image.new('RGB', (180, 220), 'white')
        draw = ImageDraw.Draw(image)
        draw.ellipse((35, 20, 145, 50), outline=(110, 120, 130), width=3)
        draw.line([(35, 35), (45, 195)], fill=(110, 120, 130), width=4)
        draw.line([(145, 35), (135, 195)], fill=(110, 120, 130), width=4)
        draw.ellipse((45, 180, 135, 205), outline=(110, 120, 130), width=4)
        result = prepare_photo(image, 'glass-highlights-v1')
        self.assertEqual(result.getpixel((result.width // 2, result.height // 2)),
                         (255, 255, 255, 255))
        self.assertEqual(result.getpixel((0, 0))[3], 0)

    def test_transparent_source_never_acquires_a_black_or_white_matte(self):
        for with_profile in [False, True]:
            with self.subTest(with_profile=with_profile):
                image = Image.new('RGBA', (180, 140), (0, 0, 0, 0))
                draw = ImageDraw.Draw(image)
                draw.ellipse((20, 20, 160, 120), fill=(55, 85, 115, 255))
                draw.ellipse((45, 40, 135, 100), fill=(250, 250, 250, 255))
                if with_profile:
                    image.info['icc_profile'] = ImageCms.ImageCmsProfile(
                        ImageCms.createProfile('sRGB')
                    ).tobytes()
                result = prepare_photo(image)
                bounds = result.getchannel('A').point(
                    lambda value: 255 if value >= 128 else 0
                ).getbbox()
                self.assertGreater(bounds[0], 0)
                self.assertGreater(bounds[1], 0)
                self.assertLess(bounds[2], result.width)
                self.assertLess(bounds[3], result.height)
                self.assertEqual(result.getpixel((0, 0))[3], 0)
                center = result.getpixel((result.width // 2, result.height // 2))
                self.assertEqual(center, (250, 250, 250, 255))


if __name__ == '__main__':
    unittest.main()
