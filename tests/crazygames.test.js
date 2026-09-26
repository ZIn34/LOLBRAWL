// CrazyGames build: skins unlock with rewarded ads (and only there), midgame ad after an offline game,
// gameplay start/stop events, cloud save, no reward when the ad fails.
const vm = require('vm');
let src = require('fs').readFileSync(__dirname + '/g.js', 'utf8');
src = src.replace(/requestAnimationFrame\(frame\);\s*\}\)\(\);\s*$/,
  'globalThis.__g = () => ({state, screen, menuItems, owned, equipped, players, adBusy, cg, note}); requestAnimationFrame(frame);})();');
const noop = () => {};
const check = (ok, msg) => { if (!ok) { console.error('FAIL', msg); process.exit(1); } };

function makeGame(crazy, sdk) {
  const listeners = {}, els = {}; let raf = null; let T = 0;
  const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : noop, set: (t, k, v) => (t[k] = v, true) });
  const el = () => ({ getContext: () => ctx2d, addEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }),
    style: {}, classList: { add: noop, toggle: noop }, setPointerCapture: noop, focus: noop, blur: noop, hidden: true, textContent: '', value: '' });
  const g = { document: { getElementById: id => els[id] || (els[id] = el()), createElement: el, body: el(), fonts: { ready: Promise.resolve() } },
    devicePixelRatio: 1, matchMedia: () => ({ matches: false }), addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    navigator: { getGamepads: () => [] }, performance: { now: () => T }, requestAnimationFrame: f => { raf = f; },
    localStorage: { getItem: () => null, setItem: noop }, Math, JSON, Object, Array, Set, Map, String, Number, Promise, isFinite, console, setTimeout, Date };
  if (crazy) { g.LOL_PLATFORM = 'crazygames'; g.CrazyGames = { SDK: sdk }; }
  g.window = g; vm.createContext(g); vm.runInContext(src, g);
  return { g, key: (c, d = true) => (listeners[d ? 'keydown' : 'keyup'] || []).forEach(f => f({ code: c, key: c, preventDefault: noop })),
    tap(c) { this.key(c); this.key(c, false); }, step(n = 1) { for (let i = 0; i < n; i++) { T += 16.7; raf(T); } } };
}
function fakeSdk() {
  const log = [], store = {};
  let nextAdFails = false;
  const sdk = {
    log, store, failNext() { nextAdFails = true; },
    init: async () => { log.push('init'); },
    game: { settings: { muteAudio: false }, addSettingsChangeListener: noop, gameplayStart: () => log.push('start'), gameplayStop: () => log.push('stop') },
    data: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    ad: { requestAd: (type, cb) => {
      log.push('ad:' + type);
      setTimeout(() => {
        if (nextAdFails) { nextAdFails = false; cb.adError && cb.adError('no fill'); return; }
        cb.adStarted && cb.adStarted(); cb.adFinished && cb.adFinished();
      }, 5);
    } }
  };
  return sdk;
}
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // itch / GitHub build: no skins menu anywhere
  const plain = makeGame(false);
  await wait(20); plain.step();
  check(!plain.g.__g().menuItems().some(it => it.label === 'SKINS'), 'skins menu showed up outside CrazyGames');
  check(!plain.g.__g().menuItems().some(it => it.label === 'LEADERBOARD'), 'leaderboard menu showed up where there is no leaderboard');

  // CrazyGames build
  const sdk = fakeSdk(), cgame = makeGame(true, sdk);
  await wait(20); cgame.step();
  const G = () => cgame.g.__g();
  check(sdk.log.includes('init') && G().cg, 'SDK was not initialised');
  const labels = G().menuItems().map(it => it.label);
  check(labels.includes('SKINS'), 'no skins menu on CrazyGames: ' + labels);
  cgame.tap('Digit5'); cgame.step();                                  // SKINS
  check(G().screen === 'skins', 'skins screen did not open');
  cgame.key('ArrowRight'); cgame.key('ArrowRight', false); cgame.step();   // GOLD
  // a failed ad gives nothing
  sdk.failNext();
  cgame.key('ArrowDown'); cgame.key('ArrowDown', false); cgame.tap('Enter'); cgame.step();
  await wait(20); cgame.step();
  check(!G().owned.has('gold'), 'a failed ad still unlocked the skin');
  // a finished ad unlocks and equips it, and it lands in the cloud save
  cgame.tap('Enter'); cgame.step(); await wait(20); cgame.step();
  check(G().owned.has('gold') && G().equipped === 'gold', 'finished ad did not unlock GOLD');
  check(JSON.parse(sdk.store['lolbrawl-skins']).includes('gold') && sdk.store['lolbrawl-skin'] === 'gold', 'unlock was not saved to CrazyGames data');
  // the next unlock waits
  cgame.key('ArrowUp'); cgame.key('ArrowUp', false); cgame.tap('Enter'); cgame.step();   // next skin (NEON)
  const action = G().menuItems()[1];
  check(action.off && /next unlock in/.test(action.sub), 'second unlock was offered right away');
  const adsBefore = sdk.log.filter(x => x === 'ad:rewarded').length;
  cgame.key('ArrowDown'); cgame.key('ArrowDown', false); cgame.tap('Enter'); cgame.step(); await wait(20);
  check(sdk.log.filter(x => x === 'ad:rewarded').length === adsBefore, 'a rewarded ad played during the wait');

  // play solo until it's over: gameplay start/stop, your skin on your lol, then one midgame ad
  cgame.tap('Escape'); cgame.step(); cgame.tap('Digit1'); cgame.step(5);
  check(G().players[0].skin === 'gold', 'equipped skin not on the player');
  check(sdk.log.includes('start'), 'gameplayStart not sent');
  for (let i = 0; i < 60 * 240 && G().state !== 'over'; i++) cgame.step();
  cgame.step(3); await wait(20); cgame.step(2);
  check(G().state === 'over', 'solo game never ended');
  check(sdk.log.includes('ad:midgame'), 'no midgame ad after the game');
  check(sdk.log.lastIndexOf('stop') > sdk.log.lastIndexOf('start'), 'gameplayStop not sent at game over');
  console.log('crazygames build ok');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
