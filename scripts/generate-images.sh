#!/usr/bin/env bash
set -e

DIR="/home/lele/code/plate-showcase/public/generated"
MMX="/home/linuxbrew/.linuxbrew/bin/mmx"

$MMX image generate \
  --prompt "A professional top-down restaurant table setting with white porcelain dinner plates and a bowl, Italian pasta with tomato basil sauce and antipasto spread, warm candlelight, 4K" \
  --out "$DIR/italian-abco.jpg" --aspect-ratio 16:9

$MMX image generate \
  --prompt "A professional top-down restaurant table setting with green-rimmed stoneware plates and rustic Italian dishes, warm trattoria atmosphere, 4K food photography" \
  --out "$DIR/italian-green-band.jpg" --aspect-ratio 16:9

$MMX image generate \
  --prompt "A professional top-down restaurant table setting with blue-rimmed Greek pottery style plates, seafood and mezze dishes, Mediterranean atmosphere, 4K food photography" \
  --out "$DIR/greek-mars.jpg" --aspect-ratio 16:9

$MMX image generate \
  --prompt "A professional top-down restaurant table setting with blue melamine outdoor plates, Greek-inspired casual dishes, outdoor terrace dining, 4K food photography" \
  --out "$DIR/greek-sentry.jpg" --aspect-ratio 16:9

$MMX image generate \
  --prompt "A professional top-down restaurant table setting with matte dark black porcelain plates, contemporary small plates and tapas, modern bistro style, 4K food photography" \
  --out "$DIR/modern-diamond-black.jpg" --aspect-ratio 16:9

$MMX image generate \
  --prompt "A professional top-down restaurant table setting with matte black melamine plates, trendy contemporary bistro dishes, sleek modern style, 4K food photography" \
  --out "$DIR/modern-moderne.jpg" --aspect-ratio 16:9

$MMX image generate \
  --prompt "A professional top-down restaurant table setting with heavy-duty melamine plates, casual family dining dishes, warm relaxed atmosphere, 4K food photography" \
  --out "$DIR/casual-sentry.jpg" --aspect-ratio 16:9

$MMX image generate \
  --prompt "A professional top-down restaurant table setting with natural stoneware plates, comfort food and brunch dishes, warm rustic atmosphere, 4K food photography" \
  --out "$DIR/casual-nordic.jpg" --aspect-ratio 16:9

$MMX image generate \
  --prompt "A professional top-down restaurant table setting with gold-rimmed premium porcelain plates, Michelin-level tasting menu presentation, luxury fine dining, 4K food photography" \
  --out "$DIR/fine-dining-royal.jpg" --aspect-ratio 16:9

$MMX image generate \
  --prompt "A professional top-down restaurant table setting with fine white porcelain plates, elegant fine dining dishes, refined restaurant style, 4K food photography" \
  --out "$DIR/fine-dining-abco.jpg" --aspect-ratio 16:9

echo "Done! All 10 images generated."
ls -lh "$DIR"
