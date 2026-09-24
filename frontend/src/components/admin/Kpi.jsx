import { Link } from 'react-router-dom';

// Stat card used on the admin and farmer dashboards. `change` is a % vs the previous period (omit when unknown).
export default function Kpi({ label, value, sub, change, spark, icon: Icon, to }) {
  const body = (
    <>
      <div className="kpi-top">
        <span className="kpi-ico">
          <Icon width={20} height={20} />
        </span>
        {change !== undefined && change !== null && (
          <span className={`kpi-chip ${change >= 0 ? 'up' : 'down'}`}>
            {change >= 0 ? '▲' : '▼'} {Math.abs(change)}%
          </span>
        )}
      </div>
      <strong className="kpi-value">{value}</strong>
      <span className="kpi-label">{label}</span>
      {sub && <small className="kpi-sub">{sub}</small>}
      {spark && <div className="kpi-spark">{spark}</div>}
    </>
  );
  return to ? (
    <Link className="kpi" to={to}>
      {body}
    </Link>
  ) : (
    <div className="kpi">{body}</div>
  );
}
