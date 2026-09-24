import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import { adminApi, errorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { BarChart, Donut, HBars, Sparkline } from '../../components/admin/Charts';
import Kpi from '../../components/admin/Kpi';
import { IconBox, IconCheck, IconDownload, IconFlag, IconMap, IconRefresh, IconShield, IconUsers } from '../../components/Icons';
import { money, shortDay, timeAgo } from '../../utils';
import { StatusTag } from '../../components/Common';

const STATUS_COLORS = { completed: '#1f6b45', ready: '#f2b632', accepted: '#5b9bd5', placed: '#8a94a6', cancelled: '#e2542b', declined: '#b42318' };
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function Dashboard() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState('');
  const { data, loading, error } = useFetch(() => adminApi.dashboard(), [tick]);
  const s = data?.stats;

  // Keep the numbers fresh without a page reload (the server caches for 30s, so this is cheap).
  useEffect(() => {
    const timer = setInterval(() => setTick((previousTick) => previousTick + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  const [, force] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => force((n) => n + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  const decide = async (u, status) => {
    if (status === 'suspended' && !(await confirm({ title: `Reject ${u.farmerProfile?.stallName}?`, message: 'The farmer is notified and cannot list products.', confirmText: 'Reject', danger: true }))) return;
    setBusy(u._id);
    try {
      await adminApi.setFarmerStatus(u._id, status);
      toast(`${u.farmerProfile?.stallName} ${status === 'approved' ? 'approved' : 'rejected'}`);
      setTick((previousTick) => previousTick + 1);
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  if (!s) {
    return (
      <>
        <header className="ad-head">
          <h1>{greeting()}</h1>
        </header>
        {error ? <p className="alert alert-error">{error}</p> : <div className="ad-skeleton">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="skeleton" />)}</div>}
      </>
    );
  }

  const a = s.attention;
  const att = [
    a.pendingFarmers.length > 0 && { ico: IconUsers, tone: 'warn', text: `${s.pendingFarmers} farmer${s.pendingFarmers > 1 ? 's' : ''} waiting for approval`, to: '/admin/users?status=pending' },
    a.lowRatedCount > 0 && { ico: IconFlag, tone: 'bad', text: `${a.lowRatedCount} low-rated review${a.lowRatedCount > 1 ? 's' : ''} this month`, to: '/admin/moderation' },
    a.outOfStock > 0 && { ico: IconBox, tone: 'info', text: `${a.outOfStock} product${a.outOfStock > 1 ? 's are' : ' is'} sold out`, to: '/admin/moderation?tab=products' },
    a.marketsNoFarmers > 0 && { ico: IconMap, tone: 'info', text: `${a.marketsNoFarmers} market${a.marketsNoFarmers > 1 ? 's have' : ' has'} no farmers yet`, to: '/admin/markets' },
    a.farmersNoProducts > 0 && { ico: IconUsers, tone: 'info', text: `${a.farmersNoProducts} approved farmer${a.farmersNoProducts > 1 ? 's have' : ' has'} no products listed`, to: '/admin/users?status=approved' },
    a.deactivated > 0 && { ico: IconShield, tone: 'muted', text: `${a.deactivated} deactivated account${a.deactivated > 1 ? 's' : ''}`, to: '/admin/users' },
  ].filter(Boolean);

  const days = s.days.map((day) => ({ label: shortDay(day.day), value: day.orders, sub: `${money(day.revenue)} completed · ${day.signups} new customers` }));
  const statusSegs = ['completed', 'ready', 'accepted', 'placed', 'cancelled', 'declined'].map((k) => ({ label: k[0].toUpperCase() + k.slice(1), value: s.byStatus[k] || 0, color: STATUS_COLORS[k] }));
  const completionRate = s.totalOrders ? Math.round(((s.byStatus.completed || 0) / s.totalOrders) * 100) : 0;

  return (
    <>
      <header className="ad-head">
        <div>
          <span className="kicker dark">Overview</span>
          <h1>{greeting()}, here is MarketLink today</h1>
        </div>
        <div className="ad-tools">
          <span className="muted small">Updated {timeAgo(s.generatedAt)}</span>
          <button className="btn btn-outline btn-sm" onClick={() => setTick((previousTick) => previousTick + 1)} disabled={loading}>
            <IconRefresh width={16} height={16} /> Refresh
          </button>
          <button className="btn btn-sm" onClick={() => adminApi.exportCsv('orders').catch((error) => toast(errorMessage(error)))}>
            <IconDownload width={16} height={16} /> Export orders
          </button>
        </div>
      </header>

      {(a.pendingFarmers.length > 0 || att.length > 0) && (
        <section className="ad-card attention">
          <h2>Needs your attention</h2>
          {a.pendingFarmers.length > 0 && (
            <ul className="approvals">
              {a.pendingFarmers.map((pendingFarmer) => (
                <li key={pendingFarmer._id}>
                  <span className="ap-avatar" aria-hidden>
                    {pendingFarmer.farmerProfile?.stallName?.[0]}
                  </span>
                  <span className="ap-info">
                    <strong>{pendingFarmer.farmerProfile?.stallName}</strong>
                    <small>
                      {pendingFarmer.name} · {pendingFarmer.email} · applied {timeAgo(pendingFarmer.createdAt)}
                    </small>
                  </span>
                  <span className="ap-actions">
                    <button className="btn btn-sm" disabled={busy === pendingFarmer._id} onClick={() => decide(pendingFarmer, 'approved')}>
                      <IconCheck width={16} height={16} /> Approve
                    </button>
                    <button className="btn btn-outline btn-sm" disabled={busy === pendingFarmer._id} onClick={() => decide(pendingFarmer, 'suspended')}>
                      Reject
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="att-chips">
            {att.map((x) => (
              <Link key={x.text} to={x.to} className={`att-chip ${x.tone}`}>
                <x.ico width={18} height={18} /> {x.text} <span aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="kpis">
        <Kpi icon={IconChart2} label="Revenue (completed orders)" value={money(s.revenue)} sub={`${money(s.last30.revenue)} in the last 30 days`} change={s.last30.revenueChange} to="/admin/reports" spark={<Sparkline values={s.days.map((day) => day.revenue)} color="var(--orange)" />} />
        <Kpi icon={IconBox} label="Orders" value={s.totalOrders} sub={`${s.last30.orders} in the last 30 days · ${completionRate}% completed`} change={s.last30.ordersChange} to="/admin/reports" spark={<Sparkline values={s.days.map((day) => day.orders)} />} />
        <Kpi icon={IconUsers} label="Customers" value={s.totalCustomers} sub={`+${s.days.reduce((total, day) => total + day.signups, 0)} in 14 days`} to="/admin/users?tab=customer" spark={<Sparkline values={s.days.map((day) => day.signups)} color="#5b9bd5" />} />
        <Kpi icon={IconShield} label="Farmers" value={s.totalFarmers} sub={s.pendingFarmers ? `${s.pendingFarmers} pending approval` : 'All approved'} to="/admin/users" />
        <Kpi icon={IconMap} label="Markets" value={s.totalMarkets} sub={`${s.totalProducts} products listed`} to="/admin/markets" />
      </section>

      <section className="ad-grid two">
        <div className="ad-card">
          <div className="ad-card-head">
            <h2>Orders, last 14 days</h2>
            <span className="muted small">{s.days.reduce((total, day) => total + day.orders, 0)} orders</span>
          </div>
          <BarChart data={days} />
        </div>
        <div className="ad-card">
          <div className="ad-card-head">
            <h2>Order status</h2>
          </div>
          <Donut segments={statusSegs} centerLabel="orders" />
        </div>
      </section>

      <section className="ad-grid three">
        <div className="ad-card">
          <div className="ad-card-head">
            <h2>Revenue by market</h2>
            <Link to="/admin/reports" className="arrow-link small">
              Reports →
            </Link>
          </div>
          <HBars rows={s.topMarkets.map((topMarket) => ({ label: topMarket.market || 'Unspecified', value: topMarket.revenue, note: `${topMarket.orders} completed orders` }))} format={money} empty="Completed orders will show revenue here." />
        </div>
        <div className="ad-card">
          <div className="ad-card-head">
            <h2>Recent orders</h2>
          </div>
          <ul className="feed">
            {s.recent.orders.map((order) => (
              <li key={order._id}>
                <span className="feed-main">
                  <strong>{order.customer?.name || 'Customer'}</strong>
                  <small>
                    {order.farmer?.farmerProfile?.stallName} · {timeAgo(order.createdAt)}
                  </small>
                </span>
                <span className="feed-side">
                  <b>{money(order.totalAmount)}</b>
                  <StatusTag status={order.status} />
                </span>
              </li>
            ))}
            {!s.recent.orders.length && <li className="muted small">No orders yet.</li>}
          </ul>
        </div>
        <div className="ad-card">
          <div className="ad-card-head">
            <h2>New sign-ups</h2>
            <Link to="/admin/users" className="arrow-link small">
              All users →
            </Link>
          </div>
          <ul className="feed">
            {s.recent.users.map((user) => (
              <li key={user._id}>
                <span className="feed-main">
                  <strong>{user.farmerProfile?.stallName || user.name}</strong>
                  <small>{timeAgo(user.createdAt)}</small>
                </span>
                <span className={`tag ${user.role === 'farmer' ? 'tag-ready' : 'tag-placed'}`}>{user.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

// Local alias so the KPI row reads naturally (a "money" glyph built from the chart icon set).
function IconChart2(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.8 9.2c-.4-.9-1.5-1.4-2.8-1.2-1.4.2-2.2 1-2 2 .2 1.6 4.2 1.1 4.3 2.8.1 1.1-1 1.8-2.4 1.8-1.2 0-2.2-.5-2.6-1.4" />
      <path d="M12 6.5v1.5M12 16v1.5" />
    </svg>
  );
}
