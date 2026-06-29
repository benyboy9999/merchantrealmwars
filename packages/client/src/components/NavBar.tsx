import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';

const settingsItems = [
  { to: '/encyclopedia', label: 'Encyclopedia' },
];

const navLinks = [
  { to: '/realm',    label: 'Realm'    },
  { to: '/exchange', label: 'Exchange' },
  { to: '/admin',    label: 'Admin'    },
];

export default function NavBar() {
  const { pathname } = useLocation();
  const navigate     = useNavigate();
  const qc           = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const empireName = useAuthStore((s) => s.empireName);
  const logout     = useAuthStore((s) => s.logout);

  async function handleLogout() {
    await api.logout().catch(() => null);
    logout();
    qc.clear();
    navigate('/login', { replace: true });
  }

  const { data } = useQuery({
    queryKey: ['admin-status'],
    queryFn:  api.adminStatus,
  });

  function kingdomHref(): string {
    const cached = qc.getQueryData<{ empire: { keeps: Array<{ id: string }> } }>(['empire']);
    const firstId = cached?.empire.keeps[0]?.id;
    return firstId ? `/kingdom/${firstId}` : '/kingdom';
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function isActive(to: string) {
    return pathname === to || pathname.startsWith(to);
  }

  return (
    <nav className="bg-slate-900 border-b border-slate-700/50 px-5 h-12 flex items-center gap-1">
      {/* Brand */}
      <span className="text-azure-400 font-bold tracking-widest text-xs mr-4 select-none">
        MERCHANT REALMS
      </span>

      {/* Kingdom — resolved to first keep when cached */}
      <button
        onClick={() => navigate(kingdomHref())}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
          pathname.startsWith('/kingdom')
            ? 'text-slate-100 bg-slate-800'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
      >
        Kingdom
      </button>

      {navLinks.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            isActive(to)
              ? 'text-slate-100 bg-slate-800'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          {label}
        </Link>
      ))}

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3">
        {/* Gold balance */}
        <div className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/40">
          <span className="text-gold-400 text-xs">◈</span>
          <span className="text-gold-400 font-mono tabular-nums text-xs font-semibold">
            {(data?.goldBalance ?? 0).toLocaleString()}
          </span>
        </div>

        {/* Settings dropdown */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setSettingsOpen(o => !o)}
            className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors ${
              settingsOpen || isActive('/encyclopedia')
                ? 'text-slate-100 bg-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            aria-label="Settings"
          >
            ⚙
          </button>

          {settingsOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-50">
              {settingsItems.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setSettingsOpen(false)}
                  className={`flex items-center px-3 py-2 text-sm transition-colors ${
                    isActive(to)
                      ? 'text-slate-100 bg-slate-800'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  {label}
                </Link>
              ))}
              <div className="border-t border-slate-700/60 mt-1 pt-1">
                <div className="px-3 py-1.5 text-xs text-slate-500 truncate">{empireName}</div>
                <button
                  onClick={() => { setSettingsOpen(false); void handleLogout(); }}
                  className="flex w-full items-center px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-red-400 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
