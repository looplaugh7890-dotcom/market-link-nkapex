import { useState } from 'react';
import { Link } from 'react-router-dom';
import useFetch from '../hooks/useFetch';
import { favoritesApi } from '../services/api';
import { useFavorites } from '../context/FavoritesContext';
import { EmptyState, FavoriteButton, PageHead, ProductCard, Status } from '../components/Common';
import { IconHeart } from '../components/Icons';
import { daysText, farmerPath, marketPath } from '../utils';

const TABS = [['products', 'Products'], ['farmers', 'Farmers'], ['markets', 'Markets']];

export default function Favorites() {
  const [tab, setTab] = useState('products');
  const fav = useFavorites();
  const { data, loading, error } = useFetch(() => favoritesApi.list(), []);

  // Context is the source of truth so un-hearting hides the item immediately.
  const items = (data?.favorites[tab] || []).filter((x) => fav.has(tab, x._id));

  return (
    <>
      <PageHead kicker="Saved" title="Your favorites" sub="Heart products, growers and markets to find them fast. We alert you when a favorite product is back in stock." />
      <div className="seg" role="tablist">
        {TABS.map(([v, label]) => (
          <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? 'active' : ''} onClick={() => setTab(v)}>
            {label}
          </button>
        ))}
      </div>

      <Status loading={loading} error={error} />
      {!loading && !error && !items.length && <EmptyState icon={IconHeart} title={`No favorite ${tab} yet`} text="Tap the heart on any card to save it here." to={tab === 'markets' ? '/markets' : '/products'} cta={tab === 'markets' ? 'Find markets' : 'Browse products'} />}

      {tab === 'products' && items.length > 0 && (
        <div className="grid grid-products">
          {items.map((p) => (
            <ProductCard key={p._id} product={{ ...p, quantityAvailable: p.available ? p.quantityAvailable : 0 }} />
          ))}
        </div>
      )}
      {tab === 'farmers' && (
        <div className="markets-cards">
          {items.map((f) => (
            <div className="market-card" key={f._id}>
              <div className="between">
                <h3>
                  <Link to={farmerPath(f)}>{f.farmerProfile?.stallName}</Link>
                </h3>
                <FavoriteButton type="farmers" id={f._id} />
              </div>
              <p className="muted small">{f.farmerProfile?.location?.address}</p>
            </div>
          ))}
        </div>
      )}
      {tab === 'markets' && (
        <div className="markets-cards">
          {items.map((m) => (
            <div className="market-card" key={m._id}>
              <div className="between">
                <h3>
                  <Link to={marketPath(m)}>{m.name}</Link>
                </h3>
                <FavoriteButton type="markets" id={m._id} />
              </div>
              <p className="muted small">{m.address}</p>
              <p className="small">
                <strong>Open:</strong> {daysText(m.operatingDays)}
                {m.openTime && ` · ${m.openTime}-${m.closeTime}`}
              </p>
              <a className="small" href={`https://www.openstreetmap.org/directions?to=${m.latitude}%2C${m.longitude}`} target="_blank" rel="noreferrer">
                Route-friendly pickup directions
              </a>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
