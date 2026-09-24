import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useFetch from '../hooks/useFetch';
import { marketsApi } from '../services/api';
import MapView from '../components/MapView';
import { FavoriteButton, Status } from '../components/Common';
import { DAYS, cap, daysText, marketPath, nextOpenLabel } from '../utils';
import { IconMap } from '../components/Icons';

export default function Markets() {
  const [params, setParams] = useSearchParams();
  const [locError, setLocError] = useState('');
  const day = params.get('day') || '';
  const search = params.get('search') || '';
  const lat = params.get('lat') || '';
  const lng = params.get('lng') || '';

  const { data, loading, error } = useFetch(
    () => marketsApi.list({ day, search, lat, lng, radius: lat ? 25 : '', limit: 50 }),
    [day, search, lat, lng]
  );
  const markets = data?.markets || [];

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };

  const nearMe = () => {
    setLocError('');
    if (!navigator.geolocation) return setLocError('Location is not supported by your browser');
    navigator.geolocation.getCurrentPosition(
      (pos) => update({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) }),
      () => setLocError('Could not get your location. Check browser permissions.')
    );
  };

  return (
    <>
      <header className="page-head">
        <span className="kicker dark">Markets</span>
        <h1>Find your market</h1>
        <p className="muted">{data ? `${data.total} farmers market${data.total === 1 ? '' : 's'}${lat ? ' near you' : ' to explore'}` : 'Loading markets...'}</p>
      </header>

      <div className="chip-row" role="tablist" aria-label="Day of the week">
        <button role="tab" aria-selected={!day} className={!day ? 'active' : ''} onClick={() => update({ day: '' })}>
          Any day
        </button>
        {DAYS.map((d) => (
          <button key={d} role="tab" aria-selected={day === d} className={day === d ? 'active' : ''} onClick={() => update({ day: d })}>
            {cap(d)}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <input className="pill-input" type="search" placeholder="Search markets by name" aria-label="Search markets" defaultValue={search} onKeyDown={(event) => event.key === 'Enter' && update({ search: event.target.value.trim() })} onBlur={(event) => event.target.value.trim() !== search && update({ search: event.target.value.trim() })} />
        {lat ? (
          <button className="btn btn-outline btn-sm" onClick={() => update({ lat: '', lng: '' })}>
            Clear location
          </button>
        ) : (
          <button className="btn btn-outline btn-sm" onClick={nearMe}>
            <IconMap width={18} height={18} /> Near me
          </button>
        )}
      </div>
      {locError && <p className="alert alert-error">{locError}</p>}
      {lat && <p className="muted small">Showing markets within 25 km of your location.</p>}

      <Status loading={loading} error={error} empty={!loading && !markets.length} emptyText="No markets match your filters." />

      {!loading && markets.length > 0 && (
        <div className="markets-split">
          <ul className="market-list">
            {markets.map((market) => (
              <li className="market-card" key={market._id}>
                <div className="between">
                  <h3>
                    <Link to={marketPath(market)}>{market.name}</Link>
                  </h3>
                  <FavoriteButton type="markets" id={market._id} />
                </div>
                <p className="muted small">{market.address}</p>
                <div className="market-meta">
                  <span className="chip-static">{daysText(market.operatingDays)}</span>
                  {market.openTime && (
                    <span className="chip-static">
                      {market.openTime}–{market.closeTime}
                    </span>
                  )}
                  {nextOpenLabel(market.operatingDays) && <span className="pill-open on">Next: {nextOpenLabel(market.operatingDays)}</span>}
                </div>
                <Link className="arrow-link" to={marketPath(market)}>
                  View market & growers →
                </Link>
              </li>
            ))}
          </ul>
          <div className="market-map">
            <MapView
              height={620}
              points={markets.map((market) => ({
                id: market._id,
                lat: market.latitude,
                lng: market.longitude,
                title: market.name,
                subtitle: daysText(market.operatingDays),
                link: <Link to={marketPath(market)}>View market</Link>,
              }))}
            />
          </div>
        </div>
      )}
    </>
  );
}
