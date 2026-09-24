import { createContext, useCallback, useContext, useState } from 'react';
import { Link } from 'react-router-dom';

const ToastContext = createContext(() => {});

// toast('Added Tomatoes', { to: '/cart', label: 'View cart' })
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const toast = useCallback((message, action) => {
    const id = Math.random().toString(36).slice(2);
    setItems((cur) => [...cur.slice(-2), { id, message, action }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 3800);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div className="toast" key={t.id}>
            <span className="toast-tick" aria-hidden>
              ✓
            </span>
            <span>{t.message}</span>
            {t.action && (
              <Link to={t.action.to} onClick={() => setItems((cur) => cur.filter((x) => x.id !== t.id))}>
                {t.action.label}
              </Link>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
