// Leaderboard: play solo to game over against an in-memory db and check the score lands in scores/<uid>.
const vm = require('vm');
let src = require('fs').readFileSync(__dirname + '/g.js', 'utf8');
src = src.replace(/requestAnimationFrame\(frame\);\s*\}\)\(\);\s*$/, 'globalThis.__g = () => ({state, score, lb, screen}); requestAnimationFrame(frame);})();');
const noop = () => {};
const store = { 'scores/u_other': { solo: 900, updated: 1 } };
const subs = [];
const snapOf = () => ({ docs: Object.keys(store).map(p => ({ id: p.split('/')[1], exists: true, data: () => store[p] })) });
const db = {
  collection: () => ({ limit: () => ({ onSnapshot: (next) => { subs.push(next); setTimeout(() => next(snapOf()), 0); return noop; } }) }),
  doc: path => ({ set: async data => { store[path] = JSON.parse(JSON.stringify(data)); subs.forEach(f => f(snapOf())); } })
};
const user = { id: async () => 'u_me', profiles: async ids => Object.fromEntries(ids.map(i => [i, { name: i === 'u_me' ? 'Me' : 'Someone Else' }])) };
const listeners = {}; let raf = null; let T = 0;
const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : noop, set: (t, k, v) => (t[k] = v, true) });
const el = () => ({ getContext: () => ctx2d, addEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }), style: {}, classList: { add: noop, toggle: noop }, setPointerCapture: noop, focus: noop, blur: noop, hidden: false, textContent: '' });
const g = { document: { getElementById: el, createElement: el, body: el(), fonts: { ready: Promise.resolve() } }, devicePixelRatio: 1, matchMedia: () => ({ matches: false }),
  addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); }, navigator: { getGamepads: () => [] }, performance: { now: () => T }, requestAnimationFrame: f => { raf = f; },
  localStorage: { getItem: () => null, setItem: noop }, claude: { use: async n => n === 'db' ? db : n === 'user' ? user : null },
  Math, JSON, Object, Array, Set, Map, String, Number, Promise, isFinite, console, Date, setTimeout };
g.window = g; vm.createContext(g); vm.runInContext(src, g);
const key = (c, d = true) => listeners[d ? 'keydown' : 'keyup'].forEach(f => f({ code: c, preventDefault: noop }));
const tap = c => { key(c); key(c, false); };
(async () => {
  await new Promise(r => setTimeout(r, 30));
  tap('Digit1');
  for (let i = 0; i < 60 * 240 && g.__g().state !== 'over'; i++) { if (i % 20 === 0) tap('KeyF'); T += 16.7; raf(T); }
  for (let i = 0; i < 10; i++) { T += 16.7; raf(T); }
  await new Promise(r => setTimeout(r, 30));
  const d = g.__g();
  console.log('game over:', d.state, 'score', d.score, '| saved doc:', JSON.stringify(store['scores/u_me']), '| message:', d.lb.last);
  if (d.score > 0 && !(store['scores/u_me'] && store['scores/u_me'].solo === d.score)) { console.error('FAIL score not saved'); process.exit(1); }
  tap('Escape'); tap('Escape');
  tap('Digit5'); T += 16.7; raf(T);
  await new Promise(r => setTimeout(r, 30));
  const rows = g.__g().lb.docs.map(x => x.id + ':' + x.solo), names = g.__g().lb.names;
  console.log('screen', g.__g().screen, '| board rows', rows.join(', '), '| names', JSON.stringify(names));
  console.log('leaderboard ok');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
