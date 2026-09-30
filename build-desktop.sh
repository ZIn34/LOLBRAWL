#!/usr/bin/env bash
# Builds the Windows desktop app for itch.io: release/LOLbrawl-windows.zip (unzip and run LOLbrawl.exe).
# Also (re)makes the store media from fresh demo recordings when you pass --media:
#   release/lolbrawl-short.mp4 (YouTube Short with sound), release/lolbrawl.gif, release/itch-cover.png
# Needs Node.js; --media also needs Python with Pillow, numpy and imageio-ffmpeg.
set -e
cd "$(dirname "$0")"
bash build.sh
rm -rf desktop/app && mkdir -p desktop/app release
cp index.html manifest.webmanifest desktop/app/ && cp -r icons desktop/app/
(cd desktop && npm install --no-audit --no-fund >/dev/null && node node_modules/electron/install.js)
if [ "$1" = "--media" ]; then
  rm -rf release/frames
  # each mode plays itself at 0.35x speed so every frame and every sound is captured
  (cd desktop && E=./node_modules/electron/dist/electron.exe \
     && $E record.js ../release/frames/solo 12 30 6 solo 1920 1200 0.35 \
     && $E record.js ../release/frames/coop 12 30 6 coop 1920 1200 0.35 \
     && $E record.js ../release/frames/versus 14 30 4 versus 1920 1200 0.35 \
     && $E record.js ../release/frames/royale 14 30 20 royale 1920 1200 0.35)
  python tools/make_media.py
else
  python -c "import sys; sys.path.insert(0, 'tools'); import make_media as m; m.make_ico()"
fi
(cd desktop && npx @electron/packager . LOLbrawl --platform=win32 --arch=x64 --icon=icon.ico --out=../release/app --overwrite --asar \
   --executable-name=LOLbrawl --app-version=1.0.0 --win32metadata.ProductName=LOLbrawl --win32metadata.FileDescription=LOLbrawl)
rm -f release/LOLbrawl-windows.zip
python -c "import shutil; shutil.make_archive('release/LOLbrawl-windows', 'zip', 'release/app/LOLbrawl-win32-x64')"
echo "wrote release/LOLbrawl-windows.zip"
