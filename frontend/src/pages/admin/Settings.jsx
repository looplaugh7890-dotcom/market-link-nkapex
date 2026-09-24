import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import { adminApi, categoriesApi, notificationsApi, errorMessage } from '../../services/api';
import { Status } from '../../components/Common';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';

function Categories() {
  const confirm = useConfirm();
  const toast = useToast();
  const [tick, setTick] = useState(0);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null); // { id, name }
  const [msg, setMsg] = useState({ type: '', text: '' });
  const { data, loading, error } = useFetch(() => categoriesApi.list({ all: 'true' }), [tick]);

  const run = async (fn, ok) => {
    setMsg({ type: '', text: '' });
    try {
      await fn();
      if (ok) toast(ok);
      setTick((t) => t + 1);
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
    }
  };

  return (
    <section className="ad-card stack">
      <h2>Product categories</h2>
      <form
        className="row-gap"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => categoriesApi.create({ name }), 'Category added.').then(() => setName(''));
        }}
      >
        <input required maxLength={50} placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} aria-label="New category name" style={{ maxWidth: 260 }} />
        <button className="btn btn-sm">Add</button>
      </form>
      {msg.text && <p className={`alert alert-${msg.type}`}>{msg.text}</p>}
      <Status loading={loading} error={error} />
      {data?.categories.map((c) => (
        <div className="between line" key={c._id}>
          {editing?.id === c._id ? (
            <form
              className="row-gap"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => categoriesApi.update(c._id, { name: editing.name }), 'Category renamed.');
                setEditing(null);
              }}
            >
              <input required maxLength={50} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="Category name" />
              <button className="btn btn-sm">Save</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </form>
          ) : (
            <span>
              {c.name} {!c.isActive && <span className="tag tag-cancelled">inactive</span>}
            </span>
          )}
          {editing?.id !== c._id && (
            <div className="row-gap">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ id: c._id, name: c.name })}>
                Rename
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => run(() => categoriesApi.update(c._id, { isActive: !c.isActive }))}>
                {c.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button className="btn btn-ghost btn-sm danger-text" onClick={async () => (await confirm({ title: `Delete ${c.name}?`, message: 'Categories that still have products cannot be deleted; deactivate them instead.', confirmText: 'Delete', danger: true })) && run(() => categoriesApi.remove(c._id), 'Category deleted.')}>
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function Announcements() {
  const confirm = useConfirm();
  const toast = useToast();
  const [tick, setTick] = useState(0);
  const [f, setF] = useState({ title: '', message: '', audience: 'all' });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);
  const { data, loading, error } = useFetch(() => notificationsApi.announcements(), [tick]);

  const publish = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    setBusy(true);
    try {
      await adminApi.createAnnouncement(f);
      setF({ title: '', message: '', audience: 'all' });
      toast('Announcement published and sent as a notification');
      setTick((t) => t + 1);
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ad-card stack">
      <h2>Platform announcements</h2>
      <form className="stack" onSubmit={publish}>
        <label>
          Title
          <input required maxLength={150} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </label>
        <label>
          Message
          <textarea required rows={3} maxLength={2000} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
        </label>
        <label>
          Send to
          <select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
            <option value="all">Everyone</option>
            <option value="customers">Customers only</option>
            <option value="farmers">Farmers only</option>
          </select>
        </label>
        <div>
          <button className="btn" disabled={busy}>
            {busy ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </form>
      {msg.text && <p className={`alert alert-${msg.type}`}>{msg.text}</p>}
      <Status loading={loading} error={error} />
      {data?.announcements.map((a) => (
        <div className="between line" key={a._id}>
          <div>
            <strong>{a.title}</strong> <span className="tag">{a.audience}</span>
            <div className="small">{a.message}</div>
            <div className="muted small">{new Date(a.createdAt).toLocaleString()}</div>
          </div>
          <button
            className="btn btn-ghost btn-sm danger-text"
            onClick={async () => {
              if (!(await confirm({ title: 'Delete this announcement?', confirmText: 'Delete', danger: true }))) return;
              await adminApi.removeAnnouncement(a._id).catch(() => {});
              setTick((t) => t + 1);
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </section>
  );
}

export default function Settings() {
  return (
    <>
      <header className="ad-head">
        <div>
          <span className="kicker dark">Settings</span>
          <h1>Categories and announcements</h1>
          <p className="muted">Master data that shapes the storefront, and notices sent to every customer or farmer.</p>
        </div>
      </header>
      <div className="ad-grid two start">
        <Categories />
        <Announcements />
      </div>
    </>
  );
}
