import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import { farmersApi, marketsApi, errorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ApprovalBanner from '../../components/ApprovalBanner';
import MapView from '../../components/MapView';
import { DAYS, cap } from '../../utils';

const numOrEmpty = (v) => (v === undefined || v === null ? '' : v);

export default function Profile() {
  const { user, setUser } = useAuth();
  const fp = user.farmerProfile;
  const loc = fp.location || {};
  const mkts = useFetch(() => marketsApi.list({ limit: 100 }), []);

  const [f, setF] = useState({
    stallName: fp.stallName,
    contactPerson: fp.contactPerson,
    description: fp.description || '',
    cutoffHours: fp.cutoffHours ?? 12,
    operatingDays: fp.operatingDays || [],
    pickupWindows: fp.pickupWindows || [],
    markets: fp.markets || [],
    address: loc.address || '',
    mapPin: loc.mapPin || '',
    latitude: numOrEmpty(loc.latitude),
    longitude: numOrEmpty(loc.longitude),
  });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  const set = (k) => (event) => setF({ ...f, [k]: event.target.value });
  const toggle = (k, v) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });
  const setWindow = (i, patch) => setF({ ...f, pickupWindows: f.pickupWindows.map((pickupWindow, index) => (index === i ? { ...pickupWindow, ...patch } : pickupWindow)) });

  const useMyLocation = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => setF((cur) => ({ ...cur, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) })),
      () => setMsg({ type: 'error', text: 'Could not get your location. Check browser permissions.' })
    );

  const lat = parseFloat(f.latitude);
  const lng = parseFloat(f.longitude);
  const hasPin = Number.isFinite(lat) && Number.isFinite(lng);

  const save = async (event) => {
    event.preventDefault();
    setMsg({ type: '', text: '' });
    setBusy(true);
    const location = { address: f.address, mapPin: f.mapPin };
    if (hasPin) Object.assign(location, { latitude: lat, longitude: lng });
    try {
      const res = await farmersApi.updateProfile({
        stallName: f.stallName,
        contactPerson: f.contactPerson,
        description: f.description,
        cutoffHours: Number(f.cutoffHours),
        operatingDays: f.operatingDays,
        pickupWindows: f.pickupWindows,
        markets: f.markets,
        location,
      });
      setUser(res.data.user);
      setMsg({ type: 'info', text: 'Profile saved.' });
    } catch (error) {
      setMsg({ type: 'error', text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>Stall profile</h1>
      <ApprovalBanner />
      <form className="stack" onSubmit={save}>
        <div className="card stack">
          <h2>Basics</h2>
          <div className="grid grid-3">
            <label>
              Stall / business name
              <input required value={f.stallName} onChange={set('stallName')} />
            </label>
            <label>
              Contact person
              <input required value={f.contactPerson} onChange={set('contactPerson')} />
            </label>
            <label>
              Order cut-off (hours before pickup)
              <input type="number" min="0" step="1" value={f.cutoffHours} onChange={set('cutoffHours')} />
            </label>
          </div>
          <label>
            About your stall
            <textarea rows={3} maxLength={1000} value={f.description} onChange={set('description')} />
          </label>
        </div>

        <div className="card stack">
          <h2>Markets and days</h2>
          <fieldset>
            <legend>Markets you sell at</legend>
            <div className="row-gap">
              {(mkts.data?.markets || []).map((m) => (
                <label className="check" key={m._id}>
                  <input type="checkbox" checked={f.markets.includes(m._id)} onChange={() => toggle('markets', m._id)} /> {m.name}
                </label>
              ))}
              {mkts.data && !mkts.data.markets.length && <span className="muted">No markets exist yet.</span>}
            </div>
          </fieldset>
          <fieldset>
            <legend>Operating days</legend>
            <div className="row-gap">
              {DAYS.map((day) => (
                <label className="check" key={day}>
                  <input type="checkbox" checked={f.operatingDays.includes(day)} onChange={() => toggle('operatingDays', day)} /> {cap(day)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="card stack">
          <h2>Pickup time windows</h2>
          <p className="muted small">Customers can only pick a pickup slot inside these windows.</p>
          {f.pickupWindows.map((pickupWindow, index) => (
            <div className="win-row" key={index}>
              <select value={pickupWindow.day} onChange={(event) => setWindow(index, { day: event.target.value })} aria-label="Day">
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {cap(day)}
                  </option>
                ))}
              </select>
              <input type="time" required value={pickupWindow.start} onChange={(event) => setWindow(index, { start: event.target.value })} aria-label="Start time" />
              <input type="time" required value={pickupWindow.end} onChange={(event) => setWindow(index, { end: event.target.value })} aria-label="End time" />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF({ ...f, pickupWindows: f.pickupWindows.filter((_, n) => n !== index) })}>
                Remove
              </button>
            </div>
          ))}
          <div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setF({ ...f, pickupWindows: [...f.pickupWindows, { day: 'saturday', start: '09:00', end: '13:00' }] })}>
              Add window
            </button>
          </div>
        </div>

        <div className="card stack">
          <h2>Stall location</h2>
          <label>
            Address
            <input value={f.address} onChange={set('address')} placeholder="e.g. Stall 7, Green Valley Market" />
          </label>
          <label>
            Map pin note (optional)
            <input value={f.mapPin} onChange={set('mapPin')} placeholder="e.g. Next to the fountain" />
          </label>
          <div className="grid grid-3">
            <label>
              Latitude
              <input type="number" step="any" min="-90" max="90" value={f.latitude} onChange={set('latitude')} />
            </label>
            <label>
              Longitude
              <input type="number" step="any" min="-180" max="180" value={f.longitude} onChange={set('longitude')} />
            </label>
            <div className="filter-actions">
              <button type="button" className="btn btn-outline" onClick={useMyLocation}>
                Use my location
              </button>
            </div>
          </div>
          <p className="muted small">Click the map to drop your stall pin.</p>
          <MapView
            height={280}
            points={hasPin ? [{ id: 'me', lat, lng, title: f.stallName, subtitle: f.address }] : []}
            onPick={(la, lo) => setF((cur) => ({ ...cur, latitude: la.toFixed(6), longitude: lo.toFixed(6) }))}
          />
        </div>

        {msg.text && <p className={`alert alert-${msg.type}`}>{msg.text}</p>}
        <div>
          <button className="btn" disabled={busy}>
            {busy ? 'Saving...' : 'Save profile'}
          </button>
        </div>
      </form>
    </>
  );
}
