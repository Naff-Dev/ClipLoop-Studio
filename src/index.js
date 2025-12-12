const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Enable better error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

let mainWindow;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#f5f5f5',
    show: false, // Don't show until ready
  });

  // Show window when ready to avoid flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  // Cleanup resources
  try {
    const { abortAllProcesses } = require('./utils/videoProcessor');
    abortAllProcesses();
  } catch (error) {
    console.error('Error during cleanup:', error);
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================
// IPC Handlers
// ============================================

// Select Folder Dialog
ipcMain.handle('dialog:selectFolder', async (event, title = 'Select Folder') => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: title
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

// Scan folder for media files
ipcMain.handle('media:scanFolder', async (event, folderPath) => {
  try {
    // Validate folder path
    if (!folderPath || typeof folderPath !== 'string') {
      throw new Error('Invalid folder path');
    }

    if (!fs.existsSync(folderPath)) {
      throw new Error('Folder does not exist');
    }

    const stats = fs.statSync(folderPath);
    if (!stats.isDirectory()) {
      throw new Error('Path is not a directory');
    }

    const files = fs.readdirSync(folderPath);

    const videoExtensions = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.flv'];
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];

    const videos = files.filter(file => {
      try {
        const ext = path.extname(file).toLowerCase();
        const filePath = path.join(folderPath, file);
        return videoExtensions.includes(ext) && fs.statSync(filePath).isFile();
      } catch (err) {
        return false;
      }
    }).map(file => ({
      name: file,
      path: path.join(folderPath, file)
    }));

    const audios = files.filter(file => {
      try {
        const ext = path.extname(file).toLowerCase();
        const filePath = path.join(folderPath, file);
        return audioExtensions.includes(ext) && fs.statSync(filePath).isFile();
      } catch (err) {
        return false;
      }
    }).map(file => ({
      name: file,
      path: path.join(folderPath, file)
    }));

    return { videos, audios };
  } catch (error) {
    console.error('Error scanning folder:', error);
    throw new Error(`Failed to scan folder: ${error.message}`);
  }
});

// Process video - will be handled by videoProcessor
ipcMain.handle('video:process', async (event, options) => {
  const { processVideo } = require('./utils/videoProcessor');

  try {
    // Validate options
    if (!options || typeof options !== 'object') {
      throw new Error('Invalid processing options');
    }

    const required = ['bahanFolder', 'outputFolder', 'selectedVideo', 'audioFiles'];
    for (const field of required) {
      if (!options[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate folders exist
    if (!fs.existsSync(options.bahanFolder)) {
      throw new Error('Source folder does not exist');
    }

    if (!fs.existsSync(options.outputFolder)) {
      throw new Error('Output folder does not exist');
    }

    // Send log to renderer
    const sendLog = (level, message) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('log:message', { level, message });
      }
    };

    // Send progress to renderer
    const sendProgress = (percent, text) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('progress:update', { percent, text });
      }
    };

    const result = await processVideo(options, sendLog, sendProgress);
    return result;
  } catch (error) {
    console.error('Video processing error:', error);
    throw new Error(`Processing failed: ${error.message}`);
  }
});

// Abort video processing
ipcMain.handle('video:abort', async () => {
  const { abortAllProcesses } = require('./utils/videoProcessor');
  try {
    abortAllProcesses();
    return { success: true };
  } catch (error) {
    console.error('Error aborting:', error);
    return { success: false, error: error.message };
  }
});

// Send log from main process
function sendLog(level, message) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('log:message', { level, message });
  }
}

