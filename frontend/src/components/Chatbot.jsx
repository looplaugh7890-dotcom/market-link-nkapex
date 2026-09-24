import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { chatbotApi, errorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

const SUGGESTIONS = ['Do you have tomatoes?', 'When are markets open?', 'How does pickup work?'];
const GREETING = { from: 'bot', text: 'Hi! I can help you find products, market timings, farmer availability and pickup info.' };

// Floating assistant backed by POST /api/chatbot. Hidden for farmers and admins.
export default function Chatbot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, open]);

  if (user && user.role !== 'customer') return null;

  const send = async (raw) => {
    const msg = raw.trim();
    if (!msg || busy) return;
    setMessages((m) => [...m, { from: 'user', text: msg }]);
    setText('');
    setBusy(true);
    try {
      const { data } = await chatbotApi.ask(msg);
      setMessages((m) => [...m, { from: 'bot', text: data.reply, data: data.data }]);
    } catch (err) {
      setMessages((m) => [...m, { from: 'bot', text: errorMessage(err) }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <section className="chat-panel" aria-label="Assistant">
          <header className="chat-head">
            <strong>MarketLink Assistant</strong>
            <button className="chat-close" aria-label="Close assistant" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>
          <div className="chat-body" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.from}`}>
                {m.text.split('\n').map((line, n) => (
                  <div key={n}>{line}</div>
                ))}
                {m.data?.products && (
                  <div className="bubble-links">
                    {m.data.products.map((p) => (
                      <Link key={p._id} to={`/products/${p._id}`} onClick={() => setOpen(false)}>
                        View {p.name}
                      </Link>
                    ))}
                  </div>
                )}
                {m.data?.markets && (
                  <div className="bubble-links">
                    {m.data.markets.map((mk) => (
                      <Link key={mk._id} to={`/markets/${mk._id}`} onClick={() => setOpen(false)}>
                        View {mk.name}
                      </Link>
                    ))}
                  </div>
                )}
                {m.data?.farmerId && (
                  <div className="bubble-links">
                    <Link to={`/farmers/${m.data.farmerId}`} onClick={() => setOpen(false)}>
                      View stall
                    </Link>
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="bubble bot muted">Typing...</div>}
            <div ref={endRef} />
          </div>
          {messages.length === 1 && (
            <div className="chips chat-chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <input value={text} maxLength={300} placeholder="Ask about products, markets..." onChange={(e) => setText(e.target.value)} aria-label="Your message" />
            <button className="btn btn-sm" disabled={busy || !text.trim()}>
              Send
            </button>
          </form>
        </section>
      )}
      <button className="chat-fab" aria-label={open ? 'Close assistant' : 'Open assistant'} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? '×' : '💬'}
      </button>
    </>
  );
}
