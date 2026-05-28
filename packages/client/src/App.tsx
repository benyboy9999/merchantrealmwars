import { Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar.js';
import MapPage from './pages/MapPage.js';
import KeepPage from './pages/KeepPage.js';
import BuildingPage from './pages/BuildingPage.js';
import ExchangePage from './pages/ExchangePage.js';
import AdminPage from './pages/AdminPage.js';
import CaravanPage from './pages/CaravanPage.js';

export default function App() {
  return (
    <div className="min-h-screen bg-stone-900">
      <NavBar />
      <main>
        <Routes>
          <Route path="/"                                           element={<MapPage />} />
          <Route path="/keeps/:id"                                  element={<KeepPage />} />
          <Route path="/keeps/:keepId/buildings/:buildingId"        element={<BuildingPage />} />
          <Route path="/exchange"                                   element={<ExchangePage />} />
          <Route path="/caravans"                                   element={<CaravanPage />} />
          <Route path="/admin"                                      element={<AdminPage />} />
        </Routes>
      </main>
    </div>
  );
}
