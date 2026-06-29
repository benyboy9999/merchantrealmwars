import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import NavBar from './components/NavBar.js';
import KingdomPage from './pages/KingdomPage.js';
import RealmPage from './pages/RealmPage.js';
import BuildingPage from './pages/BuildingPage.js';
import ExchangePage from './pages/ExchangePage.js';
import ChatPage from './pages/ChatPage.js';
import AdminPage from './pages/AdminPage.js';
import EncyclopediaPage from './pages/EncyclopediaPage.js';
import LoginPage from './pages/LoginPage.js';
import CreateEmpirePage from './pages/CreateEmpirePage.js';
import { useAuthStore } from './stores/auth.js';
import { useServerStatus } from './stores/server-status.js';
import { useGameSocket } from './hooks/useGameSocket.js';

function ReconnectOverlay() {
  const { isDown, markOnline } = useServerStatus();
  const qc = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isDown) return;

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/health', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          markOnline();
          void qc.invalidateQueries();
        }
      } catch {
        // still down — keep polling
      }
    }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isDown, markOnline, qc]);

  if (!isDown) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
      <div className="text-center space-y-3">
        <div className="text-slate-100 text-xl font-semibold">Server offline</div>
        <div className="text-slate-400 text-sm">Waiting for server to come back up…</div>
        <div className="flex justify-center gap-1 pt-1">
          <span className="w-2 h-2 rounded-full bg-slate-600 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-slate-600 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-slate-600 animate-bounce" />
        </div>
      </div>
    </div>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="max-w-7xl mx-auto px-4 py-6">{children}</div>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireEmpire({ children }: { children: React.ReactNode }) {
  const empireId = useAuthStore((s) => s.empireId);
  if (!empireId) return <Navigate to="/create-empire" replace />;
  return <>{children}</>;
}

export default function App() {
  useGameSocket();

  return (
    <>
      <ReconnectOverlay />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/create-empire" element={
          <RequireAuth><CreateEmpirePage /></RequireAuth>
        } />
        <Route path="/*" element={
          <RequireAuth>
            <RequireEmpire>
              <div className="min-h-screen bg-slate-950 text-slate-100">
                <NavBar />
                <main>
                  <Routes>
                    <Route path="/"                                               element={<Navigate to="/kingdom" replace />} />
                    <Route path="/kingdom"                                        element={<Page><KingdomPage /></Page>} />
                    <Route path="/kingdom/:keepId"                                element={<Page><KingdomPage /></Page>} />
                    <Route path="/kingdom/:keepId/:tab"                          element={<Page><KingdomPage /></Page>} />
                    <Route path="/kingdom/:keepId/buildings/:buildingId"          element={<Page><BuildingPage /></Page>} />
                    <Route path="/realm"                                          element={<RealmPage />} />
                    <Route path="/chat"                                           element={<Page><ChatPage /></Page>} />
                    <Route path="/exchange"                                       element={<Page><ExchangePage /></Page>} />
                    <Route path="/admin"                                          element={<Page><AdminPage /></Page>} />
                    <Route path="/encyclopedia"                                   element={<Page><EncyclopediaPage /></Page>} />
                  </Routes>
                </main>
              </div>
            </RequireEmpire>
          </RequireAuth>
        } />
      </Routes>
    </>
  );
}
