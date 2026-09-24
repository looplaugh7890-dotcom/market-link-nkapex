import { Link, useParams } from 'react-router-dom';
import useFetch from '../hooks/useFetch';
import { marketsApi } from '../services/api';
import MapView from '../components/MapView';
import { FavoriteButton, Stars, Status } from '../components/Common';
import { daysText, directionsLinks, farmerPath, nextOpenLabel } from '../utils';

export default function MarketDetail() {
  const { id } = useParams();
  const { data, loading, error } = useFetch(() => marketsApi.get(id), [id]);
  if (loading || error) return <Status loading={loading} error={error} />;

  const { market, farmers } = data;
  const dir = directionsLinks(market.latitude, market.longitude);

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link> / <Link to="/markets">Markets</Link> / <span>{market.name}</span>
      </nav>
      <div className="market-hero">
        <div>
          <span className="kicker dark">Farmers market</span>
          <div className="between">
            <h1>{market.name}</h1>
            <FavoriteButton type="markets" id={market._id} />
          </div>
          <p className="muted">{market.address}</p>
          <div className="market-meta">
            <span className="chip-static">{daysText(market.operatingDays)}</span>
            {market.openTime && (
              <span className="chip-static">
                {market.openTime}–{market.closeTime}
              </span>
            )}
            {nextOpenLabel(market.operatingDays) && <span className="pill-open on">Next: {nextOpenLabel(market.operatingDays)}</span>}
          </div>
          <div className="row-gap mt">
            <a className="btn btn-sm" href={dir.osm} target="_blank" rel="noreferrer">
              Directions (OpenStreetMap)
            </a>
            <a className="btn btn-outline btn-sm" href={dir.google} target="_blank" rel="noreferrer">
              Directions (Google Maps)
            </a>
          </div>
        </div>
        <MapView points={[{ id: market._id, lat: market.latitude, lng: market.longitude, title: market.name, subtitle: market.address }]} height={320} />
      </div>

      <h2 className="section-title">Farmers at this market</h2>
      {!farmers.length ? (
        <p className="muted">No farmers have joined this market yet.</p>
      ) : (
        <div className="grid grid-3">
          {farmers.map((f) => (
            <div className="card" key={f._id}>
              <div className="between">
                <h3>
                  <Link to={farmerPath(f)}>{f.farmerProfile.stallName}</Link>
                </h3>
                <FavoriteButton type="farmers" id={f._id} />
              </div>
              <p className="small">
                <strong>Days:</strong> {daysText(f.farmerProfile.operatingDays)}
              </p>
              <Stars value={f.farmerProfile.ratingAvg} count={f.farmerProfile.ratingCount} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
