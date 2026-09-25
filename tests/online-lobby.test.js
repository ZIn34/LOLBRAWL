// Lobbies: a 3-player battle royale via QUICK PLAY, private rooms by code, and two players searching at the same moment.
const vm = require('vm');
let src = require('fs').readFileSync(__dirname + '/g.js', 'utf8');
src = src.replace(/requestAnimationFrame\(frame\);\s*\}\)\(\);\s*$/,
  'globalThis.__g = () => ({players, state, mode, screen, net, localMe}); requestAnimationFrame(frame);})();');
const noop = () => {};
let pres = {};
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
  const listeners = {}, els = {}; let raf = null; let T = 0;
  const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : noop, set: (t, k, v) => (t[k] = v, true) });
  const el = () => ({ getContext: () => ctx2d, addEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }),
    style: {}, classList: { add: noop, toggle: noop }, setPointerCapture: noop, focus: noop, blur: noop, hidden: true, textContent: '', value: '' });
  const room = makeRoom(name);
  const g = { document: { getElementById: id => els[id] || (els[id] = el()), createElement: el, body: el(), fonts: { ready: Promise.resolve() } },
    devicePixelRatio: 1, matchMedia: () => ({ matches: false }), addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    navigator: { getGamepads: () => [] }, performance: { now: () => T }, requestAnimationFrame: f => { raf = f; },
    localStorage: { getItem: () => null, setItem: noop }, claude: { use: async n => n === 'room' ? room : null },
    Math, JSON, Object, Array, Set, Map, String, Number, Promise, isFinite, console, setTimeout };
  g.window = g; vm.createContext(g); vm.runInContext(src, g);
  return { g, els, name,
    key: (c, d = true, target) => (listeners[d ? 'keydown' : 'keyup'] || []).forEach(f => f({ code: c, key: c, target, preventDefault: noop })),
    tap(c) { this.key(c); this.key(c, false); }, step() { T += 16.7; raf(T); } };
}
const check = (ok, msg) => { if (!ok) { console.error('FAIL', msg); process.exit(1); } };
const stepAll = (games, n) => { for (let i = 0; i < n; i++) for (const x of games) x.step(); };
const settle = () => new Promise(r => setTimeout(r, 20));

(async () => {
  // 1) battle royale solo online: three players press QUICK PLAY, the lobby starts after 20 s
  {
    pres = {};
    const [a, b, c] = ['peerA', 'peerB', 'peerC'].map(makeGame);
    await settle();
    for (const x of [a, b, c]) { x.tap('Digit4'); x.tap('KeyS'); x.tap('KeyS'); x.tap('Enter'); }   // BATTLE ROYALE > SOLO ONLINE
    a.tap('Enter'); stepAll([a, b, c], 5);                                                     // A: QUICK PLAY (nobody there, so A hosts)
    b.tap('Enter'); stepAll([a, b, c], 5);                                                     // B and C: QUICK PLAY finds A
    c.tap('Enter'); stepAll([a, b, c], 30);
    check(JSON.stringify(pres.peerA.guests) === '["peerB","peerC"]', 'royale lobby did not collect both players: ' + JSON.stringify(pres.peerA.guests));
    check(a.g.__g().state === 'menu', 'royale lobby started before the 20 s were up');
    stepAll([a, b, c], 60 * 21);
    const A = a.g.__g(), B = b.g.__g(), C = c.g.__g();
    check(A.state === 'play' && B.state === 'play' && C.state === 'play', 'not everyone started: ' + [A.state, B.state, C.state]);
    check(A.players.filter(p => p.human).length === 3 && A.players.length === 16, 'host should run 3 humans + 13 bots');
    check(B.net.slot === 1 && C.net.slot === 2 && B.localMe() === B.players[1] && C.localMe() === C.players[2], 'guests got the wrong fighters');
    const x0 = A.players[2].x; c.key('KeyA'); stepAll([a, b, c], 60); c.key('KeyA', false);
    check(A.players[2].x < x0 - 30, 'third player\'s input did not reach the host');
    console.log('3-player battle royale lobby ok');
  }
  // 2) private room: CREATE ROOM shows a code, a friend types it; quick play never matches into it
  {
    pres = {};
    const [h, f, s] = ['hostR', 'friendR', 'strangerR'].map(makeGame);
    await settle();
    for (const x of [h, f, s]) { x.tap('Digit2'); x.tap('KeyS'); x.tap('Enter'); }   // CO-OP > ONLINE
    h.tap('KeyS'); h.tap('Enter'); stepAll([h, f, s], 5);                             // CREATE ROOM
    const code = pres.hostR.code;
    check(/^[A-Z0-9]{4}$/.test(code || ''), 'no room code: ' + code);
    s.tap('Enter'); stepAll([h, f, s], 10);                                           // stranger QUICK PLAY
    check(!(pres.hostR.guests || []).includes('strangerR'), 'quick play matched a stranger into a private room');
    f.tap('KeyS'); f.tap('KeyS'); f.tap('Enter'); stepAll([h, f, s], 2);              // JOIN ROOM
    check(f.g.__g().screen === 'code', 'join room screen did not open');
    f.els.roomCode.value = code.toLowerCase();
    f.key('Enter', true, f.els.roomCode);                                             // type the code, press Enter
    stepAll([h, f, s], 20);
    check(h.g.__g().state === 'play' && f.g.__g().state === 'play', 'friend did not get into the room by code');
    check(s.g.__g().state === 'menu', 'the stranger ended up in the private game');
    console.log('private room by code ok');
  }
  // 3) two players press QUICK PLAY at the same moment: one joins the other
  {
    pres = {};
    const [p, q] = ['peerP', 'peerQ'].map(makeGame);
    await settle();
    for (const x of [p, q]) { x.tap('Digit3'); x.tap('KeyS'); x.tap('Enter'); }       // VERSUS > ONLINE
    p.tap('Enter'); q.tap('Enter');                                                   // both QUICK PLAY before either sees the other
    stepAll([p, q], 30);
    check(p.g.__g().state === 'play' && q.g.__g().state === 'play', 'simultaneous quick play did not end up in one game');
    console.log('simultaneous quick play ok');
  }
})().catch(e => { console.error('FAIL', e); process.exit(1); });
