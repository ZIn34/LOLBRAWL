const vm = require('vm');
let src = require('fs').readFileSync(__dirname + '/g.js', 'utf8');
src = src.replace(/requestAnimationFrame\(frame\);\s*\}\)\(\);\s*$/, 'globalThis.__g = () => ({players, state, mode, storm, pickups, shots, feed, place, cam, rocks}); requestAnimationFrame(frame);})();');
const noop = () => {};
const listeners = {}; let raf = null; let T = 0;
const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : noop, set: (t, k, v) => (t[k] = v, true) });
const el = () => ({ getContext: () => ctx2d, addEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }), style: {}, classList: { add: noop, toggle: noop }, setPointerCapture: noop, hidden: false });
const g = { document: { getElementById: el, createElement: el, body: el(), fonts: { ready: Promise.resolve() } }, devicePixelRatio: 1, matchMedia: () => ({ matches: false }),
  addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); }, navigator: { getGamepads: () => [] }, performance: { now: () => T }, requestAnimationFrame: f => { raf = f; },
  localStorage: { getItem: () => null, setItem: noop }, Math, JSON, Object, Array, Set, Map, String, Number, Promise, isFinite, console };
g.window = g; vm.createContext(g); vm.runInContext(src, g);
const key = (c, d = true) => listeners[d ? 'keydown' : 'keyup'].forEach(f => f({ code: c, preventDefault: noop }));
const tap = c => { key(c); key(c, false); };
const step = n => { for (let i = 0; i < n; i++) { T += 16.7; raf(T); } };
tap('Digit4'); tap(process.argv[2] === 'duos' ? 'KeyS' : 'KeyW'); if (process.argv[2] !== 'duos') tap('KeyS'); tap('Enter');
let guns = 0;
for (let s = 0; s < 260; s++) {
  if (s % 2) tap('KeyF'); if (s % 5 === 0) tap('KeyE');
  step(60);
  const d = g.__g();
  guns = Math.max(guns, d.pickups.filter(k => k.kind === 'gun').length + d.players.filter(p => p.gun > 0).length);
  if (s % 15 === 0 || d.state !== 'play') console.log('t', s, d.state, 'alive', d.players.filter(p => !p.dead).length, 'you hp', Math.round(d.players[0].hp), 'storm r', Math.round(d.storm.r), 'shots', d.shots.length, 'cam', Math.round(d.cam.x), Math.round(d.cam.y), 'rocks', d.rocks.length, 'knocked', d.players.filter(p=>p.knocked).length, 'feed', d.feed.map(f => f.txt).slice(0, 2).join(' | '));
  if (d.state !== 'play') { console.log('ended: place', d.place); break; }
}
console.log('max guns seen at once', guns);
