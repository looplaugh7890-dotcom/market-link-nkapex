import { Link } from 'react-router-dom';
import useFetch from '../hooks/useFetch';
import { farmersApi, marketsApi, productsApi } from '../services/api';
import { IconMail, IconMap, IconPhone } from '../components/Icons';

// TODO: replace with the real team members (name + role).
const TEAM = [
  { name: 'Team member 1', role: 'Role, e.g. Full-stack developer' },
  { name: 'Team member 2', role: 'Role, e.g. UI/UX designer' },
  { name: 'Team member 3', role: 'Role, e.g. Tester & documentation' },
];

export function About() {
  const m = useFetch(() => marketsApi.list({ limit: 1 }), []);
  const f = useFetch(() => farmersApi.list({ limit: 1 }), []);
  const p = useFetch(() => productsApi.list({ limit: 1 }), []);
  const pillars = [
    ['For shoppers', 'Discover nearby markets, see real weekly stock and reserve what you want before it sells out.'],
    ['For growers', 'Publish weekly stock and pricing, take pre-orders and plan your harvest around real demand.'],
    ['For markets', 'One place to show who is selling, when you are open and how to find you.'],
  ];
  return (
    <div className="static-page">
      <header className="static-hero">
        <span className="kicker dark">About MarketLink</span>
        <h1>Making local food easier to find, reserve and enjoy.</h1>
        <p>
          Local farmers markets are growing in popularity, but shoppers rarely know which farmers will be there, what they have in stock, or at what price. MarketLink puts that
          information in one place. Farmers publish their weekly stock, customers reserve, and everyone meets at the market, paying in person.
        </p>
      </header>
      <ul className="static-stats">
        <li>
          <strong>{m.data?.total ?? '–'}</strong> markets
        </li>
        <li>
          <strong>{f.data?.total ?? '–'}</strong> growers
        </li>
        <li>
          <strong>{p.data?.total ?? '–'}</strong> products
        </li>
      </ul>
      <section aria-labelledby="team-h">
        <h2 id="team-h" className="team-title">
          The team
        </h2>
        <div className="team-grid">
          {TEAM.map((t) => (
            <div className="team-card" key={t.name}>
              <span className="team-avatar" aria-hidden>
                {t.name[0]}
              </span>
              <strong>{t.name}</strong>
              <span className="muted small">{t.role}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="pillars">
        {pillars.map(([t, d], i) => (
          <div className="pillar" key={t}>
            <span className="step-no">0{i + 1}</span>
            <h2>{t}</h2>
            <p className="muted">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Contact() {
  // TODO: replace with the real team address/coordinates.
  const lat = 24.8607;
  const lng = 67.0011;
  const bbox = `${lng - 0.01},${lat - 0.006},${lng + 0.01},${lat + 0.006}`;
  const rows = [
    [IconMail, 'E-mail', 'support@marketlink.example', 'mailto:support@marketlink.example'],
    [IconPhone, 'Phone', '+00 000 000 0000', 'tel:+000000000000'],
    [IconMap, 'Address', '12 Orchard Road, Green Valley', null],
  ];
  return (
    <div className="static-page">
      <header className="static-hero">
        <span className="kicker dark">Contact</span>
        <h1>We would love to hear from you.</h1>
        <p>Questions about an order, a market or selling on MarketLink? Reach out and we will get back to you.</p>
      </header>
      <div className="contact-grid">
        <ul className="contact-list">
          {rows.map(([Icon, label, value, href]) => (
            <li key={label}>
              <span className="feature-ico">
                <Icon />
              </span>
              <span>
                <small>{label}</small>
                {href ? <a href={href}>{value}</a> : <strong>{value}</strong>}
              </span>
            </li>
          ))}
        </ul>
        <iframe title="MarketLink location" className="map-frame" loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`} />
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="center notfound">
      <p className="nf-code" aria-hidden>
        404
      </p>
      <h1>This page went to market.</h1>
      <p className="muted">The page you are looking for does not exist.</p>
      <Link className="btn" to="/">
        Back home
      </Link>
    </div>
  );
}

// Placeholder for pages built in later steps.
export function ComingSoon({ title }) {
  return (
    <div className="card center">
      <h1>{title}</h1>
      <p className="muted">This page is coming in a later step.</p>
    </div>
  );
}
