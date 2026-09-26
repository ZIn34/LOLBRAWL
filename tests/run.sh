#!/usr/bin/env bash
# Headless checks for lolbrawl.html: pulls the game script out of the page,
# then drives it with fake canvas/input/room stubs.
set -e
cd "$(dirname "$0")"
sed -n '/<script>/,/<\/script>/p' ../lolbrawl.html | sed '1d;$d' > g.js
node --check g.js
echo "== local modes";        node modes.test.js
echo "== online co-op/versus"; node online.test.js
echo "== battle royale solo";  node royale.test.js solo | tail -2
echo "== battle royale duos";  node royale.test.js duos | tail -2
echo "== online without claude"; node online-p2p.test.js
echo "== lobbies and rooms";   node online-lobby.test.js
echo "== online royale solo";  node online-royale.test.js solo | tail -3
echo "== online royale duos";  node online-royale.test.js duos | tail -3
echo "== leaderboard";          node leaderboard.test.js | tail -1
echo "== crazygames build";      node crazygames.test.js
echo "== vs ai";                 node vs-ai.test.js | tail -1
