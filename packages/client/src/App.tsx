import { Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar.js';
import KingdomPage from './pages/KingdomPage.js';
import RealmPage from './pages/RealmPage.js';
import BuildingPage from './pages/BuildingPage.js';
import ExchangePage from './pages/ExchangePage.js';
import AdminPage from './pages/AdminPage.js';
import EncyclopediaPage from './pages/EncyclopediaPage.js';

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <NavBar />
      <main>
        <Routes>
          <Route path="/"                                                    element={<Navigate to="/kingdom" replace />} />
          <Route path="/kingdom"                                             element={<KingdomPage />} />
          <Route path="/kingdom/:keepId"                                     element={<KingdomPage />} />
          <Route path="/kingdom/:keepId/:tab"                                element={<KingdomPage />} />
          <Route path="/kingdom/:keepId/buildings/:buildingId"               element={<BuildingPage />} />
          <Route path="/realm"                                               element={<RealmPage />} />
          <Route path="/exchange"                                            element={<ExchangePage />} />
          <Route path="/admin"                                               element={<AdminPage />} />
          <Route path="/encyclopedia"                                        element={<EncyclopediaPage />} />
        </Routes>
      </main>
    </div>
  );
}
