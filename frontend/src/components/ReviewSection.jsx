import { useState } from 'react';
import useFetch from '../hooks/useFetch';
import { reviewsApi, errorMessage } from '../services/api';
import { StarInput, Stars, Status } from './Common';

function ReviewForm({ orderId, productId, label, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!rating) return setError('Please choose a star rating');
    setError('');
    setBusy(true);
    try {
      await reviewsApi.create({ order: orderId, product: productId, rating, comment: comment.trim() || undefined });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="review-form" onSubmit={submit}>
      <strong>{label}</strong>
      <StarInput value={rating} onChange={setRating} />
      <textarea rows={2} maxLength={1000} placeholder="Share your experience (optional)" value={comment} onChange={(event) => setComment(event.target.value)} aria-label={`Comment for ${label}`} />
      {error && <p className="alert alert-error">{error}</p>}
      <button className="btn btn-sm" disabled={busy}>
        {busy ? 'Submitting...' : 'Submit review'}
      </button>
    </form>
  );
}

// Shown on a completed order: rate the farmer and each product once.
export default function ReviewSection({ order }) {
  const [tick, setTick] = useState(0);
  const { data, loading, error } = useFetch(() => reviewsApi.forOrder(order._id), [order._id, tick]);
  if (loading || error) return <Status loading={loading} error={error} />;

  const mine = data.reviews;
  const targets = [
    { key: 'farmer', label: `Rate ${order.farmer.farmerProfile.stallName}`, productId: undefined, done: mine.find((r) => r.targetType === 'farmer') },
    ...order.items.map((item) => ({ key: item.product, label: `Rate ${item.name}`, productId: item.product, done: mine.find((r) => r.product === item.product) })),
  ];

  return (
    <>
      <h2 className="section-title">Rate your order</h2>
      <div className="stack">
        {targets.map((target) => (
          <div className="card" key={target.key}>
            {target.done ? (
              <>
                <strong>{target.label.replace('Rate ', '')}</strong> <Stars value={target.done.rating} />
                {target.done.comment && <p className="small">{target.done.comment}</p>}
                {target.done.reply?.text && (
                  <p className="reply">
                    <strong>Farmer reply:</strong> {target.done.reply.text}
                  </p>
                )}
              </>
            ) : (
              <ReviewForm orderId={order._id} productId={target.productId} label={target.label} onDone={() => setTick(tick + 1)} />
            )}
          </div>
        ))}
      </div>
    </>
  );
}
