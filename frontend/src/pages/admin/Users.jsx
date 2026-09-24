import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import { adminApi, errorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { Pagination } from '../../components/Common';
import { IconDownload, IconSearch } from '../../components/Icons';
import { timeAgo } from '../../utils';

const PAGE = 15;
const APPROVAL_TAG = { pending: 'tag tag-ready', approved: 'tag tag-completed', suspended: 'tag tag-cancelled' };

export default function Users() {
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const role = params.get('tab') === 'customer' ? 'customer' : 'farmer';
  const status = params.get('status') || '';
  const active = params.get('active') || '';
  const urlSearch = params.get('search') || '';
  const [search, setSearch] = useState(urlSearch);
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);

  // Live search: wait 300ms after the last keystroke, then put it in the URL (shareable + back button friendly).
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  useEffect(() => {
    if (search.trim() === urlSearch) return undefined;
    const t = setTimeout(() => go({ search: search.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data, loading, error } = useFetch(
    () => adminApi.users({ role, status: role === 'farmer' ? status : '', active, search: urlSearch, page, limit: PAGE }),
    [role, status, active, urlSearch, page, tick]
  );
  const users = data?.users || [];
  useEffect(() => setPicked(new Set()), [role, status, active, urlSearch, page, tick]);

  const go = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
    setPage(1);
  };

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast(okMsg);
      setTick((t) => t + 1);
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const one = async (u, action) => {
    const name = role === 'farmer' ? u.farmerProfile?.stallName : u.name;
    if (action === 'deactivate' && !(await confirm({ title: `Deactivate ${name}?`, message: 'They will be signed out and will not be able to log in until you activate the account again.', confirmText: 'Deactivate', danger: true }))) return;
    if (action === 'suspend' && !(await confirm({ title: `Suspend ${name}?`, message: 'Their stall disappears from public lists and they cannot list products.', confirmText: 'Suspend', danger: true }))) return;
    if (action === 'approve') return run(() => adminApi.setFarmerStatus(u._id, 'approved'), `${name} approved`);
    if (action === 'suspend') return run(() => adminApi.setFarmerStatus(u._id, 'suspended'), `${name} suspended`);
    return run(() => adminApi.setActive(u._id, action === 'activate'), `${name} ${action}d`);
  };

  const bulk = async (action) => {
    const ids = [...picked];
    const danger = action === 'deactivate' || action === 'suspend';
    if (danger && !(await confirm({ title: `${action[0].toUpperCase() + action.slice(1)} ${ids.length} account${ids.length > 1 ? 's' : ''}?`, message: 'This applies to every selected account.', confirmText: action[0].toUpperCase() + action.slice(1), danger: true }))) return;
    run(() => adminApi.bulkUsers(ids, action), `${ids.length} account${ids.length > 1 ? 's' : ''}: ${action} done`);
  };

  const allOnPage = users.length > 0 && users.every((u) => picked.has(u._id));
  const toggleAll = () => setPicked(allOnPage ? new Set() : new Set(users.map((u) => u._id)));
  const toggle = (id) =>
    setPicked((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <>
      <header className="ad-head">
        <div>
          <span className="kicker dark">Users</span>
          <h1>People on MarketLink</h1>
          <p className="muted">{data ? `${data.total} ${role === 'farmer' ? 'farmer' : 'customer'}${data.total === 1 ? '' : 's'}${urlSearch || status || active ? ' match your filters' : ''}` : ' '}</p>
        </div>
        <div className="ad-tools">
          <button className="btn btn-outline btn-sm" onClick={() => adminApi.exportCsv('users', { role }).catch((e) => toast(errorMessage(e)))}>
            <IconDownload width={16} height={16} /> Export CSV
          </button>
        </div>
      </header>

      <div className="seg" role="tablist">
        <button role="tab" aria-selected={role === 'farmer'} className={role === 'farmer' ? 'active' : ''} onClick={() => go({ tab: '', status: '', active: '' })}>
          Farmers
        </button>
        <button role="tab" aria-selected={role === 'customer'} className={role === 'customer' ? 'active' : ''} onClick={() => go({ tab: 'customer', status: '', active: '' })}>
          Customers
        </button>
      </div>

      <div className="ad-filters">
        <label className="ad-search">
          <IconSearch width={18} height={18} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${role === 'farmer' ? 'stall, name or e-mail' : 'name or e-mail'}…`} aria-label="Search users" />
        </label>
        {role === 'farmer' && (
          <div className="chip-row inline" role="tablist" aria-label="Approval status">
            {[
              ['', 'All'],
              ['pending', 'Pending'],
              ['approved', 'Approved'],
              ['suspended', 'Suspended'],
            ].map(([v, l]) => (
              <button key={v} role="tab" aria-selected={status === v} className={status === v ? 'active' : ''} onClick={() => go({ status: v })}>
                {l}
              </button>
            ))}
          </div>
        )}
        <div className="chip-row inline" role="tablist" aria-label="Account state">
          {[
            ['', 'Any account'],
            ['true', 'Active'],
            ['false', 'Deactivated'],
          ].map(([v, l]) => (
            <button key={v} role="tab" aria-selected={active === v} className={active === v ? 'active' : ''} onClick={() => go({ active: v })}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {picked.size > 0 && (
        <div className="bulkbar" role="region" aria-label="Bulk actions">
          <strong>{picked.size} selected</strong>
          {role === 'farmer' && (
            <>
              <button className="btn btn-sm" disabled={busy} onClick={() => bulk('approve')}>
                Approve
              </button>
              <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => bulk('suspend')}>
                Suspend
              </button>
            </>
          )}
          <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => bulk('activate')}>
            Activate
          </button>
          <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => bulk('deactivate')}>
            Deactivate
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setPicked(new Set())}>
            Clear
          </button>
        </div>
      )}

      {error && <p className="alert alert-error">{error}</p>}
      <div className="ad-card flush">
        <div className="table-wrap flat">
          <table className="table ad-table">
            <thead>
              <tr>
                <th className="chk">
                  <input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select all on this page" />
                </th>
                <th>{role === 'farmer' ? 'Stall' : 'Customer'}</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Joined</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !users.length && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan="6">
                    <div className="skeleton row-skel" />
                  </td>
                </tr>
              ))}
              {users.map((u) => {
                const ap = u.farmerProfile?.approvalStatus;
                const name = role === 'farmer' ? u.farmerProfile?.stallName : u.name;
                return (
                  <tr key={u._id} className={picked.has(u._id) ? 'sel' : ''}>
                    <td className="chk" data-label="">
                      <input type="checkbox" checked={picked.has(u._id)} onChange={() => toggle(u._id)} aria-label={`Select ${name}`} />
                    </td>
                    <td data-label={role === 'farmer' ? 'Stall' : 'Customer'}>
                      <div className="who">
                        <span className="who-avatar" aria-hidden>
                          {name?.[0]}
                        </span>
                        <span>
                          <strong>{name}</strong>
                          {role === 'farmer' && <small>{u.name}</small>}
                        </span>
                      </div>
                    </td>
                    <td data-label="Contact">
                      <div className="cell-stack">
                        <span>{u.email}</span>
                        <small>{u.phone}</small>
                      </div>
                    </td>
                    <td data-label="Status">
                      <span className="pills-inline">
                        {ap && <span className={APPROVAL_TAG[ap]}>{ap}</span>}
                        <span className={`tag ${u.isActive ? 'tag-completed' : 'tag-cancelled'}`}>{u.isActive ? 'active' : 'deactivated'}</span>
                      </span>
                    </td>
                    <td data-label="Joined">
                      <span title={new Date(u.createdAt).toLocaleString()}>{timeAgo(u.createdAt)}</span>
                    </td>
                    <td className="right" data-label="">
                      <div className="row-actions">
                        {role === 'farmer' && ap !== 'approved' && (
                          <button className="btn btn-sm" disabled={busy} onClick={() => one(u, 'approve')}>
                            Approve
                          </button>
                        )}
                        {role === 'farmer' && ap === 'approved' && (
                          <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => one(u, 'suspend')}>
                            Suspend
                          </button>
                        )}
                        <button className={`btn btn-sm ${u.isActive ? 'btn-ghost danger-text' : 'btn-outline'}`} disabled={busy} onClick={() => one(u, u.isActive ? 'deactivate' : 'activate')}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && !users.length && (
          <div className="empty">
            <strong>No users match</strong>
            <span className="muted">Try a different search or clear the filters.</span>
            <button className="btn btn-outline btn-sm" onClick={() => setParams({ ...(role === 'customer' ? { tab: 'customer' } : {}) })}>
              Clear filters
            </button>
          </div>
        )}
      </div>
      {data && <Pagination page={data.page} pages={Math.ceil(data.total / PAGE)} onChange={setPage} />}
    </>
  );
}
