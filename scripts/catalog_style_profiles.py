"""Refresh editorial style metadata without touching verified SKUs or photographs."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROFILES = json.loads((ROOT / 'scripts/catalog-style-profiles.json').read_text(encoding='utf-8'))

def apply_style_profiles(collections):
    for collection in collections:
        colors = ' '.join(collection['colors']).lower()
        visual = []
        if any(color in colors for color in ['brown', 'ivory', 'terracotta', 'green', 'clay']):
            visual += ['warm', 'earthy', 'natural']
        if any(color in colors for color in ['blue', 'aqua', 'teal', 'turquoise']):
            visual += ['cool', 'coastal-tone']
        if any(color in colors for color in ['black', 'charcoal']):
            visual += ['modern', 'high-contrast']
        if any(color in colors for color in ['white', 'ivory', 'gray', 'clear']):
            visual += ['neutral']
        profile = PROFILES.get(collection['id'], {})
        collection['visualTags'] = list(dict.fromkeys(visual + profile.get('visualTags', [])))
        collection['conceptTags'] = profile.get('conceptTags', []).copy()
        collection['styleNotes'] = profile.get('note', '')
        # Kept for catalog search/backward compatibility, never used to infer cuisine.
        functional = ['durable', 'outdoor'] if collection['category'] == 'melamine' else []
        collection['tags'] = list(dict.fromkeys(collection['visualTags'] + collection['conceptTags'] + functional))
    return collections

if __name__ == '__main__':
    path = ROOT / 'src/data/catalog.json'
    seed = json.loads(path.read_text(encoding='utf-8'))
    apply_style_profiles(seed['collections'])
    path.write_text(json.dumps(seed, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f"Updated style metadata for {len(seed['collections'])} collections; verified product records and assets unchanged.")
