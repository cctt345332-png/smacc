import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  user: { id: string; tenantId: string; role: string; fullName?: string } | null;
  plan: string;
  businessType: string;
  _hasHydrated: boolean;
  setAuth: (token: string, user: AuthState["user"]) => void;
  setPlanInfo: (plan: string, businessType: string) => void;
  logout: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      plan: "trial",
      businessType: "general",
      _hasHydrated: false,
      setAuth: (token, user) => set({ token, user }),
      setPlanInfo: (plan, businessType) => set({ plan, businessType }),
      logout: () => set({ token: null, user: null, plan: "trial", businessType: "general" }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: "erp-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
