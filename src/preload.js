const { contextBridge, ipcRenderer } = require('electron');

// Expose protected APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Folder selection
    selectFolder: (title) => ipcRenderer.invoke('dialog:selectFolder', title),

    // Media scanning
    scanFolder: (folderPath) => ipcRenderer.invoke('media:scanFolder', folderPath),

    // Video processing
    processVideo: (options) => ipcRenderer.invoke('video:process', options),

    // Log listener
    onLog: (callback) => {
        ipcRenderer.on('log:message', (event, data) => callback(data));
    },

    // Progress listener
    onProgress: (callback) => {
        ipcRenderer.on('progress:update', (event, data) => callback(data));
    },

    // Abort processing
    abortProcessing: () => ipcRenderer.invoke('video:abort'),

    // Remove log listener
    removeLogListener: () => {
        ipcRenderer.removeAllListeners('log:message');
    }
});

