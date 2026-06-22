import { create } from 'zustand';

interface ServerStatusState {
  isDown: boolean;
  markDown: () => void;
  markOnline: () => void;
}

// Only flip to offline after 3 consecutive failures within a short window.
// A single slow request or brief proxy hiccup shouldn't show the overlay.
let failureCount = 0;
let failureTimer: ReturnType<typeof setTimeout> | null = null;

export const useServerStatus = create<ServerStatusState>((set) => ({
  isDown: false,

  markDown: () => {
    failureCount++;
    if (failureTimer) clearTimeout(failureTimer);
    failureTimer = setTimeout(() => { failureCount = 0; }, 5000);
    if (failureCount >= 3) {
      set({ isDown: true });
    }
  },

  markOnline: () => {
    failureCount = 0;
    if (failureTimer) clearTimeout(failureTimer);
    set({ isDown: false });
  },
}));
