import { Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import NavBar from './components/NavBar.js';
import KingdomPage from './pages/KingdomPage.js';
import RealmPage from './pages/RealmPage.js';
import BuildingPage from './pages/BuildingPage.js';
import ExchangePage from './pages/ExchangePage.js';
import AdminPage from './pages/AdminPage.js';
import EncyclopediaPage from './pages/EncyclopediaPage.js';
import LoginPage from './pages/LoginPage.js';
import CreateEmpirePage from './pages/CreateEmpirePage.js';
import { useAuthStore } from './stores/auth.js';

const GOOGLE_CLIENT_ID = import.meta.env['VITE_GOOGLE_CLIENT_ID'] as string;

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
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/create-empire" element={
          <RequireAuth><CreateEmpirePage /></RequireAuth>
        } />
        <Route path="/*" element={
          <RequireAuth>
            <RequireEmpire>
              <div className="min-h-screen bg-zinc-950 text-zinc-100">
                <NavBar />
                <main>
                  <Routes>
                    <Route path="/"                                               element={<Navigate to="/kingdom" replace />} />
                    <Route path="/kingdom"                                        element={<KingdomPage />} />
                    <Route path="/kingdom/:keepId"                                element={<KingdomPage />} />
                    <Route path="/kingdom/:keepId/:tab"                          element={<KingdomPage />} />
                    <Route path="/kingdom/:keepId/buildings/:buildingId"          element={<BuildingPage />} />
                    <Route path="/realm"                                          element={<RealmPage />} />
                    <Route path="/exchange"                                       element={<ExchangePage />} />
                    <Route path="/admin"                                          element={<AdminPage />} />
                    <Route path="/encyclopedia"                                   element={<EncyclopediaPage />} />
                  </Routes>
                </main>
              </div>
            </RequireEmpire>
          </RequireAuth>
        } />
      </Routes>
    </GoogleOAuthProvider>
  );
}
