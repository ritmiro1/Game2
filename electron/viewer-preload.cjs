const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld(
  'viewer',
  Object.freeze({
    info: () => ipcRenderer.invoke('lifeos:viewer-info'),
    input: (payload) => ipcRenderer.send('lifeos:viewer-input', payload),
  }),
);
