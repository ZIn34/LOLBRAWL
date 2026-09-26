#!/usr/bin/env bash
# lolbrawl.html is written for Claude artifacts, which add the <!doctype>/<head> wrapper themselves.
# This makes the standalone copies:
#   index.html              GitHub Pages / itch.io (zip it with icons/ and manifest.webmanifest)
#   crazygames/index.html   CrazyGames: loads their SDK, adds the skins menu (rewarded ads) and midgame ads
set -e
cd "$(dirname "$0")"
page() {  # $1 = extra <head> lines
  echo '<!doctype html>'
  echo '<html lang="en">'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  echo '<style>html,body{height:100%}[hidden]{display:none!important}</style>'
  printf '%s\n' "$1"
  cat lolbrawl.html
  echo '</html>'
}
# the GitHub Pages / itch copy gets the app icon and "Add to Home Screen" manifest
page '<link rel="icon" href="icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#110f1c">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="LOLbrawl">
<meta name="apple-mobile-web-app-status-bar-style" content="black">' > index.html
mkdir -p crazygames
page '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
<script>window.LOL_PLATFORM = "crazygames";</script>' > crazygames/index.html
echo "wrote index.html and crazygames/index.html (run python tools/make_icons.py to redraw the icons)"
