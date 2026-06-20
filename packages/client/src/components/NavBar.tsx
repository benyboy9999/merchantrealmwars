import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api.js';

const settingsItems = [
  { to: '/encyclopedia', label: 'Encyclopedia' },
];

export default function NavBar() {
  const { pathname } = useLocation();
  const navigate     = useNavigate();
  const qc           = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['admin-status'],
    queryFn:  api.adminStatus,
    refetchInterval: 10000,
  });

  // Resolve the best Kingdom URL: if we already know the first keep from cache,
  // link directly to it so KingdomPage can fire both requests in parallel
  // instead of waiting for /api/keeps before it can start /api/keeps/:id.
  function kingdomHref(): string {
    const cached = qc.getQueryData<{ keeps: Array<{ id: string }> }>(['keeps']);
    const firstId = cached?.keeps[0]?.id;
    if (firstId) return `/kingdom/${firstId}`;
    return '/kingdom';
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

  return (
    <nav className="bg-stone-900 border-b border-stone-700 px-6 h-12 flex items-center gap-6">
      <span className="text-gold-400 font-bold tracking-wider text-sm mr-2">MERCHANT REALMS</span>

      {/* Kingdom: resolve directly to first keep when cached — avoids the /api/keeps waterfall */}
      <button
        onClick={() => navigate(kingdomHref())}
        className={`text-sm transition-colors ${
          pathname.startsWith('/kingdom') ? 'text-parchment-100' : 'text-stone-400 hover:text-parchment-200'
        }`}
      >
        Kingdom
      </button>

      {[
        { to: '/realm',    label: 'Realm'    },
        { to: '/exchange', label: 'Exchange' },
        { to: '/admin',    label: 'Admin'    },
      ].map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          className={`text-sm transition-colors ${
            pathname === to || pathname.startsWith(to)
              ? 'text-parchment-100'
              : 'text-stone-400 hover:text-parchment-200'
          }`}
        >
          {label}
        </Link>
      ))}

      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-stone-500 text-xs">Gold</span>
          <span className="text-gold-400 font-mono tabular-nums">
            {(data?.goldBalance ?? 0).toLocaleString()}g
          </span>
        </div>

        {/* Settings dropdown */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setSettingsOpen(o => !o)}
            className={`text-sm transition-colors px-1 ${
              settingsOpen || pathname.startsWith('/encyclopedia')
                ? 'text-parchment-100'
                : 'text-stone-400 hover:text-parchment-200'
            }`}
            aria-label="Settings"
          >
            ⚙
          </button>

          {settingsOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-stone-900 border border-stone-700 rounded shadow-xl py-1 z-50">
              {settingsItems.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setSettingsOpen(false)}
                  className={`block px-4 py-2 text-sm transition-colors ${
                    pathname.startsWith(to)
                      ? 'text-parchment-100 bg-stone-800'
                      : 'text-stone-300 hover:bg-stone-800 hover:text-parchment-100'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
