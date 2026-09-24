import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import { adminApi } from '../../services/api';
import { Pagination } from '../../components/Common';
import { timeAgo } from '../../utils';

const GROUPS = [
  ['', 'Everything'],
  ['farmer', 'Farmer approvals'],
  ['user', 'Accounts'],
  ['bulk', 'Bulk actions'],
  ['market', 'Markets'],
  ['category', 'Categories'],
  ['review', 'Reviews'],
  ['product', 'Listings'],
  ['announcement', 'Announcements'],
  ['report', 'Reports'],
  ['export', 'Exports'],
];
const TONE = { farmer: 'ok', user: 'warn', bulk: 'warn', market: 'info', category: 'info', review: 'bad', product: 'bad', announcement: 'info', report: 'muted', export: 'muted' };

export default function Audit() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error } = useFetch(() => adminApi.audit({ action, page, limit: 20 }), [action, page]);
  const logs = data?.logs || [];

  return (
    <>
      <header className="ad-head">
        <div>
          <span className="kicker dark">Audit log</span>
          <h1>Everything admins did</h1>
          <p className="muted">A permanent record of approvals, removals and exports, so every change can be traced to a person and a time.</p>
        </div>
      </header>
      <div className="chip-row inline wrap-chips" role="tablist" aria-label="Filter by type">
        {GROUPS.map(([v, l]) => (
          <button
            key={v}
            role="tab"
            aria-selected={action === v}
            className={action === v ? 'active' : ''}
            onClick={() => {
              setAction(v);
              setPage(1);
            }}
          >
            {l}
          </button>
        ))}
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="ad-card flush">
        <ul className="timeline-log">
          {loading && !logs.length && Array.from({ length: 6 }).map((_, index) => <li key={index}><div className="skeleton row-skel" /></li>)}
          {logs.map((log) => (
            <li key={log._id}>
              <span className={`tl-dot ${TONE[log.action.split('.')[0]] || 'muted'}`} aria-hidden />
              <span className="tl-main">
                <strong>{log.summary}</strong>
                <small>
                  {log.adminName} · <code>{log.action}</code>
                </small>
              </span>
              <time className="tl-time" dateTime={log.createdAt} title={new Date(log.createdAt).toLocaleString()}>
                {timeAgo(log.createdAt)}
              </time>
            </li>
          ))}
          {!loading && !logs.length && (
            <li className="empty">
              <strong>Nothing logged yet</strong>
              <span className="muted">Approvals, removals and exports will appear here.</span>
            </li>
          )}
        </ul>
      </div>
      {data && <Pagination page={data.page} pages={Math.ceil(data.total / 20)} onChange={setPage} />}
    </>
  );
}
