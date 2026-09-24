#!/usr/bin/env bash
# lolbrawl.html is written for Claude artifacts, which add the <!doctype>/<head> wrapper themselves.
# This makes index.html, a standalone copy for GitHub Pages or opening straight in a browser.
set -e
cd "$(dirname "$0")"
{
  echo '<!doctype html>'
  echo '<html lang="en">'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  echo '<style>html,body{height:100%}[hidden]{display:none!important}</style>'
  cat lolbrawl.html
  echo '</html>'
} > index.html
echo "wrote index.html"
