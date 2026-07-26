const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getConfig:    ()         => ipcRenderer.invoke("get-config"),
  saveConfig:   (config)   => ipcRenderer.invoke("save-config", config),
  openPOS:      (url)      => ipcRenderer.invoke("open-pos", url),
  printReceipt: ()         => ipcRenderer.invoke("print-receipt"),
  restartApp:   ()         => ipcRenderer.invoke("restart-app"),
  isElectron:   true,
});
