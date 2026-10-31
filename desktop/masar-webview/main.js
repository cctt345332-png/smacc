const { app, BrowserWindow, BrowserView, Menu, shell, session } = require("electron");
const path = require("path");

const HOME_URL = "https://www.masa-erp.com/ar/landing";
const MASAR_ORIGIN = "https://www.masa-erp.com";
let mainWindow;
let view;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 650,
    show: false,
    title: "Masar ERP | مسار",
    icon: path.join(__dirname, "assets", "masar-icon.png"),
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  Menu.setApplicationMenu(null);
  view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: "persist:masar",
    },
  });
  mainWindow.setBrowserView(view);
  resizeView();
  view.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(MASAR_ORIGIN)) {
      view.webContents.loadURL(url);
    } else {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
  view.webContents.on("page-title-updated", (event, title) => {
    event.preventDefault();
    mainWindow.setTitle(title ? `${title} — Masar ERP` : "Masar ERP | مسار");
  });
  view.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    if (errorCode !== -3) {
      mainWindow.setTitle(`Masar ERP | تعذر الاتصال (${errorDescription})`);
    }
  });
  mainWindow.on("resize", resizeView);
  mainWindow.on("closed", () => { mainWindow = null; view = null; });
  view.webContents.loadURL(HOME_URL);
  mainWindow.once("ready-to-show", () => mainWindow.show());
}

function resizeView() {
  if (!mainWindow || !view) return;
  const [width, height] = mainWindow.getContentSize();
  view.setBounds({ x: 0, y: 0, width, height });
  view.setAutoResize({ width: true, height: true });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(["notifications", "clipboard-read", "clipboard-sanitized-write"].includes(permission));
  });
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
