import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  empireId: number | null;
  empireName: string | null;

  setAuth: (token: string, refreshToken: string, empireId: number | null, empireName: string | null) => void;
  setTokens: (token: string, refreshToken: string) => void;
  setEmpire: (empireId: number, empireName: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      empireId: null,
      empireName: null,

      setAuth:   (token, refreshToken, empireId, empireName) => set({ token, refreshToken, empireId, empireName }),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      setEmpire: (empireId, empireName) => set({ empireId, empireName }),
      logout:    () => set({ token: null, refreshToken: null, empireId: null, empireName: null }),
    }),
    { name: 'mr-auth' },
  ),
);
