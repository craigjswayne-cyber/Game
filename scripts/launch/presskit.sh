#!/usr/bin/env bash
# Build the downloadable press kit from the final launch assets.
#   bash scripts/launch/presskit.sh
# Writes landing/press/phase-press-kit.zip (published with the website) and the
# individual files the press page links to. Run after brandkit, storeframes and
# capture; it only copies finals, it never makes new art.
set -euo pipefail
A=docs/launch/assets
OUT=landing/press
K=storeart/presskit
rm -rf "$K" && mkdir -p "$K"/{logos,icon,screenshots/frames,screenshots/screens,key-art,gif} "$OUT"
cp $A/01-brand/final/logo/*.png $A/01-brand/final/logo/mark.svg "$K/logos/"
cp $A/01-brand/final/icon/icon-master-1024.png "$K/icon/phase-icon-1024.png"
for f in $A/02-store/final/play/STO-*.png; do convert "$f" -quality 90 "$K/screenshots/frames/$(basename "${f%.png}").jpg"; done
for n in home match-fulltime word-kept agents offers tactics legacy press-question; do
  src=storeart/raw/en/$n.png; [ -f storeart/raw/en-z1.15/$n.png ] && src=storeart/raw/en-z1.15/$n.png
  [ -f "$src" ] && convert "$src" -quality 90 "$K/screenshots/screens/$n.jpg"
done
cp $A/02-store/final/play/feature-graphic-1024x500.png $A/05-website/final/og-image-1200x630.png $A/04-social/final/headers/youtube-banner-2560x1440.png "$K/key-art/"
# the gif: the "Word kept" beat from the 6s animatic, square, small enough to embed
ffmpeg -loglevel error -y -i $A/03-trailer/working/animatic-6s-1x1.mp4 -vf "fps=15,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer" "$K/gif/phase-word-kept.gif"
sed -n '/^## Fact sheet/,/^## Media in the pack/p' $A/06-press/PRESS-KIT.md | sed '$d' > "$K/FACTS.txt"
sed -n '/^## Permitted use/,/^## Developer bio/p' $A/06-press/PRESS-KIT.md | sed '$d' >> "$K/FACTS.txt"
rm -f "$OUT/phase-press-kit.zip"
(cd "$K" && zip -q -r -9 "$OLDPWD/$OUT/phase-press-kit.zip" .)
# the individual files the press page shows
cp "$K/screenshots/frames/"STO-0{1,2,3,4}*.jpg "$OUT/"
cp $A/01-brand/final/logo/lockup-horizontal-dark-bg.png $A/01-brand/final/icon/icon-master-1024.png "$OUT/"
ls -la "$OUT"
