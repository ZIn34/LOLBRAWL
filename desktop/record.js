// Records the self-playing demo for trailers, and renders trailer audio.
//
// Record:  electron record.js <outDir> <seconds> <fps> <warmupSeconds> <demo> <width> <height> [speed]
//          demo = versus | royale | solo | coop. seconds/warmup are game seconds. speed < 1 slows the
//          game down while recording so frames come out smooth even when capturing is slow.
//          Writes numbered PNG frames, clocks.json (game time of each frame) and
//          sounds.json ([game time, sound name] pairs heard during the recording).
// Render:  electron record.js --render <events.json> <seconds> <out.wav>
//          events.json holds [time, sound name] pairs on the trailer's timeline; the WAV gets
//          those game sounds plus a chiptune backing track, made by the game's own synth.
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2).filter(a => !a.endsWith('.js') && a !== '.');

function page(query, w = 960, h = 600) {
  const win = new BrowserWindow({
    width: w, height: h, show: false, useContentSize: true, backgroundColor: '#110f1c',
    webPreferences: { offscreen: true, backgroundThrottling: false }
  });
  win.webContents.setFrameRate(60);
  return win.loadFile(path.join(__dirname, 'app', 'index.html'), { query }).then(() => win);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function record([outDir = 'frames', secs = '8', fps = '30', warm = '4', demo = 'versus', ww = '960', hh = '600', speed = '1']) {
  fs.mkdirSync(outDir, { recursive: true });
  const win = await page({ demo, speed }, +ww, +hh);
  await sleep(+warm * 1000 / +speed);
  await win.webContents.executeJavaScript('window.__lol.log()');          // drop warm-up sounds
  const total = Math.round(+secs * +fps), clocks = [];
  for (let i = 0; i < total; i++) {
    const t0 = Date.now();
    clocks.push(await win.webContents.executeJavaScript('window.__lol.clock()'));
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, String(i).padStart(4, '0') + '.png'), img.toPNG());
    await sleep(Math.max(0, 1000 / +fps / +speed - (Date.now() - t0)));
  }
  const sounds = await win.webContents.executeJavaScript('window.__lol.log()');
  const gameFps = (total - 1) / Math.max(0.001, clocks[total - 1] - clocks[0]);
  fs.writeFileSync(path.join(outDir, 'fps.txt'), gameFps.toFixed(2));
  fs.writeFileSync(path.join(outDir, 'clocks.json'), JSON.stringify(clocks));
  fs.writeFileSync(path.join(outDir, 'sounds.json'), JSON.stringify(sounds));
  console.log('recorded', total, 'frames to', outDir, 'at', gameFps.toFixed(1), 'frames per game second,', sounds.length, 'sounds');
}

async function render([eventsFile, secs, outWav]) {
  const events = JSON.parse(fs.readFileSync(eventsFile, 'utf8'));
  const win = await page({ demo: 'render' });
  const b64 = await win.webContents.executeJavaScript(`window.__lol.render(${JSON.stringify(events)}, ${+secs}, true)`);
  const pcm = Buffer.from(b64, 'base64'), rate = 44100, head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVE', 8); head.write('fmt ', 12);
  head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22); head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(outWav, Buffer.concat([head, pcm]));
  console.log('rendered', outWav, (pcm.length / rate / 4).toFixed(1) + 's');
}

app.whenReady().then(async () => {
  try { if (args[0] === '--render') await render(args.slice(1)); else await record(args); }
  catch (e) { console.error(e); process.exitCode = 1; }
  app.quit();
});
