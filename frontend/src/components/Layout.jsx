import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useFetch from '../hooks/useFetch';
import { categoriesApi, homeApi, imageUrl, marketsApi, searchApi } from '../services/api';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationsContext';
import Chatbot from './Chatbot';
import { DAYS, cap, farmerPath, marketPath, money, productPath } from '../utils';
import { IconBell, IconCart, IconChevron, IconClose, IconHeart, IconHome, IconMap, IconMenu, IconSearch, IconStore, IconUser } from './Icons';

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 40 40" width="38" height="38" aria-hidden>
      <rect width="40" height="40" rx="12" fill="#123524" />
      <path d="M20 31V19" stroke="#f7f2e8" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 21c0-5 3.5-8.5 9-8.5 0 5-3.5 8.5-9 8.5z" fill="#f2b632" />
      <path d="M20 24c0-4-3-7-8-7 0 4 3 7 8 7z" fill="#e2542b" />
    </svg>
  );
}

const LINKS = {
  guest: [
    ['/', 'Home'],
    ['/markets', 'Markets'],
    ['/products', 'Products'],
    ['/about', 'About'],
    ['/contact', 'Contact'],
  ],
  customer: [
    ['/', 'Home'],
    ['/markets', 'Markets'],
    ['/products', 'Products'],
    ['/orders', 'My Orders'],
    ['/favorites', 'Favorites'],
    ['/notifications', 'Alerts'],
    ['/about', 'About'],
    ['/contact', 'Contact'],
  ],
  farmer: [
    ['/farmer', 'Dashboard'],
    ['/farmer/products', 'My Products'],
    ['/farmer/orders', 'Orders'],
    ['/farmer/reviews', 'Reviews'],
    ['/farmer/profile', 'Profile'],
    ['/notifications', 'Alerts'],
  ],
  admin: [
    ['/admin', 'Dashboard'],
    ['/admin/users', 'Users'],
    ['/admin/markets', 'Markets'],
    ['/admin/moderation', 'Moderation'],
    ['/admin/reports', 'Reports'],
    ['/admin/settings', 'Settings'],
    ['/notifications', 'Alerts'],
  ],
};

const DESKTOP_HIDE = ['/favorites', '/notifications', '/about', '/contact'];

const RECENT_KEY = 'marketlink_recent_searches';
const readRecent = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
};
const saveRecent = (term) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([term, ...readRecent().filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, 5)));
  } catch {
    /* storage unavailable */
  }
};

// Wraps the letters the visitor typed in <mark> so it is obvious why a result matched.
function Mark({ text, q }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

// Search box with live, relevance-ranked suggestions (products, categories, growers, markets) from the first letter.
// Debounced (180ms) so typing does not fire a request per keystroke; recent searches show when the box is empty.
function SearchForm({ onDone, className = '', autoFocus = false }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [open, setOpen] = useState(autoFocus);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState(() => (autoFocus ? readRecent() : []));
  const box = useRef(null);
  const term = q.trim();

  useEffect(() => {
    if (!term) {
      setRes(null);
      return undefined;
    }
    let stale = false;
    const t = setTimeout(() => {
      searchApi
        .suggest(term)
        .then((r) => !stale && (setRes(r.data), setActive(-1)))
        .catch(() => !stale && setRes(null));
    }, 180);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [term]);

  useEffect(() => {
    const away = (e) => !box.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  // One flat list drives both the rendering order and the arrow-key navigation.
  const rows = [];
  if (term && res) {
    res.products.forEach((p) => rows.push({ kind: 'product', key: `p${p._id}`, to: productPath(p), p }));
    res.categories.forEach((c) => rows.push({ kind: 'category', key: `c${c._id}`, to: `/products?category=${c._id}`, label: c.name }));
    res.farmers.forEach((f) => rows.push({ kind: 'farmer', key: `f${f._id}`, to: farmerPath(f), label: f.name, sub: f.markets.join(' · ') }));
    res.markets.forEach((m) => rows.push({ kind: 'market', key: `m${m._id}`, to: marketPath(m), label: m.name, sub: m.address }));
  } else if (!term) {
    recent.forEach((r) => rows.push({ kind: 'recent', key: `r${r}`, to: `/products?search=${encodeURIComponent(r)}`, label: r }));
  }

  const finish = () => {
    setOpen(false);
    onDone?.();
  };
  const go = (to, remember) => {
    if (remember) saveRecent(remember);
    navigate(to);
    finish();
  };
  const submit = (e) => {
    e.preventDefault();
    if (active >= 0 && rows[active]) return go(rows[active].to, rows[active].kind === 'recent' ? rows[active].label : term || undefined);
    if (term) saveRecent(term);
    go(term ? `/products?search=${encodeURIComponent(term)}` : '/products');
  };
  const onKey = (e) => {
    if (!rows.length) return;
    if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => (a + 1) % rows.length));
    if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => (a <= 0 ? rows.length - 1 : a - 1)));
    if (e.key === 'Escape') setOpen(false);
  };

  const showList = open && (rows.length > 0 || (term && res));
  const GROUP = { product: 'Products', category: 'Categories', farmer: 'Growers', market: 'Markets', recent: 'Recent searches' };
  let last = '';

  return (
    <form className={`header-search ${className}`} role="search" onSubmit={submit} ref={box}>
      <IconSearch width={19} height={19} />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setRecent(readRecent());
          setOpen(true);
        }}
        onKeyDown={onKey}
        placeholder="Search fresh produce, growers, markets..."
        aria-label="Search products"
        autoFocus={autoFocus}
        aria-autocomplete="list"
        aria-expanded={!!showList}
        autoComplete="off"
      />
      <button aria-label="Search">Search</button>
      {showList && (
        <ul className="suggest" role="listbox">
          {rows.map((r, i) => {
            const head = r.kind !== last ? GROUP[r.kind] : null;
            last = r.kind;
            return (
              <li key={r.key} role="option" aria-selected={i === active}>
                {head && <span className="sg-group">{head}</span>}
                <Link to={r.to} className={i === active ? 'on' : ''} onClick={() => (r.kind === 'recent' ? saveRecent(r.label) : null) || finish()}>
                  {r.kind === 'product' ? (
                    <>
                      <span className="sg-img">{r.p.image ? <img src={imageUrl(r.p.image)} alt="" /> : r.p.name[0]}</span>
                      <span className="sg-text">
                        <strong>
                          <Mark text={r.p.name} q={term} />
                        </strong>
                        <small>
                          {r.p.category?.name} · {r.p.farmer?.farmerProfile?.stallName}
                        </small>
                      </span>
                      <span className="sg-price">{money(r.p.price)}</span>
                    </>
                  ) : (
                    <>
                      <span className={`sg-badge sg-${r.kind}`} aria-hidden>
                        {r.kind === 'category' ? '#' : r.kind === 'farmer' ? '★' : r.kind === 'market' ? '⌖' : '↺'}
                      </span>
                      <span className="sg-text">
                        <strong>{r.kind === 'recent' ? r.label : <Mark text={r.label} q={term} />}</strong>
                        {r.sub && <small>{r.sub}</small>}
                      </span>
                    </>
                  )}
                </Link>
              </li>
            );
          })}
          {term && res && !rows.length && <li className="sg-none">No matches for “{term}”. Try another spelling.</li>}
          {term && (
            <li className="sg-all">
              <Link to={`/products?search=${encodeURIComponent(term)}`} onClick={() => { saveRecent(term); finish(); }}>
                See all results for “{term}” →
              </Link>
            </li>
          )}
        </ul>
      )}
    </form>
  );
}

// Wide "shop" menu: photo tiles for every category with live counts, what just arrived, and quick pickup-day filters.
function MegaMenu({ home, guest, onClose, onEnter, onLeave }) {
  const tiles = new Map((home?.categoryTiles || []).map((t) => [t._id, t]));
  const cats = (home?.categories || [])
    .map((c) => ({ ...c, ...(tiles.get(c._id) || {}) }))
    .sort((a, b) => (b.count || 0) - (a.count || 0) || a.name.localeCompare(b.name));
  const newest = (home?.newest || []).slice(0, 3);
  return (
    <div className="mega" onMouseEnter={onEnter} onMouseLeave={onLeave} role="region" aria-label="Shop menu">
      <div className="container mega-inner">
        <div className="mega-main">
          <div className="mega-head">
            <span className="kicker dark">Shop by category</span>
            <Link to="/products" onClick={onClose} className="arrow-link">
              Browse all {home?.stats?.products ?? ''} products →
            </Link>
          </div>
          <div className="mega-grid">
            {cats.map((c) => (
              <Link key={c._id} to={`/products?category=${c._id}`} className="mega-cat" onClick={onClose}>
                <span className="mc-img" style={c.image ? { backgroundImage: `url(${imageUrl(c.image)})` } : undefined}>
                  {!c.image && c.name[0]}
                </span>
                <span className="mc-text">
                  <strong>{c.name}</strong>
                  <small>{c.count ? `${c.count} item${c.count === 1 ? '' : 's'} in stock` : 'Coming soon'}</small>
                </span>
                <span className="mc-go" aria-hidden>
                  →
                </span>
              </Link>
            ))}
            {!cats.length && Array.from({ length: 9 }).map((_, i) => <span key={i} className="skeleton" style={{ height: 84, borderRadius: 18 }} />)}
          </div>
        </div>

        <aside className="mega-side">
          <span className="kicker dark">Just in</span>
          <ul className="mega-new">
            {newest.map((p) => (
              <li key={p._id}>
                <Link to={productPath(p)} onClick={onClose}>
                  <span className="mc-img sm" style={p.image ? { backgroundImage: `url(${imageUrl(p.image)})` } : undefined}>
                    {!p.image && p.name[0]}
                  </span>
                  <span className="mc-text">
                    <strong>{p.name}</strong>
                    <small>{p.farmer?.farmerProfile?.stallName}</small>
                  </span>
                  <b>{money(p.price)}</b>
                </Link>
              </li>
            ))}
          </ul>

          <span className="kicker dark">Shop by pickup day</span>
          <div className="mega-days">
            {DAYS.map((d) => (
              <Link key={d} to={`/products?day=${d}`} onClick={onClose}>
                {cap(d.slice(0, 3))}
              </Link>
            ))}
          </div>

          {guest && (
            <Link to="/register?role=farmer" className="mega-sell" onClick={onClose}>
              <strong>Grow it? Sell it here.</strong>
              <span>Open your stall on MarketLink →</span>
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}

function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { unread } = useNotifications();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const home = useFetch(() => homeApi.get(), []);
  const categories = home.data?.categories || [];
  const hoverTimer = useRef(null);
  const headerRef = useRef(null);
  const [backTop, setBackTop] = useState(0);
  const openMega = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setBackTop(headerRef.current?.getBoundingClientRect().bottom || 0);
      setCatOpen(true);
    }, 90);
  };
  const closeMega = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setCatOpen(false), 200);
  };
  const role = user?.role || 'guest';
  const canShop = role === 'guest' || role === 'customer';
  const links = LINKS[role];
  const desktopLinks = role === 'admin' ? [] : role === 'customer' ? links.filter(([to]) => !DESKTOP_HIDE.includes(to)) : links;
  const close = () => {
    setOpen(false);
    setCatOpen(false);
    setSearchOpen(false);
  };

  useEffect(close, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open || searchOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open, searchOpen]);
  useEffect(() => {
    if (!catOpen && !open) return;
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [catOpen, open]);

  const handleLogout = () => {
    logout();
    close();
    navigate('/');
  };

  return (
    <>
      <header className="site-header" ref={headerRef}>
        <div className="topbar">
          <div className="container topbar-inner">
            <span>Fresh from local growers · Pickup at the market · Pay in person</span>
            <span className="topbar-links">
              <Link to="/markets">Find a market</Link>
              {!user && <Link to="/register?role=farmer">Sell on MarketLink</Link>}
              <Link to="/about">About</Link>
              <Link to="/contact">Contact</Link>
            </span>
          </div>
        </div>

        <div className="navbar">
          <div className="container navbar-inner">
            <Link to="/" className="brand" onClick={close}>
              <Logo />
              <span className="brand-word">
                Market<span>Link</span>
              </span>
            </Link>

            <nav className="nav-links" aria-label="Main">
              {desktopLinks.map(([to, label]) => (
                <NavLink key={to} to={to} end={['/', '/farmer', '/admin'].includes(to)}>
                  {label}
                  {to === '/notifications' && unread > 0 && <span className="badge">{unread}</span>}
                </NavLink>
              ))}
              {canShop && (
                <span className="cat-menu" onMouseEnter={openMega} onMouseLeave={closeMega}>
                  <button
                    className="cat-btn"
                    aria-expanded={catOpen}
                    aria-haspopup="true"
                    onClick={() => {
                      clearTimeout(hoverTimer.current);
                      setBackTop(headerRef.current?.getBoundingClientRect().bottom || 0);
                      setCatOpen((o) => !o);
                    }}
                  >
                    Categories <IconChevron width={16} height={16} />
                  </button>
                </span>
              )}
            </nav>

            {canShop && <SearchForm className="desk-only" />}

            <div className="header-actions">
              {role === 'customer' && (
                <>
                  <Link className="icon-btn" to="/favorites" aria-label="Favorites">
                    <IconHeart />
                  </Link>
                  <Link className="icon-btn" to="/notifications" aria-label={`Alerts${unread ? `, ${unread} unread` : ''}`}>
                    <IconBell />
                    {unread > 0 && <span className="dot-badge">{unread}</span>}
                  </Link>
                  <Link className="icon-btn" to="/cart" aria-label={`Cart, ${count} items`}>
                    <IconCart />
                    {count > 0 && <span className="dot-badge">{count}</span>}
                  </Link>
                </>
              )}
              <span className="auth-actions">
                {user ? (
                  <button className="btn btn-outline btn-sm" onClick={handleLogout}>
                    Logout ({user.name.split(' ')[0]})
                  </button>
                ) : (
                  <>
                    <Link className="btn btn-outline btn-sm" to="/login">
                      Login
                    </Link>
                    <Link className="btn btn-sm" to="/register">
                      Register
                    </Link>
                  </>
                )}
              </span>
              {canShop && (
                <button className="icon-btn search-toggle" aria-label="Search" onClick={() => setSearchOpen(true)}>
                  <IconSearch />
                </button>
              )}
              <button className="icon-btn nav-toggle" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
                <IconMenu />
              </button>
            </div>
          </div>
        </div>
        {catOpen && (
          <>
            <div className="mega-back" style={{ top: backTop }} onClick={() => setCatOpen(false)} />
            <MegaMenu home={home.data} guest={!user} onClose={() => setCatOpen(false)} onEnter={() => clearTimeout(hoverTimer.current)} onLeave={closeMega} />
          </>
        )}
      </header>

      {open && (
        <div className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="drawer-head">
            <Link to="/" className="brand" onClick={close}>
              <Logo />
              <span className="brand-word">
                Market<span>Link</span>
              </span>
            </Link>
            <button className="icon-btn" aria-label="Close menu" onClick={close}>
              <IconClose />
            </button>
          </div>
          {canShop && <SearchForm onDone={close} />}
          <nav className="drawer-links" aria-label="Menu">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={['/', '/farmer', '/admin'].includes(to)}>
                {label}
                {to === '/notifications' && unread > 0 && <span className="badge">{unread}</span>}
              </NavLink>
            ))}
          </nav>
          {canShop && categories.length > 0 && (
            <div className="drawer-cats">
              <h3>Shop by category</h3>
              <div className="chips">
                {categories.map((c) => (
                  <Link key={c._id} className="chip" to={`/products?category=${c._id}`}>
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="drawer-actions">
            {user ? (
              <button className="btn btn-block" onClick={handleLogout}>
                Logout ({user.name.split(' ')[0]})
              </button>
            ) : (
              <>
                <Link className="btn btn-block" to="/register">
                  Create free account
                </Link>
                <Link className="btn btn-outline btn-block" to="/login">
                  Login
                </Link>
                <Link className="drawer-sell" to="/register?role=farmer">
                  Sell as a grower →
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {searchOpen && (
        <div className="search-sheet" role="dialog" aria-modal="true" aria-label="Search">
          <div className="ss-top">
            <SearchForm autoFocus className="in-sheet" onDone={() => setSearchOpen(false)} />
            <button className="ss-cancel" onClick={() => setSearchOpen(false)}>
              Cancel
            </button>
          </div>
          <div className="ss-body">
            <span className="sg-group">Popular categories</span>
            <div className="chips">
              {categories.slice(0, 9).map((c) => (
                <Link key={c._id} className="chip" to={`/products?category=${c._id}`} onClick={() => setSearchOpen(false)}>
                  {c.name}
                </Link>
              ))}
            </div>
            <span className="sg-group">Pickup this week</span>
            <div className="chips">
              {DAYS.map((d) => (
                <Link key={d} className="chip" to={`/products?day=${d}`} onClick={() => setSearchOpen(false)}>
                  {cap(d)}
                </Link>
              ))}
            </div>
            <Link className="ss-map" to="/markets" onClick={() => setSearchOpen(false)}>
              <IconMap width={20} height={20} /> Find a market near you →
            </Link>
          </div>
        </div>
      )}

      {canShop && (
        <nav className="tabbar" aria-label="Quick navigation">
          <NavLink to="/" end>
            <IconHome />
            <span>Home</span>
          </NavLink>
          <NavLink to="/products">
            <IconStore />
            <span>Shop</span>
          </NavLink>
          <NavLink to="/markets">
            <IconMap />
            <span>Markets</span>
          </NavLink>
          {role === 'customer' ? (
            <NavLink to="/cart">
              <span className="tab-ico">
                <IconCart />
                {count > 0 && <span className="dot-badge">{count}</span>}
              </span>
              <span>Cart</span>
            </NavLink>
          ) : (
            <NavLink to="/login">
              <IconUser />
              <span>Login</span>
            </NavLink>
          )}
          <button onClick={() => setOpen(true)}>
            <IconMenu />
            <span>Menu</span>
          </button>
        </nav>
      )}
    </>
  );
}

function Footer() {
  const { user } = useAuth();
  const cats = useFetch(() => categoriesApi.list(), []);
  const markets = useFetch(() => marketsApi.list({ limit: 5 }), []);
  const categories = (cats.data?.categories || []).slice(0, 6);
  const marketList = (markets.data?.markets || []).slice(0, 5);
  return (
    <footer className="footer">
      <div className="footer-perks">
        <div className="container footer-perks-inner">
          {[
            ['🌾', 'Straight from farmers'],
            ['🕒', 'Choose your pickup slot'],
            ['💵', 'Pay in person'],
            ['📍', 'Markets near you'],
          ].map(([i, t]) => (
            <span key={t}>
              <span aria-hidden>{i}</span> {t}
            </span>
          ))}
        </div>
      </div>
      <div className="container footer-grid">
        <div>
          <p className="brand foot-brand">
            <Logo />
            <span className="brand-word">
              Market<span>Link</span>
            </span>
          </p>
          <p className="small foot-about">Farm fresh, just a click away. Discover local farmers markets, reserve produce and pick it up in person from the people who grew it.</p>
          <Link className="btn btn-sm btn-pill foot-cta" to={user ? '/products' : '/register'}>
            {user ? 'Shop now' : 'Create free account'}
          </Link>
        </div>
        <div>
          <h3>Shop by category</h3>
          <ul className="plain small">
            {categories.map((c) => (
              <li key={c._id}>
                <Link to={`/products?category=${c._id}`}>{c.name}</Link>
              </li>
            ))}
            <li>
              <Link to="/products">All products</Link>
            </li>
          </ul>
        </div>
        <div>
          <h3>Our markets</h3>
          <ul className="plain small">
            {marketList.map((m) => (
              <li key={m._id}>
                <Link to={marketPath(m)}>{m.name}</Link>
              </li>
            ))}
            <li>
              <Link to="/markets">All markets</Link>
            </li>
          </ul>
        </div>
        <div>
          <h3>Farmers</h3>
          <ul className="plain small">
            <li><Link to="/register?role=farmer">Sell on MarketLink</Link></li>
            <li><Link to="/login">Farmer login</Link></li>
            {user?.role === 'customer' && <li><Link to="/orders">My orders</Link></li>}
            {user?.role === 'customer' && <li><Link to="/favorites">Favorites</Link></li>}
          </ul>
        </div>
        <div>
          <h3>Company</h3>
          <ul className="plain small">
            <li><Link to="/about">About us</Link></li>
            <li><Link to="/contact">Contact us</Link></li>
          </ul>
        </div>
      </div>
      <div className="foot-mark" aria-hidden>
        MarketLink
      </div>
      <div className="footer-bottom-wrap">
        <div className="container footer-bottom">
          <span className="fb-copy">© {new Date().getFullYear()} MarketLink. Pickup only, no delivery. Payment is made in person.</span>
          <nav className="fb-links" aria-label="Footer">
            <Link to="/about">About</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/register?role=farmer">Sell on MarketLink</Link>
          </nav>
          <a
            className="to-top"
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Back to top <span aria-hidden>↑</span>
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();

  // Move focus to the page content on navigation and keep the tab title meaningful.
  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true });
    const t = setTimeout(() => {
      const h1 = document.querySelector('main h1')?.textContent;
      document.title = h1 ? `${h1} | MarketLink` : 'MarketLink - Farm Fresh Just a Click Away';
    }, 400);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <Navbar />
      <main id="main" tabIndex={-1} className={['/', '/login', '/register'].includes(pathname) || pathname.startsWith('/admin') ? 'main-full' : 'container main'}>
        <Suspense fallback={<p className="page-message">Loading...</p>}>
          <Outlet />
        </Suspense>
      </main>
      {!pathname.startsWith('/admin') && <Footer />}
      {!pathname.startsWith('/admin') && <Chatbot />}
    </>
  );
}
