import { IconBasket, IconClock, IconCash } from './Icons';

// Split-screen layout shared by Login and Register: photo + promise on the left, form on the right.
export default function AuthShell({ title, sub, children }) {
  return (
    <div className="auth-split">
      <aside className="auth-art" aria-hidden>
        <div className="auth-art-inner">
          <span className="kicker">MarketLink</span>
          <p className="auth-quote">Fresh food, from hands you can meet.</p>
          <ul>
            <li>
              <IconBasket /> Real weekly stock from local growers
            </li>
            <li>
              <IconClock /> Reserve now, pick up on market day
            </li>
            <li>
              <IconCash /> Pay in person, no online payment
            </li>
          </ul>
        </div>
      </aside>
      <section className="auth-panel">
        <div className="auth-card">
          <h1>{title}</h1>
          {sub && <p className="auth-sub">{sub}</p>}
          {children}
        </div>
      </section>
    </div>
  );
}
