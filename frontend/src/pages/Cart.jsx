import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useFetch from '../hooks/useFetch';
import { farmersApi, ordersApi, errorMessage, imageUrl } from '../services/api';
import { useCart } from '../context/CartContext';
import { EmptyState, PageHead, SlotPicker, Status } from '../components/Common';
import { IconCart } from '../components/Icons';
import { money } from '../utils';

export default function Cart() {
  const cart = useCart();
  const navigate = useNavigate();
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const [market, setMarket] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const farmerIds = useMemo(() => [...new Set(cart.items.map((item) => item.product.farmerId))], [cart.items]);
  const { data: farmers, loading } = useFetch(
    () => Promise.all(farmerIds.map((farmerId) => farmersApi.get(farmerId).catch(() => null))).then((rs) => ({ data: rs.map((r) => r?.data || null) })),
    [farmerIds.join(',')]
  );

  // Live stock/price per product, from the farmers' public in-stock lists.
  const live = useMemo(() => {
    const map = {};
    (farmers || []).forEach((f) => f?.products.forEach((p) => (map[p._id] = p)));
    return map;
  }, [farmers]);

  useEffect(() => {
    if (farmers) cart.sync(live);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmers]);

  const profiles = useMemo(() => (farmers || []).filter(Boolean).map((f) => f.farmer.farmerProfile), [farmers]);
  const missing = farmers ? cart.items.filter((item) => !live[item.product._id]) : [];

  // Markets that every farmer in the cart sells at.
  const commonMarkets = useMemo(() => {
    const lists = profiles.map((profile) => profile.markets || []).filter((m) => m.length);
    if (!lists.length) return [];
    return lists[0].filter((m) => lists.every((list) => list.some((x) => x._id === m._id)));
  }, [profiles]);
  const noCommonMarket = profiles.some((profile) => profile.markets?.length) && !commonMarkets.length;

  if (!cart.items.length) {
    return (
      <>
        <PageHead kicker="Cart" title="Your cart" />
        <EmptyState icon={IconCart} title="Your cart is empty" text="Browse fresh produce and add items to reserve them for pickup." to="/products" cta="Browse products" />
      </>
    );
  }

  const groups = farmerIds.map((fid) => {
    const lines = cart.items.filter((item) => item.product.farmerId === fid);
    return { fid, stall: lines[0].product.stallName, lines };
  });
  const canSubmit = !loading && !missing.length && !noCommonMarket && date && slot && (!commonMarkets.length || market);

  const place = async (event) => {
    event.preventDefault();
    setError('');
    const [start, end] = slot.split('-');
    setBusy(true);
    try {
      const res = await ordersApi.place({
        items: cart.items.map((item) => ({ product: item.product._id, quantity: item.quantity })),
        market: market || undefined,
        pickupDate: date,
        pickupSlot: { start, end },
        notes: notes.trim() || undefined,
      });
      cart.clear();
      navigate('/orders', { state: { placed: res.data.orders.length } });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead kicker="Cart" title="Your cart" sub={`${cart.count} item${cart.count === 1 ? '' : 's'} · reserve now, pay in person at pickup`} />
      <div className="cart-layout">
      <div className="cart-groups">
      {groups.map((group) => (
        <div className="card mb" key={group.fid}>
          <h2>
            <Link to={`/farmers/${group.fid}`}>{group.stall}</Link>
          </h2>
          {group.lines.map(({ product: p, quantity }) => {
            const gone = farmers && !live[p._id];
            const img = imageUrl(p.image);
            return (
              <div className="cart-line" key={p._id}>
                <div className="cart-thumb">{img ? <img src={img} alt="" /> : <span aria-hidden>{p.name?.[0]}</span>}</div>
                <div className="cart-info">
                  <Link to={p.slug ? `/products/${p.slug}` : `/products/${p._id}`}>{p.name}</Link>
                  <div className="muted small">
                    {money(p.price)} / {p.unit}
                  </div>
                  {gone && <div className="alert alert-error">No longer available. Remove it to continue.</div>}
                </div>
                <input className="qty" type="number" min="1" max={p.max} value={quantity} disabled={gone} onChange={(event) => cart.setQuantity(p._id, Number(event.target.value) || 1)} aria-label={`Quantity of ${p.name}`} />
                <strong className="cart-sub">{money(p.price * quantity)}</strong>
                <button className="btn btn-ghost btn-sm" onClick={() => cart.removeItem(p._id)} aria-label={`Remove ${p.name}`}>
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      ))}
      </div>

      <form className="card stack cart-summary" onSubmit={place}>
        <h2>Pickup details</h2>
        <p className="muted small">Pre-orders are picked up at the market and paid for in person. Separate farmers get separate orders for the same pickup time.</p>
        <Status loading={loading} />
        {noCommonMarket && <p className="alert alert-error">The farmers in your cart do not share a market. Please order from them separately.</p>}
        {commonMarkets.length > 0 && (
          <label>
            Pickup market
            <select required value={market} onChange={(event) => setMarket(event.target.value)}>
              <option value="">Select a market</option>
              {commonMarkets.map((commonMarket) => (
                <option key={commonMarket._id} value={commonMarket._id}>
                  {commonMarket.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!loading && (
          <SlotPicker
            farmers={profiles}
            date={date}
            slot={slot}
            onDate={(d) => {
              setDate(d);
              setSlot('');
            }}
            onSlot={setSlot}
          />
        )}
        <label>
          Notes for the farmer (optional)
          <textarea rows={2} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <div className="between">
          <h2>Total: {money(cart.total)}</h2>
          <button className="btn" disabled={!canSubmit || busy}>
            {busy ? 'Placing order...' : 'Place pre-order'}
          </button>
        </div>
        {error && <p className="alert alert-error">{error}</p>}
      </form>
      </div>
    </>
  );
}
