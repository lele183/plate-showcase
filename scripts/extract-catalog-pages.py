"""Extract the lossless embedded catalog page images for OCR and visual QA."""
from pathlib import Path
from pypdf import PdfReader
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('catalog')
parser.add_argument('output')
args = parser.parse_args()
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
reader = PdfReader(args.catalog)
for number, page in enumerate(reader.pages, 1):
    (output / f'page-{number:03}.jpg').write_bytes(page.images[0].data)
print(f'Extracted {len(reader.pages)} pages')
