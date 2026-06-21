import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  playerId: string | null;
  username: string | null;
  empireId: string | null;

  setAuth: (token: string, playerId: string, username: string, empireId: string | null) => void;
  setEmpireId: (empireId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      playerId: null,
      username: null,
      empireId: null,

      setAuth: (token, playerId, username, empireId) =>
        set({ token, playerId, username, empireId }),

      setEmpireId: (empireId) => set({ empireId }),

      logout: () => set({ token: null, playerId: null, username: null, empireId: null }),
    }),
    { name: 'mr-auth' },
  ),
);
