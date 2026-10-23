"""Validate exact official photo associations before preparing catalog assets."""
import unittest

from catalog_studio_bulk import candidates, series_matches


def item(collection='lyon', sku='LY-307YL'):
    return {
        'id': collection + ':' + sku, 'collectionId': collection,
        'sku': sku, 'image': '/catalog/original.webp',
    }


def product(sku='LY-307YL', series='lyon-yellow'):
    return {
        'sku': sku, 'permalink': 'https://yancochina.com/product/' + sku,
        'images': [{'src': 'https://yancochina.com/original.jpg'}],
        'attributes': [{
            'taxonomy': 'pa_item-series', 'terms': [{'slug': series}],
        }],
    }


class OfficialPhotoAssociationTest(unittest.TestCase):
    def test_exact_sku_is_required_even_when_series_and_shape_match(self):
        selected, unavailable = candidates(
            {'items': [item()]}, [product(sku='LY-307BL')]
        )
        self.assertEqual(selected, [])
        self.assertEqual(len(unavailable), 1)

    def test_exact_sku_does_not_override_a_wrong_official_series(self):
        selected, unavailable = candidates(
            {'items': [item()]}, [product(series='legna')]
        )
        self.assertEqual(selected, [])
        self.assertIn('manual association review', unavailable[0]['reason'])

    def test_known_series_alias_retains_original_and_exact_sku(self):
        source = item()
        selected, unavailable = candidates({'items': [source]}, [product()])
        self.assertEqual(unavailable, [])
        self.assertEqual(selected[0]['itemId'], source['id'])
        self.assertEqual(selected[0]['catalogImage'], source['image'])
        self.assertEqual(selected[0]['officialSeries'], ['lyon-yellow'])
        self.assertEqual(
            selected[0]['output'], '/catalog/studio-photo-lyon-ly-307yl.webp'
        )
        self.assertNotIn('studioImage', source)

    def test_shared_spoon_exception_is_limited_to_the_verified_white_sku(self):
        self.assertTrue(series_matches(item('longevity', 'NS-7003W'), ['nessico']))
        self.assertFalse(series_matches(item('longevity', 'NS-7003'), ['nessico']))

    def test_ambiguous_official_skus_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'duplicate SKUs'):
            candidates({'items': [item()]}, [product(), product()])

    def test_only_the_reviewed_sku_alias_is_used_and_documented(self):
        source = item('mayor', 'MA-001')
        selected, unavailable = candidates(
            {'items': [source]}, [product(sku='MA-1', series='mayor')]
        )
        self.assertEqual(unavailable, [])
        self.assertEqual(selected[0]['sku'], 'MA-001')
        self.assertEqual(selected[0]['officialSku'], 'MA-1')
        self.assertIn('zero padding', selected[0]['associationNote'])
        selected, unavailable = candidates(
            {'items': [item('mayor', 'MA-003')]},
            [product(sku='MA-3', series='mayor')]
        )
        self.assertEqual(selected, [])
        self.assertEqual(len(unavailable), 1)


if __name__ == '__main__':
    unittest.main()
