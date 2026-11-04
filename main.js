// main.js
// This is the "main process" of Electron. Its only job is to open a window
// and load our first HTML page (index.html) inside it.

const { app, BrowserWindow } = require('electron');

function createWindow() {
  // Create the desktop window
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    title: 'SolatTime',
    webPreferences: {
      contextIsolation: true // safe default setting
    }
  });

  win.setMenuBarVisibility(false); // hide the default menu bar
  win.loadFile('index.html');      // show the Home page
}

// When Electron is ready, open the window
app.whenReady().then(() => {
  createWindow();

  // macOS: re-open a window if the dock icon is clicked and none are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Close the app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
