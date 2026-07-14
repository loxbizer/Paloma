// Préchargement Electron — expose une API minimale et sûre au jeu.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('xenostrike', {
  platform: process.platform,
  isElectron: true,
  quit: () => ipcRenderer.send('app:quit'),
  toggleFullscreen: () => ipcRenderer.send('app:fullscreen')
});
