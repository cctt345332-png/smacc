/**
 * POS Store — حالة التطبيق
 * يحفظ في electron-store (عبر IPC) + localStorage كـ fallback
 */
import { create } from "zustand";

const STORAGE_KEY = "masar-pos-config";

// helper
const isElectron = () =>
  typeof window !== "undefined" && !!(window as any).electronAPI;

// قراءة من localStorage
function readLocal(): Record<string, any> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// كتابة في localStorage
function writeLocal(data: Record<string, any>) {
  try {
    const current = readLocal();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...data }));
  } catch {}
}

interface POSUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  tenant_id: string;
  tenant_name?: string;
}

interface POSState {
  serverUrl: string;
  token: string | null;
  user: POSUser | null;
  terminalId: string | null;
  isReady: boolean;
  isOnline: boolean;

  setServerUrl: (url: string) => Promise<void>;
  setAuth: (token: string, user: POSUser) => Promise<void>;
  setTerminalId: (id: string) => Promise<void>;
  logout: () => Promise<void>;
  setOnline: (v: boolean) => void;
  loadFromElectron: () => Promise<void>;
}

export const usePOSStore = create<POSState>((set) => ({
  serverUrl: "",
  token: null,
  user: null,
  terminalId: null,
  isReady: false,
  isOnline: true,

  setServerUrl: async (url) => {
    set({ serverUrl: url });
    writeLocal({ serverUrl: url });
    if (isElectron()) {
      await (window as any).electronAPI.saveConfig({ serverUrl: url });
    }
  },

  setAuth: async (token, user) => {
    set({ token, user });
    writeLocal({ token, user });
    if (isElectron()) {
      await (window as any).electronAPI.saveConfig({ token, user });
    }
  },

  setTerminalId: async (id) => {
    set({ terminalId: id });
    writeLocal({ terminalId: id });
    if (isElectron()) {
      await (window as any).electronAPI.saveConfig({ terminalId: id });
    }
  },

  logout: async () => {
    set({ token: null, user: null, terminalId: null });
    writeLocal({ token: null, user: null, terminalId: null });
    if (isElectron()) {
      await (window as any).electronAPI.clearAuth();
    }
  },

  setOnline: (v) => set({ isOnline: v }),

  loadFromElectron: async () => {
    if (isElectron()) {
      const config = await (window as any).electronAPI.getConfig();
      set({
        serverUrl: config.serverUrl || "",
        token: config.token || null,
        user: config.user || null,
        terminalId: config.terminalId || null,
        isReady: true,
      });
    } else {
      // fallback من localStorage
      const config = readLocal();
      set({
        serverUrl: config.serverUrl || "",
        token: config.token || null,
        user: config.user || null,
        terminalId: config.terminalId || null,
        isReady: true,
      });
    }
  },
}));
