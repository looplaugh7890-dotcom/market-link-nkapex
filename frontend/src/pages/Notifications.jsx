import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useFetch from '../hooks/useFetch';
import { notificationsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { EmptyState, PageHead, Pagination, Status } from '../components/Common';
import { IconBell } from '../components/Icons';
import { timeAgo } from '../utils';

// Farmers manage orders under /farmer/orders, customers under /orders.
const targetFor = (role, link) => (role === 'farmer' && link?.startsWith('/orders') ? '/farmer/orders' : link);

export default function Notifications() {
  const { user } = useAuth();
  const { refresh } = useNotifications();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const { data, loading, error } = useFetch(() => notificationsApi.list({ page, limit: 15 }), [page, tick]);
  const ann = useFetch(() => notificationsApi.announcements(), []);

  const open = async (n) => {
    if (!n.read) {
      await notificationsApi.read(n._id).catch(() => {});
      refresh();
    }
    const to = targetFor(user.role, n.link);
    if (to) navigate(to);
    else setTick(tick + 1);
  };

  const readAll = async () => {
    await notificationsApi.readAll();
    refresh();
    setTick(tick + 1);
  };

  const list = data?.notifications || [];
  return (
    <>
      <PageHead kicker="Alerts" title="Notifications" sub={data?.unread ? `${data.unread} unread` : 'You are all caught up.'}>
        {data?.unread > 0 && (
          <button className="btn btn-outline btn-sm" onClick={readAll}>
            Mark all as read
          </button>
        )}
      </PageHead>

      {ann.data?.announcements.length > 0 && (
        <div className="announce-card">
          <span className="kicker">Announcements</span>
          {ann.data.announcements.slice(0, 3).map((a) => (
            <p key={a._id}>
              <strong>{a.title}</strong> <span className="muted small">{new Date(a.createdAt).toLocaleDateString()}</span>
              <br />
              {a.message}
            </p>
          ))}
        </div>
      )}

      <Status loading={loading} error={error} />
      {!loading && !error && !list.length && <EmptyState icon={IconBell} title="No notifications yet" text="Order updates, restock alerts and announcements will show up here." />}
      <div className="stack">
        {list.map((n) => (
          <button key={n._id} className={`notif-item ${n.read ? '' : 'unread'}`} onClick={() => open(n)}>
            <span className={`notif-ico t-${n.type}`} aria-hidden>
              <IconBell width={20} height={20} />
            </span>
            <span className="notif-body">
              <span className="between">
                <strong>{n.title}</strong>
                <span className="muted small" title={new Date(n.createdAt).toLocaleString()}>
                  {timeAgo(n.createdAt)}
                </span>
              </span>
              <span>{n.message}</span>
            </span>
            {!n.read && <i className="notif-dot" aria-label="unread" />}
          </button>
        ))}
      </div>
      {data && <Pagination page={page} pages={Math.ceil(data.total / 15)} onChange={setPage} />}
    </>
  );
}
