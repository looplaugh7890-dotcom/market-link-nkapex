import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import { categoriesApi, productsApi, uploadImage, errorMessage, imageUrl } from '../../services/api';
import ApprovalBanner from '../../components/ApprovalBanner';
import { PageHead, Status } from '../../components/Common';
import { useConfirm } from '../../context/ConfirmContext';
import { money, TAGS } from '../../utils';

const todayInput = () => new Date().toISOString().slice(0, 10);

const EMPTY = { name: '', category: '', price: '', unit: 'kg', quantityAvailable: '', description: '', image: '', harvestedOn: todayInput(), storage: '', tags: [], tplEnabled: false, tplQuantity: '' };

const toForm = (p) => ({
  name: p.name,
  category: p.category?._id || p.category,
  price: p.price,
  unit: p.unit,
  quantityAvailable: p.quantityAvailable,
  description: p.description || '',
  image: p.image || '',
  harvestedOn: p.harvestedOn ? p.harvestedOn.slice(0, 10) : '',
  storage: p.storage || '',
  tags: p.tags || [],
  tplEnabled: !!p.weeklyTemplate?.enabled,
  tplQuantity: p.weeklyTemplate?.quantity ?? '',
});

function ProductForm({ initial, categories, onSaved, onCancel, id }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    try {
      const res = await uploadImage(file);
      setF((cur) => ({ ...cur, image: res.data.url }));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const body = {
      name: f.name.trim(),
      category: f.category,
      price: Number(f.price),
      unit: f.unit.trim(),
      quantityAvailable: Number(f.quantityAvailable),
      description: f.description.trim(),
      image: f.image,
      harvestedOn: f.harvestedOn || null,
      storage: f.storage.trim(),
      tags: f.tags,
      weeklyTemplate: { enabled: f.tplEnabled, quantity: Number(f.tplQuantity) || 0 },
    };
    try {
      await (id ? productsApi.update(id, body) : productsApi.create(body));
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack mb" onSubmit={submit}>
      <h2>{id ? 'Edit product' : 'Add product'}</h2>
      <div className="grid grid-3">
        <label>
          Name
          <input required maxLength={100} value={f.name} onChange={set('name')} />
        </label>
        <label>
          Category
          <select required value={f.category} onChange={set('category')}>
            <option value="">Select</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Unit (kg, dozen, bunch...)
          <input required maxLength={20} value={f.unit} onChange={set('unit')} />
        </label>
        <label>
          Price per unit
          <input required type="number" min="0" step="0.01" value={f.price} onChange={set('price')} />
        </label>
        <label>
          Quantity available
          <input required type="number" min="0" step="1" value={f.quantityAvailable} onChange={set('quantityAvailable')} />
        </label>
        <label>
          Image (JPG, PNG or WEBP, max 2 MB)
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} />
        </label>
      </div>
      {f.image && (
        <div className="cart-thumb">
          <img src={imageUrl(f.image)} alt="Product preview" />
        </div>
      )}
      <label>
        Description
        <textarea rows={2} maxLength={1000} value={f.description} onChange={set('description')} />
      </label>
      <div className="grid grid-3">
        <label>
          Harvested / made on
          <input type="date" max={todayInput()} value={f.harvestedOn} onChange={set('harvestedOn')} />
          <small className="muted">Shown as a freshness badge, e.g. &quot;Harvested today&quot;.</small>
        </label>
        <label style={{ gridColumn: 'span 2' }}>
          Storage tip (optional)
          <input maxLength={200} placeholder="e.g. Refrigerate, best within 5 days" value={f.storage} onChange={set('storage')} />
        </label>
      </div>
      <fieldset>
        <legend>Badges customers can filter and trust</legend>
        <div className="tag-picker">
          {TAGS.map(([v, label]) => (
            <label key={v} className={`tag-opt ${f.tags.includes(v) ? 'on' : ''}`}>
              <input type="checkbox" checked={f.tags.includes(v)} onChange={() => setF({ ...f, tags: f.tags.includes(v) ? f.tags.filter((t) => t !== v) : [...f.tags, v] })} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="row-gap">
        <label className="check">
          <input type="checkbox" checked={f.tplEnabled} onChange={set('tplEnabled')} /> Include in weekly stock template
        </label>
        {f.tplEnabled && (
          <label className="inline">
            Weekly quantity
            <input className="qty" type="number" min="0" value={f.tplQuantity} onChange={set('tplQuantity')} />
          </label>
        )}
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="row-gap">
        <button className="btn" disabled={busy}>
          {busy ? 'Saving...' : 'Save product'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

const STATUS_TAG = { available: ['tag', 'In stock'], sold_out: ['tag tag-warn', 'Sold out'], unavailable: ['tag tag-cancelled', 'Unavailable'] };

export default function Products() {
  const confirm = useConfirm();
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState(null); // null | 'new' | product
  const [msg, setMsg] = useState({ type: '', text: '' });
  const { data, loading, error } = useFetch(() => productsApi.mine(), [tick]);
  const cats = useFetch(() => categoriesApi.list(), []);
  const reload = () => setTick((t) => t + 1);

  const run = async (fn, okText) => {
    setMsg({ type: '', text: '' });
    try {
      await fn();
      if (okText) setMsg({ type: 'info', text: okText });
      reload();
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
    }
  };

  const products = data?.products || [];

  return (
    <>
      <PageHead kicker="Stock" title="My products" sub={`${products.length} product${products.length === 1 ? '' : 's'} listed. Keep quantities current so customers never order what you cannot supply.`}>
        <div className="row-gap">
          <button className="btn btn-outline btn-sm" onClick={() => run(async () => { const r = await productsApi.applyTemplate(); setMsg({ type: 'info', text: `Weekly template applied to ${r.data.updated} product(s).` }); })}>
            Apply weekly template
          </button>
          <button className="btn btn-sm" onClick={() => setEditing('new')}>
            Add product
          </button>
        </div>
      </PageHead>
      <ApprovalBanner />
      {msg.text && <p className={`alert alert-${msg.type}`}>{msg.text}</p>}

      {editing && (
        <ProductForm
          key={editing === 'new' ? 'new' : editing._id}
          id={editing === 'new' ? null : editing._id}
          initial={editing === 'new' ? EMPTY : toForm(editing)}
          categories={cats.data?.categories || []}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setMsg({ type: 'info', text: 'Product saved.' });
            reload();
          }}
        />
      )}

      <Status loading={loading} error={error} empty={!products.length} emptyText="You have not added any products yet." />
      <div className="stack">
        {products.map((p) => {
          const [cls, label] = STATUS_TAG[p.status];
          return (
            <div className="card prod-row" key={p._id}>
              <div className="cart-thumb">{p.image ? <img src={imageUrl(p.image)} alt="" /> : <span aria-hidden>🥬</span>}</div>
              <div className="cart-info">
                <strong>{p.name}</strong> <span className={cls}>{label}</span>
                <div className="muted small">
                  {p.category?.name} · {money(p.price)} / {p.unit} · {p.quantityAvailable} in stock
                  {p.weeklyTemplate?.enabled && ` · weekly template: ${p.weeklyTemplate.quantity}`}
                </div>
              </div>
              <div className="row-gap">
                <button className="btn btn-outline btn-sm" onClick={() => setEditing(p)}>
                  Edit
                </button>
                {p.status !== 'sold_out' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => run(() => productsApi.setStatus(p._id, 'sold_out'))}>
                    Mark sold out
                  </button>
                )}
                {p.available ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => run(() => productsApi.setStatus(p._id, 'unavailable'))}>
                    Hide temporarily
                  </button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => run(() => productsApi.setStatus(p._id, 'available'))}>
                    Show again
                  </button>
                )}
                <button className="btn btn-ghost btn-sm danger-text" onClick={async () => (await confirm({ title: `Delete ${p.name}?`, message: 'Customers will no longer see this product. Past orders keep their history.', confirmText: 'Delete', danger: true })) && run(() => productsApi.remove(p._id), 'Product deleted.')}>
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
