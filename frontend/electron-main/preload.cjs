const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");

// 从 package.json 动态读取版本号，避免硬编码
let appVersion = "0.0.0";
try {
  const pkg = require(path.join(__dirname, "../package.json"));
  appVersion = pkg.version || "0.0.0";
} catch {
  appVersion = "0.0.0";
}

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  version: appVersion,

  onUpdateStatus: (callback) => {
    ipcRenderer.on("update-status", (_event, data) => callback(data));
  },

  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  quitAndInstall: () => ipcRenderer.invoke("quit-and-install"),
});
