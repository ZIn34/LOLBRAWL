// Records the self-playing demo (index.html?demo) to PNG frames for the GIF and cover art.
// Usage: electron record.js <outDir> [seconds] [fps] [warmupSeconds] [demo] [width] [height] [speed]
// seconds/warmup are game seconds; with speed < 1 the recording takes 1/speed times longer in real time
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
const [outDir = 'frames', secs = '8', fps = '15', warm = '4', demo = 'versus', ww = '960', hh = '600', speed = '1'] = process.argv.slice(2).filter(a => !a.startsWith('--') && !a.endsWith('.js') && a !== '.');

app.whenReady().then(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const win = new BrowserWindow({
    width: +ww, height: +hh, show: false, useContentSize: true, backgroundColor: '#110f1c',
    webPreferences: { offscreen: true, backgroundThrottling: false }
  });
  win.webContents.setFrameRate(60);
  await win.loadFile(path.join(__dirname, 'app', 'index.html'), { query: { demo, speed } });
  await new Promise(r => setTimeout(r, +warm * 1000 / +speed));
  const total = Math.round(+secs * +fps), started = Date.now();
  for (let i = 0; i < total; i++) {
    const t0 = Date.now();
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, String(i).padStart(4, '0') + '.png'), img.toPNG());
    await new Promise(r => setTimeout(r, Math.max(0, 1000 / +fps / +speed - (Date.now() - t0))));
  }
  const real = total / ((Date.now() - started) / 1000) / +speed; // frames per GAME second
  fs.writeFileSync(path.join(outDir, 'fps.txt'), real.toFixed(2));
  console.log('recorded', total, 'frames to', outDir, 'at', real.toFixed(1), 'fps');
  app.quit();
});
