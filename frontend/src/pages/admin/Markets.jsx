import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import { marketsApi, errorMessage } from '../../services/api';
import MapView from '../../components/MapView';
import { Status } from '../../components/Common';
import { DAYS, cap, daysText } from '../../utils';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';

const EMPTY = { name: '', address: '', latitude: '', longitude: '', operatingDays: [], openTime: '', closeTime: '', mapProvider: 'openstreetmap', mapLink: '' };

const toForm = (m) => ({
  name: m.name,
  address: m.address,
  latitude: m.latitude,
  longitude: m.longitude,
  operatingDays: m.operatingDays || [],
  openTime: m.openTime || '',
  closeTime: m.closeTime || '',
  mapProvider: m.mapProvider || 'openstreetmap',
  mapLink: m.mapLink || '',
});

function MarketForm({ id, initial, onSaved, onCancel }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (event) => setF({ ...f, [k]: event.target.value });
  const lat = parseFloat(f.latitude);
  const lng = parseFloat(f.longitude);
  const hasPin = Number.isFinite(lat) && Number.isFinite(lng);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!hasPin) return setError('Set the location by clicking the map or entering coordinates');
    setBusy(true);
    const body = { ...f, latitude: lat, longitude: lng };
    if (!body.openTime) delete body.openTime;
    if (!body.closeTime) delete body.closeTime;
    try {
      await (id ? marketsApi.update(id, body) : marketsApi.create(body));
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="ad-card stack mb" onSubmit={submit}>
      <h2>{id ? 'Edit market' : 'Add market'}</h2>
      <div className="grid grid-3">
        <label>
          Name
          <input required maxLength={100} value={f.name} onChange={set('name')} />
        </label>
        <label>
          Opens
          <input type="time" value={f.openTime} onChange={set('openTime')} />
        </label>
        <label>
          Closes
          <input type="time" value={f.closeTime} onChange={set('closeTime')} />
        </label>
      </div>
      <label>
        Address
        <input required value={f.address} onChange={set('address')} />
      </label>
      <fieldset>
        <legend>Operating days</legend>
        <div className="row-gap">
          {DAYS.map((day) => (
            <label className="check" key={day}>
              <input type="checkbox" checked={f.operatingDays.includes(day)} onChange={() => setF({ ...f, operatingDays: f.operatingDays.includes(day) ? f.operatingDays.filter((operatingDay) => operatingDay !== day) : [...f.operatingDays, day] })} /> {cap(day)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-3">
        <label>
          Latitude
          <input type="number" step="any" min="-90" max="90" value={f.latitude} onChange={set('latitude')} />
        </label>
        <label>
          Longitude
          <input type="number" step="any" min="-180" max="180" value={f.longitude} onChange={set('longitude')} />
        </label>
        <label>
          Map provider
          <select value={f.mapProvider} onChange={set('mapProvider')}>
            <option value="openstreetmap">OpenStreetMap</option>
            <option value="google">Google Maps</option>
          </select>
        </label>
      </div>
      <label>
        Embedded map / share link (optional)
        <input type="url" value={f.mapLink} onChange={set('mapLink')} placeholder="https://..." />
      </label>
      <p className="muted small">Click the map to place the market pin.</p>
      <MapView height={260} points={hasPin ? [{ id: 'pin', lat, lng, title: f.name || 'Market', subtitle: f.address }] : []} onPick={(la, lo) => setF((previousF) => ({ ...previousF, latitude: la.toFixed(6), longitude: lo.toFixed(6) }))} />
      {error && <p className="alert alert-error">{error}</p>}
      <div className="row-gap">
        <button className="btn" disabled={busy}>
          {busy ? 'Saving...' : 'Save market'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Markets() {
  const confirm = useConfirm();
  const toast = useToast();
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState(null); // null | 'new' | market
  const [msg, setMsg] = useState({ type: '', text: '' });
  const { data, loading, error } = useFetch(() => marketsApi.list({ limit: 100 }), [tick]);
  const markets = data?.markets || [];

  const remove = async (m) => {
    if (!(await confirm({ title: `Remove ${m.name}?`, message: 'Farmers will be unlinked from this market. This is recorded in the audit log.', confirmText: 'Remove market', danger: true }))) return;
    try {
      await marketsApi.remove(m._id);
      toast(`${m.name} removed`);
      setTick((previousTick) => previousTick + 1);
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
    }
  };

  return (
    <>
      <header className="ad-head">
        <div>
          <span className="kicker dark">Markets</span>
          <h1>Where MarketLink happens</h1>
          <p className="muted">{markets.length} market{markets.length === 1 ? '' : 's'}. Click the map inside the form to drop a pin instead of typing coordinates.</p>
        </div>
        <div className="ad-tools">
          <button className="btn btn-sm" onClick={() => setEditing('new')}>
            + Add market
          </button>
        </div>
      </header>
      {msg.text && <p className={`alert alert-${msg.type}`}>{msg.text}</p>}
      {editing && (
        <MarketForm
          key={editing === 'new' ? 'new' : editing._id}
          id={editing === 'new' ? null : editing._id}
          initial={editing === 'new' ? EMPTY : toForm(editing)}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast('Market saved');
            setTick((previousTick) => previousTick + 1);
          }}
        />
      )}
      <Status loading={loading} error={error} empty={!markets.length} emptyText="No markets yet." />
      <div className="stack">
        {markets.map((market) => (
          <div className="ad-card prod-row" key={market._id}>
            <div className="cart-info">
              <strong>{market.name}</strong>
              <div className="muted small">{market.address}</div>
              <div className="small">
                {daysText(market.operatingDays)}
                {market.openTime && ` · ${market.openTime}-${market.closeTime}`} · ({market.latitude.toFixed(4)}, {market.longitude.toFixed(4)})
              </div>
            </div>
            <div className="row-gap">
              <button className="btn btn-outline btn-sm" onClick={() => setEditing(market)}>
                Edit
              </button>
              <button className="btn btn-ghost btn-sm danger-text" onClick={() => remove(market)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
