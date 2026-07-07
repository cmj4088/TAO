const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  version: "0.1.1",

  onUpdateStatus: (callback) => {
    ipcRenderer.on("update-status", (_event, data) => callback(data));
  },

  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  quitAndInstall: () => ipcRenderer.invoke("quit-and-install"),
});
