import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconClose, IconFilter } from '../components/Icons';
import useFetch from '../hooks/useFetch';
import { productsApi, categoriesApi, marketsApi } from '../services/api';
import { Pagination, ProductCard, SkeletonGrid, Status } from '../components/Common';
import { DAYS, cap } from '../utils';

const FIELDS = ['search', 'category', 'minPrice', 'maxPrice', 'market', 'day', 'sort'];

// Right-hand slide-in panel with every filter. Applies on submit so the grid does not reload on every keystroke.
function FilterDrawer({ f, markets, onApply, onReset, onClose }) {
  const [v, setV] = useState({ search: f.search, market: f.market, day: f.day, minPrice: f.minPrice, maxPrice: f.maxPrice });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const PRICE = [['Under $2', '', '2'], ['$2 – $5', '2', '5'], ['$5 – $10', '5', '10'], ['Over $10', '10', '']];

  return (
    <div className="fd-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="filter-drawer" role="dialog" aria-modal="true" aria-label="Filters">
        <header className="fd-head">
          <h2>Filters</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close filters">
            <IconClose />
          </button>
        </header>
        <form
          id="filter-form"
          className="fd-body"
          onSubmit={(e) => {
            e.preventDefault();
            onApply(v);
          }}
        >
          <label>
            Search
            <input autoFocus placeholder="e.g. tomatoes" value={v.search} onChange={set('search')} />
          </label>
          <label>
            Market
            <select value={v.market} onChange={set('market')}>
              <option value="">All markets</option>
              {markets.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="fd-label">Pickup day</span>
            <div className="chip-row inline" role="group" aria-label="Pickup day">
              <button type="button" className={!v.day ? 'active' : ''} onClick={() => setV({ ...v, day: '' })}>
                Any
              </button>
              {DAYS.map((d) => (
                <button type="button" key={d} className={v.day === d ? 'active' : ''} onClick={() => setV({ ...v, day: d })}>
                  {cap(d.slice(0, 3))}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="fd-label">Price</span>
            <div className="chip-row inline" role="group" aria-label="Price ranges">
              {PRICE.map(([label, lo, hi]) => (
                <button type="button" key={label} className={v.minPrice === lo && v.maxPrice === hi ? 'active' : ''} onClick={() => setV({ ...v, minPrice: lo, maxPrice: hi })}>
                  {label}
                </button>
              ))}
            </div>
            <div className="fd-range">
              <input type="number" min="0" step="0.01" placeholder="Min $" aria-label="Minimum price" value={v.minPrice} onChange={set('minPrice')} />
              <span aria-hidden>–</span>
              <input type="number" min="0" step="0.01" placeholder="Max $" aria-label="Maximum price" value={v.maxPrice} onChange={set('maxPrice')} />
            </div>
          </div>
        </form>
        <footer className="fd-foot">
          <button type="button" className="btn btn-ghost" onClick={onReset}>
            Reset all
          </button>
          <button className="btn" form="filter-form">
            Show results
          </button>
        </footer>
      </aside>
    </div>
  );
}

export default function Products() {
  const [params, setParams] = useSearchParams();
  const f = Object.fromEntries(FIELDS.map((k) => [k, params.get(k) || '']));
  const page = Number(params.get('page')) || 1;

  const cats = useFetch(() => categoriesApi.list(), []);
  const mkts = useFetch(() => marketsApi.list({ limit: 100 }), []);
  const { data, loading, error } = useFetch(() => productsApi.list({ ...f, page, limit: 12 }), [params.toString()]);

  const goPage = (p) => {
    const next = new URLSearchParams(params);
    next.set('page', p);
    setParams(next);
    window.scrollTo({ top: 0 });
  };

  const products = data?.products || [];

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    next.delete('page');
    setParams(next);
  };
  const activeFilters = ['search', 'market', 'day', 'minPrice', 'maxPrice'].filter((k) => f[k]).length;
  const [showFilters, setShowFilters] = useState(false);
  const catName = cats.data?.categories.find((c) => c._id === f.category)?.name;

  return (
    <>
      <header className="page-head">
        <span className="kicker dark">Shop</span>
        <h1>{catName || (f.search ? `Results for “${f.search}”` : 'Fresh from the stalls')}</h1>
        <p className="muted">{data ? `${data.total} product${data.total === 1 ? '' : 's'} from local growers` : 'Loading the harvest...'}</p>
      </header>

      <div className="chip-row" role="tablist" aria-label="Categories">
        <button role="tab" aria-selected={!f.category} className={!f.category ? 'active' : ''} onClick={() => setParam('category', '')}>
          All
        </button>
        {cats.data?.categories.map((c) => (
          <button key={c._id} role="tab" aria-selected={f.category === c._id} className={f.category === c._id ? 'active' : ''} onClick={() => setParam('category', c._id)}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <button type="button" className="btn btn-outline btn-sm" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>
          <IconFilter width={18} height={18} /> Filters{activeFilters > 0 && <span className="badge">{activeFilters}</span>}
        </button>
        <label className="inline sort-inline">
          <span className="muted small">Sort</span>
          <select value={f.sort} onChange={(e) => setParam('sort', e.target.value)} aria-label="Sort products">
            <option value="">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="rating">Top rated</option>
          </select>
        </label>
      </div>

      {activeFilters > 0 && (
        <div className="active-filters" aria-label="Active filters">
          {f.search && (
            <button onClick={() => setParam('search', '')}>
              “{f.search}” <span aria-hidden>×</span>
            </button>
          )}
          {f.market && (
            <button onClick={() => setParam('market', '')}>
              {mkts.data?.markets.find((m) => m._id === f.market)?.name || 'Market'} <span aria-hidden>×</span>
            </button>
          )}
          {f.day && (
            <button onClick={() => setParam('day', '')}>
              {cap(f.day)} pickup <span aria-hidden>×</span>
            </button>
          )}
          {(f.minPrice || f.maxPrice) && (
            <button
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete('minPrice');
                next.delete('maxPrice');
                next.delete('page');
                setParams(next);
              }}
            >
              ${f.minPrice || 0} – {f.maxPrice ? `$${f.maxPrice}` : 'any'} <span aria-hidden>×</span>
            </button>
          )}
          <button className="clear-all" onClick={() => setParams(f.category ? { category: f.category } : {})}>
            Clear all
          </button>
        </div>
      )}

      {showFilters && (
        <FilterDrawer
          f={f}
          markets={mkts.data?.markets || []}
          onClose={() => setShowFilters(false)}
          onApply={(v) => {
            const next = new URLSearchParams();
            if (f.category) next.set('category', f.category);
            if (f.sort) next.set('sort', f.sort);
            Object.entries(v).forEach(([k, val]) => String(val).trim() && next.set(k, String(val).trim()));
            setParams(next);
            setShowFilters(false);
          }}
          onReset={() => {
            setParams(f.category ? { category: f.category } : {});
            setShowFilters(false);
          }}
        />
      )}

      {loading && <SkeletonGrid count={10} className="grid grid-products" />}
      <Status loading={false} error={error} empty={!loading && !products.length} emptyText="No products match your filters." />
      {!loading && products.length > 0 && (
        <>
          <div className="grid grid-products">
            {products.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={goPage} />
        </>
      )}
    </>
  );
}
