/**
 * Electron Main Process — Masar POS
 * يفتح الـ web app مباشرة من السيرفر
 * نفس تصميم الويب + نفس الأنشطة + نفس الفاتورة الحرارية
 */

const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

// ── تخزين محلي ───────────────────────────────────────────────────────
function getConfigPath() {
  return path.join(app.getPath("userData"), "masar-pos-config.json");
}

const DEFAULTS = {
  serverUrl: "",    // مثال: http://192.168.1.104:3000
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
    } catch (e) { console.error("Config save error:", e); }
  },
  get(key) { this._load(); return this._data[key]; },
  set(key, value) { this._load(); this._data[key] = value; this._save(); },
  setMany(obj) { this._load(); Object.assign(this._data, obj); this._save(); },
};

let mainWindow = null;
let setupWindow = null;

// ── نافذة الإعداد (Server URL) ────────────────────────────────────────
function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 500,
    height: 520,
    resizable: false,
    title: "Masar POS — إعداد الاتصال",
    icon: path.join(__dirname, "../public/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: true,
    backgroundColor: "#F8FAFC",
  });

  // صفحة الإعداد — HTML مضمّن
  const setupHTML = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>إعداد الاتصال</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #F8FAFC; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
  .card { background: white; border-radius: 20px; padding: 40px; width: 100%; max-width: 420px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .logo { text-align: center; margin-bottom: 28px; }
  .logo-icon { width: 64px; height: 64px; border-radius: 16px; background: #EFF6FF; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
  h1 { font-size: 20px; font-weight: 800; color: #0F172A; margin-bottom: 4px; }
  p { font-size: 13px; color: #64748B; }
  label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; margin-top: 16px; }
  input { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1.5px solid #E2E8F0; font-size: 14px; outline: none; direction: ltr; }
  input:focus { border-color: #2563EB; }
  .error { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #DC2626; margin-top: 12px; display: none; }
  .success { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #166534; margin-top: 12px; display: none; }
  .btns { display: flex; gap: 10px; margin-top: 20px; }
  button { flex: 1; padding: 11px 0; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; }
  .btn-test { background: white; border: 1.5px solid #E2E8F0; color: #374151; }
  .btn-next { background: #CBD5E1; color: white; }
  .btn-next.active { background: #2563EB; cursor: pointer; }
  .hint { margin-top: 16px; padding: 12px; background: #F8FAFC; border-radius: 8px; font-size: 12px; color: #64748B; line-height: 1.7; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <div class="logo-icon">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    </div>
    <h1>Masar POS</h1>
    <p>أدخل رابط سيرفر النظام الخاص بشركتك</p>
  </div>

  <label>رابط السيرفر (Frontend)</label>
  <input type="url" id="url" placeholder="http://192.168.1.100:3000" value="" />
  <div class="error" id="err"></div>
  <div class="success" id="ok"></div>

  <div class="btns">
    <button class="btn-test" onclick="testConn()">اختبار الاتصال</button>
    <button class="btn-next" id="nextBtn" onclick="saveAndOpen()" disabled>متابعة ←</button>
  </div>

  <div class="hint">
    <strong>مثال:</strong><br>
    http://192.168.1.100:3000<br>
    <small style="color:#94A3B8">ملاحظة: أدخل رابط الواجهة (port 3000) وليس الـ API</small><br>
    تواصل مع مدير النظام للحصول على الرابط الصحيح.
  </div>
</div>

<script>
  let connected = false;

  async function testConn() {
    const url = document.getElementById('url').value.trim().replace(/\\/$/, '');
    if (!url) { showErr('أدخل رابط السيرفر'); return; }

    showErr(''); showOk('');
    document.querySelector('.btn-test').textContent = 'جاري الاختبار...';

    try {
      // اختبر الـ frontend مباشرة
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (r.ok || r.status === 404 || r.status === 200) {
        connected = true;
        showOk('تم الاتصال بالسيرفر بنجاح');
        document.getElementById('nextBtn').disabled = false;
        document.getElementById('nextBtn').className = 'btn-next active';
      } else {
        showErr('السيرفر يرد لكن بخطأ. تحقق من الرابط.');
      }
    } catch(e) {
      showErr('تعذّر الاتصال. تحقق من الرابط واتصال الشبكة.');
    }
    document.querySelector('.btn-test').textContent = 'اختبار الاتصال';
  }

  function saveAndOpen() {
    if (!connected) return;
    const url = document.getElementById('url').value.trim().replace(/\\/$/, '');
    window.electronAPI.saveConfig({ serverUrl: url }).then(() => {
      window.electronAPI.openPOS(url);
    });
  }

  function showErr(msg) {
    const el = document.getElementById('err');
    el.textContent = msg; el.style.display = msg ? 'block' : 'none';
  }
  function showOk(msg) {
    const el = document.getElementById('ok');
    el.textContent = msg; el.style.display = msg ? 'block' : 'none';
  }

  // تحميل الـ URL المحفوظ
  window.electronAPI.getConfig().then(c => {
    if (c.serverUrl) document.getElementById('url').value = c.serverUrl;
  });

  document.getElementById('url').addEventListener('keydown', e => {
    if (e.key === 'Enter') testConn();
  });
</script>
</body>
</html>`;

  setupWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(setupHTML)}`);
  setupWindow.on("closed", () => { setupWindow = null; });
}

// ── نافذة الكاشير (الويب مباشرة) ─────────────────────────────────────
function createPOSWindow(serverUrl) {
  const bounds = store.get("windowBounds") || { width: 1280, height: 800 };

  mainWindow = new BrowserWindow({
    width: bounds.width || 1280,
    height: bounds.height || 800,
    minWidth: 1024,
    minHeight: 700,
    title: "Masar POS",
    icon: path.join(__dirname, "../public/icon.ico"),
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
      webSecurity: false,
    },
    frame: true,
    backgroundColor: "#F8FAFC",
  });

  mainWindow.on("resize", () => {
    const [width, height] = mainWindow.getSize();
    store.set("windowBounds", { width, height });
  });

  // افتح صفحة الكاشير من الويب مباشرة
  const posUrl = `${serverUrl}/ar/pos/cashier`;
  mainWindow.loadURL(posUrl);

  // راقب التنقل — إذا انتقل لغير POS بعد الدخول، أعده للكاشير
  mainWindow.webContents.on("did-navigate", (event, navUrl) => {
    if (
      navUrl.includes("/dashboard") ||
      (navUrl.includes("/ar/") && !navUrl.includes("/pos") && !navUrl.includes("/login"))
    ) {
      setTimeout(() => {
        mainWindow.loadURL(`${serverUrl}/ar/pos/cashier`);
      }, 300);
    }
  });

  // إذا فتح صفحة login، أضف redirect parameter
  mainWindow.webContents.on("did-navigate-in-page", (event, navUrl) => {
    if (navUrl.includes("/login") && !navUrl.includes("redirect")) {
      mainWindow.loadURL(`${serverUrl}/ar/login?redirect=/ar/pos/cashier`);
    }
  });

  // طباعة
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.control && input.key === "p") {
      mainWindow.webContents.print({ silent: false, printBackground: true });
      event.preventDefault();
    }
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ── IPC Handlers ──────────────────────────────────────────────────────
ipcMain.handle("get-config", () => ({
  serverUrl: store.get("serverUrl"),
}));

ipcMain.handle("save-config", (_, config) => {
  store.setMany(config);
  return true;
});

// فتح نافذة الكاشير وإغلاق الإعداد
ipcMain.handle("open-pos", (_, serverUrl) => {
  store.set("serverUrl", serverUrl);
  if (setupWindow) { setupWindow.close(); setupWindow = null; }
  createPOSWindow(serverUrl);
  return true;
});

ipcMain.handle("print-receipt", () => {
  if (mainWindow) {
    mainWindow.webContents.print({ silent: false, printBackground: true });
  }
  return true;
});

ipcMain.handle("restart-app", () => { app.relaunch(); app.exit(0); });

// ── App Events ────────────────────────────────────────────────────────
app.whenReady().then(() => {
  const serverUrl = store.get("serverUrl");
  if (serverUrl) {
    // سيرفر محفوظ — افتح الكاشير مباشرة
    createPOSWindow(serverUrl);
  } else {
    // أول مرة — افتح الإعداد
    createSetupWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const serverUrl = store.get("serverUrl");
    if (serverUrl) createPOSWindow(serverUrl);
    else createSetupWindow();
  }
});
