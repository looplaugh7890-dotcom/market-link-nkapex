import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useFetch from '../hooks/useFetch';
import { farmersApi, productsApi, reviewsApi, imageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import { useToast } from '../context/ToastContext';
import { FavoriteButton, ProductCard, Stars, Status } from '../components/Common';
import { IconBasket, IconCash, IconClock, IconHeart, IconMap, IconShare, IconSprout, IconTagPrice, IconTrend } from '../components/Icons';
import { computeSlots } from '../slots';
import { cap, daysText, directionsLinks, farmerPath, harvestText, marketPath, money, productPath, tagLabel, timeAgo } from '../utils';

const MapView = lazy(() => import('../components/MapView'));

// ---------------------------------------------------------------- reviews (also used on farmer pages)
export function ReviewList({ params }) {
  const { data, loading, error } = useFetch(() => reviewsApi.list({ ...params, limit: 50 }), [JSON.stringify(params)]);
  if (loading || error) return <Status loading={loading} error={error} />;
  if (!data.reviews.length) return <p className="muted">No reviews yet.</p>;
  return (
    <div className="stack">
      {data.reviews.map((r) => (
        <article className="review-card" key={r._id}>
          <span className="who-avatar" aria-hidden>
            {r.customer?.name?.[0] || 'C'}
          </span>
          <div className="rc-body">
            <div className="between">
              <strong>
                {r.customer?.name || 'Customer'} <span className="verified">✓ Verified pickup</span>
              </strong>
              <Stars value={r.rating} />
            </div>
            {r.comment && <p>{r.comment}</p>}
            {r.reply?.text && (
              <p className="reply">
                <strong>Farmer reply:</strong> {r.reply.text}
              </p>
            )}
            <small className="muted">{timeAgo(r.createdAt)}</small>
          </div>
        </article>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- helpers
const prettyDay = (ymd) => new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
const ymdOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// First pickup date/slot that the backend would accept for this stall (same rules: days, windows, cut-off).
function nextPickup(fp) {
  if (!fp) return null;
  for (let i = 0; i < 21; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const date = ymdOf(d);
    const slots = computeSlots([fp], date);
    if (slots.length) {
      const first = new Date(`${date}T${slots[0].start}:00`).getTime();
      return { date, slots, orderBy: new Date(first - (fp.cutoffHours || 0) * 3600 * 1000) };
    }
  }
  return null;
}

const RECENT_KEY = 'marketlink_recent_products';
const readRecent = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
};

function useRecentlyViewed(p) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!p) return;
    const prev = readRecent();
    setList(prev.filter((x) => x._id !== p._id).slice(0, 6));
    try {
      const entry = { _id: p._id, slug: p.slug, name: p.name, image: p.image, price: p.price, unit: p.unit };
      localStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...prev.filter((x) => x._id !== p._id)].slice(0, 10)));
    } catch {
      /* storage unavailable */
    }
  }, [p?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  return list;
}

// Renders the map only when it scrolls into view, so the map library never slows the first paint.
function LazyMap({ points }) {
  const ref = useRef(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === 'undefined') {
      setShow(true);
      return undefined;
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setShow(true), io.disconnect()), { rootMargin: '300px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="pdp-map">
      {show ? (
        <Suspense fallback={<div className="skeleton" style={{ height: 320 }} />}>
          <MapView points={points} height={320} />
        </Suspense>
      ) : (
        <div className="skeleton" style={{ height: 320 }} />
      )}
    </div>
  );
}

function Gallery({ src, alt, badge, letter }) {
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <div className="pdp-gallery">
      <div
        className={`pdp-main ${src ? 'has-img' : 'noimg'}`}
        onMouseEnter={() => setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
        }}
        onClick={() => src && setOpen(true)}
        role={src ? 'button' : undefined}
        tabIndex={src ? 0 : undefined}
        onKeyDown={(e) => src && e.key === 'Enter' && setOpen(true)}
        aria-label={src ? 'Open larger photo' : undefined}
      >
        {src ? <img src={src} alt={alt} style={{ transformOrigin: origin }} className={zoom ? 'zoomed' : ''} /> : <span className="ph-letter">{letter}</span>}
        {badge && <span className={`pc-badge ${badge.tone}`}>{badge.text}</span>}
        {src && <span className="pdp-hint">Click to enlarge</span>}
      </div>
      {open && (
        <div className="modal-back lightbox" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Product photo">
          <img src={src} alt={alt} />
          <button className="lb-close" aria-label="Close photo">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function PdpSkeleton() {
  return (
    <div className="pdp" aria-hidden>
      <div className="skeleton" style={{ aspectRatio: '1 / 1', borderRadius: 30 }} />
      <div className="pdp-info">
        <div className="skeleton" style={{ height: 16, width: 110 }} />
        <div className="skeleton" style={{ height: 58, width: '80%' }} />
        <div className="skeleton" style={{ height: 22, width: 200 }} />
        <div className="skeleton" style={{ height: 64, borderRadius: 20 }} />
        <div className="skeleton" style={{ height: 52, width: 180 }} />
        <div className="skeleton" style={{ height: 96, borderRadius: 22 }} />
        <div className="skeleton" style={{ height: 56, borderRadius: 99 }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- page
export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const cart = useCart();
  const fav = useFavorites();
  const toast = useToast();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [barOn, setBarOn] = useState(false);
  const [section, setSection] = useState('overview');
  const buyRef = useRef(null);

  const { data, loading, error } = useFetch(() => productsApi.get(id), [id]);
  const p = data?.product;
  const insights = data?.insights;
  const farmerId = p?.farmer?._id;
  const farmerRes = useFetch(() => (farmerId ? farmersApi.get(farmerId) : Promise.resolve({ data: null })), [farmerId]);
  const catId = p?.category?._id;
  const similar = useFetch(() => (catId ? productsApi.list({ category: catId, limit: 9 }) : Promise.resolve({ data: null })), [catId]);
  const reviews = useFetch(() => (p?._id ? reviewsApi.list({ product: p._id, limit: 50 }) : Promise.resolve({ data: null })), [p?._id]);
  const recent = useRecentlyViewed(p);

  useEffect(() => {
    setQty(1);
    setAdded(false);
    window.scrollTo({ top: 0 });
  }, [id]);

  // Compact buy bar appears once the main buy box has scrolled out of view (desktop).
  useEffect(() => {
    const el = buyRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setBarOn(!e.isIntersecting && e.boundingClientRect.top < 0), { rootMargin: '-110px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [p?._id, buyRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Highlight the section chip that is currently on screen.
  useEffect(() => {
    if (!p) return undefined;
    const ids = ['overview', 'details', 'pickup', 'grower', 'reviews'];
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setSection(e.target.id)), { rootMargin: '-35% 0px -60% 0px' });
    ids.forEach((i) => document.getElementById(i) && io.observe(document.getElementById(i)));
    return () => io.disconnect();
  }, [p?._id, farmerRes.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const fp = farmerRes.data?.farmer?.farmerProfile || p?.farmer?.farmerProfile;
  const stall = fp?.stallName;
  const pickup = useMemo(() => nextPickup(fp), [fp]);
  const markets = fp?.markets?.filter((m) => m && typeof m === 'object') || [];
  const moreFromStall = (farmerRes.data?.products || []).filter((x) => x._id !== p?._id).slice(0, 4);
  const alike = (similar.data?.products || []).filter((x) => x._id !== p?._id && x.farmer?._id !== farmerId).slice(0, 4);
  const list = reviews.data?.reviews || [];

  // Old id links (and shared ids) redirect to the readable URL.
  useEffect(() => {
    if (p?.slug && id !== p.slug) navigate(`/products/${p.slug}`, { replace: true });
  }, [p?.slug, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: list.filter((r) => r.rating === n).length }));

  // Product structured data (Google rich results) + a descriptive tab title.
  useEffect(() => {
    if (!p) return undefined;
    document.title = `${p.name} from ${stall || 'a local grower'} | MarketLink`;
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      description: p.description || `${p.name} from ${stall || 'a local grower'}`,
      image: p.image ? [imageUrl(p.image)] : undefined,
      category: p.category?.name,
      offers: { '@type': 'Offer', price: p.price, priceCurrency: 'USD', availability: p.status === 'available' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
      ...(p.ratingCount ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.ratingAvg, reviewCount: p.ratingCount } } : {}),
    };
    const el = Object.assign(document.createElement('script'), { type: 'application/ld+json', textContent: JSON.stringify(ld) });
    document.head.appendChild(el);
    return () => el.remove();
  }, [p, stall]);

  if (loading) return <PdpSkeleton />;
  if (error) return <Status loading={false} error={error} />;

  const img = imageUrl(p.image);
  const inStock = p.status === 'available';
  const left = p.quantityAvailable;
  const isCustomer = user?.role === 'customer';
  const inCart = cart.items.find((i) => i.product._id === p._id)?.quantity || 0;
  const maxQty = Math.max(1, left - inCart);
  const isNew = Date.now() - new Date(p.createdAt).getTime() < 7 * 24 * 3600 * 1000;
  const total = p.price * qty;
  const tplQty = p.weeklyTemplate?.enabled ? p.weeklyTemplate.quantity : 0;
  const stockPct = Math.min(100, Math.round((left / Math.max(tplQty || left, left, 1)) * 100));
  const lowStock = inStock && left <= 10;

  const line = () => ({ _id: p._id, name: p.name, price: p.price, unit: p.unit, image: p.image, slug: p.slug, farmerId: p.farmer._id, stallName: stall, max: left });
  const add = (goToCart) => {
    cart.addItem(line(), qty);
    if (goToCart) return navigate('/cart');
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
    toast(`${qty} × ${p.name} added to your cart`, { to: '/cart', label: 'View cart' });
    return undefined;
  };
  const presets = [1, 2, 3, 5, 10].filter((n) => n <= maxQty).slice(0, 4);
  // "Goes well with": add this product and its most-reserved companions in one tap.
  const together = insights?.together || [];
  const addAll = () => {
    cart.addItem(line(), qty);
    together.forEach((t) => cart.addItem({ _id: t._id, name: t.name, price: t.price, unit: t.unit, image: t.image, slug: t.slug, farmerId: p.farmer._id, stallName: stall, max: t.quantityAvailable }, 1));
    toast(`${1 + together.length} items added to your cart`, { to: '/cart', label: 'View cart' });
  };
  const bundleTotal = p.price * qty + together.reduce((n, t) => n + t.price, 0);
  const harvest = p.harvestedOn ? harvestText(p.harvestedOn) : null;
  const fresh = p.harvestedOn && Date.now() - new Date(p.harvestedOn).getTime() < 2.5 * 86400000;
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: p.name, text: `${p.name} from ${stall} on MarketLink`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied to clipboard');
      }
    } catch {
      /* share cancelled */
    }
  };
  const notifyMe = async () => {
    if (!user) return navigate('/login', { state: { from: productPath(p) } });
    if (!fav.has('products', p._id)) await fav.toggle('products', p._id);
    toast('We will alert you when it is back in stock');
  };

  const mapPoints = markets.map((m) => ({ id: m._id, lat: m.latitude, lng: m.longitude, title: m.name, subtitle: m.address }));

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link> / <Link to="/products">Products</Link>
        {p.category && (
          <>
            {' / '}
            <Link to={`/products?category=${p.category._id}`}>{p.category.name}</Link>
          </>
        )}
        {' / '}
        <span>{p.name}</span>
      </nav>

      <div className="pdp" id="overview">
        <Gallery src={img} alt={p.name} letter={p.name[0]} badge={!inStock ? { text: p.status === 'sold_out' ? 'Sold out' : 'Unavailable', tone: 'out' } : lowStock ? { text: `Only ${left} left`, tone: 'low' } : isNew ? { text: 'New this week', tone: 'new' } : null} />

        <div className="pdp-info">
          {p.category && (
            <Link className="pdp-cat" to={`/products?category=${p.category._id}`}>
              {p.category.name}
            </Link>
          )}
          <h1>{p.name}</h1>

          <div className="pdp-meta">
            <a href="#reviews" className="pdp-rating">
              <Stars value={p.ratingAvg} />
              <span>{p.ratingCount ? `${p.ratingAvg.toFixed(1)} · ${p.ratingCount} review${p.ratingCount === 1 ? '' : 's'}` : 'No reviews yet'}</span>
            </a>
            <span className="pdp-actions">
              <FavoriteButton type="products" id={p._id} />
              <button className="icon-btn" onClick={share} aria-label="Share this product">
                <IconShare />
              </button>
            </span>
          </div>

          {(harvest || p.tags?.length > 0) && (
            <div className="pdp-chips">
              {harvest && (
                <span className={`pdp-chip ${fresh ? 'fresh' : ''}`}>
                  <IconSprout width={16} height={16} /> {p.category?.name === 'Baked Goods' || p.category?.name === 'Dairy' ? 'Made' : 'Harvested'} {harvest}
                </span>
              )}
              {p.tags?.map((t) => (
                <span className="pdp-chip" key={t}>
                  {tagLabel(t)}
                </span>
              ))}
            </div>
          )}

          <Link to={farmerPath(p.farmer)} className="pdp-stall">
            <span className="who-avatar" aria-hidden>
              {stall?.[0]}
            </span>
            <span>
              <small>Grown and sold by</small>
              <strong>{stall}</strong>
            </span>
            {fp?.ratingCount > 0 && (
              <span className="pdp-stall-rate">
                ★ {fp.ratingAvg.toFixed(1)} <small>({fp.ratingCount})</small>
              </span>
            )}
            <span className="pdp-go" aria-hidden>
              →
            </span>
          </Link>

          <div className="pdp-price">
            <strong>{money(p.price)}</strong>
            <span>per {p.unit}</span>
          </div>

          {(insights?.reserved || (insights?.price && insights.price.deltaPct < 3)) && (
            <ul className="pdp-proof">
              {insights.reserved && (
                <li className="hot">
                  <IconTrend width={18} height={18} />
                  <span>
                    <b>
                      {insights.reserved.qty} {p.unit}
                    </b>{' '}
                    reserved in the last 7 days · {insights.reserved.orders} order{insights.reserved.orders === 1 ? '' : 's'}
                  </span>
                </li>
              )}
              {insights.price && insights.price.deltaPct < 3 && (
                <li className={insights.price.deltaPct <= -3 ? 'good' : ''}>
                  <IconTagPrice width={18} height={18} />
                  <span>
                    {insights.price.deltaPct <= -3 ? (
                      <>
                        <b>{Math.abs(insights.price.deltaPct)}% below</b> the average for {p.category?.name} per {p.unit} ({money(insights.price.average)})
                      </>
                    ) : (
                      <>
                        <b>Fair price</b>: in line with the {money(insights.price.average)} / {p.unit} average for {p.category?.name}
                      </>
                    )}
                  </span>
                </li>
              )}
            </ul>
          )}

          {p.description && <p className="pdp-desc">{p.description}</p>}

          <div className={`pdp-stock ${inStock ? (lowStock ? 'low' : 'ok') : 'out'}`}>
            <div className="ps-top">
              <strong>{inStock ? `${left} ${p.unit} available` : p.status === 'sold_out' ? 'Sold out this week' : 'Temporarily unavailable'}</strong>
              {lowStock && <span>Order soon, it may sell out</span>}
            </div>
            {inStock && (
              <div className="hbar-track">
                <div className="hbar-fill" style={{ width: `${Math.max(6, stockPct)}%` }} />
              </div>
            )}
          </div>

          {pickup ? (
            <div className="pdp-pickup">
              <span className="pp-ico">
                <IconClock />
              </span>
              <div>
                <small>Next pickup you can choose</small>
                <strong>
                  {prettyDay(pickup.date)} · {pickup.slots[0].start}–{pickup.slots[pickup.slots.length - 1].end}
                </strong>
                {markets[0] && <span className="muted"> at {markets[0].name}</span>}
                <small className="pp-by">
                  Order by {pickup.orderBy.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}, {pickup.orderBy.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </small>
              </div>
            </div>
          ) : (
            <div className="pdp-pickup none">
              <span className="pp-ico">
                <IconClock />
              </span>
              <div>
                <small>Pickup</small>
                <strong>No pickup slot is open right now</strong>
                <small className="pp-by">This stall opens {daysText(fp?.operatingDays)}</small>
              </div>
            </div>
          )}

          {isCustomer && inStock && (
            <div className="buybox" ref={buyRef}>
              <div className="qty-row">
                <div className="qty-stepper" role="group" aria-label="Quantity">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity">
                  −
                </button>
                <input type="number" min="1" max={maxQty} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(Number(e.target.value) || 1, maxQty)))} aria-label="Quantity" />
                <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="Increase quantity">
                  +
                </button>
                </div>
                <div className="qty-presets" aria-label="Quick quantities">
                  {presets.map((n) => (
                    <button key={n} type="button" className={qty === n ? 'on' : ''} onClick={() => setQty(n)}>
                      {n} {p.unit}
                    </button>
                  ))}
                </div>
              </div>
              <button className={`btn btn-lg add-btn ${added ? 'added' : ''}`} onClick={() => add(false)} disabled={inCart >= left}>
                {added ? '✓ Added to cart' : `Add to cart · ${money(total)}`}
              </button>
              <button className="btn btn-outline btn-lg" onClick={() => add(true)} disabled={inCart >= left}>
                Reserve now
              </button>
              {inCart > 0 && (
                <p className="in-cart">
                  {inCart} {p.unit} already in your cart · <Link to="/cart">View cart</Link>
                </p>
              )}
            </div>
          )}
          {!user && inStock && (
            <div className="buybox guest">
              <button className="btn btn-lg" onClick={() => navigate('/login', { state: { from: productPath(p) } })}>
                Log in to reserve
              </button>
              <p className="muted small">
                New here? <Link to="/register">Create a free account</Link>. It takes under a minute.
              </p>
            </div>
          )}
          {!inStock && (
            <div className="buybox">
              <button className="btn btn-lg" onClick={notifyMe} disabled={fav.has('products', p._id)}>
                <IconHeart width={20} height={20} /> {fav.has('products', p._id) ? 'We will alert you' : 'Notify me when it is back'}
              </button>
              <Link className="btn btn-outline btn-lg" to={farmerPath(p.farmer)}>
                See what else {stall} has
              </Link>
            </div>
          )}
          {user && !isCustomer && <p className="alert alert-info">You are signed in as {user.role}. Only customers can place orders.</p>}

          <ul className="pdp-trust">
            <li>
              <span>
                <IconCash width={20} height={20} />
              </span>
              <div>
                <strong>Pay in person</strong>
                <small>No online payment. Settle at pickup.</small>
              </div>
            </li>
            <li>
              <span>
                <IconBasket width={20} height={20} />
              </span>
              <div>
                <strong>Straight from the grower</strong>
                <small>Reserved from {stall}&apos;s real stock.</small>
              </div>
            </li>
            <li>
              <span>
                <IconClock width={20} height={20} />
              </span>
              <div>
                <strong>Free changes</strong>
                <small>Modify or cancel until {fp?.cutoffHours ?? 0}h before pickup.</small>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {together.length > 0 && (
        <section className="pdp-bundle">
          <div className="bundle-head">
            <span className="kicker dark">Goes well with</span>
            <h2>Most often reserved together</h2>
            <p className="muted small">Other customers who reserved {p.name} also picked these from {stall}.</p>
          </div>
          <div className="bundle-items">
            <div className="bundle-card current">
              <span className="recent-img">{img ? <img src={img} alt="" /> : p.name[0]}</span>
              <strong>{p.name}</strong>
              <small>
                {qty} × {money(p.price)}
              </small>
            </div>
            {together.map((t) => (
              <div className="bundle-plus-wrap" key={t._id}>
                <span className="bundle-plus" aria-hidden>
                  +
                </span>
                <Link to={productPath(t)} className="bundle-card">
                  <span className="recent-img">{t.image ? <img src={imageUrl(t.image)} alt="" loading="lazy" /> : t.name[0]}</span>
                  <strong>{t.name}</strong>
                  <small>
                    1 × {money(t.price)} / {t.unit}
                  </small>
                </Link>
              </div>
            ))}
          </div>
          <div className="bundle-buy">
            <div>
              <small className="muted">Together</small>
              <strong>{money(bundleTotal)}</strong>
            </div>
            {isCustomer && inStock ? (
              <button className="btn btn-lg" onClick={addAll}>
                Add all {1 + together.length} to cart
              </button>
            ) : (
              <button className="btn btn-lg" onClick={() => (user ? null : navigate('/login', { state: { from: productPath(p) } }))} disabled={!!user}>
                {user ? 'Customers only' : 'Log in to reserve'}
              </button>
            )}
          </div>
        </section>
      )}

      <nav className="pdp-nav" aria-label="Page sections">
        {[
          ['overview', 'Overview'],
          ['details', 'Details'],
          ['pickup', 'Pickup'],
          ['grower', 'The grower'],
          ['reviews', `Reviews${p.ratingCount ? ` (${p.ratingCount})` : ''}`],
        ].map(([k, label]) => (
          <a key={k} href={`#${k}`} className={section === k ? 'on' : ''}>
            {label}
          </a>
        ))}
      </nav>

      <section className="pdp-section" id="details">
        <h2>Product details</h2>
        <dl className="pdp-facts">
          <div>
            <dt>Category</dt>
            <dd>{p.category?.name}</dd>
          </div>
          <div>
            <dt>Sold per</dt>
            <dd>{cap(p.unit)}</dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>
              {money(p.price)} / {p.unit}
            </dd>
          </div>
          <div>
            <dt>In stock</dt>
            <dd>{inStock ? `${left} ${p.unit}` : 'Not right now'}</dd>
          </div>
          <div>
            <dt>Stall open</dt>
            <dd>{daysText(fp?.operatingDays)}</dd>
          </div>
          <div>
            <dt>Pickup windows</dt>
            <dd>{fp?.pickupWindows?.length ? fp.pickupWindows.map((w) => `${cap(w.day.slice(0, 3))} ${w.start}–${w.end}`).join(' · ') : 'Flexible'}</dd>
          </div>
          <div>
            <dt>Order cut-off</dt>
            <dd>{fp?.cutoffHours ?? 0} hours before pickup</dd>
          </div>
          <div>
            <dt>Listed</dt>
            <dd>{timeAgo(p.createdAt)}</dd>
          </div>
          {harvest && (
            <div>
              <dt>{p.category?.name === 'Baked Goods' || p.category?.name === 'Dairy' ? 'Made' : 'Harvested'}</dt>
              <dd>{harvest}</dd>
            </div>
          )}
          {p.tags?.length > 0 && (
            <div>
              <dt>Good to know</dt>
              <dd>{p.tags.map(tagLabel).join(' · ')}</dd>
            </div>
          )}
        </dl>
        {p.storage && (
          <p className="pdp-storage">
            <b>Storage tip:</b> {p.storage}
          </p>
        )}
      </section>

      {markets.length > 0 && (
        <section className="pdp-section" id="pickup">
          <h2>Where to pick it up</h2>
          <div className="pdp-where">
            <ul className="pdp-markets">
              {markets.map((m) => {
                const dir = directionsLinks(m.latitude, m.longitude);
                return (
                  <li key={m._id}>
                    <span className="pp-ico">
                      <IconMap />
                    </span>
                    <div>
                      <Link to={marketPath(m)}>
                        <strong>{m.name}</strong>
                      </Link>
                      <small className="muted">{m.address}</small>
                      <span className="pdp-dir">
                        <a href={dir.osm} target="_blank" rel="noreferrer">
                          OpenStreetMap
                        </a>
                        <a href={dir.google} target="_blank" rel="noreferrer">
                          Google Maps
                        </a>
                      </span>
                    </div>
                  </li>
                );
              })}
              {fp?.location?.address && <li className="muted small">Stall location: {fp.location.address}</li>}
            </ul>
            <LazyMap points={mapPoints} />
          </div>
        </section>
      )}

      <section className="pdp-section" id="grower">
        <h2>Meet the grower</h2>
        <div className="grower-card">
          <span className="who-avatar big" aria-hidden>
            {stall?.[0]}
          </span>
          <div className="gc-body">
            <strong className="gc-name">{stall}</strong>
            <p className="muted">{fp?.description || `${stall} grows and sells fresh produce at local farmers markets and takes pre-orders here for pickup.`}</p>
            <ul className="gc-stats">
              <li>
                <b>{fp?.ratingCount ? `${fp.ratingAvg.toFixed(1)} ★` : 'New'}</b>
                <span>{fp?.ratingCount ? `${fp.ratingCount} review${fp.ratingCount === 1 ? '' : 's'}` : 'no reviews yet'}</span>
              </li>
              <li>
                <b>{(farmerRes.data?.products?.length ?? 0) || '–'}</b>
                <span>products in stock</span>
              </li>
              <li>
                <b>{markets.length || '–'}</b>
                <span>market{markets.length === 1 ? '' : 's'}</span>
              </li>
              <li>
                <b>{fp?.operatingDays?.length ? fp.operatingDays.map((d) => cap(d.slice(0, 3))).join(', ') : '–'}</b>
                <span>open days</span>
              </li>
            </ul>
          </div>
          <div className="gc-actions">
            <Link className="btn" to={farmerPath(p.farmer)}>
              Visit stall
            </Link>
            {isCustomer && (
              <button className="btn btn-outline" onClick={() => fav.toggle('farmers', p.farmer._id)}>
                <IconHeart width={18} height={18} /> {fav.has('farmers', p.farmer._id) ? 'Following' : 'Follow stall'}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="pdp-section" id="reviews">
        <h2>Customer reviews</h2>
        {list.length > 0 && (
          <div className="rating-summary ad-card">
            <div className="rs-avg">
              <strong>{p.ratingAvg.toFixed(1)}</strong>
              <Stars value={p.ratingAvg} />
              <span className="muted small">
                {p.ratingCount} review{p.ratingCount === 1 ? '' : 's'}
              </span>
            </div>
            <ul className="rs-bars">
              {dist.map((d) => (
                <li key={d.n}>
                  <span>{d.n} ★</span>
                  <div className="hbar-track">
                    <div className="hbar-fill" style={{ width: `${(d.c / list.length) * 100}%` }} />
                  </div>
                  <b>{d.c}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
        {reviews.data && !list.length && <p className="muted">No reviews yet. Reviews come only from customers who collected an order, so every one is genuine.</p>}
        <ReviewList params={{ product: p._id }} />
      </section>

      {moreFromStall.length > 0 && (
        <section className="pdp-section">
          <div className="between">
            <h2>More from {stall}</h2>
            <Link className="arrow-link" to={farmerPath(p.farmer)}>
              Visit stall →
            </Link>
          </div>
          <div className="grid grid-products">
            {moreFromStall.map((x) => (
              <ProductCard key={x._id} product={{ ...x, farmer: p.farmer }} />
            ))}
          </div>
        </section>
      )}

      {alike.length > 0 && (
        <section className="pdp-section">
          <h2>You may also like</h2>
          <div className="grid grid-products">
            {alike.map((x) => (
              <ProductCard key={x._id} product={x} />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="pdp-section">
          <h2>Recently viewed</h2>
          <div className="recent-row">
            {recent.map((x) => (
              <Link key={x._id} to={productPath(x)} className="recent-card">
                <span className="recent-img">{x.image ? <img src={imageUrl(x.image)} alt="" loading="lazy" /> : x.name[0]}</span>
                <strong>{x.name}</strong>
                <small>
                  {money(x.price)} / {x.unit}
                </small>
              </Link>
            ))}
          </div>
        </section>
      )}

      {barOn && (
        <div className="pdp-bar" role="region" aria-label="Quick purchase">
          <span className="recent-img">{img ? <img src={img} alt="" /> : p.name[0]}</span>
          <div className="pb-title">
            <strong>{p.name}</strong>
            <small>
              {money(p.price)} / {p.unit} · {stall}
            </small>
          </div>
          {isCustomer && inStock ? (
            <button className={`btn ${added ? 'added' : ''}`} onClick={() => add(false)} disabled={inCart >= left}>
              {added ? '✓ Added' : `Add ${qty} · ${money(total)}`}
            </button>
          ) : !user && inStock ? (
            <button className="btn" onClick={() => navigate('/login', { state: { from: productPath(p) } })}>
              Log in to reserve
            </button>
          ) : (
            <a className="btn btn-outline" href="#overview">
              Back to top
            </a>
          )}
        </div>
      )}

      {!user && inStock && (
        <div className="pdp-sticky">
          <div>
            <small>{p.name}</small>
            <strong>
              {money(p.price)} <span className="muted small">/ {p.unit}</span>
            </strong>
          </div>
          <button className="btn btn-lg" onClick={() => navigate('/login', { state: { from: productPath(p) } })}>
            Log in to reserve
          </button>
        </div>
      )}

      {isCustomer && inStock && (
        <div className="pdp-sticky">
          <div>
            <small>
              {qty} × {p.name}
            </small>
            <strong>{money(total)}</strong>
          </div>
          <button className="btn btn-lg" onClick={() => add(false)} disabled={inCart >= left}>
            Add to cart
          </button>
        </div>
      )}
    </>
  );
}
