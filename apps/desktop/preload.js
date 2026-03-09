const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridgeAPI', {
    getBridgeInfo: () => ipcRenderer.invoke('get-bridge-info'),
});
