import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SuperAdminState {
  token: string | null;
  user: { id: string; email: string; full_name: string; role: string } | null;
  _hasHydrated: boolean;
  setAuth: (token: string, user: SuperAdminState["user"]) => void;
  logout: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useSuperAdminStore = create<SuperAdminState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      _hasHydrated: false,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: "super-admin-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
