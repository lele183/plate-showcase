"""Regression checks for matte removal without trimming a nominal circle."""
import unittest
import numpy as np
from PIL import Image, ImageDraw
from catalog_studio_images import cutout, refine_edges


class StudioEdgesTest(unittest.TestCase):
    def test_white_glaze_and_rim_inside_the_silhouette_are_preserved(self):
        image = Image.new('RGB', (120, 90), 'white')
        draw = ImageDraw.Draw(image)
        draw.ellipse((12, 12, 108, 78), fill=(35, 65, 100))
        draw.ellipse((24, 24, 96, 66), fill=(250, 250, 250))
        result = np.asarray(cutout(image))
        self.assertEqual(tuple(result[45, 60]), (250, 250, 250, 255))
        self.assertEqual(tuple(result[45, 18]), (35, 65, 100, 255))
        self.assertEqual(result[0, 0, 3], 0)
        self.assertTrue(((result[:, :, 3] > 0) & (result[:, :, 3] < 255)).any())

    def test_rectangular_and_irregular_shapes_keep_their_corners(self):
        for points in [[(8, 8), (112, 8), (112, 82), (8, 82)],
                       [(8, 72), (58, 8), (112, 72), (82, 82)]]:
            image = Image.new('RGBA', (120, 90), (255, 255, 255, 0))
            ImageDraw.Draw(image).polygon(points, fill=(60, 110, 45, 255))
            result = np.asarray(refine_edges(image))
            self.assertEqual(tuple(result[65, 25]), (60, 110, 45, 255))
            self.assertEqual(tuple(result[50, 60]), (60, 110, 45, 255))
            self.assertEqual(result[0, 0, 3], 0)
            translucent = (result[:, :, 3] > 0) & (result[:, :, 3] < 255)
            self.assertLess(result[:, :, :3][translucent].max(), 150)
            # Straight-alpha colors remain green on either a light or dark table.
            self.assertGreater((result[:, :, 3] > 127).sum(),
                               (np.asarray(image)[:, :, 3] > 127).sum() * .90)

    def test_detached_scan_specks_are_removed(self):
        image = Image.new('RGB', (120, 90), 'white')
        draw = ImageDraw.Draw(image)
        draw.ellipse((15, 10, 105, 80), fill=(50, 80, 120))
        draw.rectangle((112, 50, 115, 75), fill=(170, 170, 170))
        result = np.asarray(cutout(image))
        self.assertEqual(result[60, 113, 3], 0)
        self.assertEqual(tuple(result[45, 60]), (50, 80, 120, 255))


if __name__ == '__main__':
    unittest.main()
