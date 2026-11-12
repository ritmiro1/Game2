const { contextBridge, ipcRenderer } = require('electron');
const events = new Set(['browser-state', 'downloads', 'browser-shortcut', 'prepare-close']);
contextBridge.exposeInMainWorld(
  'lifeos',
  Object.freeze({
    invoke: (action, args = {}) => ipcRenderer.invoke('lifeos:invoke', action, args),
    on: (channel, callback) => {
      if (!events.has(channel)) throw new Error('Unknown event');
      const listener = (_event, data) => callback(data);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
  }),
);
