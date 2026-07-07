const { app, BrowserWindow, protocol, net, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow = null;

function getDistPath() {
  return path.join(__dirname, "../dist");
}

function setupAutoUpdater() {
  autoUpdater.on("update-available", (info) => {
    mainWindow.webContents.send("update-status", {
      type: "available",
      version: info.version,
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    mainWindow.webContents.send("update-status", {
      type: "progress",
      percent: Math.floor(progress.percent),
    });
  });

  autoUpdater.on("update-downloaded", () => {
    mainWindow.webContents.send("update-status", { type: "downloaded" });
  });

  autoUpdater.on("error", (err) => {
    console.error("更新出错:", err.message);
  });

  autoUpdater.checkForUpdates();
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: "教务办·智能体",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) {
    const devUrl = "http://localhost:5173";
    try {
      await mainWindow.loadURL(devUrl);
    } catch {
      mainWindow.loadURL("app://index.html");
    }
  } else {
    mainWindow.loadURL("app://index.html");
    setupAutoUpdater();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  protocol.handle("app", (request) => {
    let urlPath = request.url.slice("app://".length).replace(/\/$/, "");
    // 修复 Windows 上 index.html 内相对路径 ./assets/... 可能被解析到 index.html/ 下
    urlPath = urlPath.replace(/^index\.html\//, "");
    const filePath = path.join(getDistPath(), urlPath || "index.html");
    const fileUrl = `file:///${filePath.replace(/\\/g, "/")}`;
    return net.fetch(fileUrl);
  });

  ipcMain.handle("check-for-updates", () => autoUpdater.checkForUpdates());
  ipcMain.handle("download-update", () => autoUpdater.downloadUpdate());
  ipcMain.handle("quit-and-install", () => autoUpdater.quitAndInstall());

  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
