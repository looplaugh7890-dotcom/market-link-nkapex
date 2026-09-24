import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import { reviewsApi, errorMessage } from '../../services/api';
import { EmptyState, PageHead, Stars } from '../../components/Common';
import { IconStar } from '../../components/Icons';
import { timeAgo } from '../../utils';

function Reply({ review, onDone }) {
  const [text, setText] = useState(review.reply?.text || '');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const save = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await reviewsApi.reply(review._id, text);
      setOpen(false);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!open) {
    return (
      <div>
        {review.reply?.text && (
          <p className="reply">
            <strong>Your reply:</strong> {review.reply.text}
          </p>
        )}
        <button className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>
          {review.reply?.text ? 'Edit reply' : 'Reply'}
        </button>
      </div>
    );
  }
  return (
    <form onSubmit={save}>
      <textarea rows={2} required maxLength={1000} value={text} onChange={(event) => setText(event.target.value)} aria-label="Your reply" />
      {error && <p className="alert alert-error">{error}</p>}
      <div className="row-gap">
        <button className="btn btn-sm">Post reply</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Reviews() {
  const [tick, setTick] = useState(0);
  const { data, loading, error } = useFetch(() => reviewsApi.mine(), [tick]);
  const reviews = data?.reviews || [];
  const avg = reviews.length ? reviews.reduce((total, r) => total + r.rating, 0) / reviews.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.rating === n).length }));
  const unanswered = reviews.filter((r) => !r.reply?.text).length;

  return (
    <>
      <PageHead kicker="Reviews" title="What customers say" sub="Replying quickly to reviews builds trust, especially for the low ones." />
      {error && <p className="alert alert-error">{error}</p>}
      {!loading && !reviews.length && <EmptyState icon={IconStar} title="No reviews yet" text="Customers can review you and your products after a completed order." />}
      {reviews.length > 0 && (
        <section className="rating-summary ad-card">
          <div className="rs-avg">
            <strong>{avg.toFixed(1)}</strong>
            <Stars value={avg} />
            <span className="muted small">
              {reviews.length} review{reviews.length === 1 ? '' : 's'}
              {unanswered > 0 && ` · ${unanswered} awaiting your reply`}
            </span>
          </div>
          <ul className="rs-bars">
            {dist.map((d) => (
              <li key={d.n}>
                <span>{d.n} ★</span>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${reviews.length ? (d.c / reviews.length) * 100 : 0}%` }} />
                </div>
                <b>{d.c}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="stack">
        {reviews.map((r) => (
          <article className="review-card" key={r._id}>
            <span className="who-avatar" aria-hidden>
              {r.customer?.name?.[0] || 'C'}
            </span>
            <div className="rc-body">
              <div className="between">
                <strong>
                  {r.customer?.name || 'Customer'} <span className="muted small">on {r.product ? r.product.name : 'your stall'}</span>
                </strong>
                <Stars value={r.rating} />
              </div>
              {r.comment && <p>{r.comment}</p>}
              <small className="muted">{timeAgo(r.createdAt)}</small>
              <Reply review={r} onDone={() => setTick((previousTick) => previousTick + 1)} />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
