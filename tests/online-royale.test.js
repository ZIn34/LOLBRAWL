// online battle royale duos: host + guest sharing a fake room
const vm = require('vm');
let src = require('fs').readFileSync(__dirname + '/g.js', 'utf8');
src = src.replace(/requestAnimationFrame\(frame\);\s*\}\)\(\);\s*$/, 'globalThis.__g = () => ({players, state, mode, storm, rocks, mapSeed, cam, net}); requestAnimationFrame(frame);})();');
const noop = () => {};
const pres = {};
function makeRoom(me) {
  pres[me] = {};
  return {
    presence(patch) { const o = Object.assign({}, pres[me]); for (const k in patch) { if (patch[k] === null) delete o[k]; else o[k] = JSON.parse(JSON.stringify(patch[k])); } pres[me] = o; return Promise.resolve(); },
    peers() { return Object.keys(pres).map(p => ({ peer: p, isMe: true, sameTab: p === me, kind: 'viewer', guest: false, by: null, presence: pres[p], updatedAt: 0 })); },
    connected: () => true,
  };
}
function makeGame(name) {
  const listeners = {}; let raf = null; let T = 0;
  const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : noop, set: (t, k, v) => (t[k] = v, true) });
  const el = () => ({ getContext: () => ctx2d, addEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }), style: {}, classList: { add: noop, toggle: noop }, setPointerCapture: noop, hidden: false, textContent: '' });
  const room = makeRoom(name);
  const g = { document: { getElementById: el, createElement: el, body: el(), fonts: { ready: Promise.resolve() } }, devicePixelRatio: 1, matchMedia: () => ({ matches: false }),
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); }, navigator: { getGamepads: () => [] },
    performance: { now: () => T }, requestAnimationFrame: f => { raf = f; }, localStorage: { getItem: () => null, setItem: noop },
    claude: { use: async n => n === 'room' ? room : null }, Math, JSON, Object, Array, Set, Map, String, Number, Promise, isFinite, console };
  g.window = g; vm.createContext(g); vm.runInContext(src, g);
  return { g, key: (c, d = true) => (listeners[d ? 'keydown' : 'keyup'] || []).forEach(f => f({ code: c, preventDefault: noop })),
    tap(c) { this.key(c); this.key(c, false); }, step() { T += 16.7; raf(T); } };
}
(async () => {
  const host = makeGame('hostpeer1234'), guest = makeGame('guestpeer567');
  await new Promise(r => setTimeout(r, 20));
  for (const x of [host, guest]) { x.tap('Digit4'); x.tap('KeyS'); x.tap('KeyS'); x.tap(process.argv[2] === 'solo' ? 'Enter' : 'KeyS'); if (process.argv[2] !== 'solo') x.tap('Enter'); }
  host.tap('Enter');
  for (let i = 0; i < 5; i++) { host.step(); guest.step(); }
  guest.tap('KeyS'); guest.tap('Enter');
  for (let i = 0; i < 10; i++) { host.step(); guest.step(); }
  let maxBytes = 0;
  for (let i = 0; i < 60 * 120; i++) {
    if (i % 25 === 0) { host.tap('KeyF'); guest.tap('KeyF'); }
    if (i % 200 === 0) { guest.key('KeyD'); host.key('KeyA'); }
    if (i % 200 === 100) { guest.key('KeyD', false); host.key('KeyA', false); }
    host.step(); guest.step();
    if (host.g.__g().state !== 'play') { const h = host.g.__g(), q = guest.g.__g(); console.log('ended at', (i/60).toFixed(1), 's · host', h.state, '· guest', q.state, 'guest sees place', q.players.length && q.state); break; }
    maxBytes = Math.max(maxBytes, JSON.stringify(pres.hostpeer1234).length);
    if (i % 1200 === 0) {
      const h = host.g.__g(), q = guest.g.__g();
      console.log('t', i / 60, 'host', h.mode, h.state, 'alive', h.players.filter(p => !p.dead).length, '| guest', q.mode, q.state, 'players', q.players.length, 'seed match', h.mapSeed === q.mapSeed, 'rocks', q.rocks.length,
        'P2 host-pos', Math.round(h.players[1].x), 'guest-pos', Math.round(q.players[1].x), 'guest cam', Math.round(q.cam.x), 'P2 human', h.players[1].human);
      if (h.state !== 'play') break;
    }
  }
  console.log('max presence bytes', maxBytes);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
