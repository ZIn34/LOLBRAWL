// Online co-op and versus: a host and a guest share a fake room and play for a while.
const vm = require('vm');
let src = require('fs').readFileSync(__dirname + '/g.js', 'utf8');
src = src.replace(/requestAnimationFrame\(frame\);\s*\}\)\(\);\s*$/,
  'globalThis.__g = () => ({players, state, mode, net}); requestAnimationFrame(frame);})();');
const noop = () => {};
const pres = {};
function makeRoom(me) {
  pres[me] = {};
  return {
    presence(patch) {
      const o = Object.assign({}, pres[me]);
      for (const k in patch) { if (patch[k] === null) delete o[k]; else o[k] = JSON.parse(JSON.stringify(patch[k])); }
      pres[me] = o; return Promise.resolve();
    },
    peers() { return Object.keys(pres).map(p => ({ peer: p, isMe: p === me, sameTab: p === me, kind: 'viewer', guest: false, by: null, presence: pres[p], updatedAt: 0 })); },
    connected: () => true
  };
}
function makeGame(name) {
  const listeners = {}; let raf = null; let T = 0;
  const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : noop, set: (t, k, v) => (t[k] = v, true) });
  const el = () => ({ getContext: () => ctx2d, addEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }),
    style: {}, classList: { add: noop, toggle: noop }, setPointerCapture: noop, hidden: false, textContent: '' });
  const room = makeRoom(name);
  const g = { document: { getElementById: el, createElement: el, body: el(), fonts: { ready: Promise.resolve() } }, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }), addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    navigator: { getGamepads: () => [] }, performance: { now: () => T }, requestAnimationFrame: f => { raf = f; },
    localStorage: { getItem: () => null, setItem: noop }, claude: { use: async n => n === 'room' ? room : null },
    Math, JSON, Object, Array, Set, Map, String, Number, Promise, isFinite, console };
  g.window = g; vm.createContext(g); vm.runInContext(src, g);
  return { g, key: (c, d = true) => (listeners[d ? 'keydown' : 'keyup'] || []).forEach(f => f({ code: c, preventDefault: noop })),
    tap(c) { this.key(c); this.key(c, false); }, step() { T += 16.7; raf(T); } };
}
const check = (ok, msg) => { if (!ok) { console.error('FAIL', msg); process.exit(1); } };

(async () => {
  for (const [digit, name] of [['Digit2', 'coop'], ['Digit3', 'versus']]) {
    for (const k in pres) delete pres[k];
    const host = makeGame('hostpeer1234'), guest = makeGame('guestpeer567');
    await new Promise(r => setTimeout(r, 20));
    for (const x of [host, guest]) { x.tap(digit); x.tap('KeyS'); x.tap('Enter'); }  // mode > ONLINE
    host.tap('Enter');                                                                // QUICK PLAY (nothing open yet, so it hosts)
    for (let i = 0; i < 5; i++) { host.step(); guest.step(); }
    guest.tap('KeyS'); guest.tap('Enter');                                            // JOIN
    for (let i = 0; i < 10; i++) { host.step(); guest.step(); }
    check(pres.hostpeer1234.guest === 'guestpeer567' && pres.hostpeer1234.s, name + ': guest did not join');
    for (let i = 0; i < 120; i++) { host.step(); guest.step(); }                    // versus: wait out the round intro
    const x0 = host.g.__g().players[1].x;
    guest.key('KeyA');                                                                // guest walks left
    for (let i = 0; i < 60; i++) { host.step(); guest.step(); }
    guest.key('KeyA', false);
    const x1 = host.g.__g().players[1].x;
    check(x1 < x0 - 30, name + ': guest input did not reach the host');
    for (let i = 0; i < 60 * 12; i++) { if (i % 30 === 0) { host.tap('KeyF'); guest.tap('KeyF'); } host.step(); guest.step(); }
    const gp = guest.g.__g().players[0], hp = host.g.__g().players[0];
    check(Math.abs(gp.x - hp.x) < 40, name + ': guest view out of sync');
    guest.tap('Tab'); guest.tap('KeyS'); guest.tap('KeyS'); guest.tap('Enter');       // pause > LEAVE GAME
    for (let i = 0; i < 5; i++) { host.step(); guest.step(); }
    check(host.g.__g().net.role === null && host.g.__g().state === 'menu', name + ': host did not notice the guest leaving');
    console.log(name + ' online ok · snapshot bytes', JSON.stringify(pres.hostpeer1234).length);
  }
})().catch(e => { console.error('FAIL', e); process.exit(1); });
