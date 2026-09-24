import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import { adminApi, errorMessage } from '../../services/api';
import { Pagination, Stars, Status } from '../../components/Common';
import { money, productPath, timeAgo } from '../../utils';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';

export default function Moderation() {
  const confirm = useConfirm();
  const toast = useToast();
  const [sp] = useSearchParams();
  const [tab, setTab] = useState(sp.get('tab') === 'products' ? 'products' : 'reviews');
  const [rating, setRating] = useState(0);
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState('');
  const { data, loading, error } = useFetch(
    () => (tab === 'reviews' ? adminApi.reviews({ rating: rating || undefined, page, limit: 15 }) : adminApi.products({ search: query, page, limit: 15 })),
    [tab, page, query, tick, rating]
  );
  const items = data?.reviews || data?.products || [];

  const remove = async (fn, text, done) => {
    if (!(await confirm({ title: text, message: 'This cannot be undone. The action is recorded in the audit log.', confirmText: 'Remove', danger: true }))) return;
    setMsg('');
    try {
      await fn();
      toast(done);
      setTick((t) => t + 1);
    } catch (err) {
      setMsg(errorMessage(err));
    }
  };

  return (
    <>
      <header className="ad-head">
        <div>
          <span className="kicker dark">Moderation</span>
          <h1>Keep the marketplace clean</h1>
          <p className="muted">Remove listings or reviews that violate platform guidelines. Low ratings are the quickest place to start.</p>
        </div>
      </header>
      <div className="seg" role="tablist">
        {[['reviews', 'Reviews'], ['products', 'Product listings']].map(([v, label]) => (
          <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? 'active' : ''} onClick={() => { setTab(v); setPage(1); }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'reviews' && (
        <div className="chip-row inline wrap-chips" role="tablist" aria-label="Filter by rating">
          {[[0, 'All ratings'], [1, '1 ★'], [2, '2 ★'], [3, '3 ★'], [4, '4 ★'], [5, '5 ★']].map(([v, l]) => (
            <button key={v} role="tab" aria-selected={rating === v} className={rating === v ? 'active' : ''} onClick={() => { setRating(v); setPage(1); }}>
              {l}
            </button>
          ))}
        </div>
      )}
      {tab === 'products' && (
        <form className="filters card mt" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(1); }}>
          <label>
            Search products
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <div className="filter-actions">
            <button className="btn">Search</button>
          </div>
        </form>
      )}
      {msg && <p className="alert alert-error">{msg}</p>}

      <Status loading={loading} error={error} empty={!items.length} emptyText="Nothing to moderate." />
      <div className="stack mt">
        {tab === 'reviews' &&
          data?.reviews?.map((r) => (
            <div className="ad-card stack" key={r._id}>
              <div className="between">
                <strong>
                  {r.customer?.name || 'Deleted user'} <span className="muted small">→ {r.product ? r.product.name : r.farmer?.farmerProfile?.stallName}</span>
                </strong>
                <Stars value={r.rating} />
              </div>
              {r.comment ? <p>{r.comment}</p> : <p className="muted small">No comment.</p>}
              <div className="between">
                <span className="muted small">{timeAgo(r.createdAt)}</span>
                <button className="btn btn-ghost btn-sm danger-text" onClick={() => remove(() => adminApi.removeReview(r._id), 'Remove this review?', 'Review removed')}>
                  Remove review
                </button>
              </div>
            </div>
          ))}
        {tab === 'products' &&
          data?.products?.map((p) => (
            <div className="ad-card prod-row" key={p._id}>
              <div className="cart-info">
                <Link to={productPath(p)}>{p.name}</Link>
                <div className="muted small">
                  {p.farmer?.farmerProfile?.stallName} · {p.category?.name} · {money(p.price)} / {p.unit} · {p.quantityAvailable} in stock
                </div>
                {p.description && <div className="small">{p.description}</div>}
              </div>
              <button className="btn btn-ghost btn-sm danger-text" onClick={() => remove(() => adminApi.removeProduct(p._id), `Remove listing "${p.name}"?`, 'Listing removed')}>
                Remove listing
              </button>
            </div>
          ))}
      </div>
      {data && <Pagination page={data.page} pages={Math.ceil(data.total / 15)} onChange={setPage} />}
    </>
  );
}
