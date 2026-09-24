import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import icon2x from 'leaflet/dist/images/marker-icon-2x.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';

// Bundlers break Leaflet's default icon lookup (it prefixes an auto-detected path);
// drop that lookup and point at the imported assets instead.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: icon, iconRetinaUrl: icon2x, shadowUrl: shadow });

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points.map((point) => [point.lat, point.lng]), { padding: [30, 30], maxZoom: 15 });
    else if (points.length === 1) map.setView([points[0].lat, points[0].lng], 14);
  }, [points, map]);
  return null;
}

function ClickPicker({ onPick }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

// points: [{ id, lat, lng, title, subtitle, link (react node) }]
export default function MapView({ points, height = 360, onPick }) {
  const valid = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  const center = valid[0] ? [valid[0].lat, valid[0].lng] : [24.8607, 67.0011];

  return (
    <MapContainer center={center} zoom={12} style={{ height }} className="map-frame" scrollWheelZoom={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds points={valid} />
      {onPick && <ClickPicker onPick={onPick} />}
      {valid.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]}>
          <Popup>
            <strong>{p.title}</strong>
            {p.subtitle && <div>{p.subtitle}</div>}
            {p.link}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
