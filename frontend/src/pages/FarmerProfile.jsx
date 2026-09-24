import { Link, useParams } from 'react-router-dom';
import useFetch from '../hooks/useFetch';
import { farmersApi } from '../services/api';
import MapView from '../components/MapView';
import { FavoriteButton, ProductCard, Stars, Status } from '../components/Common';
import { ReviewList } from './ProductDetail';
import { cap, daysText, directionsLinks, marketPath } from '../utils';

export default function FarmerProfile() {
  const { id } = useParams();
  const { data, loading, error } = useFetch(() => farmersApi.get(id), [id]);
  if (loading || error) return <Status loading={loading} error={error} />;

  const { farmer, products } = data;
  const fp = farmer.farmerProfile;
  const loc = fp.location || {};
  const hasLoc = Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude);

  return (
    <>
      <div className="between">
        <h1>{fp.stallName}</h1>
        <FavoriteButton type="farmers" id={farmer._id} />
      </div>
      <Stars value={fp.ratingAvg} count={fp.ratingCount} />
      {fp.description && <p>{fp.description}</p>}

      <div className="grid grid-3 mt">
        <div className="card">
          <h3>Operating days</h3>
          <p>{daysText(fp.operatingDays)}</p>
        </div>
        <div className="card">
          <h3>Pickup windows</h3>
          {fp.pickupWindows.length ? (
            <ul className="plain">
              {fp.pickupWindows.map((pickupWindow, index) => (
                <li key={index}>
                  {cap(pickupWindow.day)} {pickupWindow.start}-{pickupWindow.end}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Not set</p>
          )}
        </div>
        <div className="card">
          <h3>Markets</h3>
          {fp.markets.length ? (
            <ul className="plain">
              {fp.markets.map((market) => (
                <li key={market._id}>
                  <Link to={marketPath(market)}>{market.name}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Not set</p>
          )}
        </div>
      </div>

      {hasLoc && (
        <>
          <h2 className="section-title">Stall location</h2>
          {loc.address && <p className="muted">{loc.address}</p>}
          <MapView points={[{ id: farmer._id, lat: loc.latitude, lng: loc.longitude, title: fp.stallName, subtitle: loc.address }]} height={280} />
          <p className="mt">
            <a className="btn btn-outline btn-sm" href={directionsLinks(loc.latitude, loc.longitude).osm} target="_blank" rel="noreferrer">
              Get directions
            </a>
          </p>
        </>
      )}

      <h2 className="section-title">This week&apos;s stock</h2>
      {products.length ? (
        <div className="grid grid-4">
          {products.map((product) => (
            <ProductCard key={product._id} product={{ ...product, farmer }} />
          ))}
        </div>
      ) : (
        <p className="muted">Nothing in stock right now.</p>
      )}

      <h2 className="section-title">Reviews</h2>
      <ReviewList params={{ farmer: farmer._id }} />
    </>
  );
}
