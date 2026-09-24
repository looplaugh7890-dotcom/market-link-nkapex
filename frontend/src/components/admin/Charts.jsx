import { useState } from 'react';

// Dependency-free SVG charts (no chart library to download): small, fast and styled by our CSS variables.

const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

// Vertical bars with hover read-out. data: [{ label, value, sub }]
export function BarChart({ data, height = 190, format = (v) => v, color = 'var(--green-700)' }) {
  const [hover, setHover] = useState(-1);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const W = 100;
  const step = W / data.length;
  const h = hover >= 0 ? data[hover] : null;
  return (
    <div className="chart" style={{ height }}>
      <div className="chart-tip" aria-live="polite">
        {h ? (
          <>
            <strong>{format(h.value)}</strong> <span>{h.label}</span>
            {h.sub && <span className="muted"> · {h.sub}</span>}
          </>
        ) : (
          <span className="muted">Hover a bar for details</span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} 60`} preserveAspectRatio="none" role="img" aria-label="Bar chart">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1="0" x2={W} y1={56 - f * 52} y2={56 - f * 52} className="chart-grid" />
        ))}
        {data.map((d, index) => {
          const bh = Math.max(d.value > 0 ? 1.2 : 0, (d.value / max) * 52);
          return (
            <g key={index} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(-1)} onFocus={() => setHover(index)} onBlur={() => setHover(-1)} tabIndex={0} aria-label={`${d.label}: ${format(d.value)}`}>
              <rect x={index * step} y="0" width={step} height="60" fill="transparent" />
              <rect x={index * step + step * 0.18} y={56 - bh} width={step * 0.64} height={bh} rx="1.2" fill={color} opacity={hover === -1 || hover === index ? 1 : 0.45} />
            </g>
          );
        })}
      </svg>
      <div className="chart-x">
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

// Donut with legend. segments: [{ label, value, color }]
export function Donut({ segments, centerLabel }) {
  const total = segments.reduce((s, segment) => s + segment.value, 0);
  const R = 15.9;
  let acc = 0;
  return (
    <div className="donut-wrap">
      <div className="donut">
        <svg viewBox="0 0 42 42" role="img" aria-label="Distribution chart">
          <circle cx="21" cy="21" r={R} fill="none" stroke="var(--cream-2)" strokeWidth="5" />
          {total > 0 &&
            segments
              .filter((segment) => segment.value > 0)
              .map((segment) => {
                const len = (segment.value / total) * 100;
                const el = <circle key={segment.label} cx="21" cy="21" r={R} fill="none" stroke={segment.color} strokeWidth="5" strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={25 - acc} />;
                acc += len;
                return el;
              })}
        </svg>
        <div className="donut-center">
          <strong>{total}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <ul className="legend">
        {segments.map((segment) => (
          <li key={segment.label}>
            <i style={{ background: segment.color }} />
            {segment.label}
            <b>{segment.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Horizontal ranked bars. rows: [{ label, value, note }]
export function HBars({ rows, format = (v) => v, empty = 'Nothing to show yet.' }) {
  if (!rows.length) return <p className="muted small">{empty}</p>;
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className="hbars">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="hbar-top">
            <span>{row.label}</span>
            <strong>{format(row.value)}</strong>
          </div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }} />
          </div>
          {row.note && <small className="muted">{row.note}</small>}
        </li>
      ))}
    </ul>
  );
}

// Tiny inline trend line for KPI cards.
export function Sparkline({ values, color = 'var(--green-700)' }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((value, index) => `${(index / (values.length - 1)) * 100},${28 - (value / max) * 24}`).join(' ');
  return (
    <svg className="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
