// VS AI: the computer fights back at every difficulty, harder levels do better, and local versus is still two humans.
const vm = require('vm');
let src = require('fs').readFileSync(__dirname + '/g.js', 'utf8');
src = src.replace(/requestAnimationFrame\(frame\);\s*\}\)\(\);\s*$/,
  'globalThis.__g = () => ({players, state, mode, screen, matchWinner, rstate, round, vsAI, startMode, menuItems, pops}); requestAnimationFrame(frame);})();');
const noop = () => {};
const check = (ok, msg) => { if (!ok) { console.error('FAIL', msg); process.exit(1); } };

function makeGame(pads) {
  const listeners = {}, els = {}; let raf = null; let T = 0;
  const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : noop, set: (t, k, v) => (t[k] = v, true) });
  const el = () => ({ getContext: () => ctx2d, addEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }),
    style: {}, classList: { add: noop, toggle: noop }, setPointerCapture: noop, focus: noop, blur: noop, hidden: true, textContent: '', value: '' });
  const g = { document: { getElementById: id => els[id] || (els[id] = el()), createElement: el, body: el(), fonts: { ready: Promise.resolve() } },
    devicePixelRatio: 1, matchMedia: () => ({ matches: false }), addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    navigator: { getGamepads: () => pads || [] }, performance: { now: () => T }, requestAnimationFrame: f => { raf = f; },
    localStorage: { getItem: () => null, setItem: noop }, Math, JSON, Object, Array, Set, Map, String, Number, Promise, isFinite, console, setTimeout, Date };
  g.window = g; vm.createContext(g); vm.runInContext(src, g);
  return { g, key: (c, d = true) => (listeners[d ? 'keydown' : 'keyup'] || []).forEach(f => f({ code: c, key: c, preventDefault: noop })),
    tap(c) { this.key(c); this.key(c, false); }, step(n = 1) { for (let i = 0; i < n; i++) { T += 16.7; raf(T); } } };
}

// menu path: VERSUS > VS AI > level. "fight": the player walks at the CPU and mashes punch; otherwise stands still.
function playMatch(level, fight) {
  const x = makeGame();
  x.tap('Digit3'); x.step();
  const items = x.g.__g().menuItems().map(it => it.label);
  check(items.includes('VS AI'), 'VS AI missing from the versus menu: ' + items);
  x.tap('KeyS'); x.tap('KeyS'); x.tap('Enter'); x.step();           // VS AI
  check(x.g.__g().screen === 'ai', 'VS AI screen did not open');
  for (let i = 1; i < level; i++) x.tap('KeyS');
  x.tap('Enter'); x.step();
  const G = () => x.g.__g();
  check(G().mode === 'versus' && G().players[1].cpu && !G().players[1].human, 'CPU opponent not set up');
  let blocks = 0, hitsOnPlayer = 0, lastHp = 100;
  for (let i = 0; i < 60 * 200 && G().state === 'play'; i++) {
    if (fight) {
      const [p, c] = G().players;
      const dx = c.x - p.x;
      x.key('KeyD', dx > 30); x.key('KeyA', dx < -30);
      x.key('KeyS', c.y - p.y > 20); x.key('KeyW', c.y - p.y < -20);
      if (i % 12 === 0) x.tap('KeyF');
    }
    x.step();
    const [p, c] = G().players;
    if (c.blocking) blocks++;
    if (p.hp < lastHp) hitsOnPlayer++;
    lastHp = p.hp;
  }
  const g = G();
  return { state: g.state, cpuWon: g.matchWinner === 1, youWon: g.matchWinner === 0, blocks, hitsOnPlayer, score: g.players[1].wins + '-' + g.players[0].wins };
}

(async () => {
  // standing still, every level beats you
  for (const lvl of [1, 2, 3]) {
    const r = playMatch(lvl, false);
    check(r.state === 'over' && r.cpuWon, 'level ' + lvl + ' CPU did not beat a player who stands still');
    check(r.hitsOnPlayer > 5, 'level ' + lvl + ' CPU barely attacked');
  }
  // fighting back: harder levels block more and win more rounds
  const res = {};
  for (const lvl of [1, 2, 3]) {
    let cpuRounds = 0, blocks = 0;
    for (let n = 0; n < 3; n++) { const r = playMatch(lvl, true); cpuRounds += +r.score[0]; blocks += r.blocks; }
    res[lvl] = { cpuRounds, blocks };
  }
  console.log('rounds won by the CPU vs a punch-masher (3 matches):', JSON.stringify(res));
  check(res[3].blocks > res[1].blocks, 'HARD should block more than EASY');
  check(res[3].cpuRounds >= res[1].cpuRounds, 'HARD should win at least as much as EASY');

  // LOCAL versus afterwards is two people again (needs a controller for P2)
  const pad = { index: 0, connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const x = makeGame([pad]);
  x.tap('Digit3'); x.step(); x.tap('KeyS'); x.tap('KeyS'); x.tap('Enter'); x.tap('Enter'); x.step(); // VS AI > EASY
  x.tap('Tab'); x.tap('KeyS'); x.tap('KeyS'); x.tap('Enter'); x.step();                          // pause > leave
  x.tap('Digit3'); x.step(); x.tap('Enter'); x.step(2);                                          // VERSUS > LOCAL
  check(x.g.__g().mode === 'versus' && !x.g.__g().players[1].cpu && x.g.__g().vsAI === 0, 'local versus still had the CPU');
  console.log('vs ai ok');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
