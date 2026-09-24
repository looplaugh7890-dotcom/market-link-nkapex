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
    setMessages((previousMessages) => [...previousMessages, { from: 'user', text: msg }]);
    setText('');
    setBusy(true);
    try {
      const { data } = await chatbotApi.ask(msg);
      setMessages((previousMessages) => [...previousMessages, { from: 'bot', text: data.reply, data: data.data }]);
    } catch (error) {
      setMessages((previousMessages) => [...previousMessages, { from: 'bot', text: errorMessage(error) }]);
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
            {messages.map((message, index) => (
              <div key={index} className={`bubble ${message.from}`}>
                {message.text.split('\n').map((line, n) => (
                  <div key={n}>{line}</div>
                ))}
                {message.data?.products && (
                  <div className="bubble-links">
                    {message.data.products.map((product) => (
                      <Link key={product._id} to={`/products/${product._id}`} onClick={() => setOpen(false)}>
                        View {product.name}
                      </Link>
                    ))}
                  </div>
                )}
                {message.data?.markets && (
                  <div className="bubble-links">
                    {message.data.markets.map((market) => (
                      <Link key={market._id} to={`/markets/${market._id}`} onClick={() => setOpen(false)}>
                        View {market.name}
                      </Link>
                    ))}
                  </div>
                )}
                {message.data?.farmerId && (
                  <div className="bubble-links">
                    <Link to={`/farmers/${message.data.farmerId}`} onClick={() => setOpen(false)}>
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
            onSubmit={(event) => {
              event.preventDefault();
              send(text);
            }}
          >
            <input value={text} maxLength={300} placeholder="Ask about products, markets..." onChange={(event) => setText(event.target.value)} aria-label="Your message" />
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
