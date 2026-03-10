const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridgeAPI', {
    getBridgeInfo: () => ipcRenderer.invoke('get-bridge-info'),
    printJob: (job) => ipcRenderer.invoke('print-job', job),
});
