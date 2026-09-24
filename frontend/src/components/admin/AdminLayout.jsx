import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import CommandPalette from './CommandPalette';
import { IconChart, IconCommand, IconExternal, IconGrid, IconLog, IconMap, IconSettings, IconShield, IconUsers } from '../Icons';

const NAV = [
  ['/admin', 'Overview', IconGrid, true],
  ['/admin/users', 'Users', IconUsers],
  ['/admin/markets', 'Markets', IconMap],
  ['/admin/moderation', 'Moderation', IconShield],
  ['/admin/reports', 'Reports', IconChart],
  ['/admin/settings', 'Settings', IconSettings],
  ['/admin/audit', 'Audit log', IconLog],
];

// Dedicated admin shell: sidebar on desktop, scrolling tab strip on phones, and a Ctrl/⌘+K command palette.
export default function AdminLayout() {
  const { user } = useAuth();
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-who">
          <span className="admin-avatar" aria-hidden>
            {user?.name?.[0] || 'A'}
          </span>
          <span>
            <strong>{user?.name}</strong>
            <small>Administrator</small>
          </span>
        </div>
        <button className="admin-cmd" onClick={() => setPalette(true)}>
          <IconCommand width={18} height={18} /> Quick search <kbd>⌘K</kbd>
        </button>
        <nav className="admin-nav" aria-label="Admin">
          {NAV.map(([to, label, Icon, end]) => (
            <NavLink key={to} to={to} end={end}>
              <Icon width={20} height={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <Link className="admin-out" to="/">
          <IconExternal width={18} height={18} /> View public site
        </Link>
      </aside>
      <section className="admin-main">
        <Outlet />
      </section>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
