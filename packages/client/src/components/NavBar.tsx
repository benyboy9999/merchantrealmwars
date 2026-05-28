import { Link, useLocation } from 'react-router-dom';

const links = [
  { to: '/',         label: 'Map' },
  { to: '/exchange', label: 'Exchange' },
  { to: '/caravans', label: 'Caravans' },
  { to: '/admin',    label: '⚙ Admin' },
];

export default function NavBar() {
  const { pathname } = useLocation();
  return (
    <nav className="bg-stone-800 border-b border-stone-700 px-6 py-3 flex items-center gap-6">
      <span className="text-gold-400 font-bold text-lg mr-4">Artemis</span>
      {links.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          className={`text-sm font-medium transition-colors ${
            pathname === to || (to !== '/' && pathname.startsWith(to))
              ? 'text-gold-400'
              : 'text-parchment-200 hover:text-gold-400'
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
