const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-version'),
  getRuntime: () => 'electron',
  checkLocalFileExists: (fileName) => ipcRenderer.invoke('check-local-file-exists', fileName),
  saveAndOpenLocalFile: (fileName, bytes) => ipcRenderer.invoke('save-and-open-local-file', { fileName, bytes }),
  openLocalFile: (fileName) => ipcRenderer.invoke('open-local-file', fileName),
  openLocalFileDir: (fileName) => ipcRenderer.invoke('open-local-file-dir', fileName),
  showNativeNotification: (title, body, options) => ipcRenderer.invoke('show-native-notification', { title, body, ...options }),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  focusWindow: () => ipcRenderer.invoke('focus-window')
});

