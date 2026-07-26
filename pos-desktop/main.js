/**
 * Electron Main Process — Masar POS
 * يفتح ملفات HTML المبنية مباشرة (static export) — لا يحتاج server
 */

const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

// ── تخزين محلي بسيط باستخدام JSON ────────────────────────────────────
function getConfigPath() {
  return path.join(app.getPath("userData"), "masar-pos-config.json");
}

const DEFAULTS = {
  serverUrl: "",
  token: null,
  user: null,
  terminalId: null,
  windowBounds: { width: 1280, height: 800 },
};

const store = {
  _data: null,
  _load() {
    if (this._data) return;
    try {
      const raw = fs.readFileSync(getConfigPath(), "utf8");
      this._data = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      this._data = { ...DEFAULTS };
    }
  },
  _save() {
    try {
      fs.writeFileSync(getConfigPath(), JSON.stringify(this._data, null, 2), "utf8");
    } catch (e) {
      console.error("Config save error:", e);
    }
  },
  get(key) {
    this._load();
    return this._data[key];
  },
  set(key, value) {
    this._load();
    this._data[key] = value;
    this._save();
  },
  setMany(obj) {
    this._load();
    Object.assign(this._data, obj);
    this._save();
  },
};

let mainWindow = null;
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

// ── مسار ملفات الـ static export ─────────────────────────────────────
function getOutPath() {
  if (isDev) {
    return path.join(__dirname, "../out");
  }
  // في الـ production — الملفات داخل resources/app.asar/out
  return path.join(__dirname, "../out");
}

// ── إنشاء النافذة الرئيسية ────────────────────────────────────────────
function createWindow() {
  const bounds = store.get("windowBounds") || { width: 1280, height: 800 };

  mainWindow = new BrowserWindow({
    width: bounds.width || 1280,
    height: bounds.height || 800,
    minWidth: 1024,
    minHeight: 700,
    title: "Masar POS",
    icon: path.join(__dirname, "../public/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: true,
    backgroundColor: "#F8FAFC",
  });

  // حفظ حجم النافذة
  mainWindow.on("resize", () => {
    const [width, height] = mainWindow.getSize();
    store.set("windowBounds", { width, height });
  });

  // فتح الروابط الخارجية في المتصفح
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    // وضع التطوير — Next.js dev server يشتغل على 3001
    mainWindow.loadURL("http://localhost:3001/ar/pos-app");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    // وضع الـ production — نفتح ملف HTML مباشرة
    const indexPath = path.join(getOutPath(), "ar", "pos-app", "index.html");
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── IPC Handlers ──────────────────────────────────────────────────────

ipcMain.handle("get-config", () => ({
  serverUrl: store.get("serverUrl"),
  token: store.get("token"),
  user: store.get("user"),
  terminalId: store.get("terminalId"),
}));

ipcMain.handle("save-config", (_, config) => {
  store.setMany(config);
  return true;
});

ipcMain.handle("clear-auth", () => {
  store.setMany({ token: null, user: null, terminalId: null });
  return true;
});

ipcMain.handle("print-receipt", () => {
  if (mainWindow) {
    mainWindow.webContents.print(
      { silent: false, printBackground: true },
      (success, errorType) => {
        if (!success) console.error("Print failed:", errorType);
      }
    );
  }
  return true;
});

ipcMain.handle("get-printers", async () => {
  if (mainWindow) {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map((p) => ({ name: p.name, isDefault: p.isDefault }));
  }
  return [];
});

ipcMain.handle("restart-app", () => {
  app.relaunch();
  app.exit(0);
});

// ── App Events ────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
