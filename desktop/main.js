// LOLbrawl desktop app: one window showing the same index.html as the website.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 420,
    backgroundColor: '#110f1c',
    title: 'LOLbrawl',
    icon: path.join(__dirname, 'app', 'icons', 'icon-512.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  // F11 or Alt+Enter toggles full screen
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.key === 'Enter' && input.alt)) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  // links (like Trystero in the README) open in the normal browser, not inside the game
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
