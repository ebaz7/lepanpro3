const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'دلکام - سامانه مالی و بازرگانی',
    icon: path.join(__dirname, '../app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false
    }
  });

  mainWindow.setMenuBarVisibility(false);

  if (app.isPackaged) {
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath);
  } else {
    const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
    mainWindow.loadURL(startUrl);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers for Desktop Auto-Updates & Local Downloads Folder Management (Identical to Tauri)

// 1. Get client native version
ipcMain.handle('get-version', () => {
  return app.getVersion() || '1.0.29';
});

// 2. Check if installer file exists in Downloads or UserData
ipcMain.handle('check-local-file-exists', async (event, fileName) => {
  try {
    const downloadsDir = app.getPath('downloads');
    const userDataDir = app.getPath('userData');
    const p1 = path.join(downloadsDir, fileName);
    const p2 = path.join(userDataDir, fileName);
    return fs.existsSync(p1) || fs.existsSync(p2);
  } catch {
    return false;
  }
});

// 3. Save binary bytes to Downloads folder and automatically execute installer
ipcMain.handle('save-and-open-local-file', async (event, { fileName, bytes }) => {
  try {
    const downloadsDir = app.getPath('downloads');
    const filePath = path.join(downloadsDir, fileName);
    const buffer = Buffer.from(bytes);
    fs.writeFileSync(filePath, buffer);
    await shell.openPath(filePath);
    return filePath;
  } catch (err) {
    console.error('Failed to save and open local update file:', err);
    throw err;
  }
});

// 4. Open & launch local installer executable
ipcMain.handle('open-local-file', async (event, fileName) => {
  try {
    const downloadsDir = app.getPath('downloads');
    const userDataDir = app.getPath('userData');
    let filePath = path.join(downloadsDir, fileName);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(userDataDir, fileName);
    }
    if (fs.existsSync(filePath)) {
      await shell.openPath(filePath);
      return filePath;
    }
    throw new Error('File not found');
  } catch (err) {
    console.error('Failed to open local file:', err);
    throw err;
  }
});

// 5. Open File Explorer / Folder containing downloaded update with file highlighted
ipcMain.handle('open-local-file-dir', async (event, fileName) => {
  try {
    const downloadsDir = app.getPath('downloads');
    const userDataDir = app.getPath('userData');
    let filePath = path.join(downloadsDir, fileName);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(userDataDir, fileName);
    }
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return downloadsDir;
    } else {
      await shell.openPath(downloadsDir);
      return downloadsDir;
    }
  } catch (err) {
    console.error('Failed to open local file directory:', err);
    throw err;
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
