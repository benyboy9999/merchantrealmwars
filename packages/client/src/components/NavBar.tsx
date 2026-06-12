import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api.js';

const links = [
  { to: '/kingdom',  label: 'Kingdom'  },
  { to: '/realm',    label: 'Realm'    },
  { to: '/exchange', label: 'Exchange' },
  { to: '/admin',    label: 'Admin'    },
];

export default function NavBar() {
  const { pathname } = useLocation();
  const { data } = useQuery({
    queryKey: ['admin-status'],
    queryFn:  api.adminStatus,
    refetchInterval: 10000,
  });

  return (
    <nav className="bg-stone-900 border-b border-stone-700 px-6 h-12 flex items-center gap-6">
      <span className="text-gold-400 font-bold tracking-wider text-sm mr-2">MERCHANT REALMS</span>
      {links.map(({ to, label }) => (
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
      <div className="ml-auto flex items-center gap-1.5 text-sm">
        <span className="text-stone-500 text-xs">Gold</span>
        <span className="text-gold-400 font-mono tabular-nums">
          {(data?.goldBalance ?? 0).toLocaleString()}g
        </span>
      </div>
    </nav>
  );
}
