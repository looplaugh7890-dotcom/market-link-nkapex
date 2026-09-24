import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api';
import { IconSearch } from '../Icons';

const PAGES = [
  { title: 'Overview', subtitle: 'Dashboard and analytics', to: '/admin', type: 'page' },
  { title: 'Users', subtitle: 'Farmers and customers', to: '/admin/users', type: 'page' },
  { title: 'Pending farmer approvals', subtitle: 'Review new registrations', to: '/admin/users?status=pending', type: 'page' },
  { title: 'Markets', subtitle: 'Add or edit markets', to: '/admin/markets', type: 'page' },
  { title: 'Moderation', subtitle: 'Reviews and listings', to: '/admin/moderation', type: 'page' },
  { title: 'Reports', subtitle: 'Generate and export reports', to: '/admin/reports', type: 'page' },
  { title: 'Categories & announcements', subtitle: 'Master data and notices', to: '/admin/settings', type: 'page' },
  { title: 'Audit log', subtitle: 'Everything admins did', to: '/admin/audit', type: 'page' },
  { title: 'View public site', subtitle: 'Open the storefront', to: '/', type: 'page' },
];
const TYPE_LABEL = { page: 'Go to', farmer: 'Farmer', customer: 'Customer', market: 'Market', product: 'Product' };

// Ctrl/⌘ + K: jump to any admin page, or find a user, market or product by name.
export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [remote, setRemote] = useState([]);
  const [active, setActive] = useState(0);
  const input = useRef(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setRemote([]);
      setActive(0);
      setTimeout(() => input.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setRemote([]);
      return undefined;
    }
    let stale = false;
    const timer = setTimeout(() => adminApi.search(q.trim()).then((response) => !stale && setRemote(response.data.results || [])).catch(() => {}), 220);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [q]);

  const term = q.trim().toLowerCase();
  const pages = PAGES.filter((p) => !term || `${p.title} ${p.subtitle}`.toLowerCase().includes(term));
  const items = [...pages, ...remote];
  useEffect(() => setActive(0), [q, remote.length]);

  if (!open) return null;
  const go = (item) => {
    onClose();
    navigate(item.to);
  };
  const onKey = (event) => {
    if (event.key === 'Escape') onClose();
    if (event.key === 'ArrowDown') (event.preventDefault(), setActive((previousActive) => Math.min(previousActive + 1, items.length - 1)));
    if (event.key === 'ArrowUp') (event.preventDefault(), setActive((previousActive) => Math.max(previousActive - 1, 0)));
    if (event.key === 'Enter' && items[active]) go(items[active]);
  };

  return (
    <div className="modal-back palette-back" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette-input">
          <IconSearch width={20} height={20} />
          <input ref={input} autoFocus value={q} onChange={(event) => setQ(event.target.value)} onKeyDown={onKey} placeholder="Search pages, users, markets, products…" aria-label="Command palette search" />
          <kbd>Esc</kbd>
        </div>
        <ul className="palette-list" role="listbox">
          {items.map((it, index) => (
            <li key={`${it.type}${it.id || it.to}${index}`} role="option" aria-selected={index === active}>
              <button className={index === active ? 'on' : ''} onMouseEnter={() => setActive(index)} onClick={() => go(it)}>
                <span className={`pal-type pal-${it.type}`}>{TYPE_LABEL[it.type] || it.type}</span>
                <span className="pal-text">
                  <strong>{it.title}</strong>
                  <small>{it.subtitle}</small>
                </span>
                <span className="pal-go" aria-hidden>
                  ↵
                </span>
              </button>
            </li>
          ))}
          {!items.length && <li className="pal-empty">No matches for “{q}”.</li>}
        </ul>
        <div className="palette-foot">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
        </div>
      </div>
    </div>
  );
}
